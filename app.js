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
let allLayananData = [];
let hariLiburList  = []; // Daftar angka hari libur dari Spreadsheet

const NAMA_HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

// ── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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

        // Simpan data Layanan (Jika kosong, gunakan fallback dari Pengaturan)
        if (hasil.data.layanan && hasil.data.layanan.length > 0) {
            allLayananData = hasil.data.layanan;
        } else {
            // Fallback (Konversi format lama)
            const sesiList = dataSetting.sesiBekam || [];
            allLayananData = sesiList.map(s => ({
                nama: s,
                hariAktif: [],
                terapisKhusus: []
            }));
        }

        // Render Sesi awal (sebelum ada filter Terapis/Tanggal)
        renderSesi();

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
                // Reset slot waktu dan cek ketersediaan
                gridWaktu.innerHTML = '<div class="pill-placeholder"><i class="fas fa-spinner fa-spin"></i> Mengecek ketersediaan...</div>';
                waktuInput.value = '';
                checkAvailability();
                renderSesi(); // Update layanan bergantung hari
            };
        }

        gridTanggal.appendChild(card);
    }
}

// ── NAVIGASI PANAH DATE STRIP ────────────────────────────────────────────────
function scrollDateStrip(direction) {
    // Hitung lebar 3 kartu (85px per kartu + 10px gap)
    const scrollAmount = (85 + 10) * 3;
    gridTanggal.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// ── FILTER TERAPIS BERDASARKAN GENDER ───────────────────────────────────────
function filterTerapis() {
    const genderKlien = document.querySelector('input[name="jenisKelamin"]:checked')?.value;
    if (!genderKlien) return;

    gridTerapis.innerHTML = '<div class="pill-placeholder">-- Pilih Terapis --</div>';
    gridWaktu.innerHTML   = '<div class="pill-placeholder">Pilih terapis dan tanggal dulu</div>';
    terapisInput.value = '';
    waktuInput.value   = '';
    
    // Karena Terapis diganti/direset, perbarui juga tombol Layanan
    renderSesi();
    
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
            btn.onclick = () => {
                selectPill(btn, gridTerapis, terapisInput, t.nama, true);
                renderSesi(); // Update layanan waktu ganti terapis
            };
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
        jenisKelamin : genderEl?.value       || '',
        terapis      : terapisInput.value    || '',   // dari pill grid terapis
        sesiBekam    : sesiBekamInput.value  || '',   // dari pill grid sesi
        tanggal      : tanggalSelect.value   || '',   // dari hidden date strip
        waktu        : waktuInput.value      || '',   // dari pill grid waktu
        nama         : namaInput.value.trim(),
        nohp         : nohpInput.value.trim()
    };

    if (Object.values(formData).some(v => !v)) {
        // Tampilkan pesan yang lebih spesifik
        if (!formData.jenisKelamin) { showAlert("⚠️ Silakan pilih Jenis Kelamin terlebih dahulu.", 'error'); return; }
        if (!formData.nama)         { showAlert("⚠️ Harap isi Nama Lengkap Anda.", 'error'); return; }
        if (!formData.nohp)         { showAlert("⚠️ Harap isi Nomor HP / WhatsApp Anda.", 'error'); return; }
        if (!formData.terapis)      { showAlert("⚠️ Silakan pilih Terapis.", 'error'); return; }
        if (!formData.tanggal)      { showAlert("⚠️ Silakan pilih Tanggal Reservasi.", 'error'); return; }
        if (!formData.waktu)        { showAlert("⚠️ Silakan pilih Slot Waktu.", 'error'); return; }
        if (!formData.sesiBekam)    { showAlert("⚠️ Silakan pilih Jenis Layanan.", 'error'); return; }
        showAlert("⚠️ Harap lengkapi semua kolom sebelum booking!", 'error');
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

// ── LOGIKA LAYANAN DINAMIS ──────────────────────────────────────────────────
function renderSesi() {
    const tgl = tanggalSelect.value;
    const trp = terapisInput.value;
    
    // Ambil object date untuk cari index hari (0-6)
    let hariAngka = -1;
    if (tgl) {
        hariAngka = new Date(tgl + 'T00:00:00').getDay();
    }

    gridSesi.innerHTML = '';
    let hasValidSelection = false;

    if (!allLayananData || allLayananData.length === 0) {
        gridSesi.innerHTML = '<div class="col-span-full p-4 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-bold border border-amber-100 text-center">Database Layanan Kosong. Mohon jalankan "Migrasi Data" di Admin Panel.</div>';
        return;
    }

    allLayananData.forEach(lay => {
        // Cek Syarat Hari
        let validHari = true;
        if (lay.hariAktif && lay.hariAktif.length > 0 && hariAngka !== -1) {
            if (!lay.hariAktif.includes(hariAngka)) validHari = false;
        }

        // Cek Syarat Terapis
        let validTerapis = true;
        if (lay.terapisKhusus && lay.terapisKhusus.length > 0 && trp) {
            // Karena nama terapis bisa punya huruf besar/kecil berbeda
            validTerapis = lay.terapisKhusus.some(nama => nama.toLowerCase().trim() === trp.toLowerCase().trim());
        }

        const isAvailable = (validHari && validTerapis);

        const btn = document.createElement('div');
        btn.className = 'pill-btn full-width' + (isAvailable ? '' : ' disabled');
        
        // ... (rest of logic) ...
        let label = `<i class="fas fa-briefcase-medical"></i> ${lay.nama}`;
        if (!isAvailable) {
            let reason = [];
            if (!validHari) reason.push('Jadwal Libur');
            if (!validTerapis) reason.push('Terapis Beda');
            label = `<i class="fas fa-ban opacity-50"></i> <span class="opacity-50 line-through">${lay.nama}</span> <span class="text-[9px] text-red-400 ml-auto block">(${reason.join(', ')})</span>`;
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
        // Just fail-safe reset
        sesiBekamInput.value = '';
        updateProgressBar();
    }
}
