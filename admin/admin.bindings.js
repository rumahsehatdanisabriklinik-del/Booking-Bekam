/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Event Bindings
 * ================================================
 */

window.AdminApp.bindings.findBookingByRow = function findBookingByRow(row) {
    const rowNumber = Number(row) || 0;
    return window.AdminState.bookings.byRow[rowNumber] || null;
};

window.AdminApp.bindings.handleAdminAction = function handleAdminAction(actionEl) {
    const action = actionEl.dataset.action;
    if (!action) return;

    switch (action) {
        case 'login':
            window.AdminApp.auth.doLogin();
            break;
        case 'sidebar-toggle':
            window.AdminApp.ui.toggleSidebar(actionEl.dataset.show === 'true');
            break;
        case 'switch-tab':
            window.AdminApp.ui.switchTab(actionEl.dataset.tab, actionEl);
            break;
        case 'logout':
            window.AdminApp.auth.logout();
            break;
        case 'refresh-bookings':
            window.AdminApp.loadAllData();
            break;
        case 'copy-clinic-qr':
            window.AdminApp.cms.copyClinicQrCode();
            break;
        case 'print-clinic-qr':
            window.AdminApp.cms.printClinicQrPoster();
            break;
        case 'save-cms':
            window.AdminApp.cms.saveCMS();
            break;
        case 'trigger-file-input': {
            const target = document.getElementById(actionEl.dataset.targetId);
            if (target) target.click();
            break;
        }
        case 'add-layanan-row':
            window.AdminApp.cms.addLayananRow();
            break;
        case 'delete-layanan-row':
            window.AdminApp.cms.deleteLayananRow(Number(actionEl.dataset.idx));
            break;
        case 'save-layanan':
            window.AdminApp.cms.saveLayanan();
            break;
        case 'open-new-artikel':
            window.AdminApp.content.openEditArtikel(null);
            break;
        case 'edit-artikel':
            window.AdminApp.content.openEditArtikel(Number(actionEl.dataset.idx));
            break;
        case 'delete-artikel': {
            const idx = Number(actionEl.dataset.idx);
            const artikel = window.AdminState.content.artikel[idx];
            window.AdminApp.content.deleteArtikelRecord(artikel?.id || '', idx);
            break;
        }
        case 'open-new-galeri':
            window.AdminApp.content.openEditGaleri(null);
            break;
        case 'edit-galeri':
            window.AdminApp.content.openEditGaleri(Number(actionEl.dataset.idx));
            break;
        case 'delete-galeri': {
            const idx = Number(actionEl.dataset.idx);
            const galeri = window.AdminState.content.galeri[idx];
            window.AdminApp.content.deleteGaleriRecord(galeri?.id || '', idx);
            break;
        }
        case 'run-db-init':
            window.AdminApp.system.runDatabaseInit();
            break;
        case 'apply-report-filter':
            window.AdminApp.reports.loadSummary({ force: true });
            break;
        case 'preset-report-7':
            window.AdminApp.reports.applyFilterPreset(7);
            break;
        case 'preset-report-30':
            window.AdminApp.reports.applyFilterPreset(30);
            break;
        case 'run-sinkron-cepat':
            window.AdminApp.system.runSinkronCepat();
            break;
        case 'run-full-migration':
            window.AdminApp.system.runFullMigration();
            break;
        case 'open-status-modal':
            window.AdminApp.bookings.openModalStatus(Number(actionEl.dataset.row), actionEl.dataset.status || '');
            break;
        case 'change-reservation-page':
            window.AdminApp.bookings.changeReservationPage(Number(actionEl.dataset.direction) || 0);
            break;
        case 'open-emr': {
            const booking = window.AdminApp.bindings.findBookingByRow(actionEl.dataset.row);
            if (!booking) return;
            window.AdminApp.bookings.openEMR(booking.row, booking.nama, booking.keluhan || '', booking.tindakan || '');
            break;
        }
        case 'close-status-modal':
            window.AdminApp.bookings.closeModalStatus();
            break;
        case 'save-status':
            window.AdminApp.bookings.saveStatus();
            break;
        case 'close-emr':
            window.AdminApp.bookings.closeEMR();
            break;
        case 'save-emr':
            window.AdminApp.bookings.saveEMR();
            break;
        case 'close-modal':
            window.AdminApp.ui.closeModal(actionEl.dataset.modalId);
            break;
        case 'open-doc-link': {
            const input = document.getElementById(actionEl.dataset.inputId);
            const docId = input ? input.value.trim() : '';
            if (docId) window.open(`https://docs.google.com/document/d/${docId}`, '_blank');
            break;
        }
        case 'create-doc':
            window.AdminApp.content.createDocFromModal();
            break;
        case 'save-artikel':
            window.AdminApp.content.saveArtikelFromModal();
            break;
        case 'save-galeri':
            window.AdminApp.content.saveGaleriFromModal();
            break;
        default:
            break;
    }
};

window.AdminApp.bindings.handleAdminChange = function handleAdminChange(changeEl) {
    const action = changeEl.dataset.changeAction;
    if (!action) return;

    switch (action) {
        case 'upload-hero-image':
            window.AdminApp.system.uploadHeroImage(changeEl);
            break;
        case 'upload-artikel-image':
            window.AdminApp.content.uploadArtikelImageModal(changeEl);
            break;
        case 'upload-galeri-image':
            window.AdminApp.content.uploadGaleriImageModal(changeEl);
            break;
        default:
            break;
    }
};

window.AdminApp.bindings.handleAdminInput = function handleAdminInput(inputEl) {
    const action = inputEl.dataset.inputAction;
    if (!action) return;

    switch (action) {
        case 'reservation-search':
            window.AdminApp.bookings.handleSearch(inputEl.value);
            break;
        default:
            break;
    }
};

window.AdminApp.bindings.bindAdminEvents = function bindAdminEvents() {
    if (window.AdminState.ui.bindingsBound) return;
    window.AdminState.ui.bindingsBound = true;

    document.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        window.AdminApp.bindings.handleAdminAction(actionEl);
    });

    document.addEventListener('change', (event) => {
        const changeEl = event.target.closest('[data-change-action]');
        if (!changeEl) return;
        window.AdminApp.bindings.handleAdminChange(changeEl);
    });

    document.addEventListener('input', (event) => {
        const inputEl = event.target.closest('[data-input-action]');
        if (!inputEl) return;
        window.AdminApp.bindings.handleAdminInput(inputEl);
    });

    const passInput = document.getElementById('passInput');
    if (passInput) {
        passInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.AdminApp.auth.doLogin();
            }
        });
    }
};
