const JOBS_URL = 'https://api-remomn.onrender.com/api/v1/jobs/all';
const USERS_URL = 'https://api-remomn.onrender.com/api/v1/user/all-users';
const MATERIALS_URL = 'https://api-remomn.onrender.com/api/v1/materials/all';
const UPDATE_URL = 'https://api-remomn.onrender.com/api/v1/job-updates/create';
const USER_API_URL = 'https://api-remomn.onrender.com/api/v1/user';

let userToken = '';
let myEmployeeId = null;
let currentJobInfo = null;
let miUsuarioActual = null;

let archivosSeleccionados = [];
let imagenesBase64Data = [];
let matQuantityInfo = ''

// Variables para la doble firma
let canvasSub, ctxSub, canvasCli, ctxCli;
let drawingSub = false, drawingCli = false;

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
        Swal.fire({ icon: 'error', title: 'Acceso Denegado', confirmButtonColor: '#00B8A9' })
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

    document.getElementById('evModifications').addEventListener('change', (e) => {
        const priceContainer = document.getElementById('newPriceContainer');
        if (e.target.checked) {
            priceContainer.style.display = 'block';
            document.getElementById('evNewPrice').setAttribute('required', 'true');
        } else {
            priceContainer.style.display = 'none';
            document.getElementById('evNewPrice').removeAttribute('required');
            document.getElementById('evNewPrice').value = '';
        }
    });
});

async function cargarCalendarioEmpleado(emailActual) {
    try {
        Swal.fire({ title: 'Cargando tus trabajos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const resUsers = await fetch(USERS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const users = await resUsers.json();
        const yo = users.find(u => u.email.toLowerCase() === emailActual.toLowerCase());

        if (yo) {
            myEmployeeId = yo.userId;
            miUsuarioActual = yo;
            document.getElementById('employee-email-display').textContent = `${yo.firstName} ${yo.lastName}`;
        } else {
            document.getElementById('employee-email-display').textContent = emailActual;
        }

        const resJobs = await fetch(JOBS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const todosLosTrabajos = await resJobs.json();
        const misTrabajos = todosLosTrabajos.filter(job => job.employeeId === myEmployeeId);

        const eventosFormateados = misTrabajos.map(job => {
            let bgColor = '#F59E0B';
            if (job.status === 'IN_PROGRESS') bgColor = '#00B8A9';
            if (job.status === 'COMPLETED') bgColor = '#10B981';
            if (job.status === 'CANCELLED') bgColor = '#EF4444';

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

            eventClick: function (info) {
                const p = info.event.extendedProps;
                currentJobInfo = p;

                let estadoTxt = '';
                let badgeColor = '';
                let estaBloqueado = false;

                if (p.status === 'PENDING') { estadoTxt = 'Pendiente'; badgeColor = '#F59E0B'; }
                if (p.status === 'IN_PROGRESS') { estadoTxt = 'En Progreso'; badgeColor = '#00B8A9'; }
                if (p.status === 'COMPLETED') { estadoTxt = 'Completado'; badgeColor = '#10B981'; estaBloqueado = true; }
                if (p.status === 'CANCELLED') { estadoTxt = 'Cancelado'; badgeColor = '#EF4444'; estaBloqueado = true; }

                let htmlBloqueo = estaBloqueado
                    ? `<div style="margin-top: 15px; padding: 12px; background: rgba(16, 185, 129, 0.1); color: #111C44; border-radius: 8px; font-weight: bold; text-align: center; border: 1px solid #10B981;">
                        <i class="fa-solid fa-circle-check" style="color: #10B981;"></i> Proyecto Finalizado.
                       </div>`
                    : ``;

                Swal.fire({
                    title: `<h3 style="color:#111C44; margin:0; font-weight:700; text-align:center;">Detalles de la Orden</h3>`,
                    html: `
                        <div style="text-align: left; margin-top: 10px; font-family: 'Poppins', sans-serif;">
                            <div style="text-align:center; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 1px dashed #E2E8F0;">
                                <span style="background: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                                    Estado: ${estadoTxt}
                                </span>
                            </div>
                            
                            <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                                <strong><i class="fa-regular fa-calendar" style="color:#00B8A9; width:20px;"></i> Fecha:</strong> ${p.fechaHermosa}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                                <strong><i class="fa-solid fa-house" style="color:#00B8A9; width:20px;"></i> Propiedad / Contacto:</strong> ${p.clientName}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                                <strong><i class="fa-solid fa-phone" style="color:#00B8A9; width:20px;"></i> Teléfono:</strong> ${p.clientPhone}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                                <strong><i class="fa-solid fa-location-dot" style="color:#00B8A9; width:20px;"></i> Dirección:</strong> ${p.address}
                            </p>
                            <p style="margin: 8px 0; font-size: 14px; color: #2B3674;">
                                <strong><i class="fa-solid fa-key" style="color:#00B8A9; width:20px;"></i> Caja Fuerte:</strong> ${p.safeDepositBoxCodes || 'No requiere'}
                            </p>
                            
                            <p style="margin: 12px 0 8px 0; font-size: 15px; color: #F59E0B; font-weight: bold; background: #111C44; padding: 10px; border-radius: 8px; text-align: center;">
                                <i class="fa-solid fa-money-bill-wave"></i> Pago por este trabajo: $${parseFloat(p.pay || 0).toFixed(2)}
                            </p>

                            <div style="margin-top: 15px; padding: 12px; background: #F8FAFC; border-radius: 8px; border-left: 3px solid #00B8A9;">
                                <strong style="font-size: 13px; color: #111C44;">Notas de Trabajo:</strong>
                                <p style="margin: 5px 0 0 0; font-size: 13px; color: #A3AED0; font-style: italic;">"${p.description || 'Sin notas especiales'}"</p>
                            </div>
                            
                            <div style="position: relative; margin-top: 15px;">
                                <div id="swalMap" style="height: 180px; width: 100%; border-radius: 8px; border: 1px solid #ddd; z-index: 10;"></div>
                                <a href="https://maps.google.com/?q=${p.latitude},${p.longitude}" target="_blank" style="position: absolute; bottom: 10px; right: 10px; background: #111C44; color: white; padding: 8px 15px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: 0.2s;" onmouseover="this.style.background='#00B8A9'" onmouseout="this.style.background='#111C44'">
                                    <i class="fa-solid fa-map-location-dot"></i> Ir a la Obra
                                </a>
                            </div>
                            
                            ${htmlBloqueo}
                        </div>
                    `,
                    showCancelButton: true,
                    showConfirmButton: !estaBloqueado,
                    confirmButtonColor: '#00B8A9',
                    cancelButtonColor: '#1B254B',
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
        const resMat = await fetch(MATERIALS_URL, { headers: { 'Authorization': `Bearer ${userToken}` } });
        const materials = await resMat.json();
        const containerMat = document.getElementById('employeeMaterialsContainer');
        containerMat.innerHTML = '';

        if (!materials || materials.length === 0) {
            containerMat.innerHTML = '<p style="color: #64748B; font-size: 13px;">No hay materiales registrados.</p>';
            return;
        }

        materials.forEach(mat => {
            // Usamos mat.materialId para relacionar el checkbox con sus propios inputs
            containerMat.innerHTML += `
                <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #2B3674; font-weight: bold; cursor: pointer;">
                        <input type="checkbox" name="empMaterials" value="${mat.materialId}" data-name="${mat.name}" onchange="document.getElementById('opts_${mat.materialId}').style.display = this.checked ? 'flex' : 'none'">
                        ${mat.name}
                    </label>
                    
                    <div id="opts_${mat.materialId}" style="display: none; gap: 10px; margin-top: 8px; margin-left: 24px;">
                        <input type="number" id="qty_${mat.materialId}" placeholder="Nº (Ej: 26)" class="input-field" style="width: 80px; padding: 6px; border: 1px solid #12CFF4; border-radius: 5px;">
                        <input type="text" id="unit_${mat.materialId}" placeholder="Unidad (box, lámina, pie)" class="input-field" style="flex: 1; padding: 6px; border: 1px solid #12CFF4; border-radius: 5px;">
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

// --- NUEVA LÓGICA DE FIRMAS (DOBLE CANVAS) ---
window.inicializarCanvasFirma = () => {
    canvasSub = document.getElementById('signaturePadSub');
    if (canvasSub) ctxSub = canvasSub.getContext('2d');

    canvasCli = document.getElementById('signaturePadCli');
    if (canvasCli) ctxCli = canvasCli.getContext('2d');

    setTimeout(() => {
        if (canvasSub) { canvasSub.width = canvasSub.offsetWidth; canvasSub.height = canvasSub.offsetHeight; }
        if (canvasCli) { canvasCli.width = canvasCli.offsetWidth; canvasCli.height = canvasCli.offsetHeight; }
    }, 200);

    if (canvasSub) setupCanvasEvents(canvasSub, ctxSub, (val) => drawingSub = val, '#0F2D4A');
    if (canvasCli) setupCanvasEvents(canvasCli, ctxCli, (val) => drawingCli = val, '#0F2D4A');
};

function setupCanvasEvents(canvasObj, ctxObj, setDrawing, colorStroke) {
    const startPos = (e) => { setDrawing(true); draw(e); };
    const endPos = () => { setDrawing(false); ctxObj.beginPath(); };
    const draw = (e) => {
        if (canvasObj === canvasSub ? !drawingSub : !drawingCli) return;
        e.preventDefault();
        ctxObj.lineWidth = 2.5;
        ctxObj.lineCap = "round";
        ctxObj.strokeStyle = colorStroke;

        let x = e.clientX || (e.touches && e.touches[0].clientX);
        let y = e.clientY || (e.touches && e.touches[0].clientY);
        const rect = canvasObj.getBoundingClientRect();
        x = x - rect.left; y = y - rect.top;

        ctxObj.lineTo(x, y); ctxObj.stroke(); ctxObj.beginPath(); ctxObj.moveTo(x, y);
    };

    canvasObj.addEventListener('mousedown', startPos);
    canvasObj.addEventListener('mouseup', endPos);
    canvasObj.addEventListener('mousemove', draw);
    canvasObj.addEventListener('touchstart', startPos, { passive: false });
    canvasObj.addEventListener('touchend', endPos);
    canvasObj.addEventListener('touchmove', draw, { passive: false });
}

window.limpiarFirmaSub = () => { if (ctxSub) ctxSub.clearRect(0, 0, canvasSub.width, canvasSub.height); };
window.limpiarFirmaCli = () => { if (ctxCli) ctxCli.clearRect(0, 0, canvasCli.width, canvasCli.height); };
// ------------------------------------------------

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
        reader.onload = function (e) {
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
    document.getElementById('newPriceContainer').style.display = 'none';

    archivosSeleccionados = [];
    imagenesBase64Data = [];
    matQuantityInfo = ''

    // Limpiamos los DOS canvas
    limpiarFirmaSub();
    limpiarFirmaCli();

    document.querySelectorAll('input[name="empMaterials"]').forEach(cb => {
        cb.checked = false;

        // 1. Ocultamos todos los cuadritos por defecto al abrir el modal limpio
        const divOpciones = document.getElementById('opts_' + cb.value);
        if (divOpciones) divOpciones.style.display = 'none';

        if (currentJobInfo) {
            let matArray = currentJobInfo.materials || currentJobInfo.jobMaterials || currentJobInfo.jobMaterial || [];
            const arrIdMateriales = matArray.map(m => m.materialId || (m.material && m.material.materialId) || m.id);

            if (arrIdMateriales.includes(parseInt(cb.value))) {
                cb.checked = true;

                // 2. LA MAGIA: Si el jefe ya lo asignó, mostramos los cuadritos automáticamente
                if (divOpciones) divOpciones.style.display = 'flex';
            }
        }
    });

    document.getElementById('modalEvidence').style.display = 'flex';

    // Redimensionamos ambos canvas al abrir el modal
    setTimeout(() => {
        if (canvasSub) { canvasSub.width = canvasSub.offsetWidth; canvasSub.height = canvasSub.offsetHeight; }
        if (canvasCli) { canvasCli.width = canvasCli.offsetWidth; canvasCli.height = canvasCli.offsetHeight; }
    }, 100);
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

    if (!payload.firstName || !payload.lastName || !payload.dni || !payload.phone || !payload.email) {
        return Swal.fire('Atención', 'Por favor llena todos los campos obligatorios.', 'warning');
    }

    Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

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
            Swal.fire({ icon: 'success', title: '¡Actualizado!', confirmButtonColor: '#00B8A9', timer: 1500 });
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar.', confirmButtonColor: '#00B8A9' });
        }
    } catch (error) { Swal.fire('Error de red', 'Fallo de conexión.', 'error'); }
};

// --- GUARDAR REPORTE ---
window.guardarReporteYPdf = async () => {
    const status = document.getElementById('evStatus').value;
    let comment = document.getElementById('evComment').value.trim();

    if (status === 'COMPLETED' && !document.getElementById('evCertification').checked) {
        return Swal.fire({ icon: 'warning', title: 'Certificación Obligatoria', text: 'Para terminar el proyecto debes marcar la casilla de Certificación de Garantía.', confirmButtonColor: '#00B8A9' });
    }

    // Validación doble firma
    const isCanvasBlank = (c) => {
        if (!c) return true;
        const blank = document.createElement('canvas');
        blank.width = c.width; blank.height = c.height;
        return c.toDataURL() === blank.toDataURL();
    };

    if (isCanvasBlank(canvasSub)) {
        return Swal.fire({ icon: 'warning', title: 'Falta tu Firma', text: 'Debes firmar el reporte como subcontratista.', confirmButtonColor: '#12CFF4' });
    }
    if (isCanvasBlank(canvasCli)) {
        return Swal.fire({ icon: 'warning', title: 'Falta Firma del Cliente', text: 'Por favor, solicita la firma de conformidad del cliente.', confirmButtonColor: '#F4A300' });
    }

    if (!comment) return Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Debes escribir un comentario.', confirmButtonColor: '#00B8A9' });
    if (archivosSeleccionados.length === 0) return Swal.fire({ icon: 'warning', title: 'Faltan fotos', text: 'Debes adjuntar al menos una imagen.', confirmButtonColor: '#00B8A9' });

    const hasModifications = document.getElementById('evModifications').checked;
    const newPriceVal = document.getElementById('evNewPrice').value;

    if (hasModifications) {
        if (!newPriceVal) {
            return Swal.fire({ icon: 'warning', title: 'Falta el precio', text: 'Marcaste la alerta de modificación. Debes ingresar el nuevo precio.', confirmButtonColor: '#00B8A9' });
        }
        comment = `⚠️ [ALERTA DE OFICINA]: Se hicieron modificaciones o cambios a la orden original.\nNUEVO PRECIO SUGERIDO: $${parseFloat(newPriceVal).toFixed(2)}\n\n` + comment;

        document.getElementById('pdfNewPriceRow').style.display = 'table-row';
        document.getElementById('pdfNewPrice').textContent = `$${parseFloat(newPriceVal).toFixed(2)}`;
    } else {
        document.getElementById('pdfNewPriceRow').style.display = 'none';
    }

    const selectedMatNodes = document.querySelectorAll('input[name="empMaterials"]:checked');
    const selectedMaterialIds = [];
    let selectedMaterialNames = '';
    let resumenMaterialesBD = '';

    selectedMatNodes.forEach(cb => {
        const matId = parseInt(cb.value);
        selectedMaterialIds.push(matId); // Guardamos el ID para tu backend
        const nombreMat = cb.getAttribute('data-name');

        // Capturamos el número y la palabra de la unidad
        const cantidad = document.getElementById(`qty_${matId}`).value.trim() || '-';
        const unidad = document.getElementById(`unit_${matId}`).value.trim() || '';

        // Armamos la frase final
        const cantidadTexto = cantidad !== '-' ? `${cantidad} ${unidad}`.trim() : 'No especificada';

        // 1. Lo que saldrá impreso en el PDF
        selectedMaterialNames += `<li style="margin-bottom: 6px; color: #2E3238;"><strong>${nombreMat}</strong>: <span style="color: #12CFF4; font-weight: bold;">${cantidadTexto}</span></li>`;

        // 2. Lo que se guardará en texto para tu Base de Datos
        resumenMaterialesBD += `📦 ${nombreMat}: ${cantidadTexto}\n`;
    });

    // Unimos los materiales al comentario general que va a tu servidor
    if (resumenMaterialesBD !== '') {
        comment = `[MATERIALES REPORTADOS]:\n${resumenMaterialesBD}\n\n[COMENTARIOS]:\n${comment}`;
    }

    Swal.fire({ title: 'Generando PDF y subiendo reporte...', text: 'No cierres esta ventana', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    if (!currentJobInfo) {
        return Swal.fire({ icon: 'error', title: 'Error del sistema', text: 'No se encontraron los datos del trabajo actual.', confirmButtonColor: '#00B8A9' });
    }

    const pagoSeguroPDF = currentJobInfo.pay ? parseFloat(currentJobInfo.pay).toFixed(2) : '0.00';

    document.getElementById('pdfJobName').textContent = currentJobInfo.clientName || 'Sin asignar';
    document.getElementById('pdfAddress').textContent = currentJobInfo.address || 'Sin dirección';
    document.getElementById('pdfClientPhone').textContent = currentJobInfo.clientPhone || 'No registrado';
    document.getElementById('pdfEmployee').textContent = document.getElementById('employee-email-display').textContent;
    document.getElementById('pdfJobPay').textContent = `$${pagoSeguroPDF}`;
    document.getElementById('pdfStatus').textContent = status === 'COMPLETED' ? 'Completado' : 'En Progreso';


    const hoy = new Date();
    const fechaActual = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    document.getElementById('pdfDate').textContent = fechaActual;


    // Si el empleado puso cantidades, lo agregamos al comentario para que se guarde en la Base de Datos
    if (matQuantityInfo) {
        comment = `📦 [CANTIDADES REPORTADAS]: ${matQuantityInfo}\n\n` + comment;
    }

    document.getElementById('pdfComment').textContent = comment;

    // Juntamos los checks de materiales con el texto de cantidades para el PDF
    let materialesHTML = selectedMaterialNames;
    if (matQuantityInfo) {
        materialesHTML += `<li style="margin-top: 6px; color: #0F2D4A;"><strong>Cantidades / Códigos:</strong> ${matQuantityInfo}</li>`;
    }

    if (materialesHTML) {
        document.getElementById('pdfMaterials').innerHTML = materialesHTML;
    } else {
        document.getElementById('pdfMaterials').innerHTML = '<li>No se reportaron materiales ni cantidades adicionales.</li>';
    }

    document.getElementById('pdfGuaranteeBox').style.display = status === 'COMPLETED' ? 'block' : 'none';

    // Inyección de fotos usando inline-block seguro y evitando cortes por imagen
    document.getElementById('pdfImages').innerHTML = imagenesBase64Data.map(b64 => `
        <div style="display: inline-block; width: 210px; margin: 8px; page-break-inside: avoid; border: 1px solid #E2E8F0; border-radius: 8px; padding: 5px; background: #ffffff; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <img src="${b64}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 6px;">
        </div>
    `).join('');

    // Inyectamos las DOS firmas en el PDF oculto de forma nativa
    document.getElementById('pdfSignatureSubImg').src = canvasSub.toDataURL("image/png");
    document.getElementById('pdfSignatureCliImg').src = canvasCli.toDataURL("image/png");


    const pdfWrapper = document.getElementById('pdfWrapper');
    const element = document.getElementById('pdfTemplate');

    // LA SOLUCIÓN: Lo hacemos "visible" para que html2canvas pueda renderizar las fotos y firmas, 
    // pero lo escondemos fuera de la pantalla (top: -10000px) para que el usuario no lo vea parpadear.
    pdfWrapper.style.display = 'block';
    pdfWrapper.style.position = 'absolute';
    pdfWrapper.style.top = '-10000px'; 
    pdfWrapper.style.left = '0';
    pdfWrapper.style.width = '750px';
    pdfWrapper.style.zIndex = '-9999';
    pdfWrapper.style.visibility = 'visible'; 

    // Damos un poco más de tiempo (400ms) para asegurar que las firmas en Base64 carguen en el DOM
    await new Promise(r => setTimeout(r, 400)); 

    const pdfFileName = `Reporte_${(currentJobInfo.clientName || 'Trabajo').replace(/\s+/g, '_')}.pdf`;

    // Simplificamos la configuración y quitamos el onclone que daba fallos
    const opt = {
        margin: [10, 10, 10, 10], // Un margen más seguro para que no se corte
        filename: pdfFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    let pdfBlob;
    try {
        pdfBlob = await html2pdf().set(opt).from(element).output('blob');
    } catch (e) {
        console.error("Error al generar PDF:", e);
        // Reseteamos las propiedades si falla
        pdfWrapper.style.display = 'none';
        pdfWrapper.style.visibility = 'hidden'; 
        return Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un problema al crear el archivo PDF.', confirmButtonColor: '#00B8A9' });
    }

    // Reseteamos las propiedades al terminar
    pdfWrapper.style.display = 'none';
    pdfWrapper.style.visibility = 'hidden';


    const dtoObject = {
        comment: comment,
        jobId: parseInt(currentJobInfo.jobId),
        employeeId: myEmployeeId,
        status: status,
        materialIds: selectedMaterialIds,
        newPrice: hasModifications && newPriceVal ? parseFloat(newPriceVal) : null
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
            Swal.fire({ icon: 'success', title: '¡Éxito!', text: 'El reporte se subió correctamente y el Administrador será notificado.', confirmButtonColor: '#00B8A9' });
            cerrarModalEvidence();
            await cargarCalendarioEmpleado(document.getElementById('employee-email-display').textContent);
        } else {
            let errorMsg = 'Hubo un fallo al subir las evidencias.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) { }
            Swal.fire({ icon: 'error', title: 'Error del servidor', html: errorMsg, confirmButtonColor: '#00B8A9' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error de Red', text: 'No se pudo conectar con el servidor.', confirmButtonColor: '#00B8A9' });
    }
};

window.cerrarSesion = () => {
    Swal.fire({
        title: "¿Cerrar sesión?",
        text: "¿Estás seguro que deseas salir del portal?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#00B8A9",
        cancelButtonColor: "#1B254B",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../index.html';
        }
    });
};