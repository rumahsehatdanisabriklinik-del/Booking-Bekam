/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Content
 * ================================================
 */

window.AdminApp.content.loadArtikelListAdmin = async function loadArtikelListAdmin(options = {}) {
    const force = Boolean(options.force);
    if (!force && window.AdminState.content.hasLoadedArtikel) {
        window.AdminApp.content.renderArtikelList();
        return window.AdminState.content.artikel;
    }

    if (!force && window.AdminState.content.artikelPromise) {
        return window.AdminState.content.artikelPromise;
    }

    const loadPromise = (async () => {
        try {
            document.getElementById('artikelList').innerHTML = '<p class="text-slate-400 font-bold text-sm text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat artikel...</p>';
            const result = await window.AdminApp.auth.adminGet('getArtikelListAdmin');

            if (result.status === 'success') {
                window.AdminState.content.artikel = result.data || [];
                window.AdminState.content.hasLoadedArtikel = true;
                window.AdminApp.content.renderArtikelList();
            } else {
                alert(`Gagal memuat artikel: ${result.message}`);
            }
        } catch (e) {
            alert('Error koneksi saat memuat artikel.');
        } finally {
            window.AdminState.content.artikelPromise = null;
        }
        return window.AdminState.content.artikel;
    })();

    window.AdminState.content.artikelPromise = loadPromise;
    return loadPromise;
};

window.AdminApp.content.renderArtikelList = function renderArtikelList() {
    const container = document.getElementById('artikelList');
    if (window.AdminState.content.artikel.length === 0) {
        container.innerHTML = `<div class="col-span-full border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-slate-400">
            <i class="fas fa-newspaper text-5xl mb-4 opacity-20"></i>
            <p class="font-bold">Belum ada artikel. Mulai menulis sekarang!</p>
        </div>`;
        return;
    }

    container.innerHTML = window.AdminState.content.artikel.map((artikel, idx) => {
        const thumb = window.AdminApp.utils.normalizeThumbUrl(artikel.foto);
        const safeStatus = String(artikel.status || 'draft');
        return `
        <div class="group bg-white/70 backdrop-blur-md border border-white rounded-[2rem] p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden">
            <div class="h-32 bg-slate-100 rounded-[1.5rem] overflow-hidden mb-4 relative">
                ${thumb ? `<img src="${window.AdminApp.utils.escapeAttr(thumb)}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fas fa-image text-3xl"></i></div>`}
                <div class="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[8px] font-black uppercase tracking-widest text-indigo-600">${window.AdminApp.utils.escapeHtml(artikel.kategori || 'Umum')}</div>
            </div>
            <h3 class="font-bold text-slate-800 text-sm line-clamp-2 leading-tight mb-4 pr-10">${window.AdminApp.utils.escapeHtml(artikel.judul || '(Tanpa Judul)')}</h3>
            <div class="flex items-center justify-between">
                <span class="text-[9px] font-black uppercase tracking-widest ${safeStatus === 'published' ? 'text-emerald-500' : 'text-amber-500'}">${window.AdminApp.utils.escapeHtml(artikel.status || 'Draft')}</span>
                <div class="flex gap-2 relative z-10">
                    <button data-action="edit-artikel" data-idx="${idx}" class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all shadow-sm"><i class="fas fa-pencil-alt text-xs"></i></button>
                    <button data-action="delete-artikel" data-idx="${idx}" class="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm"><i class="fas fa-trash-alt text-xs"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
};

window.AdminApp.content.openEditArtikel = function openEditArtikel(idx) {
    const modal = document.getElementById('modalEditorArtikel');
    const isNew = idx === null;
    const data = isNew
        ? { id: '', judul: '', ringkasan: '', isi: '', foto: '', kategori: 'Umum', status: 'draft' }
        : window.AdminState.content.artikel[idx];

    document.getElementById('art_idx_modal').value = isNew ? 'new' : idx;
    document.getElementById('art_id_modal').value = data.id || '';
    document.getElementById('art_judul_modal').value = data.judul || '';
    document.getElementById('art_kat_modal').value = data.kategori || 'Umum';
    document.getElementById('art_status_modal').value = data.status || 'draft';
    document.getElementById('art_foto_modal').value = data.foto || '';
    document.getElementById('art_ringkasan_modal').value = data.ringkasan || '';
    document.getElementById('art_isi_modal').value = data.isi || '';
    document.getElementById('art_doc_id_modal').value = data.doc_id || '';

    window.AdminApp.content.updateArtPreview(data.foto);
    modal.classList.remove('hidden');
};

window.AdminApp.content.updateArtPreview = function updateArtPreview(url) {
    const img = document.getElementById('art_preview_modal');
    if (url) {
        img.src = window.AdminApp.utils.normalizeThumbUrl(url);
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
    }
};

window.AdminApp.content.uploadArtikelImageModal = async function uploadArtikelImageModal(input) {
    const file = input.files[0];
    if (!file) return;

    const btn = input.previousElementSibling;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';

    try {
        const url = await window.AdminApp.system.uploadToDrive(file);
        document.getElementById('art_foto_modal').value = url;
        window.AdminApp.content.updateArtPreview(url);
        alert('Foto berhasil diunggah.');
    } catch (e) {
        alert(e.message);
    } finally {
        btn.innerHTML = orig;
    }
};

window.AdminApp.content.insertArticleBodyHtml = function insertArticleBodyHtml(html) {
    const textarea = document.getElementById('art_isi_modal');
    const value = textarea.value || '';
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const before = value.slice(0, start).replace(/\s*$/, '');
    const after = value.slice(end).replace(/^\s*/, '');
    const insert = `\n\n${html}\n\n`;
    textarea.value = `${before}${insert}${after}`.trim();
    const cursor = Math.min(textarea.value.length, before.length + insert.length);
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
};

window.AdminApp.content.uploadArtikelBodyImages = async function uploadArtikelBodyImages(input) {
    const files = Array.from(input.files || []);
    if (files.length === 0) return;

    const btn = document.getElementById('btnInsertArticleImage');
    const orig = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Upload...';
        btn.disabled = true;
    }

    try {
        const blocks = [];
        for (const file of files) {
            const url = await window.AdminApp.system.uploadToDrive(file);
            const safeUrl = window.AdminApp.utils.escapeAttr(url);
            const safeAlt = window.AdminApp.utils.escapeAttr(file.name.replace(/\.[^.]+$/, ''));
            blocks.push(`<figure><img src="${safeUrl}" alt="${safeAlt}"><figcaption></figcaption></figure>`);
        }
        window.AdminApp.content.insertArticleBodyHtml(blocks.join('\n\n'));
        alert(`${files.length} gambar berhasil disisipkan ke isi artikel.`);
    } catch (e) {
        alert(e.message);
    } finally {
        input.value = '';
        if (btn) {
            btn.innerHTML = orig;
            btn.disabled = false;
        }
    }
};

window.AdminApp.content.saveArtikelFromModal = async function saveArtikelFromModal() {
    const btn = document.getElementById('btnSaveArtModal');
    const orig = btn.innerHTML;

    const data = {
        id: document.getElementById('art_id_modal').value,
        judul: document.getElementById('art_judul_modal').value,
        ringkasan: document.getElementById('art_ringkasan_modal').value,
        isi: document.getElementById('art_isi_modal').value,
        foto: document.getElementById('art_foto_modal').value,
        kategori: document.getElementById('art_kat_modal').value,
        status: document.getElementById('art_status_modal').value,
        doc_id: document.getElementById('art_doc_id_modal').value
    };

    if (!data.judul) return alert('Judul wajib diisi!');

    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'saveArtikel', artikelData: data });
        if (result.status === 'success') {
            alert('Artikel berhasil disimpan.');
            window.AdminApp.ui.closeModal('modalEditorArtikel');
            window.AdminState.content.hasLoadedArtikel = false;
            window.AdminApp.content.loadArtikelListAdmin({ force: true });
        } else {
            alert(result.message || 'Gagal menyimpan artikel.');
        }
    } catch (e) {
        alert(e?.message ? `Error koneksi saat simpan: ${e.message}` : 'Error koneksi saat simpan.');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};

window.AdminApp.content.deleteArtikelRecord = async function deleteArtikelRecord(id, idx) {
    if (!id) {
        window.AdminState.content.artikel.splice(idx, 1);
        window.AdminApp.content.renderArtikelList();
        return;
    }

    if (!confirm('Yakin hapus permanen? Foto di G-Drive tidak terhapus.')) return;

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'deleteArtikel', artikelId: id });
        if (result.status === 'success') {
            window.AdminState.content.hasLoadedArtikel = false;
            window.AdminApp.content.loadArtikelListAdmin({ force: true });
        } else {
            alert(result.message);
        }
    } catch (e) {
        alert('Gagal hapus.');
    }
};

window.AdminApp.content.loadGaleriListAdmin = async function loadGaleriListAdmin(options = {}) {
    const force = Boolean(options.force);
    if (!force && window.AdminState.content.hasLoadedGaleri) {
        window.AdminApp.content.renderGaleriList();
        return window.AdminState.content.galeri;
    }

    if (!force && window.AdminState.content.galeriPromise) {
        return window.AdminState.content.galeriPromise;
    }

    const loadPromise = (async () => {
        try {
            document.getElementById('galeriList').innerHTML = '<p class="text-slate-400 font-bold text-sm text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat galeri...</p>';
            const result = await apiGetJson('getGaleriList', null, { timeoutMs: 20000, retries: 1, retryDelayMs: 500 });

            if (result.status === 'success') {
                window.AdminState.content.galeri = result.data || [];
                window.AdminState.content.hasLoadedGaleri = true;
                window.AdminApp.content.renderGaleriList();
            } else {
                alert('Gagal memuat galeri.');
            }
        } catch (e) {
        } finally {
            window.AdminState.content.galeriPromise = null;
        }
        return window.AdminState.content.galeri;
    })();

    window.AdminState.content.galeriPromise = loadPromise;
    return loadPromise;
};

window.AdminApp.content.renderGaleriList = function renderGaleriList() {
    const container = document.getElementById('galeriList');
    if (window.AdminState.content.galeri.length === 0) {
        container.innerHTML = `<div class="col-span-full border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-slate-400">
            <i class="fas fa-images text-5xl mb-4 opacity-20"></i>
            <p class="font-bold">Galeri masih kosong. Tambahkan momen terbaik Anda.</p>
        </div>`;
        return;
    }

    container.innerHTML = window.AdminState.content.galeri.map((galeri, idx) => {
        const thumb = window.AdminApp.utils.normalizeThumbUrl(galeri.url_foto);
        return `
        <div class="group bg-white/70 backdrop-blur-md border border-white rounded-[2rem] p-3 shadow-sm hover:shadow-xl transition-all relative overflow-hidden flex flex-col">
            <div class="aspect-square bg-slate-100 rounded-[1.5rem] overflow-hidden mb-3 relative shadow-inner">
                ${thumb ? `<img src="${window.AdminApp.utils.escapeAttr(thumb)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">` : `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="fas fa-image text-3xl"></i></div>`}
                <div class="absolute top-2 left-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest text-slate-500">${window.AdminApp.utils.escapeHtml(galeri.kategori || 'Galeri')}</div>
            </div>
            <div class="px-2 pb-2">
                <h4 class="font-bold text-slate-800 text-[10px] truncate mb-2">${window.AdminApp.utils.escapeHtml(galeri.judul || '(Tanpa Nama)')}</h4>
                <div class="flex gap-2 justify-end">
                    <button data-action="edit-galeri" data-idx="${idx}" class="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white flex items-center justify-center transition-all"><i class="fas fa-pencil-alt text-[10px]"></i></button>
                    <button data-action="delete-galeri" data-idx="${idx}" class="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"><i class="fas fa-trash-alt text-[10px]"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
};

window.AdminApp.content.openEditGaleri = function openEditGaleri(idx) {
    const modal = document.getElementById('modalEditorGaleri');
    const isNew = idx === null;
    const data = isNew
        ? { id: '', judul: '', url_foto: '', kategori: 'Fasilitas', urutan: 999, keterangan: '' }
        : window.AdminState.content.galeri[idx];

    document.getElementById('gal_idx_modal').value = isNew ? 'new' : idx;
    document.getElementById('gal_judul_modal').value = data.judul || '';
    document.getElementById('gal_kat_modal').value = data.kategori || 'Fasilitas';
    document.getElementById('gal_urut_modal').value = data.urutan || 999;
    document.getElementById('gal_ket_modal').value = data.keterangan || '';
    document.getElementById('gal_url_modal').value = data.url_foto || '';

    window.AdminApp.content.updateGalPreview(data.url_foto);
    modal.classList.remove('hidden');
};

window.AdminApp.content.updateGalPreview = function updateGalPreview(url) {
    const img = document.getElementById('gal_preview_modal');
    if (url) {
        img.src = window.AdminApp.utils.normalizeThumbUrl(url);
        img.classList.remove('hidden');
    } else {
        img.classList.add('hidden');
    }
};

window.AdminApp.content.uploadGaleriImageModal = async function uploadGaleriImageModal(input) {
    const file = input.files[0];
    if (!file) return;

    const url = await window.AdminApp.system.uploadToDrive(file);
    document.getElementById('gal_url_modal').value = url;
    window.AdminApp.content.updateGalPreview(url);
    alert('Foto berhasil dipasang.');
};

window.AdminApp.content.saveGaleriFromModal = async function saveGaleriFromModal() {
    const btn = document.getElementById('btnSaveGalModal');
    const orig = btn.innerHTML;

    const item = {
        id: window.AdminState.content.galeri[document.getElementById('gal_idx_modal').value]?.id || '',
        judul: document.getElementById('gal_judul_modal').value,
        url_foto: document.getElementById('gal_url_modal').value,
        kategori: document.getElementById('gal_kat_modal').value,
        urutan: parseInt(document.getElementById('gal_urut_modal').value, 10) || 999,
        keterangan: document.getElementById('gal_ket_modal').value
    };

    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const idx = document.getElementById('gal_idx_modal').value;
        const newPayload = [...window.AdminState.content.galeri];
        if (idx === 'new') newPayload.push(item);
        else newPayload[idx] = item;

        const result = await window.AdminApp.auth.adminPost({ action: 'saveGaleri', galeriData: newPayload });
        if (result.status === 'success') {
            window.AdminApp.ui.closeModal('modalEditorGaleri');
            window.AdminState.content.hasLoadedGaleri = false;
            window.AdminApp.content.loadGaleriListAdmin({ force: true });
        } else {
            alert(result.message);
        }
    } catch (e) {
        alert('Error simpan galeri.');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};

window.AdminApp.content.deleteGaleriRecord = async function deleteGaleriRecord(id, idx) {
    if (!confirm('Hapus foto ini dari galeri?')) return;

    const newPayload = [...window.AdminState.content.galeri];
    newPayload.splice(idx, 1);

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'saveGaleri', galeriData: newPayload });
        if (result.status === 'success') {
            window.AdminState.content.hasLoadedGaleri = false;
            window.AdminApp.content.loadGaleriListAdmin({ force: true });
        }
    } catch (e) {
        alert('Gagal hapus.');
    }
};

window.AdminApp.content.createDocFromModal = async function createDocFromModal() {
    const judul = document.getElementById('art_judul_modal').value;
    if (!judul) return alert('Isi Judul Artikel terlebih dahulu!');
    const artikelData = {
        judul,
        ringkasan: document.getElementById('art_ringkasan_modal').value,
        isi: document.getElementById('art_isi_modal').value,
        foto: document.getElementById('art_foto_modal').value
    };

    const btn = document.getElementById('btnCreateDocModal');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sedang Membuat...';
    btn.disabled = true;

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'createDoc', judul, artikelData });
        if (result.status === 'success') {
            document.getElementById('art_doc_id_modal').value = result.data.docId;
            alert(result.message || 'Google Doc berhasil dibuat.');
            window.open(`https://docs.google.com/document/d/${result.data.docId}`, '_blank');
        } else {
            alert(result.message);
        }
    } catch (e) {
        alert(e?.message ? `Error saat membuat dokumen: ${e.message}` : 'Error koneksi saat membuat dokumen.');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};
