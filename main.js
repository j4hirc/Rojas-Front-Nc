const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');

// Función global para redireccionar
window.seleccionarRol = (rolElegido) => {
    localStorage.setItem('active_role', rolElegido);

    if (rolElegido === 'ROLE_ADMIN') {
        window.location.href = 'admin/admin-dashboard.html'; 
    } else if (rolElegido === 'ROLE_JEFE') {
        window.location.href = 'jefe/jefe-dashboard.html'; 
    } else if (rolElegido === 'ROLE_EMPLOYEE') {
        window.location.href = 'employee/employee-dashboard.html'; 
    }
};

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:8081/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            
            localStorage.setItem('jwt_token', data.accessToken);
            const roles = data.roles || []; 
            localStorage.setItem('user_roles', JSON.stringify(roles));
            localStorage.setItem('user_email', data.email || 'sin-email');
            
            // LÓGICA DE ROLES
            if (roles.length === 0) {
                Swal.fire({ icon: 'warning', title: 'Sin accesos', text: 'Tu usuario no tiene ningún rol asignado.' });
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';

            } else if (roles.length === 1) {
                // Si solo tiene un rol, entra directo
                window.seleccionarRol(roles[0]);

            } else {
                // Si tiene más de un rol, armamos botones para un SweetAlert
                let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
                if (roles.includes('ROLE_ADMIN')) {
                    opcionesHTML += `<button class="swal2-confirm swal2-styled" style="margin:0; background-color: #0f4c81; width: 100%;" onclick="Swal.close(); seleccionarRol('ROLE_ADMIN')">Entrar como Administrador</button>`;
                }
                if (roles.includes('ROLE_JEFE')) {
                    opcionesHTML += `<button class="swal2-confirm swal2-styled" style="margin:0; background-color: #198754; width: 100%;" onclick="Swal.close(); seleccionarRol('ROLE_JEFE')">Entrar como Jefe</button>`;
                }
                if (roles.includes('ROLE_EMPLOYEE')) {
                    opcionesHTML += `<button class="swal2-confirm swal2-styled" style="margin:0; background-color: #ff9800; width: 100%;" onclick="Swal.close(); seleccionarRol('ROLE_EMPLOYEE')">Entrar como Empleado</button>`;
                }
                opcionesHTML += '</div>';

                Swal.fire({
                    title: 'Elige tu perfil',
                    html: '<p style="color: #666; font-size: 14px;">Tienes múltiples roles, elige cómo quieres ingresar hoy:</p>' + opcionesHTML,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    allowEscapeKey: false
                });
            }

        } else {
            // Error 401 o 403
            Swal.fire({
                icon: 'error',
                title: 'Acceso Denegado',
                text: 'Correo o contraseña incorrectos. Verifica tus datos o contacta al administrador.',
                confirmButtonColor: '#0f4c81'
            });
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar';
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de Servidor',
            text: 'No se pudo conectar con la API de Rojas Remodeling. Verifica que Spring Boot esté encendido.',
            confirmButtonColor: '#0f4c81'
        });
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
    }
});