let currentRating = 0;
let currentBookingIdForReview = "";
let currentReviewRow = null;
let fetchAborter = null;
let currentCheckInPayload = "";
let currentCheckInRow = null;
let currentCheckInSummary = null;
let checkinStream = null;
let checkinScanLoopActive = false;
let checkinDetector = null;

document.getElementById('year').textContent = new Date().getFullYear();

const phoneInput = document.getElementById('orderIdInput');
if (phoneInput) {
    phoneInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
    });
    phoneInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') checkStatus();
    });
}

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.remove('translate-x-full');
});

document.getElementById('closeMobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.add('translate-x-full');
});
