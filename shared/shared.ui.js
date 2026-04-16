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

function normalizeDriveImageUrl(logoUrl) {
    if (!logoUrl || !logoUrl.includes('drive.google.com/uc')) return logoUrl;
    try {
        const fileId = logoUrl.split('id=')[1].split('&')[0];
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    } catch (e) {
        return logoUrl;
    }
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
        const response = await fetch(buildApiUrl('getLandingSettings'));
        const result = await response.json();
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
