const API_URL = 'https://api-remomn.onrender.com/api/v1/materials';
const CATEGORIES_URL = 'https://api-remomn.onrender.com/api/v1/categories';
let userToken = '';
let todosLosMaterialesCache = []; 

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para acceder a esta sección.',
            confirmButtonColor: '#12CFF4'
        }).then(() => {
            window.location.href = '../../index.html';
        });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    await cargarMateriales();
    await cargarCategoriasEnSelect();
});

async function cargarMateriales() {
    try {
        const response = await fetch(`${API_URL}/all`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (response.ok) {
            const materiales = await response.json();
            todosLosMaterialesCache = materiales; 
            buscarMaterial();
        }
    } catch (error) {
        console.error('Error de red:', error);
        Swal.fire('Error de conexión', 'No se pudo cargar la lista de materiales.', 'error');
    }
}

window.buscarMaterial = () => {
    const textoBuscado = document.getElementById('buscadorMaterial').value.toLowerCase().trim();
    const categoriaSeleccionada = document.getElementById('filtroCategoria').value;

    let materialesFiltrados = todosLosMaterialesCache;

    if (textoBuscado !== "") {
        materialesFiltrados = materialesFiltrados.filter(mat =>
            mat.name && mat.name.toLowerCase().includes(textoBuscado)
        );
    }

    if (categoriaSeleccionada !== "todos") {
        materialesFiltrados = materialesFiltrados.filter(mat => {
            if (!mat.categoryName) return false;
            return mat.categoryName.toLowerCase().trim() === categoriaSeleccionada;
        });
    }

    renderizarMateriales(materialesFiltrados);
};

function renderizarMateriales(materiales) {
    const tableBody = document.getElementById('materialTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    tableBody.innerHTML = '';
    mobileContainer.innerHTML = '';

    if (materiales.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 30px; color: #A3AED0;">No se encontraron materiales.</td></tr>`;
        mobileContainer.innerHTML = `<p style="text-align:center; padding: 20px; color: #A3AED0;">No se encontraron materiales.</p>`;
        return;
    }

    materiales.forEach(mat => {
        const safeName = mat.name ? mat.name.replace(/'/g, "\\'") : '';
        const safeCategory = mat.categoryName ? mat.categoryName.replace(/'/g, "\\'") : '';
        
        // Asignamos 0 si viene null o indefinido desde la base de datos
        const safeCount = mat.count || 0;
        const safePrice = mat.price || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
    <td>#${mat.materialId}</td>
    <td style="font-weight: 600;">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 184, 169, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-box"></i></div>
            <div>
                ${mat.name} <span style="font-size: 0.8rem; font-weight: normal; color: var(--primary);">($${safePrice} - Disp: ${safeCount})</span><br>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Cat: ${mat.categoryName || 'Sin categoría'}</span>
            </div>
        </div>
    </td>
    <td style="text-align: center;">
        <div class="action-btns">
            <button class="btn-icon icon-edit" onclick="abrirModalEditarMat(${mat.materialId}, '${safeName}', '${safeCategory}', ${safeCount}, ${safePrice})" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon icon-delete" onclick="eliminarMaterial(${mat.materialId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
    </td>
`;
        tableBody.appendChild(tr);

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
    <div class="card-header">
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(0, 184, 169, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.1rem;"><i class="fa-solid fa-box"></i></div>
            <div>
                <strong style="color: var(--navy); font-size: 1.1rem; display: block;">${mat.name}</strong> 
                <span style="font-size: 0.8rem; color: var(--text-muted);">ID: #${mat.materialId} | Cat: ${mat.categoryName || 'N/A'}</span>
            </div>
        </div>
    </div>
    <div class="card-actions">
        <button class="btn-icon icon-edit" onclick="abrirModalEditarMat(${mat.materialId}, '${safeName}', '${safeCategory}', ${safeCount}, ${safePrice})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon icon-delete" onclick="eliminarMaterial(${mat.materialId})"><i class="fa-solid fa-trash"></i></button>
    </div>
`;
        mobileContainer.appendChild(card);
    });
}

async function cargarCategoriasEnSelect() {
    try {
        const response = await fetch(`${CATEGORIES_URL}/all`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            const categorias = await response.json();

            const selectModal = document.getElementById('matCategory');
            selectModal.innerHTML = '<option value="">-- Selecciona una categoría --</option>';

            const selectFiltro = document.getElementById('filtroCategoria');
            selectFiltro.innerHTML = '<option value="todos">Todas las categorías</option>';

            categorias.forEach(cat => {
                selectModal.innerHTML += `<option value="${cat.categoryId}">${cat.name}</option>`;
                selectFiltro.innerHTML += `<option value="${cat.name.toLowerCase()}">${cat.name}</option>`;
            });
        }
    } catch (error) {
        console.error("Error cargando categorías:", error);
    }
}

window.abrirModalCrearMat = () => {
    document.getElementById('formMaterial').reset();
    document.getElementById('materialId').value = '';
    
    if(document.getElementById('materialCount')) document.getElementById('materialCount').value = '';
    if(document.getElementById('materialPrice')) document.getElementById('materialPrice').value = '';

    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-box-open" style="color: var(--primary);"></i> Nuevo Material';
    document.getElementById('modalMaterial').style.display = 'flex';
};

window.abrirModalEditarMat = (id, name, categoryName, count, price) => {
    document.getElementById('formMaterial').reset();
    document.getElementById('materialId').value = id;
    document.getElementById('materialName').value = name;
    
    if(document.getElementById('materialCount')) document.getElementById('materialCount').value = count;
    if(document.getElementById('materialPrice')) document.getElementById('materialPrice').value = price;

    const select = document.getElementById('matCategory');
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].text === categoryName) {
            select.selectedIndex = i;
            break;
        }
    }

    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen" style="color: var(--primary);"></i> Editar Material';
    document.getElementById('modalMaterial').style.display = 'flex';
};

window.cerrarModalMat = () => {
    document.getElementById('modalMaterial').style.display = 'none';
};

window.guardarMaterial = async () => {
    const id = document.getElementById('materialId').value;
    const isEditing = id !== '';

    const name = document.getElementById('materialName').value.trim();
    const categoryId = document.getElementById('matCategory').value;
    
    const countInput = document.getElementById('materialCount');
    const priceInput = document.getElementById('materialPrice');
    
    // Si están vacíos, mandamos un 0 por defecto para que el backend no falle
    const count = (countInput && countInput.value !== '') ? countInput.value : '0';
    const price = (priceInput && priceInput.value !== '') ? priceInput.value : '0';

    if (!name || !categoryId) {
        return Swal.fire('Atención', 'El Nombre y la Categoría son obligatorios.', 'warning');
    }

    const payload = {
        name: name,
        count: parseInt(count),      
        price: parseFloat(price),    
        categoryId: parseInt(categoryId)
    };

    const url = isEditing ? `${API_URL}/update/${id}` : `${API_URL}/create`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            Swal.fire({ icon: 'success', title: '¡Éxito!', text: isEditing ? 'Material actualizado.' : 'Material agregado.', confirmButtonColor: '#00B8A9' });
            cerrarModalMat();
            await cargarMateriales();
            setTimeout(() => buscarMaterial(), 50);
        } else {
            const errorData = await response.json();
            Swal.fire({ icon: 'error', title: 'Error', text: errorData.message || 'No se pudo guardar el material.', confirmButtonColor: '#00B8A9' });
        }
    } catch (error) {
        console.error('Error al guardar:', error);
        Swal.fire('Fallo de conexión', 'No se pudo contactar con el servidor.', 'error');
    }
};

window.eliminarMaterial = async (id) => {
    Swal.fire({
        title: '¿Eliminar Material?',
        text: "Se borrará permanentemente de la base de datos.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#111C44',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_URL}/delete/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });

                if (res.ok) {
                    Swal.fire({ icon: 'success', title: '¡Eliminado!', text: 'El material fue borrado.', confirmButtonColor: '#00B8A9' });
                    await cargarMateriales();
                    setTimeout(() => buscarMaterial(), 50);
                } else {
                    Swal.fire('Error', 'No se pudo eliminar el material.', 'error');
                }
            } catch (e) {
                console.error(e);
            }
        }
    });
};

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
            confirmButtonColor: '#00B8A9',
            denyButtonColor: '#0f4c81', // Cambiamos a tu azul como secundario aquí
            cancelButtonColor: '#111C44',
            confirmButtonText: "Sí, salir",
            denyButtonText: "Cambiar de Rol",
            cancelButtonText: "Cancelar"
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.clear();
                window.location.href = '../../index.html';
            } else if (result.isDenied) {
                mostrarSelectorDeRolesEnSubcarpeta(userRoles);
            }
        });
    } else {
        Swal.fire({
            title: "¿Cerrar sesión?",
            text: "¿Estás seguro que deseas salir del sistema?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: '#00B8A9',
            cancelButtonColor: '#111C44',
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

function mostrarSelectorDeRolesEnSubcarpeta(roles) {
    if (typeof cerrarModalPerfil === 'function') {
        cerrarModalPerfil(); 
    } else {
        const modales = document.querySelectorAll('.modal-overlay');
        modales.forEach(m => m.style.display = 'none');
    }

    let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
    
    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';
        
        if(rol === 'ROLE_ADMIN') { 
            nombreRol = '<i class="fa-solid fa-user-tie"></i> Acceder como Administrador'; 
            url = '../admin-dashboard.html'; 
        }
        if(rol === 'ROLE_JEFE') { 
            nombreRol = '<i class="fa-solid fa-user-shield"></i> Acceder como Jefe'; 
            url = '../../jefe/jefe-dashboard.html'; 
        }
        if(rol === 'ROLE_EMPLOYEE') { 
            nombreRol = '<i class="fa-solid fa-helmet-safety"></i> Acceder como Subcontratista'; 
            url = '../../employee/employee-dashboard.html'; 
        }

        if(nombreRol) {
            opcionesHTML += `<button class="swal2-confirm swal2-styled" style="width: 100%; margin: 0; background-color: #00B8A9;" onclick="window.location.href='${url}'">${nombreRol}</button>`;
        }
    });
    
    opcionesHTML += '</div>';

    Swal.fire({
        title: 'Selecciona tu área de trabajo',
        html: opcionesHTML,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#111C44'
    });
}