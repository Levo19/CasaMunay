// ===== CONFIGURACIÓN =====
const CONFIG = {
    // URL de tu Google Apps Script
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

// ===== INICIALIZACIÓN (VELOCIDAD EXTREMA) =====
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const path = window.location.pathname;
        const esIndex = path.endsWith('index.html') || path.endsWith('/') || path.endsWith('/CasaMunay/');
        const esServices = path.includes('services.html');

        // ---------------------------------------------------------
        // CASO 1: SERVICES (App de pedidos) - PRIORIDAD MÁXIMA
        // ---------------------------------------------------------
        if (esServices) {
             const urlParams = new URLSearchParams(window.location.search);
             const roomParam = urlParams.get('room');

             // ESTRATEGIA: ¿Tenemos datos en el bolsillo (memoria)?
             const storedRoom = sessionStorage.getItem('habitacionSeleccionada');
             
             if (storedRoom) {
                 const habitacionEnMemoria = JSON.parse(storedRoom);
                 
                 // Si la memoria coincide con la URL...
                 if (String(habitacionEnMemoria.numero) === String(roomParam)) {
                     console.log("🚀 VELOCIDAD LUZ: Renderizando interfaz YA.");
                     
                     // 1. ASIGNAMOS DATOS
                     habitacionData = habitacionEnMemoria;
                     
                     // 2. PINTAMOS LA PANTALLA INMEDIATAMENTE
                     mostrarInfoHabitacion();
                     document.getElementById('loadingScreen').style.display = 'none'; // ¡ADIÓS CARGANDO!
                     
                     // 3. CARGAMOS EL RESTO EN "SEGUNDO PLANO" (Sin await que frene)
                     // El usuario ya puede ver el menú mientras esto pasa:
                     obtenerConfig().then(() => configurarWhatsApp()); // Config baja despues
                     cargarServicios(); // Servicios cargan (probablemente desde caché)
                     validarHabitacionSegundoPlano(roomParam); // Seguridad silenciosa
                     
                     return; // ¡TERMINAMOS! El usuario ya está feliz.
                 }
             }
             
             // SI LLEGAMOS AQUÍ es porque no había caché (Entrada directa/QR)
             // Entonces sí toca esperar a cargar todo normal
             console.log("🐢 Carga Normal (Sin caché)...");
             await obtenerConfig();
             await validarYEntrar(roomParam);
             return;
        }

        // ---------------------------------------------------------
        // CASO 2: INDEX (Selección)
        // ---------------------------------------------------------
        if (esIndex) {
            console.log("Modo: Selección");
            // Aquí no importa esperar un poco
            await obtenerConfig(); 
            const response = await fetch(`${CONFIG.API_URL}?action=getHabitaciones`);
            const dataHab = await response.json();
            
            if (typeof renderizarSeleccionHabitaciones === 'function') {
                renderizarSeleccionHabitaciones(dataHab.habitaciones || []);
            }
            
            const loading = document.getElementById('loadingScreen');
            if (loading) loading.style.display = 'none';
        }

    } catch (error) {
        console.error('Error init:', error);
        mostrarError('Error de conexión.');
    }
});
// ===== FUNCIONES AUXILIARES DE CARGA =====

// Valida normal (para cuando entran por QR directo)
async function validarYEntrar(roomParam) {
    const response = await fetch(`${CONFIG.API_URL}?action=getHabitaciones`);
    const data = await response.json();
    const validas = data.habitaciones || [];
    const habitacion = validas.find(h => String(h.numero) === String(roomParam));

    if (!habitacion) {
        window.location.href = 'index.html';
        return;
    }

    habitacionData = habitacion;
    sessionStorage.setItem('habitacionSeleccionada', JSON.stringify(habitacionData));
    
    mostrarInfoHabitacion();
    configurarWhatsApp();
    document.getElementById('loadingScreen').style.display = 'none';
    await cargarServicios();
}

// Valida en segundo plano (si ya dejamos entrar al usuario)
async function validarHabitacionSegundoPlano(roomParam) {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getHabitaciones`);
        const data = await response.json();
        const validas = data.habitaciones || [];
        const sigueValida = validas.find(h => String(h.numero) === String(roomParam));

        if (!sigueValida) {
            alert("Tu sesión ha expirado o la habitación ya no está disponible.");
            window.location.href = 'index.html';
        }
    } catch (e) {
        console.error("No se pudo re-validar, pero dejamos seguir al usuario.", e);
    }
}

// ===== OBTENER CONFIGURACIÓN (CON CACHÉ) =====
async function obtenerConfig() {
    try {
        // 1. Intentar leer de caché
        const cached = sessionStorage.getItem('configCache');
        if (cached) {
            config = JSON.parse(cached);
            console.log("⚡ Config cargada de caché");
            return;
        }

        // 2. Si no hay, pedir a Google
        const response = await fetch(`${CONFIG.API_URL}?action=getConfig`);
        const data = await response.json();
        config = data;
        // Guardar para la próxima
        sessionStorage.setItem('configCache', JSON.stringify(data));
    } catch (error) {
        console.error('Error config:', error);
    }
}

// ===== CARGAR SERVICIOS (CON CACHÉ DE VELOCIDAD) =====
async function cargarServicios() {
    try {
        // A. INTENTO DE CARGA INSTANTÁNEA (CACHE DEL INDEX)
        const menuCache = sessionStorage.getItem('menuCache');
        
        if (menuCache) {
            console.log('⚡ ¡Usando menú pre-cargado! (Velocidad máxima)');
            const data = JSON.parse(menuCache);
            if (data.servicios) {
                servicios = data.servicios;
                renderizarServicios();
                return; // Terminamos aquí, no llamamos a Google
            }
        }

        // B. SI NO HAY CACHE, CARGA NORMAL (Backup)
        console.log('🌐 No hay caché, descargando de Google...');
        const response = await fetch(`${CONFIG.API_URL}?action=getServicios`);
        const data = await response.json();
        
        if (data.servicios) {
            servicios = data.servicios;
            // Guardamos para el futuro
            sessionStorage.setItem('menuCache', JSON.stringify(data));
            renderizarServicios();
        } else {
            throw new Error('No se recibieron servicios');
        }

    } catch (error) {
        console.error('Error al cargar servicios:', error);
        if (servicios.length === 0) {
            mostrarError(`No se pudo cargar el menú: ${error.message}`);
        }
    }
}

// ===== OBTENER CONFIGURACIÓN =====
async function obtenerConfig() {
    try {
        // Intentamos obtener config del cache primero también si quieres
        const response = await fetch(`${CONFIG.API_URL}?action=getConfig`);
        const data = await response.json();
        config = data;
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
    const nombreParaMostrar = habitacionData.huesped ? `Hola, ${habitacionData.huesped}` : 'Estimado huésped';
    
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
    if (whatsappBtn) {
        whatsappBtn.href = whatsappUrl;
        whatsappBtn.style.display = 'flex';
    }
}

// ===== MOSTRAR ERROR =====
function mostrarError(mensaje) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
                <h2 style="color: #ef4444; margin-bottom: 15px;">Error</h2>
                <p style="color: #6b7280;">${mensaje}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                    Reintentar
                </button>
            </div>
        `;
        loadingScreen.style.display = 'flex';
    }
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
    const container = document.getElementById('roomsContainer'); 
    
    if (!container) return;

    container.innerHTML = ''; 

    if (habitaciones.length === 0) {
        container.innerHTML = '<p class="no-rooms">No hay habitaciones disponibles para check-in hoy.</p>';
        return;
    }

    habitaciones.forEach(hab => {
        const card = document.createElement('div'); // Usamos DIV con onclick
        card.className = 'room-card';
        
        // 🚨 AQUÍ ESTÁ EL CAMBIO CLAVE: GUARDAR ANTES DE IR 🚨
        card.onclick = function() {
            // 1. Guardamos los datos de la habitación en la mochila del navegador
            sessionStorage.setItem('habitacionSeleccionada', JSON.stringify(hab));
            
            // 2. Ahora sí, nos vamos a la otra página
            window.location.href = `services.html?room=${hab.numero}`;
        };
        
        // Estilos de estado
        const statusClass = hab.estado === 'ocupada' ? 'status-ocupada' : 'status-disponible';
        const statusText = hab.estado === 'ocupada' ? 'Ocupada' : 'Disponible';
        
        card.innerHTML = `
            <div class="room-icon">🛏️</div>
            <div class="room-number">${hab.numero}</div>
            <span class="room-status ${statusClass}">${statusText}</span>
            <div class="room-guest">${hab.huesped || ''}</div>
        `;
        
        container.appendChild(card);
    });
}
