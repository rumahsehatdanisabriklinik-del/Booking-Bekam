// Shared booking state and page-specific helpers.
function scrollToElement(id) {
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, 150);
}

const whatsappInput = document.getElementById('whatsapp');
if (whatsappInput) {
    whatsappInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
    });
}

const usiaInput = document.getElementById('usia');
if (usiaInput) {
    usiaInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
    });
}

const BookingState = window.BookingState = window.BookingState || {
    allTerapis: [],
    allLayanan: [],
    selectedTerapisName: "",
    selectedGender: "",
    selectedLayanan: null,
    layananByNama: new Map(),
    layananByTerapisName: new Map(),
    layananTanpaPerempuan: [],
    namaTerapisKhususSet: new Set(),
    specialLabelsByTerapis: new Map(),
    availabilityAbortController: null,
    availabilityRequestKey: ""
};

window.lastBookingData = null;

const submitBtn = document.getElementById('submitBtn');
const ctaShell = document.getElementById('ctaShell');
const bookingCtaSummary = document.getElementById('bookingCtaSummary');
const ctaKicker = document.getElementById('ctaKicker');
const ctaHelper = document.getElementById('ctaHelper');
const ctaNote = document.getElementById('ctaNote');

function normalizeName(value) {
    return (value || "").toString().trim().toLowerCase();
}

function buildBookingIndexes() {
    BookingState.layananByNama = new Map();
    BookingState.layananByTerapisName = new Map();
    BookingState.layananTanpaPerempuan = [];
    BookingState.namaTerapisKhususSet = new Set();
    BookingState.specialLabelsByTerapis = new Map();

    const namaTerapisPerempuan = new Set(
        BookingState.allTerapis
            .filter(t => t.gender === "Perempuan")
            .map(t => normalizeName(t.nama))
    );

    const layananUmum = [];
    const layananKhususByTerapis = new Map();

    BookingState.allLayanan.forEach(layanan => {
        BookingState.layananByNama.set(normalizeName(layanan.nama), layanan);

        const daftarTerapisKhusus = Array.isArray(layanan.terapisKhusus) ? layanan.terapisKhusus : [];
        if (daftarTerapisKhusus.length === 0) {
            layananUmum.push(layanan);
            return;
        }

        const tanpaTerapisPerempuan = !daftarTerapisKhusus.some(nama =>
            namaTerapisPerempuan.has(normalizeName(nama))
        );

        if (tanpaTerapisPerempuan) {
            BookingState.layananTanpaPerempuan.push(layanan);
        }

        daftarTerapisKhusus.forEach(namaTerapis => {
            const cleanNama = normalizeName(namaTerapis);
            if (!cleanNama) return;

            let layananList = layananKhususByTerapis.get(cleanNama);
            if (!layananList) {
                layananList = [];
                layananKhususByTerapis.set(cleanNama, layananList);
            }
            layananList.push(layanan);

            if (tanpaTerapisPerempuan) {
                BookingState.namaTerapisKhususSet.add(cleanNama);
                let labelList = BookingState.specialLabelsByTerapis.get(cleanNama);
                if (!labelList) {
                    labelList = [];
                    BookingState.specialLabelsByTerapis.set(cleanNama, labelList);
                }
                labelList.push(layanan.nama);
            }
        });
    });

    BookingState.allTerapis.forEach(terapis => {
        const cleanNama = normalizeName(terapis.nama);
        const khusus = layananKhususByTerapis.get(cleanNama) || [];
        BookingState.layananByTerapisName.set(cleanNama, layananUmum.concat(khusus));
    });
}

function handleBookingFormChange(event) {
    const target = event.target;
    if (!target) return;

    if (target.matches('input[name="gender_terapis"]')) {
        onGenderSelected();
        return;
    }

    if (target.matches('input[name="pilih_nama_terapis"]')) {
        selectSpecificTerapis(target.value);
        return;
    }

    if (target.matches('input[name="layanan"]')) {
        onLayananSelectedSafe(target.value);
        return;
    }

    if (target.matches('input[name="waktu"]')) {
        scrollToElement('step-3');
    }

    updateBookingCtaState();
}

function getSelectedBookingBits() {
    const waktu = document.querySelector('input[name="waktu"]:checked');
    const gender = BookingState.selectedGender || "";
    const terapis = BookingState.selectedTerapisName || "";
    const layanan = BookingState.selectedLayanan && BookingState.selectedLayanan.nama ? BookingState.selectedLayanan.nama : "";
    const tanggal = document.getElementById('tanggal') ? document.getElementById('tanggal').value : "";
    const nama = document.getElementById('nama') ? document.getElementById('nama').value.trim() : "";
    const whatsapp = document.getElementById('whatsapp') ? document.getElementById('whatsapp').value.trim() : "";
    return {
        gender,
        terapis,
        layanan,
        tanggal,
        waktu: waktu ? waktu.value : "",
        nama,
        whatsapp
    };
}

function updateBookingCtaState(mode = "default") {
    const bits = getSelectedBookingBits();
    const summaryReady = !!(bits.gender || bits.terapis || bits.layanan || bits.tanggal || bits.waktu);
    const finalReady = !!(bits.gender && bits.terapis && bits.layanan && bits.tanggal && bits.waktu && bits.nama && bits.whatsapp);

    if (bookingCtaSummary) {
        bookingCtaSummary.hidden = !summaryReady;
    }
    const mapText = {
        gender: bits.gender ? `Pasien ${bits.gender}` : "Belum dipilih",
        terapis: bits.terapis || "Belum dipilih",
        layanan: bits.layanan || "Belum dipilih",
        jadwal: bits.tanggal && bits.waktu ? `${bits.tanggal} ${bits.waktu} WIB` : (bits.tanggal || bits.waktu ? `${bits.tanggal || "Tanggal"} ${bits.waktu ? bits.waktu + " WIB" : ""}`.trim() : "Belum dipilih")
    };
    const summaryGender = document.getElementById('ctaSummaryGender');
    const summaryTerapis = document.getElementById('ctaSummaryTerapis');
    const summaryLayanan = document.getElementById('ctaSummaryLayanan');
    const summaryJadwal = document.getElementById('ctaSummaryJadwal');
    if (summaryGender) summaryGender.textContent = mapText.gender;
    if (summaryTerapis) summaryTerapis.textContent = mapText.terapis;
    if (summaryLayanan) summaryLayanan.textContent = mapText.layanan;
    if (summaryJadwal) summaryJadwal.textContent = mapText.jadwal;

    if (mode === "submitting") {
        if (ctaShell) ctaShell.dataset.progress = "submitting";
        if (ctaKicker) ctaKicker.textContent = "Mengirim Booking";
        if (ctaHelper) ctaHelper.textContent = "Mohon tunggu, sistem sedang mengunci slot dan mengirim data ke admin.";
        if (ctaNote) ctaNote.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> booking sedang diproses';
        return;
    }

    if (ctaShell) ctaShell.dataset.progress = finalReady ? "ready" : (summaryReady ? "progress" : "idle");
    if (ctaKicker) ctaKicker.textContent = finalReady ? "Siap Dikirim" : (summaryReady ? "Lanjutkan Booking" : "Langkah Terakhir");
    if (ctaHelper) ctaHelper.textContent = finalReady
        ? "Semua data inti sudah lengkap. Tinggal kirim booking ke admin."
        : (summaryReady
            ? "Ringkasan booking sudah mulai terbentuk. Lengkapi data yang tersisa agar bisa langsung dikirim."
            : "Pastikan tanggal, jam, dan nomor WhatsApp sudah benar sebelum kirim booking.");
    if (ctaNote) ctaNote.innerHTML = finalReady
        ? '<i class="fas fa-check-circle"></i> siap kirim booking'
        : (summaryReady
            ? '<i class="fas fa-arrow-down"></i> lengkapi data tersisa'
            : '<i class="fas fa-bolt"></i> cta booking utama');
}
