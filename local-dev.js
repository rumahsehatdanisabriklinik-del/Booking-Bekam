/**
 * ============================================================
 *  LOCAL DEV SERVER — Rumah Sehat Dani Sabri
 * ============================================================
 *  Meniru behavior Vercel/Netlify saat development lokal:
 *  - Serve file HTML, CSS, JS sebagai static files
 *  - Proxy /api/klinik → Google Apps Script (dengan token)
 *  - Mengikuti redirect 302 dari GAS otomatis
 *
 *  Cara pakai:
 *    node local-dev.js
 *    atau: npm run dev
 *  
 *  Lalu buka: http://localhost:3000
 * ============================================================
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

// --- Baca .env secara manual (tanpa library dotenv) ---
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.error('[ERROR] File .env tidak ditemukan!');
        process.exit(1);
    }
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        const clean = line.replace(/\r/g, '').trim();
        if (!clean || clean.startsWith('#')) return;
        const eqIdx = clean.indexOf('=');
        if (eqIdx === -1) return;
        const key = clean.slice(0, eqIdx).trim();
        const val = clean.slice(eqIdx + 1).trim();
        if (key) process.env[key] = val;
    });
}
loadEnv();

const GAS_URL   = process.env.GAS_URL;
const APP_TOKEN = process.env.APP_TOKEN;
const PORT      = process.env.PORT || 3000;
const LOCAL_BASE_URL = `http://localhost:${PORT}`;

if (!GAS_URL || !APP_TOKEN) {
    console.error('[ERROR] GAS_URL atau APP_TOKEN tidak ada di .env!');
    process.exit(1);
}

// --- MIME Types ---
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
    '.gif':  'image/gif',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
};

// --- FETCH dengan FOLLOW REDIRECT (max 10 kali) ---
function fetchWithRedirect(fetchUrl, options, body, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 10) {
            return reject(new Error('Too many redirects'));
        }

        const parsedUrl = new URL(fetchUrl);
        const lib = parsedUrl.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path:     parsedUrl.pathname + parsedUrl.search,
            method:   options.method || 'GET',
            headers:  options.headers || {},
        };

        const req = lib.request(reqOptions, res => {
            // Google Apps Script redirect 302 → ikuti
            if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && res.headers.location) {
                const newUrl = res.headers.location;
                console.log(`[PROXY] Redirect ${res.statusCode} → ${newUrl}`);
                // Setelah redirect, gunakan GET (standar browser behavior)
                return resolve(fetchWithRedirect(newUrl, { method: 'GET', headers: {} }, null, redirectCount + 1));
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
            });
        });

        req.on('error', reject);

        if (body && (options.method === 'POST' || options.method === 'PUT')) {
            req.write(body);
        }
        req.end();
    });
}

function canonicalizeParams(params) {
    const ignored = { token: true, ts: true, nonce: true, sig: true };
    const keys = Object.keys(params || {}).filter((k) => !ignored[k]).sort();
    return keys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key] ?? ''))}`).join('&');
}

function buildRequestSignature(secret, method, params, bodyString) {
    const ts = Date.now().toString();
    const nonce = crypto.randomBytes(8).toString('hex');
    const canonicalQuery = canonicalizeParams(params);
    const base = [ts, nonce, String(method || 'GET').toUpperCase(), canonicalQuery, bodyString || ''].join('\n');
    const sig = crypto.createHmac('sha256', secret).update(base).digest('hex');
    return { ts, nonce, sig };
}

function buildClientKey(req) {
    const xfwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = xfwd || req.socket.remoteAddress || 'local';
    const ua = String(req.headers['user-agent'] || 'ua');
    return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 24);
}

// --- PROXY ke GAS ---
async function proxyToGAS(req, res) {
    const parsedReq = new URL(req.url, LOCAL_BASE_URL);
    const queryOrig = Object.fromEntries(parsedReq.searchParams.entries());

    const forwardedParams = {};
    Object.entries(queryOrig).forEach(([k, v]) => {
        if (['token', 'ts', 'nonce', 'sig'].includes(k)) return;
        forwardedParams[k] = v;
    });

    const action = forwardedParams.action || '(POST/no-action)';
    console.log(`[PROXY] ${req.method} action=${action}`);

    // Kumpulkan body jika POST
    let bodyData = '';
    await new Promise(r => {
        req.on('data', chunk => { bodyData += chunk; });
        req.on('end', r);
    });

    forwardedParams.clientKey = buildClientKey(req);
    const signature = buildRequestSignature(APP_TOKEN, req.method, forwardedParams, bodyData || '');
    const gasUrlObj = new URL(GAS_URL);
    Object.entries(forwardedParams).forEach(([k, v]) => gasUrlObj.searchParams.set(k, v));
    gasUrlObj.searchParams.set('ts', signature.ts);
    gasUrlObj.searchParams.set('nonce', signature.nonce);
    gasUrlObj.searchParams.set('sig', signature.sig);
    const finalUrl = gasUrlObj.toString();

    try {
        const gasResp = await fetchWithRedirect(
            finalUrl,
            {
                method: req.method,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            },
            bodyData || null
        );

        const contentType = gasResp.headers['content-type'] || '';
        if (!contentType.includes('json')) {
            console.error('[PROXY] GAS tidak kirim JSON! Preview:', gasResp.body.substring(0, 200));
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(gasResp.body);
        console.log(`[PROXY] ✅ OK action=${action} (${gasResp.body.length} bytes)`);

    } catch (err) {
        console.error('[PROXY ERROR]', err.message);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(502);
        res.end(JSON.stringify({
            status: 'error',
            message: 'Gagal koneksi ke GAS: ' + err.message
        }));
    }
}

// --- SERVE STATIC FILE ---
function serveStatic(req, res) {
    const parsedReq = new URL(req.url, LOCAL_BASE_URL);
    const safePathname = decodeURIComponent(parsedReq.pathname || '/');
    let filePath = path.normalize(path.join(__dirname, safePathname));

    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('403 Forbidden');
        return;
    }

    // Default ke index.html jika akses root
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found: ' + path.basename(filePath));
            } else {
                res.writeHead(500);
                res.end('500 Server Error: ' + err.message);
            }
        } else {
            res.writeHead(200, { 'Content-Type': mime });
            res.end(content);
        }
    });
}

// --- SERVER UTAMA ---
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, LOCAL_BASE_URL);
    const pathname  = parsedUrl.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204);
        res.end();
        return;
    }

    // Route /api/klinik → proxy ke GAS
    if (pathname === '/api/klinik') {
        proxyToGAS(req, res).catch(err => {
            console.error('[SERVER ERROR]', err);
            res.writeHead(500);
            res.end(JSON.stringify({ status: 'error', message: err.message }));
        });
        return;
    }

    if (pathname === '/api/client-error') {
        let bodyData = '';
        req.on('data', chunk => { bodyData += chunk; });
        req.on('end', () => {
            console.error('[client-error]', bodyData.substring(0, 2000));
            res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
            res.end();
        });
        return;
    }

    // Semua lainnya → static file
    serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🌿  RUMAH SEHAT DANI SABRI — Local Dev Server  ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║   🌍  http://localhost:${PORT}                       ║`);
    console.log(`║   🔗  Proxy: /api/klinik → GAS (follow redirect) ║`);
    console.log('║   ⛔  Tekan Ctrl+C untuk berhenti                ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log('Halaman tersedia:');
    console.log(`  http://localhost:${PORT}/              → index.html`);
    console.log(`  http://localhost:${PORT}/booking.html  → Booking`);
    console.log(`  http://localhost:${PORT}/admin.html    → Admin`);
    console.log(`  http://localhost:${PORT}/status.html   → Status`);
    console.log(`  http://localhost:${PORT}/artikel.html  → Artikel`);
    console.log(`  http://localhost:${PORT}/galeri.html   → Galeri`);
    console.log('');
});
