const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function () {
        // Alternar el tipo de input
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Cambiar el texto impreso
        this.textContent = type === 'password' ? 'Mostrar' : 'Ocultar';
    });
}

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
        const response = await fetch('https://api-remomn.onrender.com/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            
            localStorage.setItem('jwt_token', data.accessToken);
            const roles = data.roles || []; 
            localStorage.setItem('user_roles', JSON.stringify(roles));
            localStorage.setItem('user_email', data.email || 'sin-email');
            
            if (roles.length === 0) {
                Swal.fire({ icon: 'warning', title: 'Sin accesos', text: 'Tu usuario no tiene ningún rol asignado.', confirmButtonColor: '#12CFF4' });
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';

            } else if (roles.length === 1) {
                window.seleccionarRol(roles[0]);

            } else {
                // Selector de roles con la nueva paleta
                let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
                if (roles.includes('ROLE_ADMIN')) {
                    opcionesHTML += `<button class="swal2-confirm swal2-styled" style="margin:0; background-color: #0B0B0D; color: #12CFF4; border: 1px solid #12CFF4; width: 100%; font-weight: 700; text-transform: uppercase;" onclick="Swal.close(); seleccionarRol('ROLE_ADMIN')">Entrar como Administrador</button>`;
                }
                if (roles.includes('ROLE_JEFE')) {
                    opcionesHTML += `<button class="swal2-confirm swal2-styled" style="margin:0; background-color: #12CFF4; color: #0B0B0D; width: 100%; font-weight: 700; text-transform: uppercase;" onclick="Swal.close(); seleccionarRol('ROLE_JEFE')">Entrar como Jefe</button>`;
                }
                if (roles.includes('ROLE_EMPLOYEE')) {
                    opcionesHTML += `<button class="swal2-confirm swal2-styled" style="margin:0; background-color: #F4A300; color: #0B0B0D; width: 100%; font-weight: 700; text-transform: uppercase;" onclick="Swal.close(); seleccionarRol('ROLE_EMPLOYEE')">Entrar como Empleado</button>`;
                }
                opcionesHTML += '</div>';

                Swal.fire({
                    title: 'Elige tu perfil',
                    html: '<p style="color: #2E3238; font-size: 14px;">Tienes múltiples roles, elige cómo quieres ingresar hoy:</p>' + opcionesHTML,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    background: '#FFFFFF'
                });
            }

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Acceso Denegado',
                text: 'Correo o contraseña incorrectos. Verifica tus datos.',
                confirmButtonColor: '#12CFF4'
            });
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar';
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Servidor',
            text: 'No se pudo conectar con la API de Rojas Remodeling.',
            confirmButtonColor: '#12CFF4'
        });
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
    }
});

// Recuperar contraseña
if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
        const { value: email } = await Swal.fire({
            title: 'Recuperar Contraseña',
            input: 'email',
            inputLabel: 'Ingresa tu correo electrónico registrado',
            inputPlaceholder: 'ejemplo@correo.com',
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> Enviar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#12CFF4',
            cancelButtonColor: '#2E3238',
            inputValidator: (value) => {
                if (!value) return '¡Necesitas ingresar un correo electrónico!'
            }
        });

        if (email) {
            Swal.fire({ title: 'Generando y enviando contraseña...', text: 'Por favor, espera unos segundos.', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            try {
                const response = await fetch('https://api-remomn.onrender.com/api/v1/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

                if (response.ok) {
                    Swal.fire({ icon: 'success', title: '¡Correo enviado!', text: 'Revisa tu bandeja de entrada o la carpeta de SPAM.', confirmButtonColor: '#12CFF4' });
                } else {
                    let errorMsg = 'Ocurrió un error al procesar tu solicitud.';
                    try { const errorData = await response.json(); if (errorData.message) errorMsg = errorData.message; } catch (e) {}
                    Swal.fire({ icon: 'error', title: 'Aviso del Sistema', text: errorMsg, confirmButtonColor: '#12CFF4' });
                }
            } catch (error) {
                Swal.fire('Error de red', 'No se pudo conectar con el servidor.', 'error');
            }
        }
    });
}