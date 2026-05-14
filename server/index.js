/**
 * 智荐通 - 统一后端服务
 * 整合原Python FastAPI和C++ Crow的功能
 * 新增：登录失败次数限制（防暴力破解）、数据持久化
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-super-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data.json');

// ==================== 数据持久化 ====================

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            // 将普通对象转换为Map
            const usersMap = new Map();
            if (data.users) {
                Object.entries(data.users).forEach(([key, value]) => {
                    usersMap.set(key, value);
                });
            }
            return { users: usersMap };
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
    return { users: new Map() };
}

function saveData() {
    try {
        const data = {
            users: Object.fromEntries(db.users)
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// ==================== 安全模块：登录失败次数限制 ====================

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15分钟锁定

function checkLoginAttempt(username) {
    const attempt = loginAttempts.get(username);
    if (!attempt) return { allowed: true };

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
        const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
        return { allowed: false, remainingMinutes: remaining };
    }

    return { allowed: true };
}

function recordFailedAttempt(username) {
    const attempt = loginAttempts.get(username) || { count: 0 };
    attempt.count++;
    attempt.lastAttempt = Date.now();

    if (attempt.count >= MAX_ATTEMPTS) {
        attempt.lockedUntil = Date.now() + LOCK_TIME;
        attempt.count = 0;
    }

    loginAttempts.set(username, attempt);
    return attempt;
}

function clearLoginAttempts(username) {
    loginAttempts.delete(username);
}

// ==================== 数据库 ====================

const loaded = loadData();
const db = {
    users: loaded.users,
    resources: [
        { id: 1, title: 'Python 自动化脚本实战', desc: '学会使用 Python 提高工作效率，涵盖文件处理、网页爬取等。', category: '编程开发', icon: 'terminal', emoji: '🐍', color: 'blue', students: '1.2k' },
        { id: 2, title: 'Prompt Engineering 提示词工程', desc: '系统学习如何与 AI 对话，获得更精准的输出结果。', category: 'AI 技术', icon: 'messages-square', emoji: '🧠', color: 'indigo', students: '3.5k' },
        { id: 3, title: '现代 UI 设计原则', desc: '掌握配色、间距、排版等核心 UI 设计技巧。', category: '设计美学', icon: 'palette', emoji: '🎨', color: 'purple', students: '890' },
        { id: 4, title: 'SQL 数据库优化指南', desc: '深入浅出讲解数据库索引、查询优化与架构设计。', category: '后端技术', icon: 'database', emoji: '🗄️', color: 'emerald', students: '1.5k' },
        { id: 5, title: 'TypeScript 高级用法', desc: '掌握泛型、类型体操等 TS 进阶技术。', category: '编程开发', icon: 'file-code', emoji: '🟦', color: 'blue', students: '856' },
        { id: 6, title: '大模型应用开发指南', desc: '基于 LangChain 的 LLM 应用实战手册。', category: 'AI 技术', icon: 'bot', emoji: '🤖', color: 'orange', students: '1.2k' }
    ],
    learningPaths: [
        {
            id: 1,
            title: '前端基础与工程化',
            stage: 1,
            status: 'completed',
            items: ['HTML5/CSS3 进阶', 'ES6+ 核心语法', 'Webpack/Vite 工具']
        },
        {
            id: 2,
            title: 'React 实战进阶',
            stage: 2,
            status: 'in_progress',
            progress: 65,
            items: ['Hooks 深度解析', '状态管理实战', 'React 性能优化']
        },
        {
            id: 3,
            title: 'Node.js 后端开发',
            stage: 3,
            status: 'pending',
            items: ['Express 基础', '数据库操作', 'RESTful API 设计']
        }
    ],
    recommendations: [
        { id: 1, title: '机器学习在金融领域的应用', desc: '深入探讨如何利用 AI 模型进行股票预测、风险评估及反欺诈分析。', category: '基于你的兴趣', color: 'blue', icon: 'brain', students: '4.8k' },
        { id: 2, title: '系统架构师核心素养', desc: '从代码编写到架构设计，掌握大型分布式系统的设计原则与权衡点。', category: '热门内容', color: 'indigo', icon: 'layers', students: '2.1k' }
    ]
};

// ==================== 中间件 ====================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function proxyJavaScript(remoteUrl) {
    return (req, res) => {
        const fetch = (urlStr, depth = 0) => {
            if (depth > 5) {
                res.status(508).end();
                return;
            }

            let url;
            try {
                url = new URL(urlStr);
            } catch {
                res.status(502).end();
                return;
            }

            const upstreamReq = https.get(url, (upstream) => {
                const status = upstream.statusCode || 200;
                const location = upstream.headers.location;
                if (status >= 300 && status < 400 && location) {
                    upstream.resume();
                    const nextUrl = new URL(location, url).toString();
                    fetch(nextUrl, depth + 1);
                    return;
                }

                res.status(status);
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                upstream.pipe(res);
            });

            upstreamReq.on('error', () => {
                if (!res.headersSent) res.status(502);
                res.end();
            });
        };

        fetch(remoteUrl);
    };
}

app.get('/vendor/tailwindcss.js', proxyJavaScript('https://cdn.tailwindcss.com'));
app.get('/vendor/lucide.js', proxyJavaScript('https://unpkg.com/lucide@latest'));

// JWT认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ code: 401, message: '未提供认证令牌' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ code: 403, message: '令牌无效或已过期' });
        }
        req.user = user;
        next();
    });
};

// ==================== 认证相关API ====================

/**
 * 用户注册
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email, interests = [] } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({
                code: 400,
                message: '用户名、密码和邮箱为必填项'
            });
        }

        // 用户名长度校验
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({
                code: 400,
                message: '用户名长度应在3-20个字符之间'
            });
        }

        // 邮箱格式校验
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                code: 400,
                message: '邮箱格式不正确'
            });
        }

        if (db.users.has(username)) {
            return res.status(400).json({
                code: 400,
                message: '用户名已存在'
            });
        }

        // 密码加密（bcryptjs，10轮salt）
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建用户
        const user = {
            username,
            password: hashedPassword,
            email,
            interests,
            createdAt: new Date().toISOString(),
            level: '学习新手',
            points: 0,
            learningDays: 0,
            badges: 0
        };

        db.users.set(username, user);
        saveData(); // 保存到文件

        res.status(201).json({
            code: 201,
            message: '注册成功',
            data: { username, email }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: '注册失败: ' + error.message
        });
    }
});

/**
 * 用户登录（含防暴力破解）
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                code: 400,
                message: '用户名和密码为必填项'
            });
        }

        // 检查是否被锁定
        const attemptCheck = checkLoginAttempt(username);
        if (!attemptCheck.allowed) {
            return res.status(429).json({
                code: 429,
                message: `登录失败次数过多，账号已锁定，请${attemptCheck.remainingMinutes}分钟后再试`
            });
        }

        const user = db.users.get(username);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            // 记录失败尝试
            const attempt = recordFailedAttempt(username);
            const remaining = MAX_ATTEMPTS - attempt.count;

            return res.status(401).json({
                code: 401,
                message: `用户名或密码错误，还剩${remaining}次尝试机会`
            });
        }

        // 登录成功，清除失败记录
        clearLoginAttempts(username);

        // 生成JWT令牌
        const token = jwt.sign(
            { username: user.username, email: user.email },
            SECRET_KEY,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({
            code: 200,
            message: '登录成功',
            data: {
                access_token: token,
                token_type: 'Bearer',
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            message: '登录失败: ' + error.message
        });
    }
});

// ==================== 用户相关API ====================

/**
 * 获取用户信息
 * GET /api/user/info
 */
app.get('/api/user/info', authenticateToken, (req, res) => {
    const user = db.users.get(req.user.username);
    if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    res.json({
        code: 200,
        message: '获取成功',
        data: {
            userId: 1001,
            username: user.username,
            email: user.email,
            learningGoal: '全栈开发探索者',
            level: user.level,
            points: user.points,
            learningDays: user.learningDays,
            badges: user.badges,
            interests: user.interests
        }
    });
});

/**
 * 更新用户信息
 * PUT /api/user/info
 */
app.put('/api/user/info', authenticateToken, (req, res) => {
    const user = db.users.get(req.user.username);
    if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    const { level, points, learningDays } = req.body;
    if (level) user.level = level;
    if (points !== undefined) user.points = points;
    if (learningDays !== undefined) user.learningDays = learningDays;

    db.users.set(req.user.username, user);
    saveData(); // 保存到文件

    res.json({
        code: 200,
        message: '更新成功',
        data: { username: user.username }
    });
});

// ==================== 仪表盘API ====================

/**
 * 获取仪表盘数据
 * GET /api/dashboard
 */
app.get('/api/dashboard', authenticateToken, (req, res) => {
    const user = db.users.get(req.user.username);

    res.json({
        code: 200,
        message: '获取成功',
        data: {
            learningPath: {
                title: 'React 实战进阶之路',
                progress: 65,
                completed: 12,
                total: 18,
                nextStep: {
                    title: '状态管理：Redux Toolkit',
                    difficulty: '中等'
                }
            },
            stats: {
                weeklyHours: 12.5,
                weeklyGrowth: 15,
                streakDays: 7,
                completedCourses: 24,
                rankPercent: 88,
                points: user ? user.points : 1280
            },
            announcements: [
                {
                    id: 1,
                    title: '智荐通 2.0 正式上线',
                    content: '新增 AI 助理功能，快来体验智能问答！',
                    time: '2小时前'
                }
            ]
        }
    });
});

// ==================== 推荐API ====================

/**
 * 获取首页推荐
 * GET /api/recommend/home
 */
app.get('/api/recommend/home', authenticateToken, (req, res) => {
    res.json({
        code: 200,
        message: '获取成功',
        data: {
            featured: {
                title: '2026 全栈开发工程师成长路线图',
                subtitle: '从零基础到独立开发，系统化掌握现代 Web 开发核心技术栈',
                tag: '精选课程'
            },
            hot: db.recommendations
        }
    });
});

/**
 * 获取个性化推荐
 * GET /api/recommend/personal
 */
app.get('/api/recommend/personal', authenticateToken, (req, res) => {
    const user = db.users.get(req.user.username);
    const interests = user ? user.interests : [];

    res.json({
        code: 200,
        message: '获取成功',
        data: {
            basedOnInterests: interests,
            recommendations: db.recommendations,
            guessYouLike: [
                { id: 1, title: 'NoSQL 数据库实战', icon: 'database', color: 'blue' },
                { id: 2, title: 'Web 安全防御', icon: 'shield-check', color: 'green' },
                { id: 3, title: 'Go 语言工程化', icon: 'terminal', color: 'cyan' },
                { id: 4, title: '微前端架构解析', icon: 'monitor', color: 'indigo' }
            ]
        }
    });
});

// ==================== 资源库API ====================

/**
 * 获取资源列表
 * GET /api/resource/list
 */
app.get('/api/resource/list', authenticateToken, (req, res) => {
    const { category, page = 1, limit = 10 } = req.query;

    let resources = db.resources;
    if (category && category !== 'all') {
        resources = resources.filter(r => r.category.includes(category));
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    const paginatedResources = resources.slice(start, end);

    res.json({
        code: 200,
        message: '获取成功',
        data: {
            total: resources.length,
            page: parseInt(page),
            limit: parseInt(limit),
            items: paginatedResources
        }
    });
});

/**
 * 获取资源详情
 * GET /api/resource/:id
 */
app.get('/api/resource/:id', authenticateToken, (req, res) => {
    const resource = db.resources.find(r => r.id === parseInt(req.params.id));

    if (!resource) {
        return res.status(404).json({ code: 404, message: '资源不存在' });
    }

    res.json({
        code: 200,
        message: '获取成功',
        data: resource
    });
});

// ==================== 学习路径API ====================

/**
 * 获取学习路径列表
 * GET /api/path/list
 */
app.get('/api/path/list', authenticateToken, (req, res) => {
    res.json({
        code: 200,
        message: '获取成功',
        data: {
            total: db.learningPaths.length,
            items: db.learningPaths
        }
    });
});

/**
 * 获取当前学习路径进度
 * GET /api/path/progress
 */
app.get('/api/path/progress', authenticateToken, (req, res) => {
    const currentPath = db.learningPaths.find(p => p.status === 'in_progress');

    res.json({
        code: 200,
        message: '获取成功',
        data: currentPath || db.learningPaths[0]
    });
});

// ==================== AI助理API ====================

/**
 * AI聊天
 * POST /api/ai/chat
 */
app.post('/api/ai/chat', authenticateToken, (req, res) => {
    const { message } = req.body;

    // 模拟AI回复逻辑
    let answer = '我是你的AI学习助手！';

    if (message) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('react') || lowerMsg.includes('hook')) {
            answer = `React Hooks 是 React 16.8 引入的特性，它允许你在不编写类组件的情况下使用状态和其他 React 特性。以下是核心概念：

1. **useState**: 用于在函数组件中添加本地状态
2. **useEffect**: 处理副作用（如数据获取、订阅、手动修改 DOM）
3. **useContext**: 让你能够不通过组件树逐层传递 props 就能消费上下文
4. **useMemo & useCallback**: 用于性能优化，减少不必要的重新渲染和计算

你需要针对某个具体的 Hook 进行深入讲解吗？`;
        } else if (lowerMsg.includes('python') || lowerMsg.includes('学习')) {
            answer = '学习Python的建议路径：\n1. 基础语法和数据类型\n2. 面向对象编程\n3. 常用库（NumPy, Pandas）\n4. 实战项目练习\n\n我可以为你推荐相关的学习资源！';
        } else if (lowerMsg.includes('计划') || lowerMsg.includes('路线')) {
            answer = '我可以帮你制定个性化的学习计划。请告诉我：\n1. 你想学习的技术方向\n2. 每周可以投入的学习时间\n3. 你的当前水平（初学者/中级/高级）';
        } else {
            answer = `收到你的问题："${message}"\n\n这是一个很好的问题！我可以帮你：\n- 解释相关概念\n- 推荐学习资源\n- 制定学习计划\n- 解答技术难题\n\n请告诉我你需要哪方面的帮助？`;
        }
    }

    res.json({
        code: 200,
        message: '回复成功',
        data: {
            answer,
            timestamp: new Date().toISOString()
        }
    });
});

// ==================== 前端路由处理 ====================

// 所有其他路由返回index.html（单页应用支持）
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==================== 启动服务器 ====================

const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`\n🚀 智荐通服务器已启动`);
    console.log(`📍 本地访问: http://localhost:${PORT}`);
    
    // 获取局域网IP
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`📍 局域网访问: http://${net.address}:${PORT}`);
            }
        }
    }
    
    console.log(`📁 静态文件目录: ${path.join(__dirname, '../public')}`);
    console.log(`💾 数据文件: ${DATA_FILE}\n`);
});

module.exports = app;
