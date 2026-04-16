document.addEventListener('DOMContentLoaded', () => {
    syncHeaderFooter();
    const urlParams = new URLSearchParams(window.location.search);
    const inputVal = urlParams.get('id') || urlParams.get('phone');
    if (inputVal) {
        document.getElementById('orderIdInput').value = inputVal;
        checkStatus();
    }
});
