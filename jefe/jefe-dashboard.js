let miUsuarioActual = null;
const USERS_URL = 'https://api-rojas-remodeling.onrender.com/api/v1/user';

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    let userEmail = localStorage.getItem('user_email') || '';

    // Validación de seguridad para que solo entre el Jefe
    if (!token || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo Jefes de obra pueden acceder a esta sección.',
            confirmButtonColor: '#12CFF4',
            allowOutsideClick: false
        }).then(() => {
            window.location.href = '../index.html';
        });
        return;
    }

    // Buscamos la info completa del Jefe en la base de datos para mostrar su nombre real
    try {
        const response = await fetch(`${USERS_URL}/all-users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const users = await response.json();
            const emailLimpio = userEmail.replace(/['"]/g, '').trim().toLowerCase();
            miUsuarioActual = users.find(u => u.email && u.email.trim().toLowerCase() === emailLimpio);

            if (miUsuarioActual) {
                document.getElementById('jefe-email-display').textContent = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`;
            } else {
                document.getElementById('jefe-email-display').textContent = userEmail;
            }
        }
    } catch (error) {
        console.error("Error obteniendo los datos del perfil:", error);
    }

    // Enlazamos botones
    const btnPerfilJefe = document.getElementById('btnPerfilJefe');
    if (btnPerfilJefe) btnPerfilJefe.addEventListener('click', abrirModalPerfil);
    const btnCerrarModalTop = document.getElementById('btnCerrarModalTop');
    if (btnCerrarModalTop) btnCerrarModalTop.addEventListener('click', cerrarModalPerfil);
    const btnCerrarModalBot = document.getElementById('btnCerrarModalBot');
    if (btnCerrarModalBot) btnCerrarModalBot.addEventListener('click', cerrarModalPerfil);
    const btnGuardarPerfil = document.getElementById('btnGuardarPerfil');
    if (btnGuardarPerfil) btnGuardarPerfil.addEventListener('click', guardarPerfil);
    const btnSalir = document.getElementById('btnSalir');
    if (btnSalir) btnSalir.addEventListener('click', cerrarSesion);
});

// --- FUNCIONES DEL PERFIL ---

function abrirModalPerfil() {
    if (!miUsuarioActual) {
        return Swal.fire('Error', 'Cargando datos, por favor espera un momento o refresca la página.', 'error');
    }

    document.getElementById('perfilFirstName').value = miUsuarioActual.firstName || '';
    document.getElementById('perfilLastName').value = miUsuarioActual.lastName || '';
    document.getElementById('perfilDni').value = miUsuarioActual.dni || '';
    document.getElementById('perfilPhone').value = miUsuarioActual.phone || '';
    document.getElementById('perfilEmail').value = miUsuarioActual.email || '';
    document.getElementById('perfilPassword').value = '';
    document.getElementById('modalPerfil').style.display = 'flex';
}

function cerrarModalPerfil() { document.getElementById('modalPerfil').style.display = 'none'; }

async function guardarPerfil() {
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
        title: miUsuarioActual.title || "Jefe"
    };

    if (!payload.firstName || !payload.lastName || !payload.dni || !payload.phone || !payload.email) {
        return Swal.fire('Atención', 'Por favor llena todos los campos obligatorios.', 'warning');
    }

    Swal.fire({ title: 'Actualizando tu perfil...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const token = localStorage.getItem('jwt_token');
        const response = await fetch(`${USERS_URL}/edit-user/${miUsuarioActual.userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            miUsuarioActual = updatedUser;
            document.getElementById('jefe-email-display').textContent = `${updatedUser.firstName} ${updatedUser.lastName}`;
            cerrarModalPerfil();
            Swal.fire({ icon: 'success', title: '¡Perfil Actualizado!', confirmButtonColor: '#12CFF4', timer: 2000, showConfirmButton: false });
        } else {
            let errorMsg = 'No se pudo actualizar el perfil.';
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData === 'object') errorMsg = Object.values(errorData).join('<br>');
                else if (errorData && errorData.message) errorMsg = errorData.message;
            } catch (e) { }
            Swal.fire({ icon: 'error', title: 'Error', html: errorMsg, confirmButtonColor: '#12CFF4' });
        }
    } catch (error) { Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo contactar al servidor.', confirmButtonColor: '#12CFF4' }); }
}

function cerrarSesion() {
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
            confirmButtonColor: "#12CFF4",
            denyButtonColor: "#00B8A9", // Color secundario turquesa
            cancelButtonColor: "#2E3238",
            confirmButtonText: "Sí, salir",
            denyButtonText: "Cambiar de Rol",
            cancelButtonText: "Cancelar"
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = '../index.html';
            } else if (result.isDenied) {
                mostrarSelectorDeRolesDesdeJefe(userRoles, false);
            }
        });
    } else {
        Swal.fire({
            title: "¿Cerrar sesión?",
            text: "¿Estás seguro que deseas salir del portal?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#12CFF4",
            cancelButtonColor: "#2E3238",
            confirmButtonText: "Sí, salir",
            cancelButtonText: "Cancelar"
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = '../index.html';
            }
        });
    }
}
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

// --- RESUMEN DE BODEGA (GLOBAL: todos los managers, con navegación día por día) ---
let bodegaJobsCache = null;
let bodegaUsersCache = null;
let bodegaMaterialsCache = null;   // ← NUEVO
let bodegaDiaOffset = 0;

window.verBodegaHoy = async () => {
    Swal.fire({ title: 'Cargando ordenes de bodega...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const token = localStorage.getItem('jwt_token');

        const [jobsRes, usersRes, matsRes] = await Promise.all([
            fetch('https://api-rojas-remodeling.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-rojas-remodeling.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-rojas-remodeling.onrender.com/api/v1/materials/all', { headers: { 'Authorization': `Bearer ${token}` } })  // ← NUEVO
        ]);

        bodegaJobsCache = await jobsRes.json();
        bodegaUsersCache = await usersRes.json();
        bodegaMaterialsCache = await matsRes.json();   // ← NUEVO

        bodegaDiaOffset = 0;

        Swal.fire({
            title: '<i class="fa-solid fa-truck-fast" style="color:#F4A300;"></i> Ordenes de Bodega',
            html: '<div id="bodega-contenedor">Generando reporte...</div>',
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: '800px',
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

// 🔥 Construye la tarjeta/hoja de un solo trabajo (reutilizada en pantalla y en el PDF)
function construirBloqueJobBodega(job) {
    const empleado = bodegaUsersCache.find(u => u.userId == job.employeeId);
    const nombreEmpleado = empleado
        ? `${empleado.firstName} ${empleado.lastName}`
        : `ID: ${job.employeeId}`;

    const nombreManager = job.nameManager || 'Sin manager asignado';

    let statusBadge = '';
    if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Pendiente</span>`;
    else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">En Progreso</span>`;
    else if (job.status === 'COMPLETED') statusBadge = `<span style="background: #E8F5E9; color: #2e7d32; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Completado</span>`;
    else statusBadge = `<span style="background: #FFEBEE; color: #d32f2f; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Cancelado</span>`;

    let descBodega = job.description ? job.description : '';
    if (descBodega.includes('[MATERIALES PRE-ASIGNADOS]:')) {
        descBodega = descBodega.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
    }

    // Helper: SIEMPRE coge la unidad de la base de datos
    const obtenerUnidadDeBase = (materialId, unitDelJob) => {
        const matInfo = (bodegaMaterialsCache || []).find(m => m.materialId == materialId);
        if (matInfo && matInfo.unit) return matInfo.unit;
        // Último recurso: lo que venga en el job (nunca del nombre)
        return (unitDelJob && unitDelJob !== 'N/A') ? unitDelJob : '';
    };

    const materialesCombinados = {};

    (job.materials || []).forEach(mat => {
        const nombre = mat.name || mat.material || 'Material';
        materialesCombinados[mat.materialId] = {
            name: nombre,
            quantity: parseFloat(mat.quantity || mat.cant || 1),
            unit: obtenerUnidadDeBase(mat.materialId, mat.unit),
            origen: 'Pre-asignado'
        };
    });

    (job.necessaryMaterials || []).forEach(mat => {
        const id = mat.materialId;
        const nombre = mat.name || 'Material';
        const unidadBase = obtenerUnidadDeBase(id, mat.unit);

        if (materialesCombinados[id]) {
            materialesCombinados[id].quantity = parseFloat(mat.quantity || 1);
            if (unidadBase) {
                materialesCombinados[id].unit = unidadBase;
            }
        } else {
            materialesCombinados[id] = {
                name: nombre,
                quantity: parseFloat(mat.quantity || 1),
                unit: unidadBase,
                origen: 'Agregado por subcontratista'
            };
        }
    });

    const listaMateriales = Object.values(materialesCombinados);

    let html = `
        <div style="padding: 14px; border-bottom: 1px solid #eee; background: #f8faff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
                <strong style="color: #0F2D4A;">${job.clientName || 'Cliente sin nombre'}</strong>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${statusBadge}
                    <span style="color: #F4A300; font-weight: bold;">${nombreEmpleado}</span>
                </div>
            </div>
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #0f4c81; font-weight: 600;">
                <i class="fa-solid fa-user-shield"></i> Manager: ${nombreManager}
            </p>
            ${descBodega ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #777; font-style: italic;">${descBodega}</p>` : ''}`;

    if (listaMateriales.length > 0) {
        html += `<ul style="padding-left: 20px; margin: 6px 0;">`;
        listaMateriales.forEach(mat => {
            const etiquetaOrigen = mat.origen === 'Agregado por subcontratista'
                ? `<span style="color:#e65100; font-size:11px; font-weight:600;"> (agregado por subcontratista)</span>`
                : '';

            const textoUnidad = mat.unit ? ` ${mat.unit}` : '';

            html += `<li><strong>${mat.name}</strong> — ${mat.quantity}${textoUnidad}${etiquetaOrigen}</li>`;
        });
        html += `</ul>`;
    } else {
        html += `<p style="color:#999; font-size:13px;">Sin materiales registrados</p>`;
    }

    html += `</div>`;
    return html;
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

    // 🔥 GLOBAL: ya no filtramos por manager, entran los trabajos de TODOS los jefes
    const itemsDelDia = bodegaJobsCache.filter(job => {
        if (!['PENDING', 'IN_PROGRESS'].includes(job.status)) return false;

        let jobDateStr = Array.isArray(job.jobDate)
            ? `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2, '0')}-${String(job.jobDate[2]).padStart(2, '0')}`
            : job.jobDate;

        return jobDateStr === fechaStrFiltro;
    });

    if (itemsDelDia.length === 0) {
        htmlContent += `<p style="color:#888; font-style:italic; padding:10px; text-align:center;">No hay trabajos programados para este día.</p>`;
    } else {
        htmlContent += `<div id="bodega-lista-dia" style="max-height: 450px; overflow-y: auto; border: 1px solid #D4D4D4; border-radius: 8px;">`;

        window.bodegaItemsDelDiaCache = itemsDelDia; // 🔥 guardamos para el PDF

        itemsDelDia.forEach(job => {
            htmlContent += construirBloqueJobBodega(job);
        });

        htmlContent += `</div>`;
    }

    const contenedor = document.getElementById('bodega-contenedor');
    if (contenedor) contenedor.innerHTML = htmlContent;
}

// ==================== EXPORTAR PDF (una hoja por cada trabajo) ====================
window.exportarBodegaPdf = () => {
    const items = window.bodegaItemsDelDiaCache;
    if (!items || items.length === 0) {
        return Swal.fire('Error', 'No hay trabajos para exportar en este día.', 'error');
    }

    const lblFecha = document.getElementById('lblFechaBodega');
    const textoFecha = lblFecha ? lblFecha.textContent.trim() : new Date().toISOString().split('T')[0];
    const nombreArchivoClean = textoFecha.replace(/[\/]/g, '-');

    const contenedorImpresion = document.createElement('div');
    contenedorImpresion.style.fontFamily = "'Poppins', sans-serif";
    contenedorImpresion.style.background = "#ffffff";

    const paginas = items.map((job, idx) => {
        const esUltimo = idx === items.length - 1;
        return `
            <div class="job-pdf-page" style="padding: 30px; ${esUltimo ? '' : 'page-break-after: always;'}">
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #12CFF4; padding-bottom: 15px;">
                    <h1 style="color: #0B0B0D; margin: 0;">ORDEN DE BODEGA</h1>
                    <p style="margin: 8px 0 0 0; color: #12CFF4; font-weight: bold;">Copia de trabajo — Subcontratista</p>
                    <p style="margin: 5px 0 0 0; color: #555;">${textoFecha}</p>
                </div>
                ${construirBloqueJobBodega(job)}
                <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
                    Reporte generado por el Portal RemoMN
                </div>
            </div>
        `;
    });

    contenedorImpresion.innerHTML = paginas.join('');

    const opt = {
        margin: [15, 15, 15, 15],
        filename: `Ordenes_Bodega_${nombreArchivoClean}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    Swal.fire({ title: 'Generando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    html2pdf().set(opt).from(contenedorImpresion).save()
        .then(() => Swal.close())
        .catch(() => Swal.fire('Error', 'No se pudo generar el PDF', 'error'));
};

// =================================================================================
// --- NÓMINA QUINCENAL (igual que Admin, pero solo del Manager actual) ---
// =================================================================================
window.nominasJobsCache = null;
window.nominasUsersCache = null;
window.quincenaOffset = 0;

window.verNominaSemanal = async () => {
    Swal.fire({ title: 'Obteniendo registros...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const token = localStorage.getItem('jwt_token');

        const [resJobs, resUsers] = await Promise.all([
            fetch('https://api-rojas-remodeling.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-rojas-remodeling.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        window.nominasJobsCache = await resJobs.json();
        window.nominasUsersCache = await resUsers.json();

        window.quincenaOffset = 0; // Reiniciar a la quincena actual

        Swal.fire({
            title: '<h2 style="color: #0F2D4A; font-weight: 800; margin: 0; display: flex; align-items: center; justify-content: center;"><span style="background: #12CFF4; color: #FFFFFF; padding: 4px 10px; border-radius: 8px; font-size: 0.7em; margin-right: 12px;"><i class="fa-solid fa-money-check-dollar"></i></span>Tu Nómina Quincenal</h2>',
            html: '<div id="nomina-contenedor">Generando reporte...</div>',
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: '600px',
            background: '#FFFFFF'
        });

        renderizarNomina(window.quincenaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo calcular la nómina. Revisa tu conexión.', confirmButtonColor: '#12CFF4' });
    }
};

window.cambiarSemana = (delta) => {
    window.quincenaOffset += delta;
    renderizarNomina(window.quincenaOffset);
};

function renderizarNomina(offset) {
    // Misma lógica de quincenas que Admin
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let part = new Date().getDate() <= 15 ? 1 : 2;

    if (offset > 0) {
        for (let i = 0; i < offset; i++) {
            if (part === 1) part = 2;
            else { part = 1; month++; if (month > 11) { month = 0; year++; } }
        }
    } else if (offset < 0) {
        for (let i = 0; i > offset; i--) {
            if (part === 2) part = 1;
            else { part = 2; month--; if (month < 0) { month = 11; year--; } }
        }
    }

    let inicioSemana, finSemana;
    if (part === 1) {
        inicioSemana = new Date(year, month, 1, 0, 0, 0, 0);
        finSemana = new Date(year, month, 15, 23, 59, 59, 999);
    } else {
        inicioSemana = new Date(year, month, 16, 0, 0, 0, 0);
        finSemana = new Date(year, month + 1, 0, 23, 59, 59, 999);
    }

    // Solo trabajos de ESTE Manager
    const miId = miUsuarioActual ? miUsuarioActual.userId : null;
    const jefeNombreCompleto = miUsuarioActual
        ? `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`.trim().toLowerCase()
        : '';

    let nominas = {};

    (window.nominasJobsCache || []).forEach(job => {
        if (job.status !== 'COMPLETED' || !job.employeeId) return;

        // Filtro por Manager (id o nombre)
        const jobManagerName = (job.nameManager || '').trim().toLowerCase();
        const esDeEsteJefe = (job.managerId == miId) || (jobManagerName === jefeNombreCompleto);
        if (!esDeEsteJefe) return;

        // Fecha normalizada (igual que Admin)
        let jobDateStr = Array.isArray(job.jobDate)
            ? `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2, '0')}-${String(job.jobDate[2]).padStart(2, '0')}`
            : job.jobDate;

        const jobDate = new Date(jobDateStr);
        if (isNaN(jobDate.getTime())) return;
        jobDate.setHours(12, 0, 0, 0);

        if (jobDate >= inicioSemana && jobDate <= finSemana) {
            if (!nominas[job.employeeId]) nominas[job.employeeId] = 0;
            nominas[job.employeeId] += (job.pay || 0);
        }
    });

    // Formato MM/DD/YYYY (igual que Admin)
    const formatMDY = (d) => `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
    const strInicio = formatMDY(inicioSemana);
    const strFin = formatMDY(finSemana);

    let htmlContent = `
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; background: #F4F7FE; padding: 12px; border-radius: 12px; border: 1px solid #12CFF4; margin-bottom: 15px;">
        <button onclick="cambiarSemana(-1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
            <i class="fa-solid fa-chevron-left"></i> Anterior
        </button>

        <div style="text-align: center; flex: 1; min-width: 140px;">
            <span style="display: block; font-size: 10px; color: #2E3238; text-transform: uppercase; font-weight: bold;">Quincena del</span>
            <span id="lblRangoNomina" style="font-size: 13px; color: #0F2D4A;"><b>${strInicio}</b> al <b>${strFin}</b></span>
        </div>

        <button type="button" onclick="exportarNominaJefePdf()" style="background: #d32f2f; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px;">
            <i class="fa-solid fa-file-pdf"></i> PDF
        </button>

        <button onclick="cambiarSemana(1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
            Siguiente <i class="fa-solid fa-chevron-right"></i>
        </button>
    </div>

    <div id="tabla-nomina-jefe" style="max-height: 250px; overflow-y: auto; border-radius: 8px; border: 1px solid #D4D4D4;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: 'Poppins', sans-serif;">
            <tr style="background-color: #0F2D4A; color: #FFFFFF; position: sticky; top: 0; z-index: 10;">
                <th style="padding: 15px; font-weight: 700;">Subcontratista a tu cargo</th>
                <th style="padding: 15px; text-align: right; font-weight: 700;">Total a Pagar</th>
            </tr>
    `;

    let totalNomina = 0;
    let hayDatos = false;

    for (let empId in nominas) {
        hayDatos = true;
        const emp = (window.nominasUsersCache || []).find(u => u.userId == empId);
        const nombre = emp ? `${emp.firstName} ${emp.lastName}` : `ID: ${empId}`;
        const pago = nominas[empId];
        totalNomina += pago;

        htmlContent += `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #2E3238; font-weight: 500;">${nombre}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #F4A300; font-weight: bold; text-align: right;">$${pago.toFixed(2)}</td>
        </tr>`;
    }

    if (!hayDatos) {
        htmlContent += '<tr><td colspan="2" style="padding: 25px; text-align: center; color: #8a9099; font-style: italic;">No hay trabajos completados por tu personal en esta quincena.</td></tr>';
    } else {
        htmlContent += `<tr style="background-color: #f8faff;">
            <td style="padding: 12px; font-weight: bold; text-align: right; color: #0B0B0D; text-transform: uppercase; font-size: 12px;">Total de tu equipo:</td>
            <td style="padding: 12px; font-weight: bold; color: #2e7d32; font-size: 16px; text-align: right;">$${totalNomina.toFixed(2)}</td>
        </tr>`;
    }
    htmlContent += '</table></div>';

    const contenedor = document.getElementById('nomina-contenedor');
    if (contenedor) contenedor.innerHTML = htmlContent;
}

window.exportarNominaJefePdf = () => {
    const lblRango = document.getElementById('lblRangoNomina');
    const textoRango = lblRango ? lblRango.textContent.trim() : 'Nomina_Quincenal';
    const nombreArchivoClean = textoRango.replace(/[\/]/g, '-').replace(/\s+/g, '_');

    const tablaElemento = document.getElementById('tabla-nomina-jefe');
    if (!tablaElemento) {
        return Swal.fire('Error', 'No hay datos para exportar.', 'error');
    }

    const nombreJefe = miUsuarioActual ? `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}` : 'Manager';

    const contenedorImpresion = document.createElement('div');
    contenedorImpresion.style.padding = '30px 40px';
    contenedorImpresion.style.background = '#ffffff';
    contenedorImpresion.style.fontFamily = "'Poppins', sans-serif";

    contenedorImpresion.innerHTML = `
        <div style="border-bottom: 3px solid #12CFF4; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <img src="../img/logonegro.png" alt="Logo" style="height: 55px; width: auto; object-fit: contain;" onerror="this.src='../../logo.jpeg'">
                <div>
                    <h1 style="color: #0B0B0D; margin: 0; font-size: 22px; font-weight: bold; text-transform: uppercase;">NÓMINA QUINCENAL</h1>
                    <p style="margin: 3px 0 0 0; color: #12CFF4; font-size: 12px; font-weight: bold;">Manager: ${nombreJefe}</p>
                </div>
            </div>
            <div style="text-align: right; color: #2E3238;">
                <p style="margin: 0; font-weight: bold; font-size: 11px; text-transform: uppercase; color: #666;">Período:</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; color: #0F2D4A; font-weight: bold;">${textoRango}</p>
            </div>
        </div>
        <div style="border: 1px solid #D4D4D4; border-radius: 8px; overflow: hidden;">
            ${tablaElemento.innerHTML}
        </div>
        <div style="margin-top: 45px; font-size: 10px; color: #8a9099; text-align: center; border-top: 1px dashed #E0E5F2; padding-top: 10px;">
            Reporte generado por el Portal RemoMN — Área de Manager
        </div>
    `;

    const opt = {
        margin: [12, 12, 12, 12],
        filename: `Nomina_Quincenal_${nombreArchivoClean}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({
        title: 'Generando PDF...',
        text: 'Preparando desglose de la quincena.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    html2pdf().set(opt).from(contenedorImpresion).save()
        .then(() => Swal.close())
        .catch(() => Swal.fire('Error', 'No se pudo generar el PDF.', 'error'));
};


// =================================================================
// --- LÓGICA PARA CAMBIO RÁPIDO DE ROL (MÚLTIPLES ROLES) ---
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Leer los roles del localStorage
    const rolesString = localStorage.getItem('user_roles');
    let userRoles = [];

    if (rolesString) {
        try {
            userRoles = JSON.parse(rolesString);
        } catch (e) {
            console.error("Error al leer roles");
        }
    }

    // 2. Si el botón existe y tiene más de 1 rol, lo mostramos
    const btnCambiarRol = document.getElementById("btnCambiarRol");
    if (btnCambiarRol) {
        if (userRoles.length > 1) {
            btnCambiarRol.style.display = 'inline-block';
            btnCambiarRol.addEventListener("click", () => mostrarSelectorDeRoles(userRoles));
        } else {
            btnCambiarRol.style.display = 'none'; // Se oculta si solo tiene 1 rol
        }
    }
});

function mostrarSelectorDeRoles(roles) {
    // Cerramos el modal del perfil si existe la función
    if (typeof cerrarModalPerfil === 'function') {
        cerrarModalPerfil();
    } else {
        // Fallback genérico por si la función tiene otro nombre en otra vista
        const modales = document.querySelectorAll('.modal-overlay');
        modales.forEach(m => m.style.display = 'none');
    }

    // Armamos los botones según los roles que tenga
    let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';

    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';

        // Asignamos las URLs relativas (funcionan porque todos los dashboards están a 1 carpeta de distancia de la raíz)
        if (rol === 'ROLE_ADMIN') {
            nombreRol = '<i class="fa-solid fa-user-tie"></i> Acceder como Administrador';
            url = '../admin/admin-dashboard.html';
        }
        if (rol === 'ROLE_JEFE') {
            nombreRol = '<i class="fa-solid fa-user-shield"></i> Acceder como Manager';
            url = '../jefe/jefe-dashboard.html';
        }
        if (rol === 'ROLE_EMPLOYEE') {
            nombreRol = '<i class="fa-solid fa-helmet-safety"></i> Acceder como Subcontratista';
            url = '../employee/employee-dashboard.html';
        }

        if (nombreRol) {
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
        cancelButtonColor: '#111C44'
    });
}