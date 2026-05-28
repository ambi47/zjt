/**
 * AI助理前端模块
 * 独立封装，不修改任何现有代码
 * 
 * 功能：
 * 1. 激活左侧菜单栏「智能助理」入口
 * 2. 激活右下角悬浮图标入口
 * 3. 提供AI对话窗口功能
 * 4. 调用后端代理接口 /api/ai-assistant/chat
 */

// AI助理模块命名空间
const AIAssistant = (function() {
    // 私有变量
    const MODULE_NAME = 'AI-Assistant';
    const API_BASE_URL = '';
    const CHAT_CONTAINER_ID = 'ai-assistant-container';
    const FLOATING_BUTTON_ID = 'ai-assistant-floating-btn';
    
    let isPanelOpen = false;
    let isFloatingOpen = false;
    let currentViewType = 'panel'; // 'panel' | 'floating'
    
    // 初始化方法
    function init() {
        console.log(`[${MODULE_NAME}] 初始化AI助理模块`);
        
        // 绑定左侧菜单点击事件
        bindSideMenuClick();
        
        // 绑定悬浮图标点击事件
        bindFloatingButtonClick();
        
        // 创建悬浮窗口DOM
        createFloatingWindow();
        
        // 创建侧边栏面板DOM（如果不存在）
        ensurePanelContainer();
    }
    
    // 绑定左侧菜单点击
    function bindSideMenuClick() {
        const sideMenu = document.getElementById('nav-ai-assistant');
        if (sideMenu) {
            sideMenu.addEventListener('click', function(e) {
                e.preventDefault();
                openPanelView();
            });
        }
    }
    
    // 绑定悬浮图标点击
    function bindFloatingButtonClick() {
        const floatingBtn = document.querySelector('.mascot-float');
        if (floatingBtn) {
            floatingBtn.addEventListener('click', function(e) {
                e.preventDefault();
                toggleFloatingView();
            });
        }
    }
    
    // 确保侧边栏面板容器存在
    function ensurePanelContainer() {
        const appView = document.getElementById('app-view');
        if (!appView) return;
        
        // 检查是否已存在面板容器
        if (document.getElementById(CHAT_CONTAINER_ID)) return;
        
        // 创建面板容器
        const container = document.createElement('div');
        container.id = CHAT_CONTAINER_ID;
        container.className = 'flex-1 flex flex-col min-w-0 overflow-hidden view-hidden';
        container.innerHTML = `
            <div class="flex flex-col h-full bg-white">
                <!-- 头部 -->
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <i data-lucide="bot" class="w-5 h-5 text-white"></i>
                        </div>
                        <div>
                            <h2 class="font-bold text-gray-800">智能助理</h2>
                            <p class="text-xs text-gray-500">为你制定学习计划</p>
                        </div>
                    </div>
                    <button id="ai-panel-close" onclick="AIAssistant.closePanelView()" 
                            class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
                    </button>
                </div>
                
                <!-- 消息区域 -->
                <div id="ai-panel-messages" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <!-- 欢迎消息 -->
                    <div class="flex gap-4 max-w-3xl">
                        <div class="w-8 h-8 flex-shrink-0">
                            <img src="/resource/logo_ai.png" alt="AI助理" class="w-full h-full object-contain">
                        </div>
                        <div class="space-y-2">
                            <div class="chat-bubble-ai p-4 rounded-2xl shadow-sm text-sm leading-relaxed text-gray-700">
                                你好！我是你的AI学习助理，可以帮你：
                                <ul class="mt-2 space-y-1">
                                    <li>📚 根据你的学习情况推荐课程</li>
                                    <li>📅 制定个性化学习计划</li>
                                    <li>🎯 解答学习相关问题</li>
                                </ul>
                                请问有什么可以帮你的？
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 输入区域 -->
                <div class="p-4 border-t border-gray-100 bg-gray-50">
                    <div class="flex items-end gap-3">
                        <textarea id="ai-panel-input" rows="1" 
                                  placeholder="向AI助理提问..." 
                                  class="flex-1 max-h-32 py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
                        <button id="ai-panel-send" onclick="AIAssistant.sendMessage('panel')" 
                                class="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors">
                            <i data-lucide="send" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        appView.appendChild(container);
        lucide.createIcons();
        
        // 绑定输入框事件
        const input = document.getElementById('ai-panel-input');
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage('panel');
                }
            });
            
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        }
    }
    
    // 创建悬浮窗口DOM
    function createFloatingWindow() {
        // 检查是否已存在
        if (document.getElementById('ai-floating-window')) return;
        
        const floatingWindow = document.createElement('div');
        floatingWindow.id = 'ai-floating-window';
        floatingWindow.className = 'fixed bottom-20 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-50 view-hidden';
        floatingWindow.style.maxHeight = '70vh';
        
        floatingWindow.innerHTML = `
            <!-- 头部 -->
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <i data-lucide="bot" class="w-4 h-4 text-white"></i>
                    </div>
                    <span class="font-bold text-sm text-gray-800">AI学习助理</span>
                </div>
                <button id="ai-floating-close" onclick="AIAssistant.closeFloatingView()" 
                        class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                    <i data-lucide="x" class="w-4 h-4 text-gray-500"></i>
                </button>
            </div>
            
            <!-- 消息区域 -->
            <div id="ai-floating-messages" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <!-- 欢迎消息 -->
                <div class="flex gap-3 max-w-full">
                    <div class="w-7 h-7 flex-shrink-0">
                        <img src="/resource/logo_ai.png" alt="AI助理" class="w-full h-full object-contain">
                    </div>
                    <div class="space-y-1">
                        <div class="chat-bubble-ai-sm p-3 rounded-xl shadow-sm text-xs leading-relaxed text-gray-700">
                            你好！我是你的AI学习助理，有什么可以帮你的？
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 输入区域 -->
            <div class="p-3 border-t border-gray-100 bg-gray-50">
                <div class="flex items-end gap-2">
                    <textarea id="ai-floating-input" rows="1" 
                              placeholder="输入问题..." 
                              class="flex-1 max-h-24 py-2 px-3 bg-white border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
                    <button id="ai-floating-send" onclick="AIAssistant.sendMessage('floating')" 
                            class="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                        <i data-lucide="send" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(floatingWindow);
        lucide.createIcons();
        
        // 绑定输入框事件
        const input = document.getElementById('ai-floating-input');
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage('floating');
                }
            });
            
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        }
    }
    
    // 打开侧边栏面板视图
    function openPanelView() {
        // 隐藏其他视图
        document.querySelectorAll('[id$="-view"]').forEach(view => {
            view.classList.add('view-hidden');
        });
        
        // 显示AI助理面板
        const container = document.getElementById(CHAT_CONTAINER_ID);
        if (container) {
            container.classList.remove('view-hidden');
            isPanelOpen = true;
            currentViewType = 'panel';
        }
        
        // 更新导航样式
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('bg-blue-50', 'text-blue-700');
            nav.classList.add('text-gray-500', 'hover:bg-gray-100', 'hover:text-gray-900');
        });
        
        const aiNav = document.getElementById('nav-ai-assistant');
        if (aiNav) {
            aiNav.classList.add('bg-blue-50', 'text-blue-700');
            aiNav.classList.remove('text-gray-500', 'hover:bg-gray-100', 'hover:text-gray-900');
        }
        
        // 更新AI图标
        const aiIcon = document.getElementById('ai-assistant-icon');
        if (aiIcon) {
            aiIcon.src = '/resource/logo_ai_side_choose.png';
        }
        
        // 隐藏悬浮图标
        const mascot = document.querySelector('.mascot-float');
        if (mascot) {
            mascot.classList.add('view-hidden');
        }
        
        // 重新创建图标
        lucide.createIcons();
    }
    
    // 关闭侧边栏面板视图
    function closePanelView() {
        const container = document.getElementById(CHAT_CONTAINER_ID);
        if (container) {
            container.classList.add('view-hidden');
            isPanelOpen = false;
        }
        
        // 恢复悬浮图标
        const mascot = document.querySelector('.mascot-float');
        if (mascot) {
            mascot.classList.remove('view-hidden');
        }
    }
    
    // 切换悬浮视图
    function toggleFloatingView() {
        const window = document.getElementById('ai-floating-window');
        if (!window) return;
        
        if (isFloatingOpen) {
            closeFloatingView();
        } else {
            openFloatingView();
        }
    }
    
    // 打开悬浮视图
    function openFloatingView() {
        const window = document.getElementById('ai-floating-window');
        if (window) {
            window.classList.remove('view-hidden');
            isFloatingOpen = true;
            currentViewType = 'floating';
            
            // 聚焦输入框
            setTimeout(() => {
                const input = document.getElementById('ai-floating-input');
                if (input) input.focus();
            }, 100);
        }
    }
    
    // 关闭悬浮视图
    function closeFloatingView() {
        const window = document.getElementById('ai-floating-window');
        if (window) {
            window.classList.add('view-hidden');
            isFloatingOpen = false;
        }
    }
    
    // 发送消息
    async function sendMessage(viewType) {
        const inputId = viewType === 'panel' ? 'ai-panel-input' : 'ai-floating-input';
        const messagesId = viewType === 'panel' ? 'ai-panel-messages' : 'ai-floating-messages';
        const sendBtnId = viewType === 'panel' ? 'ai-panel-send' : 'ai-floating-send';
        
        const input = document.getElementById(inputId);
        const messages = document.getElementById(messagesId);
        const sendBtn = document.getElementById(sendBtnId);
        
        if (!input || !messages) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        // 添加用户消息
        addMessageToChat(message, 'user', viewType);
        input.value = '';
        input.style.height = 'auto';
        
        // 显示加载状态
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';
        }
        
        try {
            // 调用后端代理接口
            const response = await fetch(`${API_BASE_URL}/api/ai-assistant/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (data.code === 200) {
                // 添加AI回复
                setTimeout(() => {
                    addMessageToChat(data.data.answer, 'ai', viewType);
                }, 500);
            } else {
                // 显示错误消息
                addMessageToChat('AI助理暂时无法回复，请稍后再试', 'ai', viewType);
            }
        } catch (error) {
            console.error('[AI助理] 请求失败:', error);
            addMessageToChat('AI助理暂时无法回复，请稍后再试', 'ai', viewType);
        } finally {
            // 恢复发送按钮
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = viewType === 'panel' 
                    ? '<i data-lucide="send" class="w-5 h-5"></i>'
                    : '<i data-lucide="send" class="w-4 h-4"></i>';
                lucide.createIcons();
            }
        }
    }
    
    // 添加消息到聊天界面
    function addMessageToChat(message, sender, viewType) {
        const messagesId = viewType === 'panel' ? 'ai-panel-messages' : 'ai-floating-messages';
        const container = document.getElementById(messagesId);
        if (!container) return;
        
        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const isPanel = viewType === 'panel';
        
        // 获取用户名首字母
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const initial = user.username?.charAt(0) || '我';
        
        const messageHtml = sender === 'user' ? `
            <div class="flex gap-${isPanel ? '4' : '3'} max-w-${isPanel ? '3xl' : 'full'} ml-auto flex-row-reverse">
                <div class="w-${isPanel ? '8' : '7'} h-${isPanel ? '8' : '7'} rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-600 font-bold text-${isPanel ? 'xs' : 'xs'}">
                    ${initial}
                </div>
                <div class="space-y-${isPanel ? '2' : '1'} text-right">
                    <div class="chat-bubble-user-${isPanel ? '' : 'sm'} p-${isPanel ? '4' : '3'} rounded-${isPanel ? '2xl' : 'xl'} shadow-${isPanel ? 'md' : 'sm'} text-${isPanel ? 'sm' : 'xs'} leading-relaxed" style="white-space: pre-line;">${escapeHtml(message)}</div>
                    <p class="text-[10px] text-gray-400 ${isPanel ? 'mr-1' : ''}">${time}</p>
                </div>
            </div>
        ` : `
            <div class="flex gap-${isPanel ? '4' : '3'} max-w-${isPanel ? '3xl' : 'full'}">
                <div class="w-${isPanel ? '8' : '7'} h-${isPanel ? '8' : '7'} flex-shrink-0">
                    <img src="/resource/logo_ai.png" alt="AI助理" class="w-full h-full object-contain">
                </div>
                <div class="space-y-${isPanel ? '2' : '1'}">
                    <div class="chat-bubble-ai-${isPanel ? '' : 'sm'} p-${isPanel ? '4' : '3'} rounded-${isPanel ? '2xl' : 'xl'} shadow-${isPanel ? 'sm' : 'sm'} text-${isPanel ? 'sm' : 'xs'} leading-relaxed text-gray-700" style="white-space: pre-line;">${escapeHtml(message)}</div>
                    <p class="text-[10px] text-gray-400 ${isPanel ? 'ml-1' : ''}">${time}</p>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', messageHtml);
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
    }
    
    // HTML转义
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 暴露公共方法
    return {
        init,
        openPanelView,
        closePanelView,
        toggleFloatingView,
        sendMessage
    };
})();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    AIAssistant.init();
});

// 暴露到全局
window.AIAssistant = AIAssistant;