const JOBS_URL = 'http://localhost:8081/api/v1/jobs/all';
const USERS_URL = 'http://localhost:8081/api/v1/user/all-users';
const MATERIALS_URL = 'http://localhost:8081/api/v1/materials/all';
const UPDATE_URL = 'http://localhost:8081/api/v1/job-updates/create';
const USER_API_URL = 'http://localhost:8081/api/v1/user'; 

let userToken = '';
let myEmployeeId = null;
let currentJobInfo = null; 
let miUsuarioActual = null; 

let archivosSeleccionados = [];
let imagenesBase64Data = []; 

let canvas, ctx;
let drawing = false;

function formatearFecha(fecha) {
    if (!fecha) return 'Sin fecha asignada';
    if (Array.isArray(fecha)) {
        const dia = String(fecha[2]).padStart(2, '0');
        const mes = String(fecha[1]).padStart(2, '0');
        const anio = fecha[0];
        return `${dia}/${mes}/${anio}`;
    } 
    else if (typeof fecha === 'string') {
        const partes = fecha.split('-');
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
    }
    return fecha;
}

function fechaParaCalendario(fecha) {
    if (!fecha) return new Date().toISOString().split('T')[0];
    if (Array.isArray(fecha)) {
        const dia = String(fecha[2]).padStart(2, '0');
        const mes = String(fecha[1]).padStart(2, '0');
        const anio = fecha[0];
        return `${anio}-${mes}-${dia}`;
    }
    return fecha;
}

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_EMPLOYEE')) {
        Swal.fire({ icon: 'error', title: 'Acceso Denegado', confirmButtonColor: '#12CFF4' })
        .then(() => { window.location.href = '../index.html'; });
        return;
    }

    inicializarCanvasFirma();
    await cargarMateriales();
    await cargarCalendarioEmpleado(userEmail);

    document.getElementById('evStatus').addEventListener('change', (e) => {
        const certBox = document.getElementById('certBox');
        if (e.target.value === 'COMPLETED') {
            certBox.style.display = 'block';
        } else {
            certBox.style.display = 'none';
            document.getElementById('evCertification').checked = false;
        }
    });
});

async function cargarCalendarioEmpleado(emailActual) {
    try {
        Swal.fire({ title: 'Cargando tus trabajos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const users = await resUsers.json();
        const yo = users.find(u => u.email.toLowerCase() === emailActual.toLowerCase());
        
        if (yo) {
            myEmployeeId = yo.userId;
            miUsuarioActual = yo;
            document.getElementById('employee-email-display').textContent = `${yo.firstName} ${yo.lastName}`;
        } else {
            document.getElementById('employee-email-display').textContent = emailActual;
        }

        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const todosLosTrabajos = await resJobs.json();
        const misTrabajos = todosLosTrabajos.filter(job => job.employeeId === myEmployeeId);

        const eventosFormateados = misTrabajos.map(job => {
            // COLORES DE LA NUEVA PALETA PARA EL CALENDARIO
            let bgColor = '#F4A300'; // PENDING -> Gold
            if(job.status === 'IN_PROGRESS') bgColor = '#12CFF4'; // Cyan
            if(job.status === 'COMPLETED') bgColor = '#0B0B0D'; // Black
            if(job.status === 'CANCELLED') bgColor = '#2E3238'; // Slate

            return {
                id: job.jobId,
                title: job.clientName,
                start: fechaParaCalendario(job.jobDate), 
                backgroundColor: bgColor,
                borderColor: bgColor,
                extendedProps: {
                    ...job,
                    fechaHermosa: formatearFecha(job.jobDate)
                } 
            };
        });

        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth', 
            locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next', center: 'title', right: 'dayGridMonth,listWeek' },
            events: eventosFormateados,
            
            eventClick: function(info) {
                const p = info.event.extendedProps;
                currentJobInfo = p; 
                
                let estadoTxt = ''; 
                let badgeColor = '';
                let estaBloqueado = false; 

                if(p.status === 'PENDING') { estadoTxt = 'Pendiente'; badgeColor = '#F4A300'; }
                if(p.status === 'IN_PROGRESS') { estadoTxt = 'En Progreso'; badgeColor = '#12CFF4'; }
                if(p.status === 'COMPLETED') { estadoTxt = 'Completado'; badgeColor = '#0B0B0D'; estaBloqueado = true; }
                if(p.status === 'CANCELLED') { estadoTxt = 'Cancelado'; badgeColor = '#2E3238'; estaBloqueado = true; }

                let htmlBloqueo = estaBloqueado 
                    ? `<div style="margin-top: 15px; padding: 12px; background: rgba(18, 207, 244, 0.1); color: #0B0B0D; border-radius: 8px; font-weight: bold; text-align: center; border: 1px solid #12CFF4;">
                        <i class="fa-solid fa-circle-check" style="color: #12CFF4;"></i> Proyecto Finalizado.
                       </div>` 
                    : ``;

                Swal.fire({
                    title: `<h3 style="color:#0B0B0D; margin:0; font-weight:700; text-align:center;">Detalles de la Orden</h3>`,
                    html: `
                        <div style="text-align: left; margin-top: 10px; font-family: 'Poppins', sans-serif;">
                            <div style="text-align:center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px dashed #ccc;">
                                <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                                    Estado: ${estadoTxt}
                                </span>
                            </div>
                            
                            <p style="margin: 8px 0; font-size: 14px; color: #2E3238;">
                                <strong><i class="fa-regular fa-calendar" style="color:#12CFF4; width:20px;"></i> Fecha:</strong> ${p.fechaHermosa}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2E3238;">
                                <strong><i class="fa-solid fa-house" style="color:#12CFF4; width:20px;"></i> Propiedad / Contacto:</strong> ${p.clientName}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2E3238;">
                                <strong><i class="fa-solid fa-phone" style="color:#12CFF4; width:20px;"></i> Teléfono Contacto:</strong> ${p.clientPhone}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2E3238;">
                                <strong><i class="fa-solid fa-location-dot" style="color:#12CFF4; width:20px;"></i> Dirección:</strong> ${p.address}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2E3238;">
                                <strong><i class="fa-solid fa-key" style="color:#12CFF4; width:20px;"></i> Código Caja Fuerte:</strong> ${p.safeDepositBoxCodes || 'No requiere'}
                            </p>
                            
                            <p style="margin: 12px 0 8px 0; font-size: 15px; color: #F4A300; font-weight: bold; background: #0B0B0D; padding: 8px; border-radius: 4px; text-align: center;">
                                <i class="fa-solid fa-money-bill-wave"></i> Pago por este trabajo: $${p.pay ? p.pay.toFixed(2) : '0.00'}
                            </p>

                            <div style="margin-top: 15px; padding: 12px; background: rgba(18, 207, 244, 0.05); border-radius: 8px; border-left: 3px solid #12CFF4;">
                                <strong style="font-size: 13px; color: #0B0B0D;">Notas de Trabajo:</strong>
                                <p style="margin: 5px 0 0 0; font-size: 13px; color: #2E3238; font-style: italic;">"${p.description || 'Sin notas especiales'}"</p>
                            </div>
                            
                            <div style="position: relative; margin-top: 15px;">
                                <div id="swalMap" style="height: 180px; width: 100%; border-radius: 8px; border: 1px solid #ddd; z-index: 10;"></div>
                                <a href="https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}" target="_blank" style="position: absolute; bottom: 10px; right: 10px; background: #0B0B0D; color: #12CFF4; padding: 8px 15px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.3); text-transform: uppercase;">
                                    <i class="fa-solid fa-map-location-dot"></i> Ir a la Obra
                                </a>
                            </div>
                            
                            ${htmlBloqueo}
                        </div>
                    `,
                    showCancelButton: true,
                    showConfirmButton: !estaBloqueado, 
                    confirmButtonColor: '#12CFF4',
                    cancelButtonColor: '#2E3238',
                    confirmButtonText: '<i class="fa-solid fa-camera"></i> Hacer Reporte',
                    cancelButtonText: 'Cerrar',
                    width: '450px',
                    didOpen: () => {
                        let swalMap = L.map('swalMap').setView([p.latitude, p.longitude], 15);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(swalMap);
                        L.marker([p.latitude, p.longitude]).addTo(swalMap);
                        setTimeout(() => swalMap.invalidateSize(), 100);
                    }
                }).then((result) => {
                    if (result.isConfirmed && !estaBloqueado) {
                        abrirModalEvidence(info.event.id);
                    }
                });
            }
        });

        calendar.render();
        Swal.close();
    } catch (error) { console.error(error); }
}

async function cargarMateriales() {
    try {
        const resMat = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const materials = await resMat.json();
        const containerMat = document.getElementById('employeeMaterialsContainer');
        containerMat.innerHTML = '';
        materials.forEach(mat => {
            containerMat.innerHTML += `
                <label style="display: block; margin-bottom: 5px; cursor: pointer; color: #2E3238; font-size: 14px; font-weight: 500;">
                    <input type="checkbox" name="empMaterials" value="${mat.materialId}" data-name="${mat.name}"> 
                    ${mat.name}
                </label>
            `;
        });
    } catch (e) { console.error(e); }
}

function inicializarCanvasFirma() {
    canvas = document.getElementById('signaturePad');
    ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const startPosition = (e) => { drawing = true; dibujar(e); };
    const finishedPosition = () => { drawing = false; ctx.beginPath(); };
    const dibujar = (e) => {
        if (!drawing) return;
        e.preventDefault(); 
        ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#12CFF4"; 

        let x = e.clientX || e.touches[0].clientX;
        let y = e.clientY || e.touches[0].clientY;
        const rect = canvas.getBoundingClientRect();
        x = x - rect.left; y = y - rect.top;

        ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
    };

    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', finishedPosition);
    canvas.addEventListener('mousemove', dibujar);
    canvas.addEventListener('touchstart', startPosition, {passive: false});
    canvas.addEventListener('touchend', finishedPosition);
    canvas.addEventListener('touchmove', dibujar, {passive: false});
}

window.limpiarFirma = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

window.mostrarPreview = (event) => {
    const input = event.target;
    if (input.files) {
        Array.from(input.files).forEach(file => { archivosSeleccionados.push(file); });
    }
    input.value = ''; 
    renderizarGaleriaFotos();
};

function renderizarGaleriaFotos() {
    const previewContainer = document.getElementById('imagePreviewContainer');
    previewContainer.innerHTML = '';
    imagenesBase64Data = []; 

    archivosSeleccionados.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const b64 = e.target.result;
            imagenesBase64Data[index] = b64; 
            
            const imgDiv = document.createElement('div');
            imgDiv.style.position = 'relative';
            imgDiv.style.display = 'inline-block';
            
            const img = document.createElement('img');
            img.src = b64; 
            img.className = 'preview-img';
            
            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-delete-photo';
            btnDelete.innerHTML = '✕';
            btnDelete.onclick = (e) => {
                e.preventDefault();
                eliminarFoto(index);
            };

            imgDiv.appendChild(img);
            imgDiv.appendChild(btnDelete);
            previewContainer.appendChild(imgDiv);
        }
        reader.readAsDataURL(file);
    });
}

window.eliminarFoto = (index) => {
    archivosSeleccionados.splice(index, 1); 
    renderizarGaleriaFotos(); 
};

window.abrirModalEvidence = (jobId) => {
    document.getElementById('evidenceForm').reset();
    document.getElementById('evJobId').value = jobId;
    document.getElementById('imagePreviewContainer').innerHTML = ''; 
    document.getElementById('certBox').style.display = 'none'; 
    
    archivosSeleccionados = [];
    imagenesBase64Data = [];
    limpiarFirma();
    
    document.querySelectorAll('input[name="empMaterials"]').forEach(cb => { cb.checked = false; });
    
    document.getElementById('modalEvidence').style.display = 'flex';
    setTimeout(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }, 100);
};

window.cerrarModalEvidence = () => { document.getElementById('modalEvidence').style.display = 'none'; };

// --- PERFIL ---
window.abrirModalPerfil = () => {
    if (!miUsuarioActual) { return Swal.fire('Error', 'Cargando datos...', 'error'); }
    document.getElementById('perfilFirstName').value = miUsuarioActual.firstName || '';
    document.getElementById('perfilLastName').value = miUsuarioActual.lastName || '';
    document.getElementById('perfilDni').value = miUsuarioActual.dni || '';
    document.getElementById('perfilPhone').value = miUsuarioActual.phone || '';
    document.getElementById('perfilEmail').value = miUsuarioActual.email || '';
    document.getElementById('perfilPassword').value = ''; 
    document.getElementById('modalPerfil').style.display = 'flex';
};

window.cerrarModalPerfil = () => { document.getElementById('modalPerfil').style.display = 'none'; };

window.guardarPerfil = async () => {
    const payload = {
        firstName: document.getElementById('perfilFirstName').value.trim(),
        middleName: miUsuarioActual.middleName || "",
        lastName: document.getElementById('perfilLastName').value.trim(),
        secondSurname: miUsuarioActual.secondSurname || "",
        dni: document.getElementById('perfilDni').value.trim(),
        phone: document.getElementById('perfilPhone').value.trim(),
        email: document.getElementById('perfilEmail').value.trim(),
        password: document.getElementById('perfilPassword').value, 
        dateOfBirth: miUsuarioActual.dateOfBirth, 
        title: miUsuarioActual.title || "Empleado" 
    };

    if(!payload.firstName || !payload.lastName || !payload.dni || !payload.phone || !payload.email) {
        return Swal.fire('Atención', 'Por favor llena todos los campos obligatorios.', 'warning');
    }

    Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
        const response = await fetch(`${USER_API_URL}/edit-user/${miUsuarioActual.userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const updatedUser = await response.json(); 
            miUsuarioActual = updatedUser; 
            document.getElementById('employee-email-display').textContent = `${updatedUser.firstName} ${updatedUser.lastName}`;
            cerrarModalPerfil();
            Swal.fire({ icon: 'success', title: '¡Actualizado!', confirmButtonColor: '#12CFF4', timer: 1500 });
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar.', confirmButtonColor: '#12CFF4'});
        }
    } catch (error) { Swal.fire('Error de red', 'Fallo de conexión.', 'error'); }
};

// --- GUARDAR REPORTE ---
window.guardarReporteYPdf = async () => {
    const jobId = document.getElementById('evJobId').value;
    const status = document.getElementById('evStatus').value;
    let comment = document.getElementById('evComment').value.trim();

    if (status === 'COMPLETED' && !document.getElementById('evCertification').checked) {
        return Swal.fire({ icon: 'warning', title: 'Certificación Obligatoria', text: 'Para terminar el proyecto debes marcar la casilla de Certificación de Garantía.', confirmButtonColor: '#12CFF4' });
    }

    const isCanvasBlank = () => {
        const blank = document.createElement('canvas');
        blank.width = canvas.width; blank.height = canvas.height;
        return canvas.toDataURL() === blank.toDataURL();
    };

    if (!comment) return Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Debes escribir un comentario.', confirmButtonColor: '#12CFF4' });
    if (archivosSeleccionados.length === 0) return Swal.fire({ icon: 'warning', title: 'Faltan fotos', text: 'Debes adjuntar al menos una imagen.', confirmButtonColor: '#12CFF4' });
    if (isCanvasBlank()) return Swal.fire({ icon: 'warning', title: 'Falta la Firma', text: 'Debes firmar el reporte en el recuadro blanco.', confirmButtonColor: '#12CFF4' });

    const hasModifications = document.getElementById('evModifications').checked;
    if (hasModifications) {
        comment = "⚠️ [ALERTA DE OFICINA]: Se hicieron modificaciones o cambios a la orden original.\n\n" + comment;
    }

    const selectedMatNodes = document.querySelectorAll('input[name="empMaterials"]:checked');
    const selectedMaterialIds = Array.from(selectedMatNodes).map(cb => parseInt(cb.value));
    const selectedMaterialNames = Array.from(selectedMatNodes).map(cb => `<li style="margin-bottom: 3px;">${cb.getAttribute('data-name')}</li>`).join('');

    Swal.fire({ title: 'Generando PDF y subiendo reporte...', text: 'No cierres esta ventana', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    // LLENADO DEL PDF
    document.getElementById('pdfJobName').textContent = currentJobInfo.clientName;
    document.getElementById('pdfAddress').textContent = currentJobInfo.address;
    document.getElementById('pdfClientPhone').textContent = currentJobInfo.clientPhone || 'No registrado';
    document.getElementById('pdfEmployee').textContent = document.getElementById('employee-email-display').textContent;
    document.getElementById('pdfJobPay').textContent = `$${currentJobInfo.pay ? currentJobInfo.pay.toFixed(2) : '0.00'}`;
    document.getElementById('pdfStatus').textContent = status === 'COMPLETED' ? 'Completado' : 'En Progreso';
    document.getElementById('pdfDate').textContent = formatearFecha(currentJobInfo.jobDate); 
    document.getElementById('pdfComment').textContent = comment;

    if (selectedMaterialNames) {
        document.getElementById('pdfMaterials').innerHTML = selectedMaterialNames;
    } else {
        document.getElementById('pdfMaterials').innerHTML = '<li>No se reportaron materiales adicionales.</li>';
    }
    
    document.getElementById('pdfGuaranteeBox').style.display = status === 'COMPLETED' ? 'block' : 'none';
    
    document.getElementById('pdfImages').innerHTML = imagenesBase64Data.map(b64 => `
        <div style="page-break-inside: avoid; margin-bottom: 5px;">
            <img src="${b64}" style="width: 160px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;">
        </div>
    `).join('');
    
    document.getElementById('pdfSignatureImg').src = canvas.toDataURL("image/png");

    const pdfWrapper = document.getElementById('pdfWrapper');
    pdfWrapper.style.display = 'block'; 
    
    await new Promise(r => setTimeout(r, 100)); 

    const element = document.getElementById('pdfTemplate');
    const pdfFileName = `Reporte_${currentJobInfo.clientName.replace(/\s+/g, '_')}.pdf`;

    const opt = {
        margin:       [10, 0, 10, 0], 
        filename:     pdfFileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    let pdfBlob;
    try {
        pdfBlob = await html2pdf().set(opt).from(element).output('blob');
        
        const urlDescarga = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = urlDescarga;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlDescarga);
    } catch (e) {
        pdfWrapper.style.display = 'none';
        console.error("Error al generar PDF:", e);
        return Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un problema al crear el archivo PDF en tu navegador.', confirmButtonColor: '#12CFF4' });
    }

    pdfWrapper.style.display = 'none';

    const dtoObject = {
        comment: comment,
        jobId: parseInt(currentJobInfo.jobId),
        employeeId: myEmployeeId,
        status: status,
        materialIds: selectedMaterialIds
    };
    
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(dtoObject)], { type: 'application/json' }));
    
    for (let i = 0; i < archivosSeleccionados.length; i++) { 
        formData.append('files', archivosSeleccionados[i]); 
    }
    
    formData.append('files', pdfBlob, pdfFileName);

    try {
        const response = await fetch(UPDATE_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });

        if (response.ok) {
            Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'El reporte se subió correctamente y el Administrador será notificado.', confirmButtonColor: '#12CFF4' });
            cerrarModalEvidence();
            await cargarCalendarioEmpleado(document.getElementById('employee-email-display').textContent);
        } else {
            let errorMsg = 'Hubo un fallo al subir las evidencias.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch(e) {}
            Swal.fire({ icon: 'error', title: 'Error del servidor', html: errorMsg, confirmButtonColor: '#12CFF4' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de Red', text: 'No se pudo conectar con el servidor.', confirmButtonColor: '#12CFF4' });
    }
};

window.cerrarSesion = () => { 
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del portal?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#12CFF4",
        cancelButtonColor: "#2E3238",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../index.html';
        }
    });
};