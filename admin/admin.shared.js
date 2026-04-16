/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Shared Logic
 * ================================================
 */

window.AdminConfig = window.AdminConfig || {
    sessionKey: 'adminSessionToken',
    reservationPageSize: 25
};

window.AdminState = window.AdminState || {
    bookings: {
        all: [],
        filtered: [],
        currentPage: 1,
        searchQuery: '',
        searchDebounce: null
    },
    cms: {
        settingsCache: {},
        layanan: []
    },
    content: {
        artikel: [],
        galeri: []
    }
};

window.AdminApp = window.AdminApp || {
    auth: {},
    ui: {},
    utils: {},
    bookings: {},
    cms: {},
    content: {},
    system: {},
    bindings: {}
};

window.AdminApp.utils.escapeHtml = function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

window.AdminApp.utils.escapeAttr = function escapeAttr(value) {
    return window.AdminApp.utils.escapeHtml(value);
};

window.AdminApp.utils.escapeJsSingle = function escapeJsSingle(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/</g, '\\x3C')
        .replace(/>/g, '\\x3E');
};

window.AdminApp.utils.normalizeThumbUrl = function normalizeThumbUrl(url) {
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
};

window.AdminApp.auth.getAdminSessionToken = function getAdminSessionToken() {
    return localStorage.getItem(window.AdminConfig.sessionKey) || '';
};

window.AdminApp.auth.clearAdminSession = function clearAdminSession() {
    localStorage.removeItem(window.AdminConfig.sessionKey);
    localStorage.removeItem('adminPin');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminNama');
};

window.AdminApp.auth.isAuthError = function isAuthError(result) {
    const message = (result && result.message ? result.message : '').toLowerCase();
    return result && result.status === 'error' && (
        message.includes('sesi login') ||
        message.includes('login kembali') ||
        message.includes('akses ditolak')
    );
};

window.AdminApp.auth.handleAdminAuthFailure = function handleAdminAuthFailure(message) {
    window.AdminApp.auth.clearAdminSession();
    alert(message || 'Sesi login berakhir. Silakan login kembali.');
    location.reload();
};

window.AdminApp.auth.adminGet = async function adminGet(action, extraParams = {}) {
    const connector = window.GAS_URL.includes('?') ? '&' : '?';
    const params = new URLSearchParams({ action, ...extraParams });
    const token = window.AdminApp.auth.getAdminSessionToken();
    if (token) params.set('sessionToken', token);

    const res = await fetch(`${window.GAS_URL}${connector}${params.toString()}`);
    const result = await res.json();
    if (window.AdminApp.auth.isAuthError(result)) {
        window.AdminApp.auth.handleAdminAuthFailure(result.message);
        throw new Error(result.message);
    }
    return result;
};

window.AdminApp.auth.adminPost = async function adminPost(payload) {
    const body = { ...payload };
    const token = window.AdminApp.auth.getAdminSessionToken();
    if (token) body.sessionToken = token;

    const res = await fetch(`${window.GAS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const result = await res.json();
    if (window.AdminApp.auth.isAuthError(result)) {
        window.AdminApp.auth.handleAdminAuthFailure(result.message);
        throw new Error(result.message);
    }
    return result;
};

window.AdminApp.auth.doLogin = async function doLogin() {
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
            localStorage.setItem(window.AdminConfig.sessionKey, result.sessionToken);
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
};

window.AdminApp.auth.logout = function logout() {
    const token = window.AdminApp.auth.getAdminSessionToken();
    window.AdminApp.auth.clearAdminSession();

    if (!token) {
        location.reload();
        return;
    }

    fetch(`${window.GAS_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logoutAdmin', sessionToken: token })
    }).finally(() => location.reload());
};

window.AdminApp.ui.toggleSidebar = function toggleSidebar(show) {
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
};

window.AdminApp.ui.switchTab = function switchTab(tabId, el) {
    if (window.innerWidth < 1024) window.AdminApp.ui.toggleSidebar(false);

    document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    el.classList.add('active');

    if (tabId === 'tab-artikel') window.AdminApp.content.loadArtikelListAdmin();
    if (tabId === 'tab-galeri') window.AdminApp.content.loadGaleriListAdmin();
    if (tabId === 'tab-cms') {
        window.AdminApp.cms.loadCMSData();
        window.AdminApp.cms.loadLayananList();
    }
};

window.AdminApp.showLoader = function showLoader(show) {
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.classList.toggle('hidden', !show);
};

window.AdminApp.ui.showLoader = window.AdminApp.showLoader;

window.AdminApp.ui.closeModal = function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
};

window.AdminApp.loadAllData = async function loadAllData() {
    window.AdminApp.showLoader(true);
    try {
        const result = await window.AdminApp.auth.adminGet('getSemuaBooking');
        if (result.status === 'success') {
            window.AdminState.bookings.all = result.data;
            window.AdminState.bookings.currentPage = 1;
            window.AdminApp.bookings.renderTables();
        }
    } catch (e) {
        console.error(e);
    } finally {
        window.AdminApp.showLoader(false);
    }
};

window.escapeHtml = window.AdminApp.utils.escapeHtml;
window.escapeAttr = window.AdminApp.utils.escapeAttr;
window.escapeJsSingle = window.AdminApp.utils.escapeJsSingle;
window.normalizeThumbUrl = window.AdminApp.utils.normalizeThumbUrl;
