/**
 * 智荐通 App 核心逻辑
 * 统一JavaScript版本 - 整合前后端
 * 新增：验证码、密码强度检测、安全增强
 */

// API基础URL
const API_BASE_URL = '';

// 全局状态
const appState = {
    user: null,
    token: localStorage.getItem('token'),
    currentView: 'dashboard',
    isLoggedIn: false,
    resources: [],
    learningPaths: [],
    chatHistory: []
};

// ==================== 验证码相关 ====================

let currentCaptcha = '';

// 生成验证码
function generateCaptcha() {
    const canvas = document.getElementById('captcha-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    currentCaptcha = '';

    // 清空画布
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(0, 0, 100, 40);

    // 生成4位验证码
    for (let i = 0; i < 4; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        currentCaptcha += char;

        ctx.font = `bold ${20 + Math.random() * 5}px Arial`;
        ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 40%)`;
        ctx.textBaseline = 'middle';
        ctx.fillText(char, 15 + i * 22, 20 + Math.random() * 10 - 5);
    }

    // 添加干扰线
    for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `hsla(${Math.random() * 360}, 70%, 50%, 0.5)`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * 100, Math.random() * 40);
        ctx.lineTo(Math.random() * 100, Math.random() * 40);
        ctx.stroke();
    }

    // 添加干扰点
    for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `hsla(${Math.random() * 360}, 70%, 50%, 0.5)`;
        ctx.beginPath();
        ctx.arc(Math.random() * 100, Math.random() * 40, 1, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// ==================== 密码强度检测 ====================

function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    return strength;
}

function updatePasswordStrength(password, suffix = '') {
    const container = document.getElementById('password-strength' + suffix);
    const text = document.getElementById('strength-text' + suffix);
    if (!container) return;

    if (!password) {
        container.classList.add('hidden');
        if (text) text.textContent = '';
        return;
    }

    container.classList.remove('hidden');
    const strength = checkPasswordStrength(password);

    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
    const texts = ['弱', '一般', '较强', '强'];
    const textColors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500'];

    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById(`strength${suffix}-${i}`);
        if (bar) {
            bar.className = `h-1 flex-1 rounded ${i <= strength ? colors[strength - 1] : 'bg-gray-200'}`;
        }
    }

    if (text) {
        text.textContent = `密码强度：${texts[strength - 1] || '太弱'}`;
        text.className = `mt-1 ${textColors[strength - 1] || 'text-red-500'}`;
    }
}

// ==================== API 请求工具 ====================

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    // 添加认证头
    if (appState.token) {
        config.headers['Authorization'] = `Bearer ${appState.token}`;
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '请求失败');
        }

        return data;
    } catch (error) {
        console.error('API请求错误:', error);
        throw error;
    }
}

// ==================== 认证相关 ====================

async function handleLogin(event) {
    event.preventDefault();

    // 验证码校验
    const captchaInput = document.getElementById('login-captcha');
    if (captchaInput) {
        const captchaValue = captchaInput.value.toUpperCase();
        if (captchaValue !== currentCaptcha) {
            const errorDiv = document.getElementById('login-error');
            errorDiv.textContent = '验证码错误，请重新输入';
            errorDiv.classList.remove('hidden');
            generateCaptcha();
            captchaInput.value = '';
            return;
        }
    }

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');

    // 显示加载状态
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span>登录中...</span>';
    errorDiv.classList.add('hidden');

    try {
        const response = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (response.code === 200) {
            // 保存token
            appState.token = response.data.access_token;
            localStorage.setItem('token', appState.token);
            appState.user = {
                username: response.data.username,
                email: response.data.email
            };

            // 切换到主界面
            document.getElementById('auth-views').classList.add('view-hidden');
            document.getElementById('app-view').classList.remove('view-hidden');
            document.querySelector('.mascot-float').classList.remove('view-hidden');

            // 加载用户数据
            await loadUserInfo();
            await loadDashboard();
            switchView('dashboard');

            lucide.createIcons();
        }
    } catch (error) {
        errorDiv.textContent = error.message || '登录失败，请检查用户名和密码';
        errorDiv.classList.remove('hidden');
        // 登录失败后刷新验证码
        generateCaptcha();
        if (captchaInput) captchaInput.value = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>立即登录</span>';
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const interestsStr = document.getElementById('reg-interests').value;
    const btn = document.getElementById('register-btn');
    const errorDiv = document.getElementById('register-error');

    const interests = interestsStr.split(',').map(s => s.trim()).filter(s => s);

    // 密码强度检查
    const strength = checkPasswordStrength(password);
    if (strength < 2) {
        errorDiv.textContent = '密码强度太弱，请使用包含大小写字母、数字或特殊字符的密码';
        errorDiv.classList.remove('hidden');
        return;
    }

    // 显示加载状态
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span>注册中...</span>';
    errorDiv.classList.add('hidden');

    try {
        const response = await apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password, interests })
        });

        if (response.code === 201) {
            alert('注册成功！请登录。');
            showAuthView('login');
            // 清空表单
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-interests').value = '';
            // 刷新验证码
            generateCaptcha();
        }
    } catch (error) {
        errorDiv.textContent = error.message || '注册失败';
        errorDiv.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>创建账号</span>';
    }
}

function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        // 清除状态
        appState.token = null;
        appState.user = null;
        localStorage.removeItem('token');

        // 切换到登录界面
        document.getElementById('app-view').classList.add('view-hidden');
        document.getElementById('auth-views').classList.remove('view-hidden');
        document.querySelector('.mascot-float').classList.add('view-hidden');

        showAuthView('login');
        // 刷新验证码
        generateCaptcha();
    }
}

function showAuthView(view) {
    document.getElementById('login-view').classList.add('view-hidden');
    document.getElementById('register-view').classList.add('view-hidden');
    document.getElementById(view + '-view').classList.remove('view-hidden');
    lucide.createIcons();
    // 切换到登录页时刷新验证码
    if (view === 'login') {
        setTimeout(generateCaptcha, 100);
    }
}

// ==================== 数据加载 ====================

async function loadUserInfo() {
    try {
        const response = await apiRequest('/api/user/info');
        if (response.code === 200) {
            appState.user = response.data;
            // 更新UI
            document.getElementById('user-name').textContent = response.data.username;
            document.getElementById('profile-name').textContent = response.data.username;
            document.getElementById('profile-level').textContent = `${response.data.learningGoal} · ${response.data.level}`;
            document.getElementById('profile-points').textContent = response.data.points.toLocaleString();
            document.getElementById('profile-days').textContent = response.data.learningDays;
            document.getElementById('profile-badges').textContent = response.data.badges;
            document.getElementById('stat-points').textContent = response.data.points.toLocaleString();
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

async function loadDashboard() {
    try {
        const response = await apiRequest('/api/dashboard');
        if (response.code === 200) {
            const data = response.data;

            // 更新学习路径
            renderLearningPath(data.learningPath);

            // 更新统计数据
            document.getElementById('stat-weekly-hours').textContent = data.stats.weeklyHours;
            document.getElementById('stat-streak').textContent = data.stats.streakDays;
            document.getElementById('stat-points').textContent = data.stats.points.toLocaleString();
        }
    } catch (error) {
        console.error('加载仪表盘失败:', error);
    }
}

async function loadResources() {
    try {
        const response = await apiRequest('/api/resource/list?limit=50');
        if (response.code === 200) {
            appState.resources = response.data.items;
            renderResources(appState.resources);
        }
    } catch (error) {
        console.error('加载资源失败:', error);
    }
}

async function loadRecommendations() {
    try {
        const response = await apiRequest('/api/recommend/personal');
        if (response.code === 200) {
            renderRecommendations(response.data);
        }
    } catch (error) {
        console.error('加载推荐失败:', error);
    }
}

async function loadLearningPaths() {
    try {
        const response = await apiRequest('/api/path/list');
        if (response.code === 200) {
            appState.learningPaths = response.data.items;
            renderLearningPaths(appState.learningPaths);
        }
    } catch (error) {
        console.error('加载学习路径失败:', error);
    }
}

// ==================== 渲染函数 ====================

function renderLearningPath(path) {
    const container = document.getElementById('learning-path-tracker');
    if (!container || !path) return;

    container.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold flex items-center gap-2">
                <i data-lucide="trending-up" class="w-5 h-5 text-blue-500"></i>
                学习路径追踪
            </h2>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div class="flex flex-col md:flex-row md:items-center gap-8">
                <div class="flex-1">
                    <div class="flex justify-between items-end mb-2">
                        <div>
                            <p class="text-sm text-gray-500">当前路径</p>
                            <h3 class="font-bold text-xl">${path.title}</h3>
                        </div>
                        <span class="text-blue-600 font-bold">${path.progress || 0}%</span>
                    </div>
                    <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-600 rounded-full" style="width: ${path.progress || 0}%"></div>
                    </div>
                    <div class="mt-4 flex gap-4">
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full bg-blue-600"></div>
                            <span class="text-xs text-gray-500">已完成 ${path.completed || 0}/${path.total || 0} 课时</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full bg-gray-300"></div>
                            <span class="text-xs text-gray-500">预计还需 4 小时</span>
                        </div>
                    </div>
                </div>
                <div class="flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
                    <p class="text-sm text-gray-500 mb-3">下一步学习</p>
                    <div class="flex items-center gap-4 bg-gray-50 p-3 rounded-xl">
                        <div class="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm text-blue-600">
                            <i data-lucide="play-circle" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <p class="text-sm font-semibold">${path.nextStep?.title || '暂无'}</p>
                            <p class="text-xs text-gray-500">难度：${path.nextStep?.difficulty || '中等'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function renderResources(resources) {
    const grid = document.getElementById('resource-grid');
    const libraryGrid = document.getElementById('library-resource-grid');

    const html = resources.map(res => `
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer" onclick="openResourceDetail(${res.id})">
            <div class="aspect-video bg-${res.color}-100 flex items-center justify-center relative">
                ${res.image ? `<img src="${res.image}" alt="" class="w-full h-full object-cover" />` : (res.emoji ? `<span class="text-5xl select-none">${res.emoji}</span>` : `<i data-lucide="${res.icon}" class="w-12 h-12 text-${res.color}-500"></i>`)}
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
            </div>
            <div class="p-4">
                <h4 class="font-bold text-gray-800 mb-1 truncate">${res.title}</h4>
                <p class="text-xs text-gray-500 mb-3 line-clamp-2">${res.desc}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xs px-2 py-0.5 bg-${res.color}-50 text-${res.color}-600 rounded">${res.category}</span>
                    <span class="text-xs text-gray-400">${res.students} 人学习</span>
                </div>
            </div>
        </div>
    `).join('');

    if (grid) grid.innerHTML = html;
    if (libraryGrid) libraryGrid.innerHTML = html;
    lucide.createIcons();
}

async function openResourceDetail(id) {
    try {
        const response = await apiRequest(`/api/resource/${id}`);
        if (response.code !== 200) return;

        const data = response.data;
        const overlay = document.getElementById('resource-modal-overlay');
        if (!overlay) return;

        const cover = document.getElementById('resource-modal-cover');
        if (cover) {
            if (data.image) {
                cover.innerHTML = `<img src="${data.image}" alt="" class="w-full h-full object-cover rounded-xl" />`;
            } else if (data.emoji) {
                cover.innerHTML = `<span class="text-2xl">${data.emoji}</span>`;
            } else if (data.icon) {
                cover.innerHTML = `<i data-lucide="${data.icon}" class="w-5 h-5 text-gray-500"></i>`;
            } else {
                cover.innerHTML = '';
            }
        }

        const title = document.getElementById('resource-modal-title');
        if (title) title.textContent = data.title || '资源详情';
        const meta = document.getElementById('resource-modal-meta');
        if (meta) meta.textContent = data.id ? `#${data.id}` : '';
        const desc = document.getElementById('resource-modal-desc');
        if (desc) desc.textContent = data.desc || '';
        const category = document.getElementById('resource-modal-category');
        if (category) category.textContent = data.category || '';
        const students = document.getElementById('resource-modal-students');
        if (students) students.textContent = data.students ? `${data.students} 人学习` : '';

        const link = document.getElementById('resource-modal-link');
        if (link) {
            const url = (data.url || '').trim();
            if (url) {
                link.href = url;
                link.classList.remove('hidden');
            } else {
                link.removeAttribute('href');
                link.classList.add('hidden');
            }
        }

        const outlineWrap = document.getElementById('resource-modal-outline');
        const outlineList = document.getElementById('resource-modal-outline-list');
        if (outlineWrap && outlineList) {
            let items = [];
            try {
                items = JSON.parse(data.outline_json || '[]') || [];
            } catch {
                items = [];
            }
            const valid = Array.isArray(items) ? items.filter((x) => x && (x.title || x.url)) : [];
            if (valid.length) {
                outlineList.innerHTML = '';
                valid.forEach((it) => {
                    const titleText = String(it.title || it.url || '').trim();
                    const url = String(it.url || '').trim();
                    if (url) {
                        const a = document.createElement('a');
                        a.className = 'block px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors';
                        a.href = url;
                        a.target = '_blank';
                        a.rel = 'noopener';

                        const row = document.createElement('div');
                        row.className = 'flex items-center justify-between gap-3';

                        const t = document.createElement('div');
                        t.className = 'text-sm font-semibold text-gray-800 truncate';
                        t.textContent = titleText;

                        const icon = document.createElement('i');
                        icon.setAttribute('data-lucide', 'external-link');
                        icon.className = 'w-4 h-4 text-gray-400 flex-shrink-0';

                        row.appendChild(t);
                        row.appendChild(icon);
                        a.appendChild(row);
                        outlineList.appendChild(a);
                        return;
                    }

                    const box = document.createElement('div');
                    box.className = 'px-3 py-2 rounded-xl border border-gray-100 bg-gray-50';

                    const t = document.createElement('div');
                    t.className = 'text-sm font-semibold text-gray-800';
                    t.textContent = titleText;

                    box.appendChild(t);
                    outlineList.appendChild(box);
                });
                outlineWrap.classList.remove('hidden');
            } else {
                outlineList.innerHTML = '';
                outlineWrap.classList.add('hidden');
            }
        }

        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        lucide.createIcons();
    } catch (error) {
        console.error(error);
    }
}

function closeResourceModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const overlay = document.getElementById('resource-modal-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
}

window.openResourceDetail = openResourceDetail;
window.closeResourceModal = closeResourceModal;

function renderRecommendations(data) {
    const grid = document.getElementById('recommendation-grid');
    const guessGrid = document.getElementById('guess-you-like-grid');

    if (grid && data.recommendations) {
        grid.innerHTML = data.recommendations.map(rec => `
            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex gap-6">
                <div class="w-32 h-32 bg-${rec.color}-100 rounded-xl flex-shrink-0 flex items-center justify-center">
                    <i data-lucide="${rec.icon}" class="w-12 h-12 text-${rec.color}-500"></i>
                </div>
                <div class="flex-1">
                    <span class="text-xs font-semibold text-${rec.color}-600 bg-${rec.color}-50 px-2 py-1 rounded">${rec.category}</span>
                    <h3 class="text-lg font-bold mt-2 mb-1">${rec.title}</h3>
                    <p class="text-sm text-gray-500 mb-4 line-clamp-2">${rec.desc}</p>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-xs text-gray-400">
                            <i data-lucide="users" class="w-4 h-4"></i>
                            <span>${rec.students} 人已学</span>
                        </div>
                        <button class="text-sm font-bold text-blue-600 hover:text-blue-700">立即开始</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    if (guessGrid && data.guessYouLike) {
        guessGrid.innerHTML = data.guessYouLike.map(item => `
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center group cursor-pointer hover:shadow-md transition-shadow">
                <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-${item.color}-50 transition-colors">
                    <i data-lucide="${item.icon}" class="w-6 h-6 text-gray-400 group-hover:text-${item.color}-500"></i>
                </div>
                <p class="text-sm font-semibold">${item.title}</p>
            </div>
        `).join('');
    }

    lucide.createIcons();
}

function renderLearningPaths(paths) {
    const container = document.getElementById('learning-paths-container');
    if (!container) return;

    container.innerHTML = paths.map((path, index) => {
        const isCompleted = path.status === 'completed';
        const isInProgress = path.status === 'in_progress';
        const statusClass = isCompleted ? 'bg-green-50 text-green-600' : (isInProgress ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400');
        const statusText = isCompleted ? '已完成' : (isInProgress ? `进行中 ${path.progress}%` : '未开始');
        const dotClass = isCompleted ? 'bg-blue-600' : (isInProgress ? 'bg-blue-600' : 'bg-gray-200');
        const borderClass = isInProgress ? 'border-l-4 border-l-blue-600' : '';

        return `
            <div class="relative pl-20">
                <div class="absolute left-6 top-0 w-4 h-4 ${dotClass} rounded-full border-4 border-white ring-4 ${isCompleted || isInProgress ? 'ring-blue-100' : ''}"></div>
                <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${borderClass}">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">阶段 0${path.stage}</span>
                            <h3 class="text-xl font-bold mt-1 ${!isCompleted && !isInProgress ? 'text-gray-400' : ''}">${path.title}</h3>
                        </div>
                        <span class="px-3 py-1 ${statusClass} text-xs font-bold rounded-full">${statusText}</span>
                    </div>
                    ${path.items ? `
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        ${path.items.map((item, i) => `
                            <div class="p-3 ${isCompleted || (isInProgress && i < 1) ? 'bg-gray-50' : (isInProgress && i === 1 ? 'bg-blue-50' : 'bg-white')} rounded-xl border border-gray-100 flex items-center gap-3">
                                <i data-lucide="${isCompleted || (isInProgress && i < 1) ? 'check-circle' : (isInProgress && i === 1 ? 'clock' : 'circle')}" class="w-5 h-5 ${isCompleted || (isInProgress && i < 1) ? 'text-green-500' : (isInProgress && i === 1 ? 'text-blue-500' : 'text-gray-300')}"></i>
                                <span class="text-sm ${isInProgress && i === 1 ? 'text-blue-700 font-medium' : 'text-gray-600'}">${item}</span>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    ${isInProgress ? '<button class="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors">继续学习</button>' : ''}
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

// ==================== 视图切换 ====================

function switchView(viewId) {
    const views = [
        'dashboard-view',
        'ai-assistant-view',
        'recommended-view',
        'learning-path-view',
        'resource-library-view',
        'personal-space-view',
        'quick-access-view'
    ];
    const navs = [
        'nav-dashboard',
        'nav-ai-assistant',
        'nav-recommended',
        'nav-learning-path',
        'nav-resource-library',
        'nav-personal-space',
        'nav-quick-access'
    ];

    // Hide all views and reset nav styles
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('view-hidden');
    });
    navs.forEach(n => {
        const el = document.getElementById(n);
        if (el) {
            el.classList.remove('bg-blue-50', 'text-blue-700');
            el.classList.add('text-gray-500', 'hover:bg-gray-100', 'hover:text-gray-900');
        }
    });

    // Show target view
    const targetView = document.getElementById(viewId + '-view');
    if (targetView) targetView.classList.remove('view-hidden');

    // Load view-specific data
    if (viewId === 'dashboard') {
        loadDashboard();
        loadResources();
    } else if (viewId === 'recommended') {
        loadRecommendations();
    } else if (viewId === 'resource-library') {
        loadResources();
    } else if (viewId === 'learning-path') {
        loadLearningPaths();
    } else if (viewId === 'personal-space') {
        loadUserInfo();
        loadDashboard();
    }

    // Set active nav style
    const targetNav = document.getElementById('nav-' + viewId);
    if (targetNav) {
        targetNav.classList.add('bg-blue-50', 'text-blue-700');
        targetNav.classList.remove('text-gray-500', 'hover:bg-gray-100', 'hover:text-gray-900');
    }

    // Handle mascot visibility
    const mascot = document.querySelector('.mascot-float');
    if (mascot) {
        if (viewId === 'ai-assistant') {
            mascot.classList.add('view-hidden');
        } else {
            mascot.classList.remove('view-hidden');
        }
    }

    appState.currentView = viewId;
    lucide.createIcons();
}

function filterResources(category) {
    // Update button styles
    document.querySelectorAll('.resource-filter').forEach(btn => {
        if (btn.dataset.category === category) {
            btn.classList.remove('bg-white', 'border', 'border-gray-200', 'text-gray-600');
            btn.classList.add('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-100');
        } else {
            btn.classList.add('bg-white', 'border', 'border-gray-200', 'text-gray-600');
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-100');
        }
    });

    // Filter resources
    if (category === 'all') {
        renderResources(appState.resources);
    } else {
        const filtered = appState.resources.filter(r => r.category === category);
        renderResources(filtered);
    }
}

// ==================== AI 聊天 ====================

function sendQuickMessage(message) {
    const input = document.getElementById('chat-input');
    input.value = message;
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';

    // Show loading
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';

    try {
        const response = await apiRequest('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ message })
        });

        if (response.code === 200) {
            // Simulate typing delay
            setTimeout(() => {
                addMessageToChat(response.data.answer, 'ai');
            }, 500);
        }
    } catch (error) {
        addMessageToChat('抱歉，我暂时无法回答。请稍后再试。', 'ai');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i data-lucide="send" class="w-5 h-5"></i>';
        lucide.createIcons();
    }
}

function addMessageToChat(message, sender) {
    const container = document.getElementById('chat-messages');
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    const messageHtml = sender === 'user' ? `
        <div class="flex gap-4 max-w-3xl ml-auto flex-row-reverse">
            <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-600 font-bold text-xs">
                ${appState.user?.username?.charAt(0) || '我'}
            </div>
            <div class="space-y-2 text-right">
                <div class="chat-bubble-user p-4 rounded-2xl shadow-md text-sm leading-relaxed" style="white-space: pre-line;">${escapeHtml(message)}</div>
                <p class="text-[10px] text-gray-400 mr-1">${time}</p>
            </div>
        </div>
    ` : `
        <div class="flex gap-4 max-w-3xl">
            <div class="w-8 h-8 flex-shrink-0">
                <img src="/resource/logo_ai.png" alt="AI助理" class="w-full h-full object-contain">
            </div>
            <div class="space-y-2">
                <div class="chat-bubble-ai p-4 rounded-2xl shadow-sm text-sm leading-relaxed text-gray-700" style="white-space: pre-line;">${escapeHtml(message)}</div>
                <p class="text-[10px] text-gray-400 ml-1">${time}</p>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', messageHtml);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 初始化 ====================

async function init() {
    lucide.createIcons();

    // 检查是否已登录
    if (appState.token) {
        try {
            await loadUserInfo();
            appState.isLoggedIn = true;

            // 显示主界面
            document.getElementById('auth-views').classList.add('view-hidden');
            document.getElementById('app-view').classList.remove('view-hidden');
            document.querySelector('.mascot-float').classList.remove('view-hidden');

            // 加载初始数据
            await loadDashboard();
            await loadResources();
            switchView('dashboard');
        } catch (error) {
            // Token无效，清除并显示登录
            localStorage.removeItem('token');
            appState.token = null;
            showAuthView('login');
        }
    } else {
        showAuthView('login');
    }

    // 初始化验证码
    generateCaptcha();

    // 密码强度监听 - 注册页
    const regPassword = document.getElementById('reg-password');
    if (regPassword) {
        regPassword.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value, '-reg');
        });
    }

    // 绑定聊天输入框事件
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
}

// 页面加载完成后启动
document.addEventListener('DOMContentLoaded', init);
