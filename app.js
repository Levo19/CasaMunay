// ===== CONFIGURACIÓN =====
const CONFIG = {
    // IMPORTANTE: Reemplaza esta URL con la URL de tu Apps Script después de desplegarlo
    API_URL: 'https://script.google.com/macros/s/AKfycbzKJ3J5cG8cJ4hKFPDmVYOfRTn9aqmkOnjyDfMabRhsNaFCO-7AQ2COPa9iGjJysMkL/exec'
};

// Habilitar modo debug
const DEBUG = true;
function log(...args) {
    if (DEBUG) console.log(...args);
}

// ===== ESTADO GLOBAL =====
let servicios = [];
let carrito = [];
let tabActual = 'bebidas';
let config = {};
let habitacionData = null;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await obtenerConfig();

        // Detectar en qué archivo estamos
        const path = window.location.pathname;
        const esIndex = path.endsWith('index.html') || path.endsWith('/') || path.endsWith('/CasaMunay/');
        const esServices = path.includes('services.html');

        // 1. Si estamos en el INDEX (Selección de habitación)
        if (esIndex) {
            console.log("Modo: Selección de Habitación");
            // Solo cargamos las habitaciones para mostrar los botones
            const response = await fetch(`${CONFIG.API_URL}?action=getHabitaciones`);
            const dataHab = await response.json();
            const habitacionesActivas = dataHab.habitaciones || [];
            
            // Función que dibuja los botones (asegúrate de tenerla, ver abajo)
            renderizarSeleccionHabitaciones(habitacionesActivas);
            
            document.getElementById('loadingScreen').style.display = 'none';
            return; // ¡IMPORTANTE! Aquí terminamos para no ejecutar lógica de carrito
        }

        // 2. Si estamos en SERVICES (App de pedidos)
        if (esServices) {
             // ... Aquí va la lógica de validar habitación, cargar servicios, etc ...
             // Copia aquí el resto de tu lógica de validación que ya tenías
             
             const response = await fetch(`${CONFIG.API_URL}?action=getHabitaciones`);
             const dataHab = await response.json();
             const habitacionesActivas = dataHab.habitaciones || [];
             
             const urlParams = new URLSearchParams(window.location.search);
             const roomParam = urlParams.get('room');
             
             const habitacionValida = habitacionesActivas.find(h => String(h.numero) === String(roomParam));

             if (!habitacionValida) {
                 // Si entra a servicios sin permiso, LO MANDAMOS AL INDEX
                 window.location.href = 'index.html'; 
                 return;
             }

             // Si es válida, iniciamos la app
             habitacionData = habitacionValida;
             sessionStorage.setItem('habitacionSeleccionada', JSON.stringify(habitacionData));
             mostrarInfoHabitacion();
             await cargarServicios();
             document.getElementById('loadingScreen').style.display = 'none';
             configurarWhatsApp();
        }

    } catch (error) {
        console.error('Error al inicializar:', error);
        // Si hay error critico, nos quedamos en index o recargamos
    }
});

// ===== OBTENER CONFIGURACIÓN =====
async function obtenerConfig() {
    try {
        log('Obteniendo configuración...');
        const response = await fetch(`${CONFIG.API_URL}?action=getConfig`);
        const data = await response.json();
        config = data;
        log('Configuración obtenida:', config);
    } catch (error) {
        console.error('Error al obtener configuración:', error);
    }
}

// ===== MOSTRAR INFO DE HABITACIÓN =====
function mostrarInfoHabitacion() {
    if (!habitacionData) return;
    
    const infoDiv = document.getElementById('habitacionInfo');
    
    // Muestra el número
    document.getElementById('numeroHabitacion').textContent = habitacionData.numero;
    
    // Muestra el nombre personalizado
    // Si el Excel tiene nombre, usa ese. Si no, usa "Estimado huésped"
    const nombreParaMostrar = habitacionData.huesped ? `Hola, ${habitacionData.huesped}` : 'Estimado huésped';
    
    // Asegúrate de que tu HTML tenga un elemento donde mostrar este nombre
    // Por defecto tu código anterior usaba 'nombreHuesped'
    const elementoNombre = document.getElementById('nombreHuesped');
    if (elementoNombre) {
        elementoNombre.textContent = nombreParaMostrar;
    }
    
    infoDiv.style.display = 'block';
    
    // Pre-llenar formulario de pedido
    const inputHabitacion = document.getElementById('habitacionCliente');
    if (inputHabitacion) inputHabitacion.value = habitacionData.numero;
    
    const inputNombre = document.getElementById('nombreCliente');
    if (inputNombre && habitacionData.huesped) {
        inputNombre.value = habitacionData.huesped;
    }
}
// ===== CARGAR SERVICIOS =====
async function cargarServicios() {
    try {
        log('Cargando servicios desde:', CONFIG.API_URL);
        const response = await fetch(`${CONFIG.API_URL}?action=getServicios`);
        log('Response status:', response.status);
        
        const data = await response.json();
        log('Datos recibidos:', data);
        
        if (data.servicios) {
    servicios = data.servicios; // Guardamos aunque esté vacío
    renderizarServicios(); // Renderizamos (las funciones de render ya manejan arrays vacíos)
} else {
    throw new Error('Formato de datos incorrecto');
}
    } catch (error) {
        console.error('Error al cargar servicios:', error);
        mostrarError(`Error al cargar servicios: ${error.message}`);
        throw error;
    }
}

// ===== CAMBIAR TAB =====
function cambiarTab(tab) {
    tabActual = tab;
    
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
}

// ===== RENDERIZAR SERVICIOS =====
function renderizarServicios() {
    renderizarBebidas();
    renderizarTours();
}

// ===== RENDERIZAR BEBIDAS Y SNACKS =====
function renderizarBebidas() {
    const container = document.getElementById('serviciosBebidas');
    container.innerHTML = '';
    
    const bebidas = servicios.filter(s => s.categoria === 'Bebidas' || s.categoria === 'Snacks');
    
    if (bebidas.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #6b7280;">No hay bebidas o snacks disponibles.</p>';
        return;
    }
    
    bebidas.forEach(servicio => {
        const card = crearCardBebida(servicio);
        container.appendChild(card);
    });
}

// ===== CREAR CARD DE BEBIDA/SNACK =====
function crearCardBebida(servicio) {
    const card = document.createElement('div');
    card.className = 'servicio-card';
    
    const enCarrito = carrito.find(item => item.id === servicio.id);
    const cantidad = enCarrito ? enCarrito.cantidad : 0;
    
    const stockClass = servicio.stock < 10 && servicio.stock > 0 ? 'stock-bajo' : '';
    
    card.innerHTML = `
        <img src="${servicio.imagen || 'https://via.placeholder.com/300x180?text=' + encodeURIComponent(servicio.nombre)}" 
             alt="${servicio.nombre}" 
             class="servicio-imagen"
             onerror="this.src='https://via.placeholder.com/300x180?text=' + encodeURIComponent('${servicio.nombre}')">
        <div class="servicio-body">
            <span class="servicio-categoria">${servicio.categoria}</span>
            <h3 class="servicio-nombre">${servicio.nombre}</h3>
            <p class="servicio-descripcion">${servicio.descripcion}</p>
            <span class="servicio-stock ${stockClass}">📦 Stock: ${servicio.stock}</span>
            <div class="servicio-footer">
                <div class="servicio-precio">S/ ${servicio.precio.toFixed(2)}</div>
                <div class="cantidad-selector">
                    <button onclick="cambiarCantidad(${servicio.id}, -1)" ${cantidad === 0 ? 'disabled' : ''}>−</button>
                    <span>${cantidad}</span>
                    <button onclick="cambiarCantidad(${servicio.id}, 1)" ${servicio.stock === 0 || cantidad >= servicio.stock ? 'disabled' : ''}>+</button>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// ===== RENDERIZAR TOURS =====
function renderizarTours() {
    const container = document.getElementById('serviciosTours');
    container.innerHTML = '';
    
    const tours = servicios.filter(s => s.categoria === 'Tours');
    
    if (tours.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #6b7280;">No hay tours disponibles.</p>';
        return;
    }
    
    tours.forEach(servicio => {
        const card = crearCardTour(servicio);
        container.appendChild(card);
    });
}

// ===== CREAR CARD DE TOUR =====
function crearCardTour(servicio) {
    const card = document.createElement('div');
    card.className = 'tour-card';
    
    const enCarrito = carrito.find(item => item.id === servicio.id);
    const agregado = enCarrito ? true : false;
    
    card.innerHTML = `
        <img src="${servicio.imagen || 'https://via.placeholder.com/600x280?text=' + encodeURIComponent(servicio.nombre)}" 
             alt="${servicio.nombre}" 
             class="tour-imagen"
             onerror="this.src='https://via.placeholder.com/600x280?text=' + encodeURIComponent('${servicio.nombre}')">
        <div class="tour-body">
            <h3 class="tour-nombre">${servicio.nombre}</h3>
            <p class="tour-descripcion">${servicio.descripcion}</p>
            <div class="tour-footer">
                <div>
                    <span class="tour-precio-label">Precio por persona</span>
                    <div class="tour-precio">S/ ${servicio.precio.toFixed(2)}</div>
                </div>
                <button class="btn-agregar-tour ${agregado ? 'btn-agregado' : ''}" onclick="toggleTour(${servicio.id})">
                    ${agregado ? '✓ Agregado' : '+ Agregar'}
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// ===== TOGGLE TOUR (agregar/quitar) =====
function toggleTour(servicioId) {
    const servicio = servicios.find(s => s.id === servicioId);
    if (!servicio) return;
    
    const itemExistente = carrito.find(item => item.id === servicioId);
    
    if (itemExistente) {
        // Quitar del carrito
        carrito = carrito.filter(item => item.id !== servicioId);
    } else {
        // Agregar al carrito
        carrito.push({
            id: servicio.id,
            nombre: servicio.nombre,
            precio: servicio.precio,
            cantidad: 1,
            categoria: servicio.categoria
        });
    }
    
    actualizarCarrito();
    renderizarTours();
}

// ===== CAMBIAR CANTIDAD (bebidas/snacks) =====
function cambiarCantidad(servicioId, cambio) {
    const servicio = servicios.find(s => s.id === servicioId);
    if (!servicio) return;
    
    const itemExistente = carrito.find(item => item.id === servicioId);
    
    if (cambio > 0) {
        // Agregar
        if (itemExistente) {
            if (itemExistente.cantidad < servicio.stock) {
                itemExistente.cantidad++;
            }
        } else {
            carrito.push({
                id: servicio.id,
                nombre: servicio.nombre,
                precio: servicio.precio,
                cantidad: 1,
                categoria: servicio.categoria
            });
        }
    } else {
        // Quitar
        if (itemExistente) {
            itemExistente.cantidad--;
            if (itemExistente.cantidad <= 0) {
                carrito = carrito.filter(item => item.id !== servicioId);
            }
        }
    }
    
    actualizarCarrito();
    renderizarBebidas();
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
                <div class="carrito-item-precio">S/ ${item.precio.toFixed(2)} ${item.cantidad > 1 ? `x${item.cantidad}` : ''}</div>
            </div>
            <div style="font-weight: 700; color: var(--primary);">
                S/ ${(item.precio * item.cantidad).toFixed(2)}
            </div>
        `;
        carritoItems.appendChild(itemDiv);
    });
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
            <span>${item.nombre} ${item.cantidad > 1 ? `x${item.cantidad}` : ''}</span>
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
            document.getElementById('habitacionCliente').value = habitacionData.numero;
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
    
    const mensaje = encodeURIComponent(`Hola! Soy huésped de la habitación ${habitacionData.numero}. Tengo una consulta...`);
    const whatsappUrl = `https://wa.me/${config.whatsapp}?text=${mensaje}`;
    
    const whatsappBtn = document.getElementById('whatsappButton');
    whatsappBtn.href = whatsappUrl;
    whatsappBtn.style.display = 'flex';
}

// ===== MOSTRAR ERROR =====
function mostrarError(mensaje) {
    document.getElementById('loadingScreen').innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
            <h2 style="color: #ef4444; margin-bottom: 15px;">Error</h2>
            <p style="color: #6b7280;">${mensaje}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                Reintentar
            </button>
        </div>
    `;
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
// ===== RENDERIZAR BOTONES DE SELECCIÓN (PARA INDEX.HTML) =====
function renderizarSeleccionHabitaciones(habitaciones) {
    const container = document.getElementById('listaHabitaciones'); // Asegúrate que tu index.html tenga un div con este ID
    if (!container) return;

    container.innerHTML = ''; // Limpiar

    if (habitaciones.length === 0) {
        container.innerHTML = '<p class="no-rooms">No hay habitaciones disponibles para check-in hoy.</p>';
        return;
    }

    habitaciones.forEach(hab => {
        // Creamos el botón/tarjeta que lleva a services.html
        const card = document.createElement('a');
        card.className = 'room-card'; // Asegúrate de tener estilos para esta clase
        card.href = `services.html?room=${hab.numero}`; // EL ENLACE MÁGICO
        
        card.innerHTML = `
            <div class="room-icon">🛏️</div>
            <div class="room-number">${hab.numero}</div>
            <div class="room-guest">${hab.huesped || 'Disponible'}</div>
            <div class="room-status">Ingresar</div>
        `;
        
        container.appendChild(card);
    });
}
