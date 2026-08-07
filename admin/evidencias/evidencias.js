const JOBS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user/all-users';
let userToken = '';

let allJobsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para acceder a esta sección.',
            confirmButtonColor: '#12CFF4'
        }).then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    // --- PANTALLA DE CARGA ---
    Swal.fire({ 
        title: 'Cargando evidencias...', 
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); }
    });

    await cargarFiltroJefes();
    await cargarTrabajos();

    // Listeners de los filtros combinados
    const txtIn = document.getElementById('searchJobInput');
    const mgrIn = document.getElementById('filterManager');
    const estIn = document.getElementById('filterStatusInput');
    const priIn = document.getElementById('filterPriorityInput');

    if (txtIn) txtIn.addEventListener('input', window.filtrarTrabajosCombinados);
    if (mgrIn) mgrIn.addEventListener('change', window.filtrarTrabajosCombinados);
    if (estIn) estIn.addEventListener('change', window.filtrarTrabajosCombinados);
    if (priIn) priIn.addEventListener('input', window.filtrarTrabajosCombinados);

    // Nota: el cierre de la pantalla de carga ya ocurre dentro de cargarTrabajos(),
    // justo antes de revisar el jobId de la URL. No volvemos a cerrar aquí para no
    // tapar la alerta de "Sin evidencias" que se pudo haber abierto.
});

// 1. OBTENEMOS A LOS JEFES PARA EL FILTRO
async function cargarFiltroJefes() {
    try {
        const res = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (res.ok) {
            const users = await res.json();
            const selectManager = document.getElementById('filterManager');
            
            const jefes = users.filter(u => u.roles.some(r => r.name === 'ROLE_JEFE'));
            
            jefes.forEach(jefe => {
                selectManager.innerHTML += `<option value="${jefe.userId}">${jefe.name}</option>`;
            });
        }
    } catch (e) {
        console.error("Error al cargar jefes", e);
    }
}

// 2. OBTENEMOS LOS TRABAJOS CON SUS ACTUALIZACIONES
async function cargarTrabajos() {
    try {
        const res = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (res.ok) {
            allJobsCache = await res.json();
            
            // 1. Primero dibujamos todo con los filtros combinados
            window.filtrarTrabajosCombinados(); 

            // --- CERRAMOS LA PANTALLA DE CARGA AQUÍ, ANTES DE CUALQUIER OTRA ALERTA ---
            Swal.close();

            // 2. Detectamos si en la URL viene el ID del proyecto (?jobId=...)
            const urlParams = new URLSearchParams(window.location.search);
            const jobIdParam = urlParams.get('jobId');

            if (jobIdParam) {
                const idNumerico = parseInt(jobIdParam);
                
                const trabajoEncontrado = allJobsCache.find(j => j.jobId === idNumerico);
                
                if (trabajoEncontrado) {
                    if (trabajoEncontrado.updateJob && trabajoEncontrado.updateJob.length > 0) {
                        window.abrirModalEvidencias(idNumerico);
                    } else {
                        Swal.fire({
                            icon: 'info',
                            title: 'Sin evidencias',
                            text: `El proyecto de "${trabajoEncontrado.clientName}" no registra avances fotográficos todavía.`,
                            confirmButtonColor: '#0f4c81'
                        });
                    }
                }
            }
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudieron cargar las evidencias.', 'error');
    }
}

// 3. FILTROS COMBINADOS: texto, jefe, estado y prioridad
window.filtrarTrabajosCombinados = () => {
    const texto = document.getElementById('searchJobInput') ? document.getElementById('searchJobInput').value.toLowerCase().trim() : '';
    const managerId = document.getElementById('filterManager') ? document.getElementById('filterManager').value : 'ALL';
    const estado = document.getElementById('filterStatusInput') ? document.getElementById('filterStatusInput').value : 'ALL';
    const prioridad = document.getElementById('filterPriorityInput') ? document.getElementById('filterPriorityInput').value.trim() : '';

    const trabajosFiltrados = allJobsCache.filter(job => {
        const coincideTexto =
            (job.clientName || '').toLowerCase().includes(texto) ||
            (job.description || '').toLowerCase().includes(texto) ||
            (job.nameEmployee || '').toLowerCase().includes(texto) ||
            (job.nameManager || '').toLowerCase().includes(texto);

        const coincideJefe = (managerId === 'ALL') || (job.managerId == managerId);

        const coincideEstado = (estado === 'ALL') || (job.status === estado);

        let coincidePrioridad = true;
        if (prioridad !== '') {
            const prioBuscada = parseInt(prioridad);
            const prioJob = (job.priority !== null && job.priority !== undefined && job.priority !== '')
                ? parseInt(job.priority)
                : 2;
            coincidePrioridad = prioJob === prioBuscada;
        }

        return coincideTexto && coincideJefe && coincideEstado && coincidePrioridad;
    });

    renderizarTrabajos(trabajosFiltrados);
};

// 4. BADGES DE ESTADO Y PRIORIDAD (mismo estilo que trabajos.js)
function getStatusBadge(status) {
    if (status === 'PENDING') return `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
    if (status === 'IN_PROGRESS') return `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
    if (status === 'COMPLETED') return `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
    return `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;
}

function getPriorityBadge(priority) {
    const pValor = (priority !== null && priority !== undefined) ? priority : 2;

    if (pValor === 0 || pValor === 1) {
        return `<span style="background: #FBE9E7; color: #d32f2f; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid #ffccbc;"><i class="fa-solid fa-triangle-exclamation"></i> ${pValor} - Alta</span>`;
    } else if (pValor === 2) {
        return `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid #c8e6c9;"><i class="fa-solid fa-circle-info"></i> ${pValor} - Normal</span>`;
    }
    return `<span style="background: #ECEFF1; color: #546E7A; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid #cfd8dc;"> ${pValor} - Baja</span>`;
}

// 5. DIBUJAMOS TABLA (desktop) + TARJETAS (mobile)
function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    if (trabajos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay proyectos que coincidan con los filtros.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="empty-state">No hay proyectos que coincidan con los filtros.</div>`;
        return;
    }

    trabajos.forEach(job => {
        const numUpdates = job.updateJob ? job.updateJob.length : 0;
        let numFotos = 0;
        if (job.updateJob) {
            job.updateJob.forEach(update => {
                if (update.evidences) numFotos += update.evidences.length;
            });
        }

        const statusBadge = getStatusBadge(job.status);
        const priorityBadge = getPriorityBadge(job.priority);

        const btnEvidencias = numUpdates > 0
            ? `<button onclick="abrirModalEvidencias(${job.jobId})" style="padding:8px 14px; background:#0f4c81; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Poppins'; font-weight:600; white-space:nowrap;"><i class="fa-solid fa-folder-open"></i> Ver ${numFotos}</button>`
            : `<button disabled style="padding:8px 14px; background:#e9ecef; color:#A3AED0; border:none; border-radius:8px; font-family:'Poppins'; font-weight:600; white-space:nowrap;">Sin evidencias</button>`;

        const safeDesc = job.description ? job.description : 'Sin descripción';

        // FILA DE TABLA (DESKTOP)
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${job.clientName}</strong><br>
                <span class="desc-cell" title="${safeDesc.replace(/"/g, '&quot;')}">${safeDesc}</span>
            </td>
            <td>${job.nameManager || 'Sin asignar'}</td>
            <td>${job.nameEmployee || 'Sin asignar'}</td>
            <td>${statusBadge}</td>
            <td>${priorityBadge}</td>
            <td>${btnEvidencias}</td>
        `;
        tbody.appendChild(tr);

        // TARJETA (MOBILE)
        if (mobileContainer) {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'flex-start';
            card.style.padding = '20px';
            card.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; border-bottom: 1px dashed #E0E5F2; padding-bottom: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; gap: 5px;">
                    <h3 style="margin:0; font-size:1.1rem; color:#0f4c81;">${job.clientName}</h3>
                    <div style="display:flex; gap:5px;">
                        ${statusBadge}
                        ${priorityBadge}
                    </div>
                </div>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-user-tie"></i> <strong>Jefe:</strong> ${job.nameManager || 'Sin asignar'}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-helmet-safety"></i> <strong>Subcontratista:</strong> ${job.nameEmployee || 'Sin asignar'}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>

                <div style="margin: 10px 0; padding: 10px; background: #f8faff; border-left: 3px solid #0f4c81; border-radius: 6px; width: 100%;">
                    <p style="margin: 0; font-size: 13px; color: #444; font-style: italic;">"${safeDesc}"</p>
                </div>

                <div style="margin-top: 10px; width: 100%;">
                    ${btnEvidencias}
                </div>
            `;
            mobileContainer.appendChild(card);
        }
    });
}

// 6. LÓGICA PARA VER EL HISTORIAL (MODAL)
window.abrirModalEvidencias = (jobId) => {
    const job = allJobsCache.find(j => j.jobId === jobId);
    if(!job) return;

    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-folder-open"></i> Evidencias - ${job.clientName}`;
    
    document.getElementById('jobDescriptionText').innerHTML = `<strong>Descripción de obra:</strong> <br> ${job.description || 'Sin descripción'}`;
    
    const timeline = document.getElementById('evidencesTimeline');
    timeline.innerHTML = '';

    const updatesOrdenados = job.updateJob.sort((a, b) => new Date(b.date) - new Date(a.date));

    updatesOrdenados.forEach(update => {
        const fechaObj = new Date(update.date);
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' });

        let galeriaHTML = '';
        if(update.evidences && update.evidences.length > 0) {
            update.evidences.forEach(evi => {
                const urlLower = evi.imageUri.toLowerCase();
                
                if (urlLower.includes('.pdf')) {
                    galeriaHTML += `
                        <a href="${evi.imageUri}" target="_blank" class="pdf-btn" title="Descargar Reporte PDF">
                            <i class="fa-solid fa-file-pdf"></i>
                            Reporte
                        </a>
                    `;
                } else {
                    galeriaHTML += `<img src="${evi.imageUri}" class="gallery-img" alt="Evidencia" onclick="verFotoGrande('${evi.imageUri}')">`;
                }
            });
        } else {
            galeriaHTML = `<span style="font-size:12px; color:#A3AED0;">No se subieron archivos en esta actualización.</span>`;
        }

        timeline.innerHTML += `
            <div class="timeline-update">
                <span class="timeline-date"><i class="fa-regular fa-calendar"></i> ${fechaFormateada}</span>
                <div class="timeline-comment">"${update.comment}"</div>
                <div class="gallery-grid">
                    ${galeriaHTML}
                </div>
            </div>
        `;
    });

    document.getElementById('modalEvidencias').style.display = 'flex';
};

window.cerrarModalEvidencias = () => {
    document.getElementById('modalEvidencias').style.display = 'none';
};

window.verFotoGrande = (url) => {
    Swal.fire({
        imageUrl: url,
        imageAlt: 'Evidencia del Trabajo',
        width: '80%',
        showConfirmButton: false,
        showCloseButton: true,
        background: 'transparent',
        backdrop: `rgba(0,0,0,0.8)`
    });
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
        
        if(rol === 'ROLE_ADMIN') { 
            nombreRol = '<i class="fa-solid fa-user-tie"></i> Acceder como Administrador'; 
            url = '../admin-dashboard.html'; 
        }
        if(rol === 'ROLE_JEFE') { 
            nombreRol = '<i class="fa-solid fa-user-shield"></i> Acceder como Manager'; 
            url = '../../jefe/jefe-dashboard.html'; 
        }
        if(rol === 'ROLE_EMPLOYEE') { 
            nombreRol = '<i class="fa-solid fa-helmet-safety"></i> Acceder como Subcontratista'; 
            url = '../../employee/employee-dashboard.html'; 
        }

        if(nombreRol) {
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