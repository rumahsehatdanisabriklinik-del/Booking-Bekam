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
}
