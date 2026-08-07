const JOBS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user/all-users';

let userToken = '';
let myManagerId = null;
let allJobs = [];           // Guardará todos los trabajos
let calendarInstance = null; // Guardará la instancia del calendario

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({ icon: 'error', title: 'Acceso Denegado', confirmButtonColor: '#12CFF4' })
        .then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('jefe-email-display').textContent = userEmail || 'Jefe';

    await cargarDatosYCronograma(userEmail);
});

async function cargarDatosYCronograma(emailActual) {
    try {
        Swal.fire({ title: 'Armando cronograma...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});

        if (resUsers.status === 401) {
            Swal.close();
            Swal.fire({
                icon: 'warning',
                title: 'Sesión expirada',
                text: 'Tu sesión ya no es válida, por favor inicia sesión nuevamente.',
                confirmButtonColor: '#12CFF4'
            }).then(() => {
                localStorage.clear();
                window.location.href = '../../index.html';
            });
            return;
        }

        const users = await resUsers.json();
        
        const jefeActual = users.find(u => u.email === emailActual);
        if (jefeActual) myManagerId = jefeActual.userId;

        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});

        if (resJobs.status === 401) {
            Swal.close();
            Swal.fire({
                icon: 'warning',
                title: 'Sesión expirada',
                text: 'Tu sesión ya no es válida, por favor inicia sesión nuevamente.',
                confirmButtonColor: '#12CFF4'
            }).then(() => {
                localStorage.clear();
                window.location.href = '../../index.html';
            });
            return;
        }

        allJobs = await resJobs.json();
        
        const misTrabajos = allJobs; // Mostrar todos los trabajos, sin filtrar por manager

        // Cargar filtro (todos los subcontratistas registrados, no solo los que ya tienen trabajos)
        await cargarFiltroEmpleados(users);

        const eventosFormateados = crearEventos(misTrabajos);

        var calendarEl = document.getElementById('calendar');
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth', 
            locale: 'es',
            height: 'auto', 
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            buttonText: {
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                list: 'Agenda'
            },
            events: eventosFormateados,
            
            eventContent: function(arg) {
                let p = arg.event.extendedProps;
                let icon = '';
                
                if(p.status === 'PENDING') icon = '<i class="fa-solid fa-clock"></i>';
                if(p.status === 'IN_PROGRESS') icon = '<i class="fa-solid fa-gear fa-spin"></i>';
                if(p.status === 'COMPLETED') icon = '<i class="fa-solid fa-check-double"></i>';
                if(p.status === 'CANCELLED') icon = '<i class="fa-solid fa-ban"></i>';

                let viewType = arg.view.type;

                if (viewType === 'listWeek' || viewType === 'listMonth' || viewType === 'listDay') {
                    let customHtml = `
                        <div style="display: flex; flex-direction: column; gap: 6px; padding: 5px; width: 100%;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-weight: 700; font-size: 1.15em; color: #0f4c81;">
                                    <span style="color: ${arg.event.backgroundColor}; margin-right: 5px;">${icon}</span> 
                                    ${arg.event.title}
                                </div>
                                <div style="font-weight: bold; color: #2e7d32; font-size: 1.1em;">
                                    $${parseFloat(p.pay || 0).toFixed(2)}
                                </div>
                            </div>
                            <div style="font-size: 0.9em; color: #555; display: flex; gap: 15px; flex-wrap: wrap;">
                                <span><strong><i class="fa-solid fa-user-tie" style="color: #198754;"></i> Emp:</strong> ${p.employee}</span>
                                <span><strong><i class="fa-solid fa-location-dot" style="color: #198754;"></i> Dir:</strong> ${p.address}</span>
                            </div>
                            <div style="font-size: 0.9em; color: #444; font-style: italic; background: #F9FAFC; padding: 10px; border-left: 4px solid ${arg.event.backgroundColor}; border-radius: 6px; margin-top: 5px;">
                                "${p.description}"
                            </div>
                        </div>
                    `;
                    return { html: customHtml };
                } else {
                    let customHtml = `
                        <div style="padding: 4px; color: white; line-height: 1.4; overflow: hidden;" title="Obra: ${p.description}">
                            <div style="font-weight: 700; font-size: 0.85em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 2px; margin-bottom: 3px;">
                                ${icon} ${arg.event.title}
                            </div>
                            <div style="font-size: 0.75em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                                <i class="fa-solid fa-user-tie"></i> ${p.employee}
                            </div>
                        </div>
                    `;
                    return { html: customHtml };
                }
            },

            eventClick: function(info) {
                const p = info.event.extendedProps;
                
                let estadoTxt = '';
                let badgeColor = '';
                
                if(p.status === 'PENDING') { estadoTxt = 'Pendiente'; badgeColor = '#ff9800'; }
                if(p.status === 'IN_PROGRESS') { estadoTxt = 'En Progreso'; badgeColor = '#1e88e5'; }
                if(p.status === 'COMPLETED') { estadoTxt = 'Completado'; badgeColor = '#6c757d'; }
                if(p.status === 'CANCELLED') { estadoTxt = 'Cancelado'; badgeColor = '#d32f2f'; }

                Swal.fire({
                    title: `<h3 style="color:#0f4c81; margin:0; font-weight:700;">${info.event.title}</h3>`,
                    html: `
                        <div style="text-align: left; margin-top: 15px; font-family: 'Poppins', sans-serif;">
                            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px dashed #ccc;">
                                <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: bold;">
                                    ${estadoTxt}
                                </span>
                                <span style="font-weight: bold; color: #2e7d32; font-size: 1.2rem;">$${parseFloat(p.pay || 0).toFixed(2)}</span>
                            </div>
                            <div style="padding-left: 5px;">
                                <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                    <strong><i class="fa-solid fa-phone" style="color:#198754; width:20px;"></i> Teléfono:</strong> ${p.clientPhone}
                                </p>
                                <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                    <strong><i class="fa-solid fa-location-dot" style="color:#198754; width:20px;"></i> Dirección:</strong> ${p.address}
                                </p>
                                <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                    <strong><i class="fa-solid fa-user-tie" style="color:#198754; width:20px;"></i> Empleado:</strong> ${p.employee}
                                </p>
                            </div>
                            <div style="margin-top: 20px; padding: 15px; background: #F9FAFC; border-radius: 8px; border: 1px solid #E0E5F2;">
                                <strong style="color: #2B3674; font-size: 13px;"><i class="fa-solid fa-align-left"></i> Descripción de la obra:</strong>
                                <p style="margin: 8px 0 0 0; font-size: 13px; color: #555; font-style: italic; line-height: 1.5;">
                                    "${p.description}"
                                </p>
                            </div>
                        </div>
                    `,
                    confirmButtonColor: '#12CFF4',
                    confirmButtonText: 'Cerrar detalle',
                    width: '450px'
                });
            }
        });

        calendarInstance.render();
        Swal.close();

    } catch (error) {
        Swal.close();
        console.error("Error al cargar calendario:", error);
        Swal.fire('Error', 'No se pudieron cargar los datos del calendario.', 'error');
    }
}

function cargarFiltroEmpleados(allUsers) {
    const select = document.getElementById('filterEmployee');
    select.innerHTML = '<option value="">Todos los Subcontratistas</option>';

    // Se listan TODOS los usuarios con rol de empleado/subcontratista,
    // tengan o no un trabajo asignado actualmente.
    // roles viene como array de objetos: [{ id, name: "ROLE_EMPLOYEE" }]
    const empleados = allUsers.filter(u => {
        if (Array.isArray(u.roles)) {
            return u.roles.some(r => (r && (r.name === 'ROLE_EMPLOYEE' || r === 'ROLE_EMPLOYEE')));
        }
        if (typeof u.role === 'string') return u.role === 'ROLE_EMPLOYEE';
        return false;
    });

    empleados
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
        .forEach(empleado => {
            const option = document.createElement('option');
            option.value = empleado.userId;
            option.textContent = `${empleado.firstName} ${empleado.lastName}`;
            select.appendChild(option);
        });

    select.addEventListener('change', filtrarCalendario);
}

function crearEventos(trabajosFiltrados) {
    return trabajosFiltrados.map(job => {
        let bgColor = '#ff9800'; 
        if(job.status === 'IN_PROGRESS') bgColor = '#1e88e5'; 
        else if(job.status === 'COMPLETED') bgColor = '#6c757d'; 
        else if(job.status === 'CANCELLED') bgColor = '#d32f2f'; 

        return {
            id: job.jobId,
            title: job.clientName,
            start: job.jobDate ? job.jobDate.split('T')[0] : new Date().toISOString().split('T')[0], 
            backgroundColor: bgColor,
            borderColor: bgColor,
            extendedProps: {
                address: job.address,
                description: job.description || 'Sin descripción',
                status: job.status,
                pay: job.pay,
                employee: job.nameEmployee || 'Sin asignar',
                clientPhone: job.clientPhone,
                employeeId: job.employeeId
            }
        };
    });
}

function filtrarCalendario() {
    const employeeIdSeleccionado = document.getElementById('filterEmployee').value;
    
    let trabajosFiltrados = allJobs; // Todos los trabajos, sin filtrar por manager

    if (employeeIdSeleccionado) {
        trabajosFiltrados = trabajosFiltrados.filter(job => job.employeeId == employeeIdSeleccionado);
    }

    const nuevosEventos = crearEventos(trabajosFiltrados);
    
    if (calendarInstance) {
        calendarInstance.removeAllEvents();
        calendarInstance.addEventSource(nuevosEventos);
    }
}
window.resetFilter = () => {
    document.getElementById('filterEmployee').value = '';
    filtrarCalendario();
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
            fetch('https://api-remomn.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-remomn.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
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
        try { userRoles = JSON.parse(rolesString); } catch(e) { console.error("Error al leer roles"); } 
    }

    if (userRoles.length > 1) {
        Swal.fire({
            title: "¿Qué deseas hacer?",
            text: "Selecciona si deseas salir del sistema o cambiar tu rol de trabajo.",
            icon: "question",
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: "#12CFF4", // Color por defecto armónico
            denyButtonColor: "#00B8A9",
            cancelButtonColor: "#2E3238",
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
            text: "¿Estás seguro que deseas salir?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#12CFF4",
            cancelButtonColor: "#2E3238",
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