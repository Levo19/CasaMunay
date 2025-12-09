// ===== CONFIGURACIÓN =====
const CONFIG = {
    // IMPORTANTE: Reemplaza esta URL con la URL de tu Apps Script después de desplegarlo
    API_URL: 'https://script.google.com/macros/s/AKfycbzKJ3J5cG8cJ4hKFPDmVYOfRTn9aqmkOnjyDfMabRhsNaFCO-7AQ2COPa9iGjJysMkL/exec'
};

// ===== ESTADO GLOBAL =====
let servicios = [];
let carrito = [];
let categoriaActual = 'Todas';
let config = {};
let habitacionData = null;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Obtener configuración
        await obtenerConfig();
        
        // Obtener código QR de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const codigoQR = urlParams.get('room');
        
        if (codigoQR) {
            await obtenerDatosHabitacion(codigoQR);
        }
        
        // Cargar servicios
        await cargarServicios();
        
        // Ocultar pantalla de carga
        document.getElementById('loadingScreen').style.display = 'none';
        
        // Mostrar botón de WhatsApp
        configurarWhatsApp();
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Error al cargar los servicios. Por favor, recarga la página.');
    }
});

// ===== OBTENER CONFIGURACIÓN =====
async function obtenerConfig() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getConfig`);
        const data = await response.json();
        config = data;
    } catch (error) {
        console.error('Error al obtener configuración:', error);
    }
}

// ===== OBTENER DATOS DE HABITACIÓN =====
async function obtenerDatosHabitacion(codigo) {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getHabitacion&codigo=${codigo}`);
        const data = await response.json();
        
        if (data.habitacion) {
            habitacionData = data.habitacion;
            mostrarInfoHabitacion();
        }
    } catch (error) {
        console.error('Error al obtener datos de habitación:', error);
    }
}

// ===== MOSTRAR INFO DE HABITACIÓN =====
function mostrarInfoHabitacion() {
    if (!habitacionData) return;
    
    const infoDiv = document.getElementById('habitacionInfo');
    document.getElementById('numeroHabitacion').textContent = habitacionData.numero;
    document.getElementById('nombreHuesped').textContent = habitacionData.huesped || 'Estimado huésped';
    infoDiv.style.display = 'block';
    
    // Pre-llenar formulario si hay datos
    if (habitacionData.numero) {
        document.getElementById('habitacionCliente').value = habitacionData.numero;
    }
    if (habitacionData.huesped) {
        document.getElementById('nombreCliente').value = habitacionData.huesped;
    }
}

// ===== CARGAR SERVICIOS =====
async function cargarServicios() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getServicios`);
        const data = await response.json();
        
        if (data.servicios) {
            servicios = data.servicios;
            renderizarCategorias();
            renderizarServicios();
        }
    } catch (error) {
        console.error('Error al cargar servicios:', error);
        throw error;
    }
}

// ===== RENDERIZAR CATEGORÍAS =====
function renderizarCategorias() {
    const categoriasSet = new Set(['Todas']);
    servicios.forEach(servicio => categoriasSet.add(servicio.categoria));
    
    const categoriasContainer = document.getElementById('categorias');
    categoriasContainer.innerHTML = '';
    
    categoriasSet.forEach(categoria => {
        const btn = document.createElement('button');
        btn.className = `categoria-btn ${categoria === categoriaActual ? 'active' : ''}`;
        btn.textContent = categoria;
        btn.onclick = () => filtrarPorCategoria(categoria);
        categoriasContainer.appendChild(btn);
    });
}

// ===== FILTRAR POR CATEGORÍA =====
function filtrarPorCategoria(categoria) {
    categoriaActual = categoria;
    renderizarCategorias();
    renderizarServicios();
}

// ===== RENDERIZAR SERVICIOS =====
function renderizarServicios() {
    const container = document.getElementById('serviciosContainer');
    container.innerHTML = '';
    
    const serviciosFiltrados = categoriaActual === 'Todas' 
        ? servicios 
        : servicios.filter(s => s.categoria === categoriaActual);
    
    serviciosFiltrados.forEach(servicio => {
        const card = crearCardServicio(servicio);
        container.appendChild(card);
    });
}

// ===== CREAR CARD DE SERVICIO =====
function crearCardServicio(servicio) {
    const card = document.createElement('div');
    card.className = 'servicio-card';
    
    const enCarrito = carrito.find(item => item.id === servicio.id);
    const cantidad = enCarrito ? enCarrito.cantidad : 0;
    
    card.innerHTML = `
        <img src="${servicio.imagen || 'https://via.placeholder.com/300x180?text=' + encodeURIComponent(servicio.nombre)}" 
             alt="${servicio.nombre}" 
             class="servicio-imagen"
             onerror="this.src='https://via.placeholder.com/300x180?text=' + encodeURIComponent('${servicio.nombre}')">
        <div class="servicio-body">
            <span class="servicio-categoria">${servicio.categoria}</span>
            <h3 class="servicio-nombre">${servicio.nombre}</h3>
            <p class="servicio-descripcion">${servicio.descripcion}</p>
            <div class="servicio-footer">
                <div class="servicio-precio">S/ ${servicio.precio.toFixed(2)}</div>
                <button class="btn-agregar" onclick="agregarAlCarrito(${servicio.id})" ${servicio.stock === 0 ? 'disabled' : ''}>
                    ${servicio.stock === 0 ? 'Agotado' : cantidad > 0 ? `En carrito (${cantidad})` : 'Agregar'}
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// ===== AGREGAR AL CARRITO =====
function agregarAlCarrito(servicioId) {
    const servicio = servicios.find(s => s.id === servicioId);
    if (!servicio) return;
    
    const itemExistente = carrito.find(item => item.id === servicioId);
    
    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        carrito.push({
            id: servicio.id,
            nombre: servicio.nombre,
            precio: servicio.precio,
            cantidad: 1
        });
    }
    
    actualizarCarrito();
    renderizarServicios();
}

// ===== ACTUALIZAR CARRITO =====
function actualizarCarrito() {
    const carritoFlotante = document.getElementById('carritoFlotante');
    const carritoCount = document.getElementById('carritoCount');
    const carritoTotal = document.getElementById('carritoTotal');
    const carritoItems = document.getElementById('carritoItems');
    
    if (carrito.length === 0) {
        carritoFlotante.style.display = 'none';
        return;
    }
    
    carritoFlotante.style.display = 'block';
    
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const totalPrecio = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    carritoCount.textContent = totalItems;
    carritoTotal.textContent = totalPrecio.toFixed(2);
    
    carritoItems.innerHTML = '';
    carrito.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'carrito-item';
        itemDiv.innerHTML = `
            <div class="carrito-item-info">
                <div class="carrito-item-nombre">${item.nombre}</div>
                <div class="carrito-item-precio">S/ ${item.precio.toFixed(2)} c/u</div>
            </div>
            <div class="cantidad-controls">
                <button class="btn-cantidad" onclick="cambiarCantidad(${item.id}, -1)">-</button>
                <span>${item.cantidad}</span>
                <button class="btn-cantidad" onclick="cambiarCantidad(${item.id}, 1)">+</button>
            </div>
        `;
        carritoItems.appendChild(itemDiv);
    });
}

// ===== CAMBIAR CANTIDAD =====
function cambiarCantidad(servicioId, cambio) {
    const item = carrito.find(i => i.id === servicioId);
    if (!item) return;
    
    item.cantidad += cambio;
    
    if (item.cantidad <= 0) {
        carrito = carrito.filter(i => i.id !== servicioId);
    }
    
    actualizarCarrito();
    renderizarServicios();
}

// ===== TOGGLE CARRITO =====
function toggleCarrito() {
    const contenido = document.getElementById('carritoContenido');
    contenido.style.display = contenido.style.display === 'none' ? 'block' : 'none';
}

// ===== ABRIR FORMULARIO =====
function abrirFormulario() {
    const modal = document.getElementById('modalFormulario');
    const resumenItems = document.getElementById('resumenItems');
    const totalFinal = document.getElementById('totalFinal');
    
    // Renderizar resumen
    resumenItems.innerHTML = '';
    carrito.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'resumen-item';
        itemDiv.innerHTML = `
            <span>${item.nombre} x${item.cantidad}</span>
            <span>S/ ${(item.precio * item.cantidad).toFixed(2)}</span>
        `;
        resumenItems.appendChild(itemDiv);
    });
    
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    totalFinal.textContent = total.toFixed(2);
    
    modal.style.display = 'block';
}

// ===== CERRAR FORMULARIO =====
function cerrarFormulario() {
    document.getElementById('modalFormulario').style.display = 'none';
}

// ===== ENVIAR PEDIDO =====
async function enviarPedido(event) {
    event.preventDefault();
    
    const btnEnviar = document.getElementById('btnEnviar');
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
    
    const nombre = document.getElementById('nombreCliente').value;
    const habitacion = document.getElementById('habitacionCliente').value;
    const email = document.getElementById('emailCliente').value;
    const notas = document.getElementById('notasCliente').value;
    
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    const pedido = {
        nombre,
        habitacion,
        email,
        notas,
        servicios: carrito,
        total
    };
    
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=crearPedido`, {
            method: 'POST',
            body: JSON.stringify(pedido)
        });
        
        const data = await response.json();
        
        if (data.success) {
            cerrarFormulario();
            mostrarConfirmacion();
            
            // Limpiar carrito
            carrito = [];
            actualizarCarrito();
            renderizarServicios();
            
            // Limpiar formulario
            document.getElementById('pedidoForm').reset();
        } else {
            alert('Error al procesar el pedido. Por favor, intenta nuevamente.');
        }
    } catch (error) {
        console.error('Error al enviar pedido:', error);
        alert('Error al enviar el pedido. Por favor, verifica tu conexión e intenta nuevamente.');
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Confirmar Pedido';
    }
}

// ===== MOSTRAR CONFIRMACIÓN =====
function mostrarConfirmacion() {
    document.getElementById('modalConfirmacion').style.display = 'block';
}

// ===== CERRAR CONFIRMACIÓN =====
function cerrarConfirmacion() {
    document.getElementById('modalConfirmacion').style.display = 'none';
}

// ===== CONFIGURAR WHATSAPP =====
function configurarWhatsApp() {
    if (!config.whatsapp) return;
    
    const mensaje = encodeURIComponent(`Hola! Soy huésped del ${config.nombreHotel}. Tengo una consulta...`);
    const whatsappUrl = `https://wa.me/${config.whatsapp}?text=${mensaje}`;
    
    const whatsappBtn = document.getElementById('whatsappButton');
    whatsappBtn.href = whatsappUrl;
    whatsappBtn.style.display = 'flex';
}

// ===== CERRAR MODALES AL HACER CLIC FUERA =====
window.onclick = function(event) {
    const modalFormulario = document.getElementById('modalFormulario');
    const modalConfirmacion = document.getElementById('modalConfirmacion');
    
    if (event.target === modalFormulario) {
        cerrarFormulario();
    }
    if (event.target === modalConfirmacion) {
        cerrarConfirmacion();
    }
}
