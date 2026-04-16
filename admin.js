/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI — Admin Dashboard Logic
 *  Dipindahkan dari admin.html untuk performa optimal
 * ================================================
 */

let allBookings = [];
let filteredBookings = [];
let cmsSettingsCache = {};
const ADMIN_SESSION_KEY = 'adminSessionToken';
const RESERVATION_PAGE_SIZE = 25;
let currentReservationPage = 1;
let reservationSearchQuery = '';
let reservationSearchDebounce = null;

function getAdminSessionToken() {
    return localStorage.getItem(ADMIN_SESSION_KEY) || '';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function escapeJsSingle(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/</g, '\\x3C')
        .replace(/>/g, '\\x3E');
}

function normalizeThumbUrl(url) {
    let thumb = String(url || '').trim();
    if (!thumb) return '';
    if (thumb.includes('drive.google.com/uc')) {
        try {
            const id = thumb.split('id=')[1].split('&')[0];
            thumb = `https://lh3.googleusercontent.com/d/${id}`;
        } catch (e) {}
    } else if (thumb.includes('id=')) {
        try {
            thumb = 'https://lh3.googleusercontent.com/d/' + thumb.split('id=')[1].split('&')[0];
        } catch (e) {}
    }
    return thumb;
}

function clearAdminSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('adminPin');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminNama');
}

function isAuthError(result) {
    const message = (result && result.message ? result.message : '').toLowerCase();
    return result && result.status === 'error' && (
        message.includes('sesi login') ||
        message.includes('login kembali') ||
        message.includes('akses ditolak')
    );
}

function handleAdminAuthFailure(message) {
    clearAdminSession();
    alert(message || 'Sesi login berakhir. Silakan login kembali.');
    location.reload();
}

async function adminGet(action, extraParams = {}) {
    const connector = window.GAS_URL.includes('?') ? '&' : '?';
    const params = new URLSearchParams({ action, ...extraParams });
    const token = getAdminSessionToken();
    if (token) params.set('sessionToken', token);

    const res = await fetch(`${window.GAS_URL}${connector}${params.toString()}`);
    const result = await res.json();
    if (isAuthError(result)) {
        handleAdminAuthFailure(result.message);
        throw new Error(result.message);
    }
    return result;
}

async function adminPost(payload) {
    const body = { ...payload };
    const token = getAdminSessionToken();
    if (token) body.sessionToken = token;

    const res = await fetch(`${window.GAS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const result = await res.json();
    if (isAuthError(result)) {
        handleAdminAuthFailure(result.message);
        throw new Error(result.message);
    }
    return result;
}

document.addEventListener('DOMContentLoaded', () => {
    const passInput = document.getElementById('passInput');
    if (passInput) passInput.placeholder = '........';

    const sessionToken = getAdminSessionToken();
    if (sessionToken) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        document.getElementById('adminNameTxt').textContent = localStorage.getItem('adminNama') || 'Admin';
        loadAllData();
        loadCMSData();
        loadLayananList();
    } else {
        localStorage.removeItem('adminPin');
    }
});

async function doLogin() {
    const pass = document.getElementById('passInput').value;
    if(!pass) return;
    const btn = document.getElementById('btnLogin');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const result = await fetch(`${window.GAS_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'authAdmin', pass })
        }).then(r => r.json());
        if(result.status === 'success' && result.sessionToken) {
            localStorage.setItem(ADMIN_SESSION_KEY, result.sessionToken);
            localStorage.setItem('adminRole', result.role || 'admin');
            localStorage.setItem('adminNama', result.nama || 'Admin');
            location.reload();
        } else {
            alert(result.message || 'Login gagal. Silakan coba lagi.');
        }
    } catch(e) { alert("Error: " + e.message); }
    finally { btn.innerHTML = 'Akses Sistem'; btn.disabled = false; }
}

function logout() {
    const token = getAdminSessionToken();
    clearAdminSession();
    if (!token) {
        location.reload();
        return;
    }

    fetch(`${window.GAS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logoutAdmin', sessionToken: token })
    }).finally(() => location.reload());
}

function toggleSidebar(show) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (show) {
        sidebar.classList.remove('-translate-x-[120%]');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-[120%]');
        overlay.classList.add('hidden');
    }
}

function switchTab(tabId, el) {
    if (window.innerWidth < 1024) toggleSidebar(false);

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');

    if (tabId === 'tab-artikel') loadArtikelListAdmin();
    if (tabId === 'tab-galeri') loadGaleriListAdmin();
    if (tabId === 'tab-cms') {
        loadCMSData();
        loadLayananList();
    }
}

async function loadAllData() {
    showLoader(true);
    try {
        const result = await adminGet('getSemuaBooking');
        if(result.status === 'success') {
            allBookings = result.data;
            currentReservationPage = 1;
            renderTables();
        }
    } catch(e) { console.error(e); }
    finally { showLoader(false); }
}

function renderTables() {
    const role = localStorage.getItem('adminRole');
    const myName = localStorage.getItem('adminNama');

    const visibleData = allBookings.filter(b => {
        if(role === 'terapis') return b.terapis === myName;
        return true;
    });

    // 1. Table Reservasi
    const resBody = document.getElementById('tbReservasiBody');
    resBody.innerHTML = '';
    visibleData.forEach(b => {
        let badgeClass = 'bg-slate-50 text-slate-400 border-slate-100';
        if(b.status === 'DITERIMA') badgeClass = 'bg-blue-50 text-blue-600 border-blue-200';
        else if(b.status === 'SELESAI') badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
        else if(b.status.includes('Batal')) badgeClass = 'bg-red-50 text-red-600 border-red-200';

        resBody.innerHTML += `
            <tr>
                <td>
                    <div class="font-bold text-slate-800">${b.nama}</div>
                    <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fab fa-whatsapp text-emerald-500"></i> ${b.hp}</div>
                </td>
                <td>
                    <div class="font-bold text-emerald-700">${b.layanan}</div>
                    <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fas fa-user-md"></i> ${b.terapis}</div>
                </td>
                <td>
                    <div class="font-bold text-slate-700">${new Date(b.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">${b.waktu} WIB</div>
                </td>
                <td>
                    <span class="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${badgeClass}">
                        ${b.status}
                    </span>
                </td>
                <td class="text-center">
                    <button onclick="openModalStatus(${b.row}, '${b.status}')" class="bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm mx-auto">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    // 2. Table Ulasan
    const ulasanBody = document.getElementById('tbUlasanBody');
    ulasanBody.innerHTML = '';
    visibleData.filter(b => b.rating).forEach(b => {
        let stars = '⭐'.repeat(parseInt(b.rating));
        ulasanBody.innerHTML += `
            <tr>
                <td class="font-bold text-slate-800">${b.nama}</td>
                <td class="text-xs font-bold text-slate-500">${b.layanan}</td>
                <td class="text-xs">${stars}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs italic">${b.ulasan || '-'}</td>
            </tr>
        `;
    });

    // 3. Table EMR
    const emrBody = document.getElementById('tbEMRBody');
    emrBody.innerHTML = '';
    visibleData.forEach(b => {
        emrBody.innerHTML += `
            <tr>
                <td class="text-xs font-mono text-slate-500">#${b.row}</td>
                <td class="font-bold text-slate-800">${b.nama}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${b.keluhan || '-'}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${b.tindakan || '-'}</td>
                <td class="text-center">
                    <button onclick="openEMR(${b.row}, '${b.nama}', '${b.keluhan || ''}', '${b.tindakan || ''}')" class="bg-emerald-50 text-emerald-600 font-bold text-[10px] px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest">
                        Edit EMR
                    </button>
                </td>
            </tr>
        `;
    });
}

function handleSearch(val) {
    const query = val.toLowerCase().trim();
    document.querySelectorAll('#tbReservasiBody tr').forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// Override versi lama dengan render yang lebih ringan + pagination.
function renderTables() {
    const role = localStorage.getItem('adminRole');
    const myName = localStorage.getItem('adminNama');

    const visibleData = allBookings.filter(b => {
        if(role === 'terapis') return b.terapis === myName;
        return true;
    });

    filteredBookings = getReservationFilteredData(visibleData);
    renderReservationsTable();

    const ulasanBody = document.getElementById('tbUlasanBody');
    let ulasanHtml = '';
    visibleData.filter(b => b.rating).forEach(b => {
        let stars = 'â­'.repeat(parseInt(b.rating));
        ulasanHtml += `
            <tr>
                <td class="font-bold text-slate-800">${b.nama}</td>
                <td class="text-xs font-bold text-slate-500">${b.layanan}</td>
                <td class="text-xs">${stars}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs italic">${b.ulasan || '-'}</td>
            </tr>
        `;
    });
    ulasanBody.innerHTML = ulasanHtml;

    const emrBody = document.getElementById('tbEMRBody');
    let emrHtml = '';
    visibleData.forEach(b => {
        emrHtml += `
            <tr>
                <td class="text-xs font-mono text-slate-500">#${b.row}</td>
                <td class="font-bold text-slate-800">${b.nama}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${b.keluhan || '-'}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${b.tindakan || '-'}</td>
                <td class="text-center">
                    <button onclick="openEMR(${b.row}, '${b.nama}', '${b.keluhan || ''}', '${b.tindakan || ''}')" class="bg-emerald-50 text-emerald-600 font-bold text-[10px] px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest">
                        Edit EMR
                    </button>
                </td>
            </tr>
        `;
    });
    emrBody.innerHTML = emrHtml;
}

function handleSearch(val) {
    reservationSearchQuery = (val || '').toLowerCase().trim();
    currentReservationPage = 1;
    if (reservationSearchDebounce) clearTimeout(reservationSearchDebounce);
    reservationSearchDebounce = setTimeout(() => {
        const role = localStorage.getItem('adminRole');
        const myName = localStorage.getItem('adminNama');
        const visibleData = allBookings.filter(b => {
            if(role === 'terapis') return b.terapis === myName;
            return true;
        });
        filteredBookings = getReservationFilteredData(visibleData);
        renderReservationsTable();
    }, 180);
}

function getReservationFilteredData(bookings) {
    if (!reservationSearchQuery) return bookings;
    return bookings.filter(b => {
        const haystack = [
            b.nama,
            b.hp,
            b.layanan,
            b.terapis,
            b.tanggal,
            b.waktu,
            b.status
        ].join(' ').toLowerCase();
        return haystack.includes(reservationSearchQuery);
    });
}

function getReservationBadgeClass(status) {
    let badgeClass = 'bg-slate-50 text-slate-400 border-slate-100';
    if(status === 'DITERIMA') badgeClass = 'bg-blue-50 text-blue-600 border-blue-200';
    else if(status === 'SELESAI') badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
    else if((status || '').includes('Batal')) badgeClass = 'bg-red-50 text-red-600 border-red-200';
    return badgeClass;
}

function renderReservationsTable() {
    const resBody = document.getElementById('tbReservasiBody');
    if (!resBody) return;

    const totalItems = filteredBookings.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / RESERVATION_PAGE_SIZE));
    currentReservationPage = Math.min(currentReservationPage, totalPages);
    const startIndex = (currentReservationPage - 1) * RESERVATION_PAGE_SIZE;
    const pageItems = filteredBookings.slice(startIndex, startIndex + RESERVATION_PAGE_SIZE);

    if (pageItems.length === 0) {
        resBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-slate-400 font-bold py-10">
                    Tidak ada data reservasi yang cocok.
                </td>
            </tr>
        `;
        renderReservationPagination(totalItems, totalPages, 0, 0);
        return;
    }

    resBody.innerHTML = pageItems.map(b => `
        <tr>
            <td>
                <div class="font-bold text-slate-800">${b.nama}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fab fa-whatsapp text-emerald-500"></i> ${b.hp}</div>
            </td>
            <td>
                <div class="font-bold text-emerald-700">${b.layanan}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fas fa-user-md"></i> ${b.terapis}</div>
            </td>
            <td>
                <div class="font-bold text-slate-700">${new Date(b.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</div>
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">${b.waktu} WIB</div>
            </td>
            <td>
                <span class="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${getReservationBadgeClass(b.status)}">
                    ${b.status}
                </span>
            </td>
            <td class="text-center">
                <button onclick="openModalStatus(${b.row}, '${b.status}')" class="bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm mx-auto">
                    <i class="fas fa-edit text-xs"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderReservationPagination(totalItems, totalPages, startIndex + 1, Math.min(startIndex + pageItems.length, totalItems));
}

function renderReservationPagination(totalItems, totalPages, startItem, endItem) {
    const container = document.getElementById('reservasiPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.innerHTML = `<div class="text-xs font-bold text-slate-400">0 data</div>`;
        return;
    }

    container.innerHTML = `
        <div class="text-xs font-bold text-slate-400">
            Menampilkan ${startItem}-${endItem} dari ${totalItems} reservasi
        </div>
        <div class="flex items-center gap-2">
            <button onclick="changeReservationPage(-1)" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-black ${currentReservationPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-300 hover:text-emerald-600'}" ${currentReservationPage <= 1 ? 'disabled' : ''}>
                Sebelumnya
            </button>
            <div class="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black">
                Hal. ${currentReservationPage}/${totalPages}
            </div>
            <button onclick="changeReservationPage(1)" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-black ${currentReservationPage >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-300 hover:text-emerald-600'}" ${currentReservationPage >= totalPages ? 'disabled' : ''}>
                Berikutnya
            </button>
        </div>
    `;
}

function changeReservationPage(direction) {
    const totalPages = Math.max(1, Math.ceil(filteredBookings.length / RESERVATION_PAGE_SIZE));
    const nextPage = currentReservationPage + direction;
    if (nextPage < 1 || nextPage > totalPages) return;
    currentReservationPage = nextPage;
    renderReservationsTable();
}

function showLoader(show) {
    document.getElementById('loader').classList.toggle('hidden', !show);
}

function getClinicCheckinPayload(secretCode) {
    return `RSDS-CLINIC|${secretCode}`;
}

function renderClinicCheckinQr(secretCode) {
    const img = document.getElementById('clinicQrImage');
    const text = document.getElementById('clinicQrCodeText');
    const printImg = document.getElementById('printClinicQrImage');
    const printText = document.getElementById('printClinicQrCodeText');
    if (!img || !text) return;

    if (!secretCode) {
        img.removeAttribute('src');
        text.textContent = 'Kode check-in belum diatur di CMS.';
        if (printImg) printImg.removeAttribute('src');
        if (printText) printText.textContent = 'Kode check-in belum diatur di CMS.';
        return;
    }

    const payload = getClinicCheckinPayload(secretCode);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=${encodeURIComponent(payload)}`;
    img.src = qrUrl;
    text.textContent = payload;
    if (printImg) printImg.src = qrUrl;
    if (printText) printText.textContent = payload;
}

async function copyClinicQrCode() {
    const secretCode = cmsSettingsCache.cms_checkin_secret_code || '';
    if (!secretCode) {
        alert('Kode QR check-in belum tersedia.');
        return;
    }

    try {
        await navigator.clipboard.writeText(getClinicCheckinPayload(secretCode));
        alert('Kode QR check-in berhasil disalin.');
    } catch (e) {
        alert('Gagal menyalin kode QR.');
    }
}

function printClinicQrPoster() {
    const secretCode = cmsSettingsCache.cms_checkin_secret_code || '';
    if (!secretCode) {
        alert('Kode QR check-in belum tersedia.');
        return;
    }

    window.print();
}

// ── CMS & LAYANAN MANAGER ──
async function loadCMSData() {
    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const res = await fetch(`${window.GAS_URL}${connector}action=getLandingSettings`);
        const result = await res.json();
        if (result.status === 'success') {
            const data = result.data;
            cmsSettingsCache = data || {};
            renderClinicCheckinQr(cmsSettingsCache.cms_checkin_secret_code || '');
            for (const key in data) {
                const el = document.getElementById(key);
                if (el) el.value = data[key];
            }
        }
    } catch (e) { console.error("Gagal load CMS:", e); }
}

async function saveCMS() {
    const btn = document.getElementById('btnSaveCMS');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sinkronkan...';
    btn.disabled = true;

    const updatedData = {};
    const inputs = document.querySelectorAll('#tab-cms input, #tab-cms textarea');
    inputs.forEach(input => {
        if (input.id && input.id.startsWith('cms_')) {
            updatedData[input.id] = input.value;
        }
    });

    try {
        const result = await adminPost({ action: 'updateLandingSettings', updatedData: updatedData });
        if (result.status === 'success') {
            alert("✅ Web Berhasil Disinkronkan (Cache dibersihkan)!");
        } else {
            alert("❌ Gagal: " + result.message);
        }
    } catch (e) { alert("Error koneksi ke server."); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

let currentLayanan = [];
async function loadLayananList() {
    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const res = await fetch(`${window.GAS_URL}${connector}action=getLayananList`);
        const result = await res.json();
        if (result.status === 'success') {
            currentLayanan = result.data || [];
            renderLayananList();
        }
    } catch (e) { }
}

function renderLayananList() {
    const container = document.getElementById('layananList');
    container.innerHTML = currentLayanan.map((l, idx) => `
        <div class="bg-white/60 border border-white rounded-[1.5rem] p-5 shadow-sm relative group">
            <button onclick="deleteLayananRow(${idx})" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>
            <div class="grid md:grid-cols-12 gap-6">
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nama, Icon & Warna</label>
                    <input type="text" class="cms-input !py-3" id="lay_nama_${idx}" value="${l.nama}" placeholder="Cth: Bekam Sunnah">
                    <div class="flex gap-2">
                        <input type="text" class="cms-input !py-3 flex-1" id="lay_icon_${idx}" value="${l.icon}" placeholder="Cth: fas fa-leaf">
                        <select id="lay_warna_${idx}" class="cms-input !py-3 !text-xs w-24">
                            ${['emerald','teal','cyan','blue','violet','amber'].map(w => `<option value="${w}" ${l.warna === w ? 'selected' : ''}>${w}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-4 pt-1">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="lay_terlaris_${idx}" ${l.terlaris ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
                            <span class="text-[10px] font-bold text-slate-600">Terlaris</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="lay_lintas_${idx}" ${l.lintas_gender ? 'checked' : ''} class="w-4 h-4 accent-teal-500">
                            <span class="text-[10px] font-bold text-slate-600">Lintas Gender</span>
                        </label>
                    </div>
                </div>
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aturan Booking (Jadwal & Terapis)</label>
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_hari_${idx}" value="${l.hari_aktif || ''}" placeholder="Hari Aktif (0-6, Pisah Koma)">
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_terapis_${idx}" value="${l.terapis_khusus || ''}" placeholder="Terapis Khusus (Pisah Koma)">
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_foto_${idx}" value="${l.foto || ''}" placeholder="Link Foto (Opsional)">
                </div>
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deskripsi & Detail Web</label>
                    <textarea class="cms-input !py-3 !text-xs" id="lay_desc_${idx}" rows="2" placeholder="Penjelasan singkat">${l.deskripsi}</textarea>
                    <textarea class="cms-input !py-3 !text-xs" id="lay_detail_${idx}" rows="2" placeholder="Item detail (pisah koma)">${l.detail}</textarea>
                </div>
            </div>
        </div>
    `).join('');
}

function addLayananRow() {
    currentLayanan.push({ nama: '', deskripsi: '', detail: '', icon: 'fas fa-leaf', foto: '', terlaris: false, warna: 'emerald', hari_aktif: '', terapis_khusus: '' });
    renderLayananList();
}

function deleteLayananRow(idx) {
    if(!confirm("Hapus layanan ini?")) return;
    currentLayanan.splice(idx, 1);
    renderLayananList();
}

async function saveLayanan() {
    const btn = document.getElementById('btnSaveLayanan');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const dataToSave = currentLayanan.map((_, idx) => ({
        nama: document.getElementById(`lay_nama_${idx}`).value,
        icon: document.getElementById(`lay_icon_${idx}`).value,
        deskripsi: document.getElementById(`lay_desc_${idx}`).value,
        detail: document.getElementById(`lay_detail_${idx}`).value,
        foto: document.getElementById(`lay_foto_${idx}`).value,
        terlaris: document.getElementById(`lay_terlaris_${idx}`).checked,
        warna: document.getElementById(`lay_warna_${idx}`).value,
        hari_aktif: document.getElementById(`lay_hari_${idx}`).value,
        terapis_khusus: document.getElementById(`lay_terapis_${idx}`).value,
        lintas_gender: document.getElementById(`lay_lintas_${idx}`).checked
    }));

    try {
        const result = await adminPost({ action: 'saveLayananList', layananData: dataToSave });
        if (result.status === 'success') {
            alert("✅ Daftar Layanan Berhasil Diperbarui!");
            loadLayananList();
        } else { alert("Gagal simpan layanan: " + result.message); }
    } catch (e) { alert("Error koneksi saat simpan layanan."); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ── MODAL STATUS ──
function openModalStatus(row, current) {
    document.getElementById('editRowIndex').value = row;
    document.getElementById('editStatus').value = current;
    document.getElementById('modalStatus').classList.remove('hidden');
}
function closeModalStatus() { document.getElementById('modalStatus').classList.add('hidden'); }

async function saveStatus() {
    const row = document.getElementById('editRowIndex').value;
    const stat = document.getElementById('editStatus').value;
    const btn = document.getElementById('btnSaveStatus');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Memproses...';
    btn.disabled = true;

    try {
        const result = await adminPost({ action: 'adminUpdateStatus', row: row, status: stat });
        if(result.status === 'success') {
            closeModalStatus();
            loadAllData();
        } else {
            alert("Gagal update status: " + result.message);
        }
    } catch(e) { alert("Error koneksi: Gagal memperbarui status."); }
    finally { btn.innerHTML = originalText; btn.disabled = false; }
}

// ── MODAL EMR ──
function openEMR(row, nama, keluhan, tindakan) {
    document.getElementById('emrRowIndex').value = row;
    document.getElementById('emrNamaPasien').textContent = nama;
    document.getElementById('emrKeluhan').value = keluhan;
    document.getElementById('emrTindakan').value = tindakan;
    document.getElementById('modalEMR').classList.remove('hidden');
}
function closeEMR() { document.getElementById('modalEMR').classList.add('hidden'); }

async function saveEMR() {
    const row = document.getElementById('emrRowIndex').value;
    const k = document.getElementById('emrKeluhan').value;
    const t = document.getElementById('emrTindakan').value;
    const btn = document.getElementById('btnSaveEMR');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const result = await adminPost({ action: 'adminUpdateRekamMedis', row: row, tensi: '', keluhan: k, tindakan: t });
        if(result.status === 'success') {
            closeEMR();
            loadAllData();
        } else {
            alert("Gagal simpan EMR: " + result.message);
        }
    } catch(e) { alert("Error koneksi: Gagal menyimpan rekam medis."); }
    finally { btn.innerHTML = originalText; btn.disabled = false; }
}

// ── ARTIKEL MANAGER ──
let artikelData = [];
async function loadArtikelListAdmin() {
    try {
        document.getElementById('artikelList').innerHTML = '<p class="text-slate-400 font-bold text-sm text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat artikel...</p>';
        const result = await adminGet('getArtikelListAdmin');
        if (result.status === 'success') {
            artikelData = result.data || [];
            renderArtikelList();
        } else { alert("Gagal memuat artikel: " + result.message); }
    } catch(e) { alert("Error koneksi saat memuat artikel."); }
}

function renderArtikelList() {
    const container = document.getElementById('artikelList');
    if (artikelData.length === 0) {
        container.innerHTML = `<div class="col-span-full border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-slate-400">
            <i class="fas fa-newspaper text-5xl mb-4 opacity-20"></i>
            <p class="font-bold">Belum ada artikel. Mulai menulis sekarang!</p>
        </div>`;
        return;
    }
    container.innerHTML = artikelData.map((a, idx) => {
        let thumb = a.foto || '';
        if (thumb.includes('drive.google.com/uc')) {
            try { const id = thumb.split('id=')[1].split('&')[0]; thumb = `https://lh3.googleusercontent.com/d/${id}`; } catch(e){}
        }
        return `
        <div class="group bg-white/70 backdrop-blur-md border border-white rounded-[2rem] p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden">
            <div class="h-32 bg-slate-100 rounded-[1.5rem] overflow-hidden mb-4 relative">
                ${thumb ? `<img src="${thumb}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fas fa-image text-3xl"></i></div>`}
                <div class="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[8px] font-black uppercase tracking-widest text-indigo-600">${a.kategori || 'Umum'}</div>
            </div>
            <h3 class="font-bold text-slate-800 text-sm line-clamp-2 leading-tight mb-4 pr-10">${a.judul || '(Tanpa Judul)'}</h3>
            <div class="flex items-center justify-between">
                <span class="text-[9px] font-black uppercase tracking-widest ${a.status==='published' ? 'text-emerald-500' : 'text-amber-500'}">${a.status || 'Draft'}</span>
                <div class="flex gap-2 relative z-10">
                    <button onclick="openEditArtikel(${idx})" class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all shadow-sm"><i class="fas fa-pencil-alt text-xs"></i></button>
                    <button onclick="deleteArtikelRecord('${a.id}', ${idx})" class="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm"><i class="fas fa-trash-alt text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function openEditArtikel(idx) {
    const modal = document.getElementById('modalEditorArtikel');
    const isNew = idx === null;
    const data = isNew ? { id: '', judul: '', ringkasan: '', isi: '', foto: '', kategori: 'Umum', status: 'draft' } : artikelData[idx];

    document.getElementById('art_idx_modal').value = isNew ? 'new' : idx;
    document.getElementById('art_id_modal').value = data.id || '';
    document.getElementById('art_judul_modal').value = data.judul || '';
    document.getElementById('art_kat_modal').value = data.kategori || 'Umum';
    document.getElementById('art_status_modal').value = data.status || 'draft';
    document.getElementById('art_foto_modal').value = data.foto || '';
    document.getElementById('art_ringkasan_modal').value = data.ringkasan || '';
    document.getElementById('art_isi_modal').value = data.isi || '';
    document.getElementById('art_doc_id_modal').value = data.doc_id || '';

    updateArtPreview(data.foto);
    modal.classList.remove('hidden');
}

function updateArtPreview(url) {
    const img = document.getElementById('art_preview_modal');
    if(url) {
        let thumb = url;
        if (thumb.includes('id=')) { thumb = 'https://lh3.googleusercontent.com/d/' + thumb.split('id=')[1].split('&')[0]; }
        img.src = thumb;
        img.classList.remove('hidden');
    } else { img.classList.add('hidden'); }
}

async function uploadArtikelImageModal(input) {
    const file = input.files[0];
    if(!file) return;
    const btn = input.previousElementSibling;
    const orig = btn.innerHTML; btn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
    try {
        const url = await uploadToDrive(file);
        document.getElementById('art_foto_modal').value = url;
        updateArtPreview(url);
        alert("✅ Foto Terunggah!");
    } catch(e) { alert(e.message); }
    finally { btn.innerHTML = orig; }
}

async function saveArtikelFromModal() {
    const idx = document.getElementById('art_idx_modal').value;
    const btn = document.getElementById('btnSaveArtModal');
    const orig = btn.innerHTML;

    const data = {
        id: document.getElementById('art_id_modal').value,
        judul: document.getElementById('art_judul_modal').value,
        ringkasan: document.getElementById('art_ringkasan_modal').value,
        isi: document.getElementById('art_isi_modal').value,
        foto: document.getElementById('art_foto_modal').value,
        kategori: document.getElementById('art_kat_modal').value,
        status: document.getElementById('art_status_modal').value,
        doc_id: document.getElementById('art_doc_id_modal').value
    };

    if(!data.judul) return alert("Judul wajib diisi!");

    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyimpan...';
    btn.disabled = true;
    try {
        const result = await adminPost({ action: 'saveArtikel', artikelData: data });
        if(result.status === 'success') {
            alert("✅ Artikel Berhasil Disimpan!");
            closeModal('modalEditorArtikel');
            loadArtikelListAdmin();
        } else { alert(result.message); }
    } catch(e) { alert("Error koneksi saat simpan."); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

async function deleteArtikelRecord(id, idx) {
    if(!id) { artikelData.splice(idx, 1); renderArtikelList(); return; }
    if(!confirm("Yakin hapus permanen? Foto di G-Drive tidak terhapus.")) return;
    try {
        const result = await adminPost({ action: 'deleteArtikel', artikelId: id });
        if(result.status === 'success') { loadArtikelListAdmin(); } else { alert(result.message); }
    } catch(e) { alert("Gagal hapus."); }
}

// ── GALERI MANAGER ──
let galeriData = [];
async function loadGaleriListAdmin() {
    try {
        document.getElementById('galeriList').innerHTML = '<p class="text-slate-400 font-bold text-sm text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat galeri...</p>';
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const res = await fetch(`${window.GAS_URL}${connector}action=getGaleriList`);
        const result = await res.json();
        if (result.status === 'success') {
            galeriData = result.data || [];
            renderGaleriList();
        } else { alert("Gagal memuat galeri."); }
    } catch(e) { }
}

function renderGaleriList() {
    const container = document.getElementById('galeriList');
    if (galeriData.length === 0) {
        container.innerHTML = `<div class="col-span-full border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-slate-400">
            <i class="fas fa-images text-5xl mb-4 opacity-20"></i>
            <p class="font-bold">Galeri masih kosong. Tambahkan momen terbaik Anda.</p>
        </div>`;
        return;
    }
    container.innerHTML = galeriData.map((g, idx) => {
        let thumb = g.url_foto || '';
        if (thumb.includes('drive.google.com/uc')) {
            try { const id = thumb.split('id=')[1].split('&')[0]; thumb = `https://lh3.googleusercontent.com/d/${id}`; } catch(e){}
        }
        return `
        <div class="group bg-white/70 backdrop-blur-md border border-white rounded-[2rem] p-3 shadow-sm hover:shadow-xl transition-all relative overflow-hidden flex flex-col">
            <div class="aspect-square bg-slate-100 rounded-[1.5rem] overflow-hidden mb-3 relative shadow-inner">
                ${thumb ? `<img src="${thumb}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">` : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fas fa-image text-3xl"></i></div>`}
                <div class="absolute top-2 left-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest text-slate-500">${g.kategori || 'Galeri'}</div>
            </div>
            <div class="px-2 pb-2">
                <h4 class="font-bold text-slate-800 text-[10px] truncate mb-2">${g.judul || '(Tanpa Nama)'}</h4>
                <div class="flex gap-2 justify-end">
                    <button onclick="openEditGaleri(${idx})" class="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white flex items-center justify-center transition-all"><i class="fas fa-pencil-alt text-[10px]"></i></button>
                    <button onclick="deleteGaleriRecord('${g.id}', ${idx})" class="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"><i class="fas fa-trash-alt text-[10px]"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function openEditGaleri(idx) {
    const modal = document.getElementById('modalEditorGaleri');
    const isNew = idx === null;
    const data = isNew ? { id: '', judul: '', url_foto: '', kategori: 'Fasilitas', urutan: 999, keterangan: '' } : galeriData[idx];

    document.getElementById('gal_idx_modal').value = isNew ? 'new' : idx;
    document.getElementById('gal_judul_modal').value = data.judul || '';
    document.getElementById('gal_kat_modal').value = data.kategori || 'Fasilitas';
    document.getElementById('gal_urut_modal').value = data.urutan || 999;
    document.getElementById('gal_ket_modal').value = data.keterangan || '';
    document.getElementById('gal_url_modal').value = data.url_foto || '';

    updateGalPreview(data.url_foto);
    modal.classList.remove('hidden');
}

function updateGalPreview(url) {
    const img = document.getElementById('gal_preview_modal');
    if(url) {
        let thumb = url;
        if (thumb.includes('id=')) { thumb = 'https://lh3.googleusercontent.com/d/' + thumb.split('id=')[1].split('&')[0]; }
        img.src = thumb;
        img.classList.remove('hidden');
    } else { img.classList.add('hidden'); }
}

async function uploadGaleriImageModal(input) {
    const file = input.files[0];
    if(!file) return;
    const url = await uploadToDrive(file);
    document.getElementById('gal_url_modal').value = url;
    updateGalPreview(url);
    alert("✅ Foto Terpasang!");
}

async function saveGaleriFromModal() {
    const btn = document.getElementById('btnSaveGalModal');
    const orig = btn.innerHTML;

    const item = {
        id: galeriData[document.getElementById('gal_idx_modal').value]?.id || '',
        judul: document.getElementById('gal_judul_modal').value,
        url_foto: document.getElementById('gal_url_modal').value,
        kategori: document.getElementById('gal_kat_modal').value,
        urutan: parseInt(document.getElementById('gal_urut_modal').value) || 999,
        keterangan: document.getElementById('gal_ket_modal').value
    };

    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyimpan...';
    btn.disabled = true;
    try {
        const idx = document.getElementById('gal_idx_modal').value;
        const newPayload = [...galeriData];
        if (idx === 'new') newPayload.push(item); else newPayload[idx] = item;

        const result = await adminPost({ action: 'saveGaleri', galeriData: newPayload });
        if(result.status === 'success') {
            closeModal('modalEditorGaleri');
            loadGaleriListAdmin();
        } else { alert(result.message); }
    } catch(e) { alert("Error simpan galeri."); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

async function deleteGaleriRecord(id, idx) {
    if(!confirm("Hapus foto ini dari galeri?")) return;
    const newPayload = [...galeriData];
    newPayload.splice(idx, 1);
    try {
        const result = await adminPost({ action: 'saveGaleri', galeriData: newPayload });
        if(result.status === 'success') loadGaleriListAdmin();
    } catch(e) { alert("Gagal hapus."); }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function createDocFromModal() {
    const judul = document.getElementById('art_judul_modal').value;
    if(!judul) return alert("Isi Judul Artikel terlebih dahulu!");

    const btn = document.getElementById('btnCreateDocModal');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sedang Membuat...';
    btn.disabled = true;

    try {
        const result = await adminPost({ action: 'createDoc', judul: judul });
        if(result.status === 'success') {
            document.getElementById('art_doc_id_modal').value = result.data.docId;
            alert("✅ Google Doc Berhasil Dibuat!");
            window.open('https://docs.google.com/document/d/' + result.data.docId, '_blank');
        } else { alert(result.message); }
    } catch(e) { alert("Error koneksi saat membuat dokumen."); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

async function uploadHeroImage(input) {
    const file = input.files[0];
    if(!file) return;

    const btn = document.getElementById('btnUploadImage');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sejenak...';

    try {
        const url = await uploadToDrive(file);
        document.getElementById('cms_hero_image').value = url;
        alert("✅ Foto Hero berhasil diupdate!");
    } catch(e) { alert(e.message); }
    finally { btn.innerHTML = originalHTML; }
}

async function uploadToDrive(file) {
    return new Promise((resolve, reject) => {
        if (!window.GAS_URL) {
            return reject(new Error("GAS_URL tidak ditemukan. Cek config.js"));
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const result = await adminPost({
                    action: 'uploadImage',
                    base64: e.target.result,
                    fileName: file.name,
                    mimeType: file.type
                });
                if(result.status === 'success') resolve(result.url);
                else reject(new Error(result.message || "Gagal upload (Backend Error)"));
            } catch(err) {
                console.error("Fetch Upload Error:", err);
                reject(new Error("Gagal terhubung ke server upload: " + err.message));
            }
        };
        reader.onerror = () => reject(new Error("Gagal membaca file lokal."));
        reader.readAsDataURL(file);
    });
}

// ── DATABASE & MIGRASI ──
async function runDatabaseInit() {
    if(!confirm("Yakin ingin melakukan inisialisasi tabel di Neon?")) return;
    const btn = document.getElementById('btnDbInit');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sedang Memproses...';
    btn.disabled = true;

    try {
        const result = await adminPost({ action: 'initDb' });
        alert(result.message);
    } catch(e) { alert("Error koneksi database."); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

// Sinkronisasi CEPAT: Booking dari Sheets ke Neon via HTTP API (tidak timeout)
async function runSinkronCepat() {
    if(!confirm("Sinkronisasi semua booking dari Sheets ke Neon sekarang?\n\nProses ini aman dan tidak menghapus data.")) return;
    const btn = document.getElementById('btnSinkronCepat');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyinkronkan...';
    btn.disabled = true;

    try {
        const result = await adminPost({ action: 'sinkronCepat' });
        alert(result.message || "Sinkronisasi selesai!");
    } catch(e) { alert("Error koneksi saat sinkronisasi."); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

// Migrasi LENGKAP: Harus dijalankan dari GAS Editor untuk dataset besar
async function runFullMigration() {
    alert(
        "⚠️ PERHATIAN: Migrasi Lengkap tidak bisa dijalankan dari tombol ini.\n\n" +
        "Alasannya: Proses JDBC membutuhkan lebih dari 30 detik, melebihi batas waktu server.\n\n" +
        "✅ CARA YANG BENAR:\n" +
        "1. Buka Google Apps Script Editor\n" +
        "2. Pilih fungsi: jalankanMigrasiSemua\n" +
        "3. Klik ▶ Run\n\n" +
        "Untuk sinkronisasi booking harian, gunakan tombol 'Sinkron Booking ke Neon'."
    );
}

// Sanitized render overrides
function renderTables() {
    const role = localStorage.getItem('adminRole');
    const myName = localStorage.getItem('adminNama');

    const visibleData = allBookings.filter(b => {
        if (role === 'terapis') return b.terapis === myName;
        return true;
    });

    filteredBookings = getReservationFilteredData(visibleData);
    renderReservationsTable();

    const ulasanBody = document.getElementById('tbUlasanBody');
    ulasanBody.innerHTML = visibleData.filter(b => b.rating).map(b => {
        const stars = '?'.repeat(parseInt(b.rating, 10) || 0);
        return `
            <tr>
                <td class="font-bold text-slate-800">${escapeHtml(b.nama)}</td>
                <td class="text-xs font-bold text-slate-500">${escapeHtml(b.layanan)}</td>
                <td class="text-xs">${escapeHtml(stars)}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs italic">${escapeHtml(b.ulasan || '-')}</td>
            </tr>
        `;
    }).join('');

    const emrBody = document.getElementById('tbEMRBody');
    emrBody.innerHTML = visibleData.map(b => `
        <tr>
            <td class="text-xs font-mono text-slate-500">#${escapeHtml(b.row)}</td>
            <td class="font-bold text-slate-800">${escapeHtml(b.nama)}</td>
            <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${escapeHtml(b.keluhan || '-')}</td>
            <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${escapeHtml(b.tindakan || '-')}</td>
            <td class="text-center">
                <button onclick="openEMR(${Number(b.row) || 0}, '${escapeJsSingle(b.nama)}', '${escapeJsSingle(b.keluhan || '')}', '${escapeJsSingle(b.tindakan || '')}')" class="bg-emerald-50 text-emerald-600 font-bold text-[10px] px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest">
                    Edit EMR
                </button>
            </td>
        </tr>
    `).join('');
}

function renderReservationsTable() {
    const resBody = document.getElementById('tbReservasiBody');
    if (!resBody) return;

    const totalItems = filteredBookings.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / RESERVATION_PAGE_SIZE));
    currentReservationPage = Math.min(currentReservationPage, totalPages);
    const startIndex = (currentReservationPage - 1) * RESERVATION_PAGE_SIZE;
    const pageItems = filteredBookings.slice(startIndex, startIndex + RESERVATION_PAGE_SIZE);

    if (pageItems.length === 0) {
        resBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-slate-400 font-bold py-10">
                    Tidak ada data reservasi yang cocok.
                </td>
            </tr>
        `;
        renderReservationPagination(totalItems, totalPages, 0, 0);
        return;
    }

    resBody.innerHTML = pageItems.map(b => `
        <tr>
            <td>
                <div class="font-bold text-slate-800">${escapeHtml(b.nama)}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fab fa-whatsapp text-emerald-500"></i> ${escapeHtml(b.hp)}</div>
            </td>
            <td>
                <div class="font-bold text-emerald-700">${escapeHtml(b.layanan)}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fas fa-user-md"></i> ${escapeHtml(b.terapis)}</div>
            </td>
            <td>
                <div class="font-bold text-slate-700">${escapeHtml(new Date(b.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short'}))}</div>
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">${escapeHtml(b.waktu)} WIB</div>
            </td>
            <td>
                <span class="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${getReservationBadgeClass(b.status)}">
                    ${escapeHtml(b.status)}
                </span>
            </td>
            <td class="text-center">
                <button onclick="openModalStatus(${Number(b.row) || 0}, '${escapeJsSingle(b.status)}')" class="bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm mx-auto">
                    <i class="fas fa-edit text-xs"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderReservationPagination(totalItems, totalPages, startIndex + 1, Math.min(startIndex + pageItems.length, totalItems));
}

function renderLayananList() {
    const container = document.getElementById('layananList');
    container.innerHTML = currentLayanan.map((l, idx) => `
        <div class="bg-white/60 border border-white rounded-[1.5rem] p-5 shadow-sm relative group">
            <button onclick="deleteLayananRow(${idx})" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>
            <div class="grid md:grid-cols-12 gap-6">
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nama, Icon & Warna</label>
                    <input type="text" class="cms-input !py-3" id="lay_nama_${idx}" value="${escapeAttr(l.nama)}" placeholder="Cth: Bekam Sunnah">
                    <div class="flex gap-2">
                        <input type="text" class="cms-input !py-3 flex-1" id="lay_icon_${idx}" value="${escapeAttr(l.icon)}" placeholder="Cth: fas fa-leaf">
                        <select id="lay_warna_${idx}" class="cms-input !py-3 !text-xs w-24">
                            ${['emerald','teal','cyan','blue','violet','amber'].map(w => `<option value="${w}" ${l.warna === w ? 'selected' : ''}>${w}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-4 pt-1">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="lay_terlaris_${idx}" ${l.terlaris ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
                            <span class="text-[10px] font-bold text-slate-600">Terlaris</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="lay_lintas_${idx}" ${l.lintas_gender ? 'checked' : ''} class="w-4 h-4 accent-teal-500">
                            <span class="text-[10px] font-bold text-slate-600">Lintas Gender</span>
                        </label>
                    </div>
                </div>
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aturan Booking (Jadwal & Terapis)</label>
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_hari_${idx}" value="${escapeAttr(l.hari_aktif || '')}" placeholder="Hari Aktif (0-6, Pisah Koma)">
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_terapis_${idx}" value="${escapeAttr(l.terapis_khusus || '')}" placeholder="Terapis Khusus (Pisah Koma)">
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_foto_${idx}" value="${escapeAttr(l.foto || '')}" placeholder="Link Foto (Opsional)">
                </div>
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deskripsi & Detail Web</label>
                    <textarea class="cms-input !py-3 !text-xs" id="lay_desc_${idx}" rows="2" placeholder="Penjelasan singkat">${escapeHtml(l.deskripsi)}</textarea>
                    <textarea class="cms-input !py-3 !text-xs" id="lay_detail_${idx}" rows="2" placeholder="Item detail (pisah koma)">${escapeHtml(l.detail)}</textarea>
                </div>
            </div>
        </div>
    `).join('');
}

function renderArtikelList() {
    const container = document.getElementById('artikelList');
    if (artikelData.length === 0) {
        container.innerHTML = `<div class="col-span-full border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-slate-400">
            <i class="fas fa-newspaper text-5xl mb-4 opacity-20"></i>
            <p class="font-bold">Belum ada artikel. Mulai menulis sekarang!</p>
        </div>`;
        return;
    }
    container.innerHTML = artikelData.map((a, idx) => {
        const thumb = normalizeThumbUrl(a.foto);
        const safeStatus = String(a.status || 'draft');
        return `
        <div class="group bg-white/70 backdrop-blur-md border border-white rounded-[2rem] p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden">
            <div class="h-32 bg-slate-100 rounded-[1.5rem] overflow-hidden mb-4 relative">
                ${thumb ? `<img src="${escapeAttr(thumb)}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fas fa-image text-3xl"></i></div>`}
                <div class="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[8px] font-black uppercase tracking-widest text-indigo-600">${escapeHtml(a.kategori || 'Umum')}</div>
            </div>
            <h3 class="font-bold text-slate-800 text-sm line-clamp-2 leading-tight mb-4 pr-10">${escapeHtml(a.judul || '(Tanpa Judul)')}</h3>
            <div class="flex items-center justify-between">
                <span class="text-[9px] font-black uppercase tracking-widest ${safeStatus === 'published' ? 'text-emerald-500' : 'text-amber-500'}">${escapeHtml(a.status || 'Draft')}</span>
                <div class="flex gap-2 relative z-10">
                    <button onclick="openEditArtikel(${idx})" class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all shadow-sm"><i class="fas fa-pencil-alt text-xs"></i></button>
                    <button onclick="deleteArtikelRecord('${escapeJsSingle(a.id)}', ${idx})" class="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm"><i class="fas fa-trash-alt text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderGaleriList() {
    const container = document.getElementById('galeriList');
    if (galeriData.length === 0) {
        container.innerHTML = `<div class="col-span-full border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-slate-400">
            <i class="fas fa-images text-5xl mb-4 opacity-20"></i>
            <p class="font-bold">Galeri masih kosong. Tambahkan momen terbaik Anda.</p>
        </div>`;
        return;
    }
    container.innerHTML = galeriData.map((g, idx) => {
        const thumb = normalizeThumbUrl(g.url_foto);
        return `
        <div class="group bg-white/70 backdrop-blur-md border border-white rounded-[2rem] p-3 shadow-sm hover:shadow-xl transition-all relative overflow-hidden flex flex-col">
            <div class="aspect-square bg-slate-100 rounded-[1.5rem] overflow-hidden mb-3 relative shadow-inner">
                ${thumb ? `<img src="${escapeAttr(thumb)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">` : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fas fa-image text-3xl"></i></div>`}
                <div class="absolute top-2 left-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest text-slate-500">${escapeHtml(g.kategori || 'Galeri')}</div>
            </div>
            <div class="px-2 pb-2">
                <h4 class="font-bold text-slate-800 text-[10px] truncate mb-2">${escapeHtml(g.judul || '(Tanpa Nama)')}</h4>
                <div class="flex gap-2 justify-end">
                    <button onclick="openEditGaleri(${idx})" class="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white flex items-center justify-center transition-all"><i class="fas fa-pencil-alt text-[10px]"></i></button>
                    <button onclick="deleteGaleriRecord('${escapeJsSingle(g.id)}', ${idx})" class="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"><i class="fas fa-trash-alt text-[10px]"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}
