const JOBS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user/all-users';
let userToken = '';
let myEmployeeId = null; 
let misTrabajosCache = [];
let trabajosFiltradosCache = [];

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    // Validación de seguridad para Empleados
    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_EMPLOYEE')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo los Empleados pueden acceder a esta sección.',
            confirmButtonColor: '#0277bd'
        }).then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('employee-email-display').textContent = userEmail || 'Empleado';

    await inicializarDatosDelEmpleado(userEmail);

    const txtIn = document.getElementById('searchJobInput');
    const estIn = document.getElementById('filterStatusInput');
    if (txtIn) txtIn.addEventListener('input', window.filtrarTrabajosEmpleado);
    if (estIn) estIn.addEventListener('change', window.filtrarTrabajosEmpleado);
});

async function inicializarDatosDelEmpleado(emailActual) {
    try {
        Swal.fire({ title: 'Cargando tus evidencias...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        // A) Buscamos el ID del Empleado actual
        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (resUsers.ok) {
            const users = await resUsers.json();
            const empleadoActual = users.find(u => u.email.toLowerCase() === emailActual.toLowerCase());
            if (empleadoActual) {
                myEmployeeId = empleadoActual.userId;
                document.getElementById('employee-email-display').textContent = `${empleadoActual.firstName} ${empleadoActual.lastName}`;
            } else {
                Swal.fire('Error', 'No se pudo identificar tu cuenta.', 'error');
                return;
            }
        }

        // B) Traemos todos los trabajos y filtramos solo los de ESTE Empleado
        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        if (resJobs.ok) {
            const todosLosTrabajos = await resJobs.json();
            misTrabajosCache = todosLosTrabajos.filter(job => job.employeeId === myEmployeeId);
            
            // Llamamos a la función para que los ordene y los pinte en pantalla
            window.filtrarTrabajosEmpleado();

            // 🔥 MAGIA: Leer URL para abrir evidencias automáticamente
            const urlParams = new URLSearchParams(window.location.search);
            const jobIdParam = urlParams.get('jobId');

            if (jobIdParam) {
                const idNumerico = parseInt(jobIdParam);
                const trabajoEncontrado = misTrabajosCache.find(j => j.jobId === idNumerico);

                if (trabajoEncontrado) {
                    if (trabajoEncontrado.updateJob && trabajoEncontrado.updateJob.length > 0) {
                        setTimeout(() => {
                            window.abrirModalEvidencias(idNumerico);
                        }, 300);
                    } else {
                        Swal.fire({
                            icon: 'info',
                            title: 'Sin evidencias',
                            text: `El proyecto de "${trabajoEncontrado.clientName}" no registra avances fotográficos todavía.`,
                            confirmButtonColor: '#0277bd'
                        });
                    }
                }
            }
        }
        
        Swal.close();

    } catch (e) {
        console.error("Error al inicializar datos:", e);
        Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
    }
}

function getStatusBadgeEmp(status) {
    if (status === 'PENDING') return `<span style="background: #FFF3E0; color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-clock"></i> Pendiente</span>`;
    if (status === 'IN_PROGRESS') return `<span style="background: #E3F2FD; color: #1e88e5; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-spinner fa-spin"></i> En Progreso</span>`;
    if (status === 'COMPLETED') return `<span style="background: #E8F5E9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-check-double"></i> Completado</span>`;
    return `<span style="background: #FFEBEE; color: #d32f2f; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;"><i class="fa-solid fa-ban"></i> Cancelado</span>`;
}

window.filtrarTrabajosEmpleado = () => {
    const texto = document.getElementById('searchJobInput') ? document.getElementById('searchJobInput').value.toLowerCase().trim() : '';
    const estado = document.getElementById('filterStatusInput') ? document.getElementById('filterStatusInput').value : 'ALL';

    const filtrados = misTrabajosCache.filter(job => {
        const coincideTexto = (job.clientName || '').toLowerCase().includes(texto) ||
                               (job.description || '').toLowerCase().includes(texto) ||
                               (job.nameManager || '').toLowerCase().includes(texto);
        const coincideEstado = (estado === 'ALL') || (job.status === estado);
        return coincideTexto && coincideEstado;
    });

    // 🔥 ORDENAMIENTO EXACTO (Fechas más nuevas arriba)
    filtrados.sort((a, b) => {
        let timeB = Array.isArray(b.jobDate) 
            ? new Date(b.jobDate[0], b.jobDate[1] - 1, b.jobDate[2]).getTime() 
            : new Date(b.jobDate || 0).getTime();
            
        let timeA = Array.isArray(a.jobDate) 
            ? new Date(a.jobDate[0], a.jobDate[1] - 1, a.jobDate[2]).getTime() 
            : new Date(a.jobDate || 0).getTime();
            
        if (timeB !== timeA) {
            return timeB - timeA;
        }
        return b.jobId - a.jobId;
    });

    renderizarTrabajos(filtrados);
};

function renderizarTrabajos(trabajos) {
    const tbody = document.getElementById('jobTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';

    if (trabajos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">No tienes proyectos que coincidan con los filtros.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="empty-state">No tienes proyectos que coincidan con los filtros.</div>`;
        return;
    }

    trabajos.forEach(job => {
        const numUpdates = job.updateJob ? job.updateJob.length : 0;
        let numArchivos = 0;
        if (job.updateJob) {
            job.updateJob.forEach(update => {
                if (update.evidences) numArchivos += update.evidences.length;
            });
        }

        const statusBadge = getStatusBadgeEmp(job.status);
        const safeDesc = job.description ? job.description : 'Sin descripción';

        const btnEvidencias = numUpdates > 0
            ? `<button onclick="abrirModalEvidencias(${job.jobId})" style="padding:8px 14px; background:#0277bd; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Poppins'; font-weight:600; white-space:nowrap;"><i class="fa-solid fa-folder-open"></i> Ver ${numArchivos}</button>`
            : `<button disabled style="padding:8px 14px; background:#e9ecef; color:#A3AED0; border:none; border-radius:8px; font-family:'Poppins'; font-weight:600; white-space:nowrap;">Sin evidencias</button>`;

        // FILA DE TABLA (DESKTOP)
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${job.clientName}</strong><br>
                <span class="desc-cell" title="${safeDesc.replace(/"/g, '&quot;')}">${safeDesc}</span>
            </td>
            <td>${job.nameManager || 'Sin asignar'}</td>
            <td>${statusBadge}</td>
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
                    <h3 style="margin:0; font-size:1.1rem; color:#0277bd;">${job.clientName}</h3>
                    ${statusBadge}
                </div>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-hard-hat"></i> <strong>Jefe:</strong> ${job.nameManager || 'Sin asignar'}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>

                <div style="margin: 10px 0; padding: 10px; background: #f8faff; border-left: 3px solid #0277bd; border-radius: 6px; width: 100%;">
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

window.abrirModalEvidencias = (jobId) => {
    const job = misTrabajosCache.find(j => j.jobId === jobId);
    if(!job) return;

    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-folder-open"></i> Mis Evidencias - ${job.clientName}`;
    document.getElementById('jobDescriptionText').innerHTML = `<strong>Descripción de obra:</strong> <br> ${job.description || 'Sin descripción'}`;
    
    const timeline = document.getElementById('evidencesTimeline');
    timeline.innerHTML = '';

    // 🔥 ORDENAMIENTO DE FECHAS A PRUEBA DE ERRORES
    const updatesOrdenados = job.updateJob.sort((a, b) => {
        let timeA = Array.isArray(a.date) 
            ? new Date(a.date[0], a.date[1] - 1, a.date[2], a.date[3] || 0, a.date[4] || 0).getTime() 
            : new Date(a.date).getTime();
        
        let timeB = Array.isArray(b.date) 
            ? new Date(b.date[0], b.date[1] - 1, b.date[2], b.date[3] || 0, b.date[4] || 0).getTime() 
            : new Date(b.date).getTime();
            
        return timeB - timeA;
    });

    updatesOrdenados.forEach(update => {
        // Formateo de fecha seguro
        let fechaObj;
        if (Array.isArray(update.date)) {
            fechaObj = new Date(update.date[0], update.date[1] - 1, update.date[2], update.date[3] || 0, update.date[4] || 0);
        } else {
            fechaObj = new Date(update.date);
        }

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
            galeriaHTML = `<span style="font-size:12px; color:#A3AED0;">No subiste archivos en esta actualización.</span>`;
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
        imageAlt: 'Evidencia',
        width: 'auto', // Ajustado a auto
        showConfirmButton: false,
        showCloseButton: true,
        background: 'transparent',
        backdrop: `rgba(0,0,0,0.85)`,
        customClass: {
            image: 'img-evidencia-full' // Conexión con el CSS
        }
    });
};

window.cerrarSesion = () => {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del portal?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#0277bd",
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