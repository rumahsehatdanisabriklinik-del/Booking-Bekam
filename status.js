// (Berpindah ke config.js)

async function trackBooking() {
    const hp = document.getElementById('noHpTrack').value;
    const btn = document.getElementById('btnTrack');
    const txt = document.getElementById('btnTrackText');
    const resContainer = document.getElementById('resultContainer');
    const list = document.getElementById('ticketList');
    const alertBox = document.getElementById('alertBoxStatus');

    if (!hp) return;

    btn.disabled = true;
    txt.textContent = "Mencari...";
    alertBox.classList.add('hidden');
    resContainer.classList.add('hidden');

    try {
        const res = await fetch(`${GAS_URL}?action=cekStatusUser&hp=${encodeURIComponent(hp)}`);
        const result = await res.json();

        if (result.status === 'success') {
            if (result.data.length === 0) {
                alertBox.textContent = "Belum ada riwayat booking untuk nomor ini.";
                alertBox.className = "mt-6 p-4 rounded-xl text-sm font-bold text-center border animate-slide-in bg-red-50 text-red-600 border-red-200 block";
            } else {
                list.innerHTML = "";
                result.data.forEach(item => {
                    // Penentuan Warna Badge
                    let badgeClass = "bg-slate-50 text-slate-600 border border-slate-200";
                    let st = item.status.toLowerCase();
                    if (st === "terjadwal") badgeClass = "bg-blue-50 text-blue-600 border border-blue-200";
                    else if (st === "batal" || st === "cancel") badgeClass = "bg-red-50 text-red-600 border border-red-200";
                    else if (st === "selesai") badgeClass = "bg-emerald-50 text-emerald-600 border border-emerald-200";

                    // Tombol Batal hanya muncul jika masih Terjadwal
                    let actionBtnHTML = "";
                    if (st === "terjadwal") {
                        actionBtnHTML = `<button class="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-colors mt-2" onclick="batalkan('${item.row}', '${hp}')"><i class="fas fa-times mr-2"></i> Batalkan Jadwal Ini</button>`;
                    } else if (st === "selesai") {
                        // Tombol Beri Ulasan
                        actionBtnHTML = `<button class="w-full py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-xl text-sm transition-colors mt-2" onclick="openReview('${item.row}', '${hp}', '${item.tanggal}')"><i class="fas fa-star text-amber-400 mr-2"></i> Berikan Ulasan Pelayanan</button>`;
                    }

                    list.innerHTML += `
                        <div class="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col gap-3">
                            <div class="flex justify-between items-center border-b border-dashed border-slate-200 pb-4 mb-2">
                                <strong class="text-lg text-slate-800 font-extrabold">${item.tanggal}</strong>
                                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${badgeClass}">${item.status || "Terjadwal"}</span>
                            </div>
                            <div class="space-y-3 text-sm text-slate-600 font-medium pb-1">
                                <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg"><span class="flex items-center gap-2"><i class="fas fa-user text-emerald-500"></i> Pasien</span> <b class="text-slate-900">${item.nama || "Pasien"}</b></div>
                                <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg"><span class="flex items-center gap-2"><i class="fas fa-clock text-emerald-500"></i> Jam</span> <b class="text-slate-900">${item.waktu}</b></div>
                                <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg"><span class="flex items-center gap-2"><i class="fas fa-user-md text-emerald-500"></i> Terapis</span> <b class="text-slate-900">${item.terapis}</b></div>
                                <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg"><span class="flex items-center gap-2"><i class="fas fa-briefcase-medical text-emerald-500"></i> Sesi</span> <b class="text-slate-900 w-[150px] text-right truncate" title="${item.layanan}">${item.layanan}</b></div>
                            </div>
                            ${actionBtnHTML}
                        </div>
                    `;
                });
                resContainer.classList.remove('hidden');
            }
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        alertBox.textContent = "Gagal mengambil data: " + err.message;
        alertBox.className = "mt-6 p-4 rounded-xl text-sm font-bold text-center border animate-slide-in bg-red-50 text-red-600 border-red-200 block";
    } finally {
        btn.disabled = false;
        txt.textContent = "Cari Jadwal";
    }
}

async function batalkan(row, hp) {
    if (!confirm("Apakah Anda yakin ingin membatalkan jadwal ini? Slot akan diberikan kepada orang lain.")) return;

    const alertBox = document.getElementById('alertBoxStatus');
    alertBox.textContent = "Sedang membatalkan...";
    alertBox.className = "mt-6 p-4 rounded-xl text-sm font-bold text-center border animate-slide-in bg-emerald-50 text-emerald-600 border-emerald-200 block";

    const payload = { action: 'batalByUser', row: row, hp: hp };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
            alert("Jadwal sukses dibatalkan.");
            trackBooking();
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        alertBox.textContent = "Gagal membatalkan: " + err.message;
        alertBox.className = "mt-6 p-4 rounded-xl text-sm font-bold text-center border animate-slide-in bg-red-50 text-red-600 border-red-200 block";
    }
}

// ── SISTEM RATING & REVIEW ──
let reviewContext = { row: null, hp: null };

function openReview(row, hp, tgl) {
    reviewContext = { row, hp };
    document.getElementById('reviewTgl').textContent = `Sesi Bekam: ${tgl}`;
    // Reset bintang & text
    document.getElementById('reviewText').value = "";
    setRating(5);
    // Tampilkan modal
    document.getElementById('reviewModal').style.display = 'flex';
}

function closeReview() {
    document.getElementById('reviewModal').style.display = 'none';
}

let currentRating = 5;
function setRating(val) {
    currentRating = val;
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (i <= val) {
            star.classList.remove('text-slate-200');
            star.classList.add('text-amber-400');
        } else {
            star.classList.add('text-slate-200');
            star.classList.remove('text-amber-400');
        }
    }
}

async function sendReview() {
    const btn = document.getElementById('btnSubmitReview');
    const ulasan = document.getElementById('reviewText').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Mengirim...';

    const payload = {
        action: 'submitReview',
        row: reviewContext.row,
        hp: reviewContext.hp,
        rating: currentRating,
        ulasan: ulasan
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        
        if (result.status === 'success') {
            alert("Terima kasih atas ulasan Anda! Sangat berarti bagi peningkatan layanan kami.");
            closeReview();
        } else {
            alert("Gagal kirim ulasan: " + result.message);
        }
    } catch (e) {
        alert("Gagal koneksi ke server.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Kirim Ulasan';
    }
}
