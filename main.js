const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');

// Función global para redireccionar según el botón que elija
window.seleccionarRol = (rolElegido) => {
    // Guardamos el rol que eligió usar en esta sesión
    localStorage.setItem('active_role', rolElegido);

    // Redirecciones con los nombres CORRECTOS de tus archivos
    if (rolElegido === 'ROLE_ADMIN') {
        window.location.href = 'admin/admin-dashboard.html'; 
    } else if (rolElegido === 'ROLE_JEFE') {
        window.location.href = 'jefe/jefe-dashboard.html'; 
    } else if (rolElegido === 'ROLE_EMPLOYEE') {
        window.location.href = 'empleado/empleado-dashboard.html'; 
    }
};

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';

    const email = document.getElementById('email').value;
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
            console.log("Respuesta del backend:", data); 
            
            localStorage.setItem('jwt_token', data.accessToken);
            
            const roles = data.roles || []; 
            localStorage.setItem('user_roles', JSON.stringify(roles));
            localStorage.setItem('user_email', data.email || 'sin-email');
            
            // LÓGICA DE ROLES
            if (roles.length === 0) {
                alert('Tu usuario no tiene ningún rol asignado.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar';

            } else if (roles.length === 1) {
                // Si solo tiene un rol, va directo a su vista
                window.seleccionarRol(roles[0]);

            } else {
                // Si tiene MÁS de un rol, le mostramos botones para elegir
                const loginCard = document.querySelector('.login-card');
                
                // Generamos los botones dinámicamente dependiendo de los roles que tenga
                let botonesHTML = '';
                if (roles.includes('ROLE_ADMIN')) {
                    botonesHTML += `<button onclick="seleccionarRol('ROLE_ADMIN')" style="margin-bottom: 10px; background: #0d6efd; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Entrar como Administrador</button>`;
                }
                if (roles.includes('ROLE_JEFE')) {
                    botonesHTML += `<button onclick="seleccionarRol('ROLE_JEFE')" style="margin-bottom: 10px; background: #198754; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Entrar como Jefe</button>`;
                }
                if (roles.includes('ROLE_EMPLOYEE')) {
                    botonesHTML += `<button onclick="seleccionarRol('ROLE_EMPLOYEE')" style="margin-bottom: 10px; background: #6c757d; color: white; padding: 10px; border: none; border-radius: 4px; cursor: pointer; width: 100%;">Entrar como Empleado</button>`;
                }

                // Reemplazamos el formulario por los botones
                loginCard.innerHTML = `
                    <h2 style="text-align: center; color: #333;">Elige cómo ingresar</h2>
                    <p style="text-align: center; font-size: 14px; color: #666; margin-bottom: 20px;">Tienes múltiples roles en tu cuenta.</p>
                    <div style="display: flex; flex-direction: column;">
                        ${botonesHTML}
                    </div>
                `;
            }

        } else {
            alert('Credenciales incorrectas');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar';
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        alert('Error al conectar con el servidor.');
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
    }
});