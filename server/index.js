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
const https = require('https');
const dbStore = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-super-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

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
dbStore.init().catch(() => {});

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

const requireAdmin = async (req, res, next) => {
    const user = await dbStore.getUserByUsername(req.user.username);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ code: 403, message: '无权限访问' });
    }
    next();
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

        // 密码强度校验
        if (password.length < 8) {
            return res.status(400).json({
                code: 400,
                message: '密码长度至少为8位'
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

        const existing = await dbStore.getUserByUsername(username);
        if (existing) {
            return res.status(400).json({
                code: 400,
                message: '用户名已存在'
            });
        }

        // 密码加密（bcryptjs，10轮salt）
        const hashedPassword = await bcrypt.hash(password, 10);

        await dbStore.createUser({
            username,
            email,
            passwordHash: hashedPassword,
            interests
        });

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

        const user = await dbStore.getUserByUsername(username);

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
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
app.get('/api/user/info', authenticateToken, async (req, res) => {
    const user = await dbStore.getUserByUsername(req.user.username);
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
            learningGoal: user.learning_goal,
            level: user.level,
            points: user.points,
            learningDays: user.learning_days,
            badges: user.badges,
            interests: JSON.parse(user.interests_json || '[]')
        }
    });
});

/**
 * 更新用户信息
 * PUT /api/user/info
 */
app.put('/api/user/info', authenticateToken, async (req, res) => {
    const { level, points, learningDays, badges, learningGoal, interests } = req.body;
    const updated = await dbStore.updateUserInfo(req.user.username, {
        level,
        points,
        learningDays,
        badges,
        learningGoal,
        interests
    });
    if (!updated) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    res.json({
        code: 200,
        message: '更新成功',
        data: { username: updated.username }
    });
});

// ==================== 仪表盘API ====================

/**
 * 获取仪表盘数据
 * GET /api/dashboard
 */
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    const user = await dbStore.getUserByUsername(req.user.username);
    const paths = await dbStore.listLearningPaths();
    const currentPath = paths.find(p => p.status === 'in_progress') || paths[0];
    const totalSteps = (currentPath?.items?.length || 18);
    const progress = currentPath?.progress ?? 65;
    const completedSteps = Math.max(0, Math.min(totalSteps, Math.round((progress / 100) * totalSteps)));

    res.json({
        code: 200,
        message: '获取成功',
        data: {
            learningPath: {
                title: currentPath?.title || 'React 实战进阶之路',
                progress,
                completed: completedSteps,
                total: totalSteps,
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
app.get('/api/recommend/home', authenticateToken, async (req, res) => {
    const hot = await dbStore.listRecommendations('home');
    res.json({
        code: 200,
        message: '获取成功',
        data: {
            featured: {
                title: '2026 全栈开发工程师成长路线图',
                subtitle: '从零基础到独立开发，系统化掌握现代 Web 开发核心技术栈',
                tag: '精选课程'
            },
            hot
        }
    });
});

/**
 * 获取个性化推荐
 * GET /api/recommend/personal
 */
app.get('/api/recommend/personal', authenticateToken, async (req, res) => {
    const user = await dbStore.getUserByUsername(req.user.username);
    const interests = user ? JSON.parse(user.interests_json || '[]') : [];
    const recommendations = await dbStore.listRecommendations('personal');

    res.json({
        code: 200,
        message: '获取成功',
        data: {
            basedOnInterests: interests,
            recommendations,
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
app.get('/api/resource/list', authenticateToken, async (req, res) => {
    const { category, page = 1, limit = 10 } = req.query;

    let resources = await dbStore.listResources();
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
app.get('/api/resource/:id', authenticateToken, async (req, res) => {
    const resource = await dbStore.getResourceById(parseInt(req.params.id));

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
app.get('/api/path/list', authenticateToken, async (req, res) => {
    const paths = await dbStore.listLearningPaths();
    res.json({
        code: 200,
        message: '获取成功',
        data: {
            total: paths.length,
            items: paths
        }
    });
});

/**
 * 获取学习路径分组列表
 * GET /api/path/groups
 */
app.get('/api/path/groups', authenticateToken, async (req, res) => {
    const groups = await dbStore.listLearningPathGroups();
    res.json({
        code: 200,
        message: '获取成功',
        data: groups
    });
});

/**
 * 删除学习路径分组
 * DELETE /api/path/groups/:groupName
 */
app.delete('/api/path/groups/:groupName', authenticateToken, async (req, res) => {
    try {
        const groupName = decodeURIComponent(req.params.groupName);
        await dbStore.deleteLearningPathGroup(groupName);
        
        res.json({
            code: 200,
            message: '分组删除成功'
        });
    } catch (error) {
        console.error('删除分组失败:', error);
        res.status(500).json({
            code: 500,
            message: error.message || '删除分组失败'
        });
    }
});

/**
 * 获取当前学习路径进度
 * GET /api/path/progress
 */
app.get('/api/path/progress', authenticateToken, async (req, res) => {
    const paths = await dbStore.listLearningPaths();
    const currentPath = paths.find(p => p.status === 'in_progress');

    res.json({
        code: 200,
        message: '获取成功',
        data: currentPath || paths[0]
    });
});

/**
 * 选择/开始学习路径
 * POST /api/path/select/:id
 */
app.post('/api/path/select/:id', authenticateToken, async (req, res) => {
    try {
        const pathId = parseInt(req.params.id);
        const path = await dbStore.getLearningPathById(pathId);
        
        if (!path) {
            return res.status(404).json({
                code: 404,
                message: '学习路径不存在'
            });
        }

        const updatedPath = await dbStore.updateLearningPathStatus(pathId, 'in_progress', path.progress || 0);
        
        res.json({
            code: 200,
            message: '已选择学习路径',
            data: updatedPath
        });
    } catch (error) {
        console.error('选择学习路径失败:', error);
        res.status(500).json({
            code: 500,
            message: '选择学习路径失败'
        });
    }
});

/**
 * 更新学习路径进度
 * PUT /api/path/progress/:id
 */
app.put('/api/path/progress/:id', authenticateToken, async (req, res) => {
    try {
        const pathId = parseInt(req.params.id);
        const { progress, status } = req.body;
        
        const path = await dbStore.getLearningPathById(pathId);
        if (!path) {
            return res.status(404).json({
                code: 404,
                message: '学习路径不存在'
            });
        }

        const updatedPath = await dbStore.updateLearningPathStatus(
            pathId, 
            status || path.status, 
            progress !== undefined ? progress : path.progress
        );
        
        res.json({
            code: 200,
            message: '已更新学习路径',
            data: updatedPath
        });
    } catch (error) {
        console.error('更新学习路径失败:', error);
        res.status(500).json({
            code: 500,
            message: '更新学习路径失败'
        });
    }
});

/**
 * 切换学习项目完成状态
 * PUT /api/path/:id/toggle-item/:itemIndex
 */
app.put('/api/path/:id/toggle-item/:itemIndex', authenticateToken, async (req, res) => {
    try {
        const pathId = parseInt(req.params.id);
        const itemIndex = parseInt(req.params.itemIndex);
        
        const path = await dbStore.getLearningPathById(pathId);
        if (!path) {
            return res.status(404).json({
                code: 404,
                message: '学习路径不存在'
            });
        }
        
        if (itemIndex < 0 || itemIndex >= path.items.length) {
            return res.status(400).json({
                code: 400,
                message: '学习项目索引无效'
            });
        }

        const updatedPath = await dbStore.toggleLearningPathItem(pathId, itemIndex);
        
        res.json({
            code: 200,
            message: '已更新学习项目状态',
            data: updatedPath
        });
    } catch (error) {
        console.error('更新学习项目失败:', error);
        res.status(500).json({
            code: 500,
            message: '更新学习项目失败'
        });
    }
});

/**
 * 创建自定义学习路径
 * POST /api/path
 */
app.post('/api/path', authenticateToken, async (req, res) => {
    try {
        const { title, items, stage, status, progress, group_name } = req.body;
        console.log('POST /api/path - Request body:', { title, items, stage, status, progress, group_name });
        
        if (!title || !title.trim()) {
            return res.status(400).json({
                code: 400,
                message: '学习路径标题不能为空'
            });
        }

        const newPath = await dbStore.createLearningPath({
            title: title.trim(),
            items: items || [],
            stage: stage !== undefined ? stage : 1,
            status: status || 'pending',
            progress: progress !== undefined ? progress : 0,
            group_name: group_name || '默认分组'
        });
        
        console.log('POST /api/path - Success, created:', newPath);
        res.json({
            code: 200,
            message: '学习路径创建成功',
            data: newPath
        });
    } catch (error) {
        console.error('创建学习路径失败:', error);
        res.status(500).json({
            code: 500,
            message: '创建学习路径失败: ' + (error.message || '未知错误')
        });
    }
});

/**
 * 更新学习路径
 * PUT /api/path/:id
 */
app.put('/api/path/:id', authenticateToken, async (req, res) => {
    try {
        const pathId = parseInt(req.params.id);
        const { title, items, stage, status, progress, group_name } = req.body;
        
        const existingPath = await dbStore.getLearningPathById(pathId);
        if (!existingPath) {
            return res.status(404).json({
                code: 404,
                message: '学习路径不存在'
            });
        }

        const updatedPath = await dbStore.updateLearningPath(pathId, {
            title,
            items,
            stage,
            status,
            progress,
            group_name
        });
        
        res.json({
            code: 200,
            message: '学习路径更新成功',
            data: updatedPath
        });
    } catch (error) {
        console.error('更新学习路径失败:', error);
        res.status(500).json({
            code: 500,
            message: '更新学习路径失败'
        });
    }
});

/**
 * 删除学习路径
 * DELETE /api/path/:id
 */
app.delete('/api/path/:id', authenticateToken, async (req, res) => {
    try {
        const pathId = parseInt(req.params.id);
        
        const existingPath = await dbStore.getLearningPathById(pathId);
        if (!existingPath) {
            return res.status(404).json({
                code: 404,
                message: '学习路径不存在'
            });
        }

        await dbStore.deleteLearningPath(pathId);
        
        res.json({
            code: 200,
            message: '学习路径删除成功'
        });
    } catch (error) {
        console.error('删除学习路径失败:', error);
        res.status(500).json({
            code: 500,
            message: '删除学习路径失败'
        });
    }
});

// ==================== AI助理API ====================

/**
 * 检查问题是否与学习相关
 * @param {string} message - 用户提问
 * @returns {boolean} - 是否为学习相关问题
 */
function isLearningRelated(message) {
    const lowerMsg = message.toLowerCase();
    
    // 学习相关关键词
    const learningKeywords = [
        '学习', '课程', '教程', '知识', '技术', '编程', '代码', '开发',
        'python', 'java', 'javascript', 'js', 'react', 'vue', '前端', '后端',
        '算法', '数据结构', '数据库', '网络', '安全', '设计', 'ui', 'ux',
        '人工智能', 'ai', '机器学习', '深度学习', '路径', '计划', '资源',
        '推荐', '入门', '进阶', '高级', '基础', '概念', '问题', '解答',
        '练习', '项目', '实战', '技能', '能力', '提升', '掌握', '理解',
        'hook', '函数', '类', '对象', '数组', '字符串', '变量', '循环',
        '条件', '数组', '链表', '树', '图', '排序', '搜索', '算法',
        'html', 'css', 'php', 'go', 'rust', 'c++', 'c#', 'swift', 'kotlin',
        'sql', 'nosql', 'mongodb', 'mysql', 'redis', 'docker', 'kubernetes',
        'git', 'github', '版本控制', '测试', '调试', '部署', '运维',
        'api', '接口', '框架', '库', '工具', '软件', '应用', '网站',
        'web', '移动端', '小程序', '公众号', '安卓', 'ios', 'app'
    ];
    
    // 检查是否包含学习相关关键词
    return learningKeywords.some(keyword => lowerMsg.includes(keyword));
}

/**
 * AI聊天
 * POST /api/ai/chat
 */
app.post('/api/ai/chat', authenticateToken, (req, res) => {
    const { message } = req.body;

    // 检查问题是否与学习相关
    if (!isLearningRelated(message)) {
        return res.json({
            code: 200,
            message: '回复成功',
            data: {
                answer: '抱歉，我是你的AI学习助理，仅能回答与学习相关的问题。请提出关于编程、课程、学习计划、技术知识等方面的问题，我会尽力为你提供帮助！',
                timestamp: new Date().toISOString()
            }
        });
    }

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

// ==================== AI助理独立路由（新增）====================
/**
 * 新增独立路由：/api/ai-assistant
 * 完全独立封装，不修改任何现有接口
 */
const aiAssistantRouter = require('./ai-assistant/router');
app.use('/api/ai-assistant', authenticateToken, aiAssistantRouter);

// ==================== 后台管理API ====================

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    const users = await dbStore.listUsers();
    res.json({ code: 200, message: '获取成功', data: { total: users.length, items: users } });
});

app.get('/api/admin/resources', authenticateToken, requireAdmin, async (req, res) => {
    const resources = await dbStore.listResources();
    res.json({ code: 200, message: '获取成功', data: { total: resources.length, items: resources } });
});

app.post('/api/admin/resources', authenticateToken, requireAdmin, async (req, res) => {
    const created = await dbStore.createResource(req.body || {});
    res.status(201).json({ code: 201, message: '创建成功', data: created });
});

app.put('/api/admin/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await dbStore.updateResource(id, req.body || {});
    if (!updated) return res.status(404).json({ code: 404, message: '资源不存在' });
    res.json({ code: 200, message: '更新成功', data: updated });
});

app.delete('/api/admin/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    await dbStore.deleteResource(id);
    res.json({ code: 200, message: '删除成功' });
});

app.get('/api/admin/db/schema', authenticateToken, requireAdmin, async (req, res) => {
    const schema = await dbStore.getSchema();
    res.json({ code: 200, message: '获取成功', data: schema });
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
    console.log(`💾 数据文件: ${dbStore.DB_FILE}\n`);
});

module.exports = app;
