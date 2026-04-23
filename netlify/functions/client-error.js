exports.handler = async function(event) {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: 'Method not allowed' })
        };
    }

    let payload = {};
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (e) {}

    console.error('[client-error]', {
        type: payload.type || 'unknown',
        message: String(payload.message || '').slice(0, 500),
        page: String(payload.page || '').slice(0, 300),
        stack: String(payload.stack || '').slice(0, 1200),
        userAgent: String(payload.userAgent || '').slice(0, 300),
        ts: payload.ts || new Date().toISOString()
    });

    return {
        statusCode: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: ''
    };
};
