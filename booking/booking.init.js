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
            BookingState.allTerapis = terapisData || [];
            BookingState.allLayanan = layananData || [];
            buildBookingIndexes();
            document.getElementById('global-loader').classList.add('hide');
            listTerapisUI.innerHTML = '<div class="col-span-full text-emerald-500 text-[10px] font-black uppercase tracking-widest p-2 rounded-lg bg-emerald-50 text-center animate-pulse"><i class="fas fa-check-circle"></i> Database Siap</div>';
            setTimeout(() => {
                if (!BookingState.selectedGender) document.getElementById('section-nama-terapis').classList.add('hidden');
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

        const result = await apiGetJson('getInitData', null, { timeoutMs: 15000, retries: 1 });
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
                <button data-action="reload-page" class="bg-slate-900 hover:bg-emerald-600 text-white w-full py-4 rounded-xl font-bold uppercase text-xs transition-colors">Coba Refresh Layar</button>
            </div>
        `;
    }
}

function bindBookingUIEvents() {
    document.addEventListener('click', (event) => {
        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;

        const action = actionTarget.dataset.action;
        if (action === 'generate-ai-tips') {
            generateAITips();
            return;
        }
        if (action === 'toggle-debug-detail') {
            const detail = actionTarget.nextElementSibling;
            if (detail) detail.classList.toggle('hidden');
            return;
        }
        if (action === 'reload-page') {
            location.reload();
        }
    });
}

document.addEventListener('DOMContentLoaded', initBooking);
bindBookingUIEvents();
document.addEventListener('change', handleBookingFormChange);
document.getElementById('tanggal').addEventListener('change', checkAvailability);
document.getElementById('bookingForm').addEventListener('submit', handleBookingSubmit);
document.addEventListener('DOMContentLoaded', updateBookingCtaState);
document.getElementById('bookingForm').addEventListener('input', () => updateBookingCtaState());
