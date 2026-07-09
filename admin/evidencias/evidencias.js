const JOBS_URL = 'https://api-remomn.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';
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

    // --- CERRAMOS PANTALLA DE CARGA ---
    Swal.close();
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
// 🔥 REEMPLAZA ESTA FUNCIÓN COMPLETA EN TU ARCHIVO EVIDENCIAS.JS
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
                    // Si tiene actualizaciones previas, disparamos el modal automáticamente al instante
                    if (trabajoEncontrado.updateJob && trabajoEncontrado.updateJob.length > 0) {
                        window.abrirModalEvidencias(idNumerico);
                    } else {
                        // Si no tiene registros aún, le avisamos estéticamente al usuario con una alerta limpia
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

// 3. FILTRAMOS Y DIBUJAMOS LAS TARJETAS
// 3. FILTRAMOS Y DIBUJAMOS LAS FILAS EN LA TABLA DE EVIDENCIAS
window.filtrarTrabajos = () => {
    const managerId = document.getElementById('filterManager') ? document.getElementById('filterManager').value : 'ALL';
    const texto = document.getElementById('searchEvidenceText') ? document.getElementById('searchEvidenceText').value.toLowerCase().trim() : '';
    const estado = document.getElementById('filterEvidenceStatus') ? document.getElementById('filterEvidenceStatus').value : 'ALL';

    const tbody = document.getElementById('evidencesTableBody');
    tbody.innerHTML = '';

    // Evaluamos los filtros sobre el respaldo original en memoria
    let trabajosFiltrados = allJobsCache.filter(job => {
        // Filtro por Manager (Jefe)
        const coincideManager = (managerId === 'ALL') || (job.managerId == managerId);

        // Filtro por Texto (Cliente, Descripción, Empleado o Jefe)
        const coincideTexto = 
            (job.clientName || '').toLowerCase().includes(texto) ||
            (job.description || '').toLowerCase().includes(texto) ||
            (job.employeeName || '').toLowerCase().includes(texto) ||
            (job.managerName || '').toLowerCase().includes(texto);

        // Filtro por Estado de Obra
        const coincideEstado = (estado === 'ALL') || (job.status === estado);

        return coincideManager && coincideTexto && coincideEstado;
    });

    if (trabajosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No se encontraron proyectos asignados a este filtro.</td></tr>';
        return;
    }

    // Dibujamos cada proyecto como una fila de la lista
    trabajosFiltrados.forEach(job => {
        const numUpdates = job.updateJob ? job.updateJob.length : 0;
        let numFotos = 0;
        if(job.updateJob) {
            job.updateJob.forEach(update => {
                if(update.evidences) numFotos += update.evidences.length;
            });
        }

        // Badges estéticos para el Estado de la obra en la lista
        let statusBadge = '';
        if(job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Pendiente</span>`;
        else if(job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">En Progreso</span>`;
        else if(job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Completado</span>`;
        else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">Cancelado</span>`;

        // Configuración del botón de acción
        const btnEvidencias = numUpdates > 0 
            ? `<button onclick="abrirModalEvidencias(${job.jobId})" style="padding: 6px 12px; background: #0f4c81; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;"><i class="fa-solid fa-folder-open"></i> Ver ${numFotos} Archivos</button>`
            : `<button disabled style="padding: 6px 12px; background: #e9ecef; color: #A3AED0; border: none; border-radius: 6px; font-weight: 600; font-size: 12px;">Sin evidencias</button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: #2B3674;">${job.clientName}</strong></td>
            <td>${job.managerName || 'Sin asignar'}</td>
            <td>${job.employeeName || 'Sin asignar'}</td>
            <td>${statusBadge}</td>
            <td>${btnEvidencias}</td>
        `;
        tbody.appendChild(tr);
    });
};

// 4. ESCUCHADORES DE EVENTOS EN TIEMPO REAL
// Añade este bloque al final de tu archivo para que escuche cuando escribes o cambias el estado
document.addEventListener("DOMContentLoaded", () => {
    const textEv = document.getElementById('searchEvidenceText');
    const statusEv = document.getElementById('filterEvidenceStatus');
    const managerEv = document.getElementById('filterManager');

    if (textEv) textEv.addEventListener('input', window.filtrarTrabajos);
    if (statusEv) statusEv.addEventListener('change', window.filtrarTrabajos);
    if (managerEv) managerEv.addEventListener('change', window.filtrarTrabajos);
});

// 4. LÓGICA PARA VER EL HISTORIAL (MODAL)
window.abrirModalEvidencias = (jobId) => {
    const job = allJobsCache.find(j => j.jobId === jobId);
    if(!job) return;

    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-folder-open"></i> Evidencias - ${job.clientName}`;
    
    // INYECTAR LA DESCRIPCIÓN EN EL MODAL
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
                
                // MAGIA: VERIFICAMOS SI LA URL ES UN PDF
                if (urlLower.includes('.pdf')) {
                    galeriaHTML += `
                        <a href="${evi.imageUri}" target="_blank" class="pdf-btn" title="Descargar Reporte PDF">
                            <i class="fa-solid fa-file-pdf"></i>
                            Reporte
                        </a>
                    `;
                } else {
                    // SI ES IMAGEN LA MOSTRAMOS NORMAL
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

