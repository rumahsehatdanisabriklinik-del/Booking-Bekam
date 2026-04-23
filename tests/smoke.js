const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');

function createElement() {
    return {
        value: '',
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
        focus() {},
        closest() { return null; },
        matches() { return false; },
        getBoundingClientRect() { return { top: 0 }; }
    };
}

function createBrowserContext(overrides = {}) {
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
        querySelector() {
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
        location: {
            reload() {}
        },
        ...overrides.window
    };

    const context = {
        window,
        document,
        localStorage: window.localStorage,
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
    await testAdminRequestsUseSharedHelpers();
    testBookingStateBuildsIndexes();
    console.log('Smoke tests passed');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
