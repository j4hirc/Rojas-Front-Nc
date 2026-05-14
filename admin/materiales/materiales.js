const API_URL = 'http://localhost:8081/api/v1/materials';
const CATEGORIES_URL = 'http://localhost:8081/api/v1/categories'; // Para cargar el select
let userToken = '';

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para acceder a esta sección.',
            confirmButtonColor: '#0f4c81'
        }).then(() => {
            window.location.href = '../../index.html'; 
        });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    await cargarMateriales();
    await cargarCategoriasEnSelect();
});

// 1. CARGAMOS LA TABLA DE MATERIALES
async function cargarMateriales() {
    try {
        const response = await fetch(`${API_URL}/all`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (response.ok) {
            const materiales = await response.json();
            renderizarMateriales(materiales);
        }
    } catch (error) { 
        console.error('Error de red:', error);
        Swal.fire('Error de conexión', 'No se pudo cargar la lista de materiales.', 'error');
    }
}

function renderizarMateriales(materiales) {
    const tbody = document.getElementById('matTableBody');
    tbody.innerHTML = ''; 
    
    if(materiales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">No hay materiales registrados.</td></tr>`;
        return;
    }

    materiales.forEach(mat => {
        // Escapamos las comillas para no romper el HTML en el botón de edición
        const safeName = mat.name ? mat.name.replace(/'/g, "\\'") : '';
        const safeCategory = mat.categoryName ? mat.categoryName.replace(/'/g, "\\'") : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${mat.name}</strong><br>
                <small style="color:#A3AED0;">ID: #${mat.materialId}</small>
            </td>
            <td>
                <span style="background: #e8f0fe; color: #1a73e8; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: bold;">
                    ${mat.categoryName || 'Sin categoría'}
                </span>
            </td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditarMat(${mat.materialId}, '${safeName}', '${safeCategory}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete" onclick="eliminarMaterial(${mat.materialId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 2. CARGAMOS LAS CATEGORÍAS EN EL DESPLEGABLE (SELECT)
async function cargarCategoriasEnSelect() {
    try {
        const response = await fetch(`${CATEGORIES_URL}/all`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (response.ok) {
            const categorias = await response.json();
            const select = document.getElementById('matCategory');
            select.innerHTML = '<option value="">-- Selecciona una categoría --</option>'; 
            
            categorias.forEach(cat => {
                select.innerHTML += `<option value="${cat.categoryId}">${cat.name}</option>`;
            });
        }
    } catch (error) {
        console.error("Error cargando categorías:", error);
    }
}


// --- LÓGICA DEL MODAL Y CRUD ---

window.abrirModalCrearMat = () => {
    document.getElementById('formMat').reset();
    document.getElementById('matId').value = '';
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-box-open"></i> Nuevo Material';
    document.getElementById('modalMat').style.display = 'flex';
};

// NUEVA FUNCIÓN DE EDITAR QUE SELECCIONA LA CATEGORÍA SOLA
window.abrirModalEditarMat = (id, name, categoryName) => {
    document.getElementById('formMat').reset();
    document.getElementById('matId').value = id;
    document.getElementById('matName').value = name;
    
    // Magia para auto-seleccionar la categoría en el Dropdown
    const select = document.getElementById('matCategory');
    for (let i = 0; i < select.options.length; i++) {
        // Compara el texto de la opción con el categoryName que recibimos de la tabla
        if (select.options[i].text === categoryName) {
            select.selectedIndex = i;
            break;
        }
    }
    
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Material';
    document.getElementById('modalMat').style.display = 'flex';
};

window.cerrarModalMat = () => {
    document.getElementById('modalMat').style.display = 'none';
};

window.guardarMaterial = async () => {
    const id = document.getElementById('matId').value;
    const isEditing = id !== '';
    
    const name = document.getElementById('matName').value.trim();
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
            Swal.fire('¡Éxito!', isEditing ? 'Material actualizado.' : 'Material agregado.', 'success');
            cerrarModalMat();
            await cargarMateriales(); 
        } else {
            const errorData = await response.json();
            Swal.fire('Error', errorData.message || 'No se pudo guardar el material.', 'error');
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
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
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
                    Swal.fire('¡Eliminado!', 'El material fue borrado.', 'success');
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
        confirmButtonColor: "#0f4c81",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, salir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = '../../index.html';
        }
    });
};