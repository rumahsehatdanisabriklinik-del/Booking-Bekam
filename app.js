// --- Custom Premium Toast Notification ---
function showCustomToast(msg, type = 'error') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const icon = type === 'success' ? '<i class="fas fa-check-circle text-emerald-500 text-lg"></i>' : '<i class="fas fa-exclamation-circle text-red-500 text-lg"></i>';
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

// --- Auto Scroll Pintar ---
function scrollToElement(id) {
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 100; // Offset untuk floating view
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, 150); // Jeda kecil menunggu render UI
}

// --- Sanitasi Input Instan ---
document.getElementById('whatsapp').addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, ''); // Hanya terima angka
});
document.getElementById('usia').addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, ''); // Hanya terima angka
});

// ====================================================================
// --- Integrasi Backend & Logika Inti ---
// ====================================================================
let allTerapis = [];
let allLayanan = [];
let selectedTerapisName = "";
let selectedGender = "";
let selectedLayanan = null;

// Global object to hold booking data for AI Assistant
window.lastBookingData = null;

const submitBtn = document.getElementById('submitBtn');

async function initBooking() {
    const listTerapisUI = document.getElementById('list-terapis-nama');
    
    // Set minimal tanggal = hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggal').setAttribute('min', today);

    if (typeof window.GAS_URL === 'undefined') {
        showCustomToast("ERROR: File config.js tidak terbaca atau window.GAS_URL kosong.", "error");
        return;
    }
    
    try {
        const applyInitData = (terapisData, layananData) => {
            allTerapis = terapisData;
            allLayanan = layananData || [];
            document.getElementById('global-loader').classList.add('hide');
            listTerapisUI.innerHTML = '<div class="col-span-full text-emerald-500 text-[10px] font-black uppercase tracking-widest p-2 rounded-lg bg-emerald-50 text-center animate-pulse"><i class="fas fa-check-circle"></i> Database Siap</div>';
            setTimeout(() => { 
                if (!selectedGender) document.getElementById('section-nama-terapis').classList.add('hidden'); 
            }, 2000);
        };

        const cachedInit = sessionStorage.getItem('initBookingData');
        if (cachedInit) {
            try { 
                const data = JSON.parse(cachedInit);
                applyInitData(data.terapis, data.layanan);
            } catch(e) {}
        } else {
            document.getElementById('global-loader').classList.remove('hide');
            listTerapisUI.innerHTML = '<div class="col-span-full text-slate-400 italic p-4 text-center"><i class="fas fa-circle-notch fa-spin mr-2"></i> Sedang memuat data dari server...</div>';
            document.getElementById('section-nama-terapis').classList.remove('hidden');
        }

        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const res = await fetch(`${window.GAS_URL}${connector}action=getInitData`);
        if (!res.ok) throw new Error("Gagal menghubungi Server (Proxy). Status: " + res.status);
        
        const result = await res.json();
        if (result.status === "success") {
            sessionStorage.setItem('initBookingData', JSON.stringify(result.data));
            applyInitData(result.data.terapis, result.data.layanan);
        } else {
            throw new Error(result.message || "Gagal mengambil data dari Google Sheets.");
        }
    } catch (e) {
        console.error("Gagal memuat data awal:", e);
        document.getElementById('global-loader').innerHTML = `
            <div class="p-8 text-center bg-white rounded-3xl shadow-2xl max-w-sm mx-4 border border-red-100">
                <div class="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-4"><i class="fas fa-wifi"></i></div>
                <h3 class="text-slate-900 font-extrabold mb-2 text-xl">Koneksi Terputus</h3>
                <p class="text-sm text-slate-500 mb-6">${e.message}</p>
                <button onclick="location.reload()" class="bg-slate-900 hover:bg-emerald-600 text-white w-full py-4 rounded-xl font-bold uppercase text-xs transition-colors">Coba Refresh Layar</button>
            </div>
        `;
    }
}
document.addEventListener('DOMContentLoaded', initBooking);

function onLayananSelectedSafe(encodedName) {
    const namaLayanan = decodeURIComponent(escape(atob(encodedName)));
    selectedLayanan = allLayanan.find(l => l.nama.trim() === namaLayanan.trim());
    console.log("Layanan dipilih (Safe):", selectedLayanan);
    if (document.getElementById('tanggal').value) {
        checkAvailability();
    }
    scrollToElement('section-tanggal'); // Auto-scroll
}

function onGenderSelected() {
    selectedGender = document.querySelector('input[name="gender_terapis"]:checked').value;
    filterTerapisName();
    // Reset pilihan berikutnya
    document.getElementById('section-layanan').classList.add('hidden');
    selectedLayanan = null;
    selectedTerapisName = "";
    scrollToElement('section-nama-terapis'); // Auto-scroll
}

function filterTerapisName() {
    if (!selectedGender) return;

    const genderLabel = (selectedGender === "Pria") ? "Laki-laki" : "Perempuan";
    const container = document.getElementById('section-nama-terapis');
    const list = document.getElementById('list-terapis-nama');
    
    // Terapis yang cocok gender-nya dengan pasien
    let matches = allTerapis.filter(t => t.gender === genderLabel);

    // Cari terapis dari layanan lintas gender (tidak peduli gender terapis)
    const lintasGenderLayanan = allLayanan.filter(l => l.lintasGender && l.terapisKhusus && l.terapisKhusus.length > 0);
    const namaLintasTerapis = new Set();
    lintasGenderLayanan.forEach(l => l.terapisKhusus.forEach(n => namaLintasTerapis.add(n.trim().toLowerCase())));

    // Terapis lintas gender: (1) gender === 'lintas' dari inject backend, ATAU
    // (2) namanya ada di layanan khusus (tanpa terapis perempuan) dan bukan di matches biasa
    const matchedNamaSet = new Set(matches.map(t => t.nama.trim().toLowerCase()));

    // Deteksi layanan "khusus" (yang tidak punya terapis perempuan) secara dinamis
    const namaTerapisPerempuan = new Set(
        allTerapis.filter(t => t.gender === "Perempuan").map(t => t.nama.trim().toLowerCase())
    );
    const layananTanpaPerempuan = allLayanan.filter(l => {
        if (!l.terapisKhusus || l.terapisKhusus.length === 0) return false;
        return !l.terapisKhusus.some(n => namaTerapisPerempuan.has(n.trim().toLowerCase()));
    });
    const namaTerapisKhususSet = new Set();
    layananTanpaPerempuan.forEach(l => l.terapisKhusus.forEach(n => namaTerapisKhususSet.add(n.trim().toLowerCase())));

    const addedExtraNames = new Set();
    const terapisKhususExtra = allTerapis.filter(t => {
        const cleanNama = t.nama.trim().toLowerCase();
        
        // 1. JANGAN masukkan jika sudah ada di list matches gender biasa (cegah DOBLE)
        if (matchedNamaSet.has(cleanNama)) return false;

        // 2. JANGAN masukkan jika sudah masuk ke list extra ini sendiri (cegah DOBLE saat inject)
        if (addedExtraNames.has(cleanNama)) return false;

        // 3. Masukkan jika gendernya 'lintas' ATAU dia terapis dari layanan tanpa perempuan
        if (t.gender === "lintas" || namaTerapisKhususSet.has(cleanNama)) {
            addedExtraNames.add(cleanNama);
            return true;
        }
        return false;
    });

    list.innerHTML = "";

    // Kumpulkan nama layanan khusus per terapis untuk label
    const getLabelLayananKhusus = (namaTerapis) => {
        const cleanNama = namaTerapis.trim().toLowerCase();
        return layananTanpaPerempuan
            .filter(l => l.terapisKhusus.some(n => n.trim().toLowerCase() === cleanNama))
            .map(l => l.nama)
            .join(", ");
    };

    list.innerHTML = "";

    const renderTerapisCard = (t, index, isKhusus = false) => {
        const div = document.createElement('label');
        div.className = "w-full animate-fade-up";
        div.style.animationDelay = `${index * 50}ms`;
        const labelKhusus = isKhusus
            ? `<span class="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">${getLabelLayananKhusus(t.nama)}</span>`
            : '';
        div.innerHTML = `
            <input type="radio" name="pilih_nama_terapis" value="${t.nama}" class="radio-hidden" onchange="selectSpecificTerapis('${t.nama}')">
            <div class="pill-label !py-4 !rounded-[1rem] !text-sm flex flex-row gap-3 !justify-start pl-5">
                <div class="w-8 h-8 rounded-full ${isKhusus ? 'bg-teal-50 text-teal-500' : 'bg-emerald-50 text-emerald-500'} flex items-center justify-center icon-wrapper transition-colors"><i class="fas ${isKhusus ? 'fa-star-and-crescent' : 'fa-user-md'}"></i></div>
                <div class="flex flex-col gap-0.5">
                    <span class="text-title text-base font-bold">${t.nama}</span>
                    ${labelKhusus}
                </div>
            </div>
        `;
        list.appendChild(div);
    };

    if (matches.length > 0 || terapisKhususExtra.length > 0) {
        container.classList.remove('hidden');

        // Tampilkan terapis sesuai gender
        matches.forEach((t, i) => renderTerapisCard(t, i, false));

        // Jika ada terapis layanan khusus lintas gender, tampilkan dengan separator
        if (terapisKhususExtra.length > 0) {
            const sep = document.createElement('div');
            sep.className = "col-span-full flex items-center gap-3 my-1 animate-fade-up";
            sep.innerHTML = `<div class="flex-1 h-px bg-teal-100"></div><span class="text-[9px] font-black uppercase tracking-widest text-teal-500">Layanan Khusus</span><div class="flex-1 h-px bg-teal-100"></div>`;
            list.appendChild(sep);
            terapisKhususExtra.forEach((t, i) => renderTerapisCard(t, matches.length + i, true));
        }
    } else {
        container.classList.remove('hidden');
        list.innerHTML = `<div class="col-span-full p-4 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-100 flex items-center gap-3">
            <i class="fas fa-info-circle text-lg"></i> Maaf, tidak ada terapis ${selectedGender} yang tersedia saat ini.
        </div>`;
    }
}


function selectSpecificTerapis(nama) {
    selectedTerapisName = nama;
    renderLayanan(); // Munculkan layanan setelah pilih terapis
    if (document.getElementById('tanggal').value) {
        checkAvailability();
    }
    scrollToElement('section-layanan'); // Auto-scroll
}

function renderLayanan() {
    if (!selectedTerapisName) return;
    const container = document.getElementById('section-layanan');
    const list = document.getElementById('list-layanan');
    
    // Tampilkan skeleton/loading
    list.innerHTML = `
        <div class="skeleton-box h-24 w-full"></div>
        <div class="skeleton-box h-24 w-full"></div>
        <div class="skeleton-box h-24 w-full"></div>
    `;
    container.classList.remove('hidden');

    setTimeout(() => { // Simulasi parsing cepat agar skeleton terlihat sesaat
        list.innerHTML = "";
        
        // Debugging (cek apakah data ada)
        if (allLayanan.length === 0) {
            list.innerHTML = `
                <div class="col-span-full p-4 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-100 text-center">
                    <i class="fas fa-database mb-2 block text-lg"></i>
                    Database Layanan Kosong secara teknis.<br>
                    <span class="font-normal text-[10px]">Cek log console atau jalankan ulang Migrasi Data.</span>
                </div>`;
            return;
        }

        // Normalisasi nama terapis (hapus spasi depan/belakang dan ubah kecil)
        const cleanTarget = selectedTerapisName.toLowerCase().trim();

        // Ambil layanan yang bisa dilakukan terapis ini
        const availableServices = allLayanan.filter(lay => {
            // 1. Jika terapisKhusus kosong/tidak ada, tersedia untuk semua terapis
            if (!lay.terapisKhusus || lay.terapisKhusus.length === 0) return true;
            
            // 2. Jika ada pembatasan, cek kecocokan nama secara ketat
            const isMatch = lay.terapisKhusus.some(t => {
                const cleanT = t.toLowerCase().trim();
                return cleanT === cleanTarget;
            });
            
            return isMatch;
        });

        if (availableServices.length === 0) {
            // Tampilkan Info Debug supaya USER bisa lapor ke AI
            const debugInfo = allLayanan.map(l => `${l.nama}(${l.terapisKhusus.join(",")})`).join(" | ");
            list.innerHTML = `
                <div class="col-span-full p-6 bg-slate-50 text-slate-500 rounded-[1.5rem] text-[11px] font-bold text-center border-2 border-dashed border-slate-200">
                    Maaf, Terapis <b class="text-slate-800">${selectedTerapisName}</b> tidak terdaftar untuk layanan manapun di Sheet.<br>
                    <button type="button" onclick="this.nextElementSibling.classList.toggle('hidden')" class="mt-2 text-emerald-600 underline hover:text-emerald-700 transition-colors">Klik untuk Lihat Detail Debug</button>
                    <div class="hidden mt-4 p-4 bg-white border rounded-xl font-mono text-[9px] text-left break-all shadow-inner">
                        <b>Data dari Sheet:</b><br>${debugInfo}<br><br>
                        <b>Target:</b> [${cleanTarget}]
                    </div>
                </div>`;
            return;
        }

        availableServices.forEach((lay, index) => {
            const card = document.createElement('label');
            card.className = "w-full cursor-pointer animate-fade-up";
            card.style.animationDelay = `${index * 50}ms`;
            const iconClass = lay.icon || 'fa-hand-holding-heart';
            const safeName = btoa(unescape(encodeURIComponent(lay.nama)));
            
            card.innerHTML = `
                <input type="radio" name="layanan" value="${safeName}" class="radio-hidden" onchange="onLayananSelectedSafe('${safeName}')">
                <div class="pill-label group relative overflow-hidden h-full !rounded-[1.25rem]">
                    <div class="icon-wrapper w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl mb-2 transition-transform duration-300">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    <span class="text-title text-[11px] font-black uppercase tracking-wider text-slate-800 leading-tight px-2">${lay.nama}</span>
                    ${lay.terlaris ? '<div class="absolute -top-1 -right-6 bg-amber-400 text-[9px] font-black py-1 px-6 rotate-45 text-white shadow-sm tracking-widest">TOP</div>' : ''}
                </div>
            `;
            list.appendChild(card);
        });
    }, 300); // Simulasi delay memuat skeleton
}

async function checkAvailability() {
    const tgl = document.getElementById('tanggal').value;
    if (!tgl || !selectedTerapisName) return;

    const gridWaktu = document.querySelector('#step-2 .grid');

    // Validasi Hari Aktif Layanan Sebelum Fetch
    if (selectedLayanan && selectedLayanan.hariAktif && selectedLayanan.hariAktif.length > 0) {
        // Konversi YYYY-MM-DD ke Day Number secara manual (Anti-Meleset)
        const parts = tgl.split('-').map(Number);
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]); // year, month (0-indexed), day
        const day = dObj.getDay();
        
        if (!selectedLayanan.hariAktif.includes(day)) {
            const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
            const hariNama = selectedLayanan.hariAktif.map(h => daysMap[h]).join(", ");
            gridWaktu.innerHTML = `
                <div class="col-span-full p-6 bg-red-50 text-red-700 rounded-2xl border-2 border-red-100 text-center animate-fade-up">
                    <div class="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"><i class="fas fa-calendar-times"></i></div>
                    <div class="font-black uppercase text-xs tracking-widest mb-1">Layanan Libur</div>
                    <p class="text-xs font-bold font-sans opacity-80 uppercase leading-relaxed">
                        Mohon maaf, layanan <b class="text-red-600">${selectedLayanan.nama}</b><br>hanya tersedia pada hari: <span class="underline">${hariNama}</span>.
                    </p>
                </div>
            `;
            showCustomToast(`Layanan ${selectedLayanan.nama} libur di hari tersebut.`, "error");
            return;
        }
    }

    // UI Skeleton Loader Slot Waktu
    gridWaktu.innerHTML = `
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
        <div class="skeleton-box h-12 w-full !rounded-xl"></div>
    `;

    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const res = await fetch(`${window.GAS_URL}${connector}action=cekWaktu&tanggal=${tgl}&terapis=${encodeURIComponent(selectedTerapisName)}`);
        const result = await res.json();
        
        if (result.status === "success") {
            if (result.data.length > 0) {
                gridWaktu.innerHTML = "";
                
                // LOGIKA FILTER WAKTU LAMPAU (PAST SLOTS)
                const now = new Date();
                const parts = tgl.split('-').map(Number);
                const selectedDate = new Date(parts[0], parts[1]-1, parts[2]);
                const isToday = now.toDateString() === selectedDate.toDateString();
                
                let dataWaktu = result.data;
                if (isToday) {
                    const currentHour = now.getHours();
                    const currentMin = now.getMinutes();
                    dataWaktu = dataWaktu.filter(slot => {
                        const [h, m] = slot.split(':').map(Number);
                        // Beri buffer 11 menit sebelum jam mulai (pasien tidak bisa booking jam yang sudah lewat/sedang berlangsung)
                        if (h < currentHour) return false;
                        if (h === currentHour && m < (currentMin + 11)) return false;
                        return true;
                    });
                }

                if (dataWaktu.length === 0) {
                    gridWaktu.innerHTML = `<div class="col-span-full text-center py-6 px-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 font-bold text-sm"><i class="fas fa-clock mb-2 text-2xl block text-amber-400"></i>Maaf, jadwal untuk hari ini sudah terlewati.</div>`;
                    return;
                }

                dataWaktu.forEach((jam, idx) => {
                    const label = document.createElement('label');
                    label.className = "animate-fade-up";
                    label.style.animationDelay = `${idx * 40}ms`;
                    label.innerHTML = `
                        <input type="radio" name="waktu" value="${jam}" class="radio-hidden" ${idx === 0 ? 'checked' : ''} onchange="scrollToElement('step-3')">
                        <div class="pill-label !py-3 !rounded-xl !text-sm hover:!bg-emerald-50 hover:!border-emerald-300 transition-colors">
                            <span class="text-title flex items-center gap-2"><i class="far fa-clock opacity-50"></i> ${jam} WIB</span>
                        </div>
                    `;
                    gridWaktu.appendChild(label);
                });
                
                if(dataWaktu.length > 0) scrollToElement('section-waktu'); // Scroll ke jam
            } else {
                gridWaktu.innerHTML = `<div class="col-span-full text-center py-6 px-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 font-bold text-sm"><i class="fas fa-calendar-times mb-2 text-2xl block text-red-400"></i>${result.info || "Maaf, jadwal penuh."}</div>`;
            }
        }
    } catch (e) {
        gridWaktu.innerHTML = '<div class="col-span-full text-center py-6 bg-red-50 rounded-2xl border border-red-100 text-red-500 font-bold"><i class="fas fa-wifi mb-2 block text-xl"></i> Gagal memuat jadwal jaringan Anda.</div>';
    }
}

document.getElementById('tanggal').addEventListener('change', checkAvailability);

function validateAll() {
    const gender = document.querySelector('input[name="gender_terapis"]:checked');
    const layanan = document.querySelector('input[name="layanan"]:checked');
    const terapis = document.querySelector('input[name="pilih_nama_terapis"]:checked');
    const tgl = document.getElementById('tanggal').value;
    const waktu = document.querySelector('input[name="waktu"]:checked');
    const nama = document.getElementById('nama').value.trim();
    const wa = document.getElementById('whatsapp').value.trim();
    
    if(!gender) { showCustomToast('Silakan pilih Jenis Kelamin.', 'error'); scrollToElement('step-1'); return false; }
    if(!terapis) { showCustomToast('Silakan pilih Terapis.', 'error'); scrollToElement('section-nama-terapis'); return false; }
    if(!layanan) { showCustomToast('Silakan pilih Layanan.', 'error'); scrollToElement('section-layanan'); return false; }
    if(!tgl) { showCustomToast('Silakan pilih Tanggal Kedatangan.', 'error'); document.getElementById('tanggal').focus(); return false; }
    
    if (selectedLayanan && selectedLayanan.hariAktif && selectedLayanan.hariAktif.length > 0) {
        const parts = tgl.split('-').map(Number);
        const day = new Date(parts[0], parts[1]-1, parts[2]).getDay();
        if (!selectedLayanan.hariAktif.includes(day)) {
            const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
            const hariNama = selectedLayanan.hariAktif.map(h => daysMap[h]).join(", ");
            showCustomToast(`Layanan ${selectedLayanan.nama} hanya tersedia di hari: ${hariNama}`, 'error');
            scrollToElement('section-tanggal');
            return false;
        }
    }
    if(!waktu) { showCustomToast('Silakan pilih Jam Kedatangan.', 'error'); scrollToElement('section-waktu'); return false; }
    if(!nama) { showCustomToast('Nama Lengkap wajib diisi.', 'error'); document.getElementById('nama').focus(); return false; }
    if(!wa || wa.length < 9) { showCustomToast('No. WhatsApp tidak valid.', 'error'); document.getElementById('whatsapp').focus(); return false; }
    
    return true;
}

// ====================================================================
// --- Gemini API Logic for Personalized Therapy Tips ---
// ====================================================================
async function callGeminiAPI(promptText) {
    const connector = window.GAS_URL.includes('?') ? '&' : '?';
    const payload = {
        action: "generateAITips",
        prompt: promptText
    };

    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Mengirim Request ke Google Apps Script backend untuk keamanan API Key
            const response = await fetch(`${window.GAS_URL}${connector}action=generateAITips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            if (result.status === "success") {
                return result.data.text;
            } else {
                throw new Error("Gagal mengambil tips: " + result.message);
            }
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
        }
    }
}

async function generateAITips() {
    if (!window.lastBookingData) return;
    
    const btn = document.getElementById('btnAiTips');
    const resultContainer = document.getElementById('aiTipsResult');
    const resultContent = document.getElementById('aiTipsContent');
    
    // UI Loading State
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin text-indigo-200"></i><span>Menganalisis Keluhan...</span>';
    resultContainer.classList.remove('hidden');
    resultContent.innerHTML = `
        <div class="animate-pulse space-y-3">
            <div class="h-4 bg-indigo-100 rounded w-full"></div>
            <div class="h-4 bg-indigo-100 rounded w-5/6"></div>
            <div class="h-4 bg-indigo-100 rounded w-4/6"></div>
        </div>
    `;

    // Construct Prompt based on Booking Data
    const { usia, layanan, keluhan } = window.lastBookingData;
    const userAge = usia ? `${usia} tahun` : "dewasa";
    const userComplaint = (keluhan && keluhan !== "-") ? keluhan : "Hanya ingin menjaga kesehatan umum";
    
    const prompt = `Saya pasien berusia ${userAge}, baru saja mendaftar layanan terapi ${layanan}. Keluhan medis atau tujuan terapi saya adalah: "${userComplaint}". Berikan 3 tips singkat, ramah, dan menenangkan untuk persiapan sebelum melakukan terapi ini agar hasilnya maksimal.`;

    try {
        const aiResponse = await callGeminiAPI(prompt);
        
        // Add default styling to the HTML elements returned by the LLM
        let styledResponse = aiResponse
            .replace(/<ul>/g, '<ul class="list-disc pl-5 space-y-2 marker:text-indigo-400">')
            .replace(/<strong>/g, '<strong class="text-indigo-900">');
            
        resultContent.innerHTML = styledResponse;
    } catch (error) {
        resultContent.innerHTML = `<span class="text-red-500 text-sm flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-100"><i class="fas fa-exclamation-triangle"></i> Maaf, saat ini Asisten AI sedang sibuk atau mengalami gangguan koneksi. Mohon coba beberapa saat lagi ya.</span>`;
    } finally {
        // Restore Button State
        btn.innerHTML = '<i class="fas fa-check text-indigo-200"></i><span>Tips Berhasil Dibuat</span>';
        // Keep button disabled after successful generation to prevent spamming
    }
}

// ====================================================================
// --- Form Submit Handler ---
// ====================================================================
document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    
    submitBtn.disabled = true;
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin text-lg"></i> <span class="relative z-10 ml-2">Memproses Data...</span>';

    // Ambil data (Decode Layanan yang tadinya Base64)
    const layananEncoded = document.querySelector('input[name="layanan"]:checked').value;
    const layananDecoded = decodeURIComponent(escape(atob(layananEncoded)));
    
    const formData = {
        layanan : layananDecoded,
        terapis_pref : selectedGender,
        tanggal : document.getElementById('tanggal').value,
        waktu : document.querySelector('input[name="waktu"]:checked').value,
        nama : document.getElementById('nama').value,
        usia : document.getElementById('usia').value,
        whatsapp : document.getElementById('whatsapp').value,
        keluhan : document.getElementById('keluhan').value || "-"
    };
    
    // Save to global scope for AI Feature
    window.lastBookingData = formData;

    // Map data untuk backend
    const backendData = {
        action: "simpanBookingData",
        nama: formData.nama,
        nohp: formData.whatsapp,
        tanggal: formData.tanggal,
        terapis: selectedTerapisName,
        waktu: formData.waktu,
        jenisKelamin: (formData.terapis_pref === "Pria" ? "Laki-laki" : "Perempuan"),
        sesiBekam: formData.layanan,
        keluhan: formData.keluhan
    };

    try {
        const connector = window.GAS_URL.includes('?') ? '&' : '?';
        const response = await fetch(`${window.GAS_URL}${connector}action=simpanBookingData`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendData)
        });
        const result = await response.json();

        if (result.status === "success") {
            // Update Success UI
            document.getElementById('succ-nama').textContent = formData.nama;
            document.getElementById('succ-terapis').textContent = selectedTerapisName;
            document.getElementById('succ-layanan').textContent = formData.layanan;
            document.getElementById('succ-tanggal').textContent = formData.tanggal;
            document.getElementById('succ-waktu').innerHTML = `<i class="far fa-clock mr-1"></i> ${formData.waktu} WIB`;
            
            document.getElementById('btnWA').href = result.data.whatsappUrl;

            // Switch Screen
            document.getElementById('bookingForm').style.display = 'none';
            document.getElementById('success-screen').style.display = 'block';
            
            // Reset Viewport to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            showCustomToast("Booking Berhasil Dibuat!", "success");
        } else {
            showCustomToast("Maaf, terjadi kesalahan: " + result.message, "error");
        }
    } catch (err) {
        showCustomToast("Gagal terhubung ke sistem. Periksa koneksi Anda.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
    }
});
