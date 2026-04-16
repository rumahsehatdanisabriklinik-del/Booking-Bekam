function bindStatusUIEvents() {
    document.addEventListener('click', (event) => {
        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;

        const action = actionTarget.dataset.action;

        switch (action) {
            case 'check-status':
                checkStatus();
                break;
            case 'close-checkin-modal':
                closeCheckinModal();
                break;
            case 'submit-manual-checkin':
                submitManualCheckin();
                break;
            case 'open-review':
                openReview(Number(actionTarget.dataset.row), actionTarget.dataset.terapis || "");
                break;
            case 'open-checkin':
                openCheckinModalSafe(
                    Number(actionTarget.dataset.row),
                    actionTarget.dataset.payload || '',
                    actionTarget.dataset.summary || ''
                );
                break;
            case 'cancel-booking':
                batalBooking(Number(actionTarget.dataset.row));
                break;
            case 'reset-search':
                resetSearch();
                break;
            case 'close-review':
                closeReview();
                break;
            case 'send-review':
                sendReview();
                break;
            case 'set-rating':
                setRating(Number(actionTarget.dataset.rating));
                break;
            default:
                break;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    bindStatusUIEvents();
    syncLandingBranding({ titleSuffix: 'Lacak Reservasi' });
    const urlParams = new URLSearchParams(window.location.search);
    const inputVal = urlParams.get('id') || urlParams.get('phone');
    if (inputVal) {
        document.getElementById('orderIdInput').value = inputVal;
        checkStatus();
    }
});
