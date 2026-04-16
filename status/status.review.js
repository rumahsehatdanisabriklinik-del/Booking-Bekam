function openReview(row, terapis) {
    currentReviewRow = row;
    currentBookingIdForReview = terapis || "";
    const modal = document.getElementById('reviewModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);

    currentRating = 0;
    updateStarsUI();
    document.getElementById('reviewText').value = '';
}

function closeReview() {
    const modal = document.getElementById('reviewModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function setRating(val) {
    currentRating = val;
    updateStarsUI();
}

function updateStarsUI() {
    const stars = document.getElementById('starContainer').children;
    for (let i = 0; i < stars.length; i++) {
        if (i < currentRating) {
            stars[i].classList.remove('text-slate-200');
            stars[i].classList.add('text-amber-400');
        } else {
            stars[i].classList.remove('text-amber-400');
            stars[i].classList.add('text-slate-200');
        }
    }
}

async function sendReview() {
    if (currentRating === 0) {
        showCustomToast("Silakan pilih rating bintang terlebih dahulu.", "error");
        return;
    }

    const btn = document.getElementById('btnSubmitReview');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> <span class="relative z-10">Mengirim...</span>';
    btn.disabled = true;
    btn.classList.add('opacity-80', 'cursor-not-allowed');

    try {
        const body = {
            action: "submitReview",
            row: currentReviewRow,
            rating: currentRating,
            ulasan: document.getElementById('reviewText').value,
            hp: document.getElementById('orderIdInput').value.trim()
        };

        const response = await fetch(buildApiUrl('submitReview'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();

        if (result.status === "success") {
            showCustomToast("Alhamdulillah! Terima kasih atas ulasan Anda.", "success");
            closeReview();
            checkStatus();
        } else {
            showCustomToast("Gagal mengirim ulasan: " + result.message, "error");
        }
    } catch (error) {
        showCustomToast("Gagal terhubung ke server saat mengirim ulasan.", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.classList.remove('opacity-80', 'cursor-not-allowed');
    }
}
