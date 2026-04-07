// Vercel Serverless Function Proxy for Google Apps Script
// api/klinik.js

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

    // 2. Ambil Kredensial dari Cloud Dashboard (Vercel Project Settings)
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
        // 3. Rakit URL Rahasia (Selalu sertakan Token secara internal)
        const url = new URL(GAS_URL);
        url.searchParams.append('token', APP_TOKEN);

        // Teruskan Query Parameters dari Frontend (misal action=getInitData)
        Object.keys(req.query).forEach(key => {
            if (key !== 'token') {
                url.searchParams.append(key, req.query[key]);
            }
        });

        const fetchOptions = {
            method: req.method,
        };

        // 4. Handle Body untuk request POST (Menyimpan Booking / Update Status)
        if (req.method === 'POST') {
            fetchOptions.body = JSON.stringify(req.body);
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
