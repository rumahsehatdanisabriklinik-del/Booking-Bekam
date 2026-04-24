function updateCheckinStatus(message, isError = false) {
    const el = document.getElementById('checkinScanStatus');
    if (!el) return;
    el.textContent = message;
    el.className = `text-sm font-bold text-center ${isError ? 'text-red-500' : 'text-slate-500'}`;
}

function renderCheckinDebug(debugData) {
    const wrap = document.getElementById('checkinDebugPanel');
    const body = document.getElementById('checkinDebugContent');
    if (!wrap || !body) return;
    if (!debugData || typeof debugData !== 'object' || Object.keys(debugData).length === 0) {
        wrap.classList.add('hidden');
        body.textContent = '';
        return;
    }
    wrap.classList.remove('hidden');
    body.textContent = JSON.stringify(debugData, null, 2);
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
    checkinScanMode = "idle";
    checkinDetector = null;
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
    renderCheckinDebug({
        stage: 'modal-opened',
        row: row,
        hasPayload: !!payload,
        summary: summaryText || ''
    });

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

    if (!navigator.mediaDevices?.getUserMedia) {
        updateCheckinStatus('Browser ini belum mendukung akses kamera. Gunakan kolom kode manual di bawah.', true);
        return;
    }

    try {
        checkinScanMode = 'jsqr';
        if ('BarcodeDetector' in window) {
            const formats = await BarcodeDetector.getSupportedFormats();
            if (formats.includes('qr_code')) {
                checkinDetector = new BarcodeDetector({ formats: ['qr_code'] });
                checkinScanMode = 'barcode-detector';
            }
        }

        checkinStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 1280 }
            },
            audio: false
        });

        const video = document.getElementById('checkinVideo');
        video.srcObject = checkinStream;
        await video.play();
        if (!checkinCanvas) {
            checkinCanvas = document.createElement('canvas');
            checkinCanvasCtx = checkinCanvas.getContext('2d', { willReadFrequently: true });
        }

        checkinScanLoopActive = true;
        updateCheckinStatus(checkinScanMode === 'barcode-detector'
            ? 'Arahkan kamera ke QR check-in di meja admin.'
            : 'Arahkan kamera ke QR check-in di meja admin. Mode scan kompatibel sedang aktif.');
        renderCheckinDebug({
            stage: 'scanner-ready',
            row: currentCheckInRow,
            scanMode: checkinScanMode,
            hasPayload: !!currentCheckInPayload,
            validFrom: currentCheckInWindow && currentCheckInWindow.validFrom ? currentCheckInWindow.validFrom : '',
            expiresAt: currentCheckInWindow && currentCheckInWindow.expiresAt ? currentCheckInWindow.expiresAt : ''
        });
        requestAnimationFrame(scanClinicQrFrame);
    } catch (error) {
        console.error('Scanner start failed', error);
        renderCheckinDebug({
            stage: 'scanner-start-failed',
            row: currentCheckInRow,
            message: error && error.message ? error.message : String(error || '')
        });
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
    if (!checkinScanLoopActive) return;

    const video = document.getElementById('checkinVideo');
    if (!video || video.readyState < 2) {
        requestAnimationFrame(scanClinicQrFrame);
        return;
    }

    try {
        if (checkinScanMode === 'barcode-detector' && checkinDetector) {
            const barcodes = await checkinDetector.detect(video);
            if (barcodes && barcodes.length > 0) {
                const rawValue = (barcodes[0].rawValue || '').trim();
                if (rawValue) {
                    await processPatientCheckin(rawValue);
                    return;
                }
            }
        } else if (typeof window.jsQR === 'function' && checkinCanvas && checkinCanvasCtx) {
            const width = video.videoWidth || 0;
            const height = video.videoHeight || 0;
            if (width > 0 && height > 0) {
                checkinCanvas.width = width;
                checkinCanvas.height = height;
                checkinCanvasCtx.drawImage(video, 0, 0, width, height);
                const imageData = checkinCanvasCtx.getImageData(0, 0, width, height);
                const qr = window.jsQR(imageData.data, width, height, {
                    inversionAttempts: 'dontInvert'
                });
                const rawValue = (qr && qr.data ? qr.data : '').trim();
                if (rawValue) {
                    await processPatientCheckin(rawValue);
                    return;
                }
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
        renderCheckinDebug({ stage: 'missing-booking-token', row: currentCheckInRow });
        updateCheckinStatus('Token booking tidak ditemukan.', true);
        return;
    }
    if (checkinSubmitInFlight) return;

    const localWindow = getLocalCheckinWindowState();
    if (localWindow.state === 'early' || localWindow.state === 'expired') {
        renderCheckinDebug({
            stage: `local-window-${localWindow.state}`,
            row: currentCheckInRow,
            validFrom: currentCheckInWindow && currentCheckInWindow.validFrom ? currentCheckInWindow.validFrom : '',
            expiresAt: currentCheckInWindow && currentCheckInWindow.expiresAt ? currentCheckInWindow.expiresAt : ''
        });
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
    renderCheckinDebug({
        stage: 'submitting-checkin',
        row: currentCheckInRow,
        scanMode: checkinScanMode,
        clinicCodePreview: clinicCode ? clinicCode.substring(0, 24) : ''
    });
    updateCheckinStatus('Memproses check-in ke server...');

    try {
        const result = await apiPostJson('selfCheckIn', {
            row: currentCheckInRow,
            payload: currentCheckInPayload,
            clinicCode: clinicCode
        }, {
            timeoutMs: 15000,
            retries: 1,
            retryDelayMs: 500
        });

        if (result.status === 'success') {
            renderCheckinDebug(result.data && result.data.debug ? result.data.debug : {
                stage: 'success',
                row: currentCheckInRow
            });
            stopCheckinScanner();
            showCustomToast(`Check-in berhasil untuk ${result.data?.nama || currentCheckInSummary}.`, 'success');
            closeCheckinModal();
            checkStatus();
        } else {
            const message = result.message || 'Check-in gagal diproses.';
            renderCheckinDebug(result.data && result.data.debug ? result.data.debug : {
                stage: 'server-error',
                row: currentCheckInRow,
                message: message
            });
            updateCheckinStatus(message, true);
            const shouldResume = !/belum aktif|kedaluwarsa|tidak valid/i.test(message);
            if (shouldResume && checkinStream) {
                checkinScanLoopActive = true;
                requestAnimationFrame(scanClinicQrFrame);
            }
        }
    } catch (error) {
        console.error('Check-in submit failed', error);
        renderCheckinDebug({
            stage: 'network-error',
            row: currentCheckInRow,
            message: error && error.message ? error.message : String(error || '')
        });
        updateCheckinStatus('Gagal terhubung ke server check-in.', true);
        if (checkinStream) {
            checkinScanLoopActive = true;
            requestAnimationFrame(scanClinicQrFrame);
        }
    } finally {
        checkinSubmitInFlight = false;
    }
}
