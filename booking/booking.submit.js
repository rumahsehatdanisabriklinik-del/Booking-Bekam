function validateAll() {
    const gender = document.querySelector('input[name="gender_terapis"]:checked');
    const layanan = document.querySelector('input[name="layanan"]:checked');
    const terapis = document.querySelector('input[name="pilih_nama_terapis"]:checked');
    const tgl = document.getElementById('tanggal').value;
    const waktu = document.querySelector('input[name="waktu"]:checked');
    const nama = document.getElementById('nama').value.trim();
    const wa = document.getElementById('whatsapp').value.trim();

    if (!gender) { showCustomToast('Silakan pilih Jenis Kelamin.', 'error'); scrollToElement('step-1'); return false; }
    if (!terapis) { showCustomToast('Silakan pilih Terapis.', 'error'); scrollToElement('section-nama-terapis'); return false; }
    if (!layanan) { showCustomToast('Silakan pilih Layanan.', 'error'); scrollToElement('section-layanan'); return false; }
    if (!tgl) { showCustomToast('Silakan pilih Tanggal Kedatangan.', 'error'); document.getElementById('tanggal').focus(); return false; }

    if (selectedLayanan && selectedLayanan.hariAktif && selectedLayanan.hariAktif.length > 0) {
        const parts = tgl.split('-').map(Number);
        const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
        if (!selectedLayanan.hariAktif.includes(day)) {
            const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
            const hariNama = selectedLayanan.hariAktif.map(h => daysMap[h]).join(", ");
            showCustomToast(`Layanan ${selectedLayanan.nama} hanya tersedia di hari: ${hariNama}`, 'error');
            scrollToElement('section-tanggal');
            return false;
        }
    }

    if (!waktu) { showCustomToast('Silakan pilih Jam Kedatangan.', 'error'); scrollToElement('section-waktu'); return false; }
    if (!nama) { showCustomToast('Nama Lengkap wajib diisi.', 'error'); document.getElementById('nama').focus(); return false; }
    if (!wa || wa.length < 9) { showCustomToast('No. WhatsApp tidak valid.', 'error'); document.getElementById('whatsapp').focus(); return false; }

    return true;
}

async function handleBookingSubmit(e) {
    e.preventDefault();
    if (!validateAll()) return;

    submitBtn.disabled = true;
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin text-lg"></i> <span class="relative z-10 ml-2">Memproses Data...</span>';

    const layananEncoded = document.querySelector('input[name="layanan"]:checked').value;
    const layananDecoded = decodeURIComponent(escape(atob(layananEncoded)));

    const formData = {
        layanan: layananDecoded,
        terapis_pref: selectedGender,
        tanggal: document.getElementById('tanggal').value,
        waktu: document.querySelector('input[name="waktu"]:checked').value,
        nama: document.getElementById('nama').value,
        usia: document.getElementById('usia').value,
        whatsapp: document.getElementById('whatsapp').value,
        keluhan: document.getElementById('keluhan').value || "-"
    };

    window.lastBookingData = formData;

    const backendData = {
        action: "simpanBookingData",
        nama: formData.nama,
        nohp: formData.whatsapp,
        tanggal: formData.tanggal,
        terapis: selectedTerapisName,
        waktu: formData.waktu,
        jenisKelamin: (formData.terapis_pref === "Pria" ? "Laki-laki" : "Perempuan"),
        sesiBekam: formData.layanan,
        keluhan: formData.keluhan
    };

    try {
        const response = await fetch(buildApiUrl('simpanBookingData'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendData)
        });
        const result = await response.json();

        if (result.status === "success") {
            document.getElementById('succ-nama').textContent = formData.nama;
            document.getElementById('succ-terapis').textContent = selectedTerapisName;
            document.getElementById('succ-layanan').textContent = formData.layanan;
            document.getElementById('succ-tanggal').textContent = formData.tanggal;
            document.getElementById('succ-waktu').innerHTML = `<i class="far fa-clock mr-1"></i> ${formData.waktu} WIB`;

            document.getElementById('btnWA').href = result.data.whatsappUrl;
            document.getElementById('btnStatusCheckin').href = `status.html?phone=${encodeURIComponent(formData.whatsapp)}`;

            document.getElementById('bookingForm').style.display = 'none';
            document.getElementById('success-screen').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });

            showCustomToast("Booking Berhasil Dibuat!", "success");
        } else {
            showCustomToast("Maaf, terjadi kesalahan: " + result.message, "error");
        }
    } catch (err) {
        showCustomToast("Gagal terhubung ke sistem. Periksa koneksi Anda.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
    }
}
