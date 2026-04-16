document.addEventListener('DOMContentLoaded', () => {
    syncLandingBranding({ titleSuffix: 'Lacak Reservasi' });
    const urlParams = new URLSearchParams(window.location.search);
    const inputVal = urlParams.get('id') || urlParams.get('phone');
    if (inputVal) {
        document.getElementById('orderIdInput').value = inputVal;
        checkStatus();
    }
});
