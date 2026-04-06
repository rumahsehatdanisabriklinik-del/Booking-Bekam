let allData = [];
let filteredData = [];
let currentFilter = 'semua';
let currentTab = 'booking';
let searchQuery = "";

document.addEventListener('DOMContentLoaded', () => {
    const savedPin = localStorage.getItem('adminPin');
    if (savedPin) {
        verifyPin(savedPin);
    }
});

async function doLogin() {
    const pin = document.getElementById('adminPin').value;
    const btn = document.getElementById('btnLogin');
    const alert = document.getElementById('loginAlert');
    alert.classList.add('hidden');
    
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengecek...`;
    btn.disabled = true;

    await verifyPin(pin);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function verifyPin(pin) {
    try {
        const res = await fetch(`${GAS_URL}?action=authAdmin&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            localStorage.setItem('adminPin', pin);
            localStorage.setItem('adminRole', result.role || 'admin');
            localStorage.setItem('adminNama', result.nama || 'Admin');
            
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboardScreen').style.display = '';
            
            // Atur Sidebar untuk Terapis
            if (result.role === 'terapis') {
                document.querySelectorAll('[onclick="switchTab(\'laporan\')"]').forEach(el => el.style.display = 'none');
                document.querySelectorAll('[onclick="switchTab(\'pengaturan\')"]').forEach(el => el.style.display = 'none');
            }
            // Update nama profil
            const profilNameEls = document.querySelectorAll('.profil-nama');
            profilNameEls.forEach(el => el.textContent = result.nama || 'Super Admin');

            switchTab('booking');
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        const al = document.getElementById('loginAlert');
        al.textContent = err.message || "Gagal menghubungi server";
        al.classList.remove('hidden');
        localStorage.removeItem('adminPin');
        localStorage.removeItem('adminRole');
        localStorage.removeItem('adminNama');
    }
}

function logout() {
    if(!confirm("Anda akan keluar dari sistem manajemen?")) return;
    localStorage.removeItem('adminPin');
    location.reload();
}

function switchTab(tab) {
    currentTab = tab;
    const pin = localStorage.getItem('adminPin');
    const title = document.getElementById('pageTitle');
    const sub   = document.getElementById('pageSubtitle');

    // UI Tab Update
    document.querySelectorAll('.nav-item, .bn-item').forEach(el => {
        const target = el.getAttribute('onclick');
        if (target && target.includes(tab)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    
    document.getElementById('tabContentBooking').style.display    = tab === 'booking'    ? 'block' : 'none';
    document.getElementById('tabContentLaporan').style.display    = tab === 'laporan'    ? 'block' : 'none';
    document.getElementById('tabContentPengaturan').style.display = tab === 'pengaturan' ? 'block' : 'none';

    if (tab === 'booking') {
        title.textContent = "Manajemen Reservasi";
        sub.textContent   = "Pantau dan kelola jadwal pasien hari ini.";
        loadDashboardData(pin);
    } else if (tab === 'laporan') {
        title.textContent = "Laporan & Analitik";
        sub.textContent   = "Data statistik performa klinik Bapak.";
        loadLaporanData(pin);
    } else {
        title.textContent = "Konten Landing Page";
        sub.textContent   = "Atur teks dan informasi yang tampil di halaman utama website.";
        loadCmsSettings();
    }
}

async function loadDashboardData(pin) {
    const loader = document.getElementById('loadingDash');
    const container = document.getElementById('listPasien');
    
    loader.classList.remove('hidden');
    container.innerHTML = '';

    try {
        const res = await fetch(`${GAS_URL}?action=getSemuaBooking&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            allData = result.data;
            renderData();
        } else {
            container.innerHTML = `<div class="col-span-full w-full bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl flex items-center gap-3 font-bold"><i class="fas fa-exclamation-triangle flex-shrink-0"></i> <span>ERROR: ${result.message}</span></div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="col-span-full w-full bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl flex items-center gap-3 font-bold"><i class="fas fa-exclamation-triangle flex-shrink-0"></i> <span>Gagal memuat data: ${err.message}</span></div>`;
    } finally {
        loader.classList.add('hidden');
    }
}

async function loadLaporanData(pin) {
    const loader = document.getElementById('loadingLaporan');
    const container = document.getElementById('isiLaporan');
    
    loader.classList.remove('hidden');
    container.innerHTML = '';

    try {
        const res = await fetch(`${GAS_URL}?action=getLaporan&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            renderLaporan(result.data);
        } else {
            container.innerHTML = `<div class="w-full bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl font-bold">Gagal: ${result.message}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="w-full bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl font-bold">Error: ${err.message}</div>`;
    } finally {
        loader.classList.add('hidden');
    }
}

function applyFilter(filterMode) {
    currentFilter = filterMode;
    document.querySelectorAll('.pill').forEach(btn => {
        const clickAttr = btn.getAttribute('onclick');
        btn.classList.toggle('active', clickAttr && clickAttr.includes(filterMode));
    });
    renderData();
}

function handleSearch(val) {
    searchQuery = val.toLowerCase().trim();
    renderData();
}

function renderData() {
    const container = document.getElementById('listPasien');
    container.innerHTML = '';

    if (!allData || allData.length === 0) {
        container.innerHTML = `<div class="col-span-full w-full text-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold">Tidak ada data reservasi sama sekali.</div>`;
        return;
    }

    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    
    // Terapis Filtering
    const roleAdmin = localStorage.getItem('adminRole') || 'admin';
    const namaAdmin = localStorage.getItem('adminNama') || 'Admin';

    let displayData = allData.filter(item => {
        // Filter Role: Jika Terapis, hanya lihat datanya sendiri
        if (roleAdmin === 'terapis' && (item.terapis || "") !== namaAdmin) {
            return false;
        }

        // Filter Mode
        let isMatchMode = true;
        if (currentFilter === 'terjadwal') isMatchMode = (item.status || "Terjadwal").toLowerCase() === 'terjadwal';
        else if (currentFilter === 'hariini') isMatchMode = item.tanggal === todayStr;

        // Search Query
        let isMatchSearch = true;
        if (searchQuery) {
            isMatchSearch = (item.nama || "").toLowerCase().includes(searchQuery) || 
                            (item.hp || "").toLowerCase().includes(searchQuery);
        }

        return isMatchMode && isMatchSearch;
    });

    if (displayData.length === 0) {
        container.innerHTML = `<div class="col-span-full w-full text-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold">Tidak ada data yang cocok dengan kriteria.</div>`;
        return;
    }

    displayData.forEach(p => {
        const st = (p.status || "Terjadwal").toLowerCase();
        let badgeClass = "bg-blue-50 text-blue-600 border-blue-200 ring-1 ring-blue-100";
        let actionBtn = "";

        // EMR Button
        const emrBtn = `<button class="w-full mt-3 py-2 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-600 hover:text-emerald-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2" onclick="openEMR('${p.row}', '${p.nama}', \`${p.tensi||''}\`, \`${p.keluhan||''}\`, \`${p.tindakan||''}\`)"><i class="fas fa-file-medical"></i> Catatan Rekam Medis</button>`;

        if (st === "batal" || st === "cancel" || st === "dibatalkan") {
            badgeClass = "bg-red-50 text-red-600 border-red-200 ring-1 ring-red-100";
            actionBtn = `<div class="bg-red-50/50 rounded-xl p-3 text-red-500 font-extrabold text-xs text-center border border-red-100"><i class="fas fa-times-circle"></i> Reservasi Dibatalkan</div>`;
        } else if (st === "selesai") {
            badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-200 ring-1 ring-emerald-100";
            actionBtn = `<div class="bg-emerald-50 rounded-xl p-3 text-emerald-600 font-extrabold text-xs text-center border border-emerald-100"><i class="fas fa-check-double text-emerald-500"></i> Layanan Selesai</div>${emrBtn}`;
        } else {
            badgeClass = "bg-blue-50 text-blue-600 border-blue-200 ring-1 ring-blue-100";
            actionBtn = `
                <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button class="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors shadow-sm shadow-emerald-500/20" onclick="updateStatus('${p.row}', 'Selesai')"><i class="fas fa-check mr-1"></i> Selesai</button>
                    <button class="flex-1 py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-500 hover:text-red-600 font-bold rounded-xl text-xs transition-colors" onclick="updateStatus('${p.row}', 'Batal')"><i class="fas fa-times mr-1"></i> Batal</button>
                </div>
                ${emrBtn}
            `;
        }

        container.innerHTML += `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow p-5 flex flex-col gap-4 relative overflow-hidden">
                <div class="flex justify-between items-start pb-4 border-b border-dashed border-slate-100 relative z-10">
                    <div>
                        <h3 class="text-base font-extrabold text-slate-800 uppercase tracking-wide">${p.nama}</h3>
                        <div class="flex items-center gap-1.5 text-slate-500 text-xs font-bold mt-1.5"><i class="fab fa-whatsapp text-emerald-500"></i> ${p.hp}</div>
                    </div>
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${badgeClass}">${st}</span>
                </div>
                <div class="grid grid-cols-2 gap-y-4 gap-x-2 text-xs relative z-10">
                    <div class="col-span-2 sm:col-span-1 border border-slate-100 p-3 rounded-xl bg-slate-50">
                        <span class="block text-slate-400 font-bold uppercase text-[9px] mb-1">Tanggal & Waktu</span>
                        <strong class="text-slate-700 flex items-center gap-1.5"><i class="far fa-clock text-slate-400"></i> ${p.waktu} &bull; ${p.tanggal}</strong>
                    </div>
                    <div class="col-span-2 sm:col-span-1 border border-slate-100 p-3 rounded-xl bg-slate-50">
                        <span class="block text-slate-400 font-bold uppercase text-[9px] mb-1">Terapis</span>
                        <strong class="text-slate-700 flex items-center gap-1.5"><i class="far fa-user text-slate-400"></i> ${p.terapis}</strong>
                    </div>
                    <div class="col-span-2 border border-emerald-100 p-3 rounded-xl bg-emerald-50/50">
                        <span class="block text-emerald-600/60 font-bold uppercase text-[9px] mb-1">Layanan</span>
                        <strong class="text-emerald-800 flex items-center gap-1.5"><i class="fas fa-notes-medical text-emerald-500"></i> ${p.layanan}</strong>
                    </div>
                </div>
                ${actionBtn}
            </div>
        `;
    });
}

function renderLaporan(data) {
    const container = document.getElementById('isiLaporan');
    const ringkasan = data.ringkasan;
    
    // Bar Chart Sederhana menggunakan CSS-Grid & Persentase
    const maxTotal = Math.max(...data.perLayanan.map(l => l.jumlah), 1);

    let html = `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div class="bg-white p-5 rounded-3xl border border-emerald-50 shadow-sm flex flex-col hover:-translate-y-1 transition-transform">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-inner shadow-emerald-600/10"><i class="fas fa-check-double"></i></div>
                    <span class="text-3xl font-black text-slate-800 tracking-tight">${ringkasan.selesai}</span>
                </div>
                <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mt-auto">Selesai</div>
            </div>
            <div class="bg-white p-5 rounded-3xl border border-blue-50 shadow-sm flex flex-col hover:-translate-y-1 transition-transform">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-inner shadow-blue-600/10"><i class="fas fa-clock"></i></div>
                    <span class="text-3xl font-black text-slate-800 tracking-tight">${ringkasan.terjadwal}</span>
                </div>
                <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mt-auto">Terjadwal</div>
            </div>
            <div class="bg-white p-5 rounded-3xl border border-red-50 shadow-sm flex flex-col hover:-translate-y-1 transition-transform">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-xl shadow-inner shadow-red-600/10"><i class="fas fa-user-times"></i></div>
                    <span class="text-3xl font-black text-slate-800 tracking-tight">${ringkasan.batal}</span>
                </div>
                <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mt-auto">Dibatalkan</div>
            </div>
            <div class="bg-white p-5 rounded-3xl border border-purple-50 shadow-sm flex flex-col hover:-translate-y-1 transition-transform">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl shadow-inner shadow-purple-600/10"><i class="fas fa-users-viewfinder"></i></div>
                    <span class="text-3xl font-black text-slate-800 tracking-tight">${ringkasan.pasienUnik}</span>
                </div>
                <div class="text-slate-400 text-xs font-bold uppercase tracking-widest mt-auto">Total Pasien</div>
            </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <!-- Col 1 -->
            <div class="space-y-6">
                <!-- Top Layanan -->
                <div class="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
                    <h4 class="text-slate-800 font-extrabold text-lg mb-6 flex items-center gap-3"><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 flex items-center justify-center text-sm shadow-inner"><i class="fas fa-chart-line"></i></span> Layanan Terpopuler</h4>
                    <div class="flex flex-col gap-5">
                        ${data.perLayanan.map(l => {
                            const pct = (l.jumlah / maxTotal) * 100;
                            return `
                                <div class="flex flex-col gap-2 group">
                                    <div class="flex justify-between text-sm font-bold text-slate-700">
                                        <span>${l.nama}</span>
                                        <span class="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md text-xs group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">${l.jumlah} sesi</span>
                                    </div>
                                    <div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div class="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000 origin-left" style="width:${pct}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Kontribusi Terapis -->
                <div class="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm overflow-hidden">
                    <h4 class="text-slate-800 font-extrabold text-lg mb-6 flex items-center gap-3"><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-inner"><i class="fas fa-user-md"></i></span> Efisiensi Terapis</h4>
                    <div class="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
                        <table class="w-full min-w-[400px] text-left border-collapse">
                            <thead><tr class="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100"><th class="pb-3 font-bold pr-2">Terapis</th><th class="pb-3 font-bold text-center px-2">Selesai/Total</th><th class="pb-3 font-bold px-2 w-[120px]">Efisiensi</th></tr></thead>
                            <tbody class="divide-y divide-slate-50">
                                ${data.perTerapis.map(t => {
                                    const efisiensi = Math.round((t.selesai / (t.total || 1)) * 100);
                                    return `
                                        <tr class="hover:bg-slate-50/50 transition-colors group">
                                            <td class="py-4 font-bold text-slate-700 text-sm flex items-center gap-2.5 pr-2"><div class="w-7 h-7 rounded-full bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors flex items-center justify-center text-xs"><i class="fas fa-user"></i></div> ${t.nama}</td>
                                            <td class="py-4 font-bold text-slate-500 text-sm text-center px-2">${t.selesai} <span class="text-slate-300 font-normal px-0.5">/</span> ${t.total}</td>
                                            <td class="py-4 pl-2">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-extrabold text-xs ${efisiensi > 70 ? 'text-emerald-600' : 'text-amber-500'} w-9">${efisiensi}%</span>
                                                    <div class="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden"><div class="h-full ${efisiensi > 70 ? 'bg-emerald-500' : 'bg-amber-400'} rounded-full" style="width: ${efisiensi}%"></div></div>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Col 2: Top Pasien -->
            <div class="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm h-fit">
                <h4 class="text-slate-800 font-extrabold text-lg mb-6 flex items-center gap-3"><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-50 text-yellow-600 flex items-center justify-center text-sm shadow-inner"><i class="fas fa-crown"></i></span> Loyalitas Pasien (Top 10)</h4>
                <div class="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 hide-scrollbar">
                    <table class="w-full min-w-[500px] text-left border-collapse">
                        <thead><tr class="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100"><th class="pb-3 font-bold pr-4">Nama Pasien</th><th class="pb-3 font-bold px-2">Kontak</th><th class="pb-3 font-bold px-2 text-center">Visit</th><th class="pb-3 font-bold pl-2 text-right">Terakhir</th></tr></thead>
                        <tbody class="divide-y divide-slate-50">
                            ${data.pasienList.slice(0, 10).map((p, idx) => `
                                <tr class="hover:bg-slate-50/50 transition-colors">
                                    <td class="py-3.5 pr-4">
                                        <div class="flex items-center gap-3">
                                            <span class="text-xs font-black ${idx < 3 ? 'text-amber-500 bg-amber-50' : 'text-slate-400 bg-slate-100'} w-6 h-6 rounded flex items-center justify-center shrink-0">${idx + 1}</span>
                                            <span class="font-extrabold text-slate-700 text-sm truncate max-w-[140px]" title="${p.nama}">${p.nama}</span>
                                        </div>
                                    </td>
                                    <td class="py-3.5 px-2 text-emerald-600 font-bold text-xs"><i class="fab fa-whatsapp opacity-70 mr-1"></i> ${p.hp}</td>
                                    <td class="py-3.5 px-2 text-center"><span class="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-black uppercase shadow-sm">${p.kunjungan}x</span></td>
                                    <td class="py-3.5 pl-2 font-bold text-slate-400 text-[11px] text-right whitespace-nowrap">${p.terakhir}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

async function updateStatus(row, newStatus) {
    if(!confirm(`Apakah Bapak yakin menandai layanan ini sebagai ${newStatus.toUpperCase()}?`)) return;

    const pin = localStorage.getItem('adminPin');
    const loader = document.getElementById('loadingDash');
    loader.classList.remove('hidden');

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'adminUpdateStatus', pass: pin, row: row, status: newStatus })
        });
        const result = await res.json();
        if (result.status === 'success') {
            loadDashboardData(pin);
        } else {
            alert("Gagal memperbarui status: " + result.message);
        }
    } catch(err) {
        alert("Gagal menghubungi server pusat.");
    } finally {
        loader.classList.add('hidden');
    }
}

// ── CMS: LOAD SETTINGS ──
async function loadCmsSettings() {
    const loader = document.getElementById('cmsLoader');
    const form   = document.getElementById('cmsForm');
    loader.style.display = 'flex';
    form.classList.add('hidden');

    try {
        const res = await fetch(`${GAS_URL}?action=getLandingSettings`);
        const result = await res.json();
        if (result.status === 'success') {
            const d = result.data;
            // Isi setiap field form dengan data dari server
            Object.keys(d).forEach(key => {
                const el = document.getElementById(key);
                if (el) el.value = d[key];
            });
            loader.style.display = 'none';
            form.classList.remove('hidden');
        } else {
            loader.innerHTML = `<i class="fas fa-exclamation-triangle text-red-500 mr-2"></i><span class="text-red-600 font-bold">${result.message}</span>`;
        }
    } catch(err) {
        loader.innerHTML = `<i class="fas fa-exclamation-triangle text-red-500 mr-2"></i><span class="text-red-600 font-bold">Gagal memuat: ${err.message}</span>`;
    }
}

// ── CMS: SAVE SETTINGS ──
async function saveCmsSettings() {
    const pin    = localStorage.getItem('adminPin');
    const btn    = document.getElementById('btnSaveCms');
    const alert  = document.getElementById('cmsAlert');

    // Kumpulkan semua nilai dari form
    const keys = [
        'cms_nama_klinik','cms_tagline','cms_deskripsi','cms_badge','cms_hero_image',
        'cms_whatsapp','cms_alamat','cms_jam_operasional','cms_maps_link',
        'cms_instagram','cms_facebook',
        'cms_layanan1_nama','cms_layanan1_icon','cms_layanan1_deskripsi','cms_layanan1_detail',
        'cms_layanan2_nama','cms_layanan2_icon','cms_layanan2_deskripsi','cms_layanan2_detail',
        'cms_layanan3_nama','cms_layanan3_icon','cms_layanan3_deskripsi','cms_layanan3_detail',
    ];
    const settings = {};
    keys.forEach(k => {
        const el = document.getElementById(k);
        if (el) settings[k] = el.value;
    });

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Menyimpan...';
    alert.classList.add('hidden');

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateLandingSettings', pass: pin, settings })
        });
        const result = await res.json();
        if (result.status === 'success') {
            alert.className = 'flex-1 p-3 rounded-xl text-sm font-bold text-center border bg-emerald-50 text-emerald-700 border-emerald-200';
            alert.innerHTML = '<i class="fas fa-check-circle mr-2"></i>' + result.message;
        } else {
            alert.className = 'flex-1 p-3 rounded-xl text-sm font-bold text-center border bg-red-50 text-red-600 border-red-200';
            alert.innerHTML = '<i class="fas fa-times-circle mr-2"></i> Gagal: ' + result.message;
        }
        alert.classList.remove('hidden');
    } catch(err) {
        alert.className = 'flex-1 p-3 rounded-xl text-sm font-bold text-center border bg-red-50 text-red-600 border-red-200';
        alert.innerHTML = '<i class="fas fa-times-circle mr-2"></i> Error: ' + err.message;
        alert.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> Simpan Perubahan';
        setTimeout(() => alert.classList.add('hidden'), 5000);
    }
}

// ── EMR (Catatan Medis) ──
let currentEmrRow = null;

function openEMR(row, nama, tensi, keluhan, tindakan) {
    currentEmrRow = row;
    document.getElementById('emrNamaPasien').textContent = nama;
    document.getElementById('emrTensi').value = tensi !== "undefined" ? tensi : "";
    document.getElementById('emrKeluhan').value = keluhan !== "undefined" ? keluhan : "";
    document.getElementById('emrTindakan').value = tindakan !== "undefined" ? tindakan : "";
    document.getElementById('emrModal').style.display = 'flex';
}

function closeEMR() {
    currentEmrRow = null;
    document.getElementById('emrModal').style.display = 'none';
}

async function saveEMR() {
    if (!currentEmrRow) return;
    const pin = localStorage.getItem('adminPin');
    const tensi = document.getElementById('emrTensi').value;
    const keluhan = document.getElementById('emrKeluhan').value;
    const tindakan = document.getElementById('emrTindakan').value;

    const btn = document.getElementById('btnSaveEMR');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'adminUpdateRekamMedis',
                pass: pin,
                row: currentEmrRow,
                tensi, keluhan, tindakan
            })
        });
        const result = await res.json();
        if (result.status === 'success') {
            closeEMR();
            loadDashboardData(pin); // Refresh data
        } else {
            alert('Gagal simpan EMR: ' + result.message);
        }
    } catch(e) {
        alert('Internal Error: ' + e.message);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Simpan Rekam Medis';
        }
    }
}
