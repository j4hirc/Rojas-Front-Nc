let miUsuarioActual = null;
const USERS_URL = 'http://localhost:8081/api/v1/user';

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