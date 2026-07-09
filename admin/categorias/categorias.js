const API_URL = 'https://api-remomn.onrender.com/api/v1/categories';
let userToken = '';

document.addEventListener("DOMContentLoaded", async () => {
    userToken = localStorage.getItem('jwt_token');
    const rolesString = localStorage.getItem('user_roles');
    const userEmail = localStorage.getItem('user_email');

    // Validación de seguridad
    if (!userToken || !rolesString || !JSON.parse(rolesString).includes('ROLE_ADMIN')) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Solo administradores pueden acceder a esta sección.',
            confirmButtonColor: '#12CFF4'
        }).then(() => {
            window.location.href = '../../index.html'; 
        });
        return;
    }

    document.getElementById('admin-email-display').textContent = userEmail || 'Admin';

    // 🔥 NUEVO: Manejo del botón de cambiar de rol si tiene múltiples roles asignados
    let userRoles = [];
    try {
        userRoles = JSON.parse(rolesString);
    } catch (e) {
        console.error("Error al parsear roles");
    }

    const btnPerfilAdmin = document.getElementById("btnPerfilAdmin");
    if (btnPerfilAdmin) {
        if (userRoles.length > 1) {
            btnPerfilAdmin.addEventListener("click", () => mostrarSelectorDeRoles(userRoles));
        } else {
            // Si solo tiene 1 rol, removemos el icono de intercambio
            const iconExchange = btnPerfilAdmin.querySelector(".fa-right-left");
            if (iconExchange) iconExchange.remove();
            btnPerfilAdmin.style.cursor = "default";
            btnPerfilAdmin.title = "";
        }
    }

    await cargarCategorias();
});

async function cargarCategorias() {
    try {
        const response = await fetch(`${API_URL}/all`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (response.ok) {
            const categorias = await response.json();
            renderizarCategorias(categorias);
        }
    } catch (error) { 
        console.error('Error de red:', error);
        Swal.fire('Error de conexión', 'No se pudieron cargar las categorías de la base de datos.', 'error');
    }
}

function renderizarCategorias(categorias) {
    const tbody = document.getElementById('catTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');
    tbody.innerHTML = ''; 
    if(mobileContainer) mobileContainer.innerHTML = '';
    
    if(categorias.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">No hay categorías creadas.</td></tr>`;
        return;
    }

    categorias.forEach(cat => {
        // --- FILA PARA PC ---
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: #666;">#${cat.categoryId}</strong></td>
            <td style="font-weight: 500; font-size: 1rem;">${cat.name}</td>
            <td>
                <button class="btn-edit" onclick="abrirModalEditarCat(${cat.categoryId}, '${cat.name.replace(/'/g, "\\'")}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-delete" onclick="eliminarCategoria(${cat.categoryId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);

        // --- TARJETA PARA MÓVIL (Opcional) ---
        if(mobileContainer) {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header">
                    <strong style="font-size: 1.1rem;">${cat.name}</strong>
                    <span style="color: #A3AED0; font-size: 0.8rem;">#${cat.categoryId}</span>
                </div>
                <div class="card-actions" style="justify-content: flex-end;">
                    <button class="btn-edit" onclick="abrirModalEditarCat(${cat.categoryId}, '${cat.name.replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-delete" onclick="eliminarCategoria(${cat.categoryId})">Eliminar</button>
                </div>
            `;
            mobileContainer.appendChild(card);
        }
    });
}

// --- LOGICA DEL MODAL Y CRUD ---

window.abrirModalCrearCat = () => {
    document.getElementById('formCat').reset();
    document.getElementById('catId').value = '';
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-plus"></i> Nueva Categoría';
    document.getElementById('modalCat').style.display = 'flex';
};

window.abrirModalEditarCat = (id, name) => {
    document.getElementById('catId').value = id;
    document.getElementById('catName').value = name;
    document.getElementById('modalTitulo').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Categoría';
    document.getElementById('modalCat').style.display = 'flex';
};

window.cerrarModalCat = () => {
    document.getElementById('modalCat').style.display = 'none';
};

window.guardarCategoria = async () => {
    const id = document.getElementById('catId').value;
    const isEditing = id !== '';
    const name = document.getElementById('catName').value.trim();
    
    if(!name) {
        return Swal.fire('Atención', 'El nombre de la categoría no puede estar vacío.', 'warning');
    }

    const payload = { name: name }; // CategoriesRequestDto solo requiere el "name"
    
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
            Swal.fire('¡Éxito!', isEditing ? 'Categoría actualizada.' : 'Categoría creada.', 'success');
            cerrarModalCat();
            await cargarCategorias(); 
        } else {
            const errorData = await response.json();
            Swal.fire('Error del servidor', errorData.message || 'No se pudo guardar la categoría.', 'error');
        }
    } catch (error) {
        console.error('Error al guardar:', error);
        Swal.fire('Fallo de conexión', 'No se pudo contactar con el servidor.', 'error');
    }
};

window.eliminarCategoria = async (id) => {
    Swal.fire({
        title: '¿Eliminar Categoría?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#2E3238',
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
                    Swal.fire('¡Eliminada!', 'La categoría fue borrada de la base de datos.', 'success');
                    await cargarCategorias();
                } else {
                    Swal.fire('Error', 'Hubo un error al eliminar. Verifica que no esté siendo usada en otros registros.', 'error');
                }
            } catch(e) { 
                console.error(e);
                Swal.fire('Error de red', 'No se pudo conectar con el servidor.', 'error');
            }
        }
    });
};

function mostrarSelectorDeRoles(roles) {
    let opcionesHTML = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
    
    roles.forEach(rol => {
        let nombreRol = '';
        let url = '';
        
        // Rutas relativas calculadas desde admin/categorias/ hacia los demás dashboards
        if (rol === 'ROLE_ADMIN') { 
            nombreRol = '<i class="fa-solid fa-user-tie"></i> Administrador'; 
            url = '../admin-dashboard.html'; 
        }
        if (rol === 'ROLE_JEFE') { 
            nombreRol = '<i class="fa-solid fa-user-shield"></i> Jefe de Trabajo'; 
            url = '../../jefe/jefe-dashboard.html'; 
        }
        if (rol === 'ROLE_EMPLOYEE') { 
            nombreRol = '<i class="fa-solid fa-helmet-safety"></i> Subcontratista'; 
            url = '../../employee/employee-dashboard.html'; 
        }

        if (nombreRol) {
            opcionesHTML += `
                <button class="swal2-confirm swal2-styled" 
                        style="width: 100%; margin: 0; background-color: #111C44; color: #fff; font-weight: 500; border-radius: 8px;" 
                        onclick="window.location.href='${url}'">
                    ${nombreRol}
                </button>`;
        }
    });
    
    opcionesHTML += '</div>';

    Swal.fire({
        title: 'Selecciona tu área de trabajo',
        html: opcionesHTML,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#ea5455'
    });
}

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
            window.location.href = '../../index.html'; // Dos niveles atrás para salir de admin/categorias/
        }
    });
};