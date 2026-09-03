const API_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/jobs';
const USERS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user/all-users';
const MATERIALS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/materials/all';

let userToken = '';
let myManagerId = null;
let mapa, marcador;
let allJobsCache = [];

let allMaterialsCache = [];
let materialesEstado = {};
let blueprintsNuevos = []; // acumula los File objects seleccionados en la sesión de edición actual
let colorPorEmpleadoId = {}; // Mapa: userId -> color hex del subcontratista

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

    const searchInput = document.getElementById('searchJobInput');
    const statusInput = document.getElementById('filterStatusInput');
    const priorityInput = document.getElementById('filterPriorityInput');
    const empIn = document.getElementById('filterEmployeeInput');
    const manIn = document.getElementById('filterManagerInput'); // 🔥 NUEVO FILTRO MANAGER
    const btnCl = document.getElementById('clearPriorityBtn');

    if (searchInput) searchInput.addEventListener('input', filtrarTrabajosCombinados);
    if (statusInput) statusInput.addEventListener('change', filtrarTrabajosCombinados);
    if (priorityInput) priorityInput.addEventListener('input', filtrarTrabajosCombinados);
    if (empIn) empIn.addEventListener('change', filtrarTrabajosCombinados);
    if (manIn) manIn.addEventListener('change', filtrarTrabajosCombinados);

    const fechaDesdeIn = document.getElementById('filterDateFromInput');
    const fechaHastaIn = document.getElementById('filterDateToInput');
    if (fechaDesdeIn) fechaDesdeIn.addEventListener('change', filtrarTrabajosCombinados);
    if (fechaHastaIn) fechaHastaIn.addEventListener('change', filtrarTrabajosCombinados);

    if (btnCl) {
        btnCl.addEventListener('click', () => {
            if (document.getElementById('filterPriorityInput')) document.getElementById('filterPriorityInput').value = '';
            window.filtrarTrabajosCombinados();
        });
    }

    const inputBlueprint = document.getElementById('jobBlueprint');
    if (inputBlueprint) {
        inputBlueprint.addEventListener('change', () => {
            for (let i = 0; i < inputBlueprint.files.length; i++) {
                const f = inputBlueprint.files[i];
                const yaExiste = blueprintsNuevos.some(x => x.name === f.name && x.size === f.size);
                if (!yaExiste) blueprintsNuevos.push(f);
            }
            inputBlueprint.value = '';
            renderizarBlueprintsPendientes();
        });
    }

    const matSearchIn = document.getElementById('searchMaterialInput');
    const matCatIn = document.getElementById('filterCategoryMaterial');
    if (matSearchIn) matSearchIn.addEventListener('input', window.filtrarMateriales);
    if (matCatIn) matCatIn.addEventListener('change', window.filtrarMateriales);

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
    const empleadoNombre = document.getElementById('filterEmployeeInput')?.value || '';
    const managerIdFiltro = document.getElementById('filterManagerInput')?.value || ''; 
    const fechaDesde = document.getElementById('filterDateFromInput')?.value || '';
    const fechaHasta = document.getElementById('filterDateToInput')?.value || '';

    const trabajosFiltrados = allJobsCache.filter(job => {
        const coincideTexto =
            (job.clientName || '').toLowerCase().includes(texto) ||
            (job.description || '').toLowerCase().includes(texto) ||
            (job.clientPhone || '').toLowerCase().includes(texto) ||
            (job.nameEmployee || '').toLowerCase().includes(texto) ||
            (job.nameManager || '').toLowerCase().includes(texto); 

        const coincideEstado = estado === 'ALL' || job.status === estado;

        let coincidePrioridad = true;
        if (prioridadInput !== '') {
            const prioBuscada = parseInt(prioridadInput);
            const prioJob = (job.priority !== null && job.priority !== undefined && job.priority !== '')
                ? parseInt(job.priority)
                : 2;
            coincidePrioridad = prioJob === prioBuscada;
        }

        const coincideEmpleado = (empleadoNombre === '') || (job.nameEmployee === empleadoNombre);
        const coincideManager = (managerIdFiltro === '') || (job.managerId == managerIdFiltro);

        let coincideFecha = true;
        const jobDateStr = fechaParaInput(job.jobDate);
        if (fechaDesde && jobDateStr) coincideFecha = coincideFecha && (jobDateStr >= fechaDesde);
        if (fechaHasta && jobDateStr) coincideFecha = coincideFecha && (jobDateStr <= fechaHasta);

        return coincideTexto && coincideEstado && coincidePrioridad && coincideEmpleado && coincideManager && coincideFecha;
    });

    // 🔥 ORDENAMIENTO EXACTO COMO TU BASE DE DATOS (job_date DESC)
    trabajosFiltrados.sort((a, b) => {
        // 1. Extraer fecha B (puede venir como array [2026,9,4] o texto "2026-09-04")
        let timeB = Array.isArray(b.jobDate) 
            ? new Date(b.jobDate[0], b.jobDate[1] - 1, b.jobDate[2]).getTime() 
            : new Date(b.jobDate || 0).getTime();
            
        // 2. Extraer fecha A
        let timeA = Array.isArray(a.jobDate) 
            ? new Date(a.jobDate[0], a.jobDate[1] - 1, a.jobDate[2]).getTime() 
            : new Date(a.jobDate || 0).getTime();
            
        // 3. Comparar las fechas (El más reciente arriba)
        if (timeB !== timeA) {
            return timeB - timeA;
        }
        
        // 4. Si son del mismo día, ordenamos por ID (el creado más recientemente va arriba)
        return b.jobId - a.jobId;
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

                        const calle = [
                            a.house_number || '',
                            a.road || a.pedestrian || a.footway || ''
                        ].filter(p => p !== '').join(' ');

                        const partes = [
                            calle,
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

            colorPorEmpleadoId = {}; // <-- NUEVO
            users.forEach(u => { colorPorEmpleadoId[u.userId] = u.color; }); // <-- NUEVO

            if (typeof myManagerId !== 'undefined') {
                const jefeActual = users.find(u => u.email === emailActual);
                if (jefeActual) myManagerId = jefeActual.userId;
            }

            // 🔥 POBLAR EMPLEADOS
            const selectEmp = document.getElementById('jobEmployee');
            if (selectEmp) {
                selectEmp.innerHTML = '<option value="">-- Seleccione Subcontratista --</option>';
                const empleados = users.filter(u => u.status !== 'Unemployed' && u.roles.some(r => r.name === 'ROLE_EMPLOYEE'));
                empleados.forEach(u => {
                    const fullName = u.name || `${u.firstName} ${u.lastName}`;
                    selectEmp.innerHTML += `<option value="${u.userId}">${fullName}</option>`;
                });

                const filterEmp = document.getElementById('filterEmployeeInput');
                if (filterEmp) {
                    filterEmp.innerHTML = '<option value="">Todos los Subcontratistas</option>';
                    empleados.forEach(u => {
                        const fullName = u.name || `${u.firstName} ${u.lastName}`;
                        filterEmp.innerHTML += `<option value="${fullName}">${fullName}</option>`;
                    });
                }
            }

            // 🔥 POBLAR MANAGERS (NUEVO: Para filtros y creación si existe)
            const filterManager = document.getElementById('filterManagerInput');
            if (filterManager) {
                filterManager.innerHTML = '<option value="">Todos los Managers</option>';
                const managers = users.filter(u => u.status !== 'Unemployed' && (u.roles.some(r => r.name === 'ROLE_JEFE') || u.roles.some(r => r.name === 'ROLE_ADMIN')));
                managers.forEach(u => {
                    const fullName = u.name || `${u.firstName} ${u.lastName}`;
                    filterManager.innerHTML += `<option value="${u.userId}">${fullName}</option>`;
                });
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

function hexARgba(hex, alpha) {
    if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(200,200,200,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

// 🔥 AHORA EL JEFE TRAE TODOS LOS TRABAJOS (COMO EL ADMIN)
async function cargarTrabajos() {
    try {
        const res = await fetch(`${API_URL}/all`, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (res.ok) {
            allJobsCache = await res.json();
            
            // 1. Filtramos y dibujamos la tabla
            window.filtrarTrabajosCombinados();

            // --- CERRAMOS LA PANTALLA DE CARGA AQUÍ ---
            if (Swal.isVisible()) {
                Swal.close();
            }

            // 🔥 2. MAGIA: Detectar si venimos del calendario para ABRIR EL MODAL DE EDICIÓN
            const urlParams = new URLSearchParams(window.location.search);
            const trabajoParaAbrir = urlParams.get('abrir');

            if (trabajoParaAbrir) {
                const idNumerico = parseInt(trabajoParaAbrir);
                
                // Le damos 300ms a la pantalla para que termine de acomodarse y abrimos el modal
                setTimeout(() => {
                    window.abrirModalEditarJob(idNumerico);
                }, 300);
            }
        }
    } catch (e) { 
        console.error(e); 
        Swal.close();
    }
}

function getPriorityBadge(priority) {
    const pValor = (priority !== null && priority !== undefined) ? parseInt(priority) : 2;
    if (pValor === 0 || pValor === 1) {
        return `<span style="background:#FBE9E7; color:#d32f2f; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold; border: 1px solid #ffccbc;"><i class="fa-solid fa-triangle-exclamation"></i> ${pValor} - Alta</span>`;
    } else if (pValor === 2) {
        return `<span style="background:#E8F5E9; color:#2e7d32; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold; border: 1px solid #c8e6c9;"><i class="fa-solid fa-circle-info"></i> ${pValor} - Normal</span>`;
    } else {
        return `<span style="background:#ECEFF1; color:#546E7A; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:bold; border: 1px solid #cfd8dc;"> ${pValor} - Baja</span>`;
    }
}

function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

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

        const priorityBadge = getPriorityBadge(job.priority);
        const empName = job.nameEmployee || 'Sin asignar';
        const manName = job.nameManager || 'Sin asignar'; // 🔥 SE OBTIENE EL MANAGER
        const fechaTxt = formatearFecha(job.jobDate);

        let safeDesc = job.description ? job.description : 'Sin descripción';
        if (safeDesc.includes('[MATERIALES PRE-ASIGNADOS]:')) {
            safeDesc = safeDesc.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
        }

        let btnPlanoTable = '';
        let btnPlanoCard = '';
        const urlsPlanos = job.blueprintUrls || [];

        if (urlsPlanos && urlsPlanos.length > 0) {
            btnPlanoTable = `
                <button type="button" class="btn-edit" onclick="verPlanos(${job.jobId})" style="background: #198754; color: white; display: inline-flex; align-items: center; justify-content: center; margin-right: 5px; border:none; cursor:pointer;" title="Ver Planos (${urlsPlanos.length})">
                    <i class="fa-solid fa-file-pdf"></i> <span style="margin-left: 4px; font-size: 11px;">${urlsPlanos.length}</span>
                </button>
            `;
            btnPlanoCard = `
                <button type="button" onclick="verPlanos(${job.jobId})" style="flex: 1; padding: 8px; border-radius: 4px; background: #E8F5E9; color: #198754; text-decoration: none; font-weight: bold; font-size: 13px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 5px; border:none; cursor:pointer;" title="Ver Planos">
                    <i class="fa-solid fa-file-pdf"></i> Planos (${urlsPlanos.length})
                </button>
            `;
        }

        const colorSubcontratista = colorPorEmpleadoId[job.employeeId] || '#CCCCCC';
        const tr = document.createElement('tr');
        tr.style.borderLeft = `5px solid ${colorSubcontratista}`;
        tr.style.backgroundColor = hexARgba(colorSubcontratista, 0.06);
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
                    <small style="color:#198754; font-weight: 500;"><i class="fa-regular fa-calendar"></i> ${fechaTxt}</small>
                </div>
            </td>
            <td>
                <div class="cell-wrap" title="${safeDesc.replace(/"/g, '&quot;')}">
                    ${safeDesc}
                </div>
            </td>
            <td>
                <div class="cell-wrap">
                    <span style="color:#198754; font-weight: 500;">E: ${empName}</span><br>
                    <span style="color:#546e7a; font-size: 13px;">M: ${manName}</span>
                </div>
            </td>
            <td>${statusBadge}</td>
            <td>${priorityBadge}</td>
            <td style="font-weight: bold; color: #2e7d32;">$${job.pay.toFixed(2)}</td>
            <td>
                <div class="acciones-cell" style="display: flex; flex-wrap: wrap; gap: 5px; align-items: center;">
                    ${btnPlanoTable}
                    <a href="../evidencias/evidencias.html?jobId=${job.jobId}" class="btn-edit" style="background: #155e75; color: white; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;" title="Ver Evidencias">
                        <i class="fa-solid fa-camera"></i>
                    </a>
                    <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        if (mobileContainer) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = `padding: 20px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; width: 100%; margin-bottom: 15px; border-left: 6px solid ${colorSubcontratista}; background-color: ${hexARgba(colorSubcontratista, 0.06)};`;

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
                <p style="margin:0; color:#198754; font-size: 14px; font-weight: 600;"><i class="fa-regular fa-calendar"></i> Fecha: ${fechaTxt}</p>

                <div style="margin: 15px 0; padding: 12px; background: #f8faff; border-left: 4px solid #198754; border-radius: 6px; width: 100%;">
                    <strong style="color: #2B3674; font-size: 12px;"><i class="fa-solid fa-align-left"></i> Descripción del Trabajo:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #555; font-style: italic;">"${safeDesc}"</p>
                </div>

                <div style="background: #F9FAFC; padding: 10px; border-radius: 8px; margin-top: 10px; width: 100%;">
                    <p style="margin: 0; font-size: 13px; color:#198754;"><strong>E:</strong> ${empName}</p>
                    <p style="margin: 0; font-size: 13px; color:#546e7a;"><strong>M:</strong> ${manName}</p>
                </div>
                
                <p style="margin:10px 0 0 0; font-weight:bold; color:#2e7d32; font-size: 15px;">Pago: $${job.pay.toFixed(2)}</p>
                
                <div class="card-actions" style="margin-top:15px; display:flex; gap:8px; width: 100%; flex-wrap: wrap;">
                    ${btnPlanoCard}
                    <a href="../evidencias/evidencias.html?jobId=${job.jobId}" style="flex: 1; padding: 8px; border-radius: 4px; background: #155e75; color: white; text-decoration: none; font-weight: bold; font-size: 13px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <i class="fa-solid fa-camera"></i> Evidencias
                    </a>
                    <button class="btn-edit" onclick="abrirModalEditarJob(${job.jobId})" style="flex:1; padding: 8px 0; font-weight: bold; font-size: 13px;">Editar</button>
                    <button class="btn-delete" onclick="eliminarTrabajo(${job.jobId})" style="flex:1; padding: 8px 0; font-weight: bold; font-size: 13px;">Eliminar</button>
                </div>
            `;
            mobileContainer.appendChild(card);
        }
    });
}

window.verPlanos = (jobId) => {
    const job = allJobsCache.find(j => j.jobId === jobId);
    if (!job) return;

    const urls = job.blueprintUrls || [];
    const container = document.getElementById('listaPlanosContainer');
    container.innerHTML = '';

    if (urls.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666; font-size: 14px;">No hay planos adjuntos en este proyecto.</p>';
    } else {
        urls.forEach((url, idx) => {
            container.innerHTML += `
                <a href="${url}" target="_blank" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #198754; font-weight: 500; transition: all 0.2s;">
                    <span style="display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-file-pdf" style="color: #198754; font-size: 1.5rem;"></i>
                        Documento adjunto ${idx + 1}
                    </span>
                    <i class="fa-solid fa-external-link-alt" style="color: #64748b; font-size: 0.9rem;"></i>
                </a>
            `;
        });
    }

    document.getElementById('modalVerPlanos').style.display = 'flex';
};

window.cerrarModalPlanos = () => {
    document.getElementById('modalVerPlanos').style.display = 'none';
};

function renderizarBlueprintsPendientes() {
    let cont = document.getElementById('blueprintPendientesContainer');
    if (!cont) {
        const inputBp = document.getElementById('jobBlueprint');
        if (inputBp) {
            cont = document.createElement('div');
            cont.id = 'blueprintPendientesContainer';
            cont.style.marginTop = '8px';
            inputBp.insertAdjacentElement('afterend', cont);
        }
    }

    if (!cont) return;

    if (blueprintsNuevos.length === 0) {
        cont.innerHTML = '';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:6px;">';
    blueprintsNuevos.forEach((file, idx) => {
        html += `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:#f0f4f8; border-radius:6px; font-size:13px;">
                <span><i class="fa-solid fa-file"></i> ${file.name}</span>
                <button type="button" onclick="quitarBlueprintPendiente(${idx})" style="border:none; background:none; color:#d32f2f; cursor:pointer;" title="Quitar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
    });
    html += '</div>';
    cont.innerHTML = html;
}

window.quitarBlueprintPendiente = (idx) => {
    blueprintsNuevos.splice(idx, 1);
    renderizarBlueprintsPendientes();
};

function resetearScrollModal() {
    const modal = document.getElementById('modalJob');
    if (!modal) return;

    const resetTodo = () => {
        modal.scrollTop = 0;
        modal.querySelectorAll('*').forEach(el => {
            if (el.scrollHeight > el.clientHeight) {
                el.scrollTop = 0;
            }
        });
        window.scrollTo(0, 0);
    };

    requestAnimationFrame(resetTodo);
    setTimeout(resetTodo, 50);
    setTimeout(resetTodo, 300);
}

function limpiarMaterialesNecesarios() {
    document.getElementById('necessaryMaterialsContainer').innerHTML = '';
    const totalNecessary = document.getElementById('totalNecessaryMaterials');
    if (totalNecessary) totalNecessary.textContent = '0.00';
}

window.abrirModalCrearJob = () => {
    document.getElementById('formJob').reset();
    document.getElementById('jobId').value = '';

    blueprintsNuevos = [];
    renderizarBlueprintsPendientes();

    if (document.getElementById('jobPriority')) {
        document.getElementById('jobPriority').value = '2';
    }

    materialesEstado = {};
    if (document.getElementById('searchMaterialInput')) document.getElementById('searchMaterialInput').value = '';
    if (document.getElementById('filterCategoryMaterial')) document.getElementById('filterCategoryMaterial').value = '';
    renderizarMateriales(allMaterialsCache);

    limpiarMaterialesNecesarios();

    if (document.getElementById('jobBlueprint')) document.getElementById('jobBlueprint').value = '';
    if (document.getElementById('currentBlueprintContainer')) document.getElementById('currentBlueprintContainer').style.display = 'none';

    // 🔥 SETEAR MANAGER POR DEFECTO AL JEFE ACTUAL SI EL SELECT EXISTE
    if (document.getElementById('jobManager')) {
        document.getElementById('jobManager').value = myManagerId;
    }

    const payInput = document.getElementById('jobPay');
    if (payInput) {
        payInput.value = '0.00';
        payInput.readOnly = true;
    }

    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-hammer"></i> Nuevo Trabajo';
    document.getElementById('modalJob').style.display = 'flex';
    resetearScrollModal();
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

            if (document.getElementById('jobManager')) {
                document.getElementById('jobManager').value = data.managerId;
            }

            if (data.priority !== null && data.priority !== undefined) {
                document.getElementById('jobPriority').value = data.priority;
            } else {
                document.getElementById('jobPriority').value = '2';
            }

            const blueprintContainer = document.getElementById('currentBlueprintContainer');
            const fileInput = document.getElementById('jobBlueprint');

            if (fileInput) fileInput.value = '';
            blueprintsNuevos = [];
            renderizarBlueprintsPendientes();

            if (blueprintContainer) {
                blueprintContainer.innerHTML = '';
                const urlsPlanos = data.blueprintUrls || [];

                if (urlsPlanos.length > 0) {
                    blueprintContainer.style.display = 'block';
                    let htmlInner = `<i class="fa-solid fa-check-circle" style="color: #2e7d32;"></i> <span style="font-size: 13px; color: #2e7d32; font-weight: bold;">Planos guardados:</span><br><div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:5px;">`;

                    urlsPlanos.forEach((url, idx) => {
                        htmlInner += `
                            <a href="${url}" target="_blank" style="color: #198754; font-weight: bold; font-size: 13px; text-decoration: underline; background:#E8F5E9; padding:4px 8px; border-radius:4px;">
                                <i class="fa-solid fa-file-image"></i> Plano ${idx + 1}
                            </a>`;
                    });
                    htmlInner += `</div>`;
                    blueprintContainer.innerHTML = htmlInner;
                } else {
                    blueprintContainer.style.display = 'none';
                }
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
            resetearScrollModal();
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

    const filasMateriales = document.querySelectorAll('.necessary-material-row');
    const selectedMaterials = [];
    let resumenMateriales = '';

    filasMateriales.forEach(row => {
        const matId = parseInt(row.id.replace('nec-', ''));
        const nombreMat = row.querySelector('.nec-name')
            ? row.querySelector('.nec-name').textContent.trim()
            : 'Material';

        const qtyInput = row.querySelector('.nec-qty');
        const unitInput = row.querySelector('.nec-unit');
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
        const name = row.querySelector('.nec-name') ? row.querySelector('.nec-name').textContent.trim() : 'Material';
        const qtyInput = row.querySelector('.nec-qty');
        const qty = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;

        let price = 0;
        const priceInput = row.querySelector('.nec-price');
        if (priceInput) {
            price = parseFloat(priceInput.value) || 0;
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

    // Si el select del manager existe se toma, de lo contrario se asigna al Jefe logueado.
    const managerSelect = document.getElementById('jobManager');
    const selectedManagerId = (managerSelect && managerSelect.value) ? parseInt(managerSelect.value) : myManagerId;

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
        managerId: selectedManagerId, // 🔥 AHORA SOPORTA CUALQUIER MANAGER
        materials: selectedMaterials,
        necessaryMaterials: necessaryMaterials,
        priority: prioridadSeleccionada
    };

    if (!payload.clientName || !payload.employeeId || !payload.jobDate ||
        isNaN(payload.latitude) || isNaN(payload.pay) || !payload.managerId) {
        return Swal.fire({
            icon: 'error',
            title: 'Campos incompletos',
            text: 'Por favor completa: Cliente, Empleado, Fecha, Ubicación y Pago.',
            confirmButtonColor: '#198754'
        });
    }

    Swal.fire({ title: 'Guardando trabajo...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const url = isEditing ? `${API_URL}/update-job/${id}` : `${API_URL}/create-job`;
    const method = isEditing ? 'PUT' : 'POST';

    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

    blueprintsNuevos.forEach(file => {
        formData.append('files', file);
    });

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });

        if (response.ok) {
            Swal.fire('¡Éxito!', isEditing ? 'Trabajo actualizado.' : 'Trabajo asignado correctamente.', 'success');
            blueprintsNuevos = [];
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

function crearFilaMaterialNecesario(matId, name, price, qtyInicial, unitInicial) {
    const qty = (qtyInicial !== undefined && qtyInicial !== null) ? qtyInicial : 1;
    const unit = (unitInicial !== undefined && unitInicial !== null) ? unitInicial : '';

    return `
        <div class="necessary-material-row" id="nec-${matId}" style="display: grid; grid-template-columns: 1.8fr 70px 90px 80px 40px; gap: 8px; align-items: center; margin-bottom: 10px; padding: 8px; background: white; border-radius: 6px; border-left: 4px solid #198754;">
            <div class="nec-name" title="${name}" style="font-weight: 500; color:#2B3674; font-size: 13px;">${name}</div>
            
            <input type="number" class="nec-qty" value="${qty}" min="1"
                style="margin:0; text-align:center; padding:6px; border: 1px solid #198754;"
                oninput="calcularTotalMaterialesNecesarios()" data-matid="${matId}" title="Cantidad (Editable)">
                
            <input type="text" class="nec-unit" placeholder="Unidad" value="${unit}" readonly
                style="margin:0; text-align:center; padding:6px; background-color: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; cursor: not-allowed;" data-matid="${matId}" title="Unidad (Fija)">
                
            <input type="number" class="nec-price" value="${price}" step="0.01" min="0" readonly
                style="margin:0; text-align:right; font-weight: bold; color: #198754; background-color: #e8f5e9; border: 1px solid #a5d6a7; cursor: not-allowed; padding:6px;" data-matid="${matId}" title="Precio Unitario (Fijo)">
                
            <button type="button" class="nec-delete" onclick="eliminarMaterialNecesarioPorId(${matId})"
                style="background:#ef4444; color:white; border:none; border-radius:6px; height:32px; cursor:pointer;" title="Quitar Material">
                <i class="fa-solid fa-trash"></i>
            </button>
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

    const checkbox = document.querySelector(`input[name="jobMaterials"][value="${matId}"]`);
    if (checkbox) checkbox.checked = false;
    if (materialesEstado[matId]) delete materialesEstado[matId];

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

let bodegaJobsCache = null;
let bodegaUsersCache = null;
let bodegaDiaOffset = 0;

window.verBodegaHoy = async () => {
    Swal.fire({ title: 'Cargando ordenes de bodega...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const token = localStorage.getItem('jwt_token');

        const [jobsRes, usersRes] = await Promise.all([
            fetch('https://api-rojas-remodeling.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-rojas-remodeling.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        bodegaJobsCache = await jobsRes.json();
        bodegaUsersCache = await usersRes.json();

        bodegaDiaOffset = 0;

        Swal.fire({
            title: '<i class="fa-solid fa-truck-fast" style="color:#F4A300;"></i> Ordenes de Bodega',
            html: '<div id="bodega-contenedor">Generando reporte...</div>',
            confirmButtonColor: '#198754',
            confirmButtonText: 'Cerrar',
            width: '750px',
            background: '#FFFFFF'
        });

        renderizarBodega(bodegaDiaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la bodega.', confirmButtonColor: '#198754' });
    }
};

window.cambiarDiaBodega = (delta) => {
    bodegaDiaOffset += delta;
    renderizarBodega(bodegaDiaOffset);
};

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

    const emailActual = localStorage.getItem('user_email');
    const miUsuarioActual = bodegaUsersCache.find(u => u.email === emailActual) || {};
    const jefeNombreCompleto = `${miUsuarioActual.firstName || ''} ${miUsuarioActual.lastName || ''}`.trim().toLowerCase();

    let htmlContent = `
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; background: #F4F7FE; padding: 12px; border-radius: 12px; border: 1px solid #198754; margin-bottom: 15px;">
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

            let statusBadge = '';
            if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Pendiente</span>`;
            else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">En Progreso</span>`;
            else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Completado</span>`;
            else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Cancelado</span>`;

            let descBodega = job.description ? job.description : '';
            if (descBodega.includes('[MATERIALES PRE-ASIGNADOS]:')) {
                descBodega = descBodega.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
            }

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

window.exportarBodegaPdf = () => {
    const listaDia = document.getElementById('bodega-lista-dia');
    if (!listaDia) return Swal.fire('Error', 'No hay trabajos para exportar en este día.', 'error');

    const lblFecha = document.getElementById('lblFechaBodega');
    const textoFecha = lblFecha ? lblFecha.textContent.trim() : new Date().toISOString().split('T')[0];
    const nombreArchivoClean = textoFecha.replace(/[\/]/g, '-');

    const emailActual = localStorage.getItem('user_email');
    const miUsuarioActual = bodegaUsersCache.find(u => u.email === emailActual) || {};
    const nombreJefe = `${miUsuarioActual.firstName || ''} ${miUsuarioActual.lastName || ''}`.trim();

    const contenedorImpresion = document.createElement('div');
    contenedorImpresion.style.padding = "30px";
    contenedorImpresion.style.fontFamily = "'Poppins', sans-serif";
    contenedorImpresion.style.background = "#ffffff";

    contenedorImpresion.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #198754; padding-bottom: 15px;">
            <h1 style="color: #0B0B0D; margin: 0;">ORDENES DE BODEGA</h1>
            <p style="margin: 8px 0 0 0; color: #198754; font-weight: bold;">Jefe: ${nombreJefe}</p>
            <p style="margin: 5px 0 0 0; color: #555;">${textoFecha}</p>
        </div>
        ${listaDia.innerHTML}
        <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
            Reporte generado por el Sistema
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
        try { userRoles = JSON.parse(rolesString); } catch (e) { console.error("Error al leer roles"); }
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