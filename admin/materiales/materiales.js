const API_URL = 'https://api-remomn.onrender.com/api/v1/materials';
const CATEGORIES_URL = 'https://api-remomn.onrender.com/api/v1/categories';
let userToken = '';
let todosLosMaterialesCache = []; // Caché para que el buscador funcione rápido

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

// 1. CARGAMOS LA TABLA DE MATERIALES Y LOS GUARDAMOS EN CACHÉ
async function cargarMateriales() {
    try {
        const response = await fetch(`${API_URL}/all`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (response.ok) {
            const materiales = await response.json();
            todosLosMaterialesCache = materiales; // Guardamos en memoria para el buscador
            renderizarMateriales(materiales);
        }
    } catch (error) { 
        console.error('Error de red:', error);
        Swal.fire('Error de conexión', 'No se pudo cargar la lista de materiales.', 'error');
    }
}

// 2. FUNCIÓN DEL BUSCADOR (Se llama al escribir)
// 2. FUNCIÓN DEL BUSCADOR (Combina texto y categoría)
window.buscarMaterial = () => {
    // Capturamos el texto y la categoría
    const textoBuscado = document.getElementById('buscadorMaterial').value.toLowerCase().trim();
    const categoriaSeleccionada = document.getElementById('filtroCategoria').value;

    let materialesFiltrados = todosLosMaterialesCache;

    // Filtro 1: Por Nombre
    if (textoBuscado !== "") {
        materialesFiltrados = materialesFiltrados.filter(mat => 
            mat.name && mat.name.toLowerCase().includes(textoBuscado)
        );
    }

    // Filtro 2: Por Categoría (compara los values en minúscula que le dimos al select)
    if (categoriaSeleccionada !== "todos") {
        materialesFiltrados = materialesFiltrados.filter(mat => {
            if (!mat.categoryName) return false;
            return mat.categoryName.toLowerCase().trim() === categoriaSeleccionada;
        });
    }

    // Pintamos en pantalla
    renderizarMateriales(materialesFiltrados);
};

function renderizarMateriales(materiales) {
    const tableBody = document.getElementById('materialTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');
    
    tableBody.innerHTML = '';
    mobileContainer.innerHTML = '';

    if(materiales.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 30px; color: #A3AED0;">No se encontraron materiales.</td></tr>`;
        mobileContainer.innerHTML = `<p style="text-align:center; padding: 20px; color: #A3AED0;">No se encontraron materiales.</p>`;
        return;
    }

    materiales.forEach(mat => {
        // Escapamos los nombres para que el botón "Editar" no se rompa
        const safeName = mat.name ? mat.name.replace(/'/g, "\\'") : '';
        const safeCategory = mat.categoryName ? mat.categoryName.replace(/'/g, "\\'") : '';

        // --- VISTA DE TABLA (PC) ---
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${mat.materialId}</td>
            <td style="font-weight: 600;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 184, 169, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-box"></i></div>
                    <div>
                        ${mat.name}<br>
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Cat: ${mat.categoryName || 'Sin categoría'}</span>
                    </div>
                </div>
            </td>
            <td style="text-align: center;">
                <div class="action-btns">
                    <button class="btn-icon icon-edit" onclick="abrirModalEditarMat(${mat.materialId}, '${safeName}', '${safeCategory}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon icon-delete" onclick="eliminarMaterial(${mat.materialId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);

        // --- VISTA DE TARJETA (MÓVIL) ---
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
                <button class="btn-icon icon-edit" onclick="abrirModalEditarMat(${mat.materialId}, '${safeName}', '${safeCategory}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon icon-delete" onclick="eliminarMaterial(${mat.materialId})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        mobileContainer.appendChild(card);
    });
}

// 3. CARGAMOS LAS CATEGORÍAS EN EL DESPLEGABLE (SELECT)
// 3. CARGAMOS LAS CATEGORÍAS EN LOS SELECTS (Modal y Filtro)
async function cargarCategoriasEnSelect() {
    try {
        const response = await fetch(`${CATEGORIES_URL}/all`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            const categorias = await response.json();
            
            // Select del formulario de crear/editar
            const selectModal = document.getElementById('matCategory');
            selectModal.innerHTML = '<option value="">-- Selecciona una categoría --</option>'; 
            
            // Select del filtro arriba de la tabla
            const selectFiltro = document.getElementById('filtroCategoria');
            selectFiltro.innerHTML = '<option value="todos">Todas las categorías</option>'; 
            
            categorias.forEach(cat => {
                // Al modal le pasamos el ID numérico
                selectModal.innerHTML += `<option value="${cat.categoryId}">${cat.name}</option>`;
                
                // Al filtro le pasamos el nombre en minúscula para poder compararlo
                selectFiltro.innerHTML += `<option value="${cat.name.toLowerCase()}">${cat.name}</option>`;
            });
        }
    } catch (error) {
        console.error("Error cargando categorías:", error);
    }
}


// --- LÓGICA DEL MODAL Y CRUD ---

window.abrirModalCrearMat = () => {
    document.getElementById('formMaterial').reset();
    document.getElementById('materialId').value = '';
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-box-open" style="color: var(--primary);"></i> Nuevo Material';
    document.getElementById('modalMaterial').style.display = 'flex';
};

window.abrirModalEditarMat = (id, name, categoryName) => {
    document.getElementById('formMaterial').reset();
    document.getElementById('materialId').value = id;
    document.getElementById('materialName').value = name;
    
    // Auto-seleccionar la categoría en el Dropdown
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
    
    if(!name || !categoryId) {
        return Swal.fire('Atención', 'El Nombre y la Categoría son obligatorios.', 'warning');
    }

    const payload = {
        name: name,
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
                
                if(res.ok) {
                    Swal.fire({ icon: 'success', title: '¡Eliminado!', text: 'El material fue borrado.', confirmButtonColor: '#00B8A9' });
                    await cargarMateriales();
                } else {
                    Swal.fire('Error', 'No se pudo eliminar el material.', 'error');
                }
            } catch(e) { 
                console.error(e);
            }
        }
    });
};

window.cerrarSesion = () => {
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
};