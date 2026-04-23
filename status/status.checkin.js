function updateCheckinStatus(message, isError = false) {
    const el = document.getElementById('checkinScanStatus');
    if (!el) return;
    el.textContent = message;
    el.className = `text-sm font-bold text-center ${isError ? 'text-red-500' : 'text-slate-500'}`;
}

function parseLocalDateTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const normalized = raw
        .replace(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/, '$3-$2-$1T$4:$5:00')
        .replace(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/, '$1-$2-$3T$4:$5:00');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalCheckinWindowState() {
    if (!currentCheckInWindow) return { state: 'unknown' };
    const validFrom = parseLocalDateTime(currentCheckInWindow.validFrom);
    const expiresAt = parseLocalDateTime(currentCheckInWindow.expiresAt);
    const now = new Date();
    if (validFrom && now < validFrom) {
        return { state: 'early', message: `QR belum aktif. Check-in dibuka mulai ${currentCheckInWindow.validFrom}.` };
    }
    if (expiresAt && now > expiresAt) {
        return { state: 'expired', message: `QR sudah kedaluwarsa. Batas check-in sampai ${currentCheckInWindow.expiresAt}.` };
    }
    return { state: 'active' };
}

function stopCheckinScanner() {
    checkinScanLoopActive = false;
    if (checkinStream) {
        checkinStream.getTracks().forEach(track => track.stop());
        checkinStream = null;
    }
    const video = document.getElementById('checkinVideo');
    if (video) {
        video.pause();
        video.srcObject = null;
    }
}

function closeCheckinModal() {
    stopCheckinScanner();
    const modal = document.getElementById('checkinModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function openCheckinModal(row, payload, summaryText) {
    currentCheckInRow = row;
    currentCheckInPayload = payload || "";
    currentCheckInSummary = summaryText || "";
    checkinSubmitInFlight = false;
    lastScannedClinicCode = "";
    lastScannedClinicCodeAt = 0;
    document.getElementById('manualClinicCode').value = '';

    const modal = document.getElementById('checkinModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);

    if (!currentCheckInPayload) {
        updateCheckinStatus('Booking ini belum memiliki token check-in. Hubungi admin.', true);
        return;
    }

    const localWindow = getLocalCheckinWindowState();
    if (localWindow.state === 'early' || localWindow.state === 'expired') {
        updateCheckinStatus(localWindow.message, true);
        return;
    }

    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
        updateCheckinStatus('Browser ini belum mendukung scan kamera. Gunakan kolom kode manual di bawah.', true);
        return;
    }

    try {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (!formats.includes('qr_code')) {
            updateCheckinStatus('Browser tidak mendukung pembacaan QR. Gunakan kode manual.', true);
            return;
        }

        checkinDetector = new BarcodeDetector({ formats: ['qr_code'] });
        checkinStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });

        const video = document.getElementById('checkinVideo');
        video.srcObject = checkinStream;
        await video.play();

        checkinScanLoopActive = true;
        updateCheckinStatus('Arahkan kamera ke QR check-in di meja admin.');
        requestAnimationFrame(scanClinicQrFrame);
    } catch (error) {
        console.error('Scanner start failed', error);
        updateCheckinStatus('Kamera tidak bisa dibuka. Gunakan kode manual jika diperlukan.', true);
    }
}

function openCheckinModalSafe(row, encodedPayload, encodedSummary, windowInfo = {}) {
    let payload = '';
    let summary = '';
    try { payload = decodeURIComponent(escape(atob(encodedPayload))); } catch (e) {}
    try { summary = decodeURIComponent(escape(atob(encodedSummary))); } catch (e) {}
    currentCheckInWindow = windowInfo || null;
    openCheckinModal(row, payload, summary);
}

async function scanClinicQrFrame() {
    if (!checkinScanLoopActive || !checkinDetector) return;

    const video = document.getElementById('checkinVideo');
    if (!video || video.readyState < 2) {
        requestAnimationFrame(scanClinicQrFrame);
        return;
    }

    try {
        const barcodes = await checkinDetector.detect(video);
        if (barcodes && barcodes.length > 0) {
            const rawValue = (barcodes[0].rawValue || '').trim();
            if (rawValue) {
                await processPatientCheckin(rawValue);
                return;
            }
        }
    } catch (error) {
        console.error('Barcode detect failed', error);
    }

    if (checkinScanLoopActive) {
        requestAnimationFrame(scanClinicQrFrame);
    }
}

async function submitManualCheckin() {
    const manualCode = document.getElementById('manualClinicCode').value.trim();
    if (!manualCode) {
        updateCheckinStatus('Masukkan atau tempel kode QR klinik terlebih dahulu.', true);
        return;
    }
    await processPatientCheckin(manualCode);
}

async function processPatientCheckin(clinicCode) {
    if (!currentCheckInPayload) {
        updateCheckinStatus('Token booking tidak ditemukan.', true);
        return;
    }
    if (checkinSubmitInFlight) return;

    const localWindow = getLocalCheckinWindowState();
    if (localWindow.state === 'early' || localWindow.state === 'expired') {
        updateCheckinStatus(localWindow.message, true);
        return;
    }

    const now = Date.now();
    if (clinicCode === lastScannedClinicCode && now - lastScannedClinicCodeAt < 5000) {
        return;
    }
    lastScannedClinicCode = clinicCode;
    lastScannedClinicCodeAt = now;

    checkinScanLoopActive = false;
    checkinSubmitInFlight = true;
    updateCheckinStatus('Memproses check-in ke server...');

    try {
        const result = await apiPostJson('selfCheckIn', {
            payload: currentCheckInPayload,
            clinicCode: clinicCode
        }, {
            timeoutMs: 15000,
            retries: 1,
            retryDelayMs: 500
        });

        if (result.status === 'success') {
            stopCheckinScanner();
            showCustomToast(`Check-in berhasil untuk ${result.data?.nama || currentCheckInSummary}.`, 'success');
            closeCheckinModal();
            checkStatus();
        } else {
            const message = result.message || 'Check-in gagal diproses.';
            updateCheckinStatus(message, true);
            const shouldResume = !/belum aktif|kedaluwarsa|tidak valid/i.test(message);
            if (shouldResume && checkinStream) {
                checkinScanLoopActive = true;
                requestAnimationFrame(scanClinicQrFrame);
            }
        }
    } catch (error) {
        console.error('Check-in submit failed', error);
        updateCheckinStatus('Gagal terhubung ke server check-in.', true);
        if (checkinStream) {
            checkinScanLoopActive = true;
            requestAnimationFrame(scanClinicQrFrame);
        }
    } finally {
        checkinSubmitInFlight = false;
    }
}
