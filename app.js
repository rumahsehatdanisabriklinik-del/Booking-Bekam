/* ================================================
   RUMAH SEHAT DANI SABRI — Logika Booking
   app.js
   ================================================ */

// ── KONFIGURASI (Ganti URL ini dengan URL deploy Anda) ──────────────────────
const GAS_URL = "https://script.google.com/macros/s/AKfycbzVmvBoO5y4uqtxbTS6B0mUsjhCMPK9XWLHZ7KcWf5A3PSwK6u8SgcllH8y1Kdoj5ocng/exec";

// ── ELEMENT REFERENCES ──────────────────────────────────────────────────────
const terapisSelect   = document.getElementById('terapis');
const sesiBekamSelect = document.getElementById('sesiBekam');
const tanggalSelect   = document.getElementById('tanggal');
const waktuSelect     = document.getElementById('waktu');
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
});

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

// ── LOAD AWAL: Terapis + Setting Klinik (Paralel) ───────────────────────────
async function loadInitialData() {
    try {
        const [resTerapis, resSetting] = await Promise.all([
            fetch(`${GAS_URL}?action=getTerapis`),
            fetch(`${GAS_URL}?action=getSettings`)
        ]);

        if (!resTerapis.ok || !resSetting.ok) throw new Error("Gagal terhubung ke server klinik.");

        const [hasilTerapis, hasilSetting] = await Promise.all([
            resTerapis.json(),
            resSetting.json()
        ]);

        // Simpan data terapis
        if (hasilTerapis.status === 'success') {
            allTerapisData = hasilTerapis.data;
        } else throw new Error(hasilTerapis.message);

        // Isi dropdown Sesi Bekam dari Spreadsheet
        if (hasilSetting.status === 'success') {
            const sesiList = hasilSetting.data.sesiBekam || [];
            sesiBekamSelect.innerHTML = '<option value="" disabled selected>-- Pilih Layanan --</option>';
            sesiList.forEach(sesi => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = sesi;
                sesiBekamSelect.appendChild(opt);
            });
        // Simpan daftar hari libur untuk validasi frontend
            hariLiburList = hasilSetting.data.hariLibur || [];

            sesiBekamSelect.disabled = false;
        } else throw new Error(hasilSetting.message);

        // Aktifkan radio gender & tombol submit
        document.querySelectorAll('input[name="jenisKelamin"]').forEach(r => r.disabled = false);
        btnSubmit.disabled = false;
        globalLoader.style.display = 'none';

    } catch (err) {
        globalLoader.style.display = 'none';
        showAlert("Gagal memuat data klinik: " + err.message, 'error');
    }
}

// ── FILTER TERAPIS BERDASARKAN GENDER ───────────────────────────────────────
function filterTerapis() {
    const genderKlien = document.querySelector('input[name="jenisKelamin"]:checked')?.value;
    if (!genderKlien) return;

    terapisSelect.innerHTML = '<option value="" disabled selected>-- Pilih Terapis --</option>';
    waktuSelect.innerHTML   = '<option value="" disabled selected>Pilih terapis dan tanggal dulu</option>';
    waktuSelect.disabled    = true;
    hideAlert();

    const cocok = allTerapisData.filter(t => t.gender === genderKlien);

    if (cocok.length === 0) {
        terapisSelect.innerHTML = '<option value="" disabled selected>Terapis tidak tersedia</option>';
        terapisSelect.disabled  = true;
        showAlert(`Belum ada Terapis ${genderKlien} yang tersedia saat ini.`, 'error');
    } else {
        cocok.forEach(t => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = t.nama;
            terapisSelect.appendChild(opt);
        });
        terapisSelect.disabled = false;
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
        waktuSelect.innerHTML = '<option value="" disabled selected>Pilih terapis dan tanggal dulu</option>';
        waktuSelect.disabled  = true;
        return false;
    }
    return true;
}

// ── CEK KETERSEDIAAN SLOT JAM ────────────────────────────────────────────────
async function checkAvailability() {
    const trp = terapisSelect.value;
    const tgl = tanggalSelect.value;
    if (!trp || !tgl) return;

    // Validasi hari libur dulu — batalkan jika kena hari libur
    if (!validateHariLibur(tgl)) return;

    waktuSelect.innerHTML = '<option value="" disabled selected>⏳ Mengecek ketersediaan...</option>';
    waktuSelect.disabled  = true;
    hideAlert();

    try {
        const res    = await fetch(`${GAS_URL}?action=cekWaktu&tanggal=${tgl}&terapis=${encodeURIComponent(trp)}`);
        if (!res.ok) throw new Error("Masalah jaringan.");
        const result = await res.json();

        if (result.status === 'success') {
            if (result.data.length === 0) {
                waktuSelect.innerHTML = '<option value="" disabled selected>Penuh / Klinik Libur</option>';
                showAlert(result.info || "Semua slot penuh atau klinik libur hari ini.", 'error');
            } else {
                waktuSelect.innerHTML = '<option value="" disabled selected>-- Pilih Slot Waktu --</option>';
                result.data.forEach(j => {
                    const opt = document.createElement('option');
                    opt.value = opt.textContent = j;
                    waktuSelect.appendChild(opt);
                });
                waktuSelect.disabled = false;
            }
        } else throw new Error(result.message);

    } catch (err) {
        waktuSelect.innerHTML = '<option value="" disabled selected>Gagal memuat slot</option>';
        showAlert("Gagal mengecek jadwal: " + err.message, 'error');
    }
}

// ── SUBMIT BOOKING ───────────────────────────────────────────────────────────
async function submitBooking() {
    const genderEl = document.querySelector('input[name="jenisKelamin"]:checked');
    const formData = {
        jenisKelamin : genderEl?.value || '',
        terapis      : terapisSelect.value,
        sesiBekam    : sesiBekamSelect.value,
        tanggal      : tanggalSelect.value,
        waktu        : waktuSelect.value,
        nama         : document.getElementById('nama').value.trim(),
        nohp         : document.getElementById('nohp').value.trim()
    };

    if (Object.values(formData).some(v => !v)) {
        showAlert("Harap lengkapi semua kolom sebelum booking!", 'error');
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
            showAlert("✅ " + result.message, 'success');
            // Reset form (sebagian)
            document.getElementById('nama').value = '';
            document.getElementById('nohp').value = '';
            waktuSelect.innerHTML   = '<option value="" disabled selected>Pilih terapis dan tanggal dulu</option>';
            waktuSelect.disabled    = true;
            terapisSelect.innerHTML = '<option value="" disabled selected>Pilih jenis kelamin terlebih dahulu</option>';
            terapisSelect.disabled  = true;
            document.querySelectorAll('input[name="jenisKelamin"]').forEach(r => r.checked = false);
        } else throw new Error(result.message);

    } catch (err) {
        showAlert("❌ Booking gagal: " + err.message, 'error');
    } finally {
        setLoadingBtn(false);
    }
}
