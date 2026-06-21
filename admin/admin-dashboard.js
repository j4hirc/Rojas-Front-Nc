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

// Variable global para almacenar el desglose de los pagos
let infoTrabajosGlobal = [];
let totalCalculadoGlobal = 0;

// 1. FUNCIÓN PARA CALCULAR EL TOTAL EN LA TARJETA AUTOMÁTICAMENTE
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

// 2. FUNCIÓN PARA ABRIR EL POP-UP DETALLADO (SWEETALERT2)
function abrirPopUpNominaGlobal() {
    if (infoTrabajosGlobal.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos',
            text: 'No hay trabajos activos registrados en esta semana.',
            confirmButtonColor: '#12CFF4'
        });
        return;
    }

    // Generar las filas de la tabla de forma dinámica
    let filasTabla = '';
    infoTrabajosGlobal.forEach(job => {
        if(job.status !== 'CANCELLED') {
            const empleado = job.employeeName || 'No asignado';
            const jefe = job.managerName || 'Sin jefe';
            const pago = job.pay ? `$${job.pay.toFixed(2)}` : '$0.00';
            
            // Colores limpios para los estados
            let colorEstado = '#f4a300'; // Pending / In progress
            if(job.status === 'COMPLETED') colorEstado = '#2e7d32';

            filasTabla += `
                <tr style="border-bottom: 1px solid #E0E5F2;">
                    <td style="padding: 10px; font-weight: 600; text-align: left; color: #0B0B0D;">${job.clientName || 'Obra'}</td>
                    <td style="padding: 10px; text-align: left; font-size: 0.85rem;">
                        <div><strong>Emp:</strong> ${empleado}</div>
                        <div style="color: #666; font-size: 0.8rem;"><strong>Jefe:</strong> ${jefe}</div>
                    </td>
                    <td style="padding: 10px; text-align: center;"><span style="color: ${colorEstado}; font-weight: bold; font-size: 0.8rem;">${job.status}</span></td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #e65100;">${pago}</td>
                </tr>
            `;
        }
    });

    // Lanzar el Pop-up con diseño premium integrado
    Swal.fire({
        title: '<span style="color: #0B0B0D; font-family:\'Poppins\',sans-serif; font-weight:700;">RESUMEN DE NÓMINA GENERAL</span>',
        html: `
            <div style="background: #EAFaf1; border: 1px solid #2e7d32; border-radius: 12px; padding: 15px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                <div style="text-align: left;">
                    <p style="margin: 0; color: #2e7d32; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Total Acumulado Semanal</p>
                    <h2 style="margin: 0; color: #2e7d32; font-size: 1.8rem; font-weight: 700;">$${totalCalculadoGlobal.toFixed(2)}</h2>
                </div>
                <i class="fa-solid fa-money-bill-wave" style="font-size: 2.5rem; color: #2e7d32; opacity: 0.3;"></i>
            </div>

            <!-- Contenedor con scroll para celulares -->
            <div style="width: 100%; overflow-x: auto; max-height: 300px; overflow-y: auto; border: 1px solid #E0E5F2; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; font-family: 'Poppins', sans-serif; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #0B0B0D; color: #ffffff; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">
                            <th style="padding: 10px; text-align: left;">Obra</th>
                            <th style="padding: 10px; text-align: left;">Personal</th>
                            <th style="padding: 10px; text-align: center;">Estado</th>
                            <th style="padding: 10px; text-align: right;">Pago</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasTabla}
                    </tbody>
                </table>
            </div>
        `,
        width: '600px',
        showCloseButton: true,
        confirmButtonColor: '#0B0B0D',
        confirmButtonText: 'Cerrar Ventana',
        customClass: {
            popup: 'animated fadeInDown'
        }
    });
}

// Inicializar el cálculo al cargar el archivo
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

