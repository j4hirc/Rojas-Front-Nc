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

// Variables globales para el almacenamiento de datos agrupados
let infoTrabajosGlobal = [];
let totalCalculadoGlobal = 0;

// 1. OBTENER LOS TRABAJOS DE LA API Y CALCULAR EL TOTAL GENERAL
async function obtenerNominaGlobal() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('http://localhost:8081/api/v1/jobs/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            infoTrabajosGlobal = await res.json();
            totalCalculadoGlobal = 0;

            infoTrabajosGlobal.forEach(job => {
                if (job.pay && job.status !== 'CANCELLED') {
                    totalCalculadoGlobal += job.pay;
                }
            });

            const txtNomina = document.getElementById('txtNominaGlobal');
            if (txtNomina) {
                txtNomina.textContent = `$${totalCalculadoGlobal.toFixed(2)}`;
            }
        }
    } catch (error) {
        console.error("Error cargando nómina general:", error);
    }
}

// 2. MOSTRAR EL POP-UP AGRUPADO POR PERSONA (COMO LO VE EL JEFE)
function abrirPopUpNominaGlobal() {
    if (infoTrabajosGlobal.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos',
            text: 'No hay trabajos registrados para procesar los pagos.',
            confirmButtonColor: '#12CFF4'
        });
        return;
    }

    // --- AQUÍ OCURRE LA MAGIA DE LA AGRUPACIÓN ---
    // Creamos un diccionario para acumular los pagos por el nombre de la persona
    const resumenPagos = {};

    infoTrabajosGlobal.forEach(job => {
        if (job.status !== 'CANCELLED' && job.pay) {
            // Evaluamos si el trabajo tiene un empleado asignado, si no, verificamos el jefe
            let nombrePersona = job.employeeName || job.managerName || 'Personal No Asignado';
            let rolPersona = job.employeeName ? 'Empleado' : 'Jefe/Manager';

            if (!resumenPagos[nombrePersona]) {
                resumenPagos[nombrePersona] = {
                    nombre: nombrePersona,
                    rol: rolPersona,
                    totalPago: 0,
                    obrasActivas: 0
                };
            }

            resumenPagos[nombrePersona].totalPago += job.pay;
            resumenPagos[nombrePersona].obrasActivas += 1;
        }
    });

    // Construimos las filas de la tabla utilizando los datos agrupados
    let filasTabla = '';
    Object.values(resumenPagos).forEach(persona => {
        const badgeColor = persona.rol === 'Empleado' ? '#12CFF4' : '#f4a300';
        
        filasTabla += `
            <tr style="border-bottom: 1px solid #E0E5F2;">
                <td style="padding: 12px; text-align: left; color: #0B0B0D; font-weight: 600;">
                    ${persona.nombre}
                    <div style="margin-top: 2px;">
                        <span style="background: ${badgeColor}; color: #0B0B0D; font-size: 0.7rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                            ${persona.rol}
                        </span>
                    </div>
                </td>
                <td style="padding: 12px; text-align: center; color: #666; font-weight: 500;">
                    ${persona.obrasActivas} ${persona.obrasActivas === 1 ? 'obra' : 'obras'}
                </td>
                <td style="padding: 12px; text-align: right; font-weight: 700; color: #2e7d32; font-size: 1.05rem;">
                    $${persona.totalPago.toFixed(2)}
                </td>
            </tr>
        `;
    });

    // Lanzamos el Pop-up Premium con SweetAlert2
    Swal.fire({
        title: '<span style="color: #0B0B0D; font-family:\'Poppins\',sans-serif; font-weight:700;">PAGO SEMANAL DEL PERSONAL</span>',
        html: `
            <div style="background: #EAFaf1; border: 1px solid #2e7d32; border-radius: 12px; padding: 15px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                <div style="text-align: left;">
                    <p style="margin: 0; color: #2e7d32; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Nómina Total de la Empresa</p>
                    <h2 style="margin: 0; color: #2e7d32; font-size: 1.8rem; font-weight: 700;">$${totalCalculadoGlobal.toFixed(2)}</h2>
                </div>
                <i class="fa-solid fa-users" style="font-size: 2.3rem; color: #2e7d32; opacity: 0.25;"></i>
            </div>

            <!-- Contenedor con scroll para que se adapte perfecto a celulares sin romperse -->
            <div style="width: 100%; overflow-x: auto; max-height: 320px; overflow-y: auto; border: 1px solid #E0E5F2; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; font-family: 'Poppins', sans-serif; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #0B0B0D; color: #ffffff; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">
                            <th style="padding: 10px; text-align: left;">Nombre del Personal</th>
                            <th style="padding: 10px; text-align: center;">Trabajos</th>
                            <th style="padding: 10px; text-align: right;">Total a Pagar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasTabla}
                    </tbody>
                </table>
            </div>
        `,
        width: '550px',
        showCloseButton: true,
        confirmButtonColor: '#0B0B0D',
        confirmButtonText: 'Entendido',
    });
}

// Inicializar la carga cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
    obtenerNominaGlobal();
});

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

