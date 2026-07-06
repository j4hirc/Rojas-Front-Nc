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
async function cargarTrabajos() {
    try {
        const res = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (res.ok) {
            allJobsCache = await res.json();
            filtrarTrabajos(); // Pinta todos por defecto
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudieron cargar las evidencias.', 'error');
    }
}

// 3. FILTRAMOS Y DIBUJAMOS LAS TARJETAS
window.filtrarTrabajos = () => {
    const managerId = document.getElementById('filterManager').value;
    const grid = document.getElementById('jobsGrid');
    grid.innerHTML = '';

    let trabajosFiltrados = allJobsCache;

    if (managerId !== 'ALL') {
        trabajosFiltrados = allJobsCache.filter(job => job.managerId == managerId);
    }

    if (trabajosFiltrados.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1;" class="empty-state">No hay proyectos asignados a este filtro.</div>';
        return;
    }

    trabajosFiltrados.forEach(job => {
        const numUpdates = job.updateJob ? job.updateJob.length : 0;
        let numFotos = 0;
        if(job.updateJob) {
            job.updateJob.forEach(update => {
                if(update.evidences) numFotos += update.evidences.length;
            });
        }

        let statusBadge = '';
        if(job.status === 'PENDING') statusBadge = `<span style="color: #ff9800; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-clock"></i> Pendiente</span>`;
        else if(job.status === 'IN_PROGRESS') statusBadge = `<span style="color: #1e88e5; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-spinner"></i> En Progreso</span>`;
        else if(job.status === 'COMPLETED') statusBadge = `<span style="color: #2e7d32; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-check-double"></i> Completado</span>`;
        else statusBadge = `<span style="color: #d32f2f; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-ban"></i> Cancelado</span>`;

        const btnEvidencias = numUpdates > 0 
            ? `<button onclick="abrirModalEvidencias(${job.jobId})" style="width:100%; padding:8px; background:#0f4c81; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Poppins'; font-weight:600;"><i class="fa-solid fa-folder-open"></i> Ver ${numFotos} Archivos</button>`
            : `<button disabled style="width:100%; padding:8px; background:#e9ecef; color:#A3AED0; border:none; border-radius:8px; font-family:'Poppins'; font-weight:600;">Sin evidencias aún</button>`;

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
            <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-user-tie"></i> <strong>Jefe:</strong> ${job.nameManager}</p>
            <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-helmet-safety"></i> <strong>Emp:</strong> ${job.nameEmployee}</p>
            <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>
            
            <div style="margin: 10px 0; padding-left: 10px; border-left: 3px solid #0f4c81; width: 100%;">
                <p style="margin: 0; font-size: 13px; color: #444; font-style: italic; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    "${safeDesc}"
                </p>
            </div>

            <div style="margin-top: 15px; width: 100%;">
                ${btnEvidencias}
            </div>
        `;
        grid.appendChild(card);
    });
};

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

