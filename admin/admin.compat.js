/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Compatibility
 * ================================================
 */

window.getAdminSessionToken = (...args) => window.AdminApp.auth.getAdminSessionToken(...args);
window.clearAdminSession = (...args) => window.AdminApp.auth.clearAdminSession(...args);
window.isAuthError = (...args) => window.AdminApp.auth.isAuthError(...args);
window.handleAdminAuthFailure = (...args) => window.AdminApp.auth.handleAdminAuthFailure(...args);
window.adminGet = (...args) => window.AdminApp.auth.adminGet(...args);
window.adminPost = (...args) => window.AdminApp.auth.adminPost(...args);
window.doLogin = (...args) => window.AdminApp.auth.doLogin(...args);
window.logout = (...args) => window.AdminApp.auth.logout(...args);

window.toggleSidebar = (...args) => window.AdminApp.ui.toggleSidebar(...args);
window.switchTab = (...args) => window.AdminApp.ui.switchTab(...args);
window.showLoader = (...args) => window.AdminApp.ui.showLoader(...args);
window.closeModal = (...args) => window.AdminApp.ui.closeModal(...args);
window.loadAllData = (...args) => window.AdminApp.loadAllData(...args);

window.getVisibleBookings = (...args) => window.AdminApp.bookings.getVisibleBookings(...args);
window.renderTables = (...args) => window.AdminApp.bookings.renderTables(...args);
window.handleSearch = (...args) => window.AdminApp.bookings.handleSearch(...args);
window.getReservationFilteredData = (...args) => window.AdminApp.bookings.getReservationFilteredData(...args);
window.getReservationBadgeClass = (...args) => window.AdminApp.bookings.getReservationBadgeClass(...args);
window.renderReservationsTable = (...args) => window.AdminApp.bookings.renderReservationsTable(...args);
window.renderReservationPagination = (...args) => window.AdminApp.bookings.renderReservationPagination(...args);
window.changeReservationPage = (...args) => window.AdminApp.bookings.changeReservationPage(...args);
window.openModalStatus = (...args) => window.AdminApp.bookings.openModalStatus(...args);
window.closeModalStatus = (...args) => window.AdminApp.bookings.closeModalStatus(...args);
window.saveStatus = (...args) => window.AdminApp.bookings.saveStatus(...args);
window.openEMR = (...args) => window.AdminApp.bookings.openEMR(...args);
window.closeEMR = (...args) => window.AdminApp.bookings.closeEMR(...args);
window.saveEMR = (...args) => window.AdminApp.bookings.saveEMR(...args);

window.getClinicCheckinPayload = (...args) => window.AdminApp.cms.getClinicCheckinPayload(...args);
window.renderClinicCheckinQr = (...args) => window.AdminApp.cms.renderClinicCheckinQr(...args);
window.copyClinicQrCode = (...args) => window.AdminApp.cms.copyClinicQrCode(...args);
window.printClinicQrPoster = (...args) => window.AdminApp.cms.printClinicQrPoster(...args);
window.loadCMSData = (...args) => window.AdminApp.cms.loadCMSData(...args);
window.saveCMS = (...args) => window.AdminApp.cms.saveCMS(...args);
window.loadLayananList = (...args) => window.AdminApp.cms.loadLayananList(...args);
window.renderLayananList = (...args) => window.AdminApp.cms.renderLayananList(...args);
window.addLayananRow = (...args) => window.AdminApp.cms.addLayananRow(...args);
window.deleteLayananRow = (...args) => window.AdminApp.cms.deleteLayananRow(...args);
window.saveLayanan = (...args) => window.AdminApp.cms.saveLayanan(...args);

window.loadArtikelListAdmin = (...args) => window.AdminApp.content.loadArtikelListAdmin(...args);
window.renderArtikelList = (...args) => window.AdminApp.content.renderArtikelList(...args);
window.openEditArtikel = (...args) => window.AdminApp.content.openEditArtikel(...args);
window.updateArtPreview = (...args) => window.AdminApp.content.updateArtPreview(...args);
window.uploadArtikelImageModal = (...args) => window.AdminApp.content.uploadArtikelImageModal(...args);
window.saveArtikelFromModal = (...args) => window.AdminApp.content.saveArtikelFromModal(...args);
window.deleteArtikelRecord = (...args) => window.AdminApp.content.deleteArtikelRecord(...args);
window.loadGaleriListAdmin = (...args) => window.AdminApp.content.loadGaleriListAdmin(...args);
window.renderGaleriList = (...args) => window.AdminApp.content.renderGaleriList(...args);
window.openEditGaleri = (...args) => window.AdminApp.content.openEditGaleri(...args);
window.updateGalPreview = (...args) => window.AdminApp.content.updateGalPreview(...args);
window.uploadGaleriImageModal = (...args) => window.AdminApp.content.uploadGaleriImageModal(...args);
window.saveGaleriFromModal = (...args) => window.AdminApp.content.saveGaleriFromModal(...args);
window.deleteGaleriRecord = (...args) => window.AdminApp.content.deleteGaleriRecord(...args);
window.createDocFromModal = (...args) => window.AdminApp.content.createDocFromModal(...args);

window.uploadHeroImage = (...args) => window.AdminApp.system.uploadHeroImage(...args);
window.uploadToDrive = (...args) => window.AdminApp.system.uploadToDrive(...args);
window.runDatabaseInit = (...args) => window.AdminApp.system.runDatabaseInit(...args);
window.runSinkronCepat = (...args) => window.AdminApp.system.runSinkronCepat(...args);
window.runFullMigration = (...args) => window.AdminApp.system.runFullMigration(...args);
