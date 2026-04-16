/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI - Admin Bootstrap
 * ================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const passInput = document.getElementById('passInput');
    if (passInput) passInput.placeholder = '........';

    const sessionToken = getAdminSessionToken();
    if (sessionToken) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        document.getElementById('adminNameTxt').textContent = localStorage.getItem('adminNama') || 'Admin';
        loadAllData();
        loadCMSData();
        loadLayananList();
    } else {
        localStorage.removeItem('adminPin');
    }
});
