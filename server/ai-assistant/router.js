/**
 * AI助理路由模块
 * 独立封装，不修改任何现有接口代码
 * 新增接口：/api/ai-assistant/chat
 * 
 * 扩展功能支持：
 * 1. 学习进度诊断与薄弱点分析
 * 2. 目标拆解与周/日学习计划生成
 * 3. 知识点精准答疑 + 平台资源关联
 * 4. 学习路径生成（基于用户目标）
 * 5. 学习成果复盘（周/月度报告）
 */

const express = require('express');
const deepseek = require('./deepseek-api');

const router = express.Router();

function normalizeItems(items) {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
        try {
            const parsed = JSON.parse(items);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }
    return [];
}

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
 * 新增独立接口：AI助理聊天
 * POST /api/ai-assistant/chat
 * 
 * 功能：
 * 1. 接收用户提问
 * 2. 读取用户学习数据（仅读取，不修改）
 * 3. 调用DeepSeek API
 * 4. 返回结果
 * 
 * 请求体：
 * {
 *   "message": "用户提问内容"
 * }
 * 
 * 响应：
 * {
 *   "code": 200,
 *   "message": "回复成功",
 *   "data": {
 *     "answer": "AI回复内容",
 *     "timestamp": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.post('/chat', async (req, res) => {
    // 1. 获取请求参数
    const { message } = req.body;
    const { user } = req; // 由JWT中间件注入

    // 2. 参数校验
    if (!message || !message.trim()) {
        return res.status(400).json({ 
            code: 400, 
            message: '消息内容不能为空' 
        });
    }

    // 3. 检查问题是否与学习相关
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

    // 4. 获取API密钥（环境变量配置）
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            code: 500,
            message: 'AI助理暂时无法使用，请稍后再试'
        });
    }

    try {
        // 4. 读取用户学习数据（仅读取，不修改）
        const dbStore = require('../db');
        
        // 获取用户信息
        const userRecord = await dbStore.getUserByUsername(user.username);
        const userInfo = {
            username: userRecord.username,
            level: userRecord.level,
            learningGoal: userRecord.learning_goal,
            interests: JSON.parse(userRecord.interests_json || '[]'),
            points: userRecord.points,
            learningDays: userRecord.learning_days,
            badges: userRecord.badges
        };

        // 获取平台课程库
        const resources = await dbStore.listResources();

        // 获取用户学习路径
        const learningPaths = await dbStore.listLearningPaths();

        // 获取已完成课程列表（从学习路径中提取）
        const completedCourses = [];
        learningPaths.forEach(path => {
            const items = normalizeItems(path.items);
            items.forEach(item => {
                if (item && item.completed && item.title) {
                    completedCourses.push({
                        title: item.title,
                        category: path.title,
                        completedAt: item.completedAt || '近期'
                    });
                }
            });
            // 如果整个路径已完成，将路径本身也作为已完成课程
            if (path.status === 'completed') {
                completedCourses.push({
                    title: path.title,
                    category: '学习路径',
                    completedAt: '已完成'
                });
            }
        });

        // 构建学习历史记录（模拟数据，基于学习路径和用户统计）
        const learningHistory = [];
        let totalDuration = 0;
        learningPaths.forEach(path => {
            const progress = path.progress || 0;
            const estimatedHours = (progress / 100) * (path.hours || 20); // 假设每条路径约20小时
            totalDuration += estimatedHours;
            
            if (progress > 0) {
                learningHistory.push({
                    courseName: path.title,
                    date: '近期',
                    duration: parseFloat(estimatedHours.toFixed(1))
                });
            }
        });
        
        // 添加资源学习记录（如果有浏览记录的话）
        resources.slice(0, 5).forEach((resource, index) => {
            // 模拟部分资源已学习
            if (index < 2) {
                learningHistory.push({
                    resourceName: resource.title,
                    date: '近期',
                    duration: parseFloat((Math.random() * 2 + 0.5).toFixed(1))
                });
            }
        });

        // 5. 调用DeepSeek API（传入扩展数据）
        const answer = await deepseek.chat(
            message,
            userInfo,
            resources,
            learningPaths,
            apiKey,
            completedCourses,
            learningHistory
        );

        // 6. 返回结果
        res.json({
            code: 200,
            message: '回复成功',
            data: {
                answer,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[AI助理] API调用失败:', error);
        // 错误处理：显示友好提示，不暴露内部错误
        res.status(500).json({
            code: 500,
            message: 'AI助理暂时无法回复，请稍后再试'
        });
    }
});

module.exports = router;
