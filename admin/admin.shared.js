/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Shared Logic
 * ================================================
 */

let allBookings = [];
let filteredBookings = [];
let cmsSettingsCache = {};
let currentLayanan = [];
let artikelData = [];
let galeriData = [];

const ADMIN_SESSION_KEY = 'adminSessionToken';
const RESERVATION_PAGE_SIZE = 25;

let currentReservationPage = 1;
let reservationSearchQuery = '';
let reservationSearchDebounce = null;

function getAdminSessionToken() {
    return localStorage.getItem(ADMIN_SESSION_KEY) || '';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function escapeJsSingle(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/</g, '\\x3C')
        .replace(/>/g, '\\x3E');
}

function normalizeThumbUrl(url) {
    let thumb = String(url || '').trim();
    if (!thumb) return '';

    if (thumb.includes('drive.google.com/uc')) {
        try {
            const id = thumb.split('id=')[1].split('&')[0];
            thumb = `https://lh3.googleusercontent.com/d/${id}`;
        } catch (e) {}
    } else if (thumb.includes('id=')) {
        try {
            thumb = `https://lh3.googleusercontent.com/d/${thumb.split('id=')[1].split('&')[0]}`;
        } catch (e) {}
    }

    return thumb;
}

function clearAdminSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('adminPin');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminNama');
}

function isAuthError(result) {
    const message = (result && result.message ? result.message : '').toLowerCase();
    return result && result.status === 'error' && (
        message.includes('sesi login') ||
        message.includes('login kembali') ||
        message.includes('akses ditolak')
    );
}

function handleAdminAuthFailure(message) {
    clearAdminSession();
    alert(message || 'Sesi login berakhir. Silakan login kembali.');
    location.reload();
}

async function adminGet(action, extraParams = {}) {
    const connector = window.GAS_URL.includes('?') ? '&' : '?';
    const params = new URLSearchParams({ action, ...extraParams });
    const token = getAdminSessionToken();
    if (token) params.set('sessionToken', token);

    const res = await fetch(`${window.GAS_URL}${connector}${params.toString()}`);
    const result = await res.json();
    if (isAuthError(result)) {
        handleAdminAuthFailure(result.message);
        throw new Error(result.message);
    }
    return result;
}

async function adminPost(payload) {
    const body = { ...payload };
    const token = getAdminSessionToken();
    if (token) body.sessionToken = token;

    const res = await fetch(`${window.GAS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const result = await res.json();
    if (isAuthError(result)) {
        handleAdminAuthFailure(result.message);
        throw new Error(result.message);
    }
    return result;
}

async function doLogin() {
    const pass = document.getElementById('passInput').value;
    if (!pass) return;

    const btn = document.getElementById('btnLogin');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const result = await fetch(`${window.GAS_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'authAdmin', pass })
        }).then((response) => response.json());

        if (result.status === 'success' && result.sessionToken) {
            localStorage.setItem(ADMIN_SESSION_KEY, result.sessionToken);
            localStorage.setItem('adminRole', result.role || 'admin');
            localStorage.setItem('adminNama', result.nama || 'Admin');
            location.reload();
        } else {
            alert(result.message || 'Login gagal. Silakan coba lagi.');
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    } finally {
        btn.innerHTML = 'Akses Sistem';
        btn.disabled = false;
    }
}

function logout() {
    const token = getAdminSessionToken();
    clearAdminSession();

    if (!token) {
        location.reload();
        return;
    }

    fetch(`${window.GAS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logoutAdmin', sessionToken: token })
    }).finally(() => location.reload());
}

function toggleSidebar(show) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !overlay) return;

    if (show) {
        sidebar.classList.remove('-translate-x-[120%]');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-[120%]');
        overlay.classList.add('hidden');
    }
}

function switchTab(tabId, el) {
    if (window.innerWidth < 1024) toggleSidebar(false);

    document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    el.classList.add('active');

    if (tabId === 'tab-artikel') loadArtikelListAdmin();
    if (tabId === 'tab-galeri') loadGaleriListAdmin();
    if (tabId === 'tab-cms') {
        loadCMSData();
        loadLayananList();
    }
}

async function loadAllData() {
    showLoader(true);
    try {
        const result = await adminGet('getSemuaBooking');
        if (result.status === 'success') {
            allBookings = result.data;
            currentReservationPage = 1;
            renderTables();
        }
    } catch (e) {
        console.error(e);
    } finally {
        showLoader(false);
    }
}

function showLoader(show) {
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.classList.toggle('hidden', !show);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}
