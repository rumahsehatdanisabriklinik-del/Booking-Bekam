/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Reports
 * ================================================
 */

window.AdminApp.reports.parseCurrency = function parseCurrency(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const cleaned = String(value ?? '').replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
};

window.AdminApp.reports.formatCurrency = function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
};

window.AdminApp.reports.getDateValue = function getDateValue(rawDate) {
    if (!rawDate) return '';
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
};

window.AdminApp.reports.getFilterKey = function getFilterKey(startDate, endDate) {
    return `${startDate || 'all'}::${endDate || 'all'}`;
};

window.AdminApp.reports.initDefaultFilters = function initDefaultFilters() {
    const endInput = document.getElementById('reportEndDate');
    const startInput = document.getElementById('reportStartDate');
    if (!endInput || !startInput) return;
    if (startInput.value || endInput.value) return;

    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 29);

    endInput.value = today.toISOString().slice(0, 10);
    startInput.value = start.toISOString().slice(0, 10);
};

window.AdminApp.reports.getReportBookings = function getReportBookings(startDate, endDate) {
    return window.AdminState.bookings.all.filter((booking) => {
        const bookingDate = window.AdminApp.reports.getDateValue(booking.tanggal);
        if (!bookingDate) return false;
        if (startDate && bookingDate < startDate) return false;
        if (endDate && bookingDate > endDate) return false;
        return true;
    });
};

window.AdminApp.reports.summarizeBookings = function summarizeBookings(bookings) {
    const byService = {};
    const byTherapist = {};
    const byStatus = {};
    const byDay = {};

    let completedCount = 0;
    let acceptedCount = 0;
    let canceledCount = 0;
    let ratedCount = 0;
    let revenue = 0;

    bookings.forEach((booking) => {
        const service = String(booking.layanan || 'Tanpa Layanan').trim();
        const therapist = String(booking.terapis || 'Tanpa Terapis').trim();
        const status = String(booking.status || 'Tanpa Status').trim();
        const day = window.AdminApp.reports.getDateValue(booking.tanggal);
        const amount = window.AdminApp.reports.parseCurrency(
            booking.total_harga || booking.total || booking.nominal || booking.harga || booking.biaya
        );

        byService[service] = (byService[service] || 0) + 1;
        byTherapist[therapist] = (byTherapist[therapist] || 0) + 1;
        byStatus[status] = (byStatus[status] || 0) + 1;
        if (day) byDay[day] = (byDay[day] || 0) + 1;

        if (status === 'SELESAI') {
            completedCount += 1;
            revenue += amount;
        }
        if (status === 'DITERIMA') acceptedCount += 1;
        if (status.toLowerCase().includes('batal')) canceledCount += 1;
        if (booking.rating) ratedCount += 1;
    });

    const toRankedList = (record) => Object.entries(record)
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const trend = Object.entries(byDay)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);

    return {
        totalBookings: bookings.length,
        completedCount,
        acceptedCount,
        canceledCount,
        ratedCount,
        revenue,
        services: toRankedList(byService),
        therapists: toRankedList(byTherapist),
        statuses: toRankedList(byStatus),
        trend
    };
};

window.AdminApp.reports.renderCards = function renderCards(summary) {
    const container = document.getElementById('reportCards');
    if (!container) return;

    const cards = [
        {
            title: 'Total Booking',
            value: summary.totalBookings,
            accent: 'from-slate-900 to-slate-700',
            icon: 'fa-calendar-check',
            note: 'Booking pada rentang filter'
        },
        {
            title: 'Selesai',
            value: summary.completedCount,
            accent: 'from-emerald-600 to-teal-600',
            icon: 'fa-circle-check',
            note: 'Terapi yang telah selesai'
        },
        {
            title: 'Diterima',
            value: summary.acceptedCount,
            accent: 'from-blue-600 to-cyan-600',
            icon: 'fa-thumbs-up',
            note: 'Booking terkonfirmasi'
        },
        {
            title: 'Pendapatan',
            value: window.AdminApp.reports.formatCurrency(summary.revenue),
            accent: 'from-amber-500 to-orange-500',
            icon: 'fa-wallet',
            note: 'Akumulasi booking selesai'
        }
    ];

    container.innerHTML = cards.map((card) => `
        <div class="rounded-[2rem] bg-gradient-to-br ${card.accent} text-white p-6 shadow-xl">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <div class="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">${card.title}</div>
                    <div class="mt-3 text-3xl font-extrabold tracking-tight">${window.AdminApp.utils.escapeHtml(card.value)}</div>
                    <div class="mt-2 text-xs font-semibold text-white/80">${card.note}</div>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-xl">
                    <i class="fas ${card.icon}"></i>
                </div>
            </div>
        </div>
    `).join('');
};

window.AdminApp.reports.renderListCard = function renderListCard(containerId, title, icon, items, emptyText) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
        container.innerHTML = `
            <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center"><i class="fas ${icon}"></i></div>
                    <h3 class="font-extrabold text-slate-800">${title}</h3>
                </div>
                <p class="text-sm font-semibold text-slate-400">${emptyText}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center"><i class="fas ${icon}"></i></div>
                <h3 class="font-extrabold text-slate-800">${title}</h3>
            </div>
            <div class="space-y-3">
                ${items.map((item, index) => `
                    <div class="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-xl bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">${index + 1}</div>
                            <div class="min-w-0">
                                <div class="text-sm font-bold text-slate-800 truncate">${window.AdminApp.utils.escapeHtml(item.label)}</div>
                            </div>
                        </div>
                        <div class="text-sm font-extrabold text-slate-500 shrink-0">${window.AdminApp.utils.escapeHtml(item.total)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

window.AdminApp.reports.renderTrend = function renderTrend(trend) {
    const container = document.getElementById('reportTrend');
    if (!container) return;

    if (!trend.length) {
        container.innerHTML = `
            <div class="rounded-[2rem] border border-dashed border-slate-200 bg-white/70 p-6 text-center text-slate-400 font-semibold">
                Belum ada data tren untuk filter ini.
            </div>
        `;
        return;
    }

    const maxTotal = Math.max(...trend.map((item) => item.total), 1);
    container.innerHTML = `
        <div class="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><i class="fas fa-chart-column"></i></div>
                <div>
                    <h3 class="font-extrabold text-slate-800">Tren Booking 7 Hari Terakhir</h3>
                    <p class="text-xs font-semibold text-slate-400">Diambil dari data dalam rentang filter aktif</p>
                </div>
            </div>
            <div class="grid grid-cols-7 gap-3 items-end min-h-[220px]">
                ${trend.map((item) => `
                    <div class="flex flex-col items-center justify-end gap-3 min-h-[180px]">
                        <div class="text-[10px] font-black text-slate-500">${item.total}</div>
                        <div class="w-full rounded-t-[1rem] bg-gradient-to-t from-emerald-500 to-teal-400" style="height:${Math.max(16, Math.round((item.total / maxTotal) * 140))}px"></div>
                        <div class="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">${window.AdminApp.utils.escapeHtml(window.AdminApp.utils.formatShortDate(item.date))}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

window.AdminApp.reports.renderSummary = function renderSummary(summary) {
    window.AdminApp.reports.renderCards(summary);
    window.AdminApp.reports.renderListCard('reportTopServices', 'Layanan Terlaris', 'fa-stethoscope', summary.services, 'Belum ada layanan pada periode ini.');
    window.AdminApp.reports.renderListCard('reportTopTherapists', 'Terapis Terpadat', 'fa-user-doctor', summary.therapists, 'Belum ada data terapis pada periode ini.');
    window.AdminApp.reports.renderListCard('reportStatusBreakdown', 'Status Booking', 'fa-chart-pie', summary.statuses, 'Belum ada status pada periode ini.');
    window.AdminApp.reports.renderTrend(summary.trend);
};

window.AdminApp.reports.applyFilterPreset = function applyFilterPreset(days) {
    const endInput = document.getElementById('reportEndDate');
    const startInput = document.getElementById('reportStartDate');
    if (!endInput || !startInput) return;

    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - Math.max(0, days - 1));

    endInput.value = today.toISOString().slice(0, 10);
    startInput.value = start.toISOString().slice(0, 10);
    window.AdminApp.reports.loadSummary({ force: true });
};

window.AdminApp.reports.loadSummary = async function loadSummary(options = {}) {
    window.AdminApp.reports.initDefaultFilters();

    if (!window.AdminState.bookings.all.length && window.AdminState.bookings.loadPromise) {
        await window.AdminState.bookings.loadPromise;
    }

    if (!window.AdminState.bookings.all.length) {
        await window.AdminApp.loadAllData();
    }

    const startInput = document.getElementById('reportStartDate');
    const endInput = document.getElementById('reportEndDate');
    const startDate = startInput ? startInput.value : '';
    const endDate = endInput ? endInput.value : '';
    const filterKey = window.AdminApp.reports.getFilterKey(startDate, endDate);
    const version = window.AdminState.bookings.version || 0;

    if (!options.force && window.AdminState.reports.lastRenderedVersion === version && window.AdminState.reports.lastRenderedKey === filterKey) {
        return;
    }

    window.AdminState.reports.filterStart = startDate;
    window.AdminState.reports.filterEnd = endDate;

    const bookings = window.AdminApp.reports.getReportBookings(startDate, endDate);
    const summary = window.AdminApp.reports.summarizeBookings(bookings);
    window.AdminApp.reports.renderSummary(summary);

    window.AdminState.reports.lastRenderedVersion = version;
    window.AdminState.reports.lastRenderedKey = filterKey;
};
