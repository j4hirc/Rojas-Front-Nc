const JOBS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user/all-users';
const MATERIALS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/materials/all';
const UPDATE_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/job-updates/create';
const USER_API_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user';

let userToken = '';
let myEmployeeId = null;
let currentJobInfo = null;
let miUsuarioActual = null;

let archivosSeleccionados = [];
let imagenesBase64Data = [];

let allMaterialsCache = [];
let materialesEstadoEmpleado = {};

let canvasSub, ctxSub;
let drawingSub = false;

function calcularTotalMaterialesOriginales(jobInfo) {
    if (!jobInfo || !jobInfo.materials || jobInfo.materials.length === 0) return 0;
    let total = 0;
    jobInfo.materials.forEach(m => {
        const matInfo = allMaterialsCache.find(x => x.materialId == m.materialId);
        const price = matInfo ? (matInfo.price || 0) : (m.price || 0);
        const qty = m.quantity || 0;
        total += qty * price;
    });
    return total;
}

function formatearFecha(fecha) {
    if (!fecha) return 'Sin fecha asignada';
    if (Array.isArray(fecha)) {
        const dia = String(fecha[2]).padStart(2, '0');
        const mes = String(fecha[1]).padStart(2, '0');
        const anio = fecha[0];
        return `${mes}-${dia}-${anio}`;
    } else if (typeof fecha === 'string') {
        const partes = fecha.split('-');
        if (partes.length === 3) return `${partes[1]}-${partes[2]}-${partes[0]}`;
    }
    return fecha;
}

function fechaParaCalendario(fecha) {
    if (!fecha) return new Date().toISOString().split('T')[0];
    if (Array.isArray(fecha)) {
        const dia = String(fecha[2]).padStart(2, '0');
        const mes = String(fecha[1]).padStart(2, '0');
        const anio = fecha[0];
        return `${anio}-${mes}-${dia}`;
    }
    return fecha;
}

function extraerDatosMaterialesFallback(texto) {
    const datos = {};
    if (!texto) return datos;
    const lineas = texto.split('\n');

    lineas.forEach(linea => {
        if (linea.includes(':') && (linea.includes('•') || linea.includes('📦') || linea.includes('-'))) {
            const partes = linea.split(':');
            const nombreMat = partes[0].replace(/[•📦\-*]/g, '').trim().toLowerCase();
            const valorStr = partes[1].trim();

            let qty = '';
            let unit = '';

            const numMatch = valorStr.match(/^(\d+(?:\.\d+)?)\s*(.*)/);
            if (numMatch) {
                qty = numMatch[1];
                unit = numMatch[2];
            } else if (valorStr.toLowerCase() !== 'asignado' && !valorStr.toLowerCase().includes('no especificada')) {
                unit = valorStr;
            }

            datos[nombreMat] = { qty, unit };
        }
    });
    return datos;
}

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_EMPLOYEE')) {
        Swal.fire({ icon: 'error', title: 'Acceso Denegado', confirmButtonColor: '#00B8A9' })
            .then(() => { window.location.href = '../index.html'; });
        return;
    }

    inicializarCanvasFirma();
    await cargarMateriales();
    await cargarCalendarioEmpleado(userEmail);

    const matSearchIn = document.getElementById('searchMaterialInput');
    const matCatIn = document.getElementById('filterCategoryMaterial');
    if (matSearchIn) matSearchIn.addEventListener('input', window.filtrarMaterialesEmpleado);
    if (matCatIn) matCatIn.addEventListener('change', window.filtrarMaterialesEmpleado);

    document.getElementById('evStatus').addEventListener('change', (e) => {
        const certBox = document.getElementById('certBox');
        if (e.target.value === 'COMPLETED') {
            certBox.style.display = 'block';
        } else {
            certBox.style.display = 'none';
            document.getElementById('evCertification').checked = false;
        }
    });

    document.getElementById('evModifications').addEventListener('change', (e) => {
        const priceContainer = document.getElementById('newPriceContainer');
        priceContainer.style.display = e.target.checked ? 'block' : 'none';
    });
});

async function cargarCalendarioEmpleado(emailActual) {
    try {
        Swal.fire({ title: 'Cargando tus trabajos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const users = await resUsers.json();
        const yo = users.find(u => u.email.toLowerCase() === emailActual.toLowerCase());

        if (yo) {
            myEmployeeId = yo.userId;
            miUsuarioActual = yo;
            document.getElementById('employee-email-display').textContent = `${yo.firstName} ${yo.lastName}`;
        } else {
            document.getElementById('employee-email-display').textContent = emailActual;
        }

        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const todosLosTrabajos = await resJobs.json();
        const misTrabajos = todosLosTrabajos.filter(job => job.employeeId === myEmployeeId);

        const eventosFormateados = misTrabajos.map(job => {
            const prioridad = job.priority || 3;

            let bgColor = '#64748B';
            let borderColor = '#475569';
            let icon = '<i class="fa-solid fa-clock"></i>';

            switch (prioridad) {
                case 1:
                    bgColor = '#EF4444';
                    borderColor = '#B91C1C';
                    icon = '<i class="fa-solid fa-fire-flame-curved"></i>';
                    break;
                case 2:
                    bgColor = '#F59E0B';
                    borderColor = '#D97706';
                    icon = '<i class="fa-solid fa-exclamation-triangle"></i>';
                    break;
                case 3:
                    bgColor = '#10B981';
                    borderColor = '#059669';
                    icon = '<i class="fa-solid fa-clock"></i>';
                    break;
            }

            if (job.status === 'IN_PROGRESS') {
                bgColor = '#12CFF4';
                borderColor = '#0EA5C4';
                icon = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }
            if (job.status === 'COMPLETED') {
                bgColor = '#9CA3AF';
                borderColor = '#6B7280';
                icon = '<i class="fa-solid fa-circle-check"></i>';
            }
            if (job.status === 'CANCELLED') {
                bgColor = '#6B7280';
                borderColor = '#4B5563';
                icon = '<i class="fa-solid fa-circle-xmark"></i>';
            }

            return {
                id: job.jobId,
                title: job.clientName,
                start: fechaParaCalendario(job.jobDate),
                backgroundColor: bgColor,
                borderColor: borderColor,
                extendedProps: {
                    ...job,
                    prioridad: prioridad,
                    prioridadTexto: prioridad === 1 ? 'ALTA' : prioridad === 2 ? 'MEDIA' : 'BAJA',
                    fechaHermosa: formatearFecha(job.jobDate),
                    iconoPrioridad: icon
                }
            };
        });

        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth',
            locale: 'es',
            height: 'auto',
            eventOrder: ['prioridad', 'start', 'title'],
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
            noEventsContent: 'No tienes trabajos asignados por el momento.',
            events: eventosFormateados,

            eventContent: function (arg) {
                const p = arg.event.extendedProps;
                const prioridad = p.prioridad || 3;

                let badgePrioridad = '';
                if (prioridad === 1) {
                    badgePrioridad = `<span style="background:#EF4444;color:white;font-size:10px;padding:1px 6px;border-radius:3px;">¡ALTA!</span>`;
                } else if (prioridad === 2) {
                    badgePrioridad = `<span style="background:#F59E0B;color:white;font-size:10px;padding:1px 6px;border-radius:3px;">MEDIA</span>`;
                }

                let viewType = arg.view.type;

                if (viewType === 'listWeek' || viewType === 'listMonth' || viewType === 'listDay') {
                    return {
                        html: `
                <div style="display: flex; flex-direction: column; gap: 6px; padding: 5px; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-weight: 700; font-size: 1.15em; color: #111C44;">
                            <span style="color: ${arg.event.backgroundColor}; margin-right: 5px;">${p.iconoPrioridad}</span> 
                            ${arg.event.title}
                            ${badgePrioridad}
                        </div>
                        <div style="font-weight: bold; color: #F59E0B; font-size: 1.1em;">
                            $${parseFloat(p.pay || 0).toFixed(2)}
                        </div>
                    </div>
                    <div style="font-size: 0.9em; color: #555; display: flex; gap: 15px; flex-wrap: wrap;">
                        <span><strong>Dir:</strong> ${p.address || 'Sin dirección'}</span>
                    </div>
                </div>
            `
                    };
                } else {
                    return {
                        html: `
                <div style="padding: 4px; color: white; line-height: 1.4; overflow: hidden; text-align: center;">
                    <div style="font-weight: 700; font-size: 0.85em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                        ${p.iconoPrioridad} ${arg.event.title}
                        ${badgePrioridad}
                    </div>
                </div>
            `
                    };
                }
            },

eventClick: function (info) {
                const p = info.event.extendedProps;
                currentJobInfo = p;

                let estadoTxt = '';
                let badgeColor = '';
                let estaBloqueado = false;

                if (p.status === 'PENDING') { estadoTxt = 'Pendiente'; badgeColor = '#F59E0B'; }
                if (p.status === 'IN_PROGRESS') { estadoTxt = 'En Progreso'; badgeColor = '#00B8A9'; }
                if (p.status === 'COMPLETED') { estadoTxt = 'Completado'; badgeColor = '#10B981'; estaBloqueado = true; }
                if (p.status === 'CANCELLED') { estadoTxt = 'Cancelado'; badgeColor = '#EF4444'; estaBloqueado = true; }

                let prioridadHTML = '';
                if (p.prioridad === 1) {
                    prioridadHTML = `<span style="background:#EF4444;color:white;padding:6px 12px;border-radius:6px;font-weight:bold;">🔥 PRIORIDAD ALTA</span>`;
                } else if (p.prioridad === 2) {
                    prioridadHTML = `<span style="background:#F59E0B;color:white;padding:6px 12px;border-radius:6px;font-weight:bold;">⚠️ PRIORIDAD MEDIA</span>`;
                } else if (p.prioridad === 3) {
                    prioridadHTML = `<span style="background:#64748B;color:white;padding:6px 12px;border-radius:6px;font-weight:bold;">PRIORIDAD BAJA</span>`;
                }

                let htmlBloqueo = estaBloqueado
                    ? `<div style="margin-top: 15px; padding: 12px; background: rgba(16, 185, 129, 0.1); color: #111C44; border-radius: 8px; font-weight: bold; text-align: center; border: 1px solid #10B981;">
                        <i class="fa-solid fa-circle-check" style="color: #10B981;"></i> Proyecto Finalizado.
                       </div>`
                    : ``;

                let descCompleta = p.description || '';
                if (descCompleta.includes('[MATERIALES PRE-ASIGNADOS]:')) {
                    descCompleta = descCompleta.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
                }

                let listaMaterialesHtml = '';
                if (p.materials && p.materials.length > 0) {
                    listaMaterialesHtml = p.materials.map(m => {
                        let cantidadStr = (m.quantity && m.quantity > 0) ? m.quantity : '';
                        let unidadStr = (m.unit && m.unit !== 'N/A') ? m.unit : '';
                        let textMat = cantidadStr || unidadStr ? `${cantidadStr} ${unidadStr}`.trim() : 'Asignado';

                        return `
                        <li style="margin-bottom: 8px; font-size: 13px; color: #2B3674; list-style: none; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-circle-check" style="color:#00B8A9; font-size: 14px;"></i> 
                            <span>${m.name}: <strong style="color:#12CFF4;">${textMat}</strong></span>
                        </li>
                        `;
                    }).join('');
                } else {
                    listaMaterialesHtml = `<li style="font-size: 13px; color: #666; list-style: none;">No hay materiales registrados en la orden.</li>`;
                }

                const urlsPlanos = p.blueprintUrls || [];
                let planoHtml = '';
                if (urlsPlanos.length > 0) {
                    planoHtml = `
                        <div style="text-align:center; margin: 20px 0;">
                            <button type="button" onclick="verPlanosEmpleado()" class="animate__animated animate__pulse animate__infinite" style="display:flex; width:100%; align-items:center; justify-content:center; gap:10px; background:linear-gradient(135deg, #12CFF4, #0f4c81); color:white; padding:14px 18px; border-radius:12px; text-decoration:none; font-weight:bold; font-size:15px; box-shadow: 0 6px 15px rgba(18,207,244,0.4); border:none; cursor:pointer; text-transform:uppercase; letter-spacing: 0.5px;">
                                <i class="fa-solid fa-folder-open" style="font-size: 1.4rem;"></i> Ver Planos Adjuntos (${urlsPlanos.length})
                            </button>
                        </div>
                    `;
                }

                let notasHtml = `
                    <div style="margin-top: 20px; text-align: left;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #111C44; border-bottom: 2px solid #F4F7FE; padding-bottom: 5px;">
                            <i class="fa-regular fa-comments" style="color:#00B8A9; margin-right: 5px;"></i> Instrucciones
                        </h4>
                        <p style="margin: 0 0 15px 0; font-size: 13px; color: #4A5568; white-space: pre-wrap; padding-left: 5px;">${descCompleta || 'Sin notas especiales.'}</p>

                        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #111C44; border-bottom: 2px solid #F4F7FE; padding-bottom: 5px;">
                            <i class="fa-solid fa-boxes-packing" style="color:#00B8A9; margin-right: 5px;"></i> Materiales asignados
                        </h4>
                        <ul style="margin: 0; padding: 0 0 0 5px;">
                            ${listaMaterialesHtml}
                        </ul>
                    </div>
                `;

                Swal.fire({
                    title: `<h3 style="color:#111C44; margin:0; font-weight:700; text-align:center;">Detalles de la Orden</h3>`,
                    html: `
            <div style="text-align: left; margin-top: 10px; font-family: 'Poppins', sans-serif;">
                
                <div style="text-align:center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px dashed #E2E8F0;">
                    <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                        Estado: ${estadoTxt}
                    </span>
                </div>

                <div style="text-align:center; margin: 12px 0 18px 0;">
                    ${prioridadHTML}
                </div>

                <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                    <strong><i class="fa-regular fa-calendar" style="color:#00B8A9; width:20px;"></i> Fecha:</strong> ${p.fechaHermosa}
                </p>
                <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                    <strong><i class="fa-solid fa-house" style="color:#00B8A9; width:20px;"></i> Propiedad:</strong> ${p.clientName}
                </p>
                <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                    <strong><i class="fa-solid fa-phone" style="color:#00B8A9; width:20px;"></i> Teléfono:</strong> ${p.clientPhone || 'No registrado'}
                </p>
                <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                    <strong><i class="fa-solid fa-location-dot" style="color:#00B8A9; width:20px;"></i> Dirección:</strong> ${p.address || 'Sin dirección'}
                </p>
                <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                    <strong><i class="fa-solid fa-lock" style="color:#00B8A9; width:20px;"></i> Código Caja Fuerte:</strong> ${p.safeDepositBoxCodes || 'No registrado'}
                </p>
                <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                    <strong><i class="fa-solid fa-sack-dollar" style="color:#00B8A9; width:20px;"></i> Pago:</strong> $${parseFloat(p.pay || 0).toFixed(2)}
                </p>

                ${planoHtml}

                ${notasHtml}
                            
                <div style="position: relative; margin-top: 15px;">
                    <div id="swalMap" style="height: 180px; width: 100%; border-radius: 8px; border: 1px solid #ddd; z-index: 10;"></div>
                    <a href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" style="position: absolute; bottom: 10px; right: 10px; background: #111C44; color: white; padding: 8px 15px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: 0.2s;">
                        <i class="fa-solid fa-map-location-dot"></i> Ir a la Obra
                    </a>
                </div>
                            
                ${htmlBloqueo}
            </div>
                    `,
                    showCancelButton: true,
                    showDenyButton: true, // 🔥 NUEVO: Activa un tercer botón
                    showConfirmButton: !estaBloqueado, 
                    
                    // Configuración de los 3 botones
                    confirmButtonColor: '#00B8A9',   // Botón 1: Hacer reporte (verde)
                    denyButtonColor: '#0F2D4A',      // Botón 2: Ver Evidencias (azul oscuro)
                    cancelButtonColor: '#1B254B',    // Botón 3: Cerrar (azul muy oscuro)
                    
                    confirmButtonText: '<i class="fa-solid fa-camera"></i> Hacer Reporte',
                    denyButtonText: '<i class="fa-solid fa-folder-open"></i> Ver Evidencias',
                    cancelButtonText: 'Cerrar',
                    
                    width: '450px',
                    didOpen: () => {
                        let swalMap = L.map('swalMap').setView([p.latitude, p.longitude], 15);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(swalMap);
                        L.marker([p.latitude, p.longitude]).addTo(swalMap);
                        setTimeout(() => swalMap.invalidateSize(), 100);
                    }
                }).then((result) => {
                    // Si el usuario presiona "Hacer Reporte"
                    if (result.isConfirmed && !estaBloqueado) {
                        abrirModalEvidence(info.event.id);
                    }
                    // Si el usuario presiona "Ver Evidencias" (sin importar si está bloqueado o no)
                    else if (result.isDenied) {
                        // Navega a la página de evidencias que tiene el empleado pasándole el ID
                        window.location.href = `evidencias/evidencias.html?jobId=${info.event.id}`;
                    }
                });
            }
        });

        calendar.render();
        Swal.close();
        setTimeout(() => { calendar.updateSize(); }, 300);
        window.addEventListener('resize', () => { calendar.updateSize(); });
    } catch (error) { console.error(error); }
}

// 🔥 MODAL DE PLANOS PARA EL EMPLEADO
window.verPlanosEmpleado = () => {
    if (!currentJobInfo) return;

    const urls = currentJobInfo.blueprintUrls || [];
    const container = document.getElementById('listaPlanosContainer');
    container.innerHTML = '';

    if (urls.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666; font-size: 14px;">No hay planos adjuntos en este proyecto.</p>';
    } else {
        urls.forEach((url, idx) => {
            container.innerHTML += `
                <a href="${url}" target="_blank" style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; text-decoration: none; color: #0f4c81; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: 0.3s; word-break: break-word;">
                    <span style="display:flex; align-items:center; gap:12px;">
                        <span style="background: #e0f2fe; padding: 10px; border-radius: 8px;">
                            <i class="fa-solid fa-file-pdf" style="color: #0ea5e9; font-size: 1.8rem;"></i>
                        </span>
                        <span>Plano / Documento ${idx + 1}</span>
                    </span>
                    <i class="fa-solid fa-chevron-right" style="color: #94a3b8; font-size: 1.2rem;"></i>
                </a>
            `;
        });
    }

    document.getElementById('modalVerPlanos').style.display = 'flex';
};

window.cerrarModalPlanos = () => {
    document.getElementById('modalVerPlanos').style.display = 'none';
};


function obtenerNombreCategoriaEmpleado(mat) {
    return mat.categoryName
        || (mat.category && (mat.category.name || mat.category)) || '';
}

function poblarCategoriasMaterialesEmpleado(materials) {
    const select = document.getElementById('filterCategoryMaterial');
    if (!select) return;

    const valorActual = select.value;
    const categorias = new Set();
    materials.forEach(mat => {
        const cat = obtenerNombreCategoriaEmpleado(mat);
        if (cat) categorias.add(cat);
    });

    select.innerHTML = '<option value="">Todas las Categorías</option>';
    [...categorias].sort((a, b) => a.localeCompare(b)).forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });

    if ([...categorias].includes(valorActual)) select.value = valorActual;
}

function renderizarMaterialesEmpleado(materials) {
    const containerMat = document.getElementById('employeeMaterialsContainer');
    if (!containerMat) return;

    containerMat.innerHTML = '';

    if (!materials || materials.length === 0) {
        containerMat.innerHTML = '<p style="color: #64748B; font-size: 13px;">No se encontraron materiales con ese filtro.</p>';
        return;
    }

    const idsOriginales = (currentJobInfo && currentJobInfo.materials)
        ? currentJobInfo.materials.map(m => m.materialId) : [];

    materials.forEach(mat => {
        const precioMat = mat.price || 0;
        const estado = materialesEstadoEmpleado[mat.materialId] || {};
        const checkedAttr = estado.checked ? 'checked' : '';
        const esOriginal = idsOriginales.includes(mat.materialId);
        const disabledAttr = esOriginal ? '' : 'disabled';
        const rowStyle = esOriginal ? '' : 'opacity: 0.45;';
        const titleAttr = esOriginal ? '' : 'title="Solo puedes ajustar cantidad de los materiales ya asignados, no agregar materiales nuevos"';

        const safeUnit = mat.unit ? mat.unit.replace(/'/g, "\\'") : '';

        containerMat.innerHTML += `
    <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px; ${rowStyle}" ${titleAttr}>
        <label style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 14px; color: #2B3674; font-weight: bold; cursor: ${esOriginal ? 'pointer' : 'not-allowed'};">
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" name="empMaterials" value="${mat.materialId}" data-name="${mat.name}" data-price="${precioMat}" data-unit="${safeUnit}" onchange="toggleMaterialEmpleado(${mat.materialId})" ${checkedAttr} ${disabledAttr}>
                ${mat.name}
            </div>
            <span style="color: #198754; font-size: 12px; background: #e8f5e9; padding: 2px 6px; border-radius: 4px;">$${precioMat.toFixed(2)} c/u</span>
        </label>
    </div>
`;
    });
}

window.filtrarMaterialesEmpleado = () => {
    const texto = document.getElementById('searchMaterialInput')
        ? document.getElementById('searchMaterialInput').value.toLowerCase().trim() : '';
    const categoria = document.getElementById('filterCategoryMaterial')
        ? document.getElementById('filterCategoryMaterial').value : '';

    const filtrados = allMaterialsCache.filter(mat => {
        const coincideTexto = (mat.name || '').toLowerCase().includes(texto);
        const coincideCategoria = !categoria || obtenerNombreCategoriaEmpleado(mat) === categoria;
        return coincideTexto && coincideCategoria;
    });

    renderizarMaterialesEmpleado(filtrados);
};

async function cargarMateriales() {
    try {
        const resMat = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        if (resMat.ok) {
            allMaterialsCache = await resMat.json();
            poblarCategoriasMaterialesEmpleado(allMaterialsCache);
            renderizarMaterialesEmpleado(allMaterialsCache);
        }
    } catch (e) { console.error(e); }
}

window.toggleMaterialEmpleado = (matId) => {
    const checkbox = document.querySelector(`input[name="empMaterials"][value="${matId}"]`);
    const matName = checkbox.getAttribute('data-name');
    const matPrice = parseFloat(checkbox.getAttribute('data-price')) || 0;
    const matUnit = checkbox.getAttribute('data-unit') || '';

    const idsOriginales = (currentJobInfo && currentJobInfo.materials)
        ? currentJobInfo.materials.map(m => m.materialId) : [];

    if (checkbox.checked && !idsOriginales.includes(matId)) {
        checkbox.checked = false;
        Swal.fire({ icon: 'warning', title: 'No permitido', text: 'Solo puedes ajustar la cantidad de los materiales ya asignados a este trabajo, no agregar materiales nuevos.', confirmButtonColor: '#00B8A9' });
        return;
    }

    if (!materialesEstadoEmpleado[matId]) materialesEstadoEmpleado[matId] = {};
    materialesEstadoEmpleado[matId].checked = checkbox.checked;

    if (checkbox.checked) {
        agregarMaterialNecesarioEmpleado(matId, matName, matPrice, 1, matUnit);
    } else {
        eliminarMaterialNecesarioEmpleadoPorId(matId);
        delete materialesEstadoEmpleado[matId];
    }
};

// 🔥 AQUÍ ESTÁ EL ARREGLO: CAJITA DE UNIDAD BLOQUEADA
function crearFilaMaterialNecesarioEmpleado(matId, name, price, qtyInicial, unitInicial) {
    const qty = (qtyInicial !== undefined && qtyInicial !== null && qtyInicial !== '') ? qtyInicial : 1;
    const unit = (unitInicial !== undefined && unitInicial !== null) ? unitInicial : '';

    return `
        <div class="necessary-material-row necessary-material-row-emp" id="nec-emp-${matId}">
            
            <!-- Este span oculto permite que tu JS siga encontrando el "$" y el precio sin romperse -->
            <span style="display:none;">$${price.toFixed(2)}</span>

            <div class="nec-name" title="${name}">${name}</div>
            <div class="nec-fields">
                <input type="number" class="nec-qty nec-emp-qty" value="${qty}" min="1"
                       oninput="calcularTotalMaterialesNecesariosEmpleado()" data-matid="${matId}" title="Cantidad (Editable)">
                
                <input type="text" class="nec-unit nec-emp-unit" placeholder="Unidad" value="${unit}" readonly
                       data-matid="${matId}" title="Unidad (Fija)">
                
                <input type="number" class="nec-price nec-emp-price" value="${price}" step="0.01" min="0" readonly
                       data-matid="${matId}" title="Precio Unitario (Fijo)">
                
                <button type="button" class="nec-delete" onclick="eliminarMaterialNecesarioEmpleadoPorId(${matId})" title="Quitar Material">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

window.agregarMaterialNecesarioEmpleado = (matId, name, price, qtyInicial, unitInicial) => {
    const container = document.getElementById('necessaryMaterialsContainerEmp');
    if (!container) return;
    if (document.getElementById(`nec-emp-${matId}`)) return;

    container.insertAdjacentHTML('beforeend', crearFilaMaterialNecesarioEmpleado(matId, name, price, qtyInicial, unitInicial));
    calcularTotalMaterialesNecesariosEmpleado();
};

window.eliminarMaterialNecesarioEmpleadoPorId = (matId) => {
    const row = document.getElementById(`nec-emp-${matId}`);
    if (row) row.remove();
    calcularTotalMaterialesNecesariosEmpleado();

    const checkbox = document.querySelector(`input[name="empMaterials"][value="${matId}"]`);
    if (checkbox) checkbox.checked = false;
    if (materialesEstadoEmpleado[matId]) delete materialesEstadoEmpleado[matId];
};

window.calcularTotalMaterialesNecesariosEmpleado = () => {
    let total = 0;
    document.querySelectorAll('.necessary-material-row-emp').forEach(row => {
        const qtyInput = row.querySelector('.nec-emp-qty');
        const qty = qtyInput ? parseFloat(qtyInput.value) || 0 : 0;
        const priceMatch = row.textContent.match(/\$([\d.]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0;
        total += qty * price;
    });
    const totalElement = document.getElementById('totalNecessaryMaterialsEmp');
    if (totalElement) totalElement.textContent = total.toFixed(2);
};

function limpiarMaterialesNecesariosEmpleado() {
    const container = document.getElementById('necessaryMaterialsContainerEmp');
    if (container) container.innerHTML = '';
    const totalElement = document.getElementById('totalNecessaryMaterialsEmp');
    if (totalElement) totalElement.textContent = '0.00';
}


window.abrirModalEvidence = (jobId) => {
    document.getElementById('evidenceForm').reset();
    document.getElementById('evJobId').value = jobId;
    document.getElementById('imagePreviewContainer').innerHTML = '';
    document.getElementById('certBox').style.display = 'none';
    document.getElementById('newPriceContainer').style.display = 'none';

    archivosSeleccionados = [];
    imagenesBase64Data = [];

    limpiarFirmaSub();

    const datosMaterialesGuardadosFallback = currentJobInfo.description ? extraerDatosMaterialesFallback(currentJobInfo.description) : {};

    document.getElementById('evComment').value = "";

    materialesEstadoEmpleado = {};
    if (document.getElementById('searchMaterialInput')) document.getElementById('searchMaterialInput').value = '';
    if (document.getElementById('filterCategoryMaterial')) document.getElementById('filterCategoryMaterial').value = '';

    limpiarMaterialesNecesariosEmpleado();

    allMaterialsCache.forEach(mat => {
        const matId = mat.materialId;
        const matGuardado = (currentJobInfo && currentJobInfo.materials) ? currentJobInfo.materials.find(m => m.materialId == matId) : null;
        const nombreMat = (mat.name || '').toLowerCase().trim();
        const fallbackInfo = datosMaterialesGuardadosFallback[nombreMat];

        if (matGuardado || fallbackInfo) {
            let finalQty = (matGuardado && matGuardado.quantity != null) ? matGuardado.quantity : (fallbackInfo ? fallbackInfo.qty : '');
            let finalUnit = (matGuardado && matGuardado.unit != null) ? matGuardado.unit : (fallbackInfo ? fallbackInfo.unit : '');

            if (finalUnit === 'N/A' || finalUnit === 'undefined') finalUnit = '';
            if (finalQty === 'undefined' || finalQty == 0) finalQty = '';

            materialesEstadoEmpleado[matId] = { checked: true };
            agregarMaterialNecesarioEmpleado(matId, mat.name, mat.price || 0, finalQty, finalUnit);
        }
    });

    renderizarMaterialesEmpleado(allMaterialsCache);

    document.getElementById('modalEvidence').style.display = 'flex';

    setTimeout(() => {
        if (canvasSub) { canvasSub.width = canvasSub.offsetWidth; canvasSub.height = canvasSub.offsetHeight; }
    }, 100);
};

window.cerrarModalEvidence = () => { document.getElementById('modalEvidence').style.display = 'none'; };

window.inicializarCanvasFirma = () => {
    canvasSub = document.getElementById('signaturePadSub');
    if (canvasSub) ctxSub = canvasSub.getContext('2d');

    setTimeout(() => {
        if (canvasSub) { canvasSub.width = canvasSub.offsetWidth; canvasSub.height = canvasSub.offsetHeight; }
    }, 200);

    if (canvasSub) setupCanvasEvents(canvasSub, ctxSub, (val) => drawingSub = val, '#0F2D4A');
};

function setupCanvasEvents(canvasObj, ctxObj, setDrawing, colorStroke) {
    const startPos = (e) => { setDrawing(true); draw(e); };
    const endPos = () => { setDrawing(false); ctxObj.beginPath(); };
    const draw = (e) => {
        if (!drawingSub) return;
        e.preventDefault();
        ctxObj.lineWidth = 2.5;
        ctxObj.lineCap = "round";
        ctxObj.strokeStyle = colorStroke;

        let x = e.clientX || (e.touches && e.touches[0].clientX);
        let y = e.clientY || (e.touches && e.touches[0].clientY);
        const rect = canvasObj.getBoundingClientRect();
        x = x - rect.left; y = y - rect.top;

        ctxObj.lineTo(x, y); ctxObj.stroke(); ctxObj.beginPath(); ctxObj.moveTo(x, y);
    };

    canvasObj.addEventListener('mousedown', startPos);
    canvasObj.addEventListener('mouseup', endPos);
    canvasObj.addEventListener('mousemove', draw);
    canvasObj.addEventListener('touchstart', startPos, { passive: false });
    canvasObj.addEventListener('touchend', endPos);
    canvasObj.addEventListener('touchmove', draw, { passive: false });
}

window.limpiarFirmaSub = () => { if (ctxSub) ctxSub.clearRect(0, 0, canvasSub.width, canvasSub.height); };

window.mostrarPreview = (event) => {
    const input = event.target;
    if (input.files) {
        Array.from(input.files).forEach(file => { archivosSeleccionados.push(file); });
    }
    input.value = '';
    renderizarGaleriaFotos();
};

function renderizarGaleriaFotos() {
    const previewContainer = document.getElementById('imagePreviewContainer');
    previewContainer.innerHTML = '';
    imagenesBase64Data = [];

    archivosSeleccionados.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const b64 = e.target.result;
            imagenesBase64Data[index] = b64;

            const imgDiv = document.createElement('div');
            imgDiv.style.position = 'relative';
            imgDiv.style.display = 'inline-block';

            const img = document.createElement('img');
            img.src = b64;
            img.className = 'preview-img';

            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-delete-photo';
            btnDelete.innerHTML = '✕';
            btnDelete.onclick = (e) => {
                e.preventDefault();
                eliminarFoto(index);
            };

            imgDiv.appendChild(img);
            imgDiv.appendChild(btnDelete);
            previewContainer.appendChild(imgDiv);
        }
        reader.readAsDataURL(file);
    });
}

window.eliminarFoto = (index) => {
    archivosSeleccionados.splice(index, 1);
    renderizarGaleriaFotos();
};

window.guardarReporteYPdf = async () => {
    const status = document.getElementById('evStatus').value;
    let comment = document.getElementById('evComment').value.trim();

    if (status === 'COMPLETED' && !document.getElementById('evCertification').checked) {
        return Swal.fire({ icon: 'warning', title: 'Certificación Obligatoria', text: 'Para terminar el proyecto debes marcar la casilla de Certificación.', confirmButtonColor: '#00B8A9' });
    }

    const isCanvasBlank = (c) => {
        if (!c) return true;
        const blank = document.createElement('canvas');
        blank.width = c.width; blank.height = c.height;
        return c.toDataURL() === blank.toDataURL();
    };

    if (isCanvasBlank(canvasSub)) {
        return Swal.fire({ icon: 'warning', title: 'Falta tu Firma', text: 'Debes firmar el reporte.', confirmButtonColor: '#12CFF4' });
    }
    
    if (archivosSeleccionados.length === 0) return Swal.fire({ icon: 'warning', title: 'Faltan fotos', text: 'Debes adjuntar al menos una imagen.', confirmButtonColor: '#00B8A9' });

    const idsOriginales = (currentJobInfo.materials || []).map(m => m.materialId);

    const selectedRows = document.querySelectorAll('.necessary-material-row-emp');
    const selectedMaterials = [];
    const selectedMaterialIds = [];
    let resumenMaterialesBD = '';
    let pdfMaterialsRows = '';
    let totalMateriales = 0;
    let materialesNuevos = [];

    selectedRows.forEach(row => {
        const matId = parseInt(row.id.replace('nec-emp-', ''));
        const nombreMat = row.querySelector('div').textContent.trim();

        const priceMatch = row.textContent.match(/\$([\d.]+)/);
        const precioUnit = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0;

        const qtyInput = row.querySelector('.nec-emp-qty');
        const unitInput = row.querySelector('.nec-emp-unit');
        const cantidadStr = qtyInput ? qtyInput.value.trim() : '';
        const unidad = unitInput ? unitInput.value.trim() : '';

        const cantidadNum = cantidadStr ? parseFloat(cantidadStr) : 0;
        const subtotal = cantidadNum * precioUnit;
        totalMateriales += subtotal;

        selectedMaterials.push({
            materialId: matId,
            quantity: cantidadNum,
            unit: unidad || 'N/A'
        });
        selectedMaterialIds.push(matId);

        const esNuevo = !idsOriginales.includes(matId);
        const textoCantidad = cantidadStr ? `${cantidadStr} ${unidad}`.trim() : 'Asignado';

        if (esNuevo) {
            materialesNuevos.push(`${nombreMat} (${textoCantidad})`);
            resumenMaterialesBD += `• 🆕 ${nombreMat}: ${textoCantidad} [MATERIAL NUEVO]\n`;
        } else {
            resumenMaterialesBD += `• ${nombreMat}: ${textoCantidad}\n`;
        }

        pdfMaterialsRows += `
        <tr style="${esNuevo ? 'background: #FFF3CD;' : ''}">
            <td style="padding: 8px; border: 1px solid #ddd; color: #2E3238; ${esNuevo ? 'font-weight:bold; color:#92400E;' : ''}">
                ${esNuevo ? 'NEW ' : ''}${nombreMat}
            </td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #2E3238;">${textoCantidad}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #2E3238;">$${precioUnit.toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #198754;">$${subtotal.toFixed(2)}</td>
        </tr>
    `;
    });

    const nuevoPrecioValor = totalMateriales;
    const hasModifications = document.getElementById('evModifications').checked;

    if (materialesNuevos.length > 0) {
        comment = `⚠️ [ALERTA DE OFICINA]: Se agregaron materiales nuevos no asignados originalmente: ${materialesNuevos.join(', ')}.\n\n` + comment;
        document.getElementById('pdfNewPriceRow').style.display = 'table-row';
        document.getElementById('pdfNewPrice').textContent = `Materiales nuevos: ${materialesNuevos.join(', ')}`;
    } else if (hasModifications) {
        comment = `⚠️ [ALERTA DE OFICINA]: Se hicieron modificaciones a la orden original que requieren revisión del Manager.\n\n` + comment;
        document.getElementById('pdfNewPriceRow').style.display = 'table-row';
        document.getElementById('pdfNewPrice').textContent = `REQUIERE REVISIÓN DEL MANAGER`;
    } else {
        document.getElementById('pdfNewPriceRow').style.display = 'none';
    }

    Swal.fire({ title: 'Procesando...', text: 'Generando archivo PDF y guardando avance...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    const pagoSeguroPDF = nuevoPrecioValor;

    document.getElementById('pdfJobName').textContent = currentJobInfo.clientName || 'Sin asignar';
    document.getElementById('pdfAddress').textContent = currentJobInfo.address || 'Sin dirección';
    document.getElementById('pdfClientPhone').textContent = currentJobInfo.clientPhone || 'No registrado';
    document.getElementById('pdfEmployee').textContent = document.getElementById('employee-email-display').textContent;
    document.getElementById('pdfJobPay').textContent = `$${pagoSeguroPDF.toFixed(2)}`;
    document.getElementById('pdfStatus').textContent = status === 'COMPLETED' ? 'Completado' : 'En Progreso';

    const hoy = new Date();
    document.getElementById('pdfDate').textContent = `${String(hoy.getMonth() + 1).padStart(2, '0')}/${String(hoy.getDate()).padStart(2, '0')}/${hoy.getFullYear()}`;
    document.getElementById('pdfComment').textContent = comment;

    document.getElementById('pdfMaterialsBody').innerHTML = pdfMaterialsRows !== ''
        ? pdfMaterialsRows
        : `<tr><td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #666;">No se reportaron materiales.</td></tr>`;
    document.getElementById('pdfTotalMateriales').textContent = `$${totalMateriales.toFixed(2)}`;
    document.getElementById('pdfTotalGeneral').textContent = `$${pagoSeguroPDF.toFixed(2)}`;
    document.getElementById('pdfGuaranteeBox').style.display = status === 'COMPLETED' ? 'block' : 'none';

    document.getElementById('pdfImages').innerHTML = imagenesBase64Data.map(b64 => `
        <div style="display: inline-block; width: 210px; margin: 8px; page-break-inside: avoid; border: 1px solid #E2E8F0; border-radius: 8px; padding: 5px; background: #ffffff; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <img src="${b64}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 6px;">
        </div>
    `).join('');

    const imgFirma = document.getElementById('pdfSignatureSubImg');
    imgFirma.src = canvasSub.toDataURL("image/png");
    imgFirma.style.width = "250px";
    imgFirma.style.height = "75px";

    const pdfWrapper = document.getElementById('pdfWrapper');
    const pdfTemplate = document.getElementById('pdfTemplate');

    window.scrollTo(0, 0);

    pdfWrapper.style.display = 'block';
    pdfWrapper.style.position = 'fixed';
    pdfWrapper.style.top = '0';
    pdfWrapper.style.left = '-9999px';
    pdfWrapper.style.width = '750px';
    pdfWrapper.style.zIndex = '-1';
    pdfWrapper.style.visibility = 'visible';

    await new Promise(r => setTimeout(r, 600));

    const safeName = (currentJobInfo.clientName || 'Trabajo').replace(/[^a-zA-Z0-9]/g, '_');
    const nombreArchivoPDF = `Reporte_${safeName}.pdf`;

    const opt = {
        margin: [10, 10, 10, 10],
        filename: nombreArchivoPDF,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['tr', 'h3', 'img', '.avoid-break']
        }
    };

    let pdfBlob;
    try {
        pdfBlob = await html2pdf().set(opt).from(pdfTemplate).output('blob');

        if (esIOS()) {
            await manejarDescargaPDF(pdfBlob, nombreArchivoPDF);
        } else {
            html2pdf().set(opt).from(pdfTemplate).save();
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');
        }

    } catch (e) {
        console.error("Error al hacer el PDF:", e);
        pdfWrapper.style.display = 'none';
        return Swal.fire({ icon: 'error', title: 'Error del PDF', text: 'No se pudo generar el documento PDF.' });
    }

    pdfWrapper.style.display = 'none';
    pdfWrapper.style.visibility = 'hidden';

    const dtoObject = {
        comment: comment,
        jobId: parseInt(currentJobInfo.jobId),
        employeeId: myEmployeeId,
        status: status,
        materials: selectedMaterials,
        materialIds: selectedMaterialIds,
        newPrice: nuevoPrecioValor
    };
    if (nuevoPrecioValor !== null) {
        dtoObject.newPrice = nuevoPrecioValor;
    }

    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(dtoObject)], { type: 'application/json' }));

    for (let i = 0; i < archivosSeleccionados.length; i++) {
        formData.append('files', archivosSeleccionados[i]);
    }
    formData.append('files', pdfBlob, nombreArchivoPDF);

    try {
        const response = await fetch(UPDATE_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: 'El reporte se subió y el PDF fue guardado.',
                confirmButtonColor: '#00B8A9'
            }).then(() => {
                cerrarModalEvidence();
                window.location.reload();
            });
        } else {
            let errorText = await response.text();
            try {
                const jsonError = JSON.parse(errorText);
                errorText = jsonError.message || 'Error del servidor';
            } catch (e) { }

            console.error("Error exacto del servidor:", errorText);
            Swal.fire({ icon: 'error', title: 'Fallo al Guardar', html: `Java respondió: <br> ${errorText}`, confirmButtonColor: '#00B8A9' });
        }
    } catch (error) {
        console.error("Problema de conexión:", error);
        Swal.fire({ icon: 'error', title: 'Error de Red', text: 'Verifica tu conexión a internet o el estado del servidor.', confirmButtonColor: '#00B8A9' });
    }
};

function esIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

async function manejarDescargaPDF(pdfBlob, nombreArchivo) {
    if (esIOS()) {
        try {
            const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: nombreArchivo });
                return;
            }
        } catch (e) {
            console.warn('No se pudo compartir el PDF:', e);
        }

        const pdfUrl = URL.createObjectURL(pdfBlob);
        Swal.fire({
            icon: 'success',
            title: '¡Reporte generado!',
            text: 'Toca el botón para ver o guardar tu PDF.',
            confirmButtonText: 'Abrir PDF',
            confirmButtonColor: '#00B8A9'
        }).then((result) => {
            if (result.isConfirmed) {
                window.open(pdfUrl, '_blank');
            }
        });
    } else {
        html2pdf().set(opt).from(pdfTemplate).save();
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
    }
}

window.cerrarSesion = () => {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del portal?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#00B8A9",
        cancelButtonColor: "#1B254B",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../index.html';
        }
    });
};

window.abrirModalPerfil = () => {
    if (!miUsuarioActual) { return Swal.fire('Error', 'Cargando datos...', 'error'); }
    document.getElementById('perfilFirstName').value = miUsuarioActual.firstName || '';
    document.getElementById('perfilLastName').value = miUsuarioActual.lastName || '';
    document.getElementById('perfilDni').value = miUsuarioActual.dni || '';
    document.getElementById('perfilPhone').value = miUsuarioActual.phone || '';
    document.getElementById('perfilEmail').value = miUsuarioActual.email || '';
    document.getElementById('perfilPassword').value = '';
    document.getElementById('modalPerfil').style.display = 'flex';
};

window.cerrarModalPerfil = () => { document.getElementById('modalPerfil').style.display = 'none'; };

window.guardarPerfil = async () => {
    const payload = {
        firstName: document.getElementById('perfilFirstName').value.trim(),
        middleName: miUsuarioActual.middleName || "",
        lastName: document.getElementById('perfilLastName').value.trim(),
        secondSurname: miUsuarioActual.secondSurname || "",
        dni: document.getElementById('perfilDni').value.trim(),
        phone: document.getElementById('perfilPhone').value.trim(),
        email: document.getElementById('perfilEmail').value.trim(),
        password: document.getElementById('perfilPassword').value,
        dateOfBirth: miUsuarioActual.dateOfBirth,
        title: miUsuarioActual.title || "Empleado"
    };

    if (!payload.firstName || !payload.lastName || !payload.dni || !payload.phone || !payload.email) {
        return Swal.fire('Atención', 'Por favor llena todos los campos obligatorios.', 'warning');
    }

    Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const response = await fetch(`${USER_API_URL}/edit-user/${miUsuarioActual.userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            miUsuarioActual = updatedUser;
            document.getElementById('employee-email-display').textContent = `${updatedUser.firstName} ${updatedUser.lastName}`;
            cerrarModalPerfil();
            Swal.fire({ icon: 'success', title: '¡Actualizado!', confirmButtonColor: '#00B8A9', timer: 1500 });
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar.', confirmButtonColor: '#00B8A9' });
        }
    } catch (error) { Swal.fire('Error de red', 'Fallo de conexión.', 'error'); }
};