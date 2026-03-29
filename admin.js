let allData = [];
let filteredData = [];
let currentFilter = 'semua';
let currentTab = 'booking';
let searchQuery = "";

document.addEventListener('DOMContentLoaded', () => {
    const savedPin = localStorage.getItem('adminPin');
    if (savedPin) {
        verifyPin(savedPin);
    }
});

async function doLogin() {
    const pin = document.getElementById('adminPin').value;
    const btn = document.getElementById('btnLogin');
    const alert = document.getElementById('loginAlert');
    alert.style.display = 'none';
    
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Mengecek...`;
    btn.disabled = true;

    await verifyPin(pin);

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function verifyPin(pin) {
    try {
        const res = await fetch(`${GAS_URL}?action=authAdmin&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            localStorage.setItem('adminPin', pin);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboardScreen').style.display = 'grid';
            switchTab('booking');
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
    if(!confirm("Anda akan keluar dari sistem manajemen?")) return;
    localStorage.removeItem('adminPin');
    location.reload();
}

function switchTab(tab) {
    currentTab = tab;
    const pin = localStorage.getItem('adminPin');
    const title = document.getElementById('pageTitle');
    const sub   = document.getElementById('pageSubtitle');

    // UI Tab Update
    document.querySelectorAll('.nav-item, .bn-item').forEach(el => {
        const target = el.getAttribute('onclick');
        if (target && target.includes(tab)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    
    document.getElementById('tabContentBooking').style.display = tab === 'booking' ? 'block' : 'none';
    document.getElementById('tabContentLaporan').style.display = tab === 'laporan' ? 'block' : 'none';

    if (tab === 'booking') {
        title.textContent = "Manajemen Reservasi";
        sub.textContent   = "Pantau dan kelola jadwal pasien hari ini.";
        loadDashboardData(pin);
    } else {
        title.textContent = "Laporan & Analitik";
        sub.textContent   = "Data statistik performa klinik Bapak.";
        loadLaporanData(pin);
    }
}

async function loadDashboardData(pin) {
    const loader = document.getElementById('loadingDash');
    const container = document.getElementById('listPasien');
    
    loader.style.display = 'grid';
    container.innerHTML = '';

    try {
        const res = await fetch(`${GAS_URL}?action=getSemuaBooking&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            allData = result.data;
            renderData();
        } else {
            container.innerHTML = `<div class="error-toast"><i class="fas fa-exclamation-triangle"></i> ERROR: ${result.message}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="error-toast">Gagal memuat data: ${err.message}</div>`;
    } finally {
        loader.style.display = 'none';
    }
}

async function loadLaporanData(pin) {
    const loader = document.getElementById('loadingLaporan');
    const container = document.getElementById('isiLaporan');
    
    loader.style.display = 'grid';
    container.innerHTML = '';

    try {
        const res = await fetch(`${GAS_URL}?action=getLaporan&pass=${encodeURIComponent(pin)}`);
        const result = await res.json();
        
        if (result.status === 'success') {
            renderLaporan(result.data);
        } else {
            container.innerHTML = `<div class="error-toast">Gagal: ${result.message}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="error-toast">Error: ${err.message}</div>`;
    } finally {
        loader.style.display = 'none';
    }
}

function applyFilter(filterMode) {
    currentFilter = filterMode;
    document.querySelectorAll('.pill').forEach(btn => {
        const clickAttr = btn.getAttribute('onclick');
        btn.classList.toggle('active', clickAttr && clickAttr.includes(filterMode));
    });
    renderData();
}

function handleSearch(val) {
    searchQuery = val.toLowerCase().trim();
    renderData();
}

function renderData() {
    const container = document.getElementById('listPasien');
    container.innerHTML = '';

    if (!allData || allData.length === 0) {
        container.innerHTML = `<div class="pill-placeholder">Tidak ada data reservasi sama sekali.</div>`;
        return;
    }

    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    
    let displayData = allData.filter(item => {
        // Filter Mode
        let isMatchMode = true;
        if (currentFilter === 'terjadwal') isMatchMode = (item.status || "Terjadwal").toLowerCase() === 'terjadwal';
        else if (currentFilter === 'hariini') isMatchMode = item.tanggal === todayStr;

        // Search Query
        let isMatchSearch = true;
        if (searchQuery) {
            isMatchSearch = (item.nama || "").toLowerCase().includes(searchQuery) || 
                            (item.hp || "").toLowerCase().includes(searchQuery);
        }

        return isMatchMode && isMatchSearch;
    });

    if (displayData.length === 0) {
        container.innerHTML = `<div class="pill-placeholder">Tidak ada data yang cocok dengan pencarian Bapak.</div>`;
        return;
    }

    displayData.forEach(p => {
        const st = (p.status || "Terjadwal").toLowerCase();
        let badgeClass = "badge-terjadwal";
        let actionBtn = "";

        if (st === "batal" || st === "cancel" || st === "dibatalkan") {
            badgeClass = "badge-batal";
            actionBtn = `<div style="color: #ef4444; font-weight: 800; font-size:0.8rem; padding: 10px; text-align:center;"><i class="fas fa-times-circle"></i> Reservasi Dibatalkan</div>`;
        } else if (st === "selesai") {
            badgeClass = "badge-selesai";
            actionBtn = `<div style="color: #10b981; font-weight: 800; font-size:0.8rem; padding: 10px; text-align:center;"><i class="fas fa-check-double"></i> Layanan Selesai</div>`;
        } else {
            actionBtn = `
                <div class="ac-actions">
                    <button class="btn-sm btn-selesai" onclick="updateStatus('${p.row}', 'Selesai')"><i class="fas fa-check"></i> Selesai</button>
                    <button class="btn-sm btn-batal" onclick="updateStatus('${p.row}', 'Batal')"><i class="fas fa-times"></i> Batal</button>
                </div>
            `;
        }

        container.innerHTML += `
            <div class="admin-card">
                <div class="ac-header">
                    <div>
                        <h3 class="ac-title"> ${p.nama}</h3>
                        <div class="ac-subtitle"><i class="fas fa-phone-alt" style="font-size:0.7rem"></i> ${p.hp}</div>
                    </div>
                    <span class="badge ${badgeClass}">${st}</span>
                </div>
                <div class="ac-body">
                    <p><strong>Waktu & Tanggal</strong><span><i class="far fa-clock"></i> ${p.waktu} &bull; ${p.tanggal}</span></p>
                    <p><strong>Terapis</strong><span><i class="far fa-user"></i> ${p.terapis}</span></p>
                    <p style="grid-column: span 2"><strong>Layanan</strong><span><i class="fas fa-notes-medical"></i> ${p.layanan}</span></p>
                </div>
                ${actionBtn}
            </div>
        `;
    });
}

function renderLaporan(data) {
    const container = document.getElementById('isiLaporan');
    const ringkasan = data.ringkasan;
    
    // Bar Chart Sederhana menggunakan CSS-Grid & Persentase
    const maxTotal = Math.max(...data.perLayanan.map(l => l.jumlah), 1);

    let html = `
        <div class="stat-grid">
            <div class="stat-card-premium">
                <div class="s-header">
                    <div class="s-icon" style="background:#f0fdf4; color:#16a34a"><i class="fas fa-check-double"></i></div>
                    <div class="s-num">${ringkasan.selesai}</div>
                </div>
                <div class="s-label">Selesai</div>
            </div>
            <div class="stat-card-premium">
                <div class="s-header">
                    <div class="s-icon" style="background:#eff6ff; color:#2563eb"><i class="fas fa-clock"></i></div>
                    <div class="s-num">${ringkasan.terjadwal}</div>
                </div>
                <div class="s-label">Terjadwal</div>
            </div>
            <div class="stat-card-premium">
                <div class="s-header">
                    <div class="s-icon" style="background:#fef2f2; color:#dc2626"><i class="fas fa-user-times"></i></div>
                    <div class="s-num">${ringkasan.batal}</div>
                </div>
                <div class="s-label">Dibatalkan</div>
            </div>
            <div class="stat-card-premium">
                <div class="s-header">
                    <div class="s-icon" style="background:#faf5ff; color:#7c3aed"><i class="fas fa-users-viewfinder"></i></div>
                    <div class="s-num">${ringkasan.pasienUnik}</div>
                </div>
                <div class="s-label">Total Pasien</div>
            </div>
        </div>

        <div class="premium-table-wrap">
            <h4><i class="fas fa-chart-line"></i> Grafik Layanan Terpopuler</h4>
            <div style="display:flex; flex-direction:column; gap:16px; margin: 20px 0;">
                ${data.perLayanan.map(l => {
                    const pct = (l.jumlah / maxTotal) * 100;
                    return `
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:700;">
                                <span>${l.nama}</span>
                                <span>${l.jumlah}</span>
                            </div>
                            <div style="height:12px; background:#f1f5f9; border-radius:20px; overflow:hidden;">
                                <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #10b981, #34d399); border-radius:20px;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="premium-table-wrap">
            <h4><i class="fas fa-user-md"></i> Kontribusi Terapis</h4>
            <table class="premium-table">
                <thead><tr><th>Nama Terapis</th><th>Selesai</th><th>Efisiensi</th></tr></thead>
                <tbody>
                    ${data.perTerapis.map(t => {
                        const efisiensi = Math.round((t.selesai / (t.total || 1)) * 100);
                        return `
                            <tr>
                                <td><div style="display:flex; align-items:center; gap:10px;"><i class="fas fa-circle-user" style="color:var(--slate-300)"></i> ${t.nama}</div></td>
                                <td>${t.selesai} / ${t.total}</td>
                                <td>
                                    <span style="font-weight:800; color:var(--emerald-600)">${efisiensi}%</span>
                                    <div class="bar-mini" style="width: ${efisiensi}%"></div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="premium-table-wrap">
            <h4><i class="fas fa-crown" style="color:#eab308"></i> Loyalitas Pasien (Top 10)</h4>
            <table class="premium-table">
                <thead><tr><th>Nama Pasien</th><th>Kontak</th><th>Kunjungan</th><th>Terakhir</th></tr></thead>
                <tbody>
                    ${data.pasienList.slice(0, 10).map(p => `
                        <tr>
                            <td>${p.nama}</td>
                            <td>${p.hp}</td>
                            <td><span class="badge badge-selesai">${p.kunjungan}x Visit</span></td>
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
    if(!confirm(`Apakah Bapak yakin menandai layanan ini sebagai ${newStatus.toUpperCase()}?`)) return;

    const pin = localStorage.getItem('adminPin');
    const loader = document.getElementById('loadingDash');
    loader.style.display = 'grid';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'adminUpdateStatus', pass: pin, row: row, status: newStatus })
        });
        const result = await res.json();
        if (result.status === 'success') {
            loadDashboardData(pin);
        } else {
            alert("Gagal memperbarui status: " + result.message);
        }
    } catch(err) {
        alert("Gagal menghubungi server pusat.");
    } finally {
        loader.style.display = 'none';
    }
}
