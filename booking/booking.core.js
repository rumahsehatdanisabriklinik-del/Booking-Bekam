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

let allTerapis = [];
let allLayanan = [];
let selectedTerapisName = "";
let selectedGender = "";
let selectedLayanan = null;
let layananByNama = new Map();
let layananByTerapisName = new Map();
let layananTanpaPerempuan = [];
let namaTerapisKhususSet = new Set();
let specialLabelsByTerapis = new Map();
let availabilityAbortController = null;
let availabilityRequestKey = "";

window.lastBookingData = null;

const submitBtn = document.getElementById('submitBtn');

function normalizeName(value) {
    return (value || "").toString().trim().toLowerCase();
}

function buildBookingIndexes() {
    layananByNama = new Map();
    layananByTerapisName = new Map();
    layananTanpaPerempuan = [];
    namaTerapisKhususSet = new Set();
    specialLabelsByTerapis = new Map();

    const namaTerapisPerempuan = new Set(
        allTerapis
            .filter(t => t.gender === "Perempuan")
            .map(t => normalizeName(t.nama))
    );

    const layananUmum = [];
    const layananKhususByTerapis = new Map();

    allLayanan.forEach(layanan => {
        layananByNama.set(normalizeName(layanan.nama), layanan);

        const daftarTerapisKhusus = Array.isArray(layanan.terapisKhusus) ? layanan.terapisKhusus : [];
        if (daftarTerapisKhusus.length === 0) {
            layananUmum.push(layanan);
            return;
        }

        const tanpaTerapisPerempuan = !daftarTerapisKhusus.some(nama =>
            namaTerapisPerempuan.has(normalizeName(nama))
        );

        if (tanpaTerapisPerempuan) {
            layananTanpaPerempuan.push(layanan);
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
                namaTerapisKhususSet.add(cleanNama);
                let labelList = specialLabelsByTerapis.get(cleanNama);
                if (!labelList) {
                    labelList = [];
                    specialLabelsByTerapis.set(cleanNama, labelList);
                }
                labelList.push(layanan.nama);
            }
        });
    });

    allTerapis.forEach(terapis => {
        const cleanNama = normalizeName(terapis.nama);
        const khusus = layananKhususByTerapis.get(cleanNama) || [];
        layananByTerapisName.set(cleanNama, layananUmum.concat(khusus));
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
}
