let miUsuarioActual = null;
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user';

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    // Validación de seguridad
    if (!token || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para acceder a este panel.',
            confirmButtonColor: '#12CFF4',
            allowOutsideClick: false
        }).then(() => {
            window.location.href = '../index.html'; 
        });
        return;
    }

    try {
        const response = await fetch(`${USERS_URL}/all-users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const users = await response.json();
            // A minúsculas por si acaso
            miUsuarioActual = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
            
            if (miUsuarioActual) {
                document.getElementById('admin-email-display').textContent = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`;
            } else {
                document.getElementById('admin-email-display').textContent = userEmail;
            }
        }
    } catch (error) {
        console.error("Error obteniendo los datos del perfil:", error);
    }

    // =================================================================
    // ENLAZAMOS LOS BOTONES DESDE JAVASCRIPT DIRECTAMENTE
    // =================================================================
    const btnPerfilAdmin = document.getElementById('btnPerfilAdmin');
    if (btnPerfilAdmin) btnPerfilAdmin.addEventListener('click', abrirModalPerfil);

    const btnCerrarModalTop = document.getElementById('btnCerrarModalTop');
    if (btnCerrarModalTop) btnCerrarModalTop.addEventListener('click', cerrarModalPerfil);

    const btnCerrarModalBot = document.getElementById('btnCerrarModalBot');
    if (btnCerrarModalBot) btnCerrarModalBot.addEventListener('click', cerrarModalPerfil);

    const btnGuardarPerfil = document.getElementById('btnGuardarPerfil');
    if (btnGuardarPerfil) btnGuardarPerfil.addEventListener('click', guardarPerfil);

    const btnSalir = document.getElementById('btnSalir');
    if (btnSalir) btnSalir.addEventListener('click', cerrarSesion);
});

// --- FUNCIONES PARA EDITAR EL PERFIL ---

function abrirModalPerfil() {
    if (!miUsuarioActual) {
        return Swal.fire('Error', 'No se pudieron cargar tus datos. Refresca la página.', 'error');
    }
    
    // Llenamos el formulario con los datos actuales
    document.getElementById('perfilFirstName').value = miUsuarioActual.firstName || '';
    document.getElementById('perfilLastName').value = miUsuarioActual.lastName || '';
    document.getElementById('perfilDni').value = miUsuarioActual.dni || '';
    document.getElementById('perfilPhone').value = miUsuarioActual.phone || '';
    document.getElementById('perfilEmail').value = miUsuarioActual.email || '';
    document.getElementById('perfilPassword').value = ''; // Siempre vacío por seguridad

    document.getElementById('modalPerfil').style.display = 'flex';
}

function cerrarModalPerfil() {
    document.getElementById('modalPerfil').style.display = 'none';
}

async function guardarPerfil() {
    // ESTOS SON TODOS LOS DATOS QUE TU BACKEND ESPERA (Incluyendo ocultos)
    const payload = {
        firstName: document.getElementById('perfilFirstName').value.trim(),
        middleName: miUsuarioActual.middleName || "",
        lastName: document.getElementById('perfilLastName').value.trim(),
        secondSurname: miUsuarioActual.secondSurname || "",
        dni: document.getElementById('perfilDni').value.trim(),
        phone: document.getElementById('perfilPhone').value.trim(),
        email: document.getElementById('perfilEmail').value.trim(),
        password: document.getElementById('perfilPassword').value, // El backend lo permite vacío
        dateOfBirth: miUsuarioActual.dateOfBirth, 
        title: miUsuarioActual.title || "Administrador" 
    };

    if(!payload.firstName || !payload.lastName || !payload.dni || !payload.phone || !payload.email) {
        return Swal.fire('Atención', 'Por favor llena todos los campos obligatorios.', 'warning');
    }

    Swal.fire({ title: 'Actualizando tu perfil...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
        const token = localStorage.getItem('jwt_token');
        
        // LA RUTA CORREGIDA HACIA SPRING BOOT: /edit-user/
        const response = await fetch(`${USERS_URL}/edit-user/${miUsuarioActual.userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const updatedUser = await response.json(); 
            miUsuarioActual = updatedUser; // Actualizamos la memoria
            
            // Reflejamos el cambio de nombre en pantalla inmediatamente
            document.getElementById('admin-email-display').textContent = `${updatedUser.firstName} ${updatedUser.lastName}`;
            
            cerrarModalPerfil();

            Swal.fire({
                icon: 'success',
                title: '¡Perfil Actualizado!',
                text: 'Tus datos se guardaron correctamente.',
                confirmButtonColor: '#12CFF4',
                timer: 2000,
                showConfirmButton: false
            });

        } else {
            let errorMsg = 'No se pudo actualizar el perfil.';
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData === 'object') {
                    errorMsg = Object.values(errorData).join('<br>');
                } else if (errorData && errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) {}
            Swal.fire('Error', errorMsg, 'error');
        }
    } catch (error) {
        Swal.fire('Error de red', 'No se pudo contactar al servidor.', 'error');
    }
}
// =================================================================================
// --- NÓMINA SEMANAL GLOBAL (ESTILO JEFE - TOTALMENTE IDÉNTICO) ---
// =================================================================================
let nominasJobsCache = null;
let nominasUsersCache = null;
let semanaOffset = 0; 

window.verNominaSemanalGlobal = async () => {
    Swal.fire({ title: 'Obteniendo registros globales...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const token = localStorage.getItem('jwt_token') || localStorage.getItem('token');

        // Peticiones paralelas a los endpoints productivos en Render
        const [resJobs, resUsers] = await Promise.all([
            fetch('https://api-remomn.onrender.com/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('https://api-remomn.onrender.com/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        nominasJobsCache = await resJobs.json();
        nominasUsersCache = await resUsers.json();

        semanaOffset = 0; // Reiniciar vista a la semana actual

        // 1. Lanzamos el SweetAlert inicial con la caja vacía idéntica a la de jefe
        Swal.fire({
            title: '<h2 style="color: #0F2D4A; font-weight: 800; margin: 0; display: flex; align-items: center; justify-content: center;"><span style="background: #12CFF4; color: #FFFFFF; padding: 4px 10px; border-radius: 8px; font-size: 0.7em; margin-right: 12px;"><i class="fa-solid fa-money-check-dollar"></i></span>Nómina Semanal Global</h2>',
            html: '<div id="nomina-contenedor-admin">Generando reporte...</div>',
            confirmButtonColor: '#12CFF4',
            confirmButtonText: 'Cerrar',
            width: '600px',
            background: '#FFFFFF'
        });

        // 2. Inyectamos la información calculada en la caja
        renderizarNominaAdmin(semanaOffset);

    } catch (e) {
        console.error(e);
        Swal.fire({icon: 'error', title: 'Error', text: 'No se pudo calcular la nómina global.', confirmButtonColor: '#12CFF4'});
    }
};

// Vinculación de los botones Anterior y Siguiente
window.cambiarSemanaAdmin = (delta) => {
    semanaOffset += delta;
    renderizarNominaAdmin(semanaOffset);
};

// Renderizado dinámico por semanas sin recargar ni romper el Pop-up
function renderizarNominaAdmin(offset) {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + (offset * 7)); 

    const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; 
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - diaSemana);
    inicioSemana.setHours(0,0,0,0);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23,59,59,999);

    let nominas = {};

    // --- PROCESAMIENTO GENERAL (ADMINISTRADOR VER TODO) ---
    nominasJobsCache.forEach(job => {
        // Filtramos que el trabajo esté completado y tenga personal asignado
        if (job.status === 'COMPLETED' && job.employeeId) {
            let jobDateStr = Array.isArray(job.jobDate)
                ? `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2,'0')}-${String(job.jobDate[2]).padStart(2,'0')}`
                : job.jobDate;

            const jobDate = new Date(jobDateStr);
            jobDate.setHours(12,0,0,0);

            // Si entra en el rango de la semana seleccionada
            if (jobDate >= inicioSemana && jobDate <= finSemana) {
                if (!nominas[job.employeeId]) nominas[job.employeeId] = 0;
                nominas[job.employeeId] += (job.pay || 0);
            }
        }
    });

    const formatD = (d) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth() + 1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    const strInicio = formatD(inicioSemana);
    const strFin = formatD(finSemana);

    // Render del HTML clonando perfectamente los estilos del jefe
    let htmlContent = `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #F4F7FE; padding: 15px; border-radius: 12px; border: 1px solid #12CFF4; margin-bottom: 15px;">
            
            <button onclick="cambiarSemanaAdmin(-1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>

            <div style="text-align: center; font-family: 'Poppins', sans-serif;">
                <span style="display: block; font-size: 11px; color: #2E3238; text-transform: uppercase; font-weight: bold;">Semana del</span>
                <span style="font-size: 14px; color: #0F2D4A;"><b>${strInicio}</b> al <b>${strFin}</b></span>
            </div>

            <button onclick="cambiarSemanaAdmin(1)" style="background: #0F2D4A; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; display: flex; align-items: center; gap: 8px;">
                Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>

        <div style="max-height: 250px; overflow-y: auto; border-radius: 8px; border: 1px solid #D4D4D4;">
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
        const emp = nominasUsersCache.find(u => u.userId == empId);
        const nombre = emp ? `${emp.firstName} ${emp.lastName}` : `ID: ${empId}`;
        const pago = nominas[empId];
        totalNominaGlobal += pago;

        htmlContent += `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #2E3238; font-weight: 500; text-transform: capitalize;">${nombre.toLowerCase()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #F4A300; font-weight: bold; text-align: right;">$${pago.toFixed(2)}</td>
        </tr>`;
    }

    if(!hayDatos) {
        htmlContent += '<tr><td colspan="2" style="padding: 25px; text-align: center; color: #8a9099; font-style: italic;">No hay trabajos completados por ningún personal en esta semana.</td></tr>';
    } else {
        htmlContent += `<tr style="background-color: #f8faff;">
            <td style="padding: 12px; font-weight: bold; text-align: right; color: #0B0B0D; text-transform: uppercase; font-size: 12px;">Total Nómina Global:</td>
            <td style="padding: 12px; font-weight: bold; color: #2e7d32; font-size: 16px; text-align: right;">$${totalNominaGlobal.toFixed(2)}</td>
        </tr>`;
    }
    htmlContent += '</table></div>';

    // Inyectamos el reporte fresco directamente en la caja interna del SweetAlert activo
    const contenedor = document.getElementById('nomina-contenedor-admin');
    if (contenedor) {
        contenedor.innerHTML = htmlContent;
    }
}

// --- LOGOUT NORMAL ---
function cerrarSesion() {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del panel?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#0f4c81",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../index.html';
        }
    });
}

