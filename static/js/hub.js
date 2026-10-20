let allApps = [];
let appStatuses = {};
let activeCategory = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    loadApps();
    setupEventListeners();
    setInterval(fetchStatuses, 3000);
});

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderApps();
        });
    }

    const appForm = document.getElementById('app-form');
    if (appForm) {
        appForm.addEventListener('submit', handleSaveApp);
    }
}

async function loadApps() {
    try {
        const res = await fetch('/api/apps');
        allApps = await res.json();
        renderCategories();
        await fetchStatuses();
        renderApps();
    } catch (err) {
        showToast('Error cargando aplicaciones: ' + err, 'error');
    }
}

async function fetchStatuses() {
    try {
        const res = await fetch('/api/status');
        appStatuses = await res.json();
        updateStatusDots();
    } catch (err) {
        console.error('Error fetching statuses:', err);
    }
}

function renderCategories() {
    const categories = ['all'];
    allApps.forEach(a => {
        if (a.category && !categories.includes(a.category)) {
            categories.push(a.category);
        }
    });

    const tabsContainer = document.getElementById('category-pills');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = categories.map(cat => {
        const label = cat === 'all' ? 'Todas' : cat;
        const isActive = cat === activeCategory ? 'active' : '';
        return `<button class="tab-btn ${isActive}" onclick="filterCategory('${cat}')">${label}</button>`;
    }).join('');
}

function filterCategory(cat) {
    activeCategory = cat;
    renderCategories();
    renderApps();
}

function renderApps() {
    const grid = document.getElementById('app-grid');
    if (!grid) return;

    const filtered = allApps.filter(a => {
        const matchCategory = (activeCategory === 'all' || a.category === activeCategory);
        const matchSearch = !searchQuery || 
            (a.name && a.name.toLowerCase().includes(searchQuery)) ||
            (a.description && a.description.toLowerCase().includes(searchQuery)) ||
            (a.category && a.category.toLowerCase().includes(searchQuery));
        return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <i class="fa-regular fa-folder-open" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                <p style="font-size: 0.9rem;">No se encontraron aplicaciones con ese filtro.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(app => {
        const statusInfo = appStatuses[app.id] || {};
        const isServer = !!app.port;
        const isOnline = statusInfo.online === true;

        let dotClass = 'static';
        let statusTitle = 'Documento / Archivo';
        if (isServer) {
            dotClass = isOnline ? 'online' : 'offline';
            statusTitle = isOnline ? 'En línea' : 'Inactivo (Servidor apagado)';
        }

        let serviceControlHtml = '';
        if (isServer) {
            if (isOnline) {
                serviceControlHtml = `
                    <button class="btn btn-ghost stop" onclick="stopService('${app.id}')" title="Apagar Servidor">
                        <i class="fa-solid fa-power-off"></i> Apagar
                    </button>
                `;
            } else {
                serviceControlHtml = `
                    <button class="btn btn-ghost start" onclick="startService('${app.id}')" title="Encender Servidor">
                        <i class="fa-solid fa-play"></i> Encender
                    </button>
                `;
            }
        }

        const iconClass = (app.icon && app.icon.startsWith('fa-')) ? app.icon : 'fa-solid fa-layer-group';
        const portBadge = app.port ? `<span class="card-port-badge">:${app.port}</span>` : '';

        return `
            <div class="app-card" id="card-${app.id}">
                <div>
                    <div class="card-top">
                        <div class="card-left">
                            <div class="card-icon">
                                <i class="${iconClass}"></i>
                            </div>
                            <div class="card-titles">
                                <div class="title-row">
                                    <span class="card-title">${escapeHtml(app.name)}</span>
                                    <span class="status-dot ${dotClass}" id="dot-${app.id}" title="${statusTitle}"></span>
                                </div>
                                <span class="card-category">${escapeHtml(app.category || 'General')}</span>
                            </div>
                        </div>
                        ${portBadge}
                    </div>

                    <p class="card-desc">${escapeHtml(app.description || 'Sin descripción.')}</p>
                </div>

                <div class="card-bottom">
                    <div class="left-actions">
                        <a href="/open/${app.id}" target="_blank" class="btn btn-primary">
                            Abrir <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px; margin-left: 2px;"></i>
                        </a>
                        ${serviceControlHtml}
                    </div>
                    
                    <div class="right-actions">
                        <button class="btn-icon" onclick="openEditModal('${app.id}')" title="Editar">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="btn-icon delete" onclick="deleteApp('${app.id}')" title="Eliminar">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateStatusDots() {
    allApps.forEach(app => {
        if (!app.port) return;
        const statusInfo = appStatuses[app.id] || {};
        const isOnline = statusInfo.online === true;
        const dot = document.getElementById(`dot-${app.id}`);
        if (dot) {
            dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
            dot.title = isOnline ? 'En línea' : 'Inactivo (Servidor apagado)';
        }
    });
}

async function startService(appId) {
    showToast('Iniciando servicio...', 'info');
    try {
        const res = await fetch(`/api/services/start/${appId}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('Servidor encendido.', 'success');
            await fetchStatuses();
            renderApps();
        } else {
            showToast('Error iniciando servidor: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

async function stopService(appId) {
    showToast('Deteniendo servicio...', 'info');
    try {
        const res = await fetch(`/api/services/stop/${appId}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('Servidor apagado.', 'success');
            await fetchStatuses();
            renderApps();
        } else {
            showToast('Error al detener servidor', 'error');
        }
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// --- MANTENEDOR (CRUD) ---
function openNewModal() {
    document.getElementById('modal-title').innerText = 'Nueva Aplicación';
    document.getElementById('app-id').value = '';
    document.getElementById('app-name').value = '';
    document.getElementById('app-desc').value = '';
    document.getElementById('app-category').value = 'General';
    document.getElementById('app-icon').value = 'fa-solid fa-cube';
    document.getElementById('app-type').value = 'file';
    document.getElementById('app-target').value = '';
    document.getElementById('app-local-path').value = '';
    document.getElementById('app-port').value = '';
    document.getElementById('app-cwd').value = '';
    document.getElementById('app-cmd').value = '';

    toggleTypeFields();
    document.getElementById('app-modal').classList.add('active');
}

function openEditModal(appId) {
    const app = allApps.find(a => a.id === appId);
    if (!app) return;

    document.getElementById('modal-title').innerText = 'Modificar Aplicación';
    document.getElementById('app-id').value = app.id || '';
    document.getElementById('app-name').value = app.name || '';
    document.getElementById('app-desc').value = app.description || '';
    document.getElementById('app-category').value = app.category || 'General';
    document.getElementById('app-icon').value = app.icon || 'fa-solid fa-cube';
    document.getElementById('app-type').value = app.type || 'file';
    document.getElementById('app-target').value = app.target || '';
    document.getElementById('app-local-path').value = app.local_path || '';
    document.getElementById('app-port').value = app.port || '';
    document.getElementById('app-cwd').value = app.cwd || '';
    document.getElementById('app-cmd').value = app.cmd || '';

    toggleTypeFields();
    document.getElementById('app-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('app-modal').classList.remove('active');
}

function toggleTypeFields() {
    const type = document.getElementById('app-type').value;
    const serverFields = document.getElementById('server-fields');
    if (type === 'service') {
        serverFields.style.display = 'contents';
    } else {
        serverFields.style.display = 'none';
    }
}

async function handleSaveApp(e) {
    e.preventDefault();
    const appData = {
        id: document.getElementById('app-id').value.trim() || undefined,
        name: document.getElementById('app-name').value.trim(),
        description: document.getElementById('app-desc').value.trim(),
        category: document.getElementById('app-category').value.trim(),
        icon: document.getElementById('app-icon').value.trim() || 'fa-solid fa-cube',
        type: document.getElementById('app-type').value,
        target: document.getElementById('app-target').value.trim(),
        local_path: document.getElementById('app-local-path').value.trim(),
        port: document.getElementById('app-port').value ? parseInt(document.getElementById('app-port').value) : null,
        cwd: document.getElementById('app-cwd').value.trim(),
        cmd: document.getElementById('app-cmd').value.trim()
    };

    if (!appData.name) {
        showToast('El nombre de la aplicación es obligatorio.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData)
        });
        const data = await res.json();
        if (data.success) {
            showToast('Aplicación guardada correctamente.', 'success');
            closeModal();
            loadApps();
        } else {
            showToast('Error al guardar: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error de conexión al guardar', 'error');
    }
}

async function deleteApp(appId) {
    const app = allApps.find(a => a.id === appId);
    if (!app) return;

    if (!confirm(`¿Eliminar "${app.name}" del portal?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/apps/${appId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Aplicación eliminada.', 'success');
            loadApps();
        } else {
            showToast('Error al eliminar: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Error al eliminar', 'error');
    }
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.className = `toast ${type} show`;
    toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
