export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ status: 'error', message: 'Method not allowed' });
        return;
    }

    const payload = typeof req.body === 'object' && req.body ? req.body : {};
    console.error('[client-error]', {
        type: payload.type || 'unknown',
        message: String(payload.message || '').slice(0, 500),
        page: String(payload.page || '').slice(0, 300),
        stack: String(payload.stack || '').slice(0, 1200),
        userAgent: String(payload.userAgent || '').slice(0, 300),
        ts: payload.ts || new Date().toISOString()
    });

    res.status(204).end();
}
