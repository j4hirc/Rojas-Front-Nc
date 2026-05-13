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
        // En UserResponseDto, los roles vienen como un array de objetos
        const rolesNombres = user.roles.map(r => r.name.replace('ROLE_', '')).join(', ');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td> <td>${user.email}</td>
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
            <div class="card-header"><strong>${user.name}</strong></div> <p style="margin: 5px 0; font-size: 14px;">Email: ${user.email}</p>
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

// --- LÓGICA DEL MODAL Y CRUD ---

window.abrirModalCrear = () => {
    document.getElementById('formUsuario').reset();
    document.getElementById('userId').value = '';
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-user-plus"></i> Nuevo Usuario';
    document.getElementById('userPassword').setAttribute('required', 'true'); // Contraseña obligatoria al crear
    
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
            
            // SEPARAMOS EL NOMBRE COMPLETO ("Juan Perez" -> "Juan", "Perez")
            const nombreCompleto = data.name || '';
            const partesNombre = nombreCompleto.split(' ');
            const primerNombre = partesNombre[0] || '';
            const apellidos = partesNombre.slice(1).join(' ') || ''; // Todo lo que esté después del primer espacio será apellido
            
            document.getElementById('userDni').value = data.dni || '';
            document.getElementById('userFirstName').value = primerNombre;
            document.getElementById('userLastName').value = apellidos;
            document.getElementById('userEmail').value = data.email || '';
            document.getElementById('userPhone').value = data.phone || '';

            // NOTA: middleName, secondSurname, title, dateOfBirth, dateOfEntry y status 
            // no vienen en la respuesta de Spring Boot, por lo que el usuario tendrá que llenarlos al editar.

            // Marcamos los checkboxes según lo que devuelva el backend
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
    
    // Checkboxes seleccionados a Array
    const roleCheckboxes = document.querySelectorAll('input[name="userRoles"]:checked');
    const selectedRoles = Array.from(roleCheckboxes).map(cb => cb.value);

    if (selectedRoles.length === 0) {
        alert("Debes seleccionar al menos un rol para el usuario.");
        return;
    }

    // Armamos el UserRequestDto con todos los datos que pide Spring Boot
    const payload = {
        dni: document.getElementById('userDni').value,
        firstName: document.getElementById('userFirstName').value,
        middleName: document.getElementById('userMiddleName').value,
        lastName: document.getElementById('userLastName').value,
        secondSurname: document.getElementById('userSecondSurname').value,
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value || "123456", 
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
            await cargarUsuarios(); // Refresca la tabla automáticamente
        } else {
            const errorData = await response.json();
            alert("Error del backend: " + (errorData.message || "Verifica los datos y recuerda que el correo/DNI no debe estar duplicado"));
        }
    } catch (error) {
        console.error('Error al guardar:', error);
    }
};

window.eliminarUsuario = async (id) => { 
    if(confirm("¿Estás seguro de inhabilitar/eliminar a este usuario de la base de datos?")) {
        try {
            const response = await fetch(`${API_URL}/delete/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userToken}` }
            });

            if (response.ok) {
                alert("Usuario eliminado correctamente.");
                await cargarUsuarios();
            } else {
                alert("Hubo un error al eliminar al usuario.");
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