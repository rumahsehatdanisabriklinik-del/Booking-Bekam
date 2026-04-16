/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Bootstrap
 * ================================================
 */

window.AdminApp.bootstrap = function bootstrapAdmin() {
    window.AdminApp.bindings.bindAdminEvents();

    const passInput = document.getElementById('passInput');
    if (passInput) passInput.placeholder = '........';

    const sessionToken = window.AdminApp.auth.getAdminSessionToken();
    if (sessionToken) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        document.getElementById('adminNameTxt').textContent = localStorage.getItem('adminNama') || 'Admin';
        window.AdminApp.loadAllData();
    } else {
        localStorage.removeItem('adminPin');
    }
};

document.addEventListener('DOMContentLoaded', window.AdminApp.bootstrap);
