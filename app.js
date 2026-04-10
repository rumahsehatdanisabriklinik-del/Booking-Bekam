/* ================================================
   RUMAH SEHAT DANI SABRI — Logika Booking (Advanced)
   app.js
   ================================================ */

// ── KONFIGURASI ─────────────────────────────────────────────────────────────
// (Berpindah ke config.js)

// ── ELEMENT REFERENCES ──────────────────────────────────────────────────────
const gridTerapis     = document.getElementById('gridTerapis');
const gridWaktu       = document.getElementById('gridWaktu');
const gridSesi        = document.getElementById('gridSesi');
const gridTanggal     = document.getElementById('gridTanggal');

const terapisInput    = document.getElementById('terapis');
const waktuInput      = document.getElementById('waktu');
const sesiBekamInput  = document.getElementById('sesiBekam');
const tanggalSelect   = document.getElementById('tanggal'); // hidden input

const btnSubmit       = document.getElementById('btnSubmit');
const btnSpinner      = document.getElementById('btnSpinner');
const btnText         = document.querySelector('.btn-text');
const globalLoader    = document.getElementById('global-loader');
const alertBox        = document.getElementById('alertBox');

let allTerapisData = [];
let allLayananData = [];
let hariLiburList  = []; // Daftar angka hari libur dari Spreadsheet

const NAMA_HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const NAMA_HARI_PENDEK  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const NAMA_BULAN_PENDEK = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    
    // Listener untuk update progress bar secara real-time
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', updateProgressBar);
        input.addEventListener('input', updateProgressBar);
    });
});

// ── HELPER PILL SELECTION ───────────────────────────────────────────────────
/**
 * @param {HTMLElement} clickedBtn 
 * @param {HTMLElement} grid 
 * @param {HTMLElement} hiddenInput 
 * @param {string} value 
 * @param {boolean} triggerAvailability 
 */
function selectPill(clickedBtn, grid, hiddenInput, value, triggerAvailability = false) {
    if (clickedBtn.classList.contains('disabled')) return;
    
    // Hapus class active & tambahkan ke yang diklik
    grid.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
    clickedBtn.classList.add('active');
    
    hiddenInput.value = value;
    
    // Trigger perubahan progress bar secara instan
    updateProgressBar();
    
    if (triggerAvailability) {
        checkAvailability();
    }
}

// ── PROGRESS BAR LOGIC ──────────────────────────────────────────────────────
function updateProgressBar() {
    const requiredInputs = document.querySelectorAll('input[required]:not([type="radio"]), select[required], input[type="radio"]:checked');
    const totalRequired = 7; // Nama, NoHP, Gender, Terapis, Tanggal, Waktu, Sesi
    
    let filledCount = 0;
    
    document.querySelectorAll('input[required]:not([type="radio"]), select[required]').forEach(input => {
        if (input.value.trim() && !input.disabled) filledCount++;
    });
    
    if (document.querySelector('input[name="jenisKelamin"]:checked')) filledCount++;
    
    // Hitung persentase (minimal 5% agar indikator terlihat)
    const percentage = Math.max(5, (filledCount / totalRequired) * 100);
    const bar = document.getElementById('progressBar');
    
    if (bar) {
        bar.style.width = `${percentage}%`;
        bar.style.transition = 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }
}

// ── UI HELPERS ──────────────────────────────────────────────────────────────
function showAlert(message, type = 'error') {
    alertBox.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'} mr-2"></i> ${message}`;
    alertBox.style.display = 'block';
    alertBox.className = `alert alert-${type} animate-fade-in`;
    
    if (type === 'success') {
        setTimeout(hideAlert, 7000);
    }
}

function hideAlert() { 
    alertBox.style.display = 'none'; 
}

function setLoadingBtn(isLoading) {
    btnSubmit.disabled = isLoading;
    btnText.textContent = isLoading ? "Memproses..." : "Konfirmasi Booking";
    btnSpinner.style.display = isLoading ? "block" : "none";
    
    if(isLoading) btnSubmit.classList.add('opacity-80', 'cursor-not-allowed');
    else btnSubmit.classList.remove('opacity-80', 'cursor-not-allowed');
}

// ── LOAD AWAL: Terapis + Setting Klinik ─────────────────────────────────────
async function loadInitialData() {
    try {
        const response = await fetch(`${GAS_URL}?action=getInitData`);
        if (!response.ok) throw new Error("Gagal terhubung ke server klinik.");

        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        const { terapis, setting, layanan } = hasil.data;

        allTerapisData = terapis;
        hariLiburList = setting.hariLibur || [];

        // Penanganan fallback layanan yang lebih elegan
        allLayananData = (layanan?.length > 0) ? layanan : (setting.sesiBekam || []).map(s => ({
            nama: s,
            hariAktif: [],
            terapisKhusus: []
        }));

        renderSesi();
        buildDateStrip();

        document.querySelectorAll('input[name="jenisKelamin"]').forEach(r => r.disabled = false);
        btnSubmit.disabled = false;
        
        // Animasi fade-out loader
        globalLoader.style.opacity = '0';
        setTimeout(() => globalLoader.style.display = 'none', 300);

    } catch (err) {
        globalLoader.innerHTML = `<div class="text-white text-center"><i class="fas fa-wifi fa-3x mb-3"></i><p>${err.message}</p></div>`;
        showAlert("Gagal memuat data klinik: " + err.message, 'error');
    }
}

// ── DATE STRIP BUILDER — 30 Hari ke Depan ────────────────────────────────────
function buildDateStrip() {
    gridTanggal.innerHTML = '';
    const today = new Date();
    const fragment = document.createDocumentFragment(); // Optimasi manipulasi DOM

    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const isoStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const hariIdx = d.getDay();
        const isLibur = hariLiburList.includes(hariIdx);

        const card = document.createElement('div');
        card.className = `date-card transition-all duration-200 ${isLibur ? 'disabled opacity-50 bg-gray-100' : 'cursor-pointer hover:border-emerald-400'}`;
        card.innerHTML = `
            <span class="dc-day text-xs font-semibold">${NAMA_HARI_PENDEK[hariIdx]}</span>
            <span class="dc-date text-xl font-bold my-1">${d.getDate()}</span>
            <span class="dc-month text-xs">${NAMA_BULAN_PENDEK[d.getMonth()]}</span>
        `;

        if (isLibur) {
            card.title = 'Klinik tutup hari ini';
        } else {
            card.onclick = () => {
                gridTanggal.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                tanggalSelect.value = isoStr;
                updateProgressBar();
                
                // Reset slot & check ketersediaan
                gridWaktu.innerHTML = '<div class="pill-placeholder"><i class="fas fa-circle-notch fa-spin"></i> Mengecek...</div>';
                waktuInput.value = '';
                checkAvailability();
                renderSesi(); 
            };
        }
        fragment.appendChild(card);
    }
    gridTanggal.appendChild(fragment);
}

// ── NAVIGASI PANAH DATE STRIP ────────────────────────────────────────────────
function scrollDateStrip(direction) {
    const cardWidth = gridTanggal.querySelector('.date-card')?.offsetWidth || 85;
    const gap = 10; 
    const scrollAmount = (cardWidth + gap) * 3;
    gridTanggal.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// ── FILTER TERAPIS BERDASARKAN GENDER ───────────────────────────────────────
function filterTerapis() {
    const genderKlien = document.querySelector('input[name="jenisKelamin"]:checked')?.value;
    if (!genderKlien) return;

    // Reset status form terkait
    gridTerapis.innerHTML = '<div class="pill-placeholder animate-pulse">Memuat...</div>';
    gridWaktu.innerHTML   = '<div class="pill-placeholder">Pilih terapis dan tanggal dulu</div>';
    terapisInput.value = '';
    waktuInput.value   = '';
    
    renderSesi();
    hideAlert();
    updateProgressBar();

    const cocok = allTerapisData.filter(t => t.gender === genderKlien);

    if (cocok.length === 0) {
        gridTerapis.innerHTML = '<div class="pill-placeholder text-rose-500"><i class="fas fa-user-slash"></i> Terapis tidak tersedia</div>';
        showAlert(`Belum ada Terapis ${genderKlien} yang tersedia saat ini.`, 'error');
    } else {
        gridTerapis.innerHTML = '';
        cocok.forEach(t => {
            const btn = document.createElement('div');
            btn.className = 'pill-btn transition-transform hover:scale-105 active:scale-95';
            btn.innerHTML = `<i class="fas fa-user-md mr-2"></i> ${t.nama}`;
            btn.onclick = () => {
                selectPill(btn, gridTerapis, terapisInput, t.nama, true);
                renderSesi(); 
            };
            gridTerapis.appendChild(btn);
        });
        
        if (tanggalSelect.value) checkAvailability();
    }
}

// ── VALIDASI HARI LIBUR (Frontend, Instan) ───────────────────────────────────
function validateHariLibur(tanggal) {
    if (!tanggal) return true;
    const hariAngka = new Date(tanggal + 'T00:00:00').getDay();
    if (hariLiburList.includes(hariAngka)) {
        showAlert(`⛔ Klinik tutup setiap hari ${NAMA_HARI[hariAngka]}. Silakan pilih tanggal lain.`, 'error');
        tanggalSelect.value = ''; 
        gridWaktu.innerHTML = '<div class="pill-placeholder">Pilih terapis dan tanggal dulu</div>';
        waktuInput.value = '';
        updateProgressBar();
        return false;
    }
    return true;
}

// ── CEK KETERSEDIAAN SLOT JAM (Dengan AbortController) ───────────────────────
let currentAborter = null; // Mencegah race condition jika diklik beruntun

async function checkAvailability() {
    const trp = terapisInput.value;
    const tgl = tanggalSelect.value;
    if (!trp || !tgl || !validateHariLibur(tgl)) return;

    // Batalkan request sebelumnya jika user spam klik
    if (currentAborter) currentAborter.abort();
    currentAborter = new AbortController();

    tanggalSelect.disabled = true;
    gridWaktu.innerHTML = '<div class="pill-placeholder"><i class="fas fa-spinner fa-spin text-emerald-600"></i> Sinkronisasi jadwal...</div>';
    waktuInput.value = '';
    hideAlert();

    try {
        const res = await fetch(`${GAS_URL}?action=cekWaktu&tanggal=${tgl}&terapis=${encodeURIComponent(trp)}`, {
            signal: currentAborter.signal
        });
        
        if (!res.ok) throw new Error("Masalah koneksi jaringan.");
        const result = await res.json();

        if (result.status !== 'success') throw new Error(result.message);

        if (result.data.length === 0) {
            gridWaktu.innerHTML = '<div class="pill-placeholder text-rose-500"><i class="fas fa-calendar-times"></i> Penuh / Libur</div>';
            showAlert(result.info || "Semua slot penuh atau klinik libur hari ini.", 'error');
        } else {
            gridWaktu.innerHTML = '';
            result.data.forEach((j, index) => {
                const btn = document.createElement('div');
                btn.className = 'pill-btn animate-fade-in';
                btn.style.animationDelay = `${index * 50}ms`; // Efek cascade (air terjun)
                btn.innerHTML = `<i class="far fa-clock mr-1"></i> ${j}`;
                btn.onclick = () => selectPill(btn, gridWaktu, waktuInput, j, false);
                gridWaktu.appendChild(btn);
            });
        }
    } catch (err) {
        if (err.name === 'AbortError') return; // Abaikan error jika sengaja di-abort
        gridWaktu.innerHTML = '<div class="pill-placeholder text-rose-500"><i class="fas fa-exclamation-triangle"></i> Gagal memuat</div>';
        showAlert("Gagal mengecek jadwal: " + err.message, 'error');
    } finally {
        tanggalSelect.disabled = false;
        currentAborter = null;
    }
}

// ── SUBMIT BOOKING ───────────────────────────────────────────────────────────
async function submitBooking() {
    const formData = {
        jenisKelamin : document.querySelector('input[name="jenisKelamin"]:checked')?.value || '',
        terapis      : terapisInput.value || '',
        sesiBekam    : sesiBekamInput.value || '',
        tanggal      : tanggalSelect.value || '',
        waktu        : waktuInput.value || '',
        nama         : document.getElementById('nama').value.trim(),
        nohp         : document.getElementById('nohp').value.trim()
    };

    // 1. Validasi Input Berbasis Aturan (Lebih bersih)
    const validationRules = [
        { condition: !formData.jenisKelamin, msg: "⚠️ Silakan pilih Jenis Kelamin terlebih dahulu." },
        { condition: !formData.nama,         msg: "⚠️ Harap isi Nama Lengkap Anda." },
        { condition: !formData.nohp,         msg: "⚠️ Harap isi Nomor HP / WhatsApp Anda." },
        { condition: !formData.terapis,      msg: "⚠️ Silakan pilih Terapis." },
        { condition: !formData.tanggal,      msg: "⚠️ Silakan pilih Tanggal Reservasi." },
        { condition: !formData.waktu,        msg: "⚠️ Silakan pilih Slot Waktu." },
        { condition: !formData.sesiBekam,    msg: "⚠️ Silakan pilih Jenis Layanan." }
    ];

    const failedRule = validationRules.find(rule => rule.condition);
    if (failedRule) {
        showAlert(failedRule.msg, 'error');
        return;
    }

    // 2. Validasi Nomor HP (Hanya angka, minimal 10 digit)
    const phoneClean = formData.nohp.replace(/\D/g, ''); // \D = hapus semua selain angka
    if (phoneClean.length < 10) {
        showAlert("⚠️ Nomor HP tidak valid. Masukkan minimal 10 digit angka.", 'error');
        document.getElementById('nohp').focus();
        return;
    }

    setLoadingBtn(true);
    hideAlert();

    try {
        const res = await fetch(GAS_URL, {
            method  : 'POST',
            headers : { 'Content-Type': 'text/plain;charset=utf-8' },
            body    : JSON.stringify(formData)
        });
        
        if (!res.ok) throw new Error("Server tidak merespons. Periksa koneksi Anda.");
        const result = await res.json();

        if (result.status === 'success') {
            showSuccessScreen(result.data);
        } else {
            throw new Error(result.message);
        }

    } catch (err) {
        showAlert("❌ Booking gagal: " + err.message, 'error');
    } finally {
        setLoadingBtn(false);
    }
}

// ── TAMPILKAN HALAMAN SUKSES ──────────────────────────────────────────────────
function showSuccessScreen(data) {
    const formEl    = document.getElementById('bookingForm');
    const overlayEl = document.getElementById('successOverlay');
    
    // Injeksi Data ke DOM
    document.getElementById('resNama').textContent    = data.nama;
    document.getElementById('resTerapis').textContent = data.terapis;
    document.getElementById('resWaktu').textContent   = `${data.tanggal} jam ${data.waktu}`;
    document.getElementById('waLink').href            = data.whatsappUrl;

    // Transisi Halus
    formEl.style.opacity = '0';
    setTimeout(() => {
        formEl.style.display = 'none';
        overlayEl.style.display = 'block';
        setTimeout(() => overlayEl.classList.add('opacity-100', 'scale-100'), 50);
    }, 300);
    
    document.getElementById('progressBar').style.width = '100%';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── LOGIKA LAYANAN DINAMIS ──────────────────────────────────────────────────
function renderSesi() {
    const tgl = tanggalSelect.value;
    const trp = terapisInput.value;
    const hariAngka = tgl ? new Date(tgl + 'T00:00:00').getDay() : -1;

    gridSesi.innerHTML = '';
    let hasValidSelection = false;

    if (!allLayananData?.length) {
        gridSesi.innerHTML = '<div class="col-span-full p-4 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-bold border border-amber-100 text-center">Database Layanan Kosong. Mohon jalankan "Migrasi Data" di Admin Panel.</div>';
        return;
    }

    allLayananData.forEach(lay => {
        // Logika Pemeriksaan Kondisi
        const validHari = !(lay.hariAktif?.length > 0 && hariAngka !== -1 && !lay.hariAktif.includes(hariAngka));
        const validTerapis = !(lay.terapisKhusus?.length > 0 && trp && !lay.terapisKhusus.some(nama => nama.toLowerCase().trim() === trp.toLowerCase().trim()));
        
        const isAvailable = validHari && validTerapis;

        // Render Tombol
        const btn = document.createElement('div');
        btn.className = `pill-btn full-width transition-all duration-300 ${isAvailable ? 'hover:shadow-md' : 'disabled opacity-70'}`;
        
        let label = `<div class="flex items-center justify-between w-full">
                        <span><i class="fas fa-briefcase-medical mr-2 text-emerald-600"></i> ${lay.nama}</span>
                     </div>`;
                     
        if (!isAvailable) {
            const reasons = [!validHari && 'Jadwal Libur', !validTerapis && 'Terapis Beda'].filter(Boolean).join(', ');
            label = `<div class="flex items-center justify-between w-full">
                        <span class="opacity-50 line-through"><i class="fas fa-ban mr-2"></i>${lay.nama}</span>
                        <span class="text-[10px] text-rose-500 font-semibold bg-rose-50 px-2 py-1 rounded-full">${reasons}</span>
                     </div>`;
                     
            if (sesiBekamInput.value === lay.nama) sesiBekamInput.value = '';
        }

        btn.innerHTML = label;
        
        if (isAvailable) {
            btn.onclick = () => selectPill(btn, gridSesi, sesiBekamInput, lay.nama, false);
            if (sesiBekamInput.value === lay.nama) {
                btn.classList.add('active');
                hasValidSelection = true;
            }
        }
        
        gridSesi.appendChild(btn);
    });

    if (sesiBekamInput.value && !hasValidSelection) {
        sesiBekamInput.value = '';
        updateProgressBar();
    }
}
