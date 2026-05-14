const API_URL = 'http://localhost:8081/api/v1/jobs';
const USERS_URL = 'http://localhost:8081/api/v1/user/all-users';
const MATERIALS_URL = 'http://localhost:8081/api/v1/materials/all';
let userToken = '';

// Variables globales para el Mapa
let mapa;
let marcador;

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

    await cargarUsuariosYMateriales(); 
    await cargarTrabajos();            
});

// --- INICIALIZAR EL MAPA INTERACTIVO ---
function inicializarMapa(lat, lng) {
    if (!mapa) {
        // Se crea el mapa si no existe
        mapa = L.map('jobMap').setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap Rojas Remodeling'
        }).addTo(mapa);

        // Crear marcador arrastrable
        marcador = L.marker([lat, lng], { draggable: true }).addTo(mapa);

        // Cuando sueltan el marcador, actualiza los inputs
        marcador.on('dragend', function (e) {
            const posicion = marcador.getLatLng();
            document.getElementById('jobLat').value = posicion.lat.toFixed(6);
            document.getElementById('jobLng').value = posicion.lng.toFixed(6);
        });

        // Cuando hacen clic en cualquier parte del mapa, mueve el marcador ahí
        mapa.on('click', function(e) {
            marcador.setLatLng(e.latlng);
            document.getElementById('jobLat').value = e.latlng.lat.toFixed(6);
            document.getElementById('jobLng').value = e.latlng.lng.toFixed(6);
        });
    } else {
        // Si ya existe, solo le cambiamos el centro y movemos el marcador
        mapa.setView([lat, lng], 14);
        marcador.setLatLng([lat, lng]);
    }

    // Llenamos los inputs iniciales
    document.getElementById('jobLat').value = lat.toFixed(6);
    document.getElementById('jobLng').value = lng.toFixed(6);

    setTimeout(() => { mapa.invalidateSize(); }, 300);
}

// --- NUEVO: FUNCIÓN PARA OBTENER LA UBICACIÓN GPS DEL USUARIO ---
window.obtenerMiUbicacion = () => {
    if (navigator.geolocation) {
        Swal.fire({
            title: 'Buscando tu ubicación...',
            text: 'Por favor, acepta los permisos de ubicación en tu navegador.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Actualizar mapa y marcador
                if (mapa && marcador) {
                    mapa.setView([lat, lng], 16); // 16 es más cerca (más zoom)
                    marcador.setLatLng([lat, lng]);
                } else {
                    inicializarMapa(lat, lng);
                }

                // Actualizar inputs visuales
                document.getElementById('jobLat').value = lat.toFixed(6);
                document.getElementById('jobLng').value = lng.toFixed(6);

                Swal.close();
                
                // Notificación pequeña en la esquina
                Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true
                }).fire({ icon: 'success', title: 'Ubicación actualizada' });
            },
            (error) => {
                Swal.close();
                let msj = 'No se pudo obtener tu ubicación.';
                if (error.code === 1) msj = 'Denegaste el permiso de ubicación.';
                if (error.code === 2) msj = 'La red de ubicación no responde.';
                if (error.code === 3) msj = 'El tiempo de espera se agotó.';
                Swal.fire('Error', msj, 'error');
            },
            {
                enableHighAccuracy: true // Intenta usar el GPS para mayor precisión
            }
        );
    } else {
        Swal.fire('No soportado', 'Tu navegador no soporta geolocalización.', 'warning');
    }
};


// 1. CARGAR SELECTS DE USUARIOS Y CHECKBOXES DE MATERIALES
async function cargarUsuariosYMateriales() {
    try {
        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (resUsers.ok) {
            const users = await resUsers.json();
            const selectEmp = document.getElementById('jobEmployee');
            const selectMan = document.getElementById('jobManager');
            selectEmp.innerHTML = '<option value="">-- Seleccione Empleado --</option>';
            selectMan.innerHTML = '<option value="">-- Seleccione Manager --</option>';
            
            // Filtro estricto de roles
            const empleados = users.filter(u => u.status !== 'Unemployed' && u.roles.some(r => r.name === 'ROLE_EMPLOYEE'));
            const jefes = users.filter(u => u.status !== 'Unemployed' && u.roles.some(r => r.name === 'ROLE_JEFE'));

            empleados.forEach(u => selectEmp.innerHTML += `<option value="${u.userId}">${u.name}</option>`);
            jefes.forEach(u => selectMan.innerHTML += `<option value="${u.userId}">${u.name}</option>`);
        }

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
                            ${mat.name} 
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
        let statusBadge = '';
        if(job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
        else if(job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
        else if(job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
        else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;

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

// --- LÓGICA DEL MODAL Y CRUD ---

window.abrirModalCrearJob = () => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = '';
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => cb.checked = false);
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-hammer"></i> Nuevo Trabajo';
    document.getElementById('modalJob').style.display = 'flex';
    
    // Coordenadas base (Centro de Cuenca, Ecuador)
    inicializarMapa(-2.900128, -79.005896);
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

            if(data.materials && data.materials.length > 0) {
                const checkboxes = document.querySelectorAll('input[name="jobMaterials"]');
                checkboxes.forEach(cb => {
                    cb.checked = data.materials.some(m => m.materialId == cb.value);
                });
            }

            document.getElementById('modalJob').style.display = 'flex';
            
            // Inicializar el mapa con las coordenadas exactas de este trabajo
            inicializarMapa(data.latitude, data.longitude);
        }
    } catch(error) { console.error("Error al obtener trabajo:", error); }
};

window.cerrarModalJob = () => {
    document.getElementById('modalJob').style.display = 'none';
};

window.guardarTrabajo = async () => {
    const id = document.getElementById('jobId').value;
    const isEditing = id !== '';
    
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
    };
    
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