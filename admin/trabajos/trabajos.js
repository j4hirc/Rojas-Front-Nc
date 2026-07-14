const API_URL = 'https://api-remomn.onrender.com/api/v1/jobs';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';
const MATERIALS_URL = 'https://api-remomn.onrender.com/api/v1/materials/all';

let userToken = '';
let mapa, marcador;
let allJobsCache = [];

let allMaterialsCache = [];
let materialesEstado = {};

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

    const txtIn = document.getElementById('searchJobInput');
    const estIn = document.getElementById('filterStatusInput');
    const priIn = document.getElementById('filterPriorityInput');
    const btnCl = document.getElementById('clearPriorityBtn');
    const empIn = document.getElementById('filterEmployeeInput');

    if (txtIn) txtIn.addEventListener('input', window.filtrarTrabajosCombinados);
    if (estIn) estIn.addEventListener('change', window.filtrarTrabajosCombinados);
    if (priIn) priIn.addEventListener('input', window.filtrarTrabajosCombinados);
    if (empIn) empIn.addEventListener('change', window.filtrarTrabajosCombinados);
    if (btnCl) {
        btnCl.addEventListener('click', () => {
            document.getElementById('filterPriorityInput').value = '';
            window.filtrarTrabajosCombinados();
        });
    }

    const matSearchIn = document.getElementById('searchMaterialInput');
    const matCatIn = document.getElementById('filterCategoryMaterial');
    if (matSearchIn) matSearchIn.addEventListener('input', window.filtrarMateriales);
    if (matCatIn) matCatIn.addEventListener('change', window.filtrarMateriales);

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

async function cargarUsuariosYMateriales(emailActual) {
    try {
        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (resUsers.ok) {
            const users = await resUsers.json();

            if (typeof myManagerId !== 'undefined') {
                const jefeActual = users.find(u => u.email === emailActual);
                if (jefeActual) myManagerId = jefeActual.userId;
            }

            const selectEmp = document.getElementById('jobEmployee');
            if (selectEmp) {
                selectEmp.innerHTML = '<option value="">-- Seleccione Subcontratista --</option>';
                const empleados = users.filter(u => u.status !== 'Unemployed' && u.roles.some(r => r.name === 'ROLE_EMPLOYEE'));
                empleados.forEach(u => {
                    const fullName = u.name || `${u.firstName} ${u.lastName}`;
                    selectEmp.innerHTML += `<option value="${u.userId}">${fullName}</option>`;
                });

                // 🔥 Filtro por subcontratista: usamos el NOMBRE (no el ID),
                // porque /jobs/all trae nameEmployee, no employeeId, en cada trabajo.
                const filterEmp = document.getElementById('filterEmployeeInput');
                if (filterEmp) {
                    filterEmp.innerHTML = '<option value="">Todos los Subcontratistas</option>';
                    empleados.forEach(u => {
                        const fullName = u.name || `${u.firstName} ${u.lastName}`;
                        filterEmp.innerHTML += `<option value="${fullName}">${fullName}</option>`;
                    });
                }
            }

            const selectManager = document.getElementById('jobManager');
            if (selectManager) {
                selectManager.innerHTML = '<option value="">-- Seleccione Manager --</option>';
                const managers = users.filter(u => u.status !== 'Unemployed' && (u.roles.some(r => r.name === 'ROLE_JEFE') || u.roles.some(r => r.name === 'ROLE_ADMIN')));
                managers.forEach(u => {
                    const fullName = u.name || `${u.firstName} ${u.lastName}`;
                    selectManager.innerHTML += `<option value="${u.userId}">${fullName}</option>`;
                });
            }
        }

        const resMat = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (resMat.ok) {
            allMaterialsCache = await resMat.json();
            poblarCategoriasMateriales(allMaterialsCache);
            renderizarMateriales(allMaterialsCache);
        }
    } catch (e) { console.error("Error cargando dependencias", e); }
}

function obtenerNombreCategoria(mat) {
    return mat.categoryName || (mat.category && (mat.category.name || mat.category)) || '';
}

function poblarCategoriasMateriales(materials) {
    const select = document.getElementById('filterCategoryMaterial');
    if (!select) return;

    const valorActual = select.value;
    const categorias = new Set();
    materials.forEach(mat => {
        const cat = obtenerNombreCategoria(mat);
        if (cat) categorias.add(cat);
    });

    select.innerHTML = '<option value="">Todas las Categorías</option>';
    [...categorias].sort((a, b) => a.localeCompare(b)).forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    if ([...categorias].includes(valorActual)) select.value = valorActual;
}

function renderizarMateriales(materials) {
    const containerMat = document.getElementById('materialsContainer');
    if (!containerMat) return;

    containerMat.innerHTML = '';

    if (!materials || materials.length === 0) {
        containerMat.innerHTML = '<span style="color:#666;">No se encontraron materiales con ese filtro.</span>';
        return;
    }

    materials.forEach(mat => {
        const precioMat = mat.price || 0;
        const estado = materialesEstado[mat.materialId] || {};
        const checkedAttr = estado.checked ? 'checked' : '';

        const safeUnit = mat.unit ? mat.unit.replace(/'/g, "\\'") : '';
        const displayUnit = mat.unit ? ` ${mat.unit}` : '';

        containerMat.innerHTML += `
        <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #2b3674; font-weight: bold; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" name="jobMaterials" value="${mat.materialId}" data-name="${mat.name}" data-price="${precioMat}" data-unit="${safeUnit}" onchange="toggleMaterialOpciones(${mat.materialId})" ${checkedAttr}>
                    ${mat.name} <span style="font-size: 0.8rem; font-weight: normal; color: #666;">(Disp: ${mat.count || 0}${displayUnit})</span>
                </div>
                <span style="color: #198754; font-size: 12px; background: #e8f5e9; padding: 2px 6px; border-radius: 4px;">$${precioMat.toFixed(2)} c/u</span>
            </label>
        </div>
        `;
    });
}

window.filtrarMateriales = () => {
    const texto = document.getElementById('searchMaterialInput') ? document.getElementById('searchMaterialInput').value.toLowerCase().trim() : '';
    const categoria = document.getElementById('filterCategoryMaterial') ? document.getElementById('filterCategoryMaterial').value : '';

    const filtrados = allMaterialsCache.filter(mat => {
        const coincideTexto = (mat.name || '').toLowerCase().includes(texto);
        const coincideCategoria = !categoria || obtenerNombreCategoria(mat) === categoria;
        return coincideTexto && coincideCategoria;
    });

    renderizarMateriales(filtrados);
};

async function cargarTrabajos() {
    try {
        const response = await fetch(`${API_URL}/all`, { method: 'GET', headers: { 'Authorization': `Bearer ${userToken}` } });
        if (response.ok) {
            allJobsCache = await response.json();
            filtrarTrabajosCombinados();
        }
    } catch (error) { console.error("Error al cargar trabajos", error); }
}

window.filtrarTrabajosCombinados = () => {
    const texto = document.getElementById('searchJobInput') ? document.getElementById('searchJobInput').value.toLowerCase().trim() : '';
    const estado = document.getElementById('filterStatusInput') ? document.getElementById('filterStatusInput').value : 'ALL';
    const prioridad = document.getElementById('filterPriorityInput') ? document.getElementById('filterPriorityInput').value.trim() : '';
    const empleadoNombre = document.getElementById('filterEmployeeInput') ? document.getElementById('filterEmployeeInput').value : ''; // 🔥 NUEVO

    const trabajosFiltrados = allJobsCache.filter(job => {
        const coincideTexto =
            (job.clientName || '').toLowerCase().includes(texto) ||
            (job.clientPhone || '').toLowerCase().includes(texto) ||
            (job.description || '').toLowerCase().includes(texto) ||
            (job.employeeName || '').toLowerCase().includes(texto) || 
            (job.managerName || '').toLowerCase().includes(texto);  

        const coincideEstado = (estado === 'ALL') || (job.status === estado);

        let coincidePrioridad = true;
        if (prioridad !== '') {
            const prioBuscada = parseInt(prioridad);
            const prioJob = (job.priority !== null && job.priority !== undefined && job.priority !== '') ? parseInt(job.priority) : 2;
            coincidePrioridad = prioJob === prioBuscada;
        }

        // 🔥 NUEVO: comparamos por nombre, igual que se muestra en la tabla
        const coincideEmpleado = (empleadoNombre === '') || (job.nameEmployee === empleadoNombre);

        return coincideTexto && coincideEstado && coincidePrioridad && coincideEmpleado;
    });

    renderizarTrabajos(trabajosFiltrados);
};

function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    // 🔥 EL CHISMOSO: Abre tu página, presiona F12, ve a la pestaña "Consola" (Console) y mira qué sale aquí
    console.log("👀 DATOS QUE LLEGAN DE JAVA:", trabajos);

    if (trabajos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">No hay trabajos registrados.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #666;">No hay trabajos registrados.</div>`;
        return;
    }

    trabajos.forEach(job => {
        let statusBadge = '';
        if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
        else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
        else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
        else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;

        let priorityBadge = '';
        const pValor = job.priority !== null && job.priority !== undefined ? job.priority : 2;

        if (pValor === 0 || pValor === 1) {
            priorityBadge = `<span style="background: #FBE9E7; color: #d32f2f; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid #ffccbc;"><i class="fa-solid fa-triangle-exclamation"></i> ${pValor} - Alta</span>`;
        } else if (pValor === 2) {
            priorityBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid #c8e6c9;"><i class="fa-solid fa-circle-info"></i> ${pValor} - Normal</span>`;
        } else {
            priorityBadge = `<span style="background: #ECEFF1; color: #546E7A; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid #cfd8dc;"> ${pValor} - Baja</span>`;
        }

        const empName = job.nameEmployee || 'Sin asignar';
        const manName = job.nameManager || 'Sin asignar';
        const fechaTxt = formatearFecha(job.jobDate);

        let safeDesc = job.description ? job.description : 'Sin descripción';
        if (safeDesc.includes('[MATERIALES PRE-ASIGNADOS]:')) {
            safeDesc = safeDesc.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
        }

        // 🔥 ATRAPAMOS CUALQUIER NOMBRE QUE JAVA LE HAYA PUESTO AL PLANO
        const urlPlano = job.blueprintUrl || job.blueprint_url;

        let btnPlanoTable = '';
        let btnPlanoCard = '';
        if (urlPlano) {
            btnPlanoTable = `
                <a href="${urlPlano}" target="_blank" class="btn-edit" style="background: #10B981; color: white; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; margin-right: 5px;" title="Ver Plano/Documento">
                    <i class="fa-solid fa-file-pdf"></i>
                </a>
            `;
            btnPlanoCard = `
                <a href="${urlPlano}" target="_blank" style="flex: 1; padding: 8px; border-radius: 8px; background: #E8F5E9; color: #10B981; text-decoration: none; font-weight: bold; font-size: 13px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 5px;" title="Ver Plano/Documento">
                    <i class="fa-solid fa-file-pdf"></i> Plano
                </a>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
    <td>
        <div class="cell-wrap">
            <strong>${job.clientName}</strong><br>
            <small style="color:#666;"><i class="fa-solid fa-phone"></i> ${job.clientPhone}</small>
        </div>
    </td>
    <td>
        <div class="cell-wrap">
            ${job.address}<br>
            <small style="color:#0f4c81; font-weight: 500;"><i class="fa-regular fa-calendar"></i> ${fechaTxt}</small>
        </div>
    </td>
    <td>
        <div class="cell-wrap" title="${safeDesc.replace(/"/g, '&quot;')}">
            ${safeDesc}
        </div>
    </td>
    <td>
        <div class="cell-wrap">
            <span style="color:#0f4c81; font-weight: 500;">E: ${empName}</span><br>
            <span style="color:#546e7a; font-size: 13px;">M: ${manName}</span>
        </div>
    </td>
    <td>${statusBadge}</td>
    <td>${priorityBadge}</td>
    <td style="font-weight: bold; color: #2e7d32;">$${job.pay.toFixed(2)}</td>
    <td>
        <div class="acciones-cell">
            ${btnPlanoTable}
            <a href="../evidencias/evidencias.html?jobId=${job.jobId}" class="btn-edit" style="background: #0f4c81; color: white; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;" title="Ver Evidencias">
                <i class="fa-solid fa-camera"></i>
            </a>
            <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" title="Editar">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
        tbody.appendChild(tr);

        if (mobileContainer) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.padding = '20px';

            card.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; border-bottom: 1px dashed #E0E5F2; padding-bottom: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; gap: 5px;">
                    <h3 style="margin:0; font-size:1.1rem; color:#0f4c81;">${job.clientName}</h3>
                    <div style="display: flex; gap: 5px;">
                        ${statusBadge}
                        ${priorityBadge}
                    </div>
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

                <div class="card-actions" style="margin-top: 15px; width: 100%; display: flex; gap: 10px; flex-wrap: wrap;">
                    ${btnPlanoCard}
                    <a href="../evidencias/evidencias.html?jobId=${job.jobId}" style="flex: 1; padding: 8px; border-radius: 8px; background: #E3F2FD; color: #0f4c81; text-decoration: none; font-weight: bold; font-size: 13px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <i class="fa-solid fa-camera"></i> Evidencias
                    </a>
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

    if (document.getElementById('jobPriority')) {
        document.getElementById('jobPriority').value = '2';
    }

    materialesEstado = {};
    if (document.getElementById('searchMaterialInput')) document.getElementById('searchMaterialInput').value = '';
    if (document.getElementById('filterCategoryMaterial')) document.getElementById('filterCategoryMaterial').value = '';

    renderizarMateriales(allMaterialsCache);
    limpiarMaterialesNecesarios();

    // 🔥 Limpia el input del archivo y esconde el link del documento
    if (document.getElementById('jobBlueprint')) document.getElementById('jobBlueprint').value = '';
    if (document.getElementById('currentBlueprintContainer')) document.getElementById('currentBlueprintContainer').style.display = 'none';

    const payInput = document.getElementById('jobPay');
    if (payInput) {
        payInput.value = '0.00';
        payInput.readOnly = true;
    }

    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-hammer"></i> Nuevo Trabajo';
    document.getElementById('modalJob').style.display = 'flex';
    inicializarMapa(-2.900128, -79.005896);
};

window.abrirModalEditarJob = async (id) => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = id;
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Trabajo';

    materialesEstado = {};
    if (document.getElementById('searchMaterialInput')) document.getElementById('searchMaterialInput').value = '';
    if (document.getElementById('filterCategoryMaterial')) document.getElementById('filterCategoryMaterial').value = '';
    renderizarMateriales(allMaterialsCache);

    try {
        Swal.fire({ title: 'Cargando datos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const response = await fetch(`${API_URL}/find-id/${id}`, { headers: { 'Authorization': `Bearer ${userToken}` } });

        if (response.ok) {
            const data = await response.json();

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
            document.getElementById('jobManager').value = data.managerId;

            if (data.priority !== null && data.priority !== undefined) {
                document.getElementById('jobPriority').value = data.priority;
            } else {
                document.getElementById('jobPriority').value = '2';
            }

            // 🔥 MUESTRA EL LINK DEL PLANO SI EXISTE EN LA BASE DE DATOS
            const blueprintContainer = document.getElementById('currentBlueprintContainer');
            const blueprintLink = document.getElementById('currentBlueprintLink');
            const fileInput = document.getElementById('jobBlueprint');

            if (fileInput) fileInput.value = '';

            if (data.blueprintUrl && blueprintContainer && blueprintLink) {
                blueprintContainer.style.display = 'block';
                blueprintLink.href = data.blueprintUrl;
            } else if (blueprintContainer) {
                blueprintContainer.style.display = 'none';
            }

            limpiarMaterialesNecesarios();

            if (data.materials && data.materials.length > 0) {
                data.materials.forEach(m => {
                    materialesEstado[m.materialId] = { checked: true };
                });
                renderizarMateriales(allMaterialsCache);

                data.materials.forEach(m => {
                    const matInfo = allMaterialsCache.find(x => x.materialId == m.materialId);
                    const nombreMat = matInfo ? matInfo.name : (m.name || 'Material');
                    const precioMat = matInfo ? (matInfo.price || 0) : (m.price || 0);
                    agregarMaterialNecesarioDesdeInventario(m.materialId, nombreMat, precioMat, m.quantity, m.unit);
                });
            }

            if (data.necessaryMaterials && Array.isArray(data.necessaryMaterials) && data.necessaryMaterials.length > 0) {
                const container = document.getElementById('necessaryMaterialsContainer');
                data.necessaryMaterials.forEach(mat => {
                    if (document.getElementById(`nec-${mat.materialId}`)) return;

                    const precio = mat.estimatedPrice || mat.price || 0;
                    container.insertAdjacentHTML('beforeend',
                        crearFilaMaterialNecesario(mat.materialId, mat.name || 'Material', precio, mat.quantity || 1, mat.unit)
                    );
                });
            }

            calcularTotalMaterialesNecesarios();

            const payInput = document.getElementById('jobPay');
            if (payInput) {
                payInput.readOnly = true;
                if (data.materials?.length === 0 && data.necessaryMaterials?.length === 0) {
                    payInput.value = data.pay || '0.00';
                }
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

function limpiarMaterialesNecesarios() {
    document.getElementById('necessaryMaterialsContainer').innerHTML = '';
    document.getElementById('totalNecessaryMaterials').textContent = '0.00';
}

window.cerrarModalJob = () => {
    document.getElementById('modalJob').style.display = 'none';
};

window.guardarTrabajo = async () => {
    const id = document.getElementById('jobId').value;
    const isEditing = id !== '';

    const matCheckboxes = document.querySelectorAll('input[name="jobMaterials"]:checked');
    const selectedMaterials = [];

    let resumenMateriales = '';
    matCheckboxes.forEach(cb => {
        const matId = parseInt(cb.value);
        const nombreMat = cb.getAttribute('data-name');

        const filaNecesaria = document.getElementById(`nec-${matId}`);
        const qtyInput = filaNecesaria ? filaNecesaria.querySelector('.nec-qty') : null;
        const unitInput = filaNecesaria ? filaNecesaria.querySelector('.nec-unit') : null;
        const cantidadStr = qtyInput ? qtyInput.value.trim() : '1';
        const unidadStr = unitInput ? unitInput.value.trim() : '';
        const cantidadNum = cantidadStr ? parseFloat(cantidadStr) : 1;

        selectedMaterials.push({
            materialId: matId,
            quantity: cantidadNum,
            unit: unidadStr || 'N/A'
        });

        const textoCantidad = cantidadStr ? `${cantidadStr} ${unidadStr}`.trim() : 'Asignado';
        resumenMateriales += `• ${nombreMat}: ${textoCantidad}\n`;
    });

    let descripcionBase = document.getElementById('jobDesc').value.trim();
    if (descripcionBase.includes('[MATERIALES PRE-ASIGNADOS]:')) {
        descripcionBase = descripcionBase.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
    }

    let descripcionFinal = descripcionBase;
    if (resumenMateriales !== '') {
        descripcionFinal = `${descripcionBase}\n\n[MATERIALES PRE-ASIGNADOS]:\n${resumenMateriales}`;
    }

    let prioridadSeleccionada = parseInt(document.getElementById('jobPriority').value);
    if (isNaN(prioridadSeleccionada)) {
        prioridadSeleccionada = 2;
    }

    const necessaryMaterials = [];
    document.querySelectorAll('.necessary-material-row').forEach(row => {
        const matId = row.id.replace('nec-', '');
        const name = row.querySelector('div').textContent.trim();
        const qtyInput = row.querySelector('.nec-qty');
        const qty = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;

        let price = 0;
        const priceInput = row.querySelector('.nec-price');
        if (priceInput) {
            price = parseFloat(priceInput.value) || 0;
        } else {
            const priceMatch = row.textContent.match(/\$([\d.]+)/);
            if (priceMatch) price = parseFloat(priceMatch[1]) || 0;
        }

        const unitInput = row.querySelector('.nec-unit');
        const unit = unitInput ? unitInput.value.trim() : '';

        necessaryMaterials.push({
            materialId: parseInt(matId),
            name: name,
            quantity: qty,
            unit: unit,
            estimatedPrice: price
        });
    });

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
        materials: selectedMaterials,
        necessaryMaterials: necessaryMaterials,
        priority: prioridadSeleccionada
    };

    if (!payload.clientName || !payload.employeeId || !payload.managerId || !payload.jobDate || isNaN(payload.latitude)) {
        return Swal.fire('Error', 'Por favor completa los campos obligatorios (Cliente, Empleado, Manager, Fecha y Ubicación).', 'error');
    }

    Swal.fire({ title: 'Guardando trabajo...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const url = isEditing ? `${API_URL}/update-job/${id}` : `${API_URL}/create-job`;
    const method = isEditing ? 'PUT' : 'POST';

    // 🔥 AHORA SÍ ENVIAMOS EL JSON Y EL ARCHIVO CON FORMDATA
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

    const fileInput = document.getElementById('jobBlueprint');
    if (fileInput && fileInput.files.length > 0) {
        formData.append('file', fileInput.files[0]);
    }

    try {
        const response = await fetch(url, {
            method: method,
            // 🔥 El Content-Type se genera solo para enviar el FormData
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
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
    const rolesString = localStorage.getItem('user_roles');
    let userRoles = [];
    if (rolesString) {
        try { userRoles = JSON.parse(rolesString); } catch (e) { console.error("Error al leer roles"); }
    }

    if (userRoles.length > 1) {
        Swal.fire({
            title: "¿Qué deseas hacer?",
            text: "Selecciona si deseas salir del sistema o cambiar tu rol de trabajo.",
            icon: "question",
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: "#0f4c81",
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
                mostrarSelectorDeRolesEnSubcarpeta(userRoles);
            }
        });
    } else {
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
    }
};

function mostrarSelectorDeRolesEnSubcarpeta(roles) {
    if (typeof cerrarModalPerfil === 'function') {
        cerrarModalPerfil();
    } else {
        const modales = document.querySelectorAll('.modal-overlay');
        modales.forEach(m => m.style.display = 'none');
    }

    let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';

    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';

        if (rol === 'ROLE_ADMIN') {
            nombreRol = '<i class="fa-solid fa-user-tie"></i> Acceder como Administrador';
            url = '../admin-dashboard.html';
        }
        if (rol === 'ROLE_JEFE') {
            nombreRol = '<i class="fa-solid fa-user-shield"></i> Acceder como Jefe';
            url = '../../jefe/jefe-dashboard.html';
        }
        if (rol === 'ROLE_EMPLOYEE') {
            nombreRol = '<i class="fa-solid fa-helmet-safety"></i> Acceder como Subcontratista';
            url = '../../employee/employee-dashboard.html';
        }

        if (nombreRol) {
            opcionesHTML += `<button class="swal2-confirm swal2-styled" style="width: 100%; margin: 0; background-color: #00B8A9;" onclick="window.location.href='${url}'">${nombreRol}</button>`;
        }
    });

    opcionesHTML += '</div>';

    Swal.fire({
        title: 'Selecciona tu área de trabajo',
        html: opcionesHTML,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#d33'
    });
}

window.toggleMaterialOpciones = (matId) => {
    const checkbox = document.querySelector(`input[name="jobMaterials"][value="${matId}"]`);
    const matName = checkbox.getAttribute('data-name');
    const matPrice = parseFloat(checkbox.getAttribute('data-price')) || 0;

    const matUnit = checkbox.getAttribute('data-unit') || '';

    if (!materialesEstado[matId]) materialesEstado[matId] = {};
    materialesEstado[matId].checked = checkbox.checked;

    if (checkbox.checked) {
        agregarMaterialNecesarioDesdeInventario(matId, matName, matPrice, 1, matUnit);
    } else {
        eliminarMaterialNecesarioPorId(matId);
        delete materialesEstado[matId];
    }
};

// 🔥 FILAS DE MATERIAL CON PRECIO Y UNIDAD BLOQUEADOS
function crearFilaMaterialNecesario(matId, name, price, qtyInicial, unitInicial) {
    const qty = (qtyInicial !== undefined && qtyInicial !== null) ? qtyInicial : 1;
    const unit = (unitInicial !== undefined && unitInicial !== null) ? unitInicial : '';

    return `
        <div class="necessary-material-row" id="nec-${matId}">
            <div class="nec-name" title="${name}">${name}</div>
            <div class="nec-fields">
                <input type="number" class="nec-qty" value="${qty}" min="1"
                       oninput="calcularTotalMaterialesNecesarios()" data-matid="${matId}" title="Cantidad (Editable)">
                <input type="text" class="nec-unit" placeholder="Unidad" value="${unit}" readonly
                       data-matid="${matId}" title="Unidad (Fija)">
                <input type="number" class="nec-price" value="${price}" step="0.01" min="0" readonly
                       data-matid="${matId}" title="Precio Unitario (Fijo)">
                <button type="button" class="nec-delete" onclick="eliminarMaterialNecesarioPorId(${matId})" title="Quitar Material">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

window.agregarMaterialNecesarioDesdeInventario = (matId, name, price, qtyInicial, unitInicial) => {
    const container = document.getElementById('necessaryMaterialsContainer');

    if (document.getElementById(`nec-${matId}`)) return;

    container.insertAdjacentHTML('beforeend', crearFilaMaterialNecesario(matId, name, price, qtyInicial, unitInicial));
    calcularTotalMaterialesNecesarios();
};

window.eliminarMaterialNecesarioPorId = (matId) => {
    const row = document.getElementById(`nec-${matId}`);
    if (row) row.remove();
    calcularTotalMaterialesNecesarios();
};

window.calcularTotalMaterialesNecesarios = () => {
    let total = 0;

    document.querySelectorAll('.necessary-material-row').forEach(row => {
        const qtyInput = row.querySelector('.nec-qty');
        const priceInput = row.querySelector('.nec-price');

        const qty = qtyInput ? parseFloat(qtyInput.value) || 0 : 0;
        const price = priceInput ? parseFloat(priceInput.value) || 0 : 0;

        total += qty * price;
    });

    const totalElement = document.getElementById('totalNecessaryMaterials');
    if (totalElement) {
        totalElement.textContent = total.toFixed(2);
    }

    const payInput = document.getElementById('jobPay');
    if (payInput) {
        payInput.value = total.toFixed(2);
    }
};

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