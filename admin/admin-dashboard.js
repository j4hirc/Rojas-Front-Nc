document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!token || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        alert('Acceso denegado. Solo administradores.');
        window.location.href = '../index.html'; 
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    // Traemos usuarios para actualizar el contador de la tarjeta azul
    try {
        const response = await fetch('http://localhost:8081/api/v1/user/all-users', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const usuarios = await response.json();
            document.getElementById('stat-total-users').textContent = usuarios.length;
        }
    } catch (error) { console.error('Error:', error); }
});

window.cerrarSesion = () => {
    localStorage.clear();
    window.location.href = '../index.html';
};