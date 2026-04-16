/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Reservations
 * ================================================
 */

function getVisibleBookings() {
    const role = localStorage.getItem('adminRole');
    const myName = localStorage.getItem('adminNama');

    return window.AdminState.bookings.all.filter((booking) => {
        if (role === 'terapis') return booking.terapis === myName;
        return true;
    });
}

function renderTables() {
    const visibleData = getVisibleBookings();

    window.AdminState.bookings.filtered = getReservationFilteredData(visibleData);
    renderReservationsTable();

    const ulasanBody = document.getElementById('tbUlasanBody');
    ulasanBody.innerHTML = visibleData.filter((booking) => booking.rating).map((booking) => {
        const stars = '&#9733;'.repeat(parseInt(booking.rating, 10) || 0);
        return `
            <tr>
                <td class="font-bold text-slate-800">${escapeHtml(booking.nama)}</td>
                <td class="text-xs font-bold text-slate-500">${escapeHtml(booking.layanan)}</td>
                <td class="text-xs">${stars}</td>
                <td class="text-xs font-medium text-slate-600 max-w-xs italic">${escapeHtml(booking.ulasan || '-')}</td>
            </tr>
        `;
    }).join('');

    const emrBody = document.getElementById('tbEMRBody');
    emrBody.innerHTML = visibleData.map((booking) => `
        <tr>
            <td class="text-xs font-mono text-slate-500">#${escapeHtml(booking.row)}</td>
            <td class="font-bold text-slate-800">${escapeHtml(booking.nama)}</td>
            <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${escapeHtml(booking.keluhan || '-')}</td>
            <td class="text-xs font-medium text-slate-600 max-w-xs truncate">${escapeHtml(booking.tindakan || '-')}</td>
            <td class="text-center">
                <button onclick="openEMR(${Number(booking.row) || 0}, '${escapeJsSingle(booking.nama)}', '${escapeJsSingle(booking.keluhan || '')}', '${escapeJsSingle(booking.tindakan || '')}')" class="bg-emerald-50 text-emerald-600 font-bold text-[10px] px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest">
                    Edit EMR
                </button>
            </td>
        </tr>
    `).join('');
}

function handleSearch(val) {
    window.AdminState.bookings.searchQuery = (val || '').toLowerCase().trim();
    window.AdminState.bookings.currentPage = 1;

    if (window.AdminState.bookings.searchDebounce) clearTimeout(window.AdminState.bookings.searchDebounce);
    window.AdminState.bookings.searchDebounce = setTimeout(() => {
        window.AdminState.bookings.filtered = getReservationFilteredData(getVisibleBookings());
        renderReservationsTable();
    }, 180);
}

function getReservationFilteredData(bookings) {
    if (!window.AdminState.bookings.searchQuery) return bookings;

    return bookings.filter((booking) => {
        const haystack = [
            booking.nama,
            booking.hp,
            booking.layanan,
            booking.terapis,
            booking.tanggal,
            booking.waktu,
            booking.status
        ].join(' ').toLowerCase();

        return haystack.includes(window.AdminState.bookings.searchQuery);
    });
}

function getReservationBadgeClass(status) {
    let badgeClass = 'bg-slate-50 text-slate-400 border-slate-100';
    if (status === 'DITERIMA') badgeClass = 'bg-blue-50 text-blue-600 border-blue-200';
    else if (status === 'SELESAI') badgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
    else if ((status || '').includes('Batal')) badgeClass = 'bg-red-50 text-red-600 border-red-200';
    return badgeClass;
}

function renderReservationsTable() {
    const resBody = document.getElementById('tbReservasiBody');
    if (!resBody) return;

    const totalItems = window.AdminState.bookings.filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / window.AdminConfig.reservationPageSize));
    window.AdminState.bookings.currentPage = Math.min(window.AdminState.bookings.currentPage, totalPages);

    const startIndex = (window.AdminState.bookings.currentPage - 1) * window.AdminConfig.reservationPageSize;
    const pageItems = window.AdminState.bookings.filtered.slice(startIndex, startIndex + window.AdminConfig.reservationPageSize);

    if (pageItems.length === 0) {
        resBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-slate-400 font-bold py-10">
                    Tidak ada data reservasi yang cocok.
                </td>
            </tr>
        `;
        renderReservationPagination(totalItems, totalPages, 0, 0);
        return;
    }

    resBody.innerHTML = pageItems.map((booking) => `
        <tr>
            <td>
                <div class="font-bold text-slate-800">${escapeHtml(booking.nama)}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fab fa-whatsapp text-emerald-500"></i> ${escapeHtml(booking.hp)}</div>
            </td>
            <td>
                <div class="font-bold text-emerald-700">${escapeHtml(booking.layanan)}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1"><i class="fas fa-user-md"></i> ${escapeHtml(booking.terapis)}</div>
            </td>
            <td>
                <div class="font-bold text-slate-700">${escapeHtml(new Date(booking.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))}</div>
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">${escapeHtml(booking.waktu)} WIB</div>
            </td>
            <td>
                <span class="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${getReservationBadgeClass(booking.status)}">
                    ${escapeHtml(booking.status)}
                </span>
            </td>
            <td class="text-center">
                <button onclick="openModalStatus(${Number(booking.row) || 0}, '${escapeJsSingle(booking.status)}')" class="bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm mx-auto">
                    <i class="fas fa-edit text-xs"></i>
                </button>
            </td>
        </tr>
    `).join('');

    renderReservationPagination(
        totalItems,
        totalPages,
        startIndex + 1,
        Math.min(startIndex + pageItems.length, totalItems)
    );
}

function renderReservationPagination(totalItems, totalPages, startItem, endItem) {
    const container = document.getElementById('reservasiPagination');
    if (!container) return;

    if (totalItems === 0) {
        container.innerHTML = '<div class="text-xs font-bold text-slate-400">0 data</div>';
        return;
    }

    container.innerHTML = `
        <div class="text-xs font-bold text-slate-400">
            Menampilkan ${startItem}-${endItem} dari ${totalItems} reservasi
        </div>
        <div class="flex items-center gap-2">
            <button onclick="changeReservationPage(-1)" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-black ${window.AdminState.bookings.currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-300 hover:text-emerald-600'}" ${window.AdminState.bookings.currentPage <= 1 ? 'disabled' : ''}>
                Sebelumnya
            </button>
            <div class="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black">
                Hal. ${window.AdminState.bookings.currentPage}/${totalPages}
            </div>
            <button onclick="changeReservationPage(1)" class="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-black ${window.AdminState.bookings.currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-300 hover:text-emerald-600'}" ${window.AdminState.bookings.currentPage >= totalPages ? 'disabled' : ''}>
                Berikutnya
            </button>
        </div>
    `;
}

function changeReservationPage(direction) {
    const totalPages = Math.max(1, Math.ceil(window.AdminState.bookings.filtered.length / window.AdminConfig.reservationPageSize));
    const nextPage = window.AdminState.bookings.currentPage + direction;
    if (nextPage < 1 || nextPage > totalPages) return;

    window.AdminState.bookings.currentPage = nextPage;
    renderReservationsTable();
}

function openModalStatus(row, current) {
    document.getElementById('editRowIndex').value = row;
    document.getElementById('editStatus').value = current;
    document.getElementById('modalStatus').classList.remove('hidden');
}

function closeModalStatus() {
    document.getElementById('modalStatus').classList.add('hidden');
}

async function saveStatus() {
    const row = document.getElementById('editRowIndex').value;
    const stat = document.getElementById('editStatus').value;
    const btn = document.getElementById('btnSaveStatus');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Memproses...';
    btn.disabled = true;

    try {
        const result = await adminPost({ action: 'adminUpdateStatus', row, status: stat });
        if (result.status === 'success') {
            closeModalStatus();
            loadAllData();
        } else {
            alert(`Gagal update status: ${result.message}`);
        }
    } catch (e) {
        alert('Error koneksi: Gagal memperbarui status.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function openEMR(row, nama, keluhan, tindakan) {
    document.getElementById('emrRowIndex').value = row;
    document.getElementById('emrNamaPasien').textContent = nama;
    document.getElementById('emrKeluhan').value = keluhan;
    document.getElementById('emrTindakan').value = tindakan;
    document.getElementById('modalEMR').classList.remove('hidden');
}

function closeEMR() {
    document.getElementById('modalEMR').classList.add('hidden');
}

async function saveEMR() {
    const row = document.getElementById('emrRowIndex').value;
    const keluhan = document.getElementById('emrKeluhan').value;
    const tindakan = document.getElementById('emrTindakan').value;
    const btn = document.getElementById('btnSaveEMR');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const result = await adminPost({
            action: 'adminUpdateRekamMedis',
            row,
            tensi: '',
            keluhan,
            tindakan
        });

        if (result.status === 'success') {
            closeEMR();
            loadAllData();
        } else {
            alert(`Gagal simpan EMR: ${result.message}`);
        }
    } catch (e) {
        alert('Error koneksi: Gagal menyimpan rekam medis.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
