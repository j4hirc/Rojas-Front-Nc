const API_URL = 'https://api-remomn.onrender.com/api/v1/jobs';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';
const MATERIALS_URL = 'https://api-remomn.onrender.com/api/v1/materials/all';

let userToken = '';
let mapa, marcador;

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        Swal.fire({
            icon: 'error', title: 'Acceso Denegado', text: 'No tienes permisos para acceder a esta sección.', confirmButtonColor: '#12CFF4'
        }).then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    Swal.fire({ title: 'Preparando tu área de trabajo...', text: 'Cargando personal y proyectos', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    await cargarUsuariosYMateriales();
    await cargarTrabajos();

    const inputLat = document.getElementById('jobLat');
    const inputLng = document.getElementById('jobLng');
    if (inputLat && inputLng) {
        inputLat.addEventListener('input', window.actualizarMapaDesdeInputs);
        inputLng.addEventListener('input', window.actualizarMapaDesdeInputs);
    }

    Swal.close();
});

function inicializarMapa(lat, lng) {
    if (!mapa) {
        mapa = L.map('jobMap').setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
        marcador = L.marker([lat, lng], { draggable: true }).addTo(mapa);

        function obtenerDireccion(latlng) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&accept-language=es&addressdetails=1`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.address) {
                        const a = data.address;
                        const partes = [
                            a.road || a.pedestrian || a.footway || '',
                            a.house_number || '',
                            a.suburb || a.neighbourhood || a.quarter || '',
                            a.city || a.town || a.village || a.municipality || '',
                            a.state || ''
                        ].filter(p => p !== '');
                        document.getElementById('jobAddress').value = partes.join(', ');
                    }
                })
                .catch(err => console.error('Error reverse geocoding:', err));
        }

        marcador.on('dragend', function () {
            const posicion = marcador.getLatLng();
            document.getElementById('jobLat').value = posicion.lat.toFixed(6);
            document.getElementById('jobLng').value = posicion.lng.toFixed(6);
            obtenerDireccion(posicion);
        });

        mapa.on('click', function (e) {
            marcador.setLatLng(e.latlng);
            document.getElementById('jobLat').value = e.latlng.lat.toFixed(6);
            document.getElementById('jobLng').value = e.latlng.lng.toFixed(6);
            obtenerDireccion(e.latlng);
        });

        // Dirección → Mapa
        const inputDireccion = document.getElementById('jobAddress');

        function buscarDireccionEnMapa() {
            const texto = inputDireccion.value.trim();
            if (!texto) return;

            const regexCoords = /^[-+]?\d+(\.\d+)?,\s*[-+]?\d+(\.\d+)?$/;
            if (regexCoords.test(texto)) {
                const partes = texto.split(',');
                const latV = parseFloat(partes[0]);
                const lngV = parseFloat(partes[1]);
                if (!isNaN(latV) && !isNaN(lngV)) {
                    document.getElementById('jobLat').value = latV.toFixed(6);
                    document.getElementById('jobLng').value = lngV.toFixed(6);
                    marcador.setLatLng([latV, lngV]);
                    mapa.setView([latV, lngV], 16);
                }
                return;
            }

            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto)}&accept-language=es&limit=1`)
                .then(res => res.json())
                .then(results => {
                    if (results && results.length > 0) {
                        const latV = parseFloat(results[0].lat);
                        const lngV = parseFloat(results[0].lon);
                        document.getElementById('jobLat').value = latV.toFixed(6);
                        document.getElementById('jobLng').value = lngV.toFixed(6);
                        marcador.setLatLng([latV, lngV]);
                        mapa.setView([latV, lngV], 16);
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'No encontrado',
                            text: 'No se encontró esa dirección. Intenta ser más específico o usa el mapa.',
                            confirmButtonColor: '#12CFF4',
                            timer: 3000,
                            timerProgressBar: true
                        });
                    }
                })
                .catch(err => console.error('Error geocoding:', err));
        }

        inputDireccion.addEventListener('blur', buscarDireccionEnMapa);
        inputDireccion.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarDireccionEnMapa();
            }
        });

    } else {
        mapa.setView([lat, lng], 14);
        marcador.setLatLng([lat, lng]);
    }

    document.getElementById('jobLat').value = lat.toFixed(6);
    document.getElementById('jobLng').value = lng.toFixed(6);
    setTimeout(() => { mapa.invalidateSize(); }, 300);
}

// Actualiza el mapa al escribir coordenadas manualmente
window.actualizarMapaDesdeInputs = () => {
    const latVal = parseFloat(document.getElementById('jobLat').value);
    const lngVal = parseFloat(document.getElementById('jobLng').value);
    if (!isNaN(latVal) && !isNaN(lngVal) && latVal >= -90 && latVal <= 90 && lngVal >= -180 && lngVal <= 180) {
        if (mapa && marcador) {
            marcador.setLatLng([latVal, lngVal]);
            mapa.panTo([latVal, lngVal]);
        }
    }
};

window.obtenerMiUbicacion = () => {
    if (navigator.geolocation) {
        Swal.fire({ title: 'Buscando tu ubicación...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                if (mapa && marcador) {
                    mapa.setView([lat, lng], 16);
                    marcador.setLatLng([lat, lng]);
                } else {
                    inicializarMapa(lat, lng);
                }
                document.getElementById('jobLat').value = lat.toFixed(6);
                document.getElementById('jobLng').value = lng.toFixed(6);
                Swal.close();
            },
            (error) => { Swal.close(); Swal.fire('Error', 'No se pudo obtener tu ubicación.', 'error'); },
            { enableHighAccuracy: true }
        );
    } else {
        Swal.fire('No soportado', 'Tu navegador no soporta geolocalización.', 'warning');
    }
};

async function cargarUsuariosYMateriales() {
    try {
        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (resUsers.ok) {
            const users = await resUsers.json();
            const selectEmp = document.getElementById('jobEmployee');
            const selectMan = document.getElementById('jobManager');
            selectEmp.innerHTML = '<option value="">-- Seleccione Empleado --</option>';
            selectMan.innerHTML = '<option value="">-- Seleccione Manager --</option>';

            const empleados = users.filter(u => u.status !== 'Unemployed' && u.roles.some(r => r.name === 'ROLE_EMPLOYEE'));
            const jefes = users.filter(u => u.status !== 'Unemployed' && u.roles.some(r => r.name === 'ROLE_JEFE'));

            empleados.forEach(u => selectEmp.innerHTML += `<option value="${u.userId}">${u.name}</option>`);
            jefes.forEach(u => selectMan.innerHTML += `<option value="${u.userId}">${u.name}</option>`);
        }

        const resMat = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (resMat.ok) {
            const materials = await resMat.json();
            const containerMat = document.getElementById('materialsContainer');
            containerMat.innerHTML = '';

            if (materials.length === 0) {
                containerMat.innerHTML = '<span style="color:#666;">No hay materiales en inventario.</span>';
            } else {
                materials.forEach(mat => {
                    containerMat.innerHTML += `
        <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #2b3674; font-weight: bold; cursor: pointer;">
                <input type="checkbox" name="jobMaterials" value="${mat.materialId}" data-name="${mat.name}" onchange="document.getElementById('opts_${mat.materialId}').style.display = this.checked ? 'flex' : 'none'">
                ${mat.name}
            </label>
            
            <div id="opts_${mat.materialId}" style="display: none; gap: 10px; margin-top: 8px; margin-left: 24px;">
                <input type="number" id="qty_${mat.materialId}" placeholder="Cant." class="input-field" style="width: 75px; padding: 5px; border: 1px solid #e65100; border-radius: 5px; font-size: 12px; height: auto;">
                <input type="text" id="unit_${mat.materialId}" placeholder="Unidad (box, ltr, etc)" class="input-field" style="flex: 1; padding: 5px; border: 1px solid #e65100; border-radius: 5px; font-size: 12px; height: auto;">
            </div>
        </div>
    `;
                });
            }
        }
    } catch (e) { console.error("Error cargando dependencias", e); }
}

async function cargarTrabajos() {
    try {
        const response = await fetch(`${API_URL}/all`, { method: 'GET', headers: { 'Authorization': `Bearer ${userToken}` } });
        if (response.ok) {
            const trabajos = await response.json();
            renderizarTrabajos(trabajos);
        }
    } catch (error) { console.error("Error al cargar trabajos", error); }
}

function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    if (trabajos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No hay trabajos registrados.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #666;">No hay trabajos registrados.</div>`;
        return;
    }

    trabajos.forEach(job => {
        let statusBadge = '';
        if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
        else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
        else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
        else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;

        const empName = job.nameEmployee || 'Sin asignar';
        const manName = job.nameManager || 'Sin asignar';
        const fechaTxt = job.jobDate ? job.jobDate : 'Sin fecha asignada';
        const safeDesc = job.description ? job.description : 'Sin descripción';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${job.clientName}</strong><br>
                <small style="color:#666;"><i class="fa-solid fa-phone"></i> ${job.clientPhone}</small>
            </td>
            <td>
                ${job.address}<br>
                <small style="color:#0f4c81; font-weight: 500;"><i class="fa-regular fa-calendar"></i> ${fechaTxt}</small>
            </td>
            <td>
                <div style="max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: #555; background: #f8faff; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #0f4c81;" title="${safeDesc.replace(/"/g, '&quot;')}">
                    ${safeDesc}
                </div>
            </td>
            <td>
                <span style="color:#0f4c81; font-weight: 500;">E: ${empName}</span><br>
                <span style="color:#546e7a; font-size: 13px;">M: ${manName}</span>
            </td>
            <td>${statusBadge}</td>
            <td style="font-weight: bold; color: #2e7d32;">$${job.pay.toFixed(2)}</td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" title="Editar">
    <i class="fa-solid fa-pen"></i>
</button>

<button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" title="Eliminar">
    <i class="fa-solid fa-trash"></i>
</button>
</td>
`;
        tbody.appendChild(tr);

        if (mobileContainer) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.padding = '20px';

            card.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; border-bottom: 1px dashed #E0E5F2; padding-bottom: 10px; margin-bottom: 10px;">
                    <h3 style="margin:0; font-size:1.1rem; color:#0f4c81;">${job.clientName}</h3>
                    ${statusBadge}
                </div>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-phone"></i> ${job.clientPhone}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#0f4c81; font-weight: 600;"><i class="fa-regular fa-calendar"></i> Fecha: ${fechaTxt}</p>
                
                <div style="margin: 15px 0; padding: 12px; background: #f8faff; border-left: 4px solid #0f4c81; border-radius: 6px; width: 100%;">
                    <strong style="color: #2B3674; font-size: 12px;"><i class="fa-solid fa-align-left"></i> Descripción del Trabajo:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #555; font-style: italic;">"${safeDesc}"</p>
                </div>

                <div style="background: #F9FAFC; padding: 10px; border-radius: 8px; margin-top: 10px; width: 100%;">
                    <p style="margin: 0; font-size: 13px; color:#0f4c81;"><strong>E:</strong> ${empName}</p>
                    <p style="margin: 0; font-size: 13px; color:#546e7a;"><strong>M:</strong> ${manName}</p>
                </div>
                
                <p style="margin: 10px 0 0 0; font-size: 15px; color:#2e7d32; font-weight: bold;">Pago: $${job.pay.toFixed(2)}</p>
                
                <div class="card-actions" style="margin-top: 15px; width: 100%; display: flex; gap: 10px;">
                <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" style="flex: 1; padding: 8px; border-radius: 8px; background: #FFF3E0; color: #ff9800; border: none; font-weight: bold; cursor: pointer; font-size: 13px;">
    <i class="fa-solid fa-pen"></i> Editar
</button>

<button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" style="flex: 1; padding: 8px; border-radius: 8px; background: #FBE9E7; color: #d32f2f; border: none; font-weight: bold; cursor: pointer;">
    <i class="fa-solid fa-trash"></i> Eliminar
</button>
</div>
`;
            mobileContainer.appendChild(card);
        }
    });
}

window.abrirModalCrearJob = () => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = '';
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => cb.checked = false);
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-hammer"></i> Nuevo Trabajo';
    document.getElementById('modalJob').style.display = 'flex';
    inicializarMapa(-2.900128, -79.005896);
};

window.abrirModalEditarJob = async (id) => {
    document.getElementById('formJob').reset();
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => cb.checked = false);
    document.getElementById('jobId').value = id;
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Trabajo';

    try {
        Swal.fire({ title: 'Cargando datos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const response = await fetch(`${API_URL}/find-id/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` } });

        if (response.ok) {
            const data = await response.json();

            document.getElementById('jobClientName').value = data.clientName;
            document.getElementById('jobClientPhone').value = data.clientPhone;
            document.getElementById('jobDesc').value = data.description;
            document.getElementById('jobDate').value = data.jobDate || '';
            document.getElementById('jobAddress').value = data.address;
            document.getElementById('jobLat').value = data.latitude;
            document.getElementById('jobLng').value = data.longitude;
            document.getElementById('jobSafeBox').value = data.safeDepositBoxCodes || '';
            document.getElementById('jobPay').value = data.pay;
            document.getElementById('jobStatus').value = data.status || 'PENDING';

            document.getElementById('jobEmployee').value = data.employeeId;
            document.getElementById('jobManager').value = data.managerId;

            // Marcar checkboxes de materiales si ya los tenía guardados
            if (data.materials && data.materials.length > 0) {
                const checkboxes = document.querySelectorAll('input[name="jobMaterials"]');
                checkboxes.forEach(cb => {
                    cb.checked = data.materials.some(m => m.materialId == cb.value);
                });
            }

            Swal.close();
            document.getElementById('modalJob').style.display = 'flex';
            inicializarMapa(data.latitude, data.longitude);
        }
    } catch (error) {
        Swal.close();
        console.error("Error al obtener trabajo:", error);
    }
};

window.cerrarModalJob = () => {
    document.getElementById('modalJob').style.display = 'none';
};

window.guardarTrabajo = async () => {
    const id = document.getElementById('jobId').value;
    const isEditing = id !== '';

    // 1. Obtenemos TODOS los materiales seleccionados
    const matCheckboxes = document.querySelectorAll('input[name="jobMaterials"]:checked');
    const selectedMaterials = Array.from(matCheckboxes).map(cb => parseInt(cb.value));

    // 2. Armamos el texto de las cantidades
    let resumenMateriales = '';
    matCheckboxes.forEach(cb => {
        const matId = cb.value;
        const nombreMat = cb.getAttribute('data-name');
        const cantidad = document.getElementById(`qty_${matId}`).value.trim();
        const unidad = document.getElementById(`unit_${matId}`).value.trim();
        
        const textoCantidad = cantidad ? `${cantidad} ${unidad}`.trim() : 'Asignado';
        resumenMateriales += `• ${nombreMat}: ${textoCantidad}\n`;
    });

    // 3. Limpiamos la descripción vieja para que no se duplique
    let descripcionBase = document.getElementById('jobDesc').value.trim();
    if (descripcionBase.includes('[MATERIALES PRE-ASIGNADOS]:')) {
        descripcionBase = descripcionBase.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
    }
    
    // 4. Juntamos todo
    let descripcionFinal = descripcionBase;
    if (resumenMateriales !== '') {
        descripcionFinal = `${descripcionBase}\n\n[MATERIALES PRE-ASIGNADOS]:\n${resumenMateriales}`;
    }

    // 5. Armamos el payload enviando TODOS los materiales seleccionados
    const payload = {
        clientName: document.getElementById('jobClientName').value.trim(),
        clientPhone: document.getElementById('jobClientPhone').value.trim(),
        description: descripcionFinal, 
        jobDate: document.getElementById('jobDate').value,
        address: document.getElementById('jobAddress').value.trim(),
        latitude: parseFloat(document.getElementById('jobLat').value),
        longitude: parseFloat(document.getElementById('jobLng').value),
        safeDepositBoxCodes: document.getElementById('jobSafeBox').value.trim(),
        status: document.getElementById('jobStatus').value,
        pay: parseFloat(document.getElementById('jobPay').value),
        employeeId: parseInt(document.getElementById('jobEmployee').value),
        managerId: parseInt(document.getElementById('jobManager').value), 
        materialIds: selectedMaterials // <--- El backend se encarga de no duplicarlos
    };

    if (!payload.clientName || !payload.employeeId || !payload.managerId || !payload.jobDate || isNaN(payload.latitude) || isNaN(payload.pay)) {
        return Swal.fire('Error', 'Por favor llena todos los campos obligatorios.', 'error');
    }

    Swal.fire({ title: 'Guardando trabajo...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

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
            let errorMsg = 'No se pudo guardar el trabajo.';
            if (errorData.message) {
                if (typeof errorData.message === 'object') {
                    errorMsg = Object.values(errorData.message).join('<br>');
                } else {
                    errorMsg = errorData.message;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error del servidor', html: errorMsg });
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
        cancelButtonColor: '#2E3238',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

            try {
                const res = await fetch(`${API_URL}/delete-job/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });

                if (res.ok) {
                    Swal.fire('¡Eliminado!', 'El trabajo fue eliminado.', 'success');
                    await cargarTrabajos();
                } else {
                    Swal.fire('Error', 'No se pudo eliminar el trabajo.', 'error');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'Fallo de red', 'error');
            }
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