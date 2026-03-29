// (URL Deploy Google Apps Script ditarik otomatis dari 'config.js')

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
    alertBox.style.display = 'none';
    resContainer.style.display = 'none';

    try {
        const res = await fetch(`${GAS_URL}?action=cekStatusUser&hp=${encodeURIComponent(hp)}`);
        const result = await res.json();

        if (result.status === 'success') {
            if (result.data.length === 0) {
                alertBox.textContent = "Belum ada riwayat booking untuk nomor ini.";
                alertBox.className = "alert alert-error";
                alertBox.style.display = 'block';
            } else {
                list.innerHTML = "";
                result.data.forEach(item => {
                    // Penentuan Warna Badge
                    let badgeClass = "badge-lainnya";
                    let st = item.status.toLowerCase();
                    if (st === "terjadwal") badgeClass = "badge-terjadwal";
                    else if (st === "batal" || st === "cancel") badgeClass = "badge-batal";
                    else if (st === "selesai") badgeClass = "badge-selesai";

                    // Tombol Batal hanya muncul jika masih Terjadwal
                    let btnBatalHTML = "";
                    if (st === "terjadwal") {
                        btnBatalHTML = `<button class="btn-cancel" onclick="batalkan('${item.row}', '${hp}')"><i class="fas fa-times"></i> Batalkan Jadwal Ini</button>`;
                    }

                    list.innerHTML += `
                        <div class="status-card">
                            <div class="status-header">
                                <strong style="font-size: 1.1rem; color: var(--dark)">${item.tanggal}</strong>
                                <span class="status-badge ${badgeClass}">${item.status || "Terjadwal"}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: #555;">
                                <div><i class="fas fa-clock" style="width: 20px;"></i> Jam: <b>${item.waktu}</b></div>
                                <div><i class="fas fa-user-md" style="width: 20px;"></i> Terapis: <b>${item.terapis}</b></div>
                                <div><i class="fas fa-briefcase-medical" style="width: 20px;"></i> Sesi: <b>${item.layanan}</b></div>
                            </div>
                            ${btnBatalHTML}
                        </div>
                    `;
                });
                resContainer.style.display = 'block';
            }
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        alertBox.textContent = "Gagal mengambil data: " + err.message;
        alertBox.className = "alert alert-error";
        alertBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        txt.textContent = "Cari Jadwal";
    }
}

async function batalkan(row, hp) {
    if (!confirm("Apakah Anda yakin ingin membatalkan jadwal ini? Slot akan diberikan kepada orang lain.")) return;

    // Tampilkan loading global (bisa pakai spinner bawaan atau sekedar alert text)
    const alertBox = document.getElementById('alertBoxStatus');
    alertBox.textContent = "Sedang membatalkan...";
    alertBox.className = "alert alert-success";
    alertBox.style.display = 'block';

    const payload = {
        action: 'batalByUser',
        row: row,
        hp: hp
    };

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            alert("Jadwal sukses dibatalkan.");
            trackBooking(); // Refresh list jadwal
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        alertBox.textContent = "Gagal membatalkan: " + err.message;
        alertBox.className = "alert alert-error";
    }
}
