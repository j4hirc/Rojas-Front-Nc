const API_URL = 'http://localhost:8081/api/v1/jobs';
const USERS_URL = 'http://localhost:8081/api/v1/user/all-users';
const MATERIALS_URL = 'http://localhost:8081/api/v1/materials/all';

let userToken = '';
let myManagerId = null; 
let mapa, marcador;

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({ icon: 'error', title: 'Acceso Denegado', confirmButtonColor: '#198754' })
        .then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('jefe-email-display').textContent = userEmail || 'Jefe';

    await inicializarDatosDelJefe(userEmail);
});

async function inicializarDatosDelJefe(emailActual) {
    try {
        Swal.fire({ 
            title: 'Preparando tu área de trabajo...', 
            text: 'Cargando personal, materiales y proyectos',
            allowOutsideClick: false, 
            didOpen: () => { Swal.showLoading(); }
        });

        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const users = await resUsers.json();
        
        const jefeActual = users.find(u => u.email === emailActual);
        if (jefeActual) {
            myManagerId = jefeActual.userId;
        } else {
            Swal.fire('Error', 'No se pudo identificar tu cuenta de Jefe.', 'error');
            return;
        }

        const selectEmp = document.getElementById('jobEmployee');
        selectEmp.innerHTML = '<option value="">-- Seleccione Empleado --</option>';
        users.filter(u => u.status !== 'Unemployed' && u.roles.some(r => r.name === 'ROLE_EMPLOYEE'))
             .forEach(u => selectEmp.innerHTML += `<option value="${u.userId}">${u.name}</option>`);

        const resMat = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const materials = await resMat.json();
        const containerMat = document.getElementById('materialsContainer');
        containerMat.innerHTML = '';
        materials.forEach(mat => {
            containerMat.innerHTML += `
                <label style="display: block; margin-bottom: 5px; cursor: pointer; color: #2b3674; font-size: 14px;">
                    <input type="checkbox" name="jobMaterials" value="${mat.materialId}"> 
                    ${mat.name} 
                </label>
            `;
        });

        await cargarMisTrabajos();
        Swal.close();

    } catch (error) { 
        console.error("Error al inicializar datos:", error); 
        Swal.fire('Error', 'Hubo un problema al cargar los datos.', 'error');
    }
}

async function cargarMisTrabajos() {
    try {
        const response = await fetch(`${API_URL}/all`, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (response.ok) {
            const todosLosTrabajos = await response.json();
            const misTrabajos = todosLosTrabajos.filter(job => job.managerId === myManagerId);
            renderizarTrabajos(misTrabajos);
        }
    } catch (error) { Swal.fire('Error', 'No se pudieron cargar tus trabajos.', 'error'); }
}

function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');
    
    tbody.innerHTML = ''; 
    if(mobileContainer) mobileContainer.innerHTML = '';

    if(trabajos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No tienes trabajos asignados.</td></tr>`; 
        if(mobileContainer) mobileContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #666;">No tienes trabajos asignados.</div>`;
        return;
    }

    trabajos.forEach(job => {
        let badge = job.status === 'PENDING' ? `<span style="background:#FFF3E0; color:#ff9800; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">Pendiente</span>` : 
                    job.status === 'IN_PROGRESS' ? `<span style="background:#E3F2FD; color:#1e88e5; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">En Progreso</span>` : 
                    job.status === 'COMPLETED' ? `<span style="background:#E8F5E9; color:#2e7d32; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">Completado</span>` : 
                    `<span style="background:#FFEBEE; color:#d32f2f; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">Cancelado</span>`;

        const fechaTxt = job.jobDate ? job.jobDate : 'Sin fecha asignada';
        const safeDesc = job.description ? job.description : 'Sin descripción';

        // FILA PARA PC
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${job.clientName}</strong><br><small><i class="fa-solid fa-phone"></i> ${job.clientPhone}</small></td>
            <td>
                ${job.address}<br>
                <small style="color:#0f4c81; font-weight: 500;"><i class="fa-regular fa-calendar"></i> ${fechaTxt}</small>
            </td>
            <td>
                <div style="max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: #666;" title="${safeDesc.replace(/"/g, '&quot;')}">
                    ${safeDesc}
                </div>
            </td>
            <td style="color:#0f4c81; font-weight:500;">${job.nameEmployee || 'Sin asignar'}</td>
            <td>${badge}</td>
            <td style="font-weight: bold; color: #2e7d32;">$${job.pay.toFixed(2)}</td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);

        // TARJETA PARA CELULARES
        if(mobileContainer) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.padding = '20px';
            
            card.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; border-bottom: 1px dashed #E0E5F2; padding-bottom: 10px; margin-bottom: 10px;">
                    <h3 style="margin:0; font-size:1.1rem; color:#0f4c81;">${job.clientName}</h3>
                    ${badge}
                </div>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-phone"></i> ${job.clientPhone}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#198754; font-weight: 600;"><i class="fa-regular fa-calendar"></i> Fecha: ${fechaTxt}</p>
                
                <div style="margin: 10px 0; padding-left: 10px; border-left: 3px solid #198754; width: 100%;">
                    <p style="margin: 0; font-size: 13px; color: #444; font-style: italic; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        "${safeDesc}"
                    </p>
                </div>

                <div style="background: #F9FAFC; padding: 10px; border-radius: 8px; margin-top: 10px; width: 100%;">
                    <p style="margin: 0; font-size: 13px; color:#0f4c81;"><strong>Empleado:</strong> ${job.nameEmployee || 'Sin asignar'}</p>
                </div>
                
                <p style="margin: 10px 0 0 0; font-size: 15px; color:#2e7d32; font-weight: bold;">Pago: $${job.pay.toFixed(2)}</p>
                
                <div class="card-actions" style="margin-top: 15px; width: 100%; display: flex; gap: 10px;">
                    <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" style="flex: 1; padding: 8px; border-radius: 8px; background: #FFF3E0; color: #ff9800; border: none; font-weight: bold; cursor: pointer;"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" style="flex: 1; padding: 8px; border-radius: 8px; background: #FBE9E7; color: #d32f2f; border: none; font-weight: bold; cursor: pointer;"><i class="fa-solid fa-trash"></i> Eliminar</button>
                </div>
            `;
            mobileContainer.appendChild(card);
        }
    });
}

// Funciones del Mapa
function inicializarMapa(lat, lng) {
    if (!mapa) {
        mapa = L.map('jobMap').setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
        marcador = L.marker([lat, lng], { draggable: true }).addTo(mapa);
        marcador.on('dragend', function (e) {
            const pos = marcador.getLatLng();
            document.getElementById('jobLat').value = pos.lat.toFixed(6);
            document.getElementById('jobLng').value = pos.lng.toFixed(6);
        });
        mapa.on('click', function(e) {
            marcador.setLatLng(e.latlng);
            document.getElementById('jobLat').value = e.latlng.lat.toFixed(6);
            document.getElementById('jobLng').value = e.latlng.lng.toFixed(6);
        });
    } else {
        mapa.setView([lat, lng], 14);
        marcador.setLatLng([lat, lng]);
    }
    document.getElementById('jobLat').value = lat.toFixed(6);
    document.getElementById('jobLng').value = lng.toFixed(6);
    setTimeout(() => { mapa.invalidateSize(); }, 300);
}

window.obtenerMiUbicacion = () => {
    if (navigator.geolocation) {
        Swal.fire({ title: 'Buscando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                inicializarMapa(pos.coords.latitude, pos.coords.longitude);
                Swal.close();
            },
            () => { Swal.fire('Error', 'No se pudo obtener tu ubicación.', 'error'); },
            { enableHighAccuracy: true }
        );
    }
};

window.abrirModalCrearJob = () => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = '';
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => cb.checked = false);
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-hammer"></i> Nuevo Trabajo';
    document.getElementById('modalJob').style.display = 'flex';
    inicializarMapa(-2.900128, -79.005896); // Cuenca
};

window.abrirModalEditarJob = async (id) => {
    document.getElementById('formJob').reset();
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => cb.checked = false);
    document.getElementById('jobId').value = id;
    
    try {
        const response = await fetch(`${API_URL}/find-id/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if(response.ok) {
            const data = await response.json();
            document.getElementById('jobClientName').value = data.clientName;
            document.getElementById('jobClientPhone').value = data.clientPhone;
            document.getElementById('jobDesc').value = data.description;
            document.getElementById('jobDate').value = data.jobDate || '';
            document.getElementById('jobAddress').value = data.address;
            document.getElementById('jobSafeBox').value = data.safeDepositBoxCodes || '';
            document.getElementById('jobPay').value = data.pay;
            document.getElementById('jobStatus').value = data.status;
            document.getElementById('jobEmployee').value = data.employeeId;

            if(data.materials) {
                document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => {
                    cb.checked = data.materials.some(m => m.materialId == cb.value);
                });
            }
            document.getElementById('modalJob').style.display = 'flex';
            inicializarMapa(data.latitude, data.longitude);
        }
    } catch(e) { console.error(e); }
};

window.cerrarModalJob = () => { document.getElementById('modalJob').style.display = 'none'; };

window.guardarTrabajo = async () => {
    const id = document.getElementById('jobId').value;
    const isEditing = id !== '';
    
    const matCheckboxes = document.querySelectorAll('input[name="jobMaterials"]:checked');
    const selectedMaterials = Array.from(matCheckboxes).map(cb => parseInt(cb.value));

    if (selectedMaterials.length === 0) return Swal.fire('Atención', 'Selecciona al menos un material.', 'warning');

    const payload = {
        clientName: document.getElementById('jobClientName').value.trim(),
        clientPhone: document.getElementById('jobClientPhone').value.trim(),
        description: document.getElementById('jobDesc').value.trim(),
        jobDate: document.getElementById('jobDate').value,
        address: document.getElementById('jobAddress').value.trim(),
        latitude: parseFloat(document.getElementById('jobLat').value),
        longitude: parseFloat(document.getElementById('jobLng').value),
        safeDepositBoxCodes: document.getElementById('jobSafeBox').value.trim(),
        status: document.getElementById('jobStatus').value,
        pay: parseFloat(document.getElementById('jobPay').value),
        employeeId: parseInt(document.getElementById('jobEmployee').value),
        managerId: myManagerId, 
        materialIds: selectedMaterials
    };
    
    if(!payload.clientName || !payload.employeeId || !payload.jobDate) {
        return Swal.fire('Error', 'Llena todos los campos obligatorios, incluyendo la fecha.', 'error');
    }
    
    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    const url = isEditing ? `${API_URL}/update-job/${id}` : `${API_URL}/create-job`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            Swal.fire('¡Éxito!', 'Trabajo guardado correctamente.', 'success');
            cerrarModalJob();
            await cargarMisTrabajos(); 
        } else {
            Swal.fire('Error', 'No se pudo guardar el trabajo.', 'error');
        }
    } catch (error) { Swal.fire('Fallo de conexión', '', 'error'); }
};

window.eliminarTrabajo = async (id) => {
    Swal.fire({ title: '¿Eliminar Trabajo?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            try {
                const res = await fetch(`${API_URL}/delete-job/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` }});
                if(res.ok) { 
                    Swal.fire('Eliminado', '', 'success'); 
                    await cargarMisTrabajos(); 
                } else {
                    Swal.fire('Error', 'No se pudo eliminar', 'error');
                }
            } catch(e) {
                Swal.fire('Error', 'Fallo de red', 'error');
            }
        }
    });
};

window.cerrarSesion = () => { localStorage.clear(); window.location.href = '../../index.html'; };