async function checkStatus() {
    let inputId = document.getElementById('orderIdInput').value.trim();
    if (!inputId) {
        showCustomToast("Silakan masukkan Nomor WhatsApp terlebih dahulu", "error");
        if (phoneInput) phoneInput.focus();
        return;
    }

    if (fetchAborter) fetchAborter.abort();
    fetchAborter = new AbortController();

    document.getElementById('searchSection').classList.add('hidden');
    document.getElementById('errorMsg').classList.add('hidden');
    const resSection = document.getElementById('resultSection');
    resSection.innerHTML = "";
    resSection.classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    try {
        if (typeof window.GAS_URL === 'undefined') throw new Error("Server URL belum diatur.");

        const result = await apiRequestJson(
            buildApiUrl('cekStatusUser', { hp: inputId }),
            { signal: fetchAborter.signal, timeoutMs: 15000, retries: 0 }
        );

        if (result.status === "success" && result.data.length > 0) {
            result.data.forEach((booking, index) => {
                renderSingleBooking(booking, index === result.data.length - 1, index);
            });
            document.getElementById('loader').classList.add('hidden');
            resSection.classList.remove('hidden');
        } else {
            showError("Data tidak ditemukan untuk nomor ini.");
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error(error);
        showError("Gagal terhubung ke server. Periksa koneksi Anda.");
    } finally {
        fetchAborter = null;
    }
}

function renderSingleBooking(data, isLatest, delayIndex = 0) {
    const container = document.getElementById('resultSection');
    const card = document.createElement('div');

    card.className = "mb-8 opacity-0 animate-slide-in-right";
    card.style.animationDelay = `${delayIndex * 150}ms`;

    const stat = data.status.toUpperCase();
    let badgeClass = "bg-slate-100 text-slate-600 border border-slate-200";
    let iconClass = "fas fa-clock animate-pulse";
    let iconBgClass = "bg-slate-50 text-slate-400";
    let glowClass = "";

    if (stat === 'DITERIMA' || stat === 'TERJADWAL') {
        badgeClass = "bg-blue-50 text-blue-600 border border-blue-200";
        iconClass = "fas fa-calendar-check";
        iconBgClass = "bg-blue-100 text-blue-500 shadow-lg shadow-blue-500/20";
        glowClass = "ring-4 ring-blue-50";
    } else if (stat === 'HADIR') {
        badgeClass = "bg-teal-50 text-teal-600 border border-teal-200";
        iconClass = "fas fa-user-check";
        iconBgClass = "bg-teal-500 text-white shadow-lg shadow-teal-500/30";
        glowClass = "ring-4 ring-teal-50";
    } else if (stat === 'SELESAI') {
        badgeClass = "bg-emerald-50 text-emerald-600 border border-emerald-200";
        iconClass = "fas fa-check-double";
        iconBgClass = "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40";
        glowClass = "ring-4 ring-emerald-50";
    } else if (stat === 'BATAL' || stat === 'DIBATALKAN') {
        badgeClass = "bg-red-50 text-red-600 border border-red-200";
        iconClass = "fas fa-times-circle";
        iconBgClass = "bg-red-100 text-red-500 shadow-lg shadow-red-500/20";
        glowClass = "ring-4 ring-red-50";
    }

    const dateObj = new Date(data.tanggal);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const tglStr = dateObj.toLocaleDateString('id-ID', options);
    const checkInPayload = data.checkIn?.payload || '';
    const encodedPayload = checkInPayload ? btoa(unescape(encodeURIComponent(checkInPayload))) : '';
    const summaryText = `${data.terapis} - ${data.tanggal} ${data.waktu}`;
    const encodedSummary = btoa(unescape(encodeURIComponent(summaryText)));
    const canCheckIn = ['MENUNGGU', 'TERJADWAL', 'DITERIMA'].includes(stat) && !!checkInPayload;
    const checkInInfo = data.checkIn ? `<div class="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">Jendela Check-In</div>
                    <div class="text-xs font-bold text-slate-700">Aktif mulai ${data.checkIn.validFrom}</div>
                    <div class="text-xs font-bold text-slate-500 mt-1">Berakhir ${data.checkIn.expiresAt}</div>
                </div>` : '';

    card.innerHTML = `
        <div class="ticket-card p-6 sm:p-8 hover:-translate-y-1 transition-transform duration-300">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl ${iconBgClass} ${glowClass} transition-all">
                        <i class="${iconClass}"></i>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-900 text-base leading-tight">Status Reservasi</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: #${data.row || 'SYS'}</p>
                    </div>
                </div>
                <div class="inline-flex items-center justify-center px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-wider ${badgeClass}">
                    ${stat}
                </div>
            </div>

            <div class="ticket-divider"></div>

            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><i class="fas fa-user-md text-slate-300"></i> Terapis</span>
                    <span class="font-bold text-slate-900 text-sm bg-slate-50 px-3 py-1 rounded-lg">${data.terapis}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><i class="fas fa-briefcase-medical text-slate-300"></i> Layanan</span>
                    <span class="font-bold text-emerald-600 text-sm bg-emerald-50 px-3 py-1 rounded-lg">${data.layanan}</span>
                </div>
                <div class="flex justify-between items-center pt-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><i class="fas fa-calendar-alt text-slate-300"></i> Jadwal</span>
                    <div class="text-right">
                        <div class="font-bold text-slate-900 text-sm">${tglStr}</div>
                        <div class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-0.5"><i class="far fa-clock"></i> ${data.waktu} WIB</div>
                    </div>
                </div>
            </div>
            ${checkInInfo}

            ${stat === 'SELESAI' ? `
                <div class="mt-6 pt-4 border-t border-slate-100">
                    <button data-action="open-review" data-row="${data.row}" data-terapis="${data.terapis}" class="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-sm shadow-lg shadow-slate-900/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group">
                        <i class="fas fa-star text-amber-400 group-hover:rotate-[72deg] transition-transform duration-500"></i> Beri Ulasan Layanan
                    </button>
                </div>
            ` : (stat === 'MENUNGGU' || stat === 'TERJADWAL' || stat === 'DITERIMA' ? `
                <div class="mt-6 pt-4 border-t border-slate-100">
                    ${canCheckIn ? `
                    <button data-action="open-checkin" data-row="${data.row}" data-payload="${encodedPayload}" data-summary="${encodedSummary}" class="w-full mb-3 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-qrcode"></i> Scan QR Check-In Klinik
                    </button>` : ''}
                    <button data-action="cancel-booking" data-row="${data.row}" class="w-full py-3.5 rounded-xl bg-white border-2 border-red-100 text-red-500 font-extrabold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-times-circle"></i> Batalkan Reservasi
                    </button>
                </div>
            ` : '')}
        </div>
    `;

    container.appendChild(card);

    if (isLatest) {
        const btnReset = document.createElement('button');
        btnReset.dataset.action = 'reset-search';
        btnReset.className = "mt-8 w-full py-4 rounded-xl bg-white border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors flex justify-center items-center gap-2 group animate-fade-up";
        btnReset.style.animationDelay = `${(delayIndex + 1) * 150}ms`;
        btnReset.innerHTML = '<i class="fas fa-redo text-xs group-hover:-rotate-180 transition-transform duration-500"></i> Lacak Nomor Lainnya';
        container.appendChild(btnReset);
    }
}

function showError(msg) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    const errEl = document.getElementById('errorMsg');
    errEl.querySelector('span').textContent = msg;
    errEl.classList.remove('hidden');
}

function resetSearch() {
    document.getElementById('resultSection').classList.add('hidden');
    document.getElementById('orderIdInput').value = '';
    document.getElementById('searchSection').classList.remove('hidden');

    const url = new URL(window.location);
    url.searchParams.delete('id');
    url.searchParams.delete('phone');
    window.history.pushState({}, '', url);

    setTimeout(() => document.getElementById('orderIdInput').focus(), 100);
}

async function batalBooking(row) {
    if (!confirm("Apakah Anda yakin ingin membatalkan jadwal terapi ini?\nTindakan ini tidak dapat diurungkan.")) return;

    const hp = document.getElementById('orderIdInput').value.trim();
    const loader = document.getElementById('loader');

    document.getElementById('resultSection').classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const result = await apiPostJson('batalByUser', { row: row, hp: hp }, {
            timeoutMs: 15000,
            retries: 1,
            retryDelayMs: 500
        });

        if (result.status === "success") {
            showCustomToast("Jadwal Anda telah berhasil dibatalkan.", "success");
            checkStatus();
        } else {
            showCustomToast("Gagal membatalkan: " + result.message, "error");
            document.getElementById('resultSection').classList.remove('hidden');
            loader.classList.add('hidden');
        }
    } catch (error) {
        showCustomToast("Terjadi kesalahan sistem saat membatalkan.", "error");
        document.getElementById('resultSection').classList.remove('hidden');
        loader.classList.add('hidden');
    }
}
