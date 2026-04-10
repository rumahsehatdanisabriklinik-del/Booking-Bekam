document.getElementById('year').textContent = new Date().getFullYear();
let currentRating = 0;
let currentBookingIdForReview = "";
let currentReviewRow = null;
let fetchAborter = null; // Mencegah race condition pada API Call

// --- Fitur Baru: Custom Premium Toast Notification ---
function showCustomToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const icon = type === 'success' ? '<i class="fas fa-check-circle text-emerald-500"></i>' : '<i class="fas fa-exclamation-circle text-red-500"></i>';
    const bgClass = type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900';
    
    toast.className = `flex items-center gap-3 px-5 py-4 rounded-2xl border-2 shadow-xl shadow-slate-200/50 transform translate-x-[120%] transition-transform duration-500 ease-out font-bold text-sm pointer-events-auto ${bgClass}`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    
    container.appendChild(toast);
    
    // Masuk
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-[120%]');
        toast.classList.add('translate-x-0');
    });
    
    // Keluar & Hapus
    setTimeout(() => {
        toast.classList.remove('translate-x-0');
        toast.classList.add('translate-x-[120%]');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- Canggih: Validasi Input & Listener Enter Key ---
const phoneInput = document.getElementById('orderIdInput');
if(phoneInput) {
    phoneInput.addEventListener('input', function() {
        // Hapus semua karakter yang bukan angka secara instan
        this.value = this.value.replace(/\D/g, '');
    });
    phoneInput.addEventListener('keypress', function(e) {
        if(e.key === 'Enter') checkStatus();
    });
}

// Mobile menu toggle
document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.remove('translate-x-full');
});
document.getElementById('closeMobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.add('translate-x-full');
});

// Sync Header Footer
async function syncHeaderFooter() {
    if (typeof window.GAS_URL === 'undefined') return;
    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const response = await fetch(`${window.GAS_URL}${connector}action=getLandingSettings`);
        const result = await response.json();
        if (result.status === "success") {
            const d = result.data;
            if(d.cms_nama_klinik) {
                document.getElementById('cms-nama-klinik-nav').textContent = d.cms_nama_klinik;
                document.getElementById('cms-nama-klinik-footer').textContent = d.cms_nama_klinik;
                document.title = d.cms_nama_klinik + " | Lacak Reservasi";
            }
            if(d.cms_alamat) document.getElementById('cms-alamat').textContent = d.cms_alamat;
            if(d.cms_footer_deskripsi) document.getElementById('cms-footer-deskripsi').textContent = d.cms_footer_deskripsi;
            if(d.cms_instagram) document.getElementById('cms-instagram').href = d.cms_instagram;
            if(d.cms_facebook) document.getElementById('cms-facebook').href = d.cms_facebook;
            
            if(d.cms_logo_image && d.cms_logo_image.trim() !== "") {
                let logoUrl = d.cms_logo_image;
                if(logoUrl.includes('drive.google.com/uc')) {
                    try { const fileId = logoUrl.split('id=')[1].split('&')[0]; logoUrl = `https://lh3.googleusercontent.com/d/${fileId}`; } catch(e) {}
                }
                const navLogo = document.getElementById('cms-logo-nav-container');
                if(navLogo) navLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full object-contain rounded-xl shadow-sm">`;
                const footLogo = document.getElementById('cms-logo-footer-container');
                if(footLogo) footLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full object-contain rounded-xl shadow-sm">`;
            }
        }
    } catch (e) { console.error("CMS Sync failed", e); }
}

document.addEventListener('DOMContentLoaded', () => {
    syncHeaderFooter();
    const urlParams = new URLSearchParams(window.location.search);
    const inputVal = urlParams.get('id') || urlParams.get('phone'); 
    if(inputVal) {
        document.getElementById('orderIdInput').value = inputVal;
        checkStatus();
    }
});

// Fungsi Cek Status (Diperbarui dengan AbortController)
async function checkStatus() {
    let inputId = document.getElementById('orderIdInput').value.trim();
    if(!inputId) {
        showCustomToast("Silakan masukkan Nomor WhatsApp terlebih dahulu", "error");
        if(phoneInput) phoneInput.focus();
        return;
    }

    // Batalkan request yang sedang berjalan (jika user spam klik)
    if(fetchAborter) fetchAborter.abort();
    fetchAborter = new AbortController();

    // UI Changes
    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('errorMsg').classList.add('hidden');
    const resSection = document.getElementById('resultSection');
    resSection.innerHTML = ""; 
    resSection.classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    try {
        if (typeof window.GAS_URL === 'undefined') throw new Error("Server URL belum diatur.");

        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const response = await fetch(`${window.GAS_URL}${connector}action=cekStatusUser&hp=${inputId}`, {
            signal: fetchAborter.signal
        });
        const result = await response.json();

        if (result.status === "success" && result.data.length > 0) {
            // Render dengan staggered animation (penundaan bertahap)
            result.data.forEach((booking, index) => {
                renderSingleBooking(booking, index === result.data.length - 1, index);
            });
            document.getElementById('loader').classList.add('hidden');
            resSection.classList.remove('hidden');
        } else {
            showError("Data tidak ditemukan untuk nomor ini.");
        }
    } catch (error) {
        if(error.name === 'AbortError') return; // Abaikan error jika sengaja di-abort
        console.error(error);
        showError("Gagal terhubung ke server. Periksa koneksi Anda.");
    } finally {
        fetchAborter = null;
    }
}

// Fungsi Render Kartu (Diperbarui menjadi gaya "Ticket" Premium)
function renderSingleBooking(data, isLatest, delayIndex = 0) {
    const container = document.getElementById('resultSection');
    const card = document.createElement('div');
    
    // Tambahkan animasi delay bertingkat
    card.className = "mb-8 opacity-0 animate-slide-in-right";
    card.style.animationDelay = `${delayIndex * 150}ms`;
    
    // Format Badge & Icon
    const stat = data.status.toUpperCase();
    let badgeClass = "bg-slate-100 text-slate-600 border border-slate-200";
    let iconClass = "fas fa-clock animate-pulse";
    let iconBgClass = "bg-slate-50 text-slate-400";
    let glowClass = "";

    if(stat === 'DITERIMA' || stat === 'TERJADWAL') {
        badgeClass = "bg-blue-50 text-blue-600 border border-blue-200";
        iconClass = "fas fa-calendar-check";
        iconBgClass = "bg-blue-100 text-blue-500 shadow-lg shadow-blue-500/20";
        glowClass = "ring-4 ring-blue-50";
    } else if(stat === 'SELESAI') {
        badgeClass = "bg-emerald-50 text-emerald-600 border border-emerald-200";
        iconClass = "fas fa-check-double";
        iconBgClass = "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40";
        glowClass = "ring-4 ring-emerald-50";
    } else if(stat === 'BATAL' || stat === 'DIBATALKAN') {
        badgeClass = "bg-red-50 text-red-600 border border-red-200";
        iconClass = "fas fa-times-circle";
        iconBgClass = "bg-red-100 text-red-500 shadow-lg shadow-red-500/20";
        glowClass = "ring-4 ring-red-50";
    }

    const dateObj = new Date(data.tanggal);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const tglStr = dateObj.toLocaleDateString('id-ID', options);

    card.innerHTML = `
        <div class="ticket-card p-6 sm:p-8 hover:-translate-y-1 transition-transform duration-300">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl ${iconBgClass} ${glowClass} transition-all">
                        <i class="${iconClass}"></i>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-900 text-base leading-tight">Status Reservasi</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: #${data.row || 'SYS'}</p>
                    </div>
                </div>
                <div class="inline-flex items-center justify-center px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider ${badgeClass}">
                    ${stat}
                </div>
            </div>

            <div class="ticket-divider"></div>

            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><i class="fas fa-user-md text-slate-300"></i> Terapis</span>
                    <span class="font-bold text-slate-900 text-sm bg-slate-50 px-3 py-1 rounded-lg">${data.terapis}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><i class="fas fa-briefcase-medical text-slate-300"></i> Layanan</span>
                    <span class="font-bold text-emerald-600 text-sm bg-emerald-50 px-3 py-1 rounded-lg">${data.layanan}</span>
                </div>
                <div class="flex justify-between items-center pt-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><i class="fas fa-calendar-alt text-slate-300"></i> Jadwal</span>
                    <div class="text-right">
                        <div class="font-bold text-slate-900 text-sm">${tglStr}</div>
                        <div class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-0.5"><i class="far fa-clock"></i> ${data.waktu} WIB</div>
                    </div>
                </div>
            </div>

            ${stat === 'SELESAI' ? `
                <div class="mt-6 pt-4 border-t border-slate-100">
                    <button onclick="openReview(${data.row}, '${data.terapis}')" class="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-sm shadow-lg shadow-slate-900/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group">
                        <i class="fas fa-star text-amber-400 group-hover:rotate-[72deg] transition-transform duration-500"></i> Beri Ulasan Layanan
                    </button>
                </div>
            ` : (stat === 'MENUNGGU' || stat === 'TERJADWAL' || stat === 'DITERIMA' ? `
                <div class="mt-6 pt-4 border-t border-slate-100">
                    <button onclick="batalBooking(${data.row})" class="w-full py-3.5 rounded-xl bg-white border-2 border-red-100 text-red-500 font-extrabold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-times-circle"></i> Batalkan Reservasi
                    </button>
                </div>
            ` : '')}
        </div>
    `;

    container.appendChild(card);
    
    // Tambahkan tombol reset/kembali di akhir
    if (isLatest) {
        const btnReset = document.createElement('button');
        btnReset.onclick = resetSearch;
        btnReset.className = "mt-8 w-full py-4 rounded-xl bg-white border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors flex justify-center items-center gap-2 group animate-fade-up";
        btnReset.style.animationDelay = `${(delayIndex + 1) * 150}ms`;
        btnReset.innerHTML = '<i class="fas fa-redo text-xs group-hover:-rotate-180 transition-transform duration-500"></i> Lacak Nomor Lainnya';
        container.appendChild(btnReset);
    }
}

function showError(msg) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    const errEl = document.getElementById('errorMsg');
    errEl.querySelector('span').textContent = msg;
    errEl.classList.remove('hidden');
}

function resetSearch() {
    document.getElementById('resultSection').classList.add('hidden');
    document.getElementById('orderIdInput').value = '';
    document.getElementById('searchSection').classList.remove('hidden');
    
    const url = new URL(window.location);
    url.searchParams.delete('id');
    url.searchParams.delete('phone');
    window.history.pushState({}, '', url);
    
    // Beri efek fokus kembali ke input
    setTimeout(() => document.getElementById('orderIdInput').focus(), 100);
}

// --- Logic Batal ---
async function batalBooking(row) {
    if (!confirm("Apakah Anda yakin ingin membatalkan jadwal terapi ini?\nTindakan ini tidak dapat diurungkan.")) return;

    const hp = document.getElementById('orderIdInput').value.trim();
    const loader = document.getElementById('loader');
    
    document.getElementById('resultSection').classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const body = { action: "batalByUser", row: row, hp: hp };

        const response = await fetch(`${window.GAS_URL}${connector}action=batalByUser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();

        if (result.status === "success") {
            showCustomToast("Jadwal Anda telah berhasil dibatalkan.", "success");
            checkStatus(); // Refresh tampilan
        } else {
            showCustomToast("Gagal membatalkan: " + result.message, "error");
            document.getElementById('resultSection').classList.remove('hidden');
            loader.classList.add('hidden');
        }
    } catch (error) {
        showCustomToast("Terjadi kesalahan sistem saat membatalkan.", "error");
        document.getElementById('resultSection').classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

// --- Logic Modal Review ---
function openReview(row, terapis) {
    currentReviewRow = row;
    const modal = document.getElementById('reviewModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
    
    currentRating = 0;
    updateStarsUI();
    document.getElementById('reviewText').value = '';
}

function closeReview() {
    const modal = document.getElementById('reviewModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function setRating(val) {
    currentRating = val;
    updateStarsUI();
}

function updateStarsUI() {
    const stars = document.getElementById('starContainer').children;
    for(let i=0; i<stars.length; i++) {
        if(i < currentRating) {
            stars[i].classList.remove('text-slate-200');
            stars[i].classList.add('text-amber-400');
        } else {
            stars[i].classList.remove('text-amber-400');
            stars[i].classList.add('text-slate-200');
        }
    }
}

async function sendReview() {
    if(currentRating === 0) {
        showCustomToast("Silakan pilih rating bintang terlebih dahulu.", "error");
        return;
    }

    const btn = document.getElementById('btnSubmitReview');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> <span class="relative z-10">Mengirim...</span>';
    btn.disabled = true;
    btn.classList.add('opacity-80', 'cursor-not-allowed');

    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const body = {
            action: "submitReview",
            row: currentReviewRow,
            rating: currentRating,
            ulasan: document.getElementById('reviewText').value,
            hp: document.getElementById('orderIdInput').value.trim()
        };

        const response = await fetch(`${window.GAS_URL}${connector}action=submitReview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();

        if (result.status === "success") {
            showCustomToast("Alhamdulillah! Terima kasih atas ulasan Anda.", "success");
            closeReview();
            checkStatus(); // Refresh data
        } else {
            showCustomToast("Gagal mengirim ulasan: " + result.message, "error");
        }
    } catch (error) {
        showCustomToast("Gagal terhubung ke server saat mengirim ulasan.", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.classList.remove('opacity-80', 'cursor-not-allowed');
    }
}
