function showCustomToast(msg, type = 'error') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const icon = isSuccess
        ? '<i class="fas fa-check-circle text-emerald-500 text-lg"></i>'
        : '<i class="fas fa-exclamation-circle text-red-500 text-lg"></i>';
    const bgClass = isSuccess
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
        : 'bg-red-50 border-red-200 text-red-900';

    toast.className = `flex items-center gap-3 px-5 py-4 rounded-2xl border-2 shadow-xl shadow-slate-200/50 transform translate-x-[120%] transition-transform duration-500 ease-out font-bold text-sm pointer-events-auto ${bgClass}`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-[120%]');
        toast.classList.add('translate-x-0');
    });

    setTimeout(() => {
        toast.classList.remove('translate-x-0');
        toast.classList.add('translate-x-[120%]');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function getApiConnector() {
    return window.GAS_URL.includes('?') ? '&' : '?';
}

function buildApiUrl(action, params) {
    const connector = getApiConnector();
    const base = `${window.GAS_URL}${connector}action=${encodeURIComponent(action)}`;
    if (!params) return base;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        searchParams.append(key, value);
    });

    const query = searchParams.toString();
    return query ? `${base}&${query}` : base;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createApiError(message, status, details) {
    const err = new Error(message || 'Permintaan gagal');
    if (status) err.status = status;
    if (details !== undefined) err.details = details;
    return err;
}

async function apiRequestJson(url, options) {
    const settings = options || {};
    const method = (settings.method || 'GET').toUpperCase();
    const timeoutMs = Number.isFinite(settings.timeoutMs) ? settings.timeoutMs : 15000;
    const retries = Number.isFinite(settings.retries) ? settings.retries : 1;
    const retryDelayMs = Number.isFinite(settings.retryDelayMs) ? settings.retryDelayMs : 400;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const externalSignal = settings.signal;
        let unlinkExternalAbort = null;

        if (externalSignal) {
            if (externalSignal.aborted) {
                clearTimeout(timer);
                throw externalSignal.reason || createApiError('Permintaan dibatalkan.', 499);
            }
            const forwardAbort = () => controller.abort();
            externalSignal.addEventListener('abort', forwardAbort, { once: true });
            unlinkExternalAbort = () => externalSignal.removeEventListener('abort', forwardAbort);
        }
        try {
            const response = await fetch(url, {
                method,
                headers: settings.headers || {},
                body: settings.body,
                signal: controller.signal
            });

            const text = await response.text();
            let parsed = null;
            if (text) {
                try {
                    parsed = JSON.parse(text);
                } catch (parseErr) {
                    throw createApiError('Respon server tidak valid (bukan JSON).', response.status, text);
                }
            }

            if (!response.ok) {
                const message = parsed?.message || `Server error (${response.status})`;
                throw createApiError(message, response.status, parsed);
            }

            return parsed;
        } catch (error) {
            const isAbort = error?.name === 'AbortError';
            const isNetwork = error instanceof TypeError;
            if (isAbort && externalSignal && externalSignal.aborted) {
                throw error;
            }
            const canRetry = attempt < retries && (isAbort || isNetwork || (error?.status >= 500));
            if (canRetry) {
                await delay(retryDelayMs * (attempt + 1));
                continue;
            }

            if (isAbort) {
                throw createApiError('Permintaan ke server timeout. Silakan coba lagi.', 408);
            }
            throw error;
        } finally {
            if (unlinkExternalAbort) unlinkExternalAbort();
            clearTimeout(timer);
        }
    }

    throw createApiError('Permintaan gagal diproses.');
}

function apiGetJson(action, params, options) {
    return apiRequestJson(buildApiUrl(action, params), options);
}

function apiPostJson(action, payload, options) {
    const bodyPayload = payload || {};
    return apiRequestJson(buildApiUrl(action), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...bodyPayload }),
        timeoutMs: options?.timeoutMs,
        retries: options?.retries,
        retryDelayMs: options?.retryDelayMs
    });
}

function normalizeDriveImageUrl(logoUrl) {
    if (!logoUrl || !logoUrl.includes('drive.google.com/uc')) return logoUrl;
    try {
        const fileId = logoUrl.split('id=')[1].split('&')[0];
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    } catch (e) {
        return logoUrl;
    }
}

function sanitizeAssistantHtml(inputHtml) {
    const safeHtml = String(inputHtml || '');
    if (!safeHtml) return '';

    const template = document.createElement('template');
    template.innerHTML = safeHtml;

    const blockedTags = new Set(['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta']);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    const toRemove = [];

    while (walker.nextNode()) {
        const el = walker.currentNode;
        const tagName = (el.tagName || '').toLowerCase();

        if (blockedTags.has(tagName)) {
            toRemove.push(el);
            continue;
        }

        const attrs = Array.from(el.attributes || []);
        attrs.forEach((attr) => {
            const name = attr.name.toLowerCase();
            const value = String(attr.value || '').trim().toLowerCase();
            if (name.startsWith('on')) {
                el.removeAttribute(attr.name);
                return;
            }
            if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
                return;
            }
            if (name === 'style') {
                el.removeAttribute(attr.name);
            }
        });
    }

    toRemove.forEach((el) => el.remove());
    return template.innerHTML;
}

function renderSafeAssistantMarkdown(markdownText) {
    const text = String(markdownText || '');
    try {
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            return sanitizeAssistantHtml(marked.parse(text));
        }
    } catch (e) {}
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escaped.replace(/\n/g, '<br>');
}

async function syncLandingBranding(options) {
    if (typeof window.GAS_URL === 'undefined') return null;

    const settings = options || {};
    const navNameId = settings.navNameId || 'cms-nama-klinik-nav';
    const footerNameId = settings.footerNameId || 'cms-nama-klinik-footer';
    const addressId = settings.addressId || 'cms-alamat';
    const footerDescId = settings.footerDescId || 'cms-footer-deskripsi';
    const instagramId = settings.instagramId || 'cms-instagram';
    const facebookId = settings.facebookId || 'cms-facebook';
    const navLogoId = settings.navLogoId || 'cms-logo-nav-container';
    const footerLogoId = settings.footerLogoId || 'cms-logo-footer-container';
    const titleSuffix = settings.titleSuffix || '';

    try {
        const result = await apiGetJson('getLandingSettings', null, { timeoutMs: 12000, retries: 1 });
        if (result.status !== 'success') return null;

        const data = result.data || {};
        const navName = document.getElementById(navNameId);
        const footerName = document.getElementById(footerNameId);
        const address = document.getElementById(addressId);
        const footerDesc = document.getElementById(footerDescId);
        const instagram = document.getElementById(instagramId);
        const facebook = document.getElementById(facebookId);
        const navLogo = document.getElementById(navLogoId);
        const footerLogo = document.getElementById(footerLogoId);

        if (data.cms_nama_klinik) {
            if (navName) navName.textContent = data.cms_nama_klinik;
            if (footerName) footerName.textContent = data.cms_nama_klinik;
            if (titleSuffix) document.title = `${data.cms_nama_klinik} | ${titleSuffix}`;
        }

        if (data.cms_alamat && address) address.textContent = data.cms_alamat;
        if (data.cms_footer_deskripsi && footerDesc) footerDesc.textContent = data.cms_footer_deskripsi;
        if (data.cms_instagram && instagram) instagram.href = data.cms_instagram;
        if (data.cms_facebook && facebook) facebook.href = data.cms_facebook;

        if (data.cms_logo_image && data.cms_logo_image.trim() !== "") {
            const logoUrl = normalizeDriveImageUrl(data.cms_logo_image);
            if (navLogo) navLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full object-contain rounded-xl shadow-sm">`;
            if (footerLogo) footerLogo.innerHTML = `<img src="${logoUrl}" class="w-full h-full object-contain rounded-xl shadow-sm">`;
        }

        return data;
    } catch (e) {
        console.error('Branding sync failed', e);
        return null;
    }
}
