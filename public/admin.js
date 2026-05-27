const adminState = {
    token: localStorage.getItem('token') || null
};

async function apiRequest(endpoint, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    };
    if (adminState.token) {
        config.headers.Authorization = `Bearer ${adminState.token}`;
    }
    const res = await fetch(endpoint, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = data.message || '请求失败';
        throw new Error(message);
    }
    return data;
}

function show(elId) {
    document.getElementById(elId)?.classList.remove('hidden');
}

function hide(elId) {
    document.getElementById(elId)?.classList.add('hidden');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

async function ensureAdmin() {
    if (!adminState.token) return false;
    try {
        await apiRequest('/api/admin/users', { method: 'GET' });
        return true;
    } catch {
        return false;
    }
}

function renderResources(items) {
    const tbody = document.getElementById('resources-table');
    if (!tbody) return;
    tbody.innerHTML = items.map((r) => `
        <tr>
            <td class="py-2 pr-3 text-gray-500">${r.id}</td>
            <td class="py-2 pr-3 font-semibold">${r.title}</td>
            <td class="py-2 pr-3 text-gray-600">${r.category}</td>
            <td class="py-2 pr-3">${r.emoji ? `<span class="text-xl">${r.emoji}</span>` : (r.icon ? `<i data-lucide="${r.icon}" class="w-5 h-5 text-gray-400"></i>` : '-')}</td>
            <td class="py-2 pr-3 text-gray-500">${r.students || '-'}</td>
            <td class="py-2 pr-0 text-right">
                <button class="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold hover:bg-gray-50" onclick="deleteResource(${r.id})">删除</button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function renderUsers(items) {
    const tbody = document.getElementById('users-table');
    if (!tbody) return;
    tbody.innerHTML = items.map((u) => `
        <tr>
            <td class="py-2 pr-3 font-semibold">${u.username}</td>
            <td class="py-2 pr-3 text-gray-600">${u.email}</td>
            <td class="py-2 pr-3"><span class="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-bold">${u.role}</span></td>
            <td class="py-2 pr-3 text-gray-600">${u.points}</td>
            <td class="py-2 pr-3 text-gray-600">${u.learning_days}</td>
        </tr>
    `).join('');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderDbSchema(schema) {
    const container = document.getElementById('db-schema-container');
    if (!container) return;

    const tables = schema?.tables || [];
    if (!tables.length) {
        container.innerHTML = `<div class="text-sm text-gray-500">暂无表</div>`;
        return;
    }

    container.innerHTML = tables.map((t) => {
        const cols = t.columns || [];
        return `
            <div class="border border-gray-100 rounded-2xl p-5 bg-gray-50">
                <div class="flex items-center justify-between gap-3">
                    <div class="font-extrabold text-gray-900">${escapeHtml(t.name)}</div>
                    <div class="text-xs text-gray-400 font-bold">${cols.length} 列</div>
                </div>
                <div class="mt-2 text-xs text-gray-500 whitespace-pre-wrap break-words">${escapeHtml(t.sql || '')}</div>
                <div class="mt-4 overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-gray-400">
                                <th class="py-2 pr-3">字段</th>
                                <th class="py-2 pr-3">类型</th>
                                <th class="py-2 pr-3">NOT NULL</th>
                                <th class="py-2 pr-3">默认值</th>
                                <th class="py-2 pr-3">主键</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${cols.map((c) => `
                                <tr>
                                    <td class="py-2 pr-3 font-semibold text-gray-800">${escapeHtml(c.name)}</td>
                                    <td class="py-2 pr-3 text-gray-600">${escapeHtml(c.type)}</td>
                                    <td class="py-2 pr-3 text-gray-600">${c.notnull ? 'YES' : 'NO'}</td>
                                    <td class="py-2 pr-3 text-gray-600">${escapeHtml(c.dflt_value ?? '-')}</td>
                                    <td class="py-2 pr-3 text-gray-600">${c.pk ? 'YES' : 'NO'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
}

async function refreshResources() {
    const res = await apiRequest('/api/admin/resources');
    setText('stat-resources', res.data.total);
    renderResources(res.data.items || []);
}

async function refreshUsers() {
    const res = await apiRequest('/api/admin/users');
    setText('stat-users', res.data.total);
    renderUsers(res.data.items || []);
}

async function refreshDbSchema() {
    hide('db-schema-error');
    const res = await apiRequest('/api/admin/db/schema');
    renderDbSchema(res.data);
}

async function login(username, password) {
    const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    adminState.token = res.data.access_token;
    localStorage.setItem('token', adminState.token);
}

async function createResource() {
    hide('resource-create-error');
    const payload = {
        title: document.getElementById('res-title')?.value?.trim(),
        category: document.getElementById('res-category')?.value?.trim(),
        students: document.getElementById('res-students')?.value?.trim() || null,
        emoji: document.getElementById('res-emoji')?.value?.trim() || null,
        icon: document.getElementById('res-icon')?.value?.trim() || null,
        color: document.getElementById('res-color')?.value?.trim() || 'blue',
        desc: document.getElementById('res-desc')?.value?.trim()
    };
    await apiRequest('/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    await refreshResources();
    document.getElementById('resource-create-form')?.reset();
}

async function deleteResource(id) {
    await apiRequest(`/api/admin/resources/${id}`, { method: 'DELETE' });
    await refreshResources();
}

window.deleteResource = deleteResource;

async function bootstrap() {
    lucide.createIcons();

    const isAdmin = await ensureAdmin();
    if (!isAdmin) {
        show('admin-login');
        hide('admin-panel');
        return;
    }

    hide('admin-login');
    show('admin-panel');
    await Promise.all([refreshUsers(), refreshResources()]);
    try {
        await refreshDbSchema();
    } catch (err) {
        const el = document.getElementById('db-schema-error');
        if (el) {
            el.textContent = err.message || '获取失败';
            el.classList.remove('hidden');
        }
    }
}

document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide('admin-login-error');
    try {
        const username = document.getElementById('admin-username')?.value?.trim();
        const password = document.getElementById('admin-password')?.value;
        await login(username, password);
        await bootstrap();
    } catch (err) {
        const el = document.getElementById('admin-login-error');
        if (el) {
            el.textContent = err.message || '登录失败';
            el.classList.remove('hidden');
        }
    }
});

document.getElementById('resource-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await createResource();
    } catch (err) {
        const el = document.getElementById('resource-create-error');
        if (el) {
            el.textContent = err.message || '创建失败';
            el.classList.remove('hidden');
        }
    }
});

document.getElementById('refresh-resources')?.addEventListener('click', refreshResources);
document.getElementById('refresh-users')?.addEventListener('click', refreshUsers);
document.getElementById('refresh-db-schema')?.addEventListener('click', async () => {
    try {
        await refreshDbSchema();
    } catch (err) {
        const el = document.getElementById('db-schema-error');
        if (el) {
            el.textContent = err.message || '获取失败';
            el.classList.remove('hidden');
        }
    }
});

document.getElementById('admin-logout')?.addEventListener('click', () => {
    adminState.token = null;
    localStorage.removeItem('token');
    location.reload();
});

bootstrap();

