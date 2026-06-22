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

// CONTROL GLOBAL DE LA NÓMINA GENERAL
let listaTrabajosAdmin = [];
let fechaInicioSemanaActual = new Date('2026-06-15');

// 1. Cargar datos generales de la API al iniciar la página
async function inicializarNominaAdmin() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('http://localhost:8081/api/v1/jobs/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            listaTrabajosAdmin = await res.json();
            
            // Renderizar la suma total en el número grande de la tarjeta verde exterior
            let sumaTotal = 0;
            listaTrabajosAdmin.forEach(j => {
                if(j.pay && j.status !== 'CANCELLED') {
                    sumaTotal += j.pay;
                }
            });
            
            const txtCard = document.getElementById('txtNominaGlobal');
            if(txtCard) txtCard.textContent = `$${sumaTotal.toFixed(2)}`;
        }
    } catch (e) {
        console.error("Error cargando la nómina:", e);
    }
}

// 2. Formatear y calcular los rangos de fechas de la semana elegida
function actualizarRangoFechasUI() {
    const finSemana = new Date(fechaInicioSemanaActual);
    finSemana.setDate(finSemana.getDate() + 6);

    const fIn = `${String(fechaInicioSemanaActual.getDate()).padStart(2,'0')}/${String(fechaInicioSemanaActual.getMonth()+1).padStart(2,'0')}/${fechaInicioSemanaActual.getFullYear()}`;
    const fFin = `${String(finSemana.getDate()).padStart(2,'0')}/${String(finSemana.getMonth()+1).padStart(2,'0')}/${finSemana.getFullYear()}`;
    
    document.getElementById('lblRangoSemanas').textContent = `${fIn} al ${fFin}`;
    procesarYMostrarFilasNomina();
}

function cambiarSemanaNomina(direccion) {
    fechaInicioSemanaActual.setDate(fechaInicioSemanaActual.getDate() + (direccion * 7));
    actualizarRangoFechasUI();
}

// 3. Agrupar por persona e inyectar el diseño exacto de la tabla de jefe
function procesarYMostrarFilasNomina() {
    const contenedor = document.getElementById('cuerpoNominaGlobal');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const acumuladorPersonal = {};

    listaTrabajosAdmin.forEach(job => {
        if (job.status !== 'CANCELLED' && job.pay) {
            const nombre = job.employeeName || job.managerName || 'Personal Sin Asignar';
            const rol = job.employeeName ? 'Empleado' : 'Jefe';

            if (!acumuladorPersonal[nombre]) {
                acumuladorPersonal[nombre] = { nombre, rol, total: 0 };
            }
            acumuladorPersonal[nombre].total += job.pay;
        }
    });

    const listaFinal = Object.values(acumuladorPersonal);

    if (listaFinal.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; color: #8a9099; padding: 40px 15px; font-style: italic; font-family: 'Poppins', sans-serif; font-size: 0.95rem; background: white;">
                No hay trabajos completados por tu personal en esta semana.
            </div>`;
        return;
    }

    // Dibujar las filas idénticas con estilos inline limpios
    listaFinal.forEach(p => {
        const fila = document.createElement('div');
        fila.style = "display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #E0E5F2; font-family: 'Poppins', sans-serif; background: white;";
        
        fila.innerHTML = `
            <div style="text-align: left;">
                <div style="font-weight: 600; color: #0B0B0D; font-size: 0.95rem; text-transform: capitalize;">${p.nombre.toLowerCase()}</div>
                <span style="font-size: 0.65rem; font-weight: bold; background: ${p.role === 'Empleado' ? 'rgba(18,207,244,0.15)' : 'rgba(244,163,0,0.15)'}; color: #0B0B0D; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; margin-top: 3px; display: inline-block;">
                    ${p.rol}
                </span>
            </div>
            <div style="font-weight: 700; color: #0B0B0D; font-size: 1.05rem;">
                $${p.total.toFixed(2)}
            </div>
        `;
        contenedor.appendChild(fila);
    });
}

// 4. Funciones de Activación por Clases Nativa (.classList)
function abrirPopUpNominaGlobal() {
    const modal = document.getElementById('modalNominaGlobal');
    if(modal) {
        modal.classList.add('active'); // <- Usa la clase nativa del framework CSS de tu app
        actualizarRangoFechasUI();
    }
}

function cerrarPopUpNomina() {
    const modal = document.getElementById('modalNominaGlobal');
    if(modal) {
        modal.classList.remove('active');
    }
}

// Inicializar al cargar el DOM del dashboard
document.addEventListener('DOMContentLoaded', () => {
    inicializarNominaAdmin();
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

