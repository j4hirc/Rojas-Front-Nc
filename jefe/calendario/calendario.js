const JOBS_URL = 'https://api-remomn.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';

let userToken = '';
let myManagerId = null;

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_JEFE')) {
        Swal.fire({ icon: 'error', title: 'Acceso Denegado', confirmButtonColor: '#12CFF4' })
        .then(() => { window.location.href = '../../index.html'; });
        return;
    }

    document.getElementById('jefe-email-display').textContent = userEmail || 'Jefe';

    await cargarDatosYCronograma(userEmail);
});

async function cargarDatosYCronograma(emailActual) {
    try {
        Swal.fire({ title: 'Armando cronograma...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const users = await resUsers.json();
        const jefeActual = users.find(u => u.email === emailActual);
        if (jefeActual) myManagerId = jefeActual.userId;

        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const todosLosTrabajos = await resJobs.json();
        
        const misTrabajos = todosLosTrabajos.filter(job => job.managerId === myManagerId);

        const eventosFormateados = misTrabajos.map(job => {
            let bgColor = '#ff9800'; 
            if(job.status === 'IN_PROGRESS') bgColor = '#1e88e5'; 
            else if(job.status === 'COMPLETED') bgColor = '#2e7d32'; 
            else if(job.status === 'CANCELLED') bgColor = '#d32f2f'; 

            return {
                id: job.jobId,
                title: job.clientName,
                start: job.jobDate ? job.jobDate : new Date().toISOString().split('T')[0], 
                backgroundColor: bgColor,
                borderColor: bgColor,
                extendedProps: {
                    address: job.address,
                    description: job.description || 'Sin descripción',
                    status: job.status,
                    pay: job.pay,
                    employee: job.nameEmployee || 'Sin asignar',
                    clientPhone: job.clientPhone
                }
            };
        });

        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth', 
            locale: 'es',
            height: 'auto', 
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            buttonText: {
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                list: 'Agenda'
            },
            events: eventosFormateados,
            
            // LA MAGIA: Renderizado condicional según la vista
            eventContent: function(arg) {
                let p = arg.event.extendedProps;
                let icon = '';
                
                if(p.status === 'PENDING') icon = '<i class="fa-solid fa-clock"></i>';
                if(p.status === 'IN_PROGRESS') icon = '<i class="fa-solid fa-gear fa-spin"></i>';
                if(p.status === 'COMPLETED') icon = '<i class="fa-solid fa-check-double"></i>';
                if(p.status === 'CANCELLED') icon = '<i class="fa-solid fa-ban"></i>';

                let viewType = arg.view.type;

                // SI ESTAMOS EN VISTA AGENDA (LISTA)
                if (viewType === 'listWeek' || viewType === 'listMonth' || viewType === 'listDay') {
                    let customHtml = `
                        <div style="display: flex; flex-direction: column; gap: 6px; padding: 5px; width: 100%;">
                            
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-weight: 700; font-size: 1.15em; color: #0f4c81;">
                                    <span style="color: ${arg.event.backgroundColor}; margin-right: 5px;">${icon}</span> 
                                    ${arg.event.title}
                                </div>
                                <div style="font-weight: bold; color: #2e7d32; font-size: 1.1em;">
                                    $${p.pay.toFixed(2)}
                                </div>
                            </div>
                            
                            <div style="font-size: 0.9em; color: #555; display: flex; gap: 15px; flex-wrap: wrap;">
                                <span><strong><i class="fa-solid fa-user-tie" style="color: #198754;"></i> Emp:</strong> ${p.employee}</span>
                                <span><strong><i class="fa-solid fa-location-dot" style="color: #198754;"></i> Dir:</strong> ${p.address}</span>
                            </div>
                            
                            <div style="font-size: 0.9em; color: #444; font-style: italic; background: #F9FAFC; padding: 10px; border-left: 4px solid ${arg.event.backgroundColor}; border-radius: 6px; margin-top: 5px;">
                                "${p.description}"
                            </div>
                            
                        </div>
                    `;
                    return { html: customHtml };
                } 
                // SI ESTAMOS EN VISTA MES (CUADRITOS)
                else {
                    let customHtml = `
                        <div style="padding: 4px; color: white; line-height: 1.4; overflow: hidden;" title="Obra: ${p.description}">
                            <div style="font-weight: 700; font-size: 0.85em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 2px; margin-bottom: 3px;">
                                ${icon} ${arg.event.title}
                            </div>
                            <div style="font-size: 0.75em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                                <i class="fa-solid fa-user-tie"></i> ${p.employee}
                            </div>
                            <div style="font-size: 0.7em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; font-style: italic; opacity: 0.9; margin-top: 2px;">
                                "${p.description}"
                            </div>
                        </div>
                    `;
                    return { html: customHtml };
                }
            },

            // Popup al hacer clic (Igual de elegante que antes)
            eventClick: function(info) {
                const p = info.event.extendedProps;
                
                let estadoTxt = '';
                let badgeColor = '';
                
                if(p.status === 'PENDING') { estadoTxt = 'Pendiente'; badgeColor = '#ff9800'; }
                if(p.status === 'IN_PROGRESS') { estadoTxt = 'En Progreso'; badgeColor = '#1e88e5'; }
                if(p.status === 'COMPLETED') { estadoTxt = 'Completado'; badgeColor = '#2e7d32'; }
                if(p.status === 'CANCELLED') { estadoTxt = 'Cancelado'; badgeColor = '#d32f2f'; }

                Swal.fire({
                    title: `<h3 style="color:#0f4c81; margin:0; font-weight:700;">${info.event.title}</h3>`,
                    html: `
                        <div style="text-align: left; margin-top: 15px; font-family: 'Poppins', sans-serif;">
                            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px dashed #ccc;">
                                <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: bold;">
                                    ${estadoTxt}
                                </span>
                                <span style="font-weight: bold; color: #2e7d32; font-size: 1.2rem;">$${p.pay.toFixed(2)}</span>
                            </div>
                            <div style="padding-left: 5px;">
                                <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                    <strong><i class="fa-solid fa-phone" style="color:#198754; width:20px;"></i> Teléfono:</strong> ${p.clientPhone}
                                </p>
                                <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                    <strong><i class="fa-solid fa-location-dot" style="color:#198754; width:20px;"></i> Dirección:</strong> ${p.address}
                                </p>
                                <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                    <strong><i class="fa-solid fa-user-tie" style="color:#198754; width:20px;"></i> Empleado:</strong> ${p.employee}
                                </p>
                            </div>
                            <div style="margin-top: 20px; padding: 15px; background: #F9FAFC; border-radius: 8px; border: 1px solid #E0E5F2;">
                                <strong style="color: #2B3674; font-size: 13px;"><i class="fa-solid fa-align-left"></i> Descripción de la obra:</strong>
                                <p style="margin: 8px 0 0 0; font-size: 13px; color: #555; font-style: italic; line-height: 1.5;">
                                    "${p.description}"
                                </p>
                            </div>
                        </div>
                    `,
                    confirmButtonColor: '#12CFF4',
                    confirmButtonText: 'Cerrar detalle',
                    width: '450px',
                    showClass: { popup: 'animate__animated animate__fadeInUp animate__faster' },
                    hideClass: { popup: 'animate__animated animate__fadeOutDown animate__faster' }
                });
            }
        });

        calendar.render();
        Swal.close();

    } catch (error) {
        Swal.close();
        console.error("Error al cargar calendario:", error);
        Swal.fire('Error', 'No se pudieron cargar los datos del calendario.', 'error');
    }
}

window.cerrarSesion = () => {
    const rolesString = localStorage.getItem('user_roles');
    let userRoles = [];
    if (rolesString) { 
        try { userRoles = JSON.parse(rolesString); } catch(e) { console.error("Error al leer roles"); } 
    }

    if (userRoles.length > 1) {
        Swal.fire({
            title: "¿Qué deseas hacer?",
            text: "Selecciona si deseas salir del sistema o cambiar tu rol de trabajo.",
            icon: "question",
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: "#12CFF4", // Color por defecto armónico
            denyButtonColor: "#00B8A9",
            cancelButtonColor: "#2E3238",
            confirmButtonText: "Sí, salir",
            denyButtonText: "Cambiar de Rol",
            cancelButtonText: "Cancelar"
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = '../../index.html';
            } else if (result.isDenied) {
                mostrarSelectorDeRolesDesdeJefe(userRoles, true);
            }
        });
    } else {
        Swal.fire({
            title: "¿Cerrar sesión?",
            text: "¿Estás seguro que deseas salir?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#12CFF4",
            cancelButtonColor: "#2E3238",
            confirmButtonText: "Sí, salir",
            cancelButtonText: "Cancelar"
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = '../../index.html';
            }
        });
    }
};
// Declararla en window asegura que esté disponible globalmente en todo el script
window.mostrarSelectorDeRolesDesdeJefe = (roles, esSubcarpeta) => {
    if (typeof cerrarModalPerfil === 'function') {
        cerrarModalPerfil(); 
    } else {
        const modales = document.querySelectorAll('.modal-overlay');
        modales.forEach(m => m.style.display = 'none');
    }

    const prefijoRaiz = esSubcarpeta ? '../../' : '../';
    const prefijoJefe = esSubcarpeta ? '../' : '';

    const contenedor = document.createElement('div');
    contenedor.style.display = 'flex';
    contenedor.style.flexDirection = 'column';
    contenedor.style.gap = '10px';
    contenedor.style.marginTop = '15px';

    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';
        
        if (rol === 'ROLE_ADMIN') { 
            nombreRol = 'Acceder como Administrador'; 
            url = `${prefijoRaiz}admin/admin-dashboard.html`; 
        }
        if (rol === 'ROLE_JEFE') { 
            nombreRol = 'Acceder como Jefe'; 
            url = `${prefijoJefe}jefe-dashboard.html`; 
        }
        if (rol === 'ROLE_EMPLOYEE') { 
            nombreRol = 'Acceder como Subcontratista'; 
            url = `${prefijoRaiz}employee/employee-dashboard.html`; 
        }

        if (nombreRol) {
            const boton = document.createElement('button');
            boton.className = 'swal2-confirm swal2-styled';
            boton.style.width = '100%';
            boton.style.margin = '0';
            boton.style.backgroundColor = '#00B8A9';
            boton.style.cursor = 'pointer';
            boton.textContent = nombreRol;
            
            boton.addEventListener('click', () => {
                window.location.href = url;
            });

            contenedor.appendChild(boton);
        }
    });

    Swal.fire({
        title: 'Selecciona tu área de trabajo',
        html: contenedor, 
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#2E3238'
    });
};