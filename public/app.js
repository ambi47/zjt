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
    learningPathGroups: [],
    selectedGroup: '全部',
    chatHistory: []
};

const AI_CHAT_HISTORY_PREFIX = 'ai_chat_history:';
const AI_CHAT_HISTORY_LIMIT = 120;

function getAiChatStorageKey() {
    const username = String(appState.user?.username || '').trim();
    if (!username) return '';
    return `${AI_CHAT_HISTORY_PREFIX}${username}`;
}

function loadAiChatHistory() {
    const key = getAiChatStorageKey();
    if (!key) return [];
    try {
        const raw = localStorage.getItem(key);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveAiChatHistory() {
    const key = getAiChatStorageKey();
    if (!key) return;
    const history = Array.isArray(appState.chatHistory) ? appState.chatHistory.slice(-AI_CHAT_HISTORY_LIMIT) : [];
    localStorage.setItem(key, JSON.stringify(history));
}

function restoreAiChatHistory(force = false) {
    const username = String(appState.user?.username || '').trim();
    if (!username) return;
    if (!force && appState._chatHistoryUser === username) return;

    const history = loadAiChatHistory();
    appState.chatHistory = Array.isArray(history) ? history : [];
    appState._chatHistoryUser = username;

    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';
    appState._restoringChat = true;
    appState.chatHistory.forEach((item) => {
        if (!item) return;
        addMessageToChat(String(item.message || ''), String(item.sender || 'ai'), String(item.time || ''));
    });
    appState._restoringChat = false;
}

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
        appState.chatHistory = [];
        appState._chatHistoryUser = '';
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
            localStorage.setItem('user', JSON.stringify({ username: response.data.username, email: response.data.email }));
            // 更新UI
            document.getElementById('user-name').textContent = response.data.username;
            document.getElementById('profile-name').textContent = response.data.username;
            document.getElementById('profile-level').textContent = `${response.data.learningGoal} · ${response.data.level}`;
            document.getElementById('profile-points').textContent = response.data.points.toLocaleString();
            document.getElementById('profile-days').textContent = response.data.learningDays;
            document.getElementById('profile-badges').textContent = response.data.badges;
            document.getElementById('stat-points').textContent = response.data.points.toLocaleString();
            restoreAiChatHistory();
            renderQuickAccessView();
            renderSidebarQuickAccess();
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
            appState.dashboardLearningPath = data.learningPath;

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
        const response = await apiRequest('/api/resource/list?limit=200');
        if (response.code === 200) {
            appState.resources = response.data.items;
            renderResources(appState.resources);
            renderResourceCategoryFilters(appState.resources);
            renderQuickAccessView();
            renderSidebarQuickAccess();
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
        const [pathsResponse, groupsResponse] = await Promise.all([
            apiRequest('/api/path/list'),
            apiRequest('/api/path/groups')
        ]);
        
        if (pathsResponse.code === 200) {
            appState.learningPaths = pathsResponse.data.items;
        }
        
        if (groupsResponse.code === 200) {
            appState.learningPathGroups = groupsResponse.data;
            // 如果当前选中的组不存在或为"全部"，则选择第一个分组
            if (!appState.learningPathGroups.includes(appState.selectedGroup) || appState.selectedGroup === '全部') {
                appState.selectedGroup = appState.learningPathGroups.length > 0 ? appState.learningPathGroups[0] : '默认分组';
            }
        }
        
        renderLearningPathGroups();
        renderLearningPaths(appState.learningPaths);
    } catch (error) {
        console.error('加载学习路径失败:', error);
    }
}

async function loadLearningPathGroups() {
    try {
        const response = await apiRequest('/api/path/groups');
        if (response.code === 200) {
            appState.learningPathGroups = response.data;
            renderLearningPathGroups();
        }
    } catch (error) {
        console.error('加载学习路径分组失败:', error);
    }
}

// ==================== 渲染函数 ====================

function renderLearningPathGroups() {
    const container = document.getElementById('path-groups-container');
    if (!container) return;
    
    const groups = appState.learningPathGroups.length > 0 ? appState.learningPathGroups : ['默认分组'];
    
    container.innerHTML = groups.map(group => {
        const isSelected = appState.selectedGroup === group || (appState.selectedGroup === '全部' && group === groups[0]);
        const isDefault = group === '默认分组';
        return `
            <div class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                isSelected 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
            }">
                <button onclick="selectGroup('${escapeHtml(group)}')" class="flex-1 text-left">
                    ${escapeHtml(group)}
                </button>
                ${!isDefault ? `
                    <button onclick="deleteGroup('${escapeHtml(group)}')" class="p-1 rounded-full hover:bg-red-100 transition-colors" title="删除分组">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function selectGroup(groupName) {
    appState.selectedGroup = groupName;
    renderLearningPathGroups();
    renderLearningPaths(appState.learningPaths);
}

async function deleteGroup(groupName) {
    if (!confirm(`确定要删除分组“${groupName}”吗？该分组下的所有学习路径将移至“默认分组”。`)) {
        return;
    }
    
    try {
        const response = await apiRequest(`/api/path/groups/${encodeURIComponent(groupName)}`, {
            method: 'DELETE'
        });
        
        if (response.code === 200) {
            // 如果删除的是当前选中的分组，切换到默认分组
            if (appState.selectedGroup === groupName) {
                appState.selectedGroup = '默认分组';
            }
            await loadLearningPaths();
        }
    } catch (error) {
        console.error('删除分组失败:', error);
        alert('删除分组失败，请重试');
    }
}

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

const RESOURCE_COVER_PALETTES = [
    { bgStart: '#eef2ff', bgEnd: '#dbeafe', accent: '#4f46e5', accentSoft: '#818cf8', accentMute: '#c7d2fe', ink: '#1e1b4b' },
    { bgStart: '#ecfeff', bgEnd: '#cffafe', accent: '#0891b2', accentSoft: '#22d3ee', accentMute: '#a5f3fc', ink: '#164e63' },
    { bgStart: '#eff6ff', bgEnd: '#dbeafe', accent: '#2563eb', accentSoft: '#60a5fa', accentMute: '#bfdbfe', ink: '#1e3a8a' },
    { bgStart: '#f0fdf4', bgEnd: '#dcfce7', accent: '#16a34a', accentSoft: '#4ade80', accentMute: '#bbf7d0', ink: '#14532d' },
    { bgStart: '#fff7ed', bgEnd: '#ffedd5', accent: '#ea580c', accentSoft: '#fb923c', accentMute: '#fed7aa', ink: '#7c2d12' },
    { bgStart: '#fdf2f8', bgEnd: '#fce7f3', accent: '#db2777', accentSoft: '#f472b6', accentMute: '#fbcfe8', ink: '#831843' },
    { bgStart: '#faf5ff', bgEnd: '#ede9fe', accent: '#7c3aed', accentSoft: '#a78bfa', accentMute: '#ddd6fe', ink: '#4c1d95' },
    { bgStart: '#f0fdfa', bgEnd: '#ccfbf1', accent: '#0f766e', accentSoft: '#2dd4bf', accentMute: '#99f6e4', ink: '#134e4a' }
];

function hashString(value = '') {
    let hash = 0;
    const text = String(value);
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function escapeSvgText(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function trimCoverLabel(text, max = 8) {
    const value = String(text || '').trim();
    if (!value) return '学习资源';
    return value.length > max ? value.slice(0, max) : value;
}

function buildResourceMonogram(title = '') {
    const normalized = String(title).trim();
    const chinese = normalized.replace(/[^\u4e00-\u9fa5]/g, '');
    if (chinese.length >= 2) return chinese.slice(0, 2);
    if (chinese.length === 1) return chinese;

    const words = normalized.match(/[A-Za-z0-9]+/g) || [];
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

    const compact = normalized.replace(/\s+/g, '');
    return compact ? compact.slice(0, 2).toUpperCase() : 'IT';
}

function getResourceCoverTheme(resource = {}) {
    const text = `${resource.category || ''} ${resource.title || ''}`.toLowerCase();
    if (/linux|bash|shell|powershell|terminal|cmd|命令|操作系统|系统管理/.test(text)) return 'terminal';
    if (/html|css|javascript|typescript|react|vue|前端|web|浏览器/.test(text)) return 'frontend';
    if (/node|express|java|spring|go|python|后端|接口|api|服务端|全栈/.test(text)) return 'backend';
    if (/mysql|sql|redis|mongo|postgres|数据库|数据仓库/.test(text)) return 'database';
    if (/http|tcp|udp|socket|network|网络|协议/.test(text)) return 'network';
    if (/安全|加密|auth|jwt|oauth|csrf|xss|shield/.test(text)) return 'security';
    if (/docker|kubernetes|nginx|运维|部署|ci\/cd|云原生|server/.test(text)) return 'deploy';
    if (/ai|llm|deepseek|机器学习|深度学习|神经网络|prompt/.test(text)) return 'ai';
    if (/figma|设计|ui|ux|原型|产品/.test(text)) return 'design';
    if (/test|jest|cypress|playwright|测试|调试|debug/.test(text)) return 'testing';
    if (/算法|数据结构|leetcode|图论|排序|搜索|动态规划/.test(text)) return 'algorithm';
    return 'stack';
}

function buildResourceCoverMotif(theme, palette, seed) {
    const shiftX = (seed % 12) - 6;
    const shiftY = ((seed >> 3) % 10) - 5;

    switch (theme) {
    case 'terminal':
        return `
            <g transform="translate(${88 + shiftX} ${42 + shiftY})">
                <rect x="0" y="0" width="110" height="76" rx="20" fill="rgba(255,255,255,0.82)"/>
                <rect x="0" y="0" width="110" height="18" rx="20" fill="rgba(255,255,255,0.58)"/>
                <circle cx="16" cy="9" r="3.5" fill="${palette.accentMute}"/>
                <circle cx="28" cy="9" r="3.5" fill="${palette.accentSoft}"/>
                <circle cx="40" cy="9" r="3.5" fill="${palette.accent}"/>
                <path d="M22 34L38 48L22 62" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M48 62H82" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round"/>
                <rect x="20" y="82" width="46" height="10" rx="5" fill="${palette.accentMute}" opacity="0.9"/>
            </g>
        `;
    case 'frontend':
        return `
            <g transform="translate(${84 + shiftX} ${40 + shiftY})">
                <rect x="0" y="0" width="116" height="82" rx="22" fill="rgba(255,255,255,0.84)"/>
                <rect x="0" y="0" width="116" height="18" rx="22" fill="rgba(255,255,255,0.62)"/>
                <circle cx="18" cy="9" r="3.5" fill="${palette.accentMute}"/>
                <circle cx="30" cy="9" r="3.5" fill="${palette.accentSoft}"/>
                <path d="M28 48L44 34" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <path d="M28 48L44 62" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <path d="M88 48L72 34" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <path d="M88 48L72 62" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <path d="M54 68L64 28" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round"/>
                <rect x="28" y="86" width="60" height="10" rx="5" fill="${palette.accentMute}" opacity="0.85"/>
            </g>
        `;
    case 'backend':
        return `
            <g transform="translate(${88 + shiftX} ${38 + shiftY})">
                <rect x="8" y="18" width="90" height="28" rx="14" fill="rgba(255,255,255,0.82)"/>
                <rect x="20" y="56" width="90" height="28" rx="14" fill="rgba(255,255,255,0.74)"/>
                <path d="M53 46V56M53 84V96" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <circle cx="53" cy="107" r="11" fill="${palette.accent}"/>
                <circle cx="118" cy="35" r="10" fill="${palette.accentSoft}" opacity="0.95"/>
                <circle cx="120" cy="70" r="10" fill="${palette.ink}" opacity="0.85"/>
                <path d="M63 35H104M75 70H110" stroke="${palette.ink}" stroke-width="7" stroke-linecap="round"/>
            </g>
        `;
    case 'database':
        return `
            <g transform="translate(${92 + shiftX} ${36 + shiftY})">
                <ellipse cx="52" cy="22" rx="42" ry="14" fill="rgba(255,255,255,0.9)"/>
                <path d="M10 22V50C10 58 29 64 52 64C75 64 94 58 94 50V22" fill="rgba(255,255,255,0.76)"/>
                <ellipse cx="52" cy="50" rx="42" ry="14" fill="rgba(255,255,255,0.9)"/>
                <path d="M10 50V80C10 88 29 94 52 94C75 94 94 88 94 80V50" fill="rgba(255,255,255,0.68)"/>
                <ellipse cx="52" cy="80" rx="42" ry="14" fill="rgba(255,255,255,0.88)"/>
                <path d="M104 30H128M108 54H132M114 78H138" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
            </g>
        `;
    case 'network':
        return `
            <g transform="translate(${86 + shiftX} ${38 + shiftY})">
                <circle cx="24" cy="28" r="16" fill="rgba(255,255,255,0.86)"/>
                <circle cx="92" cy="20" r="14" fill="rgba(255,255,255,0.78)"/>
                <circle cx="62" cy="72" r="18" fill="rgba(255,255,255,0.84)"/>
                <circle cx="124" cy="64" r="13" fill="rgba(255,255,255,0.74)"/>
                <path d="M38 28H78M33 40L53 58M76 32L67 56M79 68H111" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <circle cx="24" cy="28" r="6" fill="${palette.accent}"/>
                <circle cx="92" cy="20" r="5" fill="${palette.ink}"/>
                <circle cx="62" cy="72" r="6" fill="${palette.accentSoft}"/>
                <circle cx="124" cy="64" r="5" fill="${palette.ink}"/>
            </g>
        `;
    case 'security':
        return `
            <g transform="translate(${90 + shiftX} ${34 + shiftY})">
                <path d="M56 10L98 26V58C98 80 81 96 56 108C31 96 14 80 14 58V26L56 10Z" fill="rgba(255,255,255,0.86)"/>
                <path d="M39 58L50 69L74 43" stroke="${palette.accent}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="102" y="26" width="28" height="20" rx="10" fill="${palette.accentSoft}" opacity="0.95"/>
                <rect x="108" y="14" width="16" height="16" rx="8" stroke="${palette.ink}" stroke-width="6" fill="none"/>
            </g>
        `;
    case 'deploy':
        return `
            <g transform="translate(${86 + shiftX} ${42 + shiftY})">
                <path d="M34 72H104C118 72 126 65 126 54C126 43 118 36 108 36C104 22 92 14 78 14C62 14 48 24 44 40C30 40 20 50 20 62C20 69 26 72 34 72Z" fill="rgba(255,255,255,0.84)"/>
                <path d="M73 84V44" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <path d="M57 58L73 42L89 58" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="42" y="90" width="62" height="10" rx="5" fill="${palette.ink}" opacity="0.18"/>
            </g>
        `;
    case 'ai':
        return `
            <g transform="translate(${88 + shiftX} ${36 + shiftY})">
                <circle cx="56" cy="50" r="26" fill="rgba(255,255,255,0.84)"/>
                <circle cx="24" cy="36" r="9" fill="${palette.accentSoft}"/>
                <circle cx="92" cy="28" r="9" fill="${palette.accentMute}"/>
                <circle cx="98" cy="74" r="9" fill="${palette.accent}"/>
                <circle cx="20" cy="74" r="9" fill="${palette.ink}" opacity="0.82"/>
                <path d="M32 39L45 44M84 33L69 41M88 71L72 62M29 71L42 60" stroke="${palette.accent}" stroke-width="7" stroke-linecap="round"/>
                <circle cx="56" cy="50" r="9" fill="${palette.accent}"/>
                <circle cx="56" cy="50" r="24" stroke="${palette.ink}" stroke-width="6" opacity="0.22"/>
            </g>
        `;
    case 'design':
        return `
            <g transform="translate(${88 + shiftX} ${38 + shiftY})">
                <rect x="16" y="18" width="36" height="54" rx="16" fill="rgba(255,255,255,0.88)"/>
                <rect x="52" y="18" width="36" height="54" rx="16" fill="rgba(255,255,255,0.76)"/>
                <rect x="88" y="18" width="36" height="54" rx="16" fill="rgba(255,255,255,0.64)"/>
                <path d="M30 90L94 26" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round"/>
                <circle cx="24" cy="22" r="8" fill="${palette.accentSoft}"/>
                <circle cx="60" cy="22" r="8" fill="${palette.accentMute}"/>
                <circle cx="96" cy="22" r="8" fill="${palette.accent}"/>
            </g>
        `;
    case 'testing':
        return `
            <g transform="translate(${88 + shiftX} ${36 + shiftY})">
                <rect x="12" y="16" width="74" height="94" rx="18" fill="rgba(255,255,255,0.84)"/>
                <path d="M28 42L36 50L50 34" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M28 66L36 74L50 58" stroke="${palette.accentSoft}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M58 42H74M58 66H74" stroke="${palette.ink}" stroke-width="7" stroke-linecap="round"/>
                <circle cx="108" cy="78" r="18" fill="none" stroke="${palette.ink}" stroke-width="8"/>
                <path d="M120 90L136 106" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
            </g>
        `;
    case 'algorithm':
        return `
            <g transform="translate(${86 + shiftX} ${36 + shiftY})">
                <circle cx="24" cy="24" r="12" fill="rgba(255,255,255,0.88)"/>
                <circle cx="74" cy="24" r="12" fill="rgba(255,255,255,0.8)"/>
                <circle cx="124" cy="24" r="12" fill="rgba(255,255,255,0.72)"/>
                <circle cx="50" cy="76" r="13" fill="rgba(255,255,255,0.84)"/>
                <circle cx="100" cy="76" r="13" fill="rgba(255,255,255,0.76)"/>
                <path d="M36 24H62M86 24H112M32 34L43 63M116 34L106 63M63 76H87" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
                <circle cx="50" cy="76" r="5" fill="${palette.accent}"/>
                <circle cx="100" cy="76" r="5" fill="${palette.ink}"/>
            </g>
        `;
    default:
        return `
            <g transform="translate(${88 + shiftX} ${38 + shiftY})">
                <rect x="18" y="16" width="44" height="62" rx="16" fill="rgba(255,255,255,0.86)"/>
                <rect x="52" y="28" width="44" height="62" rx="16" fill="rgba(255,255,255,0.74)"/>
                <rect x="86" y="12" width="44" height="62" rx="16" fill="rgba(255,255,255,0.62)"/>
                <path d="M34 94H110" stroke="${palette.accent}" stroke-width="9" stroke-linecap="round"/>
                <circle cx="120" cy="90" r="10" fill="${palette.accentSoft}"/>
            </g>
        `;
    }
}

function buildResourceCoverSvg(resource = {}) {
    const seed = hashString(`${resource.id || ''}-${resource.title || ''}-${resource.category || ''}`);
    const palette = RESOURCE_COVER_PALETTES[seed % RESOURCE_COVER_PALETTES.length];
    const theme = getResourceCoverTheme(resource);
    const monogram = buildResourceMonogram(resource.title);
    const categoryLabel = trimCoverLabel(resource.category, 6);
    const badgeWidth = Math.max(56, categoryLabel.length * 16 + 18);
    const orbitX = 238 + (seed % 18);
    const orbitY = 36 + ((seed >> 2) % 18);
    const ringSize = 84 + (seed % 26);
    const barGroup = Array.from({ length: 4 }).map((_, index) => {
        const width = 20 + ((seed >> (index * 2)) % 26);
        const x = 88 + ((seed >> (index + 1)) % 130);
        const y = 22 + index * 18 + ((seed >> (index + 2)) % 7);
        const opacity = 0.10 + (((seed >> (index + 3)) % 4) * 0.05);
        return `<rect x="${x}" y="${y}" width="${width}" height="6" rx="3" fill="${palette.accent}" opacity="${opacity.toFixed(2)}"/>`;
    }).join('');

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" fill="none">
            <defs>
                <linearGradient id="coverGradient${seed}" x1="24" y1="12" x2="296" y2="168" gradientUnits="userSpaceOnUse">
                    <stop stop-color="${palette.bgStart}"/>
                    <stop offset="1" stop-color="${palette.bgEnd}"/>
                </linearGradient>
                <linearGradient id="glowGradient${seed}" x1="72" y1="34" x2="248" y2="146" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#ffffff" stop-opacity="0.75"/>
                    <stop offset="1" stop-color="#ffffff" stop-opacity="0.18"/>
                </linearGradient>
            </defs>
            <rect width="320" height="180" rx="24" fill="url(#coverGradient${seed})"/>
            <rect x="14" y="14" width="292" height="152" rx="20" fill="url(#glowGradient${seed})" opacity="0.7"/>
            <circle cx="${orbitX}" cy="${orbitY}" r="${ringSize / 2}" fill="${palette.accentMute}" opacity="0.28"/>
            <circle cx="${orbitX - 42}" cy="${orbitY + 62}" r="${Math.round(ringSize / 3)}" fill="#ffffff" opacity="0.34"/>
            <path d="M76 138C118 118 142 116 194 126C220 131 245 134 270 126" stroke="${palette.ink}" stroke-opacity="0.10" stroke-width="10" stroke-linecap="round"/>
            ${barGroup}
            ${buildResourceCoverMotif(theme, palette, seed)}
            <g transform="translate(214 28)">
                <rect x="0" y="0" width="54" height="54" rx="18" fill="rgba(255,255,255,0.82)"/>
                <rect x="0.75" y="0.75" width="52.5" height="52.5" rx="17.25" stroke="${palette.accent}" stroke-opacity="0.12" stroke-width="1.5"/>
                <text x="27" y="33" text-anchor="middle" font-size="22" font-weight="700" fill="${palette.ink}" font-family="Inter, Arial, sans-serif">${escapeSvgText(monogram)}</text>
            </g>
            <g transform="translate(84 132)">
                <rect x="0" y="0" width="${badgeWidth}" height="28" rx="14" fill="rgba(255,255,255,0.82)"/>
                <text x="${badgeWidth / 2}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="${palette.ink}" font-family="Inter, Arial, sans-serif">${escapeSvgText(categoryLabel)}</text>
            </g>
        </svg>
    `;
}

function buildResourceCoverMarkup(resource, className = 'w-full h-full object-cover') {
    const svg = buildResourceCoverSvg(resource);
    const src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    const alt = escapeHtml(`${resource.title || '资源'}封面`);
    return `<img src="${src}" alt="${alt}" class="${className}" />`;
}

function renderResources(resources) {
    const grid = document.getElementById('resource-grid');
    const libraryGrid = document.getElementById('library-resource-grid');
    const renderCards = (items) => items.map(res => `
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group cursor-pointer" onclick="openResourceDetail(${res.id})">
            <div class="aspect-video bg-white flex items-center justify-center relative overflow-hidden">
                ${buildResourceCoverMarkup(res)}
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
            </div>
            <div class="p-4">
                <h4 class="font-bold text-gray-800 mb-1 truncate">${escapeHtml(res.title || '')}</h4>
                <p class="text-xs text-gray-500 mb-3 line-clamp-2">${escapeHtml(res.desc || '')}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xs px-2 py-0.5 bg-${res.color}-50 text-${res.color}-600 rounded">${escapeHtml(res.category || '')}</span>
                    <span class="text-xs text-gray-400">${escapeHtml(res.students || '')} 人学习</span>
                </div>
            </div>
        </div>
    `).join('');
    const previewResources = resources.slice(0, 8);

    if (grid) grid.innerHTML = renderCards(previewResources);
    if (libraryGrid) libraryGrid.innerHTML = renderCards(resources);
    lucide.createIcons();
}

async function openResourceDetail(id) {
    try {
        const response = await apiRequest(`/api/resource/${id}`);
        if (response.code !== 200) return;

        const data = response.data;
        recordRecentResource(data.id);
        const overlay = document.getElementById('resource-modal-overlay');
        if (!overlay) return;

        const cover = document.getElementById('resource-modal-cover');
        if (cover) {
            cover.innerHTML = buildResourceCoverMarkup(data, 'w-full h-full object-cover rounded-xl');
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
window.openPathModal = openPathModal;
window.closePathModal = closePathModal;
window.savePath = savePath;
window.editPath = editPath;
window.deletePath = deletePath;
window.selectLearningPath = selectLearningPath;
window.updateLearningPathProgress = updateLearningPathProgress;
window.toggleLearningPathItem = toggleLearningPathItem;
window.selectGroup = selectGroup;
window.deleteGroup = deleteGroup;
window.addNewGroup = addNewGroup;

const RECENT_RESOURCE_IDS_KEY = 'recent_resource_ids';

function parseNumberLabel(label) {
    const text = String(label || '').trim().toLowerCase();
    if (!text) return 0;
    const value = parseFloat(text);
    if (Number.isNaN(value)) return 0;
    if (text.endsWith('k')) return Math.round(value * 1000);
    if (text.endsWith('w')) return Math.round(value * 10000);
    return Math.round(value);
}

function getRecentResourceIds() {
    try {
        const raw = localStorage.getItem(RECENT_RESOURCE_IDS_KEY);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
    } catch {
        return [];
    }
}

function setRecentResourceIds(ids) {
    const next = Array.isArray(ids) ? ids.slice(0, 10) : [];
    localStorage.setItem(RECENT_RESOURCE_IDS_KEY, JSON.stringify(next));
}

function recordRecentResource(resourceId) {
    const id = Number(resourceId);
    if (!Number.isFinite(id)) return;
    const existing = getRecentResourceIds().filter((x) => x !== id);
    setRecentResourceIds([id, ...existing]);
    renderQuickAccessView();
    renderSidebarQuickAccess();
}

function openResourceUrl(url) {
    const target = String(url || '').trim();
    if (!target) return;
    window.open(target, '_blank', 'noopener');
}

window.openResourceUrl = openResourceUrl;

function getResourceFromCache(id) {
    const targetId = Number(id);
    if (!Number.isFinite(targetId)) return null;
    return (appState.resources || []).find((res) => Number(res.id) === targetId) || null;
}

async function openQuickAccessResource(resourceId) {
    await openResourceDetail(resourceId);
}

async function openQuickAccessTag(tag) {
    await ensureResourcesLoaded();
    const best = findBestResourceByKeyword(tag);
    if (best?.id) {
        await openResourceDetail(best.id);
        return;
    }
    switchView('resource-library');
}

function renderQuickAccessView() {
    const recentContainer = document.getElementById('quick-access-recent-list');
    const tagsContainer = document.getElementById('quick-access-tags');
    if (!recentContainer && !tagsContainer) return;

    const recentIds = getRecentResourceIds();
    const recentResources = recentIds.map((id) => getResourceFromCache(id)).filter(Boolean);
    const fallbackResources = [...(appState.resources || [])]
        .sort((a, b) => parseNumberLabel(b.students) - parseNumberLabel(a.students))
        .slice(0, 5);
    const items = (recentResources.length ? recentResources : fallbackResources).slice(0, 5);

    if (recentContainer) {
        if (!items.length) {
            recentContainer.innerHTML = `<div class="p-4 text-sm text-gray-500">暂无最近学习内容</div>`;
        } else {
            recentContainer.innerHTML = items.map((res) => `
                <div class="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors" onclick="openQuickAccessResource(${res.id})">
                    <div class="w-10 h-10 bg-white rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                        ${buildResourceCoverMarkup(res, 'w-full h-full object-cover')}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate">${escapeHtml(res.title || '')}</p>
                        <p class="text-[10px] text-gray-400 truncate">${escapeHtml(res.category || '')}${res.provider ? ` · ${escapeHtml(res.provider)}` : ''}</p>
                    </div>
                    <div class="flex items-center gap-3 flex-shrink-0">
                        ${res.url ? `<a href="${escapeHtml(res.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-xs font-semibold text-blue-600 hover:text-blue-700">继续学习</a>` : ''}
                        <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300"></i>
                    </div>
                </div>
            `).join('');
        }
    }

    if (tagsContainer) {
        const interests = Array.isArray(appState.user?.interests) ? appState.user.interests : [];
        const tags = interests.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8);
        if (!tags.length) {
            tagsContainer.innerHTML = `<div class="text-sm text-gray-500">暂无关注标签</div>`;
        } else {
            const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-emerald-500'];
            tagsContainer.innerHTML = tags.map((tag, idx) => `
                <div class="px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-3 hover:border-blue-500 hover:text-blue-600 cursor-pointer transition-all" onclick="openQuickAccessTag(${JSON.stringify(tag)})">
                    <span class="w-2 h-2 rounded-full ${colors[idx % colors.length]}"></span>
                    <span class="text-sm font-medium">#${escapeHtml(tag)}</span>
                </div>
            `).join('');
        }
    }

    lucide.createIcons();
}

function renderSidebarQuickAccess() {
    const recentWrap = document.getElementById('sidebar-recent-learning');
    const tagsWrap = document.getElementById('sidebar-hot-tags');
    if (!recentWrap && !tagsWrap) return;

    const recentIds = getRecentResourceIds();
    const recentResources = recentIds.map((id) => getResourceFromCache(id)).filter(Boolean).slice(0, 2);
    const fallbackResources = (appState.resources || []).slice(0, 2);
    const items = (recentResources.length ? recentResources : fallbackResources).slice(0, 2);

    if (recentWrap) {
        if (!items.length) {
            recentWrap.innerHTML = `<div class="text-xs text-gray-400">暂无</div>`;
        } else {
            const dots = ['bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400'];
            recentWrap.innerHTML = items.map((res, idx) => `
                <div class="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 cursor-pointer" onclick="openQuickAccessResource(${res.id})">
                    <div class="w-1.5 h-1.5 rounded-full ${dots[idx % dots.length]}"></div>
                    <span class="truncate">${escapeHtml(res.title || '')}</span>
                </div>
            `).join('');
        }
    }

    if (tagsWrap) {
        const interests = Array.isArray(appState.user?.interests) ? appState.user.interests : [];
        const tags = interests.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3);
        if (!tags.length) {
            tagsWrap.innerHTML = '';
        } else {
            tagsWrap.innerHTML = tags.map((tag) => `
                <span class="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors" onclick="openQuickAccessTag(${JSON.stringify(tag)})">#${escapeHtml(tag)}</span>
            `).join('');
        }
    }
}

window.openQuickAccessResource = openQuickAccessResource;
window.openQuickAccessTag = openQuickAccessTag;

function renderRecommendations(data) {
    const grid = document.getElementById('recommendation-grid');
    const guessGrid = document.getElementById('guess-you-like-grid');

    if (grid && data.recommendations) {
        grid.innerHTML = data.recommendations.map(rec => `
            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex gap-6 cursor-pointer hover:shadow-md transition-shadow" onclick="openResourceDetail(${rec.id})">
                <div class="w-32 h-32 bg-white rounded-xl flex-shrink-0 overflow-hidden border border-gray-100">
                    ${buildResourceCoverMarkup(rec, 'w-full h-full object-cover')}
                </div>
                <div class="flex-1">
                    <span class="text-xs font-semibold text-${rec.color}-600 bg-${rec.color}-50 px-2 py-1 rounded">${escapeHtml(rec.reason || rec.category || '为你推荐')}</span>
                    <h3 class="text-lg font-bold mt-2 mb-1">${escapeHtml(rec.title || '')}</h3>
                    <p class="text-sm text-gray-500 mb-4 line-clamp-2">${escapeHtml(rec.desc || '')}</p>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 text-xs text-gray-400">
                            <i data-lucide="users" class="w-4 h-4"></i>
                            <span>${escapeHtml(rec.students || '')} 人已学</span>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-xs text-gray-400">${escapeHtml(rec.provider || rec.category || '')}</span>
                            <a href="${escapeHtml(rec.url || '#')}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-sm font-bold text-blue-600 hover:text-blue-700">${escapeHtml(rec.buttonText || '立即学习')}</a>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    if (guessGrid && data.guessYouLike) {
        guessGrid.innerHTML = data.guessYouLike.map(item => `
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center group cursor-pointer hover:shadow-md transition-shadow" onclick="openResourceDetail(${item.id})">
                <div class="w-14 h-14 rounded-full overflow-hidden mx-auto mb-3 border border-gray-100">
                    ${buildResourceCoverMarkup(item, 'w-full h-full object-cover')}
                </div>
                <p class="text-sm font-semibold line-clamp-2 min-h-[40px]">${escapeHtml(item.title || '')}</p>
                <a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="mt-2 inline-block text-xs font-medium text-blue-600 hover:text-blue-700">${escapeHtml(item.buttonText || '查看资源')}</a>
            </div>
        `).join('');
    }

    lucide.createIcons();
}

function renderLearningPaths(paths) {
    const container = document.getElementById('learning-paths-container');
    if (!container) return;
    
    const filteredPaths = paths.filter(path => path.group_name === appState.selectedGroup);
    
    if (filteredPaths.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="folder-open" class="w-16 h-16 mx-auto text-gray-300 mb-4"></i>
                <p class="text-gray-500">该分组下暂无学习路径</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = paths.map((path, index) => {
        const items = Array.isArray(path.items)
            ? path.items
            : (typeof path.items === 'string' ? (() => { try { return JSON.parse(path.items || '[]') || []; } catch { return []; } })() : []);
        const isCompleted = path.status === 'completed';
        const isInProgress = path.status === 'in_progress';
        const { total, progressValue, completedCount, activeIndex } = computePathStep(items, path);
        const statusClass = isCompleted ? 'bg-green-50 text-green-600' : (isInProgress ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400');
        const statusText = isCompleted ? '已完成' : (isInProgress ? `进行中 ${progressValue}%` : '未开始');
        const dotClass = isCompleted ? 'bg-blue-600' : (isInProgress ? 'bg-blue-600' : 'bg-gray-200');
        const borderClass = isInProgress ? 'border-l-4 border-l-blue-600' : '';
        
        // 计算已完成项目数
        const items = path.items || [];
        const completedCount = items.filter(item => item && item.completed).length;
        const totalCount = items.length;

        return `
            <div class="relative pl-20">
                <div class="absolute left-6 top-0 w-4 h-4 ${dotClass} rounded-full border-4 border-white ring-4 ${isCompleted || isInProgress ? 'ring-blue-100' : ''}"></div>
                <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${borderClass} cursor-pointer hover:shadow-md transition-shadow" onclick="openLearningPathDetail(${path.id})">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">阶段 0${path.stage}</span>
                            <h3 class="text-xl font-bold mt-1 ${!isCompleted && !isInProgress ? 'text-gray-400' : ''}">${escapeHtml(path.title || '')}</h3>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 ${statusClass} text-xs font-bold rounded-full">${statusText}</span>
                            <div class="flex gap-1">
                                <button onclick="event.stopPropagation(); editPath(${path.id})" class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="编辑">
                                    <i data-lucide="edit-2" class="w-4 h-4 text-gray-500"></i>
                                </button>
                                <button onclick="event.stopPropagation(); deletePath(${path.id})" class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="删除">
                                    <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    ${items.length ? `
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        ${items.map((item, i) => {
                            const isDone = i < completedCount;
                            const isActive = isInProgress && i === activeIndex && !isDone;
                            const boxClass = isDone ? 'bg-gray-50' : (isActive ? 'bg-blue-50' : 'bg-white');
                            const iconName = isDone ? 'check-circle' : (isActive ? 'clock' : 'circle');
                            const iconClass = isDone ? 'text-green-500' : (isActive ? 'text-blue-500' : 'text-gray-300');
                            const textClass = isActive ? 'text-blue-700 font-medium' : 'text-gray-600';
                            return `
                            <div class="p-3 ${boxClass} rounded-xl border border-gray-100 flex items-center gap-3 hover:border-gray-200 transition-colors" onclick="event.stopPropagation(); openPathItem(${path.id}, ${i})">
                                <i data-lucide="${iconName}" class="w-5 h-5 ${iconClass}"></i>
                                <span class="text-sm ${textClass}">${escapeHtml(item)}</span>
                            </div>
                            `;
                        }).join('')}
                    </div>
                    ` : ''}
                    <div class="mt-4 flex gap-2">
                        ${isInProgress ? `
                            <button class="flex-1 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold transition-colors" disabled>当前学习中</button>
                            <button onclick="event.stopPropagation(); updateLearningPathProgress(${path.id}, ${Math.min(100, progressValue + 10)})" class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-xl text-sm font-bold transition-colors">+10%</button>
                        ` : isCompleted ? `
                            <button class="flex-1 py-2 bg-gray-100 text-gray-400 rounded-xl text-sm font-bold transition-colors" disabled>已完成</button>
                        ` : isInProgress ? `
                            <button class="flex-1 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold transition-colors" disabled>当前学习中</button>
                        ` : `
                            <button onclick="event.stopPropagation(); selectLearningPath(${path.id})" class="flex-1 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold transition-colors">选择此路径</button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

let currentLearningPathDetail = null;

async function ensureResourcesLoaded() {
    if (Array.isArray(appState.resources) && appState.resources.length > 0) return;
    try {
        const response = await apiRequest('/api/resource/list?limit=200');
        if (response.code === 200) {
            appState.resources = response.data.items || [];
        }
    } catch (error) {
        console.error('加载资源失败:', error);
    }
}

function findBestResourceByKeyword(keyword) {
    const key = String(keyword || '').trim();
    if (!key) return null;
    const normKey = key.toLowerCase();
    let best = null;
    let bestScore = 0;
    (appState.resources || []).forEach((res) => {
        const title = String(res.title || '').toLowerCase();
        const category = String(res.category || '').toLowerCase();
        const desc = String(res.desc || '').toLowerCase();
        let score = 0;
        if (title.includes(normKey)) score += 10;
        if (category.includes(normKey)) score += 6;
        if (desc.includes(normKey)) score += 4;
        if (score > bestScore) {
            bestScore = score;
            best = res;
        }
    });
    return best;
}

const PATH_ITEM_BINDINGS = [
    {
        patterns: ['状态管理实战', 'redux/zustand', 'redux', 'zustand', '状态管理'],
        preferredTitles: ['React 状态管理进阶', 'Pinia 状态管理'],
        keywords: ['redux', 'zustand', '状态管理', 'context', 'store']
    },
    {
        patterns: ['hooks 深度解析', 'hooks', 'react hooks'],
        preferredTitles: ['React Hooks 核心用法'],
        keywords: ['hooks', 'useState', 'useEffect', 'react']
    },
    {
        patterns: ['react 性能优化', '性能优化'],
        preferredTitles: ['Lighthouse 性能优化'],
        keywords: ['性能优化', 'lighthouse', 'performance', '优化']
    },
    {
        patterns: ['next.js 全栈框架', 'next.js', 'nextjs'],
        preferredTitles: ['Next.js 全栈开发入门'],
        keywords: ['next.js', 'nextjs', 'ssr', '全栈']
    },
    {
        patterns: ['html5', '语义化', 'html'],
        preferredTitles: ['HTML 入门到实践'],
        keywords: ['html', 'html5', '语义化']
    },
    {
        patterns: ['css3', '布局', '响应式', 'css'],
        preferredTitles: ['CSS 布局与响应式'],
        keywords: ['css', 'flex', 'grid', '响应式']
    },
    {
        patterns: ['javascript 核心语法', 'js', 'javascript'],
        preferredTitles: ['JavaScript 核心语法与思维'],
        keywords: ['javascript', 'js', '语法', '闭包']
    },
    {
        patterns: ['webpack/vite', 'vite', 'webpack', '工具链'],
        preferredTitles: ['Vite 快速构建项目', 'Webpack 打包原理入门'],
        keywords: ['vite', 'webpack', '构建', '打包']
    },
    {
        patterns: ['express 基础', 'express'],
        preferredTitles: ['Express 官方入门'],
        keywords: ['express', 'node', '路由', '中间件']
    },
    {
        patterns: ['restful', 'api 设计', 'rest'],
        preferredTitles: ['RESTful API 设计清单'],
        keywords: ['rest', 'api', '状态码', '接口']
    },
    {
        patterns: ['数据库操作', 'sql', 'sqlite'],
        preferredTitles: ['SQL 基础（查询/排序/聚合）', 'SQLite 官方文档速查'],
        keywords: ['sql', 'sqlite', '数据库']
    }
];

function normalizeKeyword(text) {
    return String(text || '').trim().toLowerCase();
}

function getBindingForPathItem(itemText) {
    const key = normalizeKeyword(itemText);
    if (!key) return null;
    return PATH_ITEM_BINDINGS.find((binding) => (binding.patterns || []).some((p) => key.includes(normalizeKeyword(p))));
}

function findResourceByTitles(titles = []) {
    const list = Array.isArray(titles) ? titles : [];
    if (!list.length) return null;
    return (appState.resources || []).find((res) => list.includes(String(res.title || '').trim())) || null;
}

function computePathStep(items, path) {
    const total = items.length;
    const isCompleted = path.status === 'completed';
    const isInProgress = path.status === 'in_progress';
    const progressValue = Math.max(0, Math.min(100, Number(path.progress || 0)));

    if (!total) return { total, progressValue, completedCount: 0, activeIndex: 0 };
    if (isCompleted || progressValue >= 100) return { total, progressValue: 100, completedCount: total, activeIndex: -1 };
    if (!isInProgress) return { total, progressValue, completedCount: 0, activeIndex: 0 };

    const activeIndex = Math.max(0, Math.min(total - 1, Math.floor((progressValue / 100) * total) - 1));
    return { total, progressValue, completedCount: activeIndex, activeIndex };
}

async function openPathItem(pathId, itemIndex) {
    const path = (appState.learningPaths || []).find((p) => Number(p.id) === Number(pathId));
    if (!path) return;
    const items = Array.isArray(path.items)
        ? path.items
        : (typeof path.items === 'string' ? (() => { try { return JSON.parse(path.items || '[]') || []; } catch { return []; } })() : []);
    const keyword = items[itemIndex];
    if (!keyword) return;
    await ensureResourcesLoaded();
    const binding = getBindingForPathItem(keyword);
    const exact = binding ? findResourceByTitles(binding.preferredTitles) : null;
    const best = exact || findBestResourceByKeyword(binding?.keywords?.[0] || keyword) || findBestResourceByKeyword(keyword);
    if (best?.id) {
        closeLearningPathDetailModal();
        openResourceDetail(best.id);
        return;
    }
    closeLearningPathDetailModal();
    switchView('resource-library');
}

async function openLearningPathDetail(pathId) {
    const path = (appState.learningPaths || []).find((p) => Number(p.id) === Number(pathId));
    if (!path) return;

    const items = Array.isArray(path.items)
        ? path.items
        : (typeof path.items === 'string' ? (() => { try { return JSON.parse(path.items || '[]') || []; } catch { return []; } })() : []);
    const isCompleted = path.status === 'completed';
    const isInProgress = path.status === 'in_progress';
    const { total, progressValue, completedCount, activeIndex } = computePathStep(items, path);
    const nextIndex = activeIndex < 0 ? -1 : activeIndex;
    const nextItem = total ? (nextIndex < 0 ? '' : (items[nextIndex] || '')) : '';

    currentLearningPathDetail = { id: path.id, nextItem };

    const overlay = document.getElementById('learning-path-detail-overlay');
    if (!overlay) return;

    const stageEl = document.getElementById('learning-path-detail-stage');
    if (stageEl) stageEl.textContent = `阶段 0${path.stage || ''}`;
    const statusEl = document.getElementById('learning-path-detail-status');
    if (statusEl) {
        statusEl.textContent = isCompleted ? '已完成' : (isInProgress ? '学习中' : '未开始');
        statusEl.className = `px-2 py-0.5 rounded-full ${isCompleted ? 'bg-green-50 text-green-700' : (isInProgress ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500')}`;
    }
    const titleEl = document.getElementById('learning-path-detail-title');
    if (titleEl) titleEl.textContent = path.title || '学习路径详情';
    const summaryEl = document.getElementById('learning-path-detail-summary');
    if (summaryEl) summaryEl.textContent = total ? `已完成 ${completedCount}/${total} 课时` : '学习进度';
    const progressEl = document.getElementById('learning-path-detail-progress');
    if (progressEl) progressEl.textContent = String(progressValue);
    const barEl = document.getElementById('learning-path-detail-progress-bar');
    if (barEl) barEl.style.width = `${progressValue}%`;
    const nextEl = document.getElementById('learning-path-detail-next');
    if (nextEl) nextEl.textContent = nextItem ? `下一步建议：${nextItem}` : (total ? '已完成全部学习内容' : '');
    const countEl = document.getElementById('learning-path-detail-count');
    if (countEl) countEl.textContent = total ? `${total} 项` : '';

    const itemsWrap = document.getElementById('learning-path-detail-items');
    const emptyEl = document.getElementById('learning-path-detail-empty');
    if (itemsWrap) {
        if (!items.length) {
            itemsWrap.innerHTML = '';
            if (emptyEl) emptyEl.classList.remove('hidden');
        } else {
            if (emptyEl) emptyEl.classList.add('hidden');
            itemsWrap.innerHTML = items.map((item, i) => {
                const done = i < completedCount;
                const active = isInProgress && i === nextIndex && !done;
                const iconName = done ? 'check-circle' : (active ? 'clock' : 'circle');
                const iconClass = done ? 'text-green-500' : (active ? 'text-blue-500' : 'text-gray-300');
                const boxClass = done ? 'bg-gray-50 border-gray-100' : (active ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100');
                return `
                    <button class="text-left p-4 rounded-2xl border ${boxClass} hover:border-gray-200 transition-colors" onclick="openPathItem(${path.id}, ${i})">
                        <div class="flex items-center gap-3">
                            <i data-lucide="${iconName}" class="w-5 h-5 ${iconClass} flex-shrink-0"></i>
                            <div class="min-w-0">
                                <div class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(item)}</div>
                                <div class="text-xs text-gray-500 mt-1">${done ? '已完成' : (active ? '正在学习' : '待学习')} · 点击查看相关资源</div>
                            </div>
                        </div>
                    </button>
                `;
            }).join('');
        }
    }

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    lucide.createIcons();
}

function closeLearningPathDetailModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const overlay = document.getElementById('learning-path-detail-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
}

function jumpToResourceLibrary() {
    closeLearningPathDetailModal();
    switchView('resource-library');
}

async function continueCurrentPath() {
    const pathId = currentLearningPathDetail?.id;
    closeLearningPathDetailModal();
    if (!pathId) {
        switchView('resource-library');
        return;
    }

    const path = (appState.learningPaths || []).find((p) => Number(p.id) === Number(pathId));
    if (!path) {
        switchView('resource-library');
        return;
    }

    const items = Array.isArray(path.items)
        ? path.items
        : (typeof path.items === 'string' ? (() => { try { return JSON.parse(path.items || '[]') || []; } catch { return []; } })() : []);
    const isCompleted = path.status === 'completed';
    const isInProgress = path.status === 'in_progress';
    const { total, progressValue, completedCount, activeIndex } = computePathStep(items, path);
    const nextIndex = activeIndex < 0 ? 0 : activeIndex;
    await openPathItem(pathId, nextIndex);
}

window.openLearningPathDetail = openLearningPathDetail;
window.closeLearningPathDetailModal = closeLearningPathDetailModal;
window.jumpToResourceLibrary = jumpToResourceLibrary;
window.continueCurrentPath = continueCurrentPath;
window.openPathItem = openPathItem;

async function selectLearningPath(pathId) {
    try {
        const response = await apiRequest(`/api/path/select/${pathId}`, {
            method: 'POST'
        });
        
        if (response.code === 200) {
            await loadLearningPaths();
            await loadDashboard();
            alert('已选择学习路径！');
        }
    } catch (error) {
        console.error('选择学习路径失败:', error);
        alert('选择学习路径失败');
    }
}

async function toggleLearningPathItem(pathId, itemIndex) {
    try {
        const response = await apiRequest(`/api/path/${pathId}/toggle-item/${itemIndex}`, {
            method: 'PUT'
        });
        
        if (response.code === 200) {
            await loadLearningPaths();
            await loadDashboard();
        }
    } catch (error) {
        console.error('更新学习项目失败:', error);
    }
}

async function updateLearningPathProgress(pathId, progress) {
    try {
        const response = await apiRequest(`/api/path/progress/${pathId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                progress: progress,
                status: progress >= 100 ? 'completed' : 'in_progress'
            })
        });
        
        if (response.code === 200) {
            await loadLearningPaths();
            await loadDashboard();
        }
    } catch (error) {
        console.error('更新学习路径失败:', error);
    }
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

    // 重置智能助理图标为默认状态
    const aiIcon = document.getElementById('ai-assistant-icon');
    if (aiIcon) {
        aiIcon.src = '/resource/logo_ai_side_default.png';
    }

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
    } else if (viewId === 'ai-assistant') {
        restoreAiChatHistory();
    } else if (viewId === 'personal-space') {
        loadUserInfo();
        loadDashboard();
    } else if (viewId === 'quick-access') {
        if (!Array.isArray(appState.resources) || appState.resources.length === 0) {
            loadResources();
        } else {
            renderQuickAccessView();
            renderSidebarQuickAccess();
        }
        if (!appState.user) {
            loadUserInfo();
        }
    }

    // Set active nav style
    const targetNav = document.getElementById('nav-' + viewId);
    if (targetNav) {
        targetNav.classList.add('bg-blue-50', 'text-blue-700');
        targetNav.classList.remove('text-gray-500', 'hover:bg-gray-100', 'hover:text-gray-900');
        
        // 如果选中的是智能助理，切换为选中状态图标
        if (viewId === 'ai-assistant' && aiIcon) {
            aiIcon.src = '/resource/logo_ai_side_choose.png';
        }
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

const RESOURCE_FILTER_ACTIVE_CLASS = 'resource-filter px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md shadow-blue-100 whitespace-nowrap flex-shrink-0 min-w-[88px] text-center inline-flex items-center justify-center';
const RESOURCE_FILTER_NORMAL_CLASS = 'resource-filter px-5 py-2 bg-white border border-gray-200 text-gray-600 rounded-full text-sm font-medium hover:border-blue-500 hover:text-blue-600 transition-colors whitespace-nowrap flex-shrink-0 min-w-[88px] text-center inline-flex items-center justify-center';

function filterResources(category) {
    document.querySelectorAll('.resource-filter').forEach((btn) => {
        btn.className = btn.dataset.category === category
            ? RESOURCE_FILTER_ACTIVE_CLASS
            : RESOURCE_FILTER_NORMAL_CLASS;
    });

    // Filter resources
    if (category === 'all') {
        renderResources(appState.resources);
    } else {
        const filtered = appState.resources.filter(r => r.category === category);
        renderResources(filtered);
    }
}

function renderResourceCategoryFilters(resources = []) {
    const bar = document.getElementById('library-filter-bar');
    if (!bar) return;

    const counts = new Map();
    resources.forEach((res) => {
        const category = String(res?.category || '').trim();
        if (!category) return;
        counts.set(category, (counts.get(category) || 0) + 1);
    });

    const categories = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh-Hans-CN'))
        .map((entry) => entry[0])
        .slice(0, 9);

    const createBtn = (category, label, active = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = active ? RESOURCE_FILTER_ACTIVE_CLASS : RESOURCE_FILTER_NORMAL_CLASS;
        btn.dataset.category = category;
        btn.textContent = label;
        btn.addEventListener('click', () => filterResources(category));
        return btn;
    };

    bar.innerHTML = '';
    bar.appendChild(createBtn('all', '全部', true));
    categories.forEach((category) => {
        bar.appendChild(createBtn(category, category, false));
    });
}

// ==================== AI 聊天 ====================

function buildPracticeQuestionsPrompt() {
    const nextTopic = String(appState.dashboardLearningPath?.nextStep?.title || '').trim();
    const recentId = getRecentResourceIds?.()?.[0];
    const recentRes = recentId ? getResourceFromCache(recentId) : null;
    const topic = nextTopic || String(recentRes?.title || '').trim() || '当前学习主题';
    return `请围绕「${topic}」生成练习题（必须与编程/软件学习相关）。只输出题目，不要输出答案和解析，也不要出现“正确答案/答案/解析”等字样。\n\n输出格式：\n1. 选择题（5题）：每题含 A/B/C/D 四个选项\n2. 简答题（3题）：只出题，不给参考要点\n3. 代码题（2题）：只出题，写清输入输出/要求即可\n\n我回复“公布答案”后，你再针对这些题给答案与解析（那时再给）。`;
}

function buildPracticeAnswersPrompt() {
    const quiz = String(appState.lastPracticeQuiz || '').trim();
    if (!quiz) return '';
    return `请为以下练习题给出标准答案与简短解析。要求：按题号逐条给出；选择题给出正确选项；简答题给要点；代码题给参考实现与关键解释。只输出答案与解析。\n\n练习题如下：\n${quiz}`;
}

function sendQuickMessage(message) {
    const raw = String(message || '').trim();
    const input = document.getElementById('chat-input');
    const finalMessage = (raw === '生成练习题' || raw === '练习题生成' || raw === '生成练习')
        ? (() => { appState._practiceMode = 'generate'; appState.lastPracticeQuiz = ''; return buildPracticeQuestionsPrompt(); })()
        : raw;
    input.value = finalMessage;
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const original = input.value.trim();

    if (!original) return;

    const isGenerate = (original === '生成练习题' || original === '练习题生成' || original === '生成练习');
    const isAnswer = (original === '公布答案' || original === '查看答案' || original === '答案解析');
    let message = original;
    if (isGenerate) {
        appState._practiceMode = 'generate';
        appState.lastPracticeQuiz = '';
        message = buildPracticeQuestionsPrompt();
    } else if (isAnswer) {
        const answerPrompt = buildPracticeAnswersPrompt();
        if (answerPrompt) {
            appState._practiceMode = 'answer';
            message = answerPrompt;
        }
    }

    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';

    // Show loading
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';

    try {
        const response = await apiRequest('/api/ai-assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ message })
        });

        if (response.code === 200) {
            // Simulate typing delay
            setTimeout(() => {
                if (appState._practiceMode === 'generate') {
                    appState.lastPracticeQuiz = String(response.data.answer || '').trim();
                }
                appState._practiceMode = '';
                addMessageToChat(response.data.answer, 'ai');
            }, 500);
        }
    } catch (error) {
        appState._practiceMode = '';
        addMessageToChat('抱歉，我暂时无法回答。请稍后再试。', 'ai');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i data-lucide="send" class="w-5 h-5"></i>';
        lucide.createIcons();
    }
}

function addMessageToChat(message, sender, fixedTime = '') {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const time = fixedTime || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const displayMessage = sender === 'ai' ? normalizeAiText(message) : message;

    const messageHtml = sender === 'user' ? `
        <div class="flex gap-4 max-w-3xl ml-auto flex-row-reverse">
            <div class="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-600 font-bold text-xs">
                ${appState.user?.username?.charAt(0) || '我'}
            </div>
            <div class="space-y-2 text-right">
                <div class="chat-bubble-user p-4 rounded-2xl shadow-md text-sm leading-relaxed" style="white-space: pre-line;">${escapeHtml(displayMessage)}</div>
                <p class="text-[10px] text-gray-400 mr-1">${time}</p>
            </div>
        </div>
    ` : `
        <div class="flex gap-4 max-w-3xl">
            <div class="w-8 h-8 flex-shrink-0">
                <img src="/resource/logo_ai.png" alt="AI助理" class="w-full h-full object-contain">
            </div>
            <div class="space-y-2">
                <div class="chat-bubble-ai p-4 rounded-2xl shadow-sm text-sm leading-relaxed text-gray-700" style="white-space: pre-line;">${escapeHtml(displayMessage)}</div>
                <p class="text-[10px] text-gray-400 ml-1">${time}</p>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', messageHtml);
    container.scrollTop = container.scrollHeight;

    if (!appState._restoringChat) {
        appState.chatHistory = Array.isArray(appState.chatHistory) ? appState.chatHistory : [];
        appState.chatHistory.push({ sender, message, time });
        if (appState.chatHistory.length > AI_CHAT_HISTORY_LIMIT) {
            appState.chatHistory = appState.chatHistory.slice(-AI_CHAT_HISTORY_LIMIT);
        }
        saveAiChatHistory();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeAiText(text) {
    if (typeof text !== 'string') return '';
    let s = text.replace(/\r\n/g, '\n');
    s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim());
    s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    s = s.replace(/\*\*(.*?)\*\*/g, '$1');
    s = s.replace(/`([^`]+)`/g, '$1');
    s = s.replace(/^\s*[-*+]\s+/gm, '• ');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
}

// ==================== 学习路径模态框功能 ====================

function openPathModal(path = null) {
    const modal = document.getElementById('path-modal');
    const title = document.getElementById('path-modal-title');
    const idInput = document.getElementById('path-id');
    const titleInput = document.getElementById('path-title');
    const stageInput = document.getElementById('path-stage');
    const itemsInput = document.getElementById('path-items');
    const groupSelect = document.getElementById('path-group-name');
    
    // 更新分组下拉菜单
    updateGroupSelect();

    if (path) {
        title.textContent = '编辑学习路径';
        idInput.value = path.id;
        titleInput.value = path.title;
        stageInput.value = path.stage;
        // 处理 items，兼容新旧格式
        const items = path.items || [];
        itemsInput.value = items.map(item => {
            return typeof item === 'string' ? item : (item && item.text ? item.text : '');
        }).join('\n');
        // 选中当前路径的分组
        groupSelect.value = path.group_name || '默认分组';
    } else {
        title.textContent = '创建学习路径';
        idInput.value = '';
        titleInput.value = '';
        stageInput.value = 1;
        itemsInput.value = '';
        groupSelect.value = appState.selectedGroup || '默认分组';
    }

    modal.classList.remove('hidden');
    lucide.createIcons();
}

function updateGroupSelect() {
    const groupSelect = document.getElementById('path-group-name');
    if (!groupSelect) return;
    
    const groups = appState.learningPathGroups.length > 0 
        ? appState.learningPathGroups 
        : ['默认分组'];
    
    groupSelect.innerHTML = groups.map(group => 
        `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`
    ).join('');
}

function addNewGroup() {
    const newGroupInput = document.getElementById('path-new-group');
    const groupSelect = document.getElementById('path-group-name');
    
    const newGroup = newGroupInput.value.trim();
    if (!newGroup) {
        alert('请输入分组名称');
        return;
    }
    
    if (appState.learningPathGroups.includes(newGroup)) {
        alert('该分组已存在');
        return;
    }
    
    // 添加到分组列表
    appState.learningPathGroups.push(newGroup);
    // 更新分组下拉菜单
    updateGroupSelect();
    // 选中新添加的分组
    groupSelect.value = newGroup;
    // 清空输入框
    newGroupInput.value = '';
}

function closePathModal() {
    const modal = document.getElementById('path-modal');
    modal.classList.add('hidden');
}

async function savePath(event) {
    event.preventDefault();
    
    const id = document.getElementById('path-id').value;
    const title = document.getElementById('path-title').value.trim();
    const stage = parseInt(document.getElementById('path-stage').value);
    const itemsText = document.getElementById('path-items').value;
    const groupName = document.getElementById('path-group-name').value;
    
    const items = itemsText.split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);

    try {
        console.log('Saving learning path:', { id, title, stage, items, groupName });
        
        if (id) {
            // 更新现有路径
            const response = await apiRequest(`/api/path/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, stage, items, group_name: groupName })
            });
            
            console.log('Update response:', response);
            
            if (response.code === 200) {
                alert('学习路径更新成功！');
                closePathModal();
                await loadLearningPaths();
            } else {
                alert('更新失败: ' + (response.message || '未知错误'));
            }
        } else {
            // 创建新路径
            const response = await apiRequest('/api/path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, stage, items, status: 'pending', progress: 0, group_name: groupName })
            });
            
            console.log('Create response:', response);
            
            if (response.code === 200) {
                alert('学习路径创建成功！');
                closePathModal();
                await loadLearningPaths();
            } else {
                alert('创建失败: ' + (response.message || '未知错误'));
            }
        }
    } catch (error) {
        console.error('保存学习路径失败:', error);
        alert('保存失败: ' + (error.message || '请重试'));
    }
}

async function editPath(pathId) {
    try {
        if (!appState.learningPaths) {
            await loadLearningPaths();
        }
        
        const path = appState.learningPaths.find(p => p.id === pathId);
        
        if (path) {
            openPathModal(path);
        } else {
            alert('未找到学习路径');
        }
    } catch (error) {
        console.error('打开编辑失败:', error);
        alert('打开编辑失败');
    }
}

async function deletePath(pathId) {
    if (!confirm('确定要删除这条学习路径吗？')) {
        return;
    }

    try {
        const response = await apiRequest(`/api/path/${pathId}`, {
            method: 'DELETE'
        });
        
        if (response.code === 200) {
            alert('删除成功！');
            await loadLearningPaths();
        }
    } catch (error) {
        console.error('删除学习路径失败:', error);
        alert('删除失败，请重试');
    }
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
