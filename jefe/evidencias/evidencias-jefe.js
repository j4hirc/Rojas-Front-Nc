const JOBS_URL = 'http://localhost:8081/api/v1/jobs/all';
const USERS_URL = 'http://localhost:8081/api/v1/user/all-users';
let userToken = '';
let myManagerId = null; 
let misTrabajosCache = [];

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    // Validación de rol estricta para el Jefe
    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo los Jefes de obra pueden acceder a esta sección.',
            confirmButtonColor: '#12CFF4'
        }).then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('jefe-email-display').textContent = userEmail || 'Jefe';

    await inicializarDatosDelJefe(userEmail);
});

// 1. IDENTIFICAR AL JEFE Y CARGAR SUS TRABAJOS
async function inicializarDatosDelJefe(emailActual) {
    try {
        Swal.fire({ title: 'Cargando evidencias...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        // A) Buscamos el ID del Jefe actual
        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (resUsers.ok) {
            const users = await resUsers.json();
            const jefeActual = users.find(u => u.email === emailActual);
            if (jefeActual) {
                myManagerId = jefeActual.userId;
            } else {
                Swal.fire('Error', 'No se pudo identificar tu cuenta de Jefe.', 'error');
                return;
            }
        }

        // B) Traemos todos los trabajos y filtramos solo los de este Jefe
        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (resJobs.ok) {
            const todosLosTrabajos = await resJobs.json();
            misTrabajosCache = todosLosTrabajos.filter(job => job.managerId === myManagerId);
            renderizarTrabajos(misTrabajosCache);
        }
        
        Swal.close();

    } catch (e) {
        console.error("Error al inicializar datos:", e);
        Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
    }
}

// 2. DIBUJAMOS LAS TARJETAS DE LOS PROYECTOS
function renderizarTrabajos(trabajos) {
    const grid = document.getElementById('jobsGrid');
    grid.innerHTML = '';

    if (trabajos.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1;" class="empty-state">No tienes proyectos asignados actualmente.</div>';
        return;
    }

    trabajos.forEach(job => {
        // Contamos cuántas actualizaciones, fotos y PDFs tiene este trabajo
        const numUpdates = job.updateJob ? job.updateJob.length : 0;
        let numArchivos = 0;
        
        if(job.updateJob) {
            job.updateJob.forEach(update => {
                if(update.evidences) numArchivos += update.evidences.length;
            });
        }

        let statusBadge = '';
        if(job.status === 'PENDING') statusBadge = `<span style="color: #ff9800; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-clock"></i> Pendiente</span>`;
        else if(job.status === 'IN_PROGRESS') statusBadge = `<span style="color: #1e88e5; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-spinner"></i> En Progreso</span>`;
        else if(job.status === 'COMPLETED') statusBadge = `<span style="color: #2e7d32; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-check-double"></i> Completado</span>`;
        else statusBadge = `<span style="color: #d32f2f; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-ban"></i> Cancelado</span>`;

        const btnEvidencias = numUpdates > 0 
            ? `<button onclick="abrirModalEvidencias(${job.jobId})" style="width:100%; padding:8px; background:#198754; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Poppins'; font-weight:600; transition:0.3s;"><i class="fa-solid fa-folder-open"></i> Ver ${numArchivos} Archivos</button>`
            : `<button disabled style="width:100%; padding:8px; background:#e9ecef; color:#A3AED0; border:none; border-radius:8px; font-family:'Poppins'; font-weight:600;">Sin evidencias aún</button>`;

        // Preparamos la descripción para que no se desborde si es muy larga
        const safeDesc = job.description ? job.description : 'Sin descripción';

        const card = document.createElement('div');
        card.className = 'card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'flex-start';
        card.innerHTML = `
            <div style="width: 100%; display: flex; justify-content: space-between; border-bottom: 1px solid #f0f2f5; padding-bottom: 10px; margin-bottom: 10px;">
                <h3 style="margin:0; font-size:1.1rem; color:#2B3674;">${job.clientName}</h3>
                ${statusBadge}
            </div>
            <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-helmet-safety"></i> <strong>Empleado:</strong> ${job.nameEmployee}</p>
            <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>
            
            <div style="margin: 10px 0; padding-left: 10px; border-left: 3px solid #198754;">
                <p style="margin: 0; font-size: 13px; color: #444; font-style: italic; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    "${safeDesc}"
                </p>
            </div>
            
            <div style="margin-top: 10px; width: 100%;">
                ${btnEvidencias}
            </div>
        `;
        grid.appendChild(card);
    });
}

// 3. LÓGICA PARA VER EL HISTORIAL (MODAL)
window.abrirModalEvidencias = (jobId) => {
    const job = misTrabajosCache.find(j => j.jobId === jobId);
    if(!job) return;

    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-folder-open"></i> Evidencias - ${job.clientName}`;
    
    // Descripción destacada
    document.getElementById('jobDescriptionText').innerHTML = `<strong>Descripción de obra:</strong> <br> ${job.description || 'Sin descripción'}`;
    
    const timeline = document.getElementById('evidencesTimeline');
    timeline.innerHTML = '';

    // Ordenamos las actualizaciones de la más nueva a la más vieja
    const updatesOrdenados = job.updateJob.sort((a, b) => new Date(b.date) - new Date(a.date));

    updatesOrdenados.forEach(update => {
        const fechaObj = new Date(update.date);
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' });

        let galeriaHTML = '';
        if(update.evidences && update.evidences.length > 0) {
            update.evidences.forEach(evi => {
                // VERIFICAMOS SI LA URL ES UN PDF
                const urlLower = evi.imageUri.toLowerCase();
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

// 4. FUNCIÓN PARA VER LA FOTO EN PANTALLA COMPLETA USANDO SWEETALERT
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
};  