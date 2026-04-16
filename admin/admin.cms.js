/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin CMS
 * ================================================
 */

window.AdminApp.cms.getClinicCheckinPayload = function getClinicCheckinPayload(secretCode) {
    return `RSDS-CLINIC|${secretCode}`;
};

window.AdminApp.cms.renderClinicCheckinQr = function renderClinicCheckinQr(secretCode) {
    const img = document.getElementById('clinicQrImage');
    const text = document.getElementById('clinicQrCodeText');
    const printImg = document.getElementById('printClinicQrImage');
    const printText = document.getElementById('printClinicQrCodeText');
    if (!img || !text) return;

    if (!secretCode) {
        img.removeAttribute('src');
        text.textContent = 'Kode check-in belum diatur di CMS.';
        if (printImg) printImg.removeAttribute('src');
        if (printText) printText.textContent = 'Kode check-in belum diatur di CMS.';
        return;
    }

    const payload = window.AdminApp.cms.getClinicCheckinPayload(secretCode);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=${encodeURIComponent(payload)}`;

    img.src = qrUrl;
    text.textContent = payload;

    if (printImg) printImg.src = qrUrl;
    if (printText) printText.textContent = payload;
};

window.AdminApp.cms.copyClinicQrCode = async function copyClinicQrCode() {
    const secretCode = window.AdminState.cms.settingsCache.cms_checkin_secret_code || '';
    if (!secretCode) {
        alert('Kode QR check-in belum tersedia.');
        return;
    }

    try {
        await navigator.clipboard.writeText(window.AdminApp.cms.getClinicCheckinPayload(secretCode));
        alert('Kode QR check-in berhasil disalin.');
    } catch (e) {
        alert('Gagal menyalin kode QR.');
    }
};

window.AdminApp.cms.printClinicQrPoster = function printClinicQrPoster() {
    const secretCode = window.AdminState.cms.settingsCache.cms_checkin_secret_code || '';
    if (!secretCode) {
        alert('Kode QR check-in belum tersedia.');
        return;
    }

    window.print();
};

window.AdminApp.cms.loadCMSData = async function loadCMSData(options = {}) {
    const force = Boolean(options.force);
    if (!force && window.AdminState.cms.hasLoadedSettings) {
        const data = window.AdminState.cms.settingsCache || {};
        window.AdminApp.cms.renderClinicCheckinQr(data.cms_checkin_secret_code || '');
        Object.keys(data).forEach((key) => {
            const el = document.getElementById(key);
            if (el) el.value = data[key];
        });
        return data;
    }

    if (!force && window.AdminState.cms.settingsPromise) {
        return window.AdminState.cms.settingsPromise;
    }

    const loadPromise = (async () => {
        try {
            const connector = window.GAS_URL.includes('?') ? '&' : '?';
            const res = await fetch(`${window.GAS_URL}${connector}action=getLandingSettings`);
            const result = await res.json();

            if (result.status === 'success') {
                const data = result.data || {};
                window.AdminState.cms.settingsCache = data;
                window.AdminState.cms.hasLoadedSettings = true;
                window.AdminApp.cms.renderClinicCheckinQr(window.AdminState.cms.settingsCache.cms_checkin_secret_code || '');

                Object.keys(data).forEach((key) => {
                    const el = document.getElementById(key);
                    if (el) el.value = data[key];
                });

                return data;
            }
        } catch (e) {
            console.error('Gagal load CMS:', e);
        } finally {
            window.AdminState.cms.settingsPromise = null;
        }
        return window.AdminState.cms.settingsCache;
    })();

    window.AdminState.cms.settingsPromise = loadPromise;
    return loadPromise;
};

window.AdminApp.cms.saveCMS = async function saveCMS() {
    const btn = document.getElementById('btnSaveCMS');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sinkronkan...';
    btn.disabled = true;

    const updatedData = {};
    const inputs = document.querySelectorAll('#tab-cms input, #tab-cms textarea');
    inputs.forEach((input) => {
        if (input.id && input.id.startsWith('cms_')) {
            updatedData[input.id] = input.value;
        }
    });

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'updateLandingSettings', updatedData });
        if (result.status === 'success') {
            window.AdminState.cms.settingsCache = {
                ...window.AdminState.cms.settingsCache,
                ...updatedData
            };
            window.AdminState.cms.hasLoadedSettings = true;
            window.AdminApp.cms.renderClinicCheckinQr(window.AdminState.cms.settingsCache.cms_checkin_secret_code || '');
            alert('Web berhasil disinkronkan (cache dibersihkan).');
        } else {
            alert(`Gagal: ${result.message}`);
        }
    } catch (e) {
        alert('Error koneksi ke server.');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};

window.AdminApp.cms.loadLayananList = async function loadLayananList(options = {}) {
    const force = Boolean(options.force);
    if (!force && window.AdminState.cms.hasLoadedLayanan) {
        window.AdminApp.cms.renderLayananList();
        return window.AdminState.cms.layanan;
    }

    if (!force && window.AdminState.cms.layananPromise) {
        return window.AdminState.cms.layananPromise;
    }

    const loadPromise = (async () => {
        try {
            const connector = window.GAS_URL.includes('?') ? '&' : '?';
            const res = await fetch(`${window.GAS_URL}${connector}action=getLayananList`);
            const result = await res.json();

            if (result.status === 'success') {
                window.AdminState.cms.layanan = result.data || [];
                window.AdminState.cms.hasLoadedLayanan = true;
                window.AdminApp.cms.renderLayananList();
            }
        } catch (e) {
        } finally {
            window.AdminState.cms.layananPromise = null;
        }
        return window.AdminState.cms.layanan;
    })();

    window.AdminState.cms.layananPromise = loadPromise;
    return loadPromise;
};

window.AdminApp.cms.renderLayananList = function renderLayananList() {
    const container = document.getElementById('layananList');
    container.innerHTML = window.AdminState.cms.layanan.map((layanan, idx) => `
        <div class="bg-white/60 border border-white rounded-[1.5rem] p-5 shadow-sm relative group">
            <button data-action="delete-layanan-row" data-idx="${idx}" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>
            <div class="grid md:grid-cols-12 gap-6">
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nama, Icon & Warna</label>
                    <input type="text" class="cms-input !py-3" id="lay_nama_${idx}" value="${window.AdminApp.utils.escapeAttr(layanan.nama)}" placeholder="Cth: Bekam Sunnah">
                    <div class="flex gap-2">
                        <input type="text" class="cms-input !py-3 flex-1" id="lay_icon_${idx}" value="${window.AdminApp.utils.escapeAttr(layanan.icon)}" placeholder="Cth: fas fa-leaf">
                        <select id="lay_warna_${idx}" class="cms-input !py-3 !text-xs w-24">
                            ${['emerald', 'teal', 'cyan', 'blue', 'violet', 'amber'].map((warna) => `<option value="${warna}" ${layanan.warna === warna ? 'selected' : ''}>${warna}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-4 pt-1">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="lay_terlaris_${idx}" ${layanan.terlaris ? 'checked' : ''} class="w-4 h-4 accent-emerald-500">
                            <span class="text-[10px] font-bold text-slate-600">Terlaris</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="lay_lintas_${idx}" ${layanan.lintas_gender ? 'checked' : ''} class="w-4 h-4 accent-teal-500">
                            <span class="text-[10px] font-bold text-slate-600">Lintas Gender</span>
                        </label>
                    </div>
                </div>
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aturan Booking (Jadwal & Terapis)</label>
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_hari_${idx}" value="${window.AdminApp.utils.escapeAttr(layanan.hari_aktif || '')}" placeholder="Hari Aktif (0-6, Pisah Koma)">
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_terapis_${idx}" value="${window.AdminApp.utils.escapeAttr(layanan.terapis_khusus || '')}" placeholder="Terapis Khusus (Pisah Koma)">
                    <input type="text" class="cms-input !py-3 !text-[10px]" id="lay_foto_${idx}" value="${window.AdminApp.utils.escapeAttr(layanan.foto || '')}" placeholder="Link Foto (Opsional)">
                </div>
                <div class="md:col-span-4 space-y-3">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deskripsi & Detail Web</label>
                    <textarea class="cms-input !py-3 !text-xs" id="lay_desc_${idx}" rows="2" placeholder="Penjelasan singkat">${window.AdminApp.utils.escapeHtml(layanan.deskripsi)}</textarea>
                    <textarea class="cms-input !py-3 !text-xs" id="lay_detail_${idx}" rows="2" placeholder="Item detail (pisah koma)">${window.AdminApp.utils.escapeHtml(layanan.detail)}</textarea>
                </div>
            </div>
        </div>
    `).join('');
};

window.AdminApp.cms.addLayananRow = function addLayananRow() {
    window.AdminState.cms.layanan.push({
        nama: '',
        deskripsi: '',
        detail: '',
        icon: 'fas fa-leaf',
        foto: '',
        terlaris: false,
        warna: 'emerald',
        hari_aktif: '',
        terapis_khusus: ''
    });
    window.AdminApp.cms.renderLayananList();
};

window.AdminApp.cms.deleteLayananRow = function deleteLayananRow(idx) {
    if (!confirm('Hapus layanan ini?')) return;
    window.AdminState.cms.layanan.splice(idx, 1);
    window.AdminApp.cms.renderLayananList();
};

window.AdminApp.cms.saveLayanan = async function saveLayanan() {
    const btn = document.getElementById('btnSaveLayanan');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const dataToSave = window.AdminState.cms.layanan.map((_, idx) => ({
        nama: document.getElementById(`lay_nama_${idx}`).value,
        icon: document.getElementById(`lay_icon_${idx}`).value,
        deskripsi: document.getElementById(`lay_desc_${idx}`).value,
        detail: document.getElementById(`lay_detail_${idx}`).value,
        foto: document.getElementById(`lay_foto_${idx}`).value,
        terlaris: document.getElementById(`lay_terlaris_${idx}`).checked,
        warna: document.getElementById(`lay_warna_${idx}`).value,
        hari_aktif: document.getElementById(`lay_hari_${idx}`).value,
        terapis_khusus: document.getElementById(`lay_terapis_${idx}`).value,
        lintas_gender: document.getElementById(`lay_lintas_${idx}`).checked
    }));

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'saveLayananList', layananData: dataToSave });
        if (result.status === 'success') {
            alert('Daftar layanan berhasil diperbarui.');
            window.AdminState.cms.hasLoadedLayanan = false;
            window.AdminApp.cms.loadLayananList({ force: true });
        } else {
            alert(`Gagal simpan layanan: ${result.message}`);
        }
    } catch (e) {
        alert('Error koneksi saat simpan layanan.');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};
