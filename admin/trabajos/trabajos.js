    const API_URL = 'http://localhost:8081/api/v1/jobs';
const USERS_URL = 'http://localhost:8081/api/v1/user/all-users';
const MATERIALS_URL = 'http://localhost:8081/api/v1/materials/all';
let userToken = '';

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para acceder a esta sección.',
            confirmButtonColor: '#0f4c81'
        }).then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    await cargarUsuariosYMateriales(); // Llenamos selects y checkboxes primero
    await cargarTrabajos();            // Luego cargamos la tabla
});

// 1. CARGAR SELECTS DE USUARIOS Y CHECKBOXES DE MATERIALES
async function cargarUsuariosYMateriales() {
    try {
        // Cargar Usuarios
        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (resUsers.ok) {
            const users = await resUsers.json();
            const selectEmp = document.getElementById('jobEmployee');
            const selectMan = document.getElementById('jobManager');
            selectEmp.innerHTML = '<option value="">-- Seleccione Empleado --</option>';
            selectMan.innerHTML = '<option value="">-- Seleccione Manager --</option>';
            
            // Asumiendo que cualquier usuario activo puede ser elegido, si quieres filtrar por rol, puedes agregar un 'if' aquí
            users.filter(u => u.status !== 'Unemployed').forEach(u => {
                selectEmp.innerHTML += `<option value="${u.userId}">${u.name}</option>`;
                selectMan.innerHTML += `<option value="${u.userId}">${u.name}</option>`;
            });
        }

        // Cargar Materiales
        const resMat = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (resMat.ok) {
            const materials = await resMat.json();
            const containerMat = document.getElementById('materialsContainer');
            containerMat.innerHTML = '';
            
            if (materials.length === 0) {
                containerMat.innerHTML = '<span style="color:#666;">No hay materiales en inventario.</span>';
            } else {
                materials.forEach(mat => {
                    containerMat.innerHTML += `
                        <label style="display: block; margin-bottom: 5px; cursor: pointer; color: #2b3674; font-size: 14px;">
                            <input type="checkbox" name="jobMaterials" value="${mat.materialId}"> 
                            ${mat.name} <small style="color:#A3AED0;">(Stock: ${mat.stock || 'N/A'})</small>
                        </label>
                    `;
                });
            }
        }
    } catch (e) { console.error("Error cargando dependencias", e); }
}

// 2. CARGAMOS LA TABLA DE TRABAJOS
async function cargarTrabajos() {
    try {
        const response = await fetch(`${API_URL}/all`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (response.ok) {
            const trabajos = await response.json();
            renderizarTrabajos(trabajos);
        }
    } catch (error) { 
        Swal.fire('Error de conexión', 'No se pudo cargar la lista de trabajos.', 'error');
    }
}

function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    tbody.innerHTML = ''; 
    
    if(trabajos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay trabajos registrados.</td></tr>`;
        return;
    }

    trabajos.forEach(job => {
        // Estilo del badge según estado
        let statusBadge = '';
        if(job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
        else if(job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
        else if(job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
        else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;

        const safeDesc = job.description ? job.description.replace(/'/g, "\\'") : '';
        const empName = job.nameEmployee || 'Sin asignar';
        const manName = job.nameManager || 'Sin asignar';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${job.clientName}</strong><br>
                <small style="color:#666;"><i class="fa-solid fa-phone"></i> ${job.clientPhone}</small>
            </td>
            <td>
                ${job.address}<br>
                <small style="color:#A3AED0;">Lat: ${job.latitude}, Lng: ${job.longitude}</small>
            </td>
            <td>
                <span style="color:#0f4c81; font-weight: 500;">E: ${empName}</span><br>
                <span style="color:#546e7a; font-size: 13px;">M: ${manName}</span>
            </td>
            <td>${statusBadge}</td>
            <td style="font-weight: bold; color: #2e7d32;">$${job.pay.toFixed(2)}</td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- LOGICA DEL MODAL Y CRUD ---

window.abrirModalCrearJob = () => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = '';
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => cb.checked = false);
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-hammer"></i> Nuevo Trabajo';
    document.getElementById('modalJob').style.display = 'flex';
};

window.abrirModalEditarJob = async (id) => {
    document.getElementById('formJob').reset();
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => cb.checked = false);
    document.getElementById('jobId').value = id;
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Trabajo';
    
    try {
        const response = await fetch(`${API_URL}/find-id/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` } });

        if(response.ok) {
            const data = await response.json();
            
            document.getElementById('jobClientName').value = data.clientName;
            document.getElementById('jobClientPhone').value = data.clientPhone;
            document.getElementById('jobDesc').value = data.description;
            document.getElementById('jobAddress').value = data.address;
            document.getElementById('jobLat').value = data.latitude;
            document.getElementById('jobLng').value = data.longitude;
            document.getElementById('jobSafeBox').value = data.safeDepositBoxCodes || '';
            document.getElementById('jobPay').value = data.pay;
            document.getElementById('jobStatus').value = data.status || 'PENDING';
            
            document.getElementById('jobEmployee').value = data.employeeId;
            document.getElementById('jobManager').value = data.managerId;

            // Marcamos los materiales que ya tiene el trabajo
            if(data.materials && data.materials.length > 0) {
                const checkboxes = document.querySelectorAll('input[name="jobMaterials"]');
                checkboxes.forEach(cb => {
                    cb.checked = data.materials.some(m => m.materialId == cb.value); // El DTO trae materialId
                });
            }

            document.getElementById('modalJob').style.display = 'flex';
        }
    } catch(error) { console.error("Error al obtener trabajo:", error); }
};

window.cerrarModalJob = () => {
    document.getElementById('modalJob').style.display = 'none';
};

window.guardarTrabajo = async () => {
    const id = document.getElementById('jobId').value;
    const isEditing = id !== '';
    
    // Obtener array de IDs de materiales seleccionados (Parseamos a entero porque DTO pide List<Long>)
    const matCheckboxes = document.querySelectorAll('input[name="jobMaterials"]:checked');
    const selectedMaterials = Array.from(matCheckboxes).map(cb => parseInt(cb.value));

    if (selectedMaterials.length === 0) {
        return Swal.fire('Atención', 'Debes incluir al menos un material para el trabajo.', 'warning');
    }

    const payload = {
        clientName: document.getElementById('jobClientName').value.trim(),
        clientPhone: document.getElementById('jobClientPhone').value.trim(),
        description: document.getElementById('jobDesc').value.trim(),
        address: document.getElementById('jobAddress').value.trim(),
        latitude: parseFloat(document.getElementById('jobLat').value),
        longitude: parseFloat(document.getElementById('jobLng').value),
        safeDepositBoxCodes: document.getElementById('jobSafeBox').value.trim(),
        status: document.getElementById('jobStatus').value,
        pay: parseFloat(document.getElementById('jobPay').value),
        employeeId: parseInt(document.getElementById('jobEmployee').value),
        managerId: parseInt(document.getElementById('jobManager').value),
        materialIds: selectedMaterials
        // jobUpdateId no es obligatorio mandarlo en la creación general según el DTO
    };
    
    // Validaciones básicas de campos vacíos o numéricos NaN
    if(!payload.clientName || !payload.employeeId || !payload.managerId || isNaN(payload.latitude) || isNaN(payload.pay)) {
        return Swal.fire('Error', 'Por favor llena todos los campos obligatorios.', 'error');
    }
    
    const url = isEditing ? `${API_URL}/update-job/${id}` : `${API_URL}/create-job`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            Swal.fire('¡Éxito!', isEditing ? 'Trabajo actualizado.' : 'Trabajo asignado correctamente.', 'success');
            cerrarModalJob();
            await cargarTrabajos(); 
        } else {
            const errorData = await response.json();
            Swal.fire('Error del servidor', errorData.message || 'No se pudo guardar el trabajo.', 'error');
        }
    } catch (error) {
        console.error('Error al guardar:', error);
        Swal.fire('Fallo de conexión', 'No se pudo contactar con el servidor.', 'error');
    }
};

window.eliminarTrabajo = async (id) => {
    Swal.fire({
        title: '¿Eliminar Trabajo?',
        text: "Se borrará del sistema permanentemente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                // Endpoint correcto según JobsController.java
                const res = await fetch(`${API_URL}/delete-job/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });
                
                if(res.ok) {
                    Swal.fire('¡Eliminado!', 'El trabajo fue eliminado.', 'success');
                    await cargarTrabajos();
                } else {
                    Swal.fire('Error', 'No se pudo eliminar el trabajo.', 'error');
                }
            } catch(e) { console.error(e); }
        }
    });
};

window.cerrarSesion = () => {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del sistema?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#0f4c81",
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