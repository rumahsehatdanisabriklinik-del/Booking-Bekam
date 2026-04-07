exports.handler = async function(event, context) {
    // A. Handle CORS Preflight (OPTIONS)
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Max-Age": "86400"
            },
            body: ""
        };
    }

    // 1. Ambil Kredensial Asli dari Environment Variables Netlify (Tersembunyi)
    const GAS_URL = process.env.GAS_URL;
    const APP_TOKEN = process.env.APP_TOKEN;

    // Proteksi Internal Mencegah Lupa Setup
    if (!GAS_URL || !APP_TOKEN) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
            body: JSON.stringify({ status: "error", message: "Server Salah Konfigurasi. Variabel Lingkungan Netlify Belum Disetel." })
        };
    }

    // 2. Rakit URL Rahasia (Injeksi Token secara tertutup di server)
    let fetchUrl = `${GAS_URL}?token=${APP_TOKEN}`;

    // 3. Teruskan Parameter Query dari GitHub (misal: ?action=getInitData)
    if (event.queryStringParameters) {
        for (const key in event.queryStringParameters) {
            // Cegah ada token palsu yang dikirim oleh pihak luar
            if (key !== "token") {
                fetchUrl += `&${key}=${encodeURIComponent(event.queryStringParameters[key])}`;
            }
        }
    }

    const fetchOptions = {
        method: event.httpMethod,
    };

    // Apabila ini perintah POST (seperti Menyimpan Booking)
    if (event.httpMethod === "POST" && event.body) {
        fetchOptions.body = event.body;
        // Opsional Header (Beberapa GAS membutuhkan tipe JSON)
        fetchOptions.headers = {
            "Content-Type": "application/json"
        };
    }

    try {
        // 4. Lakukan pemanggilan rahasia ke Google Apps Script tanpa diketahui Client
        const response = await fetch(fetchUrl, fetchOptions);
        
        // 5. Kembalikan data aslinya (JSON) dari Google ke Frontend GitHub
        if (response.headers.get("content-type") && response.headers.get("content-type").includes("json")) {
           const data = await response.json();
           return {
               statusCode: 200,
               headers: {
                   "Access-Control-Allow-Origin": "*", // Sangat penting agar domain GitHub tidak diblokir!
                   "Access-Control-Allow-Headers": "Content-Type",
                   "Content-Type": "application/json"
               },
               body: JSON.stringify(data)
           };
        } else {
           const text = await response.text();
           return {
               statusCode: 502,
               headers: { "Access-Control-Allow-Origin": "*" },
               body: JSON.stringify({ status: "error", message: "Google memberikan respons tidak valid (Bukan JSON)", details: text.substring(0, 500) })
           };
        }
    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "error", message: "Gagal menyambung ke Database Google: " + err.message })
        };
    }
};
