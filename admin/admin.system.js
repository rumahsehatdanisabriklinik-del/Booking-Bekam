/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin System Actions
 * ================================================
 */

window.AdminApp.system.uploadHeroImage = async function uploadHeroImage(input) {
    const file = input.files[0];
    if (!file) return;

    const btn = document.getElementById('btnUploadImage');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sejenak...';

    try {
        const url = await window.AdminApp.system.uploadToDrive(file);
        document.getElementById('cms_hero_image').value = url;
        alert('Foto hero berhasil diupdate.');
    } catch (e) {
        alert(e.message);
    } finally {
        btn.innerHTML = originalHTML;
    }
};

window.AdminApp.system.uploadToDrive = async function uploadToDrive(file) {
    return new Promise((resolve, reject) => {
        if (!window.GAS_URL) {
            reject(new Error('GAS_URL tidak ditemukan. Cek config.js'));
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const result = await window.AdminApp.auth.adminPost({
                    action: 'uploadImage',
                    base64: event.target.result,
                    fileName: file.name,
                    mimeType: file.type
                });

                if (result.status === 'success') resolve(result.url);
                else reject(new Error(result.message || 'Gagal upload (Backend Error)'));
            } catch (err) {
                console.error('Fetch Upload Error:', err);
                reject(new Error(`Gagal terhubung ke server upload: ${err.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Gagal membaca file lokal.'));
        reader.readAsDataURL(file);
    });
};

window.AdminApp.system.runDatabaseInit = async function runDatabaseInit() {
    if (!confirm('Yakin ingin melakukan inisialisasi tabel di Neon?')) return;

    const btn = document.getElementById('btnDbInit');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sedang Memproses...';
    btn.disabled = true;

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'initDb' });
        alert(result.message);
    } catch (e) {
        alert('Error koneksi database.');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};

window.AdminApp.system.runSinkronCepat = async function runSinkronCepat() {
    if (!confirm('Sinkronisasi semua booking dari Sheets ke Neon sekarang?\n\nProses ini aman dan tidak menghapus data.')) return;

    const btn = document.getElementById('btnSinkronCepat');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Menyinkronkan...';
    btn.disabled = true;

    try {
        const result = await window.AdminApp.auth.adminPost({ action: 'sinkronCepat' });
        alert(result.message || 'Sinkronisasi selesai!');
    } catch (e) {
        alert('Error koneksi saat sinkronisasi.');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
};

window.AdminApp.system.runFullMigration = async function runFullMigration() {
    alert(
        'PERHATIAN: Migrasi Lengkap tidak bisa dijalankan dari tombol ini.\n\n' +
        'Alasannya: Proses JDBC membutuhkan lebih dari 30 detik, melebihi batas waktu server.\n\n' +
        'CARA YANG BENAR:\n' +
        '1. Buka Google Apps Script Editor\n' +
        '2. Pilih fungsi: jalankanMigrasiSemua\n' +
        '3. Klik Run\n\n' +
        "Untuk sinkronisasi booking harian, gunakan tombol 'Sinkron Booking ke Neon'."
    );
};
