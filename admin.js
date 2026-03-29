// (URL Deploy Google Apps Script ditarik otomatis dari 'config.js')


let currentFilter = 'semua';

document.addEventListener('DOMContentLoaded', () => {
    const savedPin = localStorage.getItem('adminPin');
    if (savedPin) {
        // Coba login otomatis
        verifyPin(savedPin);
    }
});

async function doLogin() {
    const pin = document.getElementById('adminPin').value;
    const btn = document.getElementById('btnLogin');
    document.getElementById('loginAlert').style.display = 'none';
    
    btn.textContent = "Mengecek...";
    btn.disabled = true;

    await verifyPin(pin);

    btn.textContent = "Masuk";
    btn.disabled = false;
}

async function verifyPin(pin) {
    try {
        const res = await fetch(`${GAS_URL}?action=authAdmin&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            localStorage.setItem('adminPin', pin); // Simpan PIN sbg sesi
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboardScreen').style.display = 'block';
            loadDashboardData(pin);
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        const al = document.getElementById('loginAlert');
        al.textContent = err.message || "Gagal menghubungi server";
        al.style.display = 'block';
        localStorage.removeItem('adminPin');
    }
}

function logout() {
    localStorage.removeItem('adminPin');
    location.reload();
}

async function loadDashboardData(pin) {
    const loader = document.getElementById('loadingDash');
    const container = document.getElementById('listPasien');
    
    loader.style.display = 'block';
    container.innerHTML = '';

    try {
        const res = await fetch(`${GAS_URL}?action=getSemuaBooking&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            allData = result.data;
            renderData();
        } else {
            logout(); // Auto logout if access denied
        }
    } catch (err) {
        container.innerHTML = `<div style="color:red; text-align:center;">Gagal memuat data: ${err.message}</div>`;
    } finally {
        loader.style.display = 'none';
    }
}

function applyFilter(filterMode) {
    currentFilter = filterMode;
    // Ubah styling tombol active
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().replace(' ', '') === filterMode) {
            btn.classList.add('active');
        }
    });

    renderData();
}

function renderData() {
    const container = document.getElementById('listPasien');
    container.innerHTML = '';

    if (allData.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">Tidak ada data reservasi.</div>`;
        return;
    }

    // Filter Logic
    const todayStr = new Date().toISOString().split('T')[0];
    
    let displayData = allData.filter(item => {
        if (currentFilter === 'terjadwal') return (item.status || "Terjadwal").toLowerCase() === 'terjadwal';
        if (currentFilter === 'hariini') return item.tanggal === todayStr;
        return true; // 'semua'
    });

    if (displayData.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">Tidak ada data yang cocok dengan filter ini.</div>`;
        return;
    }

    displayData.forEach(p => {
        const st = (p.status || "Terjadwal").toLowerCase();
        let borderClass = "";
        let actionBtn = "";

        if (st === "batal" || st === "cancel") {
            borderClass = "batal-card";
            actionBtn = `<div style="color: #c62828; font-weight: bold; font-size:0.9rem; margin-top:5px;"><i class="fas fa-times-circle"></i> Pesanan Dibatalkan</div>`;
        } else if (st === "selesai") {
            borderClass = "selesai-card";
            actionBtn = `<div style="color: #2e7d32; font-weight: bold; font-size:0.9rem; margin-top:5px;"><i class="fas fa-check-double"></i> Pesanan Selesai</div>`;
        } else {
            // mode Terjadwal - Bisa diubah
            actionBtn = `
                <div class="ac-actions">
                    <button class="btn-sm btn-selesai" onclick="updateStatus('${p.row}', 'Selesai')"><i class="fas fa-check"></i> Tandai Selesai</button>
                    <button class="btn-sm btn-batal" onclick="updateStatus('${p.row}', 'Batal')"><i class="fas fa-times"></i> Batalkan</button>
                </div>
            `;
        }

        container.innerHTML += `
            <div class="admin-card ${borderClass}">
                <div class="ac-header">
                    <div>
                        <h3 class="ac-title">${p.nama}</h3>
                        <div class="ac-subtitle">${p.hp} &bull; ${p.terapis}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight: 700; color:var(--primary);">${p.waktu}</div>
                        <div style="font-size:0.8rem; color:#888;">${p.tanggal}</div>
                    </div>
                </div>
                <div class="ac-body">
                    <div><i class="fas fa-briefcase-medical" style="color:#aaa;"></i> ${p.layanan}</div>
                    <div><i class="fas fa-info-circle" style="color:#aaa;"></i> ${st.toUpperCase()}</div>
                </div>
                ${actionBtn}
            </div>
        `;
    });
}

async function updateStatus(row, newStatus) {
    if(!confirm(`Anda yakin ingin mengubah status data ini menjadi ${newStatus}?`)) return;

    const pin = localStorage.getItem('adminPin');
    const loader = document.getElementById('loadingDash');
    loader.style.display = 'block';

    const payload = {
        action: 'adminUpdateStatus',
        pass: pin,
        row: row,
        status: newStatus
    };

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.status === 'success') {
            loadDashboardData(pin); // Segarkan list dari server
        } else {
            alert("Gagal memperbarui status: " + result.message);
            loader.style.display = 'none';
        }
    } catch(err) {
        alert("Gagal menghubungi server.");
        loader.style.display = 'none';
    }
}
