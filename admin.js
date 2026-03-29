let allData = [];
let currentFilter = 'semua';
let currentTab = 'booking';

document.addEventListener('DOMContentLoaded', () => {
    const savedPin = localStorage.getItem('adminPin');
    if (savedPin) {
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
            localStorage.setItem('adminPin', pin);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboardScreen').style.display = 'block';
            switchTab('booking'); // Default tab
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

function switchTab(tab) {
    currentTab = tab;
    const pin = localStorage.getItem('adminPin');

    // UI Tab Update
    document.getElementById('tabBooking').classList.toggle('active', tab === 'booking');
    document.getElementById('tabLaporan').classList.toggle('active', tab === 'laporan');
    
    document.getElementById('tabContentBooking').style.display = tab === 'booking' ? 'block' : 'none';
    document.getElementById('tabContentLaporan').style.display = tab === 'laporan' ? 'block' : 'none';

    if (tab === 'booking') {
        loadDashboardData(pin);
    } else {
        loadLaporanData(pin);
    }
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
            // Jika error dari server, tampilkan pesannya
            container.innerHTML = `<div style="color:#dc2626; text-align:center; padding:20px; background:#fee2e2; border-radius:12px; font-weight:700;">
                <i class="fas fa-exclamation-triangle"></i> ERROR: ${result.message}
            </div>`;
        }
    } catch (err) {
        container.innerHTML = `<div style="color:red; text-align:center;">Gagal memuat data: ${err.message}</div>`;
    } finally {
        loader.style.display = 'none';
    }
}

async function loadLaporanData(pin) {
    const loader = document.getElementById('loadingLaporan');
    const container = document.getElementById('isiLaporan');
    
    loader.style.display = 'block';
    container.innerHTML = '';

    try {
        const res = await fetch(`${GAS_URL}?action=getLaporan&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            renderLaporan(result.data);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">Gagal: ${result.message}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div style="color:red; text-align:center;">Error: ${err.message}</div>`;
    } finally {
        loader.style.display = 'none';
    }
}

function applyFilter(filterMode) {
    currentFilter = filterMode;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(filterMode));
    });
    renderData();
}

function renderData() {
    const container = document.getElementById('listPasien');
    container.innerHTML = '';

    if (!allData || allData.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">Tidak ada data reservasi.</div>`;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    
    let displayData = allData.filter(item => {
        if (currentFilter === 'terjadwal') return (item.status || "Terjadwal").toLowerCase() === 'terjadwal';
        if (currentFilter === 'hariini') return item.tanggal === todayStr;
        return true;
    });

    if (displayData.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa;">Tidak ada data yang cocok.</div>`;
        return;
    }

    displayData.forEach(p => {
        const st = (p.status || "Terjadwal").toLowerCase();
        let borderClass = "";
        let actionBtn = "";

        if (st === "batal" || st === "cancel" || st === "dibatalkan") {
            borderClass = "batal-card";
            actionBtn = `<div style="color: #ef4444; font-weight: bold; font-size:0.9rem;"><i class="fas fa-times-circle"></i> Dibatalkan</div>`;
        } else if (st === "selesai") {
            borderClass = "selesai-card";
            actionBtn = `<div style="color: #10b981; font-weight: bold; font-size:0.9rem;"><i class="fas fa-check-double"></i> Selesai</div>`;
        } else {
            actionBtn = `
                <div class="ac-actions">
                    <button class="btn-sm btn-selesai" onclick="updateStatus('${p.row}', 'Selesai')"><i class="fas fa-check"></i> Selesai</button>
                    <button class="btn-sm btn-batal" onclick="updateStatus('${p.row}', 'Batal')"><i class="fas fa-times"></i> Batal</button>
                </div>
            `;
        }

        container.innerHTML += `
            <div class="admin-card ${borderClass}">
                <div class="ac-header">
                    <div>
                        <h3 class="ac-title"><i class="fas fa-user-circle"></i> ${p.nama}</h3>
                        <div class="ac-subtitle">${p.hp} &bull; ${p.terapis}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight: 800; color:var(--emerald-700); font-size: 1.1rem;">${p.waktu}</div>
                        <div style="font-size:0.8rem; color:#888; font-weight:600;">${p.tanggal}</div>
                    </div>
                </div>
                <div class="ac-body">
                    <p><strong>Layanan</strong><span>${p.layanan}</span></p>
                    <p><strong>Status</strong><span>${st.toUpperCase()}</span></p>
                </div>
                ${actionBtn}
            </div>
        `;
    });
}

function renderLaporan(data) {
    const container = document.getElementById('isiLaporan');
    const ringkasan = data.ringkasan;

    let html = `
        <div class="stat-grid">
            <div class="stat-card green">
                <div class="stat-icon" style="color:#059669"><i class="fas fa-check-circle"></i></div>
                <div class="stat-num">${ringkasan.selesai}</div>
                <div class="stat-label">Selesai</div>
            </div>
            <div class="stat-card blue">
                <div class="stat-icon" style="color:#2563eb"><i class="fas fa-clock"></i></div>
                <div class="stat-num">${ringkasan.terjadwal}</div>
                <div class="stat-label">Terjadwal</div>
            </div>
            <div class="stat-card red">
                <div class="stat-icon" style="color:#dc2626"><i class="fas fa-times-circle"></i></div>
                <div class="stat-num">${ringkasan.batal}</div>
                <div class="stat-label">Batal</div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon" style="color:#7c3aed"><i class="fas fa-users"></i></div>
                <div class="stat-num">${ringkasan.pasienUnik}</div>
                <div class="stat-label">Pasien Unik</div>
            </div>
        </div>

        <div class="laporan-section">
            <h4><i class="fas fa-user-md"></i> Performa Terapis</h4>
            <table class="laporan-table">
                <thead><tr><th>Terapis</th><th>Selesai</th><th>Total</th></tr></thead>
                <tbody>
                    ${data.perTerapis.map(t => `
                        <tr>
                            <td>${t.nama}</td>
                            <td>${t.selesai}</td>
                            <td>
                                ${t.total}
                                <div class="bar-mini" style="width: ${(t.selesai/t.total*100)||0}%"></div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="laporan-section">
            <h4><i class="fas fa-medal"></i> Layanan Populer</h4>
            <table class="laporan-table">
                <thead><tr><th>Layanan</th><th>Jumlah Pesanan</th></tr></thead>
                <tbody>
                    ${data.perLayanan.map(l => `
                        <tr>
                            <td>${l.nama}</td>
                            <td>${l.jumlah}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="laporan-section">
            <h4><i class="fas fa-user-friends"></i> Loyalitas Pasien (Top 10)</h4>
            <table class="laporan-table">
                <thead><tr><th>Nama Pasien</th><th>HP</th><th>Visit</th><th>Terakhir</th></tr></thead>
                <tbody>
                    ${data.pasienList.slice(0, 10).map(p => `
                        <tr>
                            <td>${p.nama}</td>
                            <td>${p.hp}</td>
                            <td style="color:var(--emerald-600); font-weight:800;">${p.kunjungan}x</td>
                            <td style="font-size:0.8rem; color:#666;">${p.terakhir}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

async function updateStatus(row, newStatus) {
    if(!confirm(`Yakin tandai ${newStatus}?`)) return;

    const pin = localStorage.getItem('adminPin');
    const loader = document.getElementById('loadingDash');
    loader.style.display = 'block';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'adminUpdateStatus', pass: pin, row: row, status: newStatus })
        });
        const result = await res.json();
        if (result.status === 'success') {
            loadDashboardData(pin);
        } else {
            alert("Gagal: " + result.message);
        }
    } catch(err) {
        alert("Gagal menghubungi server.");
    } finally {
        loader.style.display = 'none';
    }
}
