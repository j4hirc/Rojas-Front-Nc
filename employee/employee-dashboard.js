const JOBS_URL = 'http://localhost:8081/api/v1/jobs/all';
const USERS_URL = 'http://localhost:8081/api/v1/user/all-users';
const MATERIALS_URL = 'http://localhost:8081/api/v1/materials/all';
const UPDATE_URL = 'http://localhost:8081/api/v1/job-updates/create';

let userToken = '';
let myEmployeeId = null;
let currentJobInfo = null; 
let imagenesBase64Data = []; 

let canvas, ctx;
let drawing = false;

// FUNCIÓN PARA QUE LA FECHA NO SALGA "VIRADA" (De YYYY-MM-DD a DD/MM/YYYY)
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
        Swal.fire({ icon: 'error', title: 'Acceso Denegado', confirmButtonColor: '#0277bd' })
        .then(() => { window.location.href = '../index.html'; });
        return;
    }

    document.getElementById('employee-email-display').textContent = userEmail || 'Empleado';

    inicializarCanvasFirma();
    await cargarMateriales();
    await cargarCalendarioEmpleado(userEmail);
});

// --- LÓGICA DEL CALENDARIO ---
async function cargarCalendarioEmpleado(emailActual) {
    try {
        Swal.fire({ title: 'Cargando tus trabajos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const users = await resUsers.json();
        const yo = users.find(u => u.email === emailActual);
        
        if (yo) myEmployeeId = yo.userId;

        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` }});
        const todosLosTrabajos = await resJobs.json();
        const misTrabajos = todosLosTrabajos.filter(job => job.employeeId === myEmployeeId);

        const eventosFormateados = misTrabajos.map(job => {
            let bgColor = '#ff9800'; 
            if(job.status === 'IN_PROGRESS') bgColor = '#1e88e5'; 
            if(job.status === 'COMPLETED') bgColor = '#2e7d32'; 
            if(job.status === 'CANCELLED') bgColor = '#d32f2f';

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
            
            eventContent: function(arg) {
                let p = arg.event.extendedProps;
                let icon = '';
                if(p.status === 'PENDING') icon = '<i class="fa-solid fa-clock"></i>';
                if(p.status === 'IN_PROGRESS') icon = '<i class="fa-solid fa-gear fa-spin"></i>';
                if(p.status === 'COMPLETED') icon = '<i class="fa-solid fa-check-double"></i>';
                if(p.status === 'CANCELLED') icon = '<i class="fa-solid fa-ban"></i>';

                let viewType = arg.view.type;

                // VISTA AGENDA (LISTA)
                if (viewType === 'listWeek' || viewType === 'listMonth' || viewType === 'listDay') {
                    return { html: `
                        <div style="display: flex; flex-direction: column; gap: 6px; padding: 10px; width: 100%; color: #333;">
                            <div style="font-weight: 700; font-size: 1.2em; color: ${arg.event.backgroundColor}; border-bottom: 1px solid #E0E5F2; padding-bottom: 5px; margin-bottom: 5px;">
                                ${icon} ${arg.event.title}
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; font-size: 0.95em;">
                                <span><strong style="color:#0277bd;"><i class="fa-solid fa-location-dot"></i> Dir:</strong> ${p.address}</span>
                                <span><strong style="color:#0277bd;"><i class="fa-solid fa-phone"></i> Tel:</strong> ${p.clientPhone}</span>
                                <span><strong style="color:#0277bd;"><i class="fa-regular fa-calendar"></i> Fecha:</strong> ${p.fechaHermosa}</span>
                                <span><strong style="color:#0277bd;"><i class="fa-solid fa-hard-hat"></i> Jefe:</strong> ${p.nameManager || 'N/A'}</span>
                            </div>
                            <div style="font-size: 0.9em; color: #444; font-style: italic; background: #f8faff; padding: 10px; border-left: 3px solid ${arg.event.backgroundColor}; border-radius: 6px; margin-top: 5px;">
                                "${p.description}"
                            </div>
                        </div>` 
                    };
                } 
                // VISTA DE MES (CUADRITOS)
                else {
                    return { html: `
                        <div style="padding: 4px; color: white; line-height: 1.4; overflow: hidden;" title="Dir: ${p.address}\nDesc: ${p.description}">
                            <div style="font-weight: 700; font-size: 0.85em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.4); padding-bottom:2px; margin-bottom:2px;">
                                ${icon} ${arg.event.title}
                            </div>
                            <div style="font-size: 0.75em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                                <i class="fa-solid fa-location-dot"></i> ${p.address}
                            </div>
                            <div style="font-size: 0.75em; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                                <i class="fa-regular fa-calendar"></i> ${p.fechaHermosa}
                            </div>
                        </div>` 
                    };
                }
            },

            eventClick: function(info) {
                const p = info.event.extendedProps;
                currentJobInfo = p; 
                
                let estadoTxt = ''; 
                let badgeColor = '';
                let estaBloqueado = false; 

                if(p.status === 'PENDING') { estadoTxt = 'Pendiente'; badgeColor = '#ff9800'; }
                if(p.status === 'IN_PROGRESS') { estadoTxt = 'En Progreso'; badgeColor = '#1e88e5'; }
                if(p.status === 'COMPLETED') { estadoTxt = 'Completado'; badgeColor = '#2e7d32'; estaBloqueado = true; }
                if(p.status === 'CANCELLED') { estadoTxt = 'Cancelado'; badgeColor = '#d32f2f'; estaBloqueado = true; }

                let htmlBloqueo = estaBloqueado 
                    ? `<div style="margin-top: 15px; padding: 12px; background: #e8f5e9; color: #2e7d32; border-radius: 8px; font-weight: bold; text-align: center; border: 1px solid #c8e6c9;">
                        <i class="fa-solid fa-circle-check"></i> Proyecto Finalizado.
                       </div>` 
                    : ``;

                Swal.fire({
                    title: `<h3 style="color:#0f4c81; margin:0; font-weight:700; text-align:center;">${info.event.title}</h3>`,
                    html: `
                        <div style="text-align: left; margin-top: 10px; font-family: 'Poppins', sans-serif;">
                            <div style="text-align:center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px dashed #ccc;">
                                <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: bold;">
                                    Estado: ${estadoTxt}
                                </span>
                            </div>
                            
                            <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                <strong><i class="fa-regular fa-calendar" style="color:#0277bd; width:20px;"></i> Fecha:</strong> ${p.fechaHermosa}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                <strong><i class="fa-solid fa-phone" style="color:#0277bd; width:20px;"></i> Teléfono:</strong> ${p.clientPhone}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                <strong><i class="fa-solid fa-key" style="color:#0277bd; width:20px;"></i> Código Caja:</strong> ${p.safeDepositBoxCodes || 'No asignada'}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                <strong><i class="fa-solid fa-hard-hat" style="color:#0277bd; width:20px;"></i> Jefe:</strong> ${p.nameManager || 'Sin Asignar'}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #444;">
                                <strong><i class="fa-solid fa-location-dot" style="color:#0277bd; width:20px;"></i> Dirección:</strong> ${p.address}
                            </p>

                            <div style="margin-top: 15px; padding: 12px; background: #f8faff; border-radius: 8px; border-left: 3px solid #0277bd;">
                                <strong style="font-size: 13px; color: #2B3674;">Descripción de Obra:</strong>
                                <p style="margin: 5px 0 0 0; font-size: 13px; color: #555; font-style: italic;">"${p.description}"</p>
                            </div>
                            
                            <div style="position: relative; margin-top: 15px;">
                                <div id="swalMap" style="height: 180px; width: 100%; border-radius: 8px; border: 1px solid #ddd; z-index: 10;"></div>
                                <a href="https://www.google.com/maps/dir/?api=1&destination=$${p.latitude},${p.longitude}" target="_blank" style="position: absolute; bottom: 10px; right: 10px; background: #0277bd; color: white; padding: 8px 15px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                                    <i class="fa-solid fa-map-location-dot"></i> Ir a la Obra
                                </a>
                            </div>
                            
                            ${htmlBloqueo}
                        </div>
                    `,
                    showCancelButton: true,
                    showConfirmButton: !estaBloqueado, 
                    confirmButtonColor: '#0277bd',
                    cancelButtonColor: '#6c757d',
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
                <label style="display: block; margin-bottom: 5px; cursor: pointer; color: #2b3674; font-size: 14px;">
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
        ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#0f4c81"; 

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

window.mostrarPreview = () => {
    const input = document.getElementById('evidenceFiles');
    const previewContainer = document.getElementById('imagePreviewContainer');
    previewContainer.innerHTML = '';
    imagenesBase64Data = []; 

    if (input.files) {
        Array.from(input.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const b64 = e.target.result;
                imagenesBase64Data.push(b64); 
                const img = document.createElement('img');
                img.src = b64; img.className = 'preview-img';
                previewContainer.appendChild(img);
            }
            reader.readAsDataURL(file);
        });
    }
};

window.abrirModalEvidence = (jobId) => {
    document.getElementById('evidenceForm').reset();
    document.getElementById('evJobId').value = jobId;
    document.getElementById('imagePreviewContainer').innerHTML = ''; 
    imagenesBase64Data = [];
    limpiarFirma();
    
    document.querySelectorAll('input[name="empMaterials"]').forEach(cb => {
        cb.checked = false; 
        if (currentJobInfo.materials) {
            const arrIdMateriales = currentJobInfo.materials.map(m => m.materialId);
            if (arrIdMateriales.includes(parseInt(cb.value))) {
                cb.checked = true; 
            }
        }
    });
    
    document.getElementById('modalEvidence').style.display = 'flex';
    setTimeout(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }, 100);
};

window.cerrarModalEvidence = () => { document.getElementById('modalEvidence').style.display = 'none'; };

// --- GENERADOR DE PDF Y ENVÍO ---
window.guardarReporteYPdf = async () => {
    const jobId = document.getElementById('evJobId').value;
    const status = document.getElementById('evStatus').value;
    const comment = document.getElementById('evComment').value.trim();
    const filesInput = document.getElementById('evidenceFiles');

    const isCanvasBlank = () => {
        const blank = document.createElement('canvas');
        blank.width = canvas.width; blank.height = canvas.height;
        return canvas.toDataURL() === blank.toDataURL();
    };

    if (!comment) return Swal.fire('Faltan datos', 'Debes escribir un comentario.', 'warning');
    if (filesInput.files.length === 0) return Swal.fire('Faltan fotos', 'Debes adjuntar al menos una imagen.', 'warning');
    if (isCanvasBlank()) return Swal.fire('Falta la Firma', 'Debes firmar el reporte en el recuadro blanco.', 'warning');

    const selectedMatNodes = document.querySelectorAll('input[name="empMaterials"]:checked');
    const selectedMaterialIds = Array.from(selectedMatNodes).map(cb => parseInt(cb.value));
    const selectedMaterialNames = Array.from(selectedMatNodes).map(cb => `<li style="margin-bottom: 5px;">${cb.getAttribute('data-name')}</li>`).join('');

    Swal.fire({ title: 'Generando PDF y subiendo reporte...', text: 'No cierres esta ventana', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    // 1. Armar HTML del PDF
    document.getElementById('pdfJobName').textContent = currentJobInfo.clientName;
    document.getElementById('pdfAddress').textContent = currentJobInfo.address;
    document.getElementById('pdfEmployee').textContent = document.getElementById('employee-email-display').textContent;
    document.getElementById('pdfStatus').textContent = status === 'COMPLETED' ? 'Completado' : 'En Progreso';
    document.getElementById('pdfDate').textContent = formatearFecha(currentJobInfo.jobDate); 
    document.getElementById('pdfComment').textContent = comment;
    document.getElementById('pdfMaterials').innerHTML = selectedMaterialNames || '<li>No se seleccionaron materiales.</li>';
    
    // Las imágenes se configuran para centrarse en su caja Grid
    document.getElementById('pdfImages').innerHTML = imagenesBase64Data.map(b64 => `
        <div style="text-align:center;">
            <img src="${b64}" style="width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #ccc;">
        </div>
    `).join('');
    
    document.getElementById('pdfSignatureImg').src = canvas.toDataURL("image/png");

    const pdfWrapper = document.getElementById('pdfWrapper');
    pdfWrapper.style.display = 'block'; 
    
    await new Promise(r => setTimeout(r, 100)); 

    const element = document.getElementById('pdfTemplate');
    const pdfFileName = `Reporte_${currentJobInfo.clientName.replace(/\s+/g, '_')}.pdf`;

    // OPTIMIZACIONES DE MARGENES PARA A4
    const opt = {
        margin:       [15, 0, 15, 0], // [top, right, bottom, left] ajustado para centrar
        filename:     pdfFileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    let pdfBlob;
    try {
        pdfBlob = await html2pdf().set(opt).from(element).output('blob');
    } catch (e) {
        pdfWrapper.style.display = 'none';
        console.error("Error al generar PDF:", e);
        return Swal.fire('Error', 'Hubo un problema al crear el archivo PDF en tu navegador.', 'error');
    }

    pdfWrapper.style.display = 'none';

    // 3. Preparar los Datos para el Backend
    const dtoObject = {
        comment: comment,
        jobId: parseInt(jobId),
        employeeId: myEmployeeId,
        status: status,
        materialIds: selectedMaterialIds
    };
    
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(dtoObject)], { type: 'application/json' }));
    
    for (let i = 0; i < filesInput.files.length; i++) { 
        formData.append('files', filesInput.files[i]); 
    }
    
    formData.append('files', pdfBlob, pdfFileName);

    // 4. Enviar a Spring Boot
    try {
        const response = await fetch(UPDATE_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` },
            body: formData
        });

        if (response.ok) {
            const urlDescarga = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = urlDescarga;
            a.download = pdfFileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(urlDescarga);

            Swal.fire('¡Éxito!', 'El reporte se subió correctamente y tu PDF se ha descargado.', 'success');
            cerrarModalEvidence();
            await cargarCalendarioEmpleado(document.getElementById('employee-email-display').textContent);
        } else {
            let errorMsg = 'Hubo un fallo al subir las evidencias.';
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData.message === 'object') {
                    errorMsg = Object.values(errorData.message).join('<br>');
                } else if (errorData && errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch(e) {}
            Swal.fire({ icon: 'error', title: 'Error del servidor', html: errorMsg });
        }
    } catch (error) {
        console.error(error);   
        Swal.fire('Error de Red', 'No se pudo conectar con el servidor.', 'error');
    }
};

window.cerrarSesion = () => { localStorage.clear(); window.location.href = '../index.html'; };