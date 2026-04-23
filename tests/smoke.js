const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');

function createElement() {
    return {
        tagName: 'DIV',
        value: '',
        checked: false,
        innerHTML: '',
        textContent: '',
        href: '',
        disabled: false,
        dataset: {},
        style: {},
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        setAttribute() {},
        appendChild() {},
        addEventListener() {},
        remove() {},
        focus() {},
        closest() { return null; },
        matches() { return false; },
        getBoundingClientRect() { return { top: 0 }; }
    };
}

function createBrowserContext(overrides = {}) {
    const elements = new Map();
    const selectors = overrides.selectors || {};
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
        querySelector(selector) {
            if (selectors[selector]) return selectors[selector];
            return createElement();
        },
        querySelectorAll() {
            return [];
        },
        createDocumentFragment() {
            return { appendChild() {} };
        },
        createElement,
        addEventListener() {}
    };

    const storage = new Map();
    const window = {
        GAS_URL: '/api/klinik',
        scrollY: 0,
        scrollTo() {},
        addEventListener() {},
        localStorage: {
            getItem(key) { return storage.get(key) || ''; },
            setItem(key, value) { storage.set(key, String(value)); },
            removeItem(key) { storage.delete(key); }
        },
        sessionStorage: {
            getItem(key) { return storage.get(`session:${key}`) || ''; },
            setItem(key, value) { storage.set(`session:${key}`, String(value)); },
            removeItem(key) { storage.delete(`session:${key}`); }
        },
        location: {
            reload() {}
        },
        ...overrides.window
    };

    const context = {
        window,
        document,
        localStorage: window.localStorage,
        sessionStorage: window.sessionStorage,
        location: window.location,
        console,
        setTimeout(fn) {
            if (typeof fn === 'function') fn();
            return 1;
        },
        clearTimeout() {},
        requestAnimationFrame(fn) {
            if (typeof fn === 'function') fn();
        },
        AbortController,
        URLSearchParams,
        Map,
        Set,
        Date,
        Promise,
        Error,
        TypeError,
        Number,
        String,
        Array,
        Boolean,
        encodeURIComponent,
        decodeURIComponent,
        btoa(value) {
            return Buffer.from(value, 'binary').toString('base64');
        },
        atob(value) {
            return Buffer.from(value, 'base64').toString('binary');
        },
        escape,
        unescape,
        alert() {},
        confirm() { return true; },
        ...overrides.context
    };

    window.window = window;
    window.document = document;
    Object.assign(context, window);
    return vm.createContext(context);
}

function runFile(context, relativePath) {
    const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
}

function testSyntaxChecks() {
    [
        'shared/shared.ui.js',
        'shared/error-monitor.js',
        'admin/admin.shared.js',
        'admin/admin.cms.js',
        'admin/admin.content.js',
        'booking/booking.core.js',
        'booking/booking.selection.js',
        'booking/booking.ai.js',
        'booking/booking.submit.js',
        'booking/booking.init.js',
        'status/status.core.js',
        'status/status.search.js',
        'status/status.checkin.js',
        'status/status.review.js',
        'status/status.init.js'
    ].forEach((relativePath) => {
        const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
        new vm.Script(source, { filename: relativePath });
    });
}

function testGasBackendSyntaxIfPresent() {
    const gasFiles = fs.readdirSync(rootDir).filter((fileName) => fileName.endsWith('.gs'));
    gasFiles.forEach((fileName) => {
        const source = fs.readFileSync(path.join(rootDir, fileName), 'utf8');
        new vm.Script(source, { filename: fileName });
    });
}

async function testBookingFlowCompletesWithMockedApi() {
    const genderInput = createElement();
    genderInput.value = 'Pria';
    genderInput.checked = true;

    const terapisInput = createElement();
    terapisInput.value = 'Ahmad';
    terapisInput.checked = true;

    const layananInput = createElement();
    layananInput.value = Buffer.from(unescape(encodeURIComponent('Bekam Sunnah')), 'binary').toString('base64');
    layananInput.checked = true;

    const waktuInput = createElement();
    waktuInput.value = '09:00';
    waktuInput.checked = true;

    const apiCalls = [];
    const context = createBrowserContext({
        selectors: {
            'input[name="gender_terapis"]:checked': genderInput,
            'input[name="pilih_nama_terapis"]:checked': terapisInput,
            'input[name="layanan"]:checked': layananInput,
            'input[name="waktu"]:checked': waktuInput,
            '#step-2 .grid': createElement()
        },
        context: {
            fetch() {
                throw new Error('fetch should not be called directly in booking flow test');
            }
        }
    });

    runFile(context, 'shared/shared.ui.js');

    context.apiGetJson = async (action) => {
        apiCalls.push({ type: 'get', action });
        if (action === 'getInitData') {
            return {
                status: 'success',
                data: {
                    terapis: [{ nama: 'Ahmad', gender: 'Laki-laki' }],
                    layanan: [{ nama: 'Bekam Sunnah', hariAktif: [], terapisKhusus: [] }]
                }
            };
        }
        return { status: 'success', data: [] };
    };
    context.apiRequestJson = async (url) => {
        apiCalls.push({ type: 'request', url });
        return { status: 'success', data: ['09:00'] };
    };
    context.apiPostJson = async (action, payload) => {
        apiCalls.push({ type: 'post', action, payload });
        return { status: 'success', data: { whatsappUrl: 'https://wa.me/6281234567890' } };
    };

    context.window.apiGetJson = context.apiGetJson;
    context.window.apiRequestJson = context.apiRequestJson;
    context.window.apiPostJson = context.apiPostJson;

    runFile(context, 'booking/booking.core.js');
    runFile(context, 'booking/booking.selection.js');
    runFile(context, 'booking/booking.ai.js');
    runFile(context, 'booking/booking.submit.js');
    runFile(context, 'booking/booking.init.js');

    context.document.getElementById('tanggal').value = '2026-05-01';
    context.document.getElementById('nama').value = 'Pasien Test';
    context.document.getElementById('whatsapp').value = '081234567890';
    context.document.getElementById('usia').value = '35';
    context.document.getElementById('keluhan').value = 'Pegal';

    await context.initBooking();
    context.onGenderSelected();
    context.selectSpecificTerapis('Ahmad');
    context.onLayananSelectedSafe(layananInput.value);
    await context.checkAvailability();
    await context.handleBookingSubmit({ preventDefault() {} });

    const submitCall = apiCalls.find((call) => call.type === 'post' && call.action === 'simpanBookingData');
    assert.ok(submitCall, 'booking submit API should be called');
    assert.strictEqual(submitCall.payload.nama, 'Pasien Test');
    assert.strictEqual(submitCall.payload.terapis, 'Ahmad');
    assert.strictEqual(submitCall.payload.sesiBekam, 'Bekam Sunnah');
    assert.strictEqual(context.document.getElementById('success-screen').style.display, 'block');
    assert.strictEqual(context.document.getElementById('bookingForm').style.display, 'none');
}

async function testAdminRequestsUseSharedHelpers() {
    const calls = [];
    const context = createBrowserContext({
        context: {
            apiGetJson(action, params, options) {
                calls.push({ type: 'get', action, params, options });
                return Promise.resolve({ status: 'success', data: [] });
            },
            apiPostJson(action, payload, options) {
                calls.push({ type: 'post', action, payload, options });
                return Promise.resolve({ status: 'success' });
            }
        }
    });

    context.localStorage.setItem('adminSessionToken', 'SESSION-123');
    runFile(context, 'admin/admin.shared.js');

    await context.window.AdminApp.auth.adminGet('getSemuaBooking', { page: 1 });
    await context.window.AdminApp.auth.adminPost({ action: 'saveLayananList', layananData: [] });

    assert.strictEqual(calls[0].type, 'get');
    assert.strictEqual(calls[0].action, 'getSemuaBooking');
    assert.strictEqual(calls[0].params.sessionToken, 'SESSION-123');
    assert.strictEqual(calls[0].options.timeoutMs, 20000);

    assert.strictEqual(calls[1].type, 'post');
    assert.strictEqual(calls[1].action, 'saveLayananList');
    assert.strictEqual(calls[1].payload.sessionToken, 'SESSION-123');
    assert.strictEqual(calls[1].options.retries, 1);
}

function testBookingStateBuildsIndexes() {
    const context = createBrowserContext();
    runFile(context, 'booking/booking.core.js');

    context.window.BookingState.allTerapis = [
        { nama: 'Ahmad', gender: 'Laki-laki' },
        { nama: 'Siti', gender: 'Perempuan' }
    ];
    context.window.BookingState.allLayanan = [
        { nama: 'Bekam Sunnah' },
        { nama: 'Ruqyah Khusus', terapisKhusus: ['Ahmad'] }
    ];

    context.buildBookingIndexes();

    const state = context.window.BookingState;
    assert.strictEqual(state.layananByNama.get('bekam sunnah').nama, 'Bekam Sunnah');
    assert.strictEqual(state.layananByTerapisName.get('ahmad').length, 2);
    assert.strictEqual(state.layananByTerapisName.get('siti').length, 1);
    assert.strictEqual(state.namaTerapisKhususSet.has('ahmad'), true);
}

(async () => {
    testSyntaxChecks();
    testGasBackendSyntaxIfPresent();
    await testAdminRequestsUseSharedHelpers();
    testBookingStateBuildsIndexes();
    await testBookingFlowCompletesWithMockedApi();
    console.log('Smoke tests passed');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
