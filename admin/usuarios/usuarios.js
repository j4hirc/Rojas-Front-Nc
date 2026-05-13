const API_URL = 'http://localhost:8081/api/v1/user';
let userToken = '';

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        alert('Acceso denegado.');
        window.location.href = '../index.html'; 
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    await cargarUsuarios();
});

async function cargarUsuarios() {
    try {
        const response = await fetch(`${API_URL}/all-users`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
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
        // Formateamos los roles quitando el prefijo ROLE_
        const rolesNombres = user.roles.map(r => r.name.replace('ROLE_', '')).join(', ');

        // Verificamos si está inactivo para pintarlo diferente (opcional)
        const estadoHTML = user.status === 'Unemployed' ? '<span style="color:red; font-size:12px;">(Inactivo)</span>' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.firstName} ${user.lastName} ${estadoHTML}</td>
            <td>${user.email}</td>
            <td>${user.phone}</td>
            <td><span class="badge rol">${rolesNombres}</span></td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditar(${user.userId})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete" onclick="eliminarUsuario(${user.userId})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header"><strong>${user.firstName} ${user.lastName} ${estadoHTML}</strong></div>
            <p style="margin: 5px 0; font-size: 14px;">Email: ${user.email}</p>
            <p style="margin: 5px 0; font-size: 14px;">Teléfono: ${user.phone}</p>
            <p style="margin: 5px 0; font-size: 14px;">Rol: <span class="badge rol">${rolesNombres}</span></p>
            <div class="card-actions">
                <button class="btn-edit" onclick="abrirModalEditar(${user.userId})">Editar</button>
                <button class="btn-delete" onclick="eliminarUsuario(${user.userId})">Eliminar</button>
            </div>
        `;
        mobileContainer.appendChild(card);
    });
}

// --- LOGICA DEL MODAL Y CRUD ---

window.abrirModalCrear = () => {
    document.getElementById('formUsuario').reset();
    document.getElementById('userId').value = '';
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-user-plus"></i> Nuevo Usuario';
    document.getElementById('userPassword').setAttribute('required', 'true');
    
    // Limpiamos los checkboxes
    document.querySelectorAll('input[name="userRoles"]').forEach(cb => cb.checked = false);
    
    document.getElementById('modalUsuario').style.display = 'flex';
};

window.abrirModalEditar = async (id) => {
    document.getElementById('formUsuario').reset();
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Usuario';
    document.getElementById('userId').value = id;
    document.getElementById('userPassword').removeAttribute('required'); // Al editar no es obligatoria la pass
    
    try {
        const response = await fetch(`${API_URL}/id-user/${id}`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if(response.ok) {
            const data = await response.json();
            
            // Llenamos el formulario con la data que ahora sí envía el Backend
            document.getElementById('userDni').value = data.dni || '';
            document.getElementById('userTitle').value = data.title || '';
            document.getElementById('userFirstName').value = data.firstName || '';
            document.getElementById('userMiddleName').value = data.middleName || '';
            document.getElementById('userLastName').value = data.lastName || '';
            document.getElementById('userSecondSurname').value = data.secondSurname || '';
            document.getElementById('userEmail').value = data.email || '';
            document.getElementById('userPhone').value = data.phone || '';
            document.getElementById('userBirth').value = data.dateOfBirth || '';
            document.getElementById('userEntry').value = data.dateOfEntry || '';
            document.getElementById('userStatus').value = data.status || 'Active';

            // Marcamos los checkboxes
            const checkboxes = document.querySelectorAll('input[name="userRoles"]');
            checkboxes.forEach(cb => {
                cb.checked = data.roles.some(r => r.name === cb.value);
            });

            document.getElementById('modalUsuario').style.display = 'flex';
        }
    } catch(error) {
        console.error("Error al obtener usuario:", error);
    }
};

window.cerrarModal = () => {
    document.getElementById('modalUsuario').style.display = 'none';
};

window.guardarUsuario = async () => {
    const id = document.getElementById('userId').value;
    const isEditing = id !== '';
    
    const roleCheckboxes = document.querySelectorAll('input[name="userRoles"]:checked');
    const selectedRoles = Array.from(roleCheckboxes).map(cb => cb.value);

    if (selectedRoles.length === 0) {
        alert("Debes seleccionar al menos un rol para el usuario.");
        return;
    }

    const payload = {
        dni: document.getElementById('userDni').value,
        firstName: document.getElementById('userFirstName').value,
        middleName: document.getElementById('userMiddleName').value,
        lastName: document.getElementById('userLastName').value,
        secondSurname: document.getElementById('userSecondSurname').value,
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value || "123456", // Valor por defecto si no cambian la contraseña
        phone: document.getElementById('userPhone').value,
        dateOfBirth: document.getElementById('userBirth').value,
        dateOfEntry: document.getElementById('userEntry').value,
        status: document.getElementById('userStatus').value,
        title: document.getElementById('userTitle').value,
        roles: selectedRoles 
    };

    const url = isEditing ? `${API_URL}/update-user/${id}` : `${API_URL}/create-user`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(isEditing ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito');
            cerrarModal();
            await cargarUsuarios();
        } else {
            const errorData = await response.json();
            alert("Error del backend: " + (errorData.message || "Verifica los datos"));
        }
    } catch (error) {
        console.error('Error al guardar:', error);
    }
};

window.eliminarUsuario = async (id) => { 
    if(confirm("¿Estás seguro de que quieres inhabilitar a este usuario?")) {
        try {
            // No tienes Endpoint DELETE, hacemos Soft Delete obteniendo al usuario y actualizando su status
            const resGet = await fetch(`${API_URL}/id-user/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` }});
            if(resGet.ok) {
                const user = await resGet.json();
                
                // Preparamos el objeto para actualizarlo a Unemployed (Inactivo)
                const payload = {
                    dni: user.dni, title: user.title, firstName: user.firstName, middleName: user.middleName,
                    lastName: user.lastName, secondSurname: user.secondSurname, email: user.email,
                    phone: user.phone, dateOfBirth: user.dateOfBirth, dateOfEntry: user.dateOfEntry,
                    password: "dummyPassword", // Solo para pasar la validación
                    status: 'Unemployed', // AQUÍ LO DAMOS DE BAJA
                    roles: user.roles.map(r => r.name) 
                };

                const resPut = await fetch(`${API_URL}/update-user/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                    body: JSON.stringify(payload)
                });

                if (resPut.ok) {
                    alert("Usuario inhabilitado correctamente.");
                    await cargarUsuarios();
                } else {
                    alert("Hubo un error al inhabilitar al usuario.");
                }
            }
        } catch (error) {
            console.error("Error al eliminar:", error);
        }
    }
};

window.cerrarSesion = () => {
    localStorage.clear();
    window.location.href = '../index.html';
};