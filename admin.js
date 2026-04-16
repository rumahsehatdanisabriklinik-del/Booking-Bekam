/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Bootstrap
 * ================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    window.AdminApp.bindAdminEvents();

    const passInput = document.getElementById('passInput');
    if (passInput) passInput.placeholder = '........';

    const sessionToken = getAdminSessionToken();
    if (sessionToken) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        document.getElementById('adminNameTxt').textContent = localStorage.getItem('adminNama') || 'Admin';
        window.AdminApp.loadAllData();
        window.AdminApp.cms.loadCMSData();
        window.AdminApp.cms.loadLayananList();
    } else {
        localStorage.removeItem('adminPin');
    }
});
