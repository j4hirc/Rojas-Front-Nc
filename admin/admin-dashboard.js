let miUsuarioActual = null;
const USERS_URL = "https://api-remomn.onrender.com/api/v1/user";

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("jwt_token");
    const rolesString = localStorage.getItem("user_roles");
    const userEmail = localStorage.getItem("user_email");

    // Validación de seguridad
    if (
        !token ||
        !rolesString ||
        !JSON.parse(rolesString).includes("ROLE_ADMIN")
    ) {
        Swal.fire({
            icon: "error",
            title: "Acceso Denegado",
            text: "No tienes permisos para acceder a este panel.",
            confirmButtonColor: "#12CFF4",
            allowOutsideClick: false,
        }).then(() => {
            window.location.href = "../index.html";
        });
        return;
    }

    try {
        const response = await fetch(`${USERS_URL}/all-users`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
            const users = await response.json();
            // A minúsculas por si acaso
            miUsuarioActual = users.find(
                (u) => u.email.toLowerCase() === userEmail.toLowerCase(),
            );

            if (miUsuarioActual) {
                document.getElementById("admin-email-display").textContent =
                    `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`;
            } else {
                document.getElementById("admin-email-display").textContent = userEmail;
            }
        }
    } catch (error) {
        console.error("Error obteniendo los datos del perfil:", error);
    }

    // =================================================================
    // ENLAZAMOS LOS BOTONES DESDE JAVASCRIPT DIRECTAMENTE
    // =================================================================
    const btnPerfilAdmin = document.getElementById("btnPerfilAdmin");
    if (btnPerfilAdmin)
        btnPerfilAdmin.addEventListener("click", abrirModalPerfil);

    const btnCerrarModalTop = document.getElementById("btnCerrarModalTop");
    if (btnCerrarModalTop)
        btnCerrarModalTop.addEventListener("click", cerrarModalPerfil);

    const btnCerrarModalBot = document.getElementById("btnCerrarModalBot");
    if (btnCerrarModalBot)
        btnCerrarModalBot.addEventListener("click", cerrarModalPerfil);

    const btnGuardarPerfil = document.getElementById("btnGuardarPerfil");
    if (btnGuardarPerfil)
        btnGuardarPerfil.addEventListener("click", guardarPerfil);

    const btnSalir = document.getElementById("btnSalir");
    if (btnSalir) btnSalir.addEventListener("click", cerrarSesion);

    const swalMobileFix = document.createElement('style');
    swalMobileFix.textContent = `
        @media (max-width: 768px) {
            .swal2-popup {
                width: 94vw !important;
                max-width: 94vw !important;
                padding: 14px !important;
                box-sizing: border-box !important;
            }
            .swal2-popup * {
                max-width: 100% !important;
                box-sizing: border-box !important;
            }
            .swal2-html-container {
                overflow-x: hidden !important;
            }
        }
    `;
    document.head.appendChild(swalMobileFix);
});

// --- FUNCIONES PARA EDITAR EL PERFIL ---

function abrirModalPerfil() {
    if (!miUsuarioActual) {
        return Swal.fire(
            "Error",
            "No se pudieron cargar tus datos. Refresca la página.",
            "error",
        );
    }

    // Llenamos el formulario con los datos actuales
    document.getElementById("perfilFirstName").value =
        miUsuarioActual.firstName || "";
    document.getElementById("perfilLastName").value =
        miUsuarioActual.lastName || "";
    document.getElementById("perfilDni").value = miUsuarioActual.dni || "";
    document.getElementById("perfilPhone").value = miUsuarioActual.phone || "";
    document.getElementById("perfilEmail").value = miUsuarioActual.email || "";
    document.getElementById("perfilPassword").value = ""; // Siempre vacío por seguridad

    document.getElementById("modalPerfil").style.display = "flex";
}

function cerrarModalPerfil() {
    document.getElementById("modalPerfil").style.display = "none";
}

function esIOSAdmin() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// 🔥 Genera el PDF como blob y lo entrega de forma segura en iOS (sin romper el "atrás")
async function generarYEntregarPDF(opciones, elementoHtml, nombreArchivo) {
    const pdfBlob = await html2pdf().set(opciones).from(elementoHtml).output('blob');

    if (esIOSAdmin()) {
        try {
            const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: nombreArchivo });
                return;
            }
        } catch (e) {
            console.warn('No se pudo compartir el PDF:', e);
        }

        // Fallback: mostramos un botón, el usuario decide abrirlo en pestaña NUEVA
        const pdfUrl = URL.createObjectURL(pdfBlob);
        Swal.fire({
            icon: 'success',
            title: '¡PDF generado!',
            text: 'Toca el botón para ver o guardar tu documento.',
            confirmButtonText: 'Abrir PDF',
            confirmButtonColor: '#12CFF4'
        }).then((result) => {
            if (result.isConfirmed) {
                window.open(pdfUrl, '_blank');
            }
        });
    } else {
        // Escritorio / Android: comportamiento normal
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        Swal.close();
    }
}

async function guardarPerfil() {
    // ESTOS SON TODOS LOS DATOS QUE TU BACKEND ESPERA (Incluyendo ocultos)
    const payload = {
        firstName: document.getElementById("perfilFirstName").value.trim(),
        middleName: miUsuarioActual.middleName || "",
        lastName: document.getElementById("perfilLastName").value.trim(),
        secondSurname: miUsuarioActual.secondSurname || "",
        dni: document.getElementById("perfilDni").value.trim(),
        phone: document.getElementById("perfilPhone").value.trim(),
        email: document.getElementById("perfilEmail").value.trim(),
        password: document.getElementById("perfilPassword").value, // El backend lo permite vacío
        dateOfBirth: miUsuarioActual.dateOfBirth,
        title: miUsuarioActual.title || "Administrador",
    };

    if (
        !payload.firstName ||
        !payload.lastName ||
        !payload.dni ||
        !payload.phone ||
        !payload.email
    ) {
        return Swal.fire(
            "Atención",
            "Por favor llena todos los campos obligatorios.",
            "warning",
        );
    }

    Swal.fire({
        title: "Actualizando tu perfil...",
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
    });

    try {
        const token = localStorage.getItem("jwt_token");

        // LA RUTA CORREGIDA HACIA SPRING BOOT: /edit-user/
        const response = await fetch(
            `${USERS_URL}/edit-user/${miUsuarioActual.userId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            },
        );

        if (response.ok) {
            const updatedUser = await response.json();
            miUsuarioActual = updatedUser; // Actualizamos la memoria

            // Reflejamos el cambio de nombre en pantalla inmediatamente
            document.getElementById("admin-email-display").textContent =
                `${updatedUser.firstName} ${updatedUser.lastName}`;

            cerrarModalPerfil();

            Swal.fire({
                icon: "success",
                title: "¡Perfil Actualizado!",
                text: "Tus datos se guardaron correctamente.",
                confirmButtonColor: "#12CFF4",
                timer: 2000,
                showConfirmButton: false,
            });
        } else {
            let errorMsg = "No se pudo actualizar el perfil.";
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData === "object") {
                    errorMsg = Object.values(errorData).join("<br>");
                } else if (errorData && errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) { }
            Swal.fire("Error", errorMsg, "error");
        }
    } catch (error) {
        Swal.fire("Error de red", "No se pudo contactar al servidor.", "error");
    }
}

// =================================================================================
// --- ESTADO GLOBAL DE NÓMINA QUINCENAL ---
// =================================================================================
window.nominasJobsCache = null;
window.nominasUsersCache = null;
window.quincenaOffset = 0; 

// 1. CARGA INICIAL AUTOMÁTICA DEL VALOR DE LA TARJETA EN HOME
async function inicializarNominaAdmin() {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('https://api-remomn.onrender.com/api/v1/jobs/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const trabajos = await res.json();
            let sumaTotal = 0;
            trabajos.forEach(j => {
                if(j.pay && j.status !== 'CANCELLED') sumaTotal += j.pay;
            });
            
            const txtCard = document.getElementById('txtNominaGlobal');
            if(txtCard) txtCard.textContent = `$${sumaTotal.toFixed(2)}`;
        }
    } catch (e) {
        console.error("Error al sincronizar nómina:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarNominaAdmin();
});

// 2. FUNCIÓN PRINCIPAL PARA REVENTAR EL POP-UP
window.verNominaSemanalGlobal = async () => {
    Swal.fire({ title: 'Obteniendo registros globales...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const token = localStorage.getItem('jwt_token') || localStorage.getItem('token');

        const [resJobs, resUsers] = await Promise.all([
            fetch('https://api-remomn.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-remomn.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        window.nominasJobsCache = await resJobs.json();
        window.nominasUsersCache = await resUsers.json();

        window.quincenaOffset = 0; // Reiniciar vista a la quincena actual

        Swal.fire({
            title: '<h2 style="color: #0F2D4A; font-weight: 800; margin: 0; display: flex; align-items: center; justify-content: center;"><span style="background: #12CFF4; color: #FFFFFF; padding: 4px 10px; border-radius: 8px; font-size: 0.7em; margin-right: 12px;"><i class="fa-solid fa-money-check-dollar"></i></span>Nómina Quincenal Global</h2>',
            html: '<div id="nomina-contenedor-admin">Generando reporte...</div>',
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: window.innerWidth < 768 ? '95%' : '600px',
            background: '#FFFFFF'
        });

        renderizarNominaAdmin(window.quincenaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({icon: 'error', title: 'Error', text: 'No se pudo calcular la nómina global.', confirmButtonColor: '#12CFF4'});
    }
};

window.cambiarSemanaAdmin = (delta) => {
    window.quincenaOffset += delta;
    renderizarNominaAdmin(window.quincenaOffset);
};

// Renderizado dinámico por QUINCENAS (Cálculo automático de meses)
function renderizarNominaAdmin(offset) {
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

    let nominas = {};

    window.nominasJobsCache.forEach(job => {
        if (job.status === 'COMPLETED' && job.employeeId) {
            let jobDateStr = Array.isArray(job.jobDate)
                ? `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2,'0')}-${String(job.jobDate[2]).padStart(2,'0')}`
                : job.jobDate;

            const jobDate = new Date(jobDateStr);
            jobDate.setHours(12,0,0,0);

            if (jobDate >= inicioSemana && jobDate <= finSemana) {
                if (!nominas[job.employeeId]) nominas[job.employeeId] = 0;
                nominas[job.employeeId] += (job.pay || 0);
            }
        }
    });

    // ✅ CAMBIO: Formato Mes/Día/Año (MM/DD/YYYY)
    const formatMDY = (d) => `${(d.getMonth() + 1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;

    const strInicio = formatMDY(inicioSemana);
    const strFin = formatMDY(finSemana);

    let htmlContent = `
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; background: #F4F7FE; padding: 12px; border-radius: 12px; border: 1px solid #12CFF4; margin-bottom: 15px;">
            <button onclick="cambiarSemanaAdmin(-1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
            <div style="text-align: center; font-family: 'Poppins', sans-serif;">
                <span style="display: block; font-size: 11px; color: #2E3238; text-transform: uppercase; font-weight: bold;">Quincena del</span>
                <span id="lblRangoSemanas" style="font-size: 14px; color: #0F2D4A;"><b>${strInicio}</b> al <b>${strFin}</b></span>
            </div>
            <button type="button" onclick="exportarNominaSemanalAPdf()" style="background: #d32f2f; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.85rem;" title="Exportar a PDF">
                <i class="fa-solid fa-file-pdf"></i> PDF
            </button>
            <button onclick="cambiarSemanaAdmin(1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; transition: 0.2s; display: flex; align-items: center; gap: 6px;">
                Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>

        <div id="tabla-exportar-pdf-container" style="max-height: 250px; overflow-y: auto; border-radius: 8px; border: 1px solid #D4D4D4;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: 'Poppins', sans-serif;">
                <tr style="background-color: #0F2D4A; color: #FFFFFF; position: sticky; top: 0; z-index: 10;">
                    <th style="padding: 15px; font-weight: 700;">Personal de la Empresa (Total)</th>
                    <th style="padding: 15px; text-align: right; font-weight: 700;">Total a Pagar</th>
                </tr>
    `;

    let totalNominaGlobal = 0;
    let hayDatos = false;

    for (let empId in nominas) {
        hayDatos = true;
        const emp = window.nominasUsersCache.find(u => u.userId == empId);
        const nombre = emp ? `${emp.firstName} ${emp.lastName}` : `ID: ${empId}`;
        const pago = nominas[empId];
        totalNominaGlobal += pago;

        htmlContent += `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #2E3238; font-weight: 500; text-transform: capitalize;">${nombre.toLowerCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #F4A300; font-weight: bold; text-align: right;">$${pago.toFixed(2)}</td>
        </tr>`;
    }

    if(!hayDatos) {
        htmlContent += '<tr><td colspan="2" style="padding: 25px; text-align: center; color: #8a9099; font-style: italic;">No hay trabajos completados por ningún personal en esta quincena.</td></tr>';
    } else {
        htmlContent += `<tr style="background-color: #f8faff;">
            <td style="padding: 12px; font-weight: bold; text-align: right; color: #0B0B0D; text-transform: uppercase; font-size: 12px;">Total Nómina Global:</td>
            <td style="padding: 12px; font-weight: bold; color: #2e7d32; font-size: 16px; text-align: right;">$${totalNominaGlobal.toFixed(2)}</td>
        </tr>`;
    }
    htmlContent += '</table></div>';

    const contenedor = document.getElementById('nomina-contenedor-admin');
    if (contenedor) {
        contenedor.innerHTML = htmlContent;
    }
}

// 3. FUNCIÓN CORREGIDA DE DESCARGA PDF

window.exportarNominaSemanalAPdf = () => {
    const lblRango = document.getElementById('lblRangoSemanas');
    const textoRango = lblRango ? lblRango.textContent.trim() : "Reporte_Nomina";
    const nombreArchivoClean = textoRango.replace(/\//g, '-').replace(/\s+/g, '_');

    const tablaElemento = document.getElementById('tabla-exportar-pdf-container');
    if (!tablaElemento) {
        return Swal.fire('Error', 'No se encontraron registros renderizados para procesar el archivo.', 'error');
    }

    const contenedorImpresion = document.createElement('div');
    contenedorImpresion.style.padding = "30px 40px";
    contenedorImpresion.style.background = "#ffffff";
    contenedorImpresion.style.fontFamily = "'Poppins', sans-serif";

    contenedorImpresion.innerHTML = `
        <div style="border-bottom: 3px solid #12CFF4; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <img src="../img/logonegro.png" alt="Logo" style="height: 55px; width: auto; object-fit: contain; display: block;" onerror="this.src='../../logo.jpeg'">
                <div>
                    <h1 style="color: #0B0B0D; margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase;">REPORTE DE NÓMINA GENERAL</h1>
                    <p style="margin: 3px 0 0 0; color: #12CFF4; font-size: 12px; font-weight: bold; letter-spacing: 1px;">Plataforma RemoMN — Área de Administración</p>
                </div>
            </div>
            <div style="text-align: right; color: #2E3238;">
                <p style="margin: 0; font-weight: bold; font-size: 11px; text-transform: uppercase; color: #666;">Período Reportado:</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; color: #0F2D4A; font-weight: bold;">${textoRango}</p>
            </div>
        </div>
        <div style="margin-top: 20px;">
            <div style="border: 1px solid #D4D4D4; border-radius: 8px; overflow: hidden;">
                ${tablaElemento.innerHTML}
            </div>
        </div>
        <div style="margin-top: 45px; font-size: 10px; color: #8a9099; text-align: center; border-top: 1px dashed #E0E5F2; padding-top: 10px;">
            Este documento es un reporte financiero confidencial generado automáticamente por el Panel de Administración de RemoMN.
        </div>
    `;

    const opcionesConfiguracion = {
        margin:       [12, 12, 12, 12],
        filename:     `Nomina_Quincenal_${nombreArchivoClean}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2.5, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({
        title: 'Generando archivo PDF...',
        text: 'Preparando desglose financiero de la quincena.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    generarYEntregarPDF(opcionesConfiguracion, contenedorImpresion, `Nomina_Quincenal_${nombreArchivoClean}.pdf`)
        .catch(err => {
            console.error("Fallo al exportar reporte PDF:", err);
            Swal.fire('Error', 'No se pudo compilar el archivo PDF.', 'error');
        });
};



// =================================================================================
// --- RESUMEN DE BODEGA GLOBAL (Todos los Jefes / Todos los Managers) ---
// =================================================================================
window.bodegaAdminJobsCache = null;
window.bodegaAdminUsersCache = null;
window.bodegaAdminDiaOffset = 0;

window.verBodegaGlobal = async () => {
    Swal.fire({ title: 'Cargando ordenes de bodega globales...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const token = localStorage.getItem('jwt_token') || localStorage.getItem('token');

        const [jobsRes, usersRes] = await Promise.all([
            fetch('https://api-remomn.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-remomn.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        window.bodegaAdminJobsCache = await jobsRes.json();
        window.bodegaAdminUsersCache = await usersRes.json();

        window.bodegaAdminDiaOffset = 0;

        Swal.fire({
            title: '<i class="fa-solid fa-truck-fast" style="color:#F4A300;"></i> Ordenes de Bodega (Global)',
            html: '<div id="bodega-admin-contenedor">Generando reporte...</div>',
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: window.innerWidth < 768 ? '95%' : '800px',
            background: '#FFFFFF'
        });

        renderizarBodegaAdmin(window.bodegaAdminDiaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la bodega global.', confirmButtonColor: '#12CFF4' });
    }
};

window.cambiarDiaBodegaAdmin = (delta) => {
    window.bodegaAdminDiaOffset += delta;
    renderizarBodegaAdmin(window.bodegaAdminDiaOffset);
};

function getFechaStrLocalAdmin(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatMDYBodegaAdmin(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function renderizarBodegaAdmin(offset) {
    const fechaObjetivo = new Date();
    fechaObjetivo.setDate(fechaObjetivo.getDate() + offset);
    fechaObjetivo.setHours(12, 0, 0, 0);

    const fechaStrFiltro = getFechaStrLocalAdmin(fechaObjetivo);
    const fechaStrDisplay = formatMDYBodegaAdmin(fechaObjetivo);

    let etiquetaDia = '';
    if (offset === 0) etiquetaDia = 'Hoy';
    else if (offset === 1) etiquetaDia = 'Mañana';
    else if (offset === -1) etiquetaDia = 'Ayer';
    else etiquetaDia = fechaObjetivo.toLocaleDateString('es-ES', { weekday: 'long' });
    etiquetaDia = etiquetaDia.charAt(0).toUpperCase() + etiquetaDia.slice(1);

    let htmlContent = `
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; background: #F4F7FE; padding: 12px; border-radius: 12px; border: 1px solid #12CFF4; margin-bottom: 15px;">
        <button onclick="cambiarDiaBodegaAdmin(-1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
            <i class="fa-solid fa-chevron-left"></i> Anterior
        </button>

        <div style="text-align: center; flex: 1; min-width: 140px;">
            <span style="display: block; font-size: 10px; color: #2E3238; text-transform: uppercase; font-weight: bold;">${etiquetaDia}</span>
            <span id="lblFechaBodegaAdmin" style="font-size: 13px; color: #0F2D4A;"><b>${fechaStrDisplay}</b></span>
        </div>

        <button type="button" onclick="exportarBodegaAdminPdf()" style="background: #d32f2f; color: white; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px;">
            <i class="fa-solid fa-file-pdf"></i> PDF
        </button>

        <button onclick="cambiarDiaBodegaAdmin(1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
            Siguiente <i class="fa-solid fa-chevron-right"></i>
        </button>
    </div>`;

    // 🔑 DIFERENCIA CLAVE: NO filtramos por jefe. Todos los trabajos entran.
    const itemsDelDia = window.bodegaAdminJobsCache.filter(job => {
        if (!['PENDING', 'IN_PROGRESS'].includes(job.status)) return false;

        let jobDateStr = Array.isArray(job.jobDate)
            ? `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2, '0')}-${String(job.jobDate[2]).padStart(2, '0')}`
            : job.jobDate;

        return jobDateStr === fechaStrFiltro;
    });

    if (itemsDelDia.length === 0) {
        htmlContent += `<p style="color:#888; font-style:italic; padding:10px; text-align:center;">No hay trabajos programados para este día.</p>`;
    } else {
        htmlContent += `<div id="bodega-admin-lista-dia" style="max-height: 450px; overflow-y: auto; border: 1px solid #D4D4D4; border-radius: 8px;">`;

        itemsDelDia.forEach(job => {
            const empleado = window.bodegaAdminUsersCache.find(u => u.userId == job.employeeId);
            const nombreEmpleado = empleado ? `${empleado.firstName} ${empleado.lastName}` : `ID: ${job.employeeId}`;

            // 🔑 Nombre del Manager/Jefe a cargo, para que el admin sepa de quién es cada obra
            const nombreManager = job.nameManager || 'Sin manager asignado';

            let statusBadge = '';
            if (job.status === 'PENDING') statusBadge = `<span style="background: #FFF3E0; color: #ff9800; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">Pendiente</span>`;
            else if (job.status === 'IN_PROGRESS') statusBadge = `<span style="background: #E3F2FD; color: #1e88e5; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">En Progreso</span>`;

            let descBodega = job.description ? job.description : '';
            if (descBodega.includes('[MATERIALES PRE-ASIGNADOS]:')) {
                descBodega = descBodega.split('[MATERIALES PRE-ASIGNADOS]:')[0].trim();
            }

            // Combinamos materiales pre-asignados + necesarios (agregados por subcontratista)
            const materialesCombinados = {};
            (job.materials || []).forEach(mat => {
                materialesCombinados[mat.materialId] = {
                    name: mat.name || mat.material || 'Material',
                    quantity: parseFloat(mat.quantity || mat.cant || 1),
                    unit: mat.unit || '',
                    origen: 'Pre-asignado'
                };
            });
            (job.necessaryMaterials || []).forEach(mat => {
                const id = mat.materialId;
                if (materialesCombinados[id]) {
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
                        <strong style="color: #0F2D4A; word-break: break-word;">${job.clientName || 'Cliente sin nombre'}</strong>
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

    const contenedor = document.getElementById('bodega-admin-contenedor');
    if (contenedor) contenedor.innerHTML = htmlContent;
}

window.exportarBodegaAdminPdf = () => {
    const listaDia = document.getElementById('bodega-admin-lista-dia');
    if (!listaDia) return Swal.fire('Error', 'No hay trabajos para exportar en este día.', 'error');

    const lblFecha = document.getElementById('lblFechaBodegaAdmin');
    const textoFecha = lblFecha ? lblFecha.textContent.trim() : new Date().toISOString().split('T')[0];
    const nombreArchivoClean = textoFecha.replace(/[\/]/g, '-');

    const contenedorImpresion = document.createElement('div');
    contenedorImpresion.style.padding = "30px";
    contenedorImpresion.style.fontFamily = "'Poppins', sans-serif";
    contenedorImpresion.style.background = "#ffffff";

    contenedorImpresion.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #12CFF4; padding-bottom: 15px;">
            <h1 style="color: #0B0B0D; margin: 0;">ORDENES DE BODEGA — GLOBAL</h1>
            <p style="margin: 8px 0 0 0; color: #12CFF4; font-weight: bold;">Todos los proyectos activos de la empresa</p>
            <p style="margin: 5px 0 0 0; color: #555;">${textoFecha}</p>
        </div>
        ${listaDia.innerHTML}
        <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #888;">
            Reporte generado por el Portal RemoMN — Panel de Administración
        </div>
    `;

    const opt = {
        margin: [15, 15, 15, 15],
        filename: `Ordenes_Bodega_Global_${nombreArchivoClean}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.5, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({ title: 'Generando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    generarYEntregarPDF(opt, contenedorImpresion, `Ordenes_Bodega_Global_${nombreArchivoClean}.pdf`)
        .catch(() => Swal.fire('Error', 'No se pudo generar el PDF', 'error'));
};

// --- LOGOUT NORMAL ---
// 1. Modificamos la función de cerrar sesión para que sea la que controle el flujo
function cerrarSesion() {
    // Leemos los roles del localStorage para saber si tiene más de uno
    const rolesString = localStorage.getItem('user_roles');
    let userRoles = [];
    
    if (rolesString) {
        try { 
            userRoles = JSON.parse(rolesString); 
        } catch(e) { 
            console.error("Error al leer roles"); 
        }
    }

    // Si tiene más de un rol disponible, le damos las 3 opciones (Salir, Cambiar Rol o Cancelar)
    if (userRoles.length > 1) {
        Swal.fire({
            title: "¿Qué deseas hacer?",
            text: "Selecciona si deseas salir del panel o cambiar tu rol de trabajo.",
            icon: "question",
            showCancelButton: true,
            showDenyButton: true, // Activamos el tercer botón de SweetAlert2
            confirmButtonColor: "#0f4c81",
            denyButtonColor: "#00B8A9",    // Usamos el color cyan/turquesa de tus botones de rol
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, salir",
            denyButtonText: "Cambiar de Rol", // Acción para desplegar tus opciones
            cancelButtonText: "Cancelar",
        }).then((result) => {
            if (result.isConfirmed) {
                // Acción: Salir del sistema
                localStorage.clear();
                window.location.href = "../index.html";
            } else if (result.isDenied) {
                // Acción: Desplegar el selector dinámico que ya programaste abajo
                mostrarSelectorDeRoles(userRoles);
            }
        });
    } else {
        // Si el usuario solo tiene 1 rol asignado, se mantiene el modal tradicional de salida directa
        Swal.fire({
            title: "¿Cerrar sesión?",
            text: "¿Estás seguro que deseas salir del panel?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0f4c81",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, salir",
            cancelButtonText: "Cancelar",
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = "../index.html";
            }
        });
    }
}

// 2. Tu función existente se mantiene intacta para generar la ventana de opciones
function mostrarSelectorDeRoles(roles) {
    if (typeof cerrarModalPerfil === 'function') {
        cerrarModalPerfil(); 
    } else {
        const modales = document.querySelectorAll('.modal-overlay');
        modales.forEach(m => m.style.display = 'none');
    }

    let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
    
    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';
        
        if(rol === 'ROLE_ADMIN') { 
            nombreRol = '<i class="fa-solid fa-user-tie"></i> Acceder como Administrador'; 
            url = '../admin/admin-dashboard.html'; 
        }
        if(rol === 'ROLE_JEFE') { 
            nombreRol = '<i class="fa-solid fa-user-shield"></i> Acceder como Jefe'; 
            url = '../jefe/jefe-dashboard.html'; 
        }
        if(rol === 'ROLE_EMPLOYEE') { 
            nombreRol = '<i class="fa-solid fa-helmet-safety"></i> Acceder como Subcontratista'; 
            url = '../employee/employee-dashboard.html'; 
        }

        if(nombreRol) {
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