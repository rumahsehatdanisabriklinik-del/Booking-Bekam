/* ================================================
   RUMAH SEHAT DANI SABRI — Logika Booking
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

// ── HELPER PILL SELECTION ───────────────────────────────────────────────────
function selectPill(clickedBtn, grid, hiddenInput, value, triggerAvailability = false) {
    if (clickedBtn.classList.contains('disabled')) return;
    
    // Hapus class active dari semua pill di dalam grid
    const peers = grid.querySelectorAll('.pill-btn');
    peers.forEach(p => p.classList.remove('active'));
    
    // Tambahkan class active ke pill yang diklik
    clickedBtn.classList.add('active');
    
    // Isi nilai ke input tersembunyi
    hiddenInput.value = value;
    
    // Jika itu pilihan Terapis dan tanggal sudah ada, cari slot
    if (triggerAvailability) {
        checkAvailability();
    }
}
const btnSubmit       = document.getElementById('btnSubmit');
const btnSpinner      = document.getElementById('btnSpinner');
const btnText         = document.querySelector('.btn-text');
const globalLoader    = document.getElementById('global-loader');
const alertBox        = document.getElementById('alertBox');

let allTerapisData = [];
let hariLiburList  = []; // Daftar angka hari libur dari Spreadsheet

const NAMA_HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

// ── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Batasi tanggal minimal hari ini
    tanggalSelect.setAttribute('min', new Date().toISOString().split('T')[0]);
    loadInitialData();
    
    // Pasang listener untuk update progress bar secara real-time
    const allInputs = document.querySelectorAll('input, select');
    allInputs.forEach(input => {
        input.addEventListener('change', updateProgressBar);
        input.addEventListener('input', updateProgressBar);
    });
});

// ── PROGRESS BAR LOGIC ──────────────────────────────────────────────────────
function updateProgressBar() {
    const requiredInputs = document.querySelectorAll('input[required]:not([type="radio"]), select[required], input[type="radio"]:checked');
    const totalRequired = 7; // Nama, NoHP, Gender, Terapis, Tanggal, Waktu, Sesi
    
    let filledCount = 0;
    
    // Cek input teks & select
    const textAndSelects = document.querySelectorAll('input[required]:not([type="radio"]), select[required]');
    textAndSelects.forEach(input => {
        if (input.value && !input.disabled) filledCount++;
    });
    
    // Cek radio gender
    const genderChecked = document.querySelector('input[name="jenisKelamin"]:checked');
    if (genderChecked) filledCount++;
    
    // Hitung persentase (minimal 5% biar kelihatan ada barnya)
    const percentage = Math.max(5, (filledCount / totalRequired) * 100);
    document.getElementById('progressBar').style.width = percentage + '%';
}

// ── UI HELPERS ──────────────────────────────────────────────────────────────
function showAlert(message, type = 'error') {
    alertBox.textContent = message;
    alertBox.style.display = 'block';
    alertBox.className = 'alert ' + (type === 'error' ? 'alert-error' : 'alert-success');
    if (type === 'success') setTimeout(() => { alertBox.style.display = 'none'; }, 7000);
}

function hideAlert() { alertBox.style.display = 'none'; }

function setLoadingBtn(isLoading) {
    btnSubmit.disabled       = isLoading;
    btnText.textContent      = isLoading ? "Memproses..." : "Konfirmasi Booking";
    btnSpinner.style.display = isLoading ? "block" : "none";
}

// ── LOAD AWAL: Terapis + Setting Klinik (Digabung) ───────────────────────────
async function loadInitialData() {
    try {
        const response = await fetch(`${GAS_URL}?action=getInitData`);
        if (!response.ok) throw new Error("Gagal terhubung ke server klinik.");

        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        const dataTerapis = hasil.data.terapis;
        const dataSetting = hasil.data.setting;

        // Simpan data terapis
        allTerapisData = dataTerapis;

        // Isi dropdown Sesi Bekam dari Spreadsheet
        const sesiList = dataSetting.sesiBekam || [];
        gridSesi.innerHTML = '';
        sesiList.forEach(sesi => {
            const btn = document.createElement('div');
            btn.className = 'pill-btn full-width';
            btn.innerHTML = `<i class="fas fa-briefcase-medical"></i> ${sesi}`;
            btn.onclick = () => selectPill(btn, gridSesi, sesiBekamInput, sesi, false);
            gridSesi.appendChild(btn);
        });

        // Simpan daftar hari libur untuk validasi frontend
        hariLiburList = dataSetting.hariLibur || [];

        // Bangun kalender kartu (Date Strip)
        buildDateStrip();

        // Aktifkan radio gender & tombol submit
        document.querySelectorAll('input[name="jenisKelamin"]').forEach(r => r.disabled = false);
        btnSubmit.disabled = false;
        globalLoader.style.display = 'none';

    } catch (err) {
        globalLoader.style.display = 'none';
        showAlert("Gagal memuat data klinik: " + err.message, 'error');
    }
}

// ── DATE STRIP BUILDER — 30 Hari ke Depan ────────────────────────────────────
const NAMA_HARI_PENDEK   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const NAMA_BULAN_PENDEK  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function buildDateStrip() {
    gridTanggal.innerHTML = '';
    const today = new Date();

    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const year   = d.getFullYear();
        const month  = String(d.getMonth() + 1).padStart(2, '0');
        const day    = String(d.getDate()).padStart(2, '0');
        const isoStr = `${year}-${month}-${day}`;
        const hariIdx = d.getDay();

        const isLibur = hariLiburList.includes(hariIdx);

        const card = document.createElement('div');
        card.className = 'date-card' + (isLibur ? ' disabled' : '');
        card.innerHTML = `
            <span class="dc-day">${NAMA_HARI_PENDEK[hariIdx]}</span>
            <span class="dc-date">${d.getDate()}</span>
            <span class="dc-month">${NAMA_BULAN_PENDEK[d.getMonth()]}</span>
        `;

        if (isLibur) {
            // Tambahkan tooltip singkat tanda klinik tutup
            card.title = 'Klinik tutup hari ini';
        } else {
            card.onclick = () => {
                // Hapus active dari semua
                gridTanggal.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                tanggalSelect.value = isoStr;
                // Scroll sedikit agar kartu aktif kelihatan di tengah
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                // Reset slot waktu
                gridWaktu.innerHTML = '<div class="pill-placeholder"><i class="fas fa-spinner fa-spin"></i> Mengecek ketersediaan...</div>';
                waktuInput.value = '';
                checkAvailability();
            };
        }

        gridTanggal.appendChild(card);
    }
}

// ── FILTER TERAPIS BERDASARKAN GENDER ───────────────────────────────────────
function filterTerapis() {
    const genderKlien = document.querySelector('input[name="jenisKelamin"]:checked')?.value;
    if (!genderKlien) return;

    gridTerapis.innerHTML = '<div class="pill-placeholder">-- Pilih Terapis --</div>';
    gridWaktu.innerHTML   = '<div class="pill-placeholder">Pilih terapis dan tanggal dulu</div>';
    terapisInput.value = '';
    waktuInput.value   = '';
    hideAlert();

    const cocok = allTerapisData.filter(t => t.gender === genderKlien);

    if (cocok.length === 0) {
        gridTerapis.innerHTML = '<div class="pill-placeholder" style="color:#e11d48">Terapis tidak tersedia</div>';
        showAlert(`Belum ada Terapis ${genderKlien} yang tersedia saat ini.`, 'error');
    } else {
        gridTerapis.innerHTML = '';
        cocok.forEach(t => {
            const btn = document.createElement('div');
            btn.className = 'pill-btn';
            btn.innerHTML = `<i class="fas fa-user-md"></i> ${t.nama}`;
            btn.onclick = () => selectPill(btn, gridTerapis, terapisInput, t.nama, true);
            gridTerapis.appendChild(btn);
        });
        checkAvailability(); // Refresh slot jika tanggal sudah dipilih
    }
}

// ── VALIDASI HARI LIBUR (Frontend, Instan) ───────────────────────────────────
function validateHariLibur(tanggal) {
    if (!tanggal) return true; // Belum dipilih, lewati
    const hariAngka = new Date(tanggal + 'T00:00:00').getDay(); // Paksa parse lokal
    if (hariLiburList.includes(hariAngka)) {
        showAlert(`⛔ Klinik tutup setiap hari ${NAMA_HARI[hariAngka]}. Silakan pilih tanggal lain.`, 'error');
        tanggalSelect.value = ''; // Kosongkan tanggal
        gridWaktu.innerHTML = '<div class="pill-placeholder">Pilih terapis dan tanggal dulu</div>';
        waktuInput.value = '';
        return false;
    }
    return true;
}

// ── CEK KETERSEDIAAN SLOT JAM ────────────────────────────────────────────────
function checkAvailability() {
    const trp = terapisInput.value;
    const tgl = tanggalSelect.value;
    if (!trp || !tgl) return;

    // Validasi hari libur dulu — batalkan jika kena hari libur
    if (!validateHariLibur(tgl)) return;

    // Cegah spam klik dengan mengunci input selama loading
    tanggalSelect.disabled = true;

    gridWaktu.innerHTML = '<div class="pill-placeholder"><i class="fas fa-spinner fa-spin"></i> Mengecek ketersediaan...</div>';
    waktuInput.value = '';
    hideAlert();

    return fetch(`${GAS_URL}?action=cekWaktu&tanggal=${tgl}&terapis=${encodeURIComponent(trp)}`)
        .then(res => {
            if (!res.ok) throw new Error("Masalah jaringan.");
            return res.json();
        })
        .then(result => {
            if (result.status === 'success') {
                if (result.data.length === 0) {
                    gridWaktu.innerHTML = '<div class="pill-placeholder" style="color:#e11d48">Penuh / Libur</div>';
                    showAlert(result.info || "Semua slot penuh atau klinik libur hari ini.", 'error');
                } else {
                    gridWaktu.innerHTML = '';
                    result.data.forEach(j => {
                        const btn = document.createElement('div');
                        btn.className = 'pill-btn';
                        btn.innerHTML = `<i class="fas fa-clock"></i> ${j}`;
                        btn.onclick = () => selectPill(btn, gridWaktu, waktuInput, j, false);
                        gridWaktu.appendChild(btn);
                    });
                }
            } else throw new Error(result.message);
        })
        .catch(err => {
            gridWaktu.innerHTML = '<div class="pill-placeholder">Gagal memuat slot</div>';
            showAlert("Gagal mengecek jadwal: " + err.message, 'error');
        })
        .finally(() => {
            // Buka kembali kuncian input
            tanggalSelect.disabled = false;
        });
}

// ── SUBMIT BOOKING ───────────────────────────────────────────────────────────
async function submitBooking() {
    const genderEl = document.querySelector('input[name="jenisKelamin"]:checked');
    const namaInput = document.getElementById('nama');
    const nohpInput = document.getElementById('nohp');
    
    // 1. Validasi Input Dasar
    const formData = {
        jenisKelamin : genderEl?.value || '',
        terapis      : terapisSelect.value,
        sesiBekam    : sesiBekamSelect.value,
        tanggal      : tanggalSelect.value,
        waktu        : waktuSelect.value,
        nama         : namaInput.value.trim(),
        nohp         : nohpInput.value.trim()
    };

    if (Object.values(formData).some(v => !v)) {
        showAlert("Harap lengkapi semua kolom sebelum booking!", 'error');
        return;
    }

    // 2. Validasi Nomor HP (Contoh: minimal 10 digit, harus angka)
    const phoneClean = formData.nohp.replace(/[^0-9]/g, '');
    if (phoneClean.length < 10) {
        showAlert("Nomor HP tidak valid. Masukkan minimal 10 digit angka.", 'error');
        nohpInput.focus();
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
        if (!res.ok) throw new Error("Server tidak merespons.");
        const result = await res.json();

        if (result.status === 'success') {
            // Tampilkan Halaman Sukses Digital
            showSuccessScreen(result.data);
        } else throw new Error(result.message);

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
    
    // Isi data ticket
    document.getElementById('resNama').textContent    = data.nama;
    document.getElementById('resTerapis').textContent = data.terapis;
    document.getElementById('resWaktu').textContent   = `${data.tanggal} jam ${data.waktu}`;
    
    // Pasang link WA
    const waLink = document.getElementById('waLink');
    waLink.href = data.whatsappUrl;

    // Sembunyikan form, munculkan sukses
    formEl.style.display = 'none';
    overlayEl.style.display = 'block';
    
    // Update progress bar ke 100%
    document.getElementById('progressBar').style.width = '100%';
    
    // Scroll ke atas kartu
    document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
}
