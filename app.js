// ===== CONFIGURACIÓN =====
const CONFIG = {
    // 🚨 REEMPLAZA ESTO DESPUÉS DEL DESPLIEGUE FINAL
    API_URL: 'https://script.google.com/macros/s/AKfycbzKJ3J5cG8cJ4hKFPDmVYOfRTn9aqmkOnjyDfMabRhsNaFCO-7AQ2COPa9iGjJysMkL/exec'
};

// State
let servicios = [];
let carrito = [];
let habitacionData = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    设置Saludo();

    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const qrToken = urlParams.get('room'); // Mantenemos "room" como nombre de param por compatibilidad con QR impreso? 
    // NO, el usuario dijo "servicios.html?room=101" es inseguro.
    // Cambiamos a buscar "q" o "token".

    const tokenParam = urlParams.get('q') || urlParams.get('token') || urlParams.get('room');
    // NOTA: Aceptamos 'room' temporalmente si el usuario YA imprimió QRs con el código en vez del número.
    // Pero lo ideal es ?q=CODIGO_SECRETO

    // Check local storage
    const storedData = sessionStorage.getItem('habitacionData');

    if (storedData) {
        habitacionData = JSON.parse(storedData);
        // Validar si el token de la URL es diferente al guardado
        if (tokenParam && habitacionData.token !== tokenParam) {
            await validarYEntrar(tokenParam);
        } else {
            initApp();
            validarSesionBackground();
        }
    } else if (tokenParam) {
        await validarYEntrar(tokenParam);
    } else {
        // Sin token, adios.
        if (window.location.pathname.includes('services.html')) {
            window.location.href = 'index.html';
        }
    }
});

function initApp() {
    // UI Updates
    if (habitacionData) {
        document.getElementById('guestName').textContent = habitacionData.huesped || 'Estimado Huésped';

        // Pre-fill fields
        document.getElementById('inputHabitacion').value = habitacionData.numero;
        document.getElementById('inputNombre').value = habitacionData.huesped || '';
    }

    // Load services
    cargarServicios();
    document.getElementById('loadingScreen').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
    }, 500);
}

// ===== LOGIC: GREETING =====
function 设置Saludo() {
    const hour = new Date().getHours();
    let text = 'Hola';
    if (hour < 12) text = 'Buenos días';
    else if (hour < 18) text = 'Buenas tardes';
    else text = 'Buenas noches';

    document.getElementById('greetingTime').textContent = text;
}

// ===== LOGIC: WIFI =====
function copiarWifi() {
    const pass = document.getElementById('wifiPass').innerText;
    navigator.clipboard.writeText(pass).then(() => {
        showToast('✅ Contraseña copiada');
    }).catch(() => {
        showToast('❌ Error al copiar');
    });
}

// ===== DATA: VALIDATION =====
async function validarYEntrar(token) {
    try {
        // Ahora llamamos a getHabitacion con el TOKEN (no el número directo)
        const res = await fetch(`${CONFIG.API_URL}?action=getHabitacion&codigo=${token}`);
        const data = await res.json();

        if (data.habitacion) {
            habitacionData = data.habitacion;
            habitacionData.token = token; // Guardamos el token para referencias futuras
            sessionStorage.setItem('habitacionData', JSON.stringify(habitacionData));
            initApp();
        } else {
            // Si el backend dice error (403/404), mostramos y salimos
            if (data.error) showToast(`❌ ${data.error}`);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Error de conexión');
    }
}

async function validarSesionBackground() {
    if (!habitacionData || !habitacionData.token) return;

    try {
        // Re-validar silenciosamente que el token siga activo (room ocupada)
        const res = await fetch(`${CONFIG.API_URL}?action=getHabitacion&codigo=${habitacionData.token}`);
        const data = await res.json();

        if (data.error) {
            showToast('⚠️ Tu sesión ha expirado');
            sessionStorage.removeItem('habitacionData');
            setTimeout(() => window.location.href = 'index.html', 3000);
        }
    } catch (e) { }
}

// ===== DATA: SERVICES =====
async function cargarServicios() {
    // Try Cache
    const cache = sessionStorage.getItem('menuCache');
    if (cache) {
        servicios = JSON.parse(cache).servicios;
        renderProducts(servicios);
        return;
    }

    try {
        const res = await fetch(`${CONFIG.API_URL}?action=getServicios`);
        const data = await res.json();
        if (data.servicios) {
            servicios = data.servicios;
            sessionStorage.setItem('menuCache', JSON.stringify(data));
            renderProducts(servicios);
        }
    } catch (e) {
        showToast('Error cargando menú');
    }
}

// ===== UI: RENDER PRODUCTS =====
function renderProducts(lista) {
    const container = document.getElementById('productsGrid');
    container.innerHTML = '';

    lista.forEach(item => {
        // Find in cart
        const inCart = carrito.find(c => c.id === item.id);
        const qty = inCart ? inCart.cantidad : 0;

        const card = document.createElement('div');
        // Tours get full width
        if (item.categoria === 'Tours') card.className = 'card-product card-tour';
        else card.className = 'card-product';

        card.innerHTML = `
            <img src="${item.imagen || 'https://via.placeholder.com/300'}" class="card-product-img">
            <div class="card-product-body">
                <div class="card-title">${item.nombre}</div>
                <div class="card-desc">${item.descripcion}</div>
                <div class="card-footer">
                    <div class="card-price">S/ ${item.precio.toFixed(2)}</div>
                    ${qty === 0 ? `
                        <button class="btn-add" onclick="updateCart(${item.id}, 1)">
                            <span>+</span>
                        </button>
                    ` : `
                        <div style="display:flex; align-items:center; gap:10px; background:#F1F5F9; padding:4px 8px; border-radius:20px;">
                            <button class="btn-add" onclick="updateCart(${item.id}, -1)" style="width:24px; height:24px; font-size:1rem;">-</button>
                            <span style="font-weight:600; font-size:0.9rem;">${qty}</span>
                            <button class="btn-add" onclick="updateCart(${item.id}, 1)" style="width:24px; height:24px; font-size:1rem;">+</button>
                        </div>
                    `}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ===== UI: FILTER =====
function filtrarCategoria(cat, btn) {
    // Update Tabs
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    if (cat === 'all') {
        renderProducts(servicios);
    } else {
        const filtered = servicios.filter(s => s.categoria === cat);
        renderProducts(filtered);
    }
}

// ===== LOGIC: CART =====
function updateCart(id, delta) {
    const item = servicios.find(s => s.id === id);
    const existing = carrito.find(c => c.id === id);

    if (existing) {
        existing.cantidad += delta;
        if (existing.cantidad <= 0) {
            carrito = carrito.filter(c => c.id !== id);
        }
    } else if (delta > 0) {
        carrito.push({ ...item, cantidad: 1 });
    }

    updateCartUI();
    // Re-render to show +/- buttons
    // NOTE: In a framework (React) this is auto, here we manual
    // To avoid full re-render flickering, ideally we update DOM node.
    // simpler: re-render current view
    const activeTab = document.querySelector('.tab-pill.active').innerText;
    if (activeTab.includes('Todos')) renderProducts(servicios);
    else if (activeTab.includes('Bebidas')) renderProducts(servicios.filter(s => s.categoria === 'Bebidas'));
    else if (activeTab.includes('Snacks')) renderProducts(servicios.filter(s => s.categoria === 'Snacks'));
    else if (activeTab.includes('Tours')) renderProducts(servicios.filter(s => s.categoria === 'Tours'));
}

function updateCartUI() {
    const total = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
    const count = carrito.reduce((sum, i) => sum + i.cantidad, 0);

    // Floater
    const floater = document.getElementById('cartFloater');
    document.getElementById('floatCount').innerText = count;
    document.getElementById('floatTotal').innerText = total.toFixed(2);

    if (count > 0) floater.classList.add('visible');
    else floater.classList.remove('visible');

    // Bottom Sheet
    const container = document.getElementById('cartItems');
    document.getElementById('cartTotal').innerText = total.toFixed(2);

    if (carrito.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #94A3B8; padding: 40px;">Tu carrito está vacío</div>';
        return;
    }

    container.innerHTML = '';
    carrito.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;';
        row.innerHTML = `
            <div>
                <div style="font-weight:600;">${item.nombre}</div>
                <div style="font-size:0.9rem; color:#64748B;">S/ ${item.precio.toFixed(2)} x ${item.cantidad}</div>
            </div>
            <div style="font-weight:700;">S/ ${(item.precio * item.cantidad).toFixed(2)}</div>
        `;
        container.appendChild(row);
    });
}

function toggleCart(open) {
    const sheet = document.getElementById('cartSheet');
    const backdrop = document.getElementById('modalBackdrop');

    if (open) {
        sheet.classList.add('open');
        backdrop.classList.add('active');
    } else {
        sheet.classList.remove('open');
        backdrop.classList.remove('active');
    }
}

// ===== UI: CHECKOUT =====
function abrirCheckout() {
    toggleCart(false); // Close cart
    document.getElementById('modalCheckout').style.display = 'block';
}

async function enviarPedido(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerText = 'Enviando...';

    const pedido = {
        nombre: document.getElementById('inputNombre').value,
        habitacion: document.getElementById('inputHabitacion').value,
        email: document.getElementById('inputEmail').value,
        notas: document.getElementById('inputNotas').value,
        servicios: carrito,
        total: carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0)
    };

    try {
        const res = await fetch(`${CONFIG.API_URL}?action=crearPedido`, {
            method: 'POST',
            body: JSON.stringify(pedido)
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('modalCheckout').style.display = 'none';
            document.getElementById('modalSuccess').style.display = 'flex';
            carrito = [];
            updateCartUI();
        } else {
            showToast('❌ Error en el servidor');
        }
    } catch (err) {
        showToast('❌ Error de conexión');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Enviar Pedido';
    }
}

// ===== UTILS: TOAST =====
function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerText = msg;

    container.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-20px)';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}
