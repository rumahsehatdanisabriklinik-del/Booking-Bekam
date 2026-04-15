document.getElementById('year').textContent = new Date().getFullYear();
let currentRating = 0;
let currentBookingIdForReview = "";
let currentReviewRow = null;
let fetchAborter = null; // Mencegah race condition pada API Call
let currentCheckInPayload = "";
let currentCheckInRow = null;
let currentCheckInSummary = null;
let checkinStream = null;
let checkinScanLoopActive = false;
let checkinDetector = null;

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

function updateCheckinStatus(message, isError = false) {
    const el = document.getElementById('checkinScanStatus');
    if (!el) return;
    el.textContent = message;
    el.className = `text-sm font-bold text-center ${isError ? 'text-red-500' : 'text-slate-500'}`;
}

function stopCheckinScanner() {
    checkinScanLoopActive = false;
    if (checkinStream) {
        checkinStream.getTracks().forEach(track => track.stop());
        checkinStream = null;
    }
    const video = document.getElementById('checkinVideo');
    if (video) {
        video.pause();
        video.srcObject = null;
    }
}

function closeCheckinModal() {
    stopCheckinScanner();
    const modal = document.getElementById('checkinModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function openCheckinModal(row, payload, summaryText) {
    currentCheckInRow = row;
    currentCheckInPayload = payload || "";
    currentCheckInSummary = summaryText || "";
    document.getElementById('manualClinicCode').value = '';

    const modal = document.getElementById('checkinModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);

    if (!currentCheckInPayload) {
        updateCheckinStatus('Booking ini belum memiliki token check-in. Hubungi admin.', true);
        return;
    }

    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
        updateCheckinStatus('Browser ini belum mendukung scan kamera. Gunakan kolom kode manual di bawah.', true);
        return;
    }

    try {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (!formats.includes('qr_code')) {
            updateCheckinStatus('Browser tidak mendukung pembacaan QR. Gunakan kode manual.', true);
            return;
        }

        checkinDetector = new BarcodeDetector({ formats: ['qr_code'] });
        checkinStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });

        const video = document.getElementById('checkinVideo');
        video.srcObject = checkinStream;
        await video.play();

        checkinScanLoopActive = true;
        updateCheckinStatus('Arahkan kamera ke QR check-in di meja admin.');
        requestAnimationFrame(scanClinicQrFrame);
    } catch (error) {
        console.error('Scanner start failed', error);
        updateCheckinStatus('Kamera tidak bisa dibuka. Gunakan kode manual jika diperlukan.', true);
    }
}

function openCheckinModalSafe(row, encodedPayload, encodedSummary) {
    let payload = '';
    let summary = '';
    try { payload = decodeURIComponent(escape(atob(encodedPayload))); } catch (e) {}
    try { summary = decodeURIComponent(escape(atob(encodedSummary))); } catch (e) {}
    openCheckinModal(row, payload, summary);
}

async function scanClinicQrFrame() {
    if (!checkinScanLoopActive || !checkinDetector) return;

    const video = document.getElementById('checkinVideo');
    if (!video || video.readyState < 2) {
        requestAnimationFrame(scanClinicQrFrame);
        return;
    }

    try {
        const barcodes = await checkinDetector.detect(video);
        if (barcodes && barcodes.length > 0) {
            const rawValue = (barcodes[0].rawValue || '').trim();
            if (rawValue) {
                await processPatientCheckin(rawValue);
                return;
            }
        }
    } catch (error) {
        console.error('Barcode detect failed', error);
    }

    if (checkinScanLoopActive) {
        requestAnimationFrame(scanClinicQrFrame);
    }
}

async function submitManualCheckin() {
    const manualCode = document.getElementById('manualClinicCode').value.trim();
    if (!manualCode) {
        updateCheckinStatus('Masukkan atau tempel kode QR klinik terlebih dahulu.', true);
        return;
    }
    await processPatientCheckin(manualCode);
}

async function processPatientCheckin(clinicCode) {
    if (!currentCheckInPayload) {
        updateCheckinStatus('Token booking tidak ditemukan.', true);
        return;
    }

    checkinScanLoopActive = false;
    updateCheckinStatus('Memproses check-in ke server...');

    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const response = await fetch(`${window.GAS_URL}${connector}action=selfCheckIn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'selfCheckIn',
                payload: currentCheckInPayload,
                clinicCode: clinicCode
            })
        });
        const result = await response.json();

        if (result.status === 'success') {
            stopCheckinScanner();
            showCustomToast(`Check-in berhasil untuk ${result.data?.nama || currentCheckInSummary}.`, 'success');
            closeCheckinModal();
            checkStatus();
        } else {
            updateCheckinStatus(result.message || 'Check-in gagal diproses.', true);
            if (checkinStream) {
                checkinScanLoopActive = true;
                requestAnimationFrame(scanClinicQrFrame);
            }
        }
    } catch (error) {
        console.error('Check-in submit failed', error);
        updateCheckinStatus('Gagal terhubung ke server check-in.', true);
        if (checkinStream) {
            checkinScanLoopActive = true;
            requestAnimationFrame(scanClinicQrFrame);
        }
    }
}

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
    } else if(stat === 'HADIR') {
        badgeClass = "bg-teal-50 text-teal-600 border border-teal-200";
        iconClass = "fas fa-user-check";
        iconBgClass = "bg-teal-500 text-white shadow-lg shadow-teal-500/30";
        glowClass = "ring-4 ring-teal-50";
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
    const checkInPayload = data.checkIn?.payload || '';
    const encodedPayload = checkInPayload ? btoa(unescape(encodeURIComponent(checkInPayload))) : '';
    const summaryText = `${data.terapis} - ${data.tanggal} ${data.waktu}`;
    const encodedSummary = btoa(unescape(encodeURIComponent(summaryText)));
    const canCheckIn = ['MENUNGGU', 'TERJADWAL', 'DITERIMA'].includes(stat) && !!checkInPayload;
    const checkInInfo = data.checkIn ? `<div class="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">Jendela Check-In</div>
                    <div class="text-xs font-bold text-slate-700">Aktif mulai ${data.checkIn.validFrom}</div>
                    <div class="text-xs font-bold text-slate-500 mt-1">Berakhir ${data.checkIn.expiresAt}</div>
                </div>` : '';

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
            ${checkInInfo}

            ${stat === 'SELESAI' ? `
                <div class="mt-6 pt-4 border-t border-slate-100">
                    <button onclick="openReview(${data.row}, '${data.terapis}')" class="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-sm shadow-lg shadow-slate-900/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group">
                        <i class="fas fa-star text-amber-400 group-hover:rotate-[72deg] transition-transform duration-500"></i> Beri Ulasan Layanan
                    </button>
                </div>
            ` : (stat === 'MENUNGGU' || stat === 'TERJADWAL' || stat === 'DITERIMA' ? `
                <div class="mt-6 pt-4 border-t border-slate-100">
                    ${canCheckIn ? `
                    <button onclick="openCheckinModalSafe(${data.row}, '${encodedPayload}', '${encodedSummary}')" class="w-full mb-3 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-qrcode"></i> Scan QR Check-In Klinik
                    </button>` : ''}
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
