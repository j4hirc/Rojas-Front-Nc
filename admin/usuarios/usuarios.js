document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!token || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        alert('Acceso denegado.');
        window.location.href = '../index.html'; 
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    await cargarUsuarios(token);
});

async function cargarUsuarios(token) {
    try {
        const response = await fetch('http://localhost:8081/api/v1/user/all-users', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const usuarios = await response.json();
            renderizarUsuarios(usuarios);
        }
    } catch (error) { console.error('Error de red:', error); }
}

function renderizarUsuarios(usuarios) {
    const tableBody = document.getElementById('userTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');
    tableBody.innerHTML = ''; mobileContainer.innerHTML = '';

    usuarios.forEach(user => {
        const rolesNombres = user.roles.map(r => r.name.replace('ROLE_', '')).join(', ');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.phone}</td>
            <td><span class="badge rol">${rolesNombres}</span></td>
            <td>
                <button class="btn-edit" onclick="editarUsuario(${user.userId})">✏️</button>
                <button class="btn-delete" onclick="eliminarUsuario(${user.userId})">🗑️</button>
            </td>
        `;
        tableBody.appendChild(tr);

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header"><strong>${user.name}</strong></div>
            <p style="margin: 5px 0; font-size: 14px;">Email: ${user.email}</p>
            <p style="margin: 5px 0; font-size: 14px;">Rol: <span class="badge rol">${rolesNombres}</span></p>
            <div class="card-actions">
                <button class="btn-edit" onclick="editarUsuario(${user.userId})">Editar</button>
                <button class="btn-delete" onclick="eliminarUsuario(${user.userId})">Eliminar</button>
            </div>
        `;
        mobileContainer.appendChild(card);
    });
}

window.editarUsuario = (id) => { console.log("Editar usuario con ID:", id); };
window.eliminarUsuario = (id) => { console.log("Eliminar usuario con ID:", id); };

window.cerrarSesion = () => {
    localStorage.clear();
    window.location.href = '../index.html';
};