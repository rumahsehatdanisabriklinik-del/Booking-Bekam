/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Compatibility
 * ================================================
 */

// Legacy bridge kept only for likely external/manual entry points during transition.
window.doLogin = (...args) => window.AdminApp.auth.doLogin(...args);
window.logout = (...args) => window.AdminApp.auth.logout(...args);
window.switchTab = (...args) => window.AdminApp.ui.switchTab(...args);
window.closeModal = (...args) => window.AdminApp.ui.closeModal(...args);
window.loadAllData = (...args) => window.AdminApp.loadAllData(...args);

window.openModalStatus = (...args) => window.AdminApp.bookings.openModalStatus(...args);
window.closeModalStatus = (...args) => window.AdminApp.bookings.closeModalStatus(...args);
window.saveStatus = (...args) => window.AdminApp.bookings.saveStatus(...args);
window.openEMR = (...args) => window.AdminApp.bookings.openEMR(...args);
window.closeEMR = (...args) => window.AdminApp.bookings.closeEMR(...args);
window.saveEMR = (...args) => window.AdminApp.bookings.saveEMR(...args);

window.copyClinicQrCode = (...args) => window.AdminApp.cms.copyClinicQrCode(...args);
window.printClinicQrPoster = (...args) => window.AdminApp.cms.printClinicQrPoster(...args);

window.openEditArtikel = (...args) => window.AdminApp.content.openEditArtikel(...args);
window.openEditGaleri = (...args) => window.AdminApp.content.openEditGaleri(...args);

window.runDatabaseInit = (...args) => window.AdminApp.system.runDatabaseInit(...args);
window.runSinkronCepat = (...args) => window.AdminApp.system.runSinkronCepat(...args);
window.runFullMigration = (...args) => window.AdminApp.system.runFullMigration(...args);
