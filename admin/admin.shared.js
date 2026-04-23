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
        byRow: {},
        version: 0,
        filtered: [],
        currentPage: 1,
        searchQuery: '',
        searchDebounce: null,
        loadPromise: null
    },
    cms: {
        settingsCache: {},
        layanan: [],
        hasLoadedSettings: false,
        hasLoadedLayanan: false,
        settingsPromise: null,
        layananPromise: null
    },
    content: {
        artikel: [],
        galeri: [],
        hasLoadedArtikel: false,
        hasLoadedGaleri: false,
        artikelPromise: null,
        galeriPromise: null
    },
    reports: {
        filterStart: '',
        filterEnd: '',
        lastRenderedVersion: -1,
        lastRenderedKey: ''
    },
    ui: {
        bindingsBound: false
    }
};

window.AdminApp = window.AdminApp || {
    auth: {},
    ui: {},
    utils: {},
    bookings: {},
    reports: {},
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

window.AdminApp.utils.shortDateFormatter = window.AdminApp.utils.shortDateFormatter || new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short'
});

window.AdminApp.utils.formatShortDate = function formatShortDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return window.AdminApp.utils.shortDateFormatter.format(date);
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
    const params = { ...extraParams };
    const token = window.AdminApp.auth.getAdminSessionToken();
    if (token) params.sessionToken = token;

    const result = await apiGetJson(action, params, { timeoutMs: 20000, retries: 1, retryDelayMs: 500 });
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

    const result = await apiPostJson(body.action, body, { timeoutMs: 20000, retries: 1, retryDelayMs: 500 });
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
        const result = await apiPostJson('authAdmin', { pass }, { timeoutMs: 20000, retries: 1, retryDelayMs: 500 });

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

    apiPostJson('logoutAdmin', { sessionToken: token }, { timeoutMs: 10000, retries: 0 }).finally(() => location.reload());
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

    window.AdminApp.ui.ensureTabData(tabId);
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

window.AdminApp.ui.ensureTabData = function ensureTabData(tabId, options = {}) {
    if (tabId === 'tab-artikel') return window.AdminApp.content.loadArtikelListAdmin(options);
    if (tabId === 'tab-galeri') return window.AdminApp.content.loadGaleriListAdmin(options);
    if (tabId === 'tab-laporan') return window.AdminApp.reports.loadSummary(options);
    if (tabId === 'tab-cms') {
        return Promise.all([
            window.AdminApp.cms.loadCMSData(options),
            window.AdminApp.cms.loadLayananList(options)
        ]);
    }
    return Promise.resolve();
};

window.AdminApp.loadAllData = async function loadAllData() {
    if (window.AdminState.bookings.loadPromise) {
        return window.AdminState.bookings.loadPromise;
    }

    window.AdminApp.ui.showLoader(true);
    const loadPromise = (async () => {
        try {
            const result = await window.AdminApp.auth.adminGet('getSemuaBooking');
            if (result.status === 'success') {
                const allBookings = Array.isArray(result.data) ? result.data : [];
                window.AdminState.bookings.all = allBookings;
                window.AdminState.bookings.byRow = allBookings.reduce((acc, booking) => {
                    const rowKey = Number(booking.row) || 0;
                    if (rowKey) acc[rowKey] = booking;
                    return acc;
                }, {});
                window.AdminState.bookings.version = (window.AdminState.bookings.version || 0) + 1;
                window.AdminState.bookings.currentPage = 1;
                window.AdminApp.bookings.renderTables();
                const reportTab = document.getElementById('tab-laporan');
                if (reportTab && !reportTab.classList.contains('hidden') && window.AdminApp.reports?.loadSummary) {
                    window.AdminApp.reports.loadSummary({ force: true });
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            window.AdminState.bookings.loadPromise = null;
            window.AdminApp.ui.showLoader(false);
        }
    })();

    window.AdminState.bookings.loadPromise = loadPromise;
    return loadPromise;
};
