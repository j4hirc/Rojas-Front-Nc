const API_URL = 'https://api-remomn.onrender.com/api/v1/user';
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

// --- RESUMEN DE BODEGA (Con navegación día por día, igual que Nómina) ---
let bodegaJobsCache = null;
let bodegaUsersCache = null;
let bodegaDiaOffset = 0;

window.verBodegaHoy = async () => {
    Swal.fire({ title: 'Cargando ordenes de bodega...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const token = localStorage.getItem('jwt_token');

        const [jobsRes, usersRes] = await Promise.all([
            fetch('https://api-remomn.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-remomn.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        bodegaJobsCache = await jobsRes.json();
        bodegaUsersCache = await usersRes.json();

        bodegaDiaOffset = 0; // Reiniciamos al día actual cada vez que se abre

        Swal.fire({
            title: '<i class="fa-solid fa-truck-fast" style="color:#F4A300;"></i> Ordenes de Bodega',
            html: '<div id="bodega-contenedor">Generando reporte...</div>',
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: '750px',
            background: '#FFFFFF'
        });

        renderizarBodega(bodegaDiaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la bodega.', confirmButtonColor: '#12CFF4' });
    }
};

window.cambiarDiaBodega = (delta) => {
    bodegaDiaOffset += delta;
    renderizarBodega(bodegaDiaOffset);
};

// Helpers de fecha (mismos criterios que la nómina)
function getFechaStrLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatMDYBodega(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function renderizarBodega(offset) {
    const fechaObjetivo = new Date();
    fechaObjetivo.setDate(fechaObjetivo.getDate() + offset);
    fechaObjetivo.setHours(12, 0, 0, 0);

    const fechaStrFiltro = getFechaStrLocal(fechaObjetivo);
    const fechaStrDisplay = formatMDYBodega(fechaObjetivo);

    let etiquetaDia = '';
    if (offset === 0) etiquetaDia = 'Hoy';
    else if (offset === 1) etiquetaDia = 'Mañana';
    else if (offset === -1) etiquetaDia = 'Ayer';
    else etiquetaDia = fechaObjetivo.toLocaleDateString('es-ES', { weekday: 'long' });
    etiquetaDia = etiquetaDia.charAt(0).toUpperCase() + etiquetaDia.slice(1);

    const jefeNombreCompleto = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`.trim().toLowerCase();

    let htmlContent = `
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; background: #F4F7FE; padding: 12px; border-radius: 12px; border: 1px solid #12CFF4; margin-bottom: 15px;">
        <button onclick="cambiarDiaBodega(-1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
            <i class="fa-solid fa-chevron-left"></i> Anterior
        </button>

        <div style="text-align: center; flex: 1; min-width: 140px;">
            <span style="display: block; font-size: 10px; color: #2E3238; text-transform: uppercase; font-weight: bold;">${etiquetaDia}</span>
            <span id="lblFechaBodega" style="font-size: 13px; color: #0F2D4A;"><b>${fechaStrDisplay}</b></span>
        </div>

        <button type="button" onclick="exportarBodegaPdf()" style="background: #d32f2f; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px;">
            <i class="fa-solid fa-file-pdf"></i> PDF
        </button>

        <button onclick="cambiarDiaBodega(1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
            Siguiente <i class="fa-solid fa-chevron-right"></i>
        </button>
    </div>`;

    const itemsDelDia = bodegaJobsCache.filter(job => {
        const jobManagerName = (job.nameManager || "").trim().toLowerCase();
        const esDeEsteJefe = (jobManagerName === jefeNombreCompleto) || (job.managerId == miUsuarioActual.userId);

        if (!esDeEsteJefe || !['PENDING', 'IN_PROGRESS'].includes(job.status)) return false;

        let jobDateStr = Array.isArray(job.jobDate)
            ? `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2, '0')}-${String(job.jobDate[2]).padStart(2, '0')}`
            : job.jobDate;

        return jobDateStr === fechaStrFiltro;
    });

    if (itemsDelDia.length === 0) {
        htmlContent += `<p style="color:#888; font-style:italic; padding:10px; text-align:center;">No hay trabajos programados para este día.</p>`;
    } else {
        htmlContent += `<div id="bodega-lista-dia" style="max-height: 420px; overflow-y: auto; border: 1px solid #D4D4D4; border-radius: 8px;">`;

        itemsDelDia.forEach(job => {
            const empleado = bodegaUsersCache.find(u => u.userId == job.employeeId);
            const nombreEmpleado = empleado
                ? `${empleado.firstName} ${empleado.lastName}`
                : `ID: ${job.employeeId}`;

            // --- Estado del proyecto (mismo estilo que las otras vistas) ---
            let statusBadge = '';
            if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Pendiente</span>`;
            else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">En Progreso</span>`;
            else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Completado</span>`;
            else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Cancelado</span>`;

            // --- Descripción limpia (sin el bloque de materiales pre-asignados en texto) ---
            let descBodega = job.description ? job.description : '';
            if (descBodega.includes('[MATERIALES PRE-ASIGNADOS]:')) {
                descBodega = descBodega.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
            }

            // --- Combinamos materiales pre-asignados (jefe/admin) + necesarios (puede agregar el subcontratista) ---
            const materialesCombinados = {};

            (job.materials || []).forEach(mat => {
                const id = mat.materialId;
                materialesCombinados[id] = {
                    name: mat.name || mat.material || 'Material',
                    quantity: parseFloat(mat.quantity || mat.cant || 1),
                    unit: mat.unit || '',
                    origen: 'Pre-asignado'
                };
            });

            (job.necessaryMaterials || []).forEach(mat => {
                const id = mat.materialId;
                if (materialesCombinados[id]) {
                    // Si ya existía, actualizamos cantidad por si el subcontratista la cambió
                    materialesCombinados[id].quantity = parseFloat(mat.quantity || 1);
                    materialesCombinados[id].unit = mat.unit || materialesCombinados[id].unit;
                } else {
                    materialesCombinados[id] = {
                        name: mat.name || 'Material',
                        quantity: parseFloat(mat.quantity || 1),
                        unit: mat.unit || '',
                        origen: 'Agregado por subcontratista'
                    };
                }
            });

            const listaMateriales = Object.values(materialesCombinados);

            htmlContent += `
        <div style="padding: 14px; border-bottom: 1px solid #eee; background: #f8faff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
                <strong style="color: #0F2D4A;">${job.clientName || 'Cliente sin nombre'}</strong>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${statusBadge}
                    <span style="color: #F4A300; font-weight: bold;">${nombreEmpleado}</span>
                </div>
            </div>
            ${descBodega ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #777; font-style: italic;">${descBodega}</p>` : ''}`;

            if (listaMateriales.length > 0) {
                htmlContent += `<ul style="padding-left: 20px; margin: 6px 0;">`;
                listaMateriales.forEach(mat => {
                    const etiquetaOrigen = mat.origen === 'Agregado por subcontratista'
                        ? `<span style="color:#e65100; font-size:11px; font-weight:600;"> (agregado por subcontratista)</span>`
                        : '';
                    htmlContent += `<li><strong>${mat.name}</strong> — ${mat.quantity} ${mat.unit}${etiquetaOrigen}</li>`;
                });
                htmlContent += `</ul>`;
            } else {
                htmlContent += `<p style="color:#999; font-size:13px;">Sin materiales registrados</p>`;
            }

            htmlContent += `</div>`;
        });

        htmlContent += `</div>`;
    }

    const contenedor = document.getElementById('bodega-contenedor');
    if (contenedor) contenedor.innerHTML = htmlContent;
}

// ==================== EXPORTAR PDF ====================
window.exportarBodegaPdf = () => {
    const listaDia = document.getElementById('bodega-lista-dia');
    if (!listaDia) return Swal.fire('Error', 'No hay trabajos para exportar en este día.', 'error');

    const lblFecha = document.getElementById('lblFechaBodega');
    const textoFecha = lblFecha ? lblFecha.textContent.trim() : new Date().toISOString().split('T')[0];
    const nombreArchivoClean = textoFecha.replace(/[\/]/g, '-');

    const nombreJefe = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`;

    const contenedorImpresion = document.createElement('div');
    contenedorImpresion.style.padding = "30px";
    contenedorImpresion.style.fontFamily = "'Poppins', sans-serif";
    contenedorImpresion.style.background = "#ffffff";

    contenedorImpresion.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #12CFF4; padding-bottom: 15px;">
            <h1 style="color: #0B0B0D; margin: 0;">ORDENES DE BODEGA</h1>
            <p style="margin: 8px 0 0 0; color: #12CFF4; font-weight: bold;">Jefe: ${nombreJefe}</p>
            <p style="margin: 5px 0 0 0; color: #555;">${textoFecha}</p>
        </div>
        ${listaDia.innerHTML}
        <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
            Reporte generado por el Portal RemoMN
        </div>
    `;

    const opt = {
        margin: [15, 15, 15, 15],
        filename: `Ordenes_Bodega_${nombreArchivoClean}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({ title: 'Generando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    html2pdf().set(opt).from(contenedorImpresion).save()
        .then(() => Swal.close())
        .catch(() => Swal.fire('Error', 'No se pudo generar el PDF', 'error'));
};

window.cerrarSesion = () => {
    const rolesString = localStorage.getItem('user_roles');
    let userRoles = [];
    if (rolesString) { 
        try { userRoles = JSON.parse(rolesString); } catch(e) { console.error("Error al leer roles"); } 
    }

    if (userRoles.length > 1) {
        Swal.fire({
            title: "¿Qué deseas hacer?",
            text: "Selecciona si deseas salir del sistema o cambiar tu rol de trabajo.",
            icon: "question",
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: "#12CFF4",
            denyButtonColor: "#00B8A9",
            cancelButtonColor: "#2E3238",
            confirmButtonText: "Sí, salir",
            denyButtonText: "Cambiar de Rol",
            cancelButtonText: "Cancelar"
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = '../../index.html';
            } else if (result.isDenied) {
                mostrarSelectorDeRolesDesdeJefe(userRoles, true);
            }
        });
    } else {
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
    }
};



// Declararla en window asegura que esté disponible globalmente en todo el script
window.mostrarSelectorDeRolesDesdeJefe = (roles, esSubcarpeta) => {
    if (typeof cerrarModalPerfil === 'function') {
        cerrarModalPerfil(); 
    } else {
        const modales = document.querySelectorAll('.modal-overlay');
        modales.forEach(m => m.style.display = 'none');
    }

    const prefijoRaiz = esSubcarpeta ? '../../' : '../';
    const prefijoJefe = esSubcarpeta ? '../' : '';

    const contenedor = document.createElement('div');
    contenedor.style.display = 'flex';
    contenedor.style.flexDirection = 'column';
    contenedor.style.gap = '10px';
    contenedor.style.marginTop = '15px';

    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';
        
        if (rol === 'ROLE_ADMIN') { 
            nombreRol = 'Acceder como Administrador'; 
            url = `${prefijoRaiz}admin/admin-dashboard.html`; 
        }
        if (rol === 'ROLE_JEFE') { 
            nombreRol = 'Acceder como Manager'; 
            url = `${prefijoJefe}jefe-dashboard.html`; 
        }
        if (rol === 'ROLE_EMPLOYEE') { 
            nombreRol = 'Acceder como Subcontratista'; 
            url = `${prefijoRaiz}employee/employee-dashboard.html`; 
        }

        if (nombreRol) {
            const boton = document.createElement('button');
            boton.className = 'swal2-confirm swal2-styled';
            boton.style.width = '100%';
            boton.style.margin = '0';
            boton.style.backgroundColor = '#00B8A9';
            boton.style.cursor = 'pointer';
            boton.textContent = nombreRol;
            
            boton.addEventListener('click', () => {
                window.location.href = url;
            });

            contenedor.appendChild(boton);
        }
    });

    Swal.fire({
        title: 'Selecciona tu área de trabajo',
        html: contenedor, 
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#2E3238'
    });
};