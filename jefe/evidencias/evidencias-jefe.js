const JOBS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user/all-users';
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

    // Listeners de los filtros combinados
    const txtIn = document.getElementById('searchJobInput');
    const estIn = document.getElementById('filterStatusInput');
    const priIn = document.getElementById('filterPriorityInput');

    if (txtIn) txtIn.addEventListener('input', window.filtrarTrabajosCombinados);
    if (estIn) estIn.addEventListener('change', window.filtrarTrabajosCombinados);
    if (priIn) priIn.addEventListener('input', window.filtrarTrabajosCombinados);
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
            window.filtrarTrabajosCombinados();
        }

        Swal.close();
        const urlParams = new URLSearchParams(window.location.search);
        const jobIdParam = urlParams.get('jobId');

        if (jobIdParam) {
            const idNumerico = parseInt(jobIdParam);
            const trabajoEncontrado = misTrabajosCache.find(j => j.jobId === idNumerico);

            if (trabajoEncontrado) {
                if (trabajoEncontrado.updateJob && trabajoEncontrado.updateJob.length > 0) {
                    window.abrirModalEvidencias(idNumerico);
                } else {
                    Swal.fire({
                        icon: 'info',
                        title: 'Sin evidencias',
                        text: `El proyecto de "${trabajoEncontrado.clientName}" no registra avances fotográficos todavía.`,
                        confirmButtonColor: '#198754'
                    });
                }
            }
        }

    } catch (e) {
        console.error("Error al inicializar datos:", e);
        Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
    }
}

// 2. FILTROS COMBINADOS: texto, estado y prioridad
window.filtrarTrabajosCombinados = () => {
    const texto = document.getElementById('searchJobInput') ? document.getElementById('searchJobInput').value.toLowerCase().trim() : '';
    const estado = document.getElementById('filterStatusInput') ? document.getElementById('filterStatusInput').value : 'ALL';
    const prioridad = document.getElementById('filterPriorityInput') ? document.getElementById('filterPriorityInput').value.trim() : '';

    const resultado = misTrabajosCache.filter(job => {
        const coincideTexto =
            (job.clientName || '').toLowerCase().includes(texto) ||
            (job.description || '').toLowerCase().includes(texto) ||
            (job.nameEmployee || '').toLowerCase().includes(texto);

        const coincideEstado = (estado === 'ALL') || (job.status === estado);

        let coincidePrioridad = true;
        if (prioridad !== '') {
            const prioBuscada = parseInt(prioridad);
            const prioJob = (job.priority !== null && job.priority !== undefined && job.priority !== '')
                ? parseInt(job.priority)
                : 2;
            coincidePrioridad = prioJob === prioBuscada;
        }

        return coincideTexto && coincideEstado && coincidePrioridad;
    });

    renderizarTrabajos(resultado);
};

// 3. BADGES DE ESTADO Y PRIORIDAD (mismo estilo que trabajos.js)
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

// 4. DIBUJAMOS TABLA (desktop) + TARJETAS (mobile)
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
        let numArchivos = 0;

        if (job.updateJob) {
            job.updateJob.forEach(update => {
                if (update.evidences) numArchivos += update.evidences.length;
            });
        }

        const statusBadge = getStatusBadge(job.status);
        const priorityBadge = getPriorityBadge(job.priority);

        const btnEvidencias = numUpdates > 0
            ? `<button onclick="abrirModalEvidencias(${job.jobId})" style="padding:8px 14px; background:#198754; color:white; border:none; border-radius:8px; cursor:pointer; font-family:'Poppins'; font-weight:600; white-space:nowrap;"><i class="fa-solid fa-folder-open"></i> Ver ${numArchivos}</button>`
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
                    <h3 style="margin:0; font-size:1.1rem; color:#198754;">${job.clientName}</h3>
                    <div style="display:flex; gap:5px;">
                        ${statusBadge}
                        ${priorityBadge}
                    </div>
                </div>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-user-tie"></i> <strong>Jefe:</strong> ${job.nameManager || 'Sin asignar'}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-helmet-safety"></i> <strong>Subcontratista:</strong> ${job.nameEmployee || 'Sin asignar'}</p>
                <p style="margin: 3px 0; font-size: 13px; color:#666;"><i class="fa-solid fa-location-dot"></i> ${job.address}</p>

                <div style="margin: 10px 0; padding: 10px; background: #f4fbf6; border-left: 3px solid #198754; border-radius: 6px; width: 100%;">
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

// 5. LÓGICA PARA VER EL HISTORIAL (MODAL)
window.abrirModalEvidencias = (jobId) => {
    const job = misTrabajosCache.find(j => j.jobId === jobId);
    if (!job) return;

    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-folder-open"></i> Evidencias - ${job.clientName}`;

    document.getElementById('jobDescriptionText').innerHTML = `<strong>Descripción de obra:</strong> <br> ${job.description || 'Sin descripción'}`;

    const timeline = document.getElementById('evidencesTimeline');
    timeline.innerHTML = '';

    const updatesOrdenados = job.updateJob.sort((a, b) => new Date(b.date) - new Date(a.date));

    updatesOrdenados.forEach(update => {
        const fechaObj = new Date(update.date);
        const dia = String(fechaObj.getDate()).padStart(2, '0');
        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const anio = fechaObj.getFullYear();
        const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const fechaFormateada = `${mes}/${dia}/${anio} - ${hora}`;

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

    document.getElementById('modalEvidencias').style.display = 'flex';
};

window.cerrarModalEvidencias = () => {
    document.getElementById('modalEvidencias').style.display = 'none';
};

// 6. FUNCIÓN PARA VER LA FOTO EN PANTALLA COMPLETA USANDO SWEETALERT
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

// --- RESUMEN DE BODEGA (Con navegación día por día, igual que Nómina) ---
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

        bodegaDiaOffset = 0; // Reiniciamos al día actual cada vez que se abre

        Swal.fire({
            title: '<i class="fa-solid fa-truck-fast" style="color:#F4A300;"></i> Ordenes de Bodega',
            html: '<div id="bodega-contenedor">Generando reporte...</div>',
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: '750px',
            background: '#FFFFFF'
        });

        renderizarBodega(bodegaDiaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la bodega.', confirmButtonColor: '#12CFF4' });
    }
};

window.cambiarDiaBodega = (delta) => {
    bodegaDiaOffset += delta;
    renderizarBodega(bodegaDiaOffset);
};

// Helpers de fecha (mismos criterios que la nómina)
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

    const jefeNombreCompleto = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`.trim().toLowerCase();

    let htmlContent = `
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; background: #F4F7FE; padding: 12px; border-radius: 12px; border: 1px solid #12CFF4; margin-bottom: 15px;">
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

            // --- Estado del proyecto (mismo estilo que las otras vistas) ---
            let statusBadge = '';
            if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Pendiente</span>`;
            else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">En Progreso</span>`;
            else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Completado</span>`;
            else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Cancelado</span>`;

            // --- Descripción limpia (sin el bloque de materiales pre-asignados en texto) ---
            let descBodega = job.description ? job.description : '';
            if (descBodega.includes('[MATERIALES PRE-ASIGNADOS]:')) {
                descBodega = descBodega.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
            }

            // --- Combinamos materiales pre-asignados (jefe/admin) + necesarios (puede agregar el subcontratista) ---
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
                    // Si ya existía, actualizamos cantidad por si el subcontratista la cambió
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

// ==================== EXPORTAR PDF ====================
window.exportarBodegaPdf = () => {
    const listaDia = document.getElementById('bodega-lista-dia');
    if (!listaDia) return Swal.fire('Error', 'No hay trabajos para exportar en este día.', 'error');

    const lblFecha = document.getElementById('lblFechaBodega');
    const textoFecha = lblFecha ? lblFecha.textContent.trim() : new Date().toISOString().split('T')[0];
    const nombreArchivoClean = textoFecha.replace(/[\/]/g, '-');

    const nombreJefe = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`;

    const contenedorImpresion = document.createElement('div');
    contenedorImpresion.style.padding = "30px";
    contenedorImpresion.style.fontFamily = "'Poppins', sans-serif";
    contenedorImpresion.style.background = "#ffffff";

    contenedorImpresion.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #12CFF4; padding-bottom: 15px;">
            <h1 style="color: #0B0B0D; margin: 0;">ORDENES DE BODEGA</h1>
            <p style="margin: 8px 0 0 0; color: #12CFF4; font-weight: bold;">Jefe: ${nombreJefe}</p>
            <p style="margin: 5px 0 0 0; color: #555;">${textoFecha}</p>
        </div>
        ${listaDia.innerHTML}
        <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
            Reporte generado por el Portal RemoMN
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
// Declararla en window asegura que esté disponible globalmente en todo el script
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