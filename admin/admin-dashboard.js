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

// Variables de control de nómina y fechas
let listaTrabajosAdmin = [];
let fechaInicioSemanaActual = new Date('2026-06-15'); // Fecha base de tu captura

// 1. CARGA INICIAL DE DATOS AUTOMÁTICA
async function inicializarNominaAdmin() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('http://localhost:8081/api/v1/jobs/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            listaTrabajosAdmin = await res.json();
            
            // Sumamos el global total para pintar el número de la tarjeta verde exterior
            let sumaTotal = 0;
            listaTrabajosAdmin.forEach(j => {
                if(j.pay && j.status !== 'CANCELLED') sumaTotal += j.pay;
            });
            
            const txtCard = document.getElementById('txtNominaGlobal');
            if(txtCard) txtCard.textContent = `$${sumaTotal.toFixed(2)}`;
        }
    } catch (e) {
        console.error("Error al sincronizar nómina:", e);
    }
}

// 2. CONTROL DEL RANGO DE FECHAS (MOSTRAR SEMANAS)
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

// 3. AGRUPAR TRABAJOS Y PINTARLOS EN LA VENTANA MODAL
function procesarYMostrarFilasNomina() {
    const contenedor = document.getElementById('cuerpoNominaGlobal');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const finSemana = new Date(fechaInicioSemanaActual);
    finSemana.setDate(finSemana.getDate() + 6);

    // Diccionario para acumular dinero por persona
    const acumuladorPersonal = {};

    listaTrabajosAdmin.forEach(job => {
        // Ignoramos cancelados y registros sin cobro
        if (job.status !== 'CANCELLED' && job.pay) {
            
            // Validación de filtros por fecha del trabajo (si tu backend la provee)
            // Si quieres que filtre estrictamente por semana activa, descomenta las líneas de abajo:
            /*
            const fechaJob = new Date(job.date); 
            if (fechaJob < fechaInicioSemanaActual || fechaJob > finSemana) return;
            */

            const nombre = job.employeeName || job.managerName || 'Personal Sin Nombre';
            const rol = job.employeeName ? 'Empleado' : 'Jefe';

            if (!acumuladorPersonal[nombre]) {
                acumuladorPersonal[nombre] = { nombre, rol, total: 0 };
            }
            acumuladorPersonal[nombre].total += job.pay;
        }
    });

    const personasFiltradas = Object.values(acumuladorPersonal);

    if (personasFiltradas.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; color: #8a9099; padding: 30px 10px; font-style: italic;">
                No hay trabajos completados por tu personal en esta semana.
            </div>`;
        return;
    }

    // Generamos las filas visuales idénticas a tu diseño limpio
    personasFiltradas.forEach(p => {
        const divFila = document.createElement('div');
        divFila.style = "display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px solid #E0E5F2; font-family: 'Poppins', sans-serif;";
        
        divFila.innerHTML = `
            <div style="text-align: left;">
                <div style="font-weight: 600; color: #0B0B0D; font-size: 0.95rem;">${p.nombre}</div>
                <span style="font-size: 0.7rem; font-weight: bold; background: ${p.rol === 'Empleado' ? '#12CFF4' : '#f4a300'}; color: #0B0B0D; padding: 1px 5px; border-radius: 4px; text-transform: uppercase;">
                    ${p.rol}
                </span>
            </div>
            <div style="font-weight: 700; color: #0B0B0D; font-size: 1.05rem;">
                $${p.total.toFixed(2)}
            </div>
        `;
        contenedor.appendChild(divFila);
    });
}

// 4. FUNCIONES DE APERTURA Y CIERRE
function abrirPopUpNominaGlobal() {
    document.getElementById('modalNominaGlobal').style.display = 'flex';
    actualizarRangoFechasUI();
}

function cerrarPopUpNomina() {
    document.getElementById('modalNominaGlobal').style.display = 'none';
}

// Cargar cálculo de nómina al iniciar el panel
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

