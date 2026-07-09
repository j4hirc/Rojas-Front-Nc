const JOBS_URL = 'https://api-remomn.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';
let userToken = '';

let allJobsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    // Validación de seguridad
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

    // 🔥 CONFIGURACIÓN DE CAMBIAR ROL
    let userRoles = [];
    try { 
        userRoles = JSON.parse(rolesString); 
    } catch(e) { 
        console.error("Error al parsear roles", e); 
    }
    
    const btnPerfilAdmin = document.getElementById("btnPerfilAdmin");
    if (btnPerfilAdmin) {
        if (userRoles.length > 1) {
            btnPerfilAdmin.style.cursor = "pointer";
            btnPerfilAdmin.addEventListener("click", () => mostrarSelectorDeRoles(userRoles));
        } else {
            // Remueve el icono visual si no tiene múltiples roles
            const iconExchange = btnPerfilAdmin.querySelector(".fa-right-left");
            if (iconExchange) iconExchange.remove();
            btnPerfilAdmin.style.cursor = "default";
        }
    }

    // --- PANTALLA DE CARGA ---
    Swal.fire({ 
        title: 'Cargando evidencias...', 
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); }
    });

    await cargarFiltroJefes();
    await cargarTrabajos();

    // --- CERRAMOS PANTALLA DE CARGA ---
    Swal.close();
});

// 🔥 FUNCIÓN DEL SELECTOR DE ROLES (Adaptada con rutas desde subcarpeta admin/evidencias/)
function mostrarSelectorDeRoles(roles) {
    let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
    
    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';
        
        if (rol === 'ROLE_ADMIN') { 
            nombreRol = '<i class="fa-solid fa-user-tie"></i> Administrador'; 
            url = '../admin-dashboard.html'; 
        }
        if (rol === 'ROLE_JEFE') { 
            nombreRol = '<i class="fa-solid fa-user-shield"></i> Jefe de Trabajo'; 
            url = '../../jefe/jefe-dashboard.html'; 
        }
        if (rol === 'ROLE_EMPLOYEE') { 
            nombreRol = '<i class="fa-solid fa-helmet-safety"></i> Subcontratista / Empleado'; 
            url = '../../employee/employee-dashboard.html'; 
        }

        if (nombreRol) {
            opcionesHTML += `
                <button class="swal2-confirm swal2-styled" 
                        style="width: 100%; margin: 0; background-color: #0F2D4A; color: #fff; font-weight: 600; border-radius: 8px;" 
                        onclick="window.location.href='${url}'">
                    ${nombreRol}
                </button>`;
        }
    });
    
    opcionesHTML += '</div>';

    Swal.fire({
        title: 'Selecciona tu área de trabajo',
        html: opcionesHTML,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#ea5455'
    });
}

// 1. OBTENEMOS A LOS JEFES PARA EL FILTRO
async function cargarFiltroJefes() {
    try {
        const res = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (res.ok) {
            const users = await res.json();
            const selectManager = document.getElementById('filterManager');
            if (!selectManager) return;

            // Mantener opción base por defecto limpia
            selectManager.innerHTML = '<option value="ALL">Todos los Jefes</option>';
            
            const jefes = users.filter(u => u.roles.some(r => r.name === 'ROLE_JEFE'));
            
            jefes.forEach(jefe => {
                selectManager.innerHTML += `<option value="${jefe.userId}">${jefe.firstName} ${jefe.lastName}</option>`;
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

            // 1. Primero dibujamos todas las tarjetas en la pantalla de forma normal
            filtrarTrabajos();

            // 2. Detectamos si en la URL viene el ID del proyecto (?jobId=...)
            const urlParams = new URLSearchParams(window.location.search);
            const jobIdParam = urlParams.get('jobId');

            if (jobIdParam) {
                const idNumerico = parseInt(jobIdParam);

                // 3. Buscamos el proyecto específico dentro del caché de datos
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

// 3. FILTRAMOS Y DIBUJAMOS LAS FILAS EN LA TABLA DE EVIDENCIAS
window.filtrarTrabajos = () => {
    const managerId = document.getElementById('filterManager') ? document.getElementById('filterManager').value : 'ALL';
    const texto = document.getElementById('searchEvidenceText') ? document.getElementById('searchEvidenceText').value.toLowerCase().trim() : '';
    const estado = document.getElementById('filterEvidenceStatus') ? document.getElementById('filterEvidenceStatus').value : 'ALL';

    const tbody = document.getElementById('evidencesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let trabajosFiltrados = allJobsCache.filter(job => {
        const coincideManager = (managerId === 'ALL') || (job.managerId == managerId);
        const coincideTexto =
            (job.clientName || '').toLowerCase().includes(texto) ||
            (job.description || '').toLowerCase().includes(texto) ||
            (job.nameEmployee || job.employeeName || '').toLowerCase().includes(texto) ||
            (job.nameManager || job.managerName || '').toLowerCase().includes(texto);
        const coincideEstado = (estado === 'ALL') || (job.status === estado);

        return coincideManager && coincideTexto && coincideEstado;
    });

    if (trabajosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #A3AED0; font-weight:500;">No se encontraron proyectos asignados a este filtro.</td></tr>';
        return;
    }

    trabajosFiltrados.forEach(job => {
        const numUpdates = job.updateJob ? job.updateJob.length : 0;
        let numFotos = 0;
        if (job.updateJob) {
            job.updateJob.forEach(update => {
                if (update.evidences) numFotos += update.evidences.length;
            });
        }

        let statusBadge = '';
        if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
        else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
        else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
        else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;

        const jefeNombre = job.nameManager || job.managerName || 'Sin asignar';
        const empleadoNombre = job.nameEmployee || job.employeeName || 'Sin asignar';

        const btnEvidencias = numUpdates > 0
            ? `<button onclick="abrirModalEvidencias(${job.jobId})" style="padding: 6px 12px; background: #0f4c81; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; font-family: 'Poppins';"><i class="fa-solid fa-folder-open"></i> Ver ${numFotos} Archivos</button>`
            : `<button disabled style="padding: 6px 12px; background: #e9ecef; color: #A3AED0; border: none; border-radius: 6px; font-weight: 600; font-size: 12px; font-family: 'Poppins';">Sin evidencias</button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Proyecto:"><strong style="color: #2B3674;">${job.clientName}</strong></td>
            <td data-label="Jefe:">${jefeNombre}</td>
            <td data-label="Subcontratista:">${empleadoNombre}</td>
            <td data-label="Estado:">${statusBadge}</td>
            <td data-label="Acción:">${btnEvidencias}</td>
        `;
        tbody.appendChild(tr);
    });
};

// 4. ESCUCHADORES DE EVENTOS EN TIEMPO REAL
document.addEventListener("DOMContentLoaded", () => {
    const textEv = document.getElementById('searchEvidenceText');
    const statusEv = document.getElementById('filterEvidenceStatus');
    const managerEv = document.getElementById('filterManager');

    if (textEv) textEv.addEventListener('input', window.filtrarTrabajos);
    if (statusEv) statusEv.addEventListener('change', window.filtrarTrabajos);
    if (managerEv) managerEv.addEventListener('change', window.filtrarTrabajos);
});

// 5. LÓGICA PARA VER EL HISTORIAL (MODAL PROTEGIDO)
window.abrirModalEvidencias = (jobId) => {
    const job = allJobsCache.find(j => j.jobId === jobId);
    if (!job) return;

    // Blindaje de elementos opcionales en el HTML
    const modalTitulo = document.getElementById('modalTitulo');
    if (modalTitulo) {
        modalTitulo.innerHTML = `<i class="fa-solid fa-folder-open"></i> Evidencias - ${job.clientName}`;
    }

    const jobDescText = document.getElementById('jobDescriptionText');
    if (jobDescText) {
        jobDescText.innerHTML = `<strong>Descripción de obra:</strong> <br> ${job.description || 'Sin descripción'}`;
    }

    const timeline = document.getElementById('evidencesTimeline');
    if (!timeline) return;
    timeline.innerHTML = '';

    const updatesOrdenados = job.updateJob.sort((a, b) => new Date(b.date) - new Date(a.date));

    updatesOrdenados.forEach(update => {
        const fechaObj = new Date(update.date);
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        let galeriaHTML = '';
        if (update.evidences && update.evidences.length > 0) {
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

    const modalEvidencias = document.getElementById('modalEvidencias');
    if (modalEvidencias) modalEvidencias.style.display = 'flex';
};

window.cerrarModalEvidencias = () => {
    const modalEvidencias = document.getElementById('modalEvidencias');
    if (modalEvidencias) modalEvidencias.style.display = 'none';
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
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir?",
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