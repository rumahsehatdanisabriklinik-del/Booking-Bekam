(function initErrorMonitor() {
    const endpoint = window.ERROR_REPORT_URL || '/api/client-error';
    const maxMessageLength = 500;

    function safeTrim(value, maxLength) {
        return String(value || '').slice(0, maxLength);
    }

    function buildPayload(type, error) {
        const err = error && error.reason ? error.reason : error;
        return {
            type,
            message: safeTrim(err && err.message ? err.message : err, maxMessageLength),
            stack: safeTrim(err && err.stack ? err.stack : '', 1200),
            page: safeTrim(location.pathname + location.search, 300),
            userAgent: safeTrim(navigator.userAgent, 300),
            ts: new Date().toISOString()
        };
    }

    function report(type, error) {
        try {
            const body = JSON.stringify(buildPayload(type, error));
            if (navigator.sendBeacon) {
                const ok = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
                if (ok) return;
            }
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true
            }).catch(() => {});
        } catch (e) {}
    }

    window.addEventListener('error', (event) => report('error', event.error || event.message));
    window.addEventListener('unhandledrejection', (event) => report('unhandledrejection', event));
})();
