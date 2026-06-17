let miUsuarioActual = null;
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user';

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

    if(!payload.firstName || !payload.lastName || !payload.dni || !payload.phone || !payload.email) {
        return Swal.fire('Atención', 'Por favor llena todos los campos obligatorios.', 'warning');
    }

    Swal.fire({ title: 'Actualizando tu perfil...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

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
            } catch (e) {}
            Swal.fire({ icon: 'error', title: 'Error', html: errorMsg, confirmButtonColor: '#12CFF4' });
        }
    } catch (error) { Swal.fire({ icon: 'error', title: 'Error de red', text: 'No se pudo contactar al servidor.', confirmButtonColor: '#12CFF4' }); }
}

function cerrarSesion() {
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

// --- RESUMEN DE BODEGA ---
window.verBodegaHoy = async () => {
    Swal.fire({ title: 'Calculando materiales...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const token = localStorage.getItem('jwt_token');
        const JOBS_URL = 'https://api-remomn.onrender.com/api/v1/jobs/all';
        const response = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
        const jobs = await response.json();
        
        const hoy = new Date();
        const strHoy = hoy.toISOString().split('T')[0];
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);
        const strManana = manana.toISOString().split('T')[0];

        const jefeNombreCompleto = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`.trim().toLowerCase();
        let materialesRequeridos = {};

        jobs.forEach(job => {
            const jobManagerName = (job.nameManager || "").trim().toLowerCase();
            const esDeEsteJefe = (jobManagerName === jefeNombreCompleto) || (job.managerId == miUsuarioActual.userId);
            
            if (!esDeEsteJefe) return; 

            let jobDateStr = Array.isArray(job.jobDate) ? `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2,'0')}-${String(job.jobDate[2]).padStart(2,'0')}` : job.jobDate;
            if ((jobDateStr === strHoy || jobDateStr === strManana) && (job.status === 'PENDING' || job.status === 'IN_PROGRESS')) {
                if (job.materials && job.materials.length > 0) {
                    job.materials.forEach(mat => {
                        materialesRequeridos[mat.name] = (materialesRequeridos[mat.name] || 0) + 1;
                    });
                }
            }
        });

        let htmlContent = '<ul style="text-align: left; font-size: 14px; color: #444; background: #f8faff; padding: 15px 30px; border-radius: 8px;">';
        if(Object.keys(materialesRequeridos).length === 0) {
            htmlContent += '<li>No tienes materiales agendados para obras de hoy o mañana.</li>';
        } else {
            for(let mat in materialesRequeridos) {
                htmlContent += `<li style="margin-bottom: 5px;"><strong>${mat}</strong> (Requerido en ${materialesRequeridos[mat]} de tus obras)</li>`;
            }
        }
        htmlContent += '</ul>';

        Swal.fire({
            title: '<i class="fa-solid fa-boxes-stacked" style="color:#d32f2f;"></i> Mi Bodega',
            html: `<p style="font-size: 14px;">Materiales que tus cuadrillas necesitan recoger:</p>${htmlContent}`,
            confirmButtonColor: '#12CFF4'
        });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la bodega.', confirmButtonColor: '#12CFF4' });
    }
};

// =================================================================================
// --- NÓMINA SEMANAL CON VIAJE EN EL TIEMPO SIN BUGS ---
// =================================================================================
let nominasJobsCache = null;
let nominasUsersCache = null;
let semanaOffset = 0; 

window.verNominaSemanal = async () => {
    Swal.fire({ title: 'Obteniendo registros...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const token = localStorage.getItem('jwt_token');

        // Siempre traemos datos frescos de la API al abrir
        const [resJobs, resUsers] = await Promise.all([
            fetch('https://api-remomn.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-remomn.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        nominasJobsCache = await resJobs.json();
        nominasUsersCache = await resUsers.json();

        semanaOffset = 0; // Reiniciamos a la semana actual

        // 1. Abrimos el SweetAlert UNA SOLA VEZ y le dejamos una "Caja Vacía" con ID
        Swal.fire({
            title: '<h2 style="color: #0F2D4A; font-weight: 800; margin: 0; display: flex; align-items: center; justify-content: center;"><span style="background: #12CFF4; color: #FFFFFF; padding: 4px 10px; border-radius: 8px; font-size: 0.7em; margin-right: 12px;"><i class="fa-solid fa-money-check-dollar"></i></span>Tu Nómina Semanal</h2>',
            html: '<div id="nomina-contenedor">Generando reporte...</div>', // Caja Vacía
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: '600px',
            background: '#FFFFFF'
        });

        // 2. Llenamos esa caja vacía con los datos de la semana
        renderizarNomina(semanaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({icon: 'error', title: 'Error', text: 'No se pudo calcular la nómina. Revisa tu conexión.', confirmButtonColor: '#12CFF4'});
    }
};

// Cuando tocan los botones Anterior/Siguiente
window.cambiarSemana = (delta) => {
    semanaOffset += delta;
    // Solo inyectamos los nuevos datos en la caja vacía (Sin abrir otro SweetAlert)
    renderizarNomina(semanaOffset);
};

// Función que inyecta el HTML en la caja sin recargar el Modal
function renderizarNomina(offset) {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + (offset * 7)); 

    const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; 
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - diaSemana);
    inicioSemana.setHours(0,0,0,0);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23,59,59,999);

    const jefeNombreCompleto = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`.trim().toLowerCase();
    let nominas = {};

    nominasJobsCache.forEach(job => {
        const jobManagerName = (job.nameManager || "").trim().toLowerCase();
        const esDeEsteJefe = (jobManagerName === jefeNombreCompleto) || (job.managerId == miUsuarioActual.userId);

        if (esDeEsteJefe && job.status === 'COMPLETED' && job.employeeId) {
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

    const formatD = (d) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth() + 1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    const strInicio = formatD(inicioSemana);
    const strFin = formatD(finSemana);

    let htmlContent = `
    <div style="display: flex; justify-content: space-between; align-items: center; background: #F4F7FE; padding: 15px; border-radius: 12px; border: 1px solid #12CFF4; margin-bottom: 15px;">
        
        <!-- Botón Anterior con fondo Azul Oscuro -->
        <button onclick="cambiarSemana(-1)" style="background: #0F2D4A; color: #12CFF4; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-chevron-left"></i> Anterior
        </button>

        <div style="text-align: center;">
            <span style="display: block; font-size: 11px; color: #2E3238; text-transform: uppercase; font-weight: bold;">Semana del</span>
            <span style="font-size: 14px; color: #0F2D4A;"><b>${strInicio}</b> al <b>${strFin}</b></span>
        </div>

        <!-- Botón Siguiente con fondo Azul Oscuro -->
        <button onclick="cambiarSemana(1)" style="background: #0F2D4A; color: #12CFF4; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 8px;">
            Siguiente <i class="fa-solid fa-chevron-right"></i>
        </button>
    </div>

    <div style="max-height: 250px; overflow-y: auto; border-radius: 8px; border: 1px solid #D4D4D4;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
            
            <!-- Encabezado de la tabla con fondo Azul Oscuro -->
            <tr style="background-color: #0F2D4A; color: #12CFF4; position: sticky; top: 0; z-index: 10;">
                <th style="padding: 15px; font-weight: 700;">Subcontratista a tu cargo</th>
                <th style="padding: 15px; text-align: right; font-weight: 700;">Total a Pagar</th>
            </tr>
`;

    let totalNomina = 0;
    let hayDatos = false;

    for (let empId in nominas) {
        hayDatos = true;
        const emp = nominasUsersCache.find(u => u.userId == empId);
        const nombre = emp ? `${emp.firstName} ${emp.lastName}` : `ID: ${empId}`;
        const pago = nominas[empId];
        totalNomina += pago;

        htmlContent += `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #2E3238;">${nombre}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #F4A300; font-weight: bold; text-align: right;">$${pago.toFixed(2)}</td>
        </tr>`;
    }

    if(!hayDatos) {
        htmlContent += '<tr><td colspan="2" style="padding: 15px; text-align: center; color: #8a9099; font-style: italic;">No hay trabajos completados por tu personal en esta semana.</td></tr>';
    } else {
        htmlContent += `<tr style="background-color: #f8faff;">
            <td style="padding: 10px; font-weight: bold; text-align: right; color: #0B0B0D; text-transform: uppercase;">Total de tu equipo:</td>
            <td style="padding: 10px; font-weight: bold; color: #2e7d32; font-size: 16px; text-align: right;">$${totalNomina.toFixed(2)}</td>
        </tr>`;
    }
    htmlContent += '</table></div>';

    // ¡La parte vital! Actualizamos solo la caja interna, sin tocar el Modal
    const contenedor = document.getElementById('nomina-contenedor');
    if (contenedor) {
        contenedor.innerHTML = htmlContent;
    }
}