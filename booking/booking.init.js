async function initBooking() {
    const listTerapisUI = document.getElementById('list-terapis-nama');

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
            buildBookingIndexes();
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
            } catch (e) {}
        } else {
            document.getElementById('global-loader').classList.remove('hide');
            listTerapisUI.innerHTML = '<div class="col-span-full text-slate-400 italic p-4 text-center"><i class="fas fa-circle-notch fa-spin mr-2"></i> Sedang memuat data dari server...</div>';
            document.getElementById('section-nama-terapis').classList.remove('hidden');
        }

        const res = await fetch(buildApiUrl('getInitData'));
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
document.addEventListener('change', handleBookingFormChange);
document.getElementById('tanggal').addEventListener('change', checkAvailability);
document.getElementById('bookingForm').addEventListener('submit', handleBookingSubmit);
