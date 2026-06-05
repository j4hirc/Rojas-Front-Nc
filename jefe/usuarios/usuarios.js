const API_URL = 'http://localhost:8081/api/v1/user';
let userToken = '';
let todosLosUsuariosCache = []; 

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    // AQUÍ ESTABA EL ERROR: Cambiado a ROLE_JEFE
    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo los Jefes pueden acceder a esta sección.',
            confirmButtonColor: '#198754'
        }).then(() => {
            window.location.href = '../../index.html'; // RUTA CORREGIDA
        });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Jefe';

    await cargarUsuariosDesdeAPI();
});

async function cargarUsuariosDesdeAPI() {
    try {
        const response = await fetch(`${API_URL}/all-users`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (response.ok) {
            todosLosUsuariosCache = await response.json();
            cargarUsuarios(); 
        }
    } catch (error) { 
        console.error('Error de red:', error);
        Swal.fire('Error de conexión', 'No se pudieron cargar los usuarios de la base de datos.', 'error');
    }
}

window.cargarUsuarios = () => {
    const dniBuscado = document.getElementById('buscadorDni').value.trim();
    if(dniBuscado !== "") {
        buscarPorDni();
        return;
    }

    const estadoFiltro = document.getElementById('filtroEstado').value;
    let usuariosAFiltrar = todosLosUsuariosCache;
    
    if (estadoFiltro !== 'All') {
        usuariosAFiltrar = todosLosUsuariosCache.filter(user => user.status === estadoFiltro);
    }
    
    renderizarUsuarios(usuariosAFiltrar);
};

window.buscarPorDni = () => {
    const inputDni = document.getElementById('buscadorDni').value.trim();
    if(inputDni === "") {
        cargarUsuarios();
        return;
    }
    const usuariosEncontrados = todosLosUsuariosCache.filter(user => user.dni && user.dni.includes(inputDni));
    renderizarUsuarios(usuariosEncontrados);
}

function renderizarUsuarios(usuarios) {
    const tableBody = document.getElementById('userTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');
    tableBody.innerHTML = ''; mobileContainer.innerHTML = '';

    if(usuarios.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No se encontraron usuarios.</td></tr>`;
        return;
    }

    usuarios.forEach(user => {
        const rolesNombres = user.roles.map(r => r.name.replace('ROLE_', '')).join(', ');
        const isUnemployed = user.status === 'Unemployed';
        
        const nombreMostrar = (user.firstName && user.lastName) 
            ? `${user.firstName} ${user.lastName}` : (user.name || 'Sin Nombre');

        const estadoHTML = isUnemployed 
            ? '<span style="color:#d32f2f; font-size:12px; font-weight:bold;">(Desempleado)</span>' 
            : '<span style="color:#2e7d32; font-size:12px; font-weight:bold;">(Activo)</span>';

        const actionBtn = isUnemployed
            ? `<button class="btn-edit" style="background:#E8F5E9; color:#2e7d32; border:1px solid #2e7d32;" onclick="cambiarEstadoUsuario(${user.userId}, 'Active')" title="Re-emplear"><i class="fa-solid fa-user-check"></i></button>`
            : `<button class="btn-delete" style="background:#FFEBEE; color:#d32f2f; border:1px solid #d32f2f;" onclick="cambiarEstadoUsuario(${user.userId}, 'Unemployed')" title="Desemplear"><i class="fa-solid fa-user-minus"></i></button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${nombreMostrar} <br><small style="color: #666;">DNI: ${user.dni || 'N/A'}</small></td>
            <td>${user.email}</td>
            <td>${user.phone}</td>
            <td><span class="badge rol">${rolesNombres}</span><br>${estadoHTML}</td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditar(${user.userId})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                ${actionBtn}
            </td>
        `;
        tableBody.appendChild(tr);

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header"><strong>${nombreMostrar}</strong> ${estadoHTML}</div>
            <p style="margin: 5px 0; font-size: 14px;"><strong>DNI:</strong> ${user.dni || 'N/A'}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Tel:</strong> ${user.phone}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Rol:</strong> <span class="badge rol">${rolesNombres}</span></p>
            <div class="card-actions">
                <button class="btn-edit" onclick="abrirModalEditar(${user.userId})">Editar</button>
                ${actionBtn}
            </div>
        `;
        mobileContainer.appendChild(card);
    });
}

window.cambiarEstadoUsuario = async (id, nuevoEstado) => {
    const esDesempleo = nuevoEstado === 'Unemployed';
    
    Swal.fire({
        title: esDesempleo ? '¿Desemplear usuario?' : '¿Re-emplear usuario?',
        text: esDesempleo ? "El usuario ya no tendrá acceso activo." : "El usuario recuperará sus accesos.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: esDesempleo ? '#d33' : '#2e7d32',
        cancelButtonColor: '#6c757d',
        confirmButtonText: esDesempleo ? 'Sí, desemplear' : 'Sí, emplear',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const resGet = await fetch(`${API_URL}/id-user/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` }});
                if(resGet.ok) {
                    const user = await resGet.json();
                    const payload = {
                        dni: user.dni, title: user.title, firstName: user.firstName, middleName: user.middleName,
                        lastName: user.lastName, secondSurname: user.secondSurname, email: user.email,
                        phone: user.phone, dateOfBirth: user.dateOfBirth, dateOfEntry: user.dateOfEntry,
                        password: "", 
                        status: nuevoEstado, roles: user.roles.map(r => r.name) 
                    };

                    const resPut = await fetch(`${API_URL}/update-user/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                        body: JSON.stringify(payload)
                    });

                    if (resPut.ok) {
                        Swal.fire('¡Éxito!', `Usuario ha sido ${esDesempleo ? 'dado de baja' : 'reactivado'} correctamente.`, 'success');
                        await cargarUsuariosDesdeAPI(); 
                    } else {
                        Swal.fire('Error', 'Hubo un problema al cambiar el estado del usuario.', 'error');
                    }
                }
            } catch (error) {
                console.error("Error en cambiar estado:", error);
            }
        }
    });
};

window.abrirModalCrear = () => {
    document.getElementById('formUsuario').reset();
    document.getElementById('userId').value = '';
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-user-plus"></i> Nuevo Usuario';
    
    document.getElementById('userPassword').setAttribute('required', 'true');
    document.getElementById('userPassword').placeholder = "Requerida para nuevos usuarios";
    
    document.querySelectorAll('input[name="userRoles"]').forEach(cb => cb.checked = false);
    document.getElementById('modalUsuario').style.display = 'flex';
};

window.abrirModalEditar = async (id) => {
    document.getElementById('formUsuario').reset();
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Usuario';
    document.getElementById('userId').value = id;
    
    document.getElementById('userPassword').removeAttribute('required'); 
    document.getElementById('userPassword').placeholder = "Dejar en blanco para no cambiarla";
    
    try {
        const response = await fetch(`${API_URL}/id-user/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if(response.ok) {
            const data = await response.json();
            
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

            const checkboxes = document.querySelectorAll('input[name="userRoles"]');
            checkboxes.forEach(cb => { cb.checked = data.roles.some(r => r.name === cb.value); });

            document.getElementById('modalUsuario').style.display = 'flex';
        }
    } catch(error) { console.error("Error al obtener usuario:", error); }
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
        return Swal.fire('Faltan datos', 'Debes seleccionar al menos un rol para el usuario.', 'warning');
    }

    const dniInput = document.getElementById('userDni').value.trim();
    if(!/^\d{10}$/.test(dniInput)){
        return Swal.fire('DNI Inválido', 'El DNI debe contener exactamente 10 números.', 'warning');
    }

    const passwordInput = document.getElementById('userPassword').value;
    if (!isEditing && passwordInput.trim() === "") {
        return Swal.fire('Faltan datos', 'La contraseña es obligatoria para usuarios nuevos.', 'warning');
    }

    const birthDateInput = document.getElementById('userBirth').value;
    const entryDateInput = document.getElementById('userEntry').value;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if(birthDateInput) {
        const fechaNacimiento = new Date(birthDateInput);
        let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
        const mes = hoy.getMonth() - fechaNacimiento.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) { edad--; }
        if (edad < 18) {
            return Swal.fire('Edad Inválida', 'El usuario debe ser mayor de 18 años.', 'warning');
        }
    }

    if(entryDateInput) {
        const parts = entryDateInput.split('-');
        const fechaIngreso = new Date(parts[0], parts[1] - 1, parts[2]);
        if (fechaIngreso > hoy) {
            return Swal.fire('Fecha Inválida', 'La fecha de ingreso no puede ser en el futuro.', 'warning');
        }
    }

    const payload = {
        dni: dniInput,
        firstName: document.getElementById('userFirstName').value.trim(),
        middleName: document.getElementById('userMiddleName').value.trim(),
        lastName: document.getElementById('userLastName').value.trim(),
        secondSurname: document.getElementById('userSecondSurname').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        password: passwordInput, 
        phone: document.getElementById('userPhone').value.trim(),
        dateOfBirth: birthDateInput,
        dateOfEntry: entryDateInput,
        status: document.getElementById('userStatus').value,
        title: document.getElementById('userTitle').value.trim(),
        roles: selectedRoles 
    };

    const url = isEditing ? `${API_URL}/update-user/${id}` : `${API_URL}/create-user`;
    const method = isEditing ? 'PUT' : 'POST';

   try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            Swal.fire('¡Éxito!', isEditing ? 'Usuario actualizado.' : 'Usuario registrado.', 'success');
            cerrarModal();
            document.getElementById('buscadorDni').value = "";
            await cargarUsuariosDesdeAPI(); 
        } else {
            const errorData = await response.json();
            let errorMessage = 'Verifica los datos enviados.';

            // Verificamos si el mensaje es un objeto de errores de validación de Spring Boot
            if (errorData.message && typeof errorData.message === 'object') {
                // Extraemos todos los valores del objeto y los unimos con un salto de línea
                errorMessage = Object.values(errorData.message).join('<br>');
            } else if (errorData.message) {
                // Si es un error general en formato string
                errorMessage = errorData.message;
            }

            // Usamos la propiedad 'html' en lugar del texto simple para soportar los saltos de línea
            Swal.fire({
                title: 'Error de validación',
                html: errorMessage,
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error al guardar:', error);
        Swal.fire('Fallo de conexión', 'No se pudo contactar con el servidor.', 'error');
    }
};

window.cerrarSesion = () => {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del sistema?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#198754",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../../index.html';
        }
    });
};