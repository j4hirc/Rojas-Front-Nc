let miUsuarioActual = null;
const USERS_URL = 'http://localhost:8081/api/v1/user';

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

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
            // Lo pasamos todo a minúsculas por si acaso haya diferencias de mayúsculas al guardar el correo
            miUsuarioActual = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
            
            if (miUsuarioActual) {
                document.getElementById('jefe-email-display').textContent = `${miUsuarioActual.firstName} ${miUsuarioActual.lastName}`;
            } else {
                document.getElementById('jefe-email-display').textContent = userEmail;
            }
        }
    } catch (error) {
        console.error("Error obteniendo los datos del perfil:", error);
    }

    // =================================================================
    // ENLAZAMOS LOS BOTONES DESDE JAVASCRIPT DIRECTAMENTE (A PRUEBA DE FALLOS)
    // =================================================================

    const btnPerfilJefe = document.getElementById('btnPerfilJefe');
    if (btnPerfilJefe) {
        btnPerfilJefe.addEventListener('click', abrirModalPerfil);
    }

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
    // Recopilamos todos los datos requeridos por Spring Boot
    const payload = {
        firstName: document.getElementById('perfilFirstName').value.trim(),
        middleName: miUsuarioActual.middleName || "",
        lastName: document.getElementById('perfilLastName').value.trim(),
        secondSurname: miUsuarioActual.secondSurname || "",
        dni: document.getElementById('perfilDni').value.trim(),
        phone: document.getElementById('perfilPhone').value.trim(),
        email: document.getElementById('perfilEmail').value.trim(),
        password: document.getElementById('perfilPassword').value, // En blanco no actualiza
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const updatedUser = await response.json(); 
            miUsuarioActual = updatedUser; // Actualizamos la memoria caché
            
            // Actualizamos la interfaz al instante sin salir
            document.getElementById('jefe-email-display').textContent = `${updatedUser.firstName} ${updatedUser.lastName}`;
            
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

// --- LOGOUT ---
function cerrarSesion() {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del portal?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#198754",
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

window.verBodegaHoy = async () => {
    Swal.fire({ title: 'Calculando materiales...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const token = localStorage.getItem('jwt_token');
        const JOBS_URL = 'http://localhost:8081/api/v1/jobs/all';
        
        const response = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${token}` } });
        const jobs = await response.json();
        
        // Calculamos la fecha de hoy y mañana
        const hoy = new Date();
        const strHoy = hoy.toISOString().split('T')[0]; // Ej: 2026-06-08
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);
        const strManana = manana.toISOString().split('T')[0];

        let materialesRequeridos = {};

        jobs.forEach(job => {
            // Formateamos la fecha del trabajo que viene de Spring Boot
            let jobDateStr = "";
            if(Array.isArray(job.jobDate)) {
                 jobDateStr = `${job.jobDate[0]}-${String(job.jobDate[1]).padStart(2,'0')}-${String(job.jobDate[2]).padStart(2,'0')}`;
            } else {
                 jobDateStr = job.jobDate;
            }

            // Si el trabajo es de Hoy o Mañana y NO está completado ni cancelado
            if ((jobDateStr === strHoy || jobDateStr === strManana) && (job.status === 'PENDING' || job.status === 'IN_PROGRESS')) {
                if (job.materials && job.materials.length > 0) {
                    job.materials.forEach(mat => {
                        if(materialesRequeridos[mat.name]) {
                            materialesRequeridos[mat.name]++;
                        } else {
                            materialesRequeridos[mat.name] = 1;
                        }
                    });
                }
            }
        });

        let htmlContent = '<ul style="text-align: left; font-size: 14px; color: #444; background: #f8faff; padding: 15px 30px; border-radius: 8px;">';
        if(Object.keys(materialesRequeridos).length === 0) {
            htmlContent += '<li>No hay materiales agendados para obras de hoy o mañana.</li>';
        } else {
            for(let mat in materialesRequeridos) {
                htmlContent += `<li style="margin-bottom: 5px;"><strong>${mat}</strong> (Requerido en ${materialesRequeridos[mat]} obras)</li>`;
            }
        }
        htmlContent += '</ul>';

        Swal.fire({
            title: '<i class="fa-solid fa-boxes-stacked" style="color:#d32f2f;"></i> Bodega de Hoy',
            html: `<p style="font-size: 14px;">Materiales que las cuadrillas necesitan recoger:</p>${htmlContent}`,
            confirmButtonColor: '#d32f2f'
        });
    } catch (e) {
        Swal.fire('Error', 'No se pudo cargar la bodega.', 'error');
    }
};

window.verNominaSemanal = async () => {
    Swal.fire({ title: 'Calculando nómina...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    try {
        const token = localStorage.getItem('jwt_token');
        const [resJobs, resUsers] = await Promise.all([
            fetch('http://localhost:8081/api/v1/jobs/all', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://localhost:8081/api/v1/user/all-users', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const jobs = await resJobs.json();
        const users = await resUsers.json();

        const hoy = new Date();
        const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; 
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - diaSemana);
        inicioSemana.setHours(0,0,0,0);

        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6);
        finSemana.setHours(23,59,59,999);

        let nominas = {};

        jobs.forEach(job => {
            if (job.status === 'COMPLETED' && job.employeeId) {
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

        let htmlContent = '<div style="max-height: 300px; overflow-y: auto;"><table style="width: 100%; border-collapse: collapse; text-align: left;">';
        htmlContent += '<tr style="background-color: #0B0B0D; color: #12CFF4;">';
        htmlContent += '<th style="padding: 10px; border-bottom: 1px solid #ddd;">Subcontratista</th>';
        htmlContent += '<th style="padding: 10px; border-bottom: 1px solid #ddd;">Total a Pagar</th></tr>';

        let totalNomina = 0;
        let hayDatos = false;

        for (let empId in nominas) {
            hayDatos = true;
            const emp = users.find(u => u.userId == empId);
            const nombre = emp ? `${emp.firstName} ${emp.lastName}` : `ID: ${empId}`;
            const pago = nominas[empId];
            totalNomina += pago;

            htmlContent += `<tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #2E3238;">${nombre}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #F4A300; font-weight: bold;">$${pago.toFixed(2)}</td>
            </tr>`;
        }

        if(!hayDatos) {
            htmlContent += '<tr><td colspan="2" style="padding: 15px; text-align: center;">No hay trabajos completados esta semana.</td></tr>';
        } else {
            htmlContent += `<tr style="background-color: #f8faff;">
                <td style="padding: 10px; font-weight: bold; text-align: right; color: #0B0B0D;">TOTAL SEMANA:</td>
                <td style="padding: 10px; font-weight: bold; color: #2e7d32; font-size: 16px;">$${totalNomina.toFixed(2)}</td>
            </tr>`;
        }
        htmlContent += '</table></div>';

        const formatD = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        const strInicio = formatD(inicioSemana);
        const strFin = formatD(finSemana);

        Swal.fire({
            title: '<i class="fa-solid fa-money-check-dollar" style="color:#12CFF4;"></i> Nómina Semanal',
            html: `<p style="font-size: 13px; color: #666; margin-bottom: 15px;">Semana del <b>${strInicio}</b> al <b>${strFin}</b></p>${htmlContent}`,
            confirmButtonColor: '#12CFF4',
            width: '500px'
        });

    } catch (e) {
        Swal.fire({icon: 'error', title: 'Error', text: 'No se pudo calcular la nómina.', confirmButtonColor: '#12CFF4'});
    }
};