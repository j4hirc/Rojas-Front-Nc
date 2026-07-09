const JOBS_URL = 'https://api-remomn.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';
let userToken = '';

let allJobsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
    console.log("=== [DEBUG] DOMContentLoaded Iniciado ===");
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    console.log("[DEBUG] Datos de sesión:", { userToken: !!userToken, rolesString, userEmail });

    // Validación de seguridad
    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        console.error("[DEBUG] Validación de seguridad fallida. Redirigiendo...");
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para acceder a esta sección.',
            confirmButtonColor: '#12CFF4'
        }).then(() => { window.location.href = '../../index.html'; });
        return;
    }

    const emailDisplay = document.getElementById('admin-email-display');
    if (emailDisplay) {
        emailDisplay.textContent = userEmail || 'Admin';
    } else {
        console.warn("[DEBUG] No se encontró el elemento '#admin-email-display' en el HTML.");
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
    console.log("=== [DEBUG] DOMContentLoaded Finalizado ===");
});

// 1. OBTENEMOS A LOS JEFES PARA EL FILTRO
async function cargarFiltroJefes() {
    console.log("[DEBUG] Ejecutando cargarFiltroJefes()...");
    try {
        const res = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        console.log(`[DEBUG] Respuesta de USERS_URL API: Status ${res.status}`);
        
        if (res.ok) {
            const users = await res.json();
            console.log(`[DEBUG] Usuarios cargados: ${users.length}`);
            
            const selectManager = document.getElementById('filterManager');
            if (!selectManager) {
                console.warn("[DEBUG] Elemento select '#filterManager' no existe en el HTML.");
                return;
            }
            
            selectManager.innerHTML = '<option value="ALL">Todos los Jefes</option>';
            const jefes = users.filter(u => u.roles.some(r => r.name === 'ROLE_JEFE'));
            console.log(`[DEBUG] Jefes filtrados para el select: ${jefes.length}`);
            
            jefes.forEach(jefe => {
                selectManager.innerHTML += `<option value="${jefe.userId}">${jefe.firstName || jefe.name} ${jefe.lastName || ''}</option>`;
            });
        } else {
            console.error("[DEBUG] Error en la respuesta de la API de usuarios:", res.statusText);
        }
    } catch (e) {
        console.error("[DEBUG] Excepción atrapada en cargarFiltroJefes():", e);
    }
}

// 2. OBTENEMOS LOS TRABAJOS CON SUS ACTUALIZACIONES
async function cargarTrabajos() {
    console.log("[DEBUG] Ejecutando cargarTrabajos()...");
    try {
        const res = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        console.log(`[DEBUG] Respuesta de JOBS_URL API: Status ${res.status}`);
        
        if (res.ok) {
            allJobsCache = await res.json();
            console.log("[DEBUG] Datos crudos recibidos de Jobs:", allJobsCache);

            // 1. Primero dibujamos todas las tarjetas en la pantalla de forma normal
            filtrarTrabajos();

            // 2. Detectamos si en la URL viene el ID del proyecto (?jobId=...)
            const urlParams = new URLSearchParams(window.location.search);
            const jobIdParam = urlParams.get('jobId');
            console.log(`[DEBUG] Parámetro 'jobId' detectado en URL: ${jobIdParam}`);

            if (jobIdParam) {
                const idNumerico = parseInt(jobIdParam);
                const trabajoEncontrado = allJobsCache.find(j => j.jobId === idNumerico);
                console.log("[DEBUG] Trabajo buscado por URL URL Param:", trabajoEncontrado);

                if (trabajoEncontrado) {
                    if (trabajoEncontrado.updateJob && trabajoEncontrado.updateJob.length > 0) {
                        console.log(`[DEBUG] Abriendo automáticamente modal por parámetro URL para jobId: ${idNumerico}`);
                        window.abrirModalEvidencias(idNumerico);
                    } else {
                        console.log("[DEBUG] El trabajo de la URL existe pero no contiene 'updateJob'.");
                        Swal.fire({
                            icon: 'info',
                            title: 'Sin evidencias',
                            text: `El proyecto de "${trabajoEncontrado.clientName}" no registra avances fotográficos todavía.`,
                            confirmButtonColor: '#0f4c81'
                        });
                    }
                } else {
                    console.warn(`[DEBUG] No se encontró ningún trabajo en el caché que coincida con el ID numérico: ${idNumerico}`);
                }
            }
        } else {
            console.error("[DEBUG] Error en la respuesta de la API de trabajos:", res.statusText);
        }
    } catch (error) {
        console.error("[DEBUG] Excepción atrapada en cargarTrabajos():", error);
        Swal.fire('Error', 'No se pudieron cargar las evidencias.', 'error');
    }
}

// 3. FILTRAMOS Y DIBUJAMOS LAS FILAS EN LA TABLA DE EVIDENCIAS
window.filtrarTrabajos = () => {
    console.log("[DEBUG] Ejecutando filtrarTrabajos()...");
    const managerId = document.getElementById('filterManager') ? document.getElementById('filterManager').value : 'ALL';
    const texto = document.getElementById('searchEvidenceText') ? document.getElementById('searchEvidenceText').value.toLowerCase().trim() : '';
    const estado = document.getElementById('filterEvidenceStatus') ? document.getElementById('filterEvidenceStatus').value : 'ALL';

    console.log("[DEBUG] Valores de los Filtros Activos:", { managerId, texto, estado });

    const tbody = document.getElementById('evidencesTableBody');
    if (!tbody) {
        console.error("[DEBUG] ERROR CRÍTICO: No se encontró el elemento '#evidencesTableBody' en el HTML. Las filas no se pueden renderizar.");
        return;
    }
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

    console.log(`[DEBUG] Cantidad de trabajos que pasaron el filtro: ${trabajosFiltrados.length}`);

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

// 5. LÓGICA PARA VER EL HISTORIAL (MODAL)
window.abrirModalEvidencias = (jobId) => {
    console.log(`=== [DEBUG] abrirModalEvidencias() ejecutado para ID: ${jobId} ===`);
    const job = allJobsCache.find(j => j.jobId === jobId);
    
    if (!job) {
        console.error(`[DEBUG] ERROR: No se encontró el trabajo con ID ${jobId} en la memoria caché.`);
        return;
    }
    console.log("[DEBUG] Objeto de trabajo seleccionado:", job);

    // Verificación exhaustiva de cada ID en el HTML para evitar que el script se muera:
    const modalTitulo = document.getElementById('modalTitulo');
    if (modalTitulo) {
        modalTitulo.innerHTML = `<i class="fa-solid fa-folder-open"></i> Evidencias - ${job.clientName}`;
    } else {
        console.warn("[DEBUG] Alerta: No existe un elemento con ID '#modalTitulo' en el HTML.");
    }

    const jobDescText = document.getElementById('jobDescriptionText');
    if (jobDescText) {
        jobDescText.innerHTML = `<strong>Descripción de obra:</strong> <br> ${job.description || 'Sin descripción'}`;
    } else {
        console.warn("[DEBUG] Alerta: No existe un elemento con ID '#jobDescriptionText' en el HTML.");
    }

    const timeline = document.getElementById('evidencesTimeline');
    if (!timeline) {
        console.error("[DEBUG] ERROR DETENIDO: No existe el contenedor '#evidencesTimeline' en tu HTML, por lo tanto las fotos y actualizaciones no tienen dónde dibujarse.");
        return;
    }
    timeline.innerHTML = '';

    if (!job.updateJob || job.updateJob.length === 0) {
        console.warn("[DEBUG] El trabajo existe en el caché pero el arreglo 'updateJob' viene vacío o indefinido desde el servidor.");
        timeline.innerHTML = '<span style="font-size:14px; padding:20px; display:block; text-align:center; color:#A3AED0;">Este proyecto no cuenta con bitácoras registradas.</span>';
    } else {
        console.log(`[DEBUG] Procesando y ordenando ${job.updateJob.length} actualizaciones...`);
        const updatesOrdenados = job.updateJob.sort((a, b) => new Date(b.date) - new Date(a.date));

        updatesOrdenados.forEach((update, index) => {
            console.log(`[DEBUG] Renderizando actualización #${index + 1}:`, update);
            const fechaObj = new Date(update.date);
            const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            let galeriaHTML = '';
            if (update.evidences && update.evidences.length > 0) {
                console.log(`[DEBUG] Actualización #${index + 1} tiene ${update.evidences.length} archivos multimedia.`);
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
                console.log(`[DEBUG] Actualización #${index + 1} no tiene archivos adjuntos.`);
                galeriaHTML = `<span style="font-size:12px; color:#A3AED0;">No se subieron archivos en esta actualización.</span>`;
            }

            timeline.innerHTML += `
                <div class="timeline-update">
                    <span class="timeline-date"><i class="fa-regular fa-calendar"></i> ${fechaFormateada}</span>
                    <div class="timeline-comment">"${update.comment || 'Sin comentario'}"</div>
                    <div class="gallery-grid">
                        ${galeriaHTML}
                    </div>
                </div>
            `;
        });
    }

    const modalEvidencias = document.getElementById('modalEvidencias');
    if (modalEvidencias) {
        console.log("[DEBUG] Mostrando el modal '#modalEvidencias' cambiando style.display a 'flex'");
        modalEvidencias.style.display = 'flex';
    } else {
        console.error("[DEBUG] ERROR CRÍTICO: No existe el contenedor principal '#modalEvidencias' en el HTML. No se puede abrir visualmente nada.");
    }
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