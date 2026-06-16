const API_URL = 'http://localhost:8081/api/v1/user';
let userToken = '';
let todosLosUsuariosCache = []; 

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    // ¡CORREGIDO! Ahora sí valida estrictamente que seas JEFE
    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo los Jefes pueden acceder a esta sección.',
            confirmButtonColor: '#12CFF4'
        }).then(() => {
            window.location.href = '../../index.html'; 
        });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Jefe';

    await cargarUsuariosDesdeAPI();
});

// TRAEMOS A TODOS (ACTIVOS Y DESEMPLEADOS) PARA QUE EL FILTRO NO FALLE
async function cargarUsuariosDesdeAPI() {
    try {
        Swal.fire({ title: 'Cargando tu personal...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        // 1. Pedimos los Activos
        const resActivos = await fetch(`${API_URL}/all-users`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        let usuariosActivos = resActivos.ok ? await resActivos.json() : [];

        // 2. Pedimos los Desempleados (Inactivos)
        let usuariosInactivos = [];
        try {
            const resInactivos = await fetch(`${API_URL}/all-unemployed`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (resInactivos.ok) {
                usuariosInactivos = await resInactivos.json();
            }
        } catch (e) {
            console.warn("No se encontraron inactivos o el endpoint falló.");
        }

        // 3. Mezclamos todo y evitamos duplicados
        let todos = [...usuariosActivos, ...usuariosInactivos];
        const map = new Map();
        todos.forEach(u => map.set(u.userId, u));
        todosLosUsuariosCache = Array.from(map.values());

        Swal.close();

        // Ponemos el selector en Activos por defecto y pintamos
        document.getElementById('filtroEstado').value = 'Active';
        cargarUsuarios(); 

    } catch (error) { 
        console.error('Error de red:', error);
        Swal.fire({ icon: 'error', title: 'Error de conexión', text: 'No se pudieron cargar los usuarios de la base de datos.', confirmButtonColor: '#12CFF4' });
    }
}

// ESTA FUNCIÓN PINTA LOS USUARIOS SEGÚN EL SELECTOR
window.cargarUsuarios = () => {
    const estadoFiltro = document.getElementById('filtroEstado').value;
    const dniBuscado = document.getElementById('buscadorDni').value.trim().toLowerCase();

    let usuariosAFiltrar = todosLosUsuariosCache;
    
    // Filtramos usando "toUpperCase" para evitar errores de mayúsculas/minúsculas de la BD
    if (estadoFiltro === 'Active') {
        usuariosAFiltrar = todosLosUsuariosCache.filter(user => !user.status || user.status.toUpperCase() === 'ACTIVE');
    } else if (estadoFiltro === 'Unemployed') {
        usuariosAFiltrar = todosLosUsuariosCache.filter(user => user.status && (user.status.toUpperCase() === 'UNEMPLOYED' || user.status.toUpperCase() === 'INACTIVE'));
    }

    if (dniBuscado !== "") {
        usuariosAFiltrar = usuariosAFiltrar.filter(user => user.dni && user.dni.toLowerCase().includes(dniBuscado));
    }
    
    renderizarUsuarios(usuariosAFiltrar);
};

// Se llama cuando escriben en el buscador
window.buscarPorDni = () => {
    cargarUsuarios();
};

function renderizarUsuarios(usuarios) {
    const tableBody = document.getElementById('userTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');
    tableBody.innerHTML = ''; mobileContainer.innerHTML = '';

    if(usuarios.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #8a9099;">No se encontraron usuarios en esta categoría.</td></tr>`;
        return;
    }

    usuarios.forEach(user => {
        const rolesNombres = user.roles.map(r => r.name.replace('ROLE_', '')).join(', ');
        
        // Identificamos Desempleados sin importar mayúsculas/minúsculas
        const isUnemployed = user.status && (user.status.toUpperCase() === 'UNEMPLOYED' || user.status.toUpperCase() === 'INACTIVE');
        
        const nombreMostrar = (user.firstName && user.lastName) 
            ? `${user.firstName} ${user.lastName}` : (user.name || 'Sin Nombre');

        const estadoHTML = isUnemployed 
            ? '<span style="color:#d32f2f; font-size:12px; font-weight:bold;"><i class="fa-solid fa-circle-xmark"></i> Desempleado</span>' 
            : '<span style="color:#2e7d32; font-size:12px; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> Activo</span>';

        const actionBtn = isUnemployed
            ? `<button class="btn-edit" style="background:#E8F5E9; color:#2e7d32; border:1px solid #2e7d32;" onclick="cambiarEstadoUsuario(${user.userId}, 'Active')" title="Re-emplear"><i class="fa-solid fa-user-check"></i></button>`
            : `<button class="btn-delete" style="background:#FFEBEE; color:#d32f2f; border:1px solid #d32f2f;" onclick="cambiarEstadoUsuario(${user.userId}, 'Unemployed')" title="Desemplear"><i class="fa-solid fa-user-minus"></i></button>`;

        // Si está desempleado la fila se pinta rojiza
        const trStyle = isUnemployed ? 'background-color: #FBE9E7; opacity: 0.85;' : '';

        const tr = document.createElement('tr');
        tr.style = trStyle;
        tr.innerHTML = `
            <td style="color: ${isUnemployed ? '#d32f2f' : '#2E3238'}; font-weight: ${isUnemployed ? 'bold' : 'normal'};">
                ${nombreMostrar} <br><small style="color: #666;">DNI: ${user.dni || 'N/A'}</small>
            </td>
            <td>${user.email}</td>
            <td>${user.phone}</td>
            <td><span class="badge rol">${rolesNombres}</span><br>${estadoHTML}</td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditar(${user.userId})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                ${actionBtn}
            </td>
        `;
        tableBody.appendChild(tr);

        // Versión móvil
        const cardStyle = isUnemployed ? 'border: 2px solid #d32f2f; background-color: #FBE9E7;' : '';
        const card = document.createElement('div');
        card.className = 'card';
        card.style = cardStyle;
        card.innerHTML = `
            <div class="card-header">
                <strong style="color: ${isUnemployed ? '#d32f2f' : '#0B0B0D'};">${nombreMostrar}</strong> 
                ${estadoHTML}
            </div>
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
        cancelButtonColor: '#2E3238',
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
                        Swal.fire({ icon: 'success', title: '¡Éxito!', text: `Usuario ha sido ${esDesempleo ? 'dado de baja' : 'reactivado'} correctamente.`, confirmButtonColor: '#12CFF4' });
                        await cargarUsuariosDesdeAPI(); 
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un problema al cambiar el estado del usuario.', confirmButtonColor: '#12CFF4' });
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
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-user-plus" style="color:#12CFF4;"></i> Nuevo Usuario';
    
    document.getElementById('userPassword').setAttribute('required', 'true');
    document.getElementById('userPassword').placeholder = "Requerida para nuevos usuarios";
    
    document.querySelectorAll('input[name="userRoles"]').forEach(cb => cb.checked = false);
    document.getElementById('modalUsuario').style.display = 'flex';
};

window.abrirModalEditar = async (id) => {
    document.getElementById('formUsuario').reset();
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen-to-square" style="color:#12CFF4;"></i> Editar Usuario';
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

    const firstName = document.getElementById('userFirstName').value.trim();
    const lastName = document.getElementById('userLastName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const title = document.getElementById('userTitle').value.trim();
    const birthDateInput = document.getElementById('userBirth').value;
    const entryDateInput = document.getElementById('userEntry').value;
    const dniInput = document.getElementById('userDni').value.trim();

    if(!firstName || !lastName || !email || !phone || !title || !birthDateInput || !entryDateInput || !dniInput) {
        return Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Por favor, llena todos los campos obligatorios.', confirmButtonColor: '#12CFF4' });
    }

    if (selectedRoles.length === 0) {
        return Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Debes seleccionar al menos un rol para el usuario.', confirmButtonColor: '#12CFF4' });
    }

    if(!/^\d{10}$/.test(dniInput)){
        return Swal.fire({ icon: 'warning', title: 'DNI Inválido', text: 'El DNI debe contener exactamente 10 números.', confirmButtonColor: '#12CFF4' });
    }

    const passwordInput = document.getElementById('userPassword').value;
    if (!isEditing && passwordInput.trim() === "") {
        return Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'La contraseña es obligatoria para usuarios nuevos.', confirmButtonColor: '#12CFF4' });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaNacimiento = new Date(birthDateInput);
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) { edad--; }
    if (edad < 18) {
        return Swal.fire({ icon: 'warning', title: 'Edad Inválida', text: 'El usuario debe ser mayor de 18 años.', confirmButtonColor: '#12CFF4' });
    }

    const parts = entryDateInput.split('-');
    const fechaIngreso = new Date(parts[0], parts[1] - 1, parts[2]);
    if (fechaIngreso > hoy) {
        return Swal.fire({ icon: 'warning', title: 'Fecha Inválida', text: 'La fecha de ingreso no puede ser en el futuro.', confirmButtonColor: '#12CFF4' });
    }

    const payload = {
        dni: dniInput,
        firstName: firstName,
        middleName: document.getElementById('userMiddleName').value.trim(),
        lastName: lastName,
        secondSurname: document.getElementById('userSecondSurname').value.trim(),
        email: email,
        password: passwordInput,
        phone: phone,
        dateOfBirth: birthDateInput,
        dateOfEntry: entryDateInput,
        status: document.getElementById('userStatus').value,
        title: title,
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
            Swal.fire({ icon: 'success', title: '¡Éxito!', text: isEditing ? 'Usuario actualizado.' : 'Usuario registrado.', confirmButtonColor: '#12CFF4' });
            cerrarModal();
            document.getElementById('buscadorDni').value = "";
            await cargarUsuariosDesdeAPI(); 
        } else {
            let errorText = 'Por favor verifica los datos.';
            try {
                const errorData = await response.json();
                if (errorData && errorData.message) {
                    if (typeof errorData.message === 'object') {
                        let mensajes = [];
                        for (let key in errorData.message) {
                            mensajes.push(`<b>${key}:</b> ${errorData.message[key]}`);
                        }
                        errorText = mensajes.join('<br>');
                    } else {
                        errorText = String(errorData.message);
                    }
                } 
            } catch(e) { console.error("No se pudo leer el error del servidor", e); }

            Swal.fire({ icon: 'error', title: 'Error de validación', html: String(errorText), confirmButtonColor: '#12CFF4' });
        }
    } catch (error) {
        console.error('Error al guardar:', error);
        Swal.fire({ icon: 'error', title: 'Fallo de conexión', text: 'No se pudo contactar con el servidor.', confirmButtonColor: '#12CFF4' });
    }
};

window.cerrarSesion = () => {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del sistema?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#12CFF4",
        cancelButtonColor: "#2E3238",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../../index.html';
        }
    });
};