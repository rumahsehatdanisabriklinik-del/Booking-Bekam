document.getElementById('year').textContent = new Date().getFullYear();

let currentRating = 0;
let currentBookingIdForReview = "";
let currentReviewRow = null;
let fetchAborter = null;
let currentCheckInPayload = "";
let currentCheckInRow = null;
let currentCheckInSummary = null;
let checkinStream = null;
let checkinScanLoopActive = false;
let checkinDetector = null;

function showCustomToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');

    const icon = type === 'success' ? '<i class="fas fa-check-circle text-emerald-500"></i>' : '<i class="fas fa-exclamation-circle text-red-500"></i>';
    const bgClass = type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900';

    toast.className = `flex items-center gap-3 px-5 py-4 rounded-2xl border-2 shadow-xl shadow-slate-200/50 transform translate-x-[120%] transition-transform duration-500 ease-out font-bold text-sm pointer-events-auto ${bgClass}`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-[120%]');
        toast.classList.add('translate-x-0');
    });

    setTimeout(() => {
        toast.classList.remove('translate-x-0');
        toast.classList.add('translate-x-[120%]');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

const phoneInput = document.getElementById('orderIdInput');
if (phoneInput) {
    phoneInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
    });
    phoneInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') checkStatus();
    });
}

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.remove('translate-x-full');
});

document.getElementById('closeMobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.add('translate-x-full');
});

async function syncHeaderFooter() {
    if (typeof window.GAS_URL === 'undefined') return;
    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const response = await fetch(`${window.GAS_URL}${connector}action=getLandingSettings`);
        const result = await response.json();
        if (result.status === "success") {
            const d = result.data;
            if (d.cms_nama_klinik) {
                document.getElementById('cms-nama-klinik-nav').textContent = d.cms_nama_klinik;
                document.getElementById('cms-nama-klinik-footer').textContent = d.cms_nama_klinik;
                document.title = d.cms_nama_klinik + " | Lacak Reservasi";
            }
            if (d.cms_alamat) document.getElementById('cms-alamat').textContent = d.cms_alamat;
            if (d.cms_footer_deskripsi) document.getElementById('cms-footer-deskripsi').textContent = d.cms_footer_deskripsi;
            if (d.cms_instagram) document.getElementById('cms-instagram').href = d.cms_instagram;
            if (d.cms_facebook) document.getElementById('cms-facebook').href = d.cms_facebook;

            if (d.cms_logo_image && d.cms_logo_image.trim() !== "") {
                let logoUrl = d.cms_logo_image;
                if (logoUrl.includes('drive.google.com/uc')) {
                    try {
                        const fileId = logoUrl.split('id=')[1].split('&')[0];
                        logoUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
                    } catch (e) {}
                }
                const navLogo = document.getElementById('cms-logo-nav-container');
                if (navLogo) navLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full object-contain rounded-xl shadow-sm">`;
                const footLogo = document.getElementById('cms-logo-footer-container');
                if (footLogo) footLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full object-contain rounded-xl shadow-sm">`;
            }
        }
    } catch (e) {
        console.error("CMS Sync failed", e);
    }
}
