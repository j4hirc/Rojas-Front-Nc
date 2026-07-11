const API_URL = 'https://api-remomn.onrender.com/api/v1/jobs';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';
const MATERIALS_URL = 'https://api-remomn.onrender.com/api/v1/materials/all';

let userToken = '';
let myManagerId = null;
let mapa, marcador;
let allJobsCache = [];

// ==================================================
// FUNCIONES DE APOYO (FECHAS)
// ==================================================
function formatearFecha(fecha) {
    if (!fecha) return 'Sin fecha asignada';
    if (Array.isArray(fecha)) {
        const dia = String(fecha[2]).padStart(2, '0');
        const mes = String(fecha[1]).padStart(2, '0');
        const anio = fecha[0];
        return `${mes}/${dia}/${anio}`;
    } else if (typeof fecha === 'string') {
        const partes = fecha.split('-');
        if (partes.length === 3) {
            return `${partes[1]}/${partes[2]}/${partes[0]}`;
        }
    }
    return fecha;
}

function fechaParaInput(fecha) {
    if (!fecha) return '';
    if (Array.isArray(fecha)) {
        const dia = String(fecha[2]).padStart(2, '0');
        const mes = String(fecha[1]).padStart(2, '0');
        const anio = fecha[0];
        return `${anio}-${mes}-${dia}`;
    }
    return fecha;
}

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({
            icon: 'error', 
            title: 'Acceso Denegado', 
            text: 'Solo los Jefes pueden acceder a esta sección.', 
            confirmButtonColor: '#198754'
        }).then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('jefe-email-display').textContent = userEmail || 'Jefe';

    Swal.fire({ 
        title: 'Preparando tu área de trabajo...', 
        text: 'Cargando personal y proyectos', 
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); } 
    });

    await cargarUsuariosYMateriales(userEmail);
    await cargarTrabajos();

    // ==================== EVENTOS DE FILTROS ====================
    const searchInput = document.getElementById('searchJobInput');
    const statusInput = document.getElementById('filterStatusInput');
    const priorityInput = document.getElementById('filterPriorityInput');

    if (searchInput) searchInput.addEventListener('input', filtrarTrabajosCombinados);
    if (statusInput) statusInput.addEventListener('change', filtrarTrabajosCombinados);
    if (priorityInput) priorityInput.addEventListener('input', filtrarTrabajosCombinados);

    // Eventos del mapa (manténlos)
    const inputLat = document.getElementById('jobLat');
    const inputLng = document.getElementById('jobLng');
    const inputDireccion = document.getElementById('jobAddress');

    if (inputLat && inputLng) {
        inputLat.addEventListener('input', window.actualizarMapaDesdeInputs);
        inputLng.addEventListener('input', window.actualizarMapaDesdeInputs);
    }

    if (inputDireccion) {
        inputDireccion.addEventListener('change', window.actualizarMapaDesdeDireccion);
        inputDireccion.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.actualizarMapaDesdeDireccion();
            }
        });
    }

    Swal.close();
});

window.filtrarTrabajosCombinados = () => {
    const texto = (document.getElementById('searchJobInput')?.value || '').toLowerCase().trim();
    const estado = (document.getElementById('filterStatusInput')?.value || 'ALL').trim();
    const prioridadInput = (document.getElementById('filterPriorityInput')?.value || '').trim();

    const trabajosFiltrados = allJobsCache.filter(job => {
        // 1. Filtro de texto
        const coincideTexto = 
            (job.clientName || '').toLowerCase().includes(texto) ||
            (job.description || '').toLowerCase().includes(texto) ||
            (job.clientPhone || '').toLowerCase().includes(texto) ||
            (job.nameEmployee || '').toLowerCase().includes(texto);

        // 2. Filtro de estado
        const coincideEstado = estado === 'ALL' || job.status === estado;

        // 3. Filtro de prioridad (REPARADO Y SEGURO)
        let coincidePrioridad = true;
        if (prioridadInput !== '') {
            const prioBuscada = parseInt(prioridadInput);
            
            // Si el trabajo no tiene prioridad o viene vacío, asumimos que es 2 (Igual que en la tabla)
            const prioJob = (job.priority !== null && job.priority !== undefined && job.priority !== '') 
                ? parseInt(job.priority) 
                : 2;
                
            coincidePrioridad = prioJob === prioBuscada;
        }

        return coincideTexto && coincideEstado && coincidePrioridad;
    });

    renderizarTrabajos(trabajosFiltrados);
};


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
                            confirmButtonColor: '#e65100',
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

    if (!document.getElementById('jobLat').value) document.getElementById('jobLat').value = lat.toFixed(6);
    if (!document.getElementById('jobLng').value) document.getElementById('jobLng').value = lng.toFixed(6);

    setTimeout(() => { mapa.invalidateSize(); }, 300);
}

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

window.actualizarMapaDesdeDireccion = () => {
    const direccionEscrita = document.getElementById('jobAddress').value.trim();
    if (!direccionEscrita) return;

    const regexCoordenadas = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
    if (regexCoordenadas.test(direccionEscrita)) {
        const partes = direccionEscrita.split(',');
        const latVal = parseFloat(partes[0]);
        const lngVal = parseFloat(partes[1]);

        if (mapa && marcador) {
            document.getElementById('jobLat').value = latVal.toFixed(6);
            document.getElementById('jobLng').value = lngVal.toFixed(6);
            marcador.setLatLng([latVal, lngVal]);
            mapa.setView([latVal, lngVal], 16);
        }
        return;
    }

    const geocoder = L.Control.Geocoder.nominatim();
    geocoder.geocode(direccionEscrita, results => {
        if (results && results.length > 0) {
            const match = results[0];
            const latlng = match.center;

            document.getElementById('jobLat').value = latlng.lat.toFixed(6);
            document.getElementById('jobLng').value = latlng.lng.toFixed(6);

            if (mapa && marcador) {
                marcador.setLatLng(latlng);
                mapa.setView(latlng, 16);
            }
        }
    });
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

async function cargarUsuariosYMateriales(emailActual) {
    try {
        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (resUsers.ok) {
            const users = await resUsers.json();
            const jefe = users.find(u => u.email === emailActual);
            if (jefe) myManagerId = jefe.userId;

            const select = document.getElementById('jobEmployee');
            if (select) {
                select.innerHTML = '<option value="">-- Seleccione Empleado --</option>';
                users.filter(u => u.roles.some(r => r.name === 'ROLE_EMPLOYEE')).forEach(u => {
                    select.innerHTML += `<option value="${u.userId}">${u.name}</option>`;
                });
            }
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
                    const precioMat = mat.price || 0;
                    containerMat.innerHTML += `
                    <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                        <label style="display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #2b3674; font-weight: bold; cursor: pointer;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" name="jobMaterials" value="${mat.materialId}" data-name="${mat.name}" data-price="${precioMat}" onchange="toggleMaterialOpciones(${mat.materialId})">
                                ${mat.name}
                            </div>
                            <span style="color: #198754; font-size: 12px; background: #e8f5e9; padding: 2px 6px; border-radius: 4px;">$${precioMat.toFixed(2)} c/u</span>
                        </label>
                        
                        <div id="opts_${mat.materialId}" style="display: none; align-items: center; gap: 10px; margin-top: 8px; margin-left: 24px;">
                            <input type="number" id="qty_${mat.materialId}" placeholder="Cant." class="input-field" oninput="calcularCostoMateriales()" min="1" style="width: 70px; padding: 5px; border: 1px solid #198754; border-radius: 5px; font-size: 12px; height: auto;">
                            <input type="text" id="unit_${mat.materialId}" placeholder="Unidad" class="input-field" style="flex: 1; padding: 5px; border: 1px solid #198754; border-radius: 5px; font-size: 12px; height: auto;">
                            
                            <div style="font-size: 13px; color: #d32f2f; font-weight: bold; min-width: 60px; text-align: right;">
                                $<span id="subtotal_${mat.materialId}">0.00</span>
                            </div>
                        </div>
                    </div>
                    `;
                });

                containerMat.innerHTML += `
                    <div style="margin-top: 15px; padding: 12px; background: #FFF3E0; border-radius: 8px; text-align: right; font-weight: bold; color: #ff9800; font-size: 16px; border: 1px dashed #ffb74d;">
                        Costo Total Materiales: $<span id="granTotalMateriales">0.00</span>
                    </div>
                `;
            }
        }
    } catch (e) { console.error("Error cargando dependencias", e); }
}

async function cargarTrabajos() {
    try {
        const res = await fetch(`${API_URL}/all`, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (res.ok) {
            const todos = await res.json();
            allJobsCache = todos.filter(j => j.managerId === myManagerId);
            renderizarTrabajos(allJobsCache);
        }
    } catch (e) { console.error(e); }
}

function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    if (trabajos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">No tienes trabajos asignados a tu cargo.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #666;">No tienes trabajos asignados a tu cargo.</div>`;
        return;
    }

    trabajos.forEach(job => {
        let statusBadge = '';
        if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
        else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
        else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
        else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;

        const priorityBadge = getPriorityBadge(job.priority);
        const empName = job.nameEmployee || 'Sin asignar';
        const fechaTxt = formatearFecha(job.jobDate);
        
        let safeDesc = job.description ? job.description : 'Sin descripción';
        if (safeDesc.includes('[MATERIALES PRE-ASIGNADOS]:')) {
            safeDesc = safeDesc.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
        }

        const mapsLink = `https://www.google.com/maps?q=${job.latitude},${job.longitude}`;

        // === FILA DE TABLA DESKTOP ===
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${job.clientName}</strong><br>
                <small style="color:#666;"><i class="fa-solid fa-phone"></i> ${job.clientPhone}</small>
            </td>
            <td>
                ${job.address}<br>
                <small style="color:#198754; font-weight: 500;"><i class="fa-regular fa-calendar"></i> ${fechaTxt}</small>
            </td>
            <td>
                <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: #555;" title="${safeDesc}">
                    ${safeDesc}
                </div>
            </td>
            <td><strong>${empName}</strong></td>
            <td>${statusBadge}</td>
            <td>${priorityBadge}</td>
            <td style="font-weight: bold; color: #2e7d32;">$${job.pay.toFixed(2)}</td>
            <td>
            <!-- NUEVO: Botón Evidencias Desktop -->
            <td>
            <a href="../evidencias/evidencias.html?jobId=${job.jobId}" class="btn-edit" style="background: #155e75; color: white; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;" title="Ver Evidencias">
                <i class="fa-solid fa-camera"></i>
            </a>
            <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" title="Editar">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
        `;
        tbody.appendChild(tr);

        // === TARJETA MÓVIL OPTIMIZADA ===
        if (mobileContainer) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = 'padding: 20px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; width: 100%; margin-bottom: 15px;';
            
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 10px; margin-bottom:5px;">
                    <h3 style="margin:0; color:#198754; font-size: 16px; word-break: break-word;">${job.clientName}</h3>
                    <div style="display:flex; flex-direction: column; align-items: flex-end; gap:4px; flex-shrink: 0;">
                        ${statusBadge} 
                        ${priorityBadge}
                    </div>
                </div>
                
                <p style="margin:0; color:#666; font-size: 14px;"><i class="fa-solid fa-phone"></i> ${job.clientPhone}</p>
                <p style="margin:0; color:#666; font-size: 14px; word-break: break-word;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>
                <p style="margin:0; color:#198754; font-size: 14px;"><strong>Empleado:</strong> ${empName}</p>
                <p style="margin:5px 0 0 0; font-weight:bold; color:#2e7d32; font-size: 15px;">Pago: $${job.pay.toFixed(2)}</p>
                
                <!-- ACCIONES MÓVIL ACTUALIZADAS -->
                <div class="card-actions" style="margin-top:15px; display:flex; gap:8px; width: 100%;">
                <a href="../evidencias/evidencias.html?jobId=${job.jobId}" style="flex: 1; padding: 8px; border-radius: 4px; background: #155e75; color: white; text-decoration: none; font-weight: bold; font-size: 13px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <i class="fa-solid fa-camera"></i> Evidencias
                </a>
                <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" style="flex:1; padding: 8px 0; font-weight: bold;">Editar</button>
                <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" style="flex:1; padding: 8px 0; font-weight: bold;">Eliminar</button>
            </div>
            `;
            mobileContainer.appendChild(card);
        }
    });
}



function getPriorityBadge(priority) {
    const p = (priority !== null && priority !== undefined) ? parseInt(priority) : 2;
    
    if (p === 0 || p === 1) {
        return `<span style="background:#FBE9E7; color:#d32f2f; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold;">${p} - Alta</span>`;
    } else if (p === 2) {
        return `<span style="background:#E8F5E9; color:#2e7d32; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold;">${p} - Normal</span>`;
    } else {
        return `<span style="background:#ECEFF1; color:#546E7A; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold;">${p} - Baja</span>`;
    }
}
window.abrirModalCrearJob = () => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = '';

    if (document.getElementById('jobPriority')) {
        document.getElementById('jobPriority').value = '2';
    }

    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => {
        cb.checked = false;
        const divOpts = document.getElementById(`opts_${cb.value}`);
        if (divOpts) divOpts.style.display = 'none';

        const qtyInput = document.getElementById(`qty_${cb.value}`);
        const unitInput = document.getElementById(`unit_${cb.value}`);
        if (qtyInput) qtyInput.value = '';
        if (unitInput) unitInput.value = '';
    });
    if (document.getElementById('granTotalMateriales')) document.getElementById('granTotalMateriales').textContent = '0.00';

    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-hammer"></i> Nuevo Trabajo';
    document.getElementById('modalJob').style.display = 'flex';
    inicializarMapa(-2.900128, -79.005896);
};

window.abrirModalEditarJob = async (id) => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = id;
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Trabajo';

    // Limpiar todos los checkboxes y cajas
    document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => {
        cb.checked = false;
        const divOpts = document.getElementById(`opts_${cb.value}`);
        if (divOpts) divOpts.style.display = 'none';
        const qtyInput = document.getElementById(`qty_${cb.value}`);
        const unitInput = document.getElementById(`unit_${cb.value}`);
        if (qtyInput) qtyInput.value = '';
        if (unitInput) unitInput.value = '';
    });
    if (document.getElementById('granTotalMateriales')) document.getElementById('granTotalMateriales').textContent = '0.00';

    try {
        Swal.fire({ title: 'Cargando datos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const response = await fetch(`${API_URL}/find-id/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` } });

        if (response.ok) {
            const data = await response.json();

            // Limpiamos la descripción de los datos viejos
            let descripcionLimpia = data.description || '';
            if (descripcionLimpia.includes('[MATERIALES PRE-ASIGNADOS]:')) {
                descripcionLimpia = descripcionLimpia.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
            }

            document.getElementById('jobClientName').value = data.clientName;
            document.getElementById('jobClientPhone').value = data.clientPhone;
            document.getElementById('jobDesc').value = descripcionLimpia;
            document.getElementById('jobDate').value = fechaParaInput(data.jobDate);
            document.getElementById('jobAddress').value = data.address;
            document.getElementById('jobLat').value = data.latitude;
            document.getElementById('jobLng').value = data.longitude;
            document.getElementById('jobSafeBox').value = data.safeDepositBoxCodes || '';
            document.getElementById('jobPay').value = data.pay;
            document.getElementById('jobStatus').value = data.status || 'PENDING';
            document.getElementById('jobEmployee').value = data.employeeId;

            if (data.priority !== null && data.priority !== undefined) {
                document.getElementById('jobPriority').value = data.priority;
            } else {
                document.getElementById('jobPriority').value = '2';
            }

            // 🔥 AHORA LEEMOS LOS DATOS DIRECTO DE LA BASE DE DATOS (DEL JSON)
            if (data.materials && data.materials.length > 0) {
                document.querySelectorAll('input[name="jobMaterials"]').forEach(cb => {
                    const matGuardado = data.materials.find(m => m.materialId == cb.value);

                    if (matGuardado) {
                        cb.checked = true;
                        const divOpts = document.getElementById(`opts_${cb.value}`);
                        if (divOpts) divOpts.style.display = 'flex';

                        const qtyInput = document.getElementById(`qty_${cb.value}`);
                        const unitInput = document.getElementById(`unit_${cb.value}`);

                        // Traemos los números reales de Java
                        if (qtyInput && matGuardado.quantity !== null) qtyInput.value = matGuardado.quantity;
                        if (unitInput && matGuardado.unit !== null) unitInput.value = matGuardado.unit;
                    }
                });
                window.calcularCostoMateriales();
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

    // 🔥 ARMAMOS LA LISTA DE MATERIALES PARA JAVA DIRECTAMENTE
    const matCheckboxes = document.querySelectorAll('input[name="jobMaterials"]:checked');
    const selectedMaterials = [];

    matCheckboxes.forEach(cb => {
        const matId = parseInt(cb.value);
        const cantidadStr = document.getElementById(`qty_${matId}`).value.trim();
        const unidad = document.getElementById(`unit_${matId}`).value.trim();

        const cantidadNum = cantidadStr ? parseFloat(cantidadStr) : 0;

        selectedMaterials.push({
            materialId: matId,
            quantity: cantidadNum,
            unit: unidad || 'N/A'
        });
    });

    const descripcionFinal = document.getElementById('jobDesc').value.trim();

    // 🔥 Capturamos la prioridad. Si está vacía o es inválida, mandamos 2 por defecto.
    let prioridadSeleccionada = parseInt(document.getElementById('jobPriority').value);
    if (isNaN(prioridadSeleccionada)) {
        prioridadSeleccionada = 2;
    }

    // 🔥 ENVIAMOS "materials" EN LUGAR DE "materialIds"
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
        managerId: myManagerId,
        materials: selectedMaterials,
        priority: prioridadSeleccionada
    };

    if (!payload.clientName || !payload.employeeId || !payload.jobDate || isNaN(payload.latitude) || isNaN(payload.pay)) {
        return Swal.fire('Error', 'Por favor llena todos los campos obligatorios, incluyendo la fecha.', 'error');
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
            let errorMsg = 'No se pudo guardar el trabajo.';
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData.message === 'object') {
                    errorMsg = Object.values(errorData.message).join('<br>');
                } else if (errorData && errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) { }
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

// =========================================================
// UTILIDADES PARA EL CÁLCULO DE MATERIALES
// =========================================================

window.toggleMaterialOpciones = (matId) => {
    const checkbox = document.querySelector(`input[name="jobMaterials"][value="${matId}"]`);
    const divOpts = document.getElementById(`opts_${matId}`);
    const inputQty = document.getElementById(`qty_${matId}`);

    if (checkbox.checked) {
        divOpts.style.display = 'flex';
        if (!inputQty.value) inputQty.value = 1;
    } else {
        divOpts.style.display = 'none';
        inputQty.value = '';
    }
    window.calcularCostoMateriales();
};

window.calcularCostoMateriales = () => {
    let granTotal = 0;
    const checkboxes = document.querySelectorAll('input[name="jobMaterials"]:checked');

    checkboxes.forEach(cb => {
        const matId = cb.value;
        const price = parseFloat(cb.getAttribute('data-price')) || 0;
        const qty = parseFloat(document.getElementById(`qty_${matId}`).value) || 0;

        const subtotal = price * qty;
        document.getElementById(`subtotal_${matId}`).textContent = subtotal.toFixed(2);
        granTotal += subtotal;
    });

    const txtGranTotal = document.getElementById('granTotalMateriales');
    if (txtGranTotal) {
        txtGranTotal.textContent = granTotal.toFixed(2);
    }
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
            text: "Selecciona si deseas salir del portal o cambiar tu rol de trabajo.",
            icon: "question",
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: "#198754",
            denyButtonColor: "#00B8A9",
            cancelButtonColor: "#d33",
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
            text: "¿Estás seguro que deseas salir del portal?",
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
    }
};

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
            nombreRol = 'Acceder como Jefe'; 
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