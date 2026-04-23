// Vercel Serverless Function Proxy for Google Apps Script
// api/klinik.js
import crypto from 'node:crypto';

export const config = {
    bodyParser: false
};

function canonicalizeParams(params = {}) {
    const ignored = new Set(['token', 'ts', 'nonce', 'sig']);
    const keys = Object.keys(params).filter((k) => !ignored.has(k)).sort();
    return keys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key] ?? ''))}`).join('&');
}

function buildRequestSignature(secret, method, params, bodyString) {
    const ts = Date.now().toString();
    const nonce = crypto.randomBytes(8).toString('hex');
    const canonicalQuery = canonicalizeParams(params);
    const base = [ts, nonce, method.toUpperCase(), canonicalQuery, bodyString || ''].join('\n');
    const sig = crypto.createHmac('sha256', secret).update(base).digest('hex');
    return { ts, nonce, sig };
}

function buildClientKey(req) {
    const xfwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = xfwd || req.socket?.remoteAddress || 'unknown';
    const ua = String(req.headers['user-agent'] || 'ua');
    return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 24);
}

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        if (typeof req.body === 'string') {
            resolve(req.body);
            return;
        }
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            resolve(JSON.stringify(req.body));
            return;
        }

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

export default async function handler(req, res) {
    // 1. Set CORS Headers (Sangat Penting agar domain frontend bisa baca API)
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    // A. Handle CORS Preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    // 2. Ambil secret dari Cloud Dashboard (Vercel Project Settings)
    const GAS_URL = process.env.GAS_URL;
    const APP_TOKEN = process.env.APP_TOKEN;

    // Proteksi Internal Mencegah Lupa Setup di Vercel Dashboard
    if (!GAS_URL || !APP_TOKEN) {
        return res.status(500).json({ 
            status: "error", 
            message: "Konfigurasi Server Vercel Belum Lengkap. Silakan isi GAS_URL dan APP_TOKEN di Dashboard Vercel." 
        });
    }

    try {
        const forwardedParams = {};
        Object.keys(req.query || {}).forEach((key) => {
            if (['token', 'sig', 'ts', 'nonce'].includes(key)) return;
            const value = req.query[key];
            forwardedParams[key] = Array.isArray(value) ? value[0] : value;
        });

        let bodyString = '';
        if (req.method === 'POST') {
            bodyString = await readRawBody(req);
        }
        forwardedParams.clientKey = buildClientKey(req);

        const signature = buildRequestSignature(APP_TOKEN, req.method, forwardedParams, bodyString);

        // 3. Rakit URL Rahasia dengan signature (tanpa token statis di query)
        const url = new URL(GAS_URL);

        Object.keys(forwardedParams).forEach((key) => {
            url.searchParams.append(key, forwardedParams[key]);
        });
        url.searchParams.append('ts', signature.ts);
        url.searchParams.append('nonce', signature.nonce);
        url.searchParams.append('sig', signature.sig);

        const fetchOptions = {
            method: req.method,
        };

        // 4. Handle Body untuk request POST (Menyimpan Booking / Update Status)
        if (req.method === 'POST') {
            fetchOptions.body = bodyString;
            fetchOptions.headers = {
                'Content-Type': 'application/json'
            };
        }

        // 5. Eksekusi request rahasia ke Google Apps Script tanpa diketahui pihak luar
        const response = await fetch(url.toString(), fetchOptions);
        
        // 6. Kembalikan data aslinya (JSON) dari Google
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            return res.status(200).json(data);
        } else {
            const text = await response.text();
            // Jika ada error HTML dari Google (biasanya error Permission atau URL Salah)
            console.error("GAS Error Response:", text);
            return res.status(502).json({ 
                status: "error", 
                message: "Google memberikan respons tidak valid (Bukan JSON).", 
                details: text.substring(0, 500) 
            });
        }
    } catch (error) {
        console.error("Proxy Error:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Gagal menyambung ke Database Google: " + error.message 
        });
    }
}
