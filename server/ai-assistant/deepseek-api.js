/**
 * DeepSeek API封装模块
 * AI助理专用 - 与业务代码完全隔离
 * 扩展功能：学习进度诊断、目标拆解、知识点答疑、学习路径生成、学习成果复盘
 */

const https = require('https');

// DeepSeek API配置
const DEEPSEEK_API_URL = 'api.deepseek.com';
const DEEPSEEK_API_PATH = '/chat/completions';
const AI_MODEL = 'deepseek-chat';

/**
 * 固定系统提示词 - 按照业务要求写死
 * 包含扩展功能规则
 */
const SYSTEM_PROMPT = `你是「智荐通」平台的AI学习助理，仅基于用户提供的【用户学习记录】和【平台课程库数据】，提供个性化学习计划、课程推荐服务。

规则：
1. 课程推荐必须使用平台内已有的课程，标注课程名称、分类，说明推荐理由，禁止编造平台外的课程。
2. 学习计划需结合用户已学课程循序渐进，贴合用户当前水平。
3. 输出使用 Markdown 格式，分点清晰，无无关内容。

新增规则：
1. 解答用户问题时，必须优先关联平台内已有的课程、资源，给出具体名称，引导用户在平台内学习。
2. 生成学习计划/路径时，必须按学习优先级排序，标注前置要求和预期成果，确保循序渐进。
3. 分析学习进度时，需明确指出薄弱环节，并给出可落地的补充建议。
4. 仅提供与平台学习相关的服务，超出范围的问题回复："我是你的学习助理，仅能提供平台内学习相关的答疑、计划制定和课程推荐服务~"

## AI助理能力清单

### 1. 学习进度诊断与薄弱点分析
- 自动分析用户的课程完成度、资源学习记录
- 明确指出薄弱知识点，并关联平台内对应的课程/资源
- 示例："你已完成Python基础课程，但`urllib`网络请求相关资源未学习，建议优先补充《Python自动化脚本实战》课程中网页爬取章节"

### 2. 目标拆解与周/日学习计划生成
- 当用户提出学习目标时，自动拆解为可执行的周计划/日任务
- 每个任务必须关联平台内的课程/资源，标注学习时长和预期成果
- 示例："第1周：完成《Python教程》第5-8章，结合`os`/`pathlib`资源掌握文件处理"

### 3. 知识点精准答疑 + 平台资源关联
- 支持用户提问课程相关知识点问题
- 回复时优先使用平台内课程/资源的知识点进行解答
- 附上对应的课程/资源名称，引导用户在平台内深入学习

### 4. 学习路径生成（基于用户目标）
- 当用户提出职业/技能目标时，自动生成平台内的完整学习路径
- 路径需按学习优先级排序，包含课程名称、分类、前置要求和学习顺序
- 示例："先完成《React实战进阶》，再学习《现代UI设计原则》，最后补充《Prompt Engineering提示词》提升开发效率"

### 5. 学习成果复盘（周/月度报告）
- 当用户要求"复盘我的学习进度"时，自动生成报告：
  - 已完成的课程/资源列表
  - 学习时长统计
  - 知识点掌握情况分析
  - 下一步学习建议及对应平台课程推荐

## 输出格式要求
- 使用Markdown格式，分点清晰
- 课程名称使用《课程名称》格式标注
- 代码/知识点使用\`代码\`格式标注
- 保持回复简洁明了，重点突出`;

/**
 * 构建用户学习数据上下文
 * @param {Object} userInfo - 用户信息
 * @param {Array} resources - 平台课程库
 * @param {Array} learningPaths - 用户学习路径
 * @param {Array} completedCourses - 用户已完成课程
 * @param {Array} learningHistory - 用户学习历史记录
 */
function buildContext(userInfo, resources, learningPaths, completedCourses = [], learningHistory = []) {
    const interests = userInfo?.interests?.length > 0 
        ? userInfo.interests.join('、') 
        : '未设置';

    // 构建平台课程库信息（按分类分组）
    const resourcesByCategory = {};
    resources.forEach(r => {
        if (!resourcesByCategory[r.category]) {
            resourcesByCategory[r.category] = [];
        }
        resourcesByCategory[r.category].push(r);
    });

    let resourceList = '';
    for (const [category, items] of Object.entries(resourcesByCategory)) {
        resourceList += `### ${category}\n`;
        items.forEach(r => {
            const tags = r.tags ? `，标签：${r.tags}` : '';
            resourceList += `- ${r.title}（难度：${r.level || '入门'}，时长：${r.duration || '未知'}${tags}）\n`;
        });
        resourceList += '\n';
    }

    // 构建学习路径详情
    const pathList = learningPaths.map(p => {
        const progress = p.progress || 0;
        const statusText = p.status === 'completed' ? '已完成' : 
                          p.status === 'in_progress' ? '进行中' : '未开始';
        const completedItems = p.items ? JSON.parse(p.items).filter(i => i.completed).length : 0;
        const totalItems = p.items ? JSON.parse(p.items).length : 0;
        return `- **${p.title}**（阶段${p.stage}，状态：${statusText}，进度：${progress}%，完成${completedItems}/${totalItems}个任务）`;
    }).join('\n');

    // 构建已完成课程列表
    const completedList = completedCourses.length > 0 
        ? completedCourses.map(c => `- ${c.title || c}（已完成）`).join('\n')
        : '暂无';

    // 构建学习历史统计
    const totalLearningHours = learningHistory.reduce((sum, record) => 
        sum + (record.duration || 0), 0
    );
    const recentCourses = learningHistory
        .slice(0, 5)
        .map(r => `- ${r.courseName || r.resourceName || '未知'}（${r.date || '近期'}，时长${r.duration || 0}小时）`)
        .join('\n');

    return `## 用户学习记录
- 用户名：${userInfo?.username || '未知'}
- 学习等级：${userInfo?.level || '学习新手'}
- 学习目标：${userInfo?.learningGoal || '全栈开发探索者'}
- 兴趣领域：${interests}
- 学习天数：${userInfo?.learningDays || 0}
- 获得积分：${userInfo?.points || 0}
- 获得奖章：${userInfo?.badges || 0}
- 累计学习时长：${totalLearningHours.toFixed(1)}小时

## 用户学习路径
${pathList || '暂无学习路径'}

## 已完成课程
${completedList}

## 近期学习记录
${recentCourses || '暂无'}

## 平台课程库
${resourceList || '暂无课程'}`;
}

/**
 * 创建消息数组
 * @param {string} userMessage - 用户提问
 * @param {Object} userInfo - 用户信息
 * @param {Array} resources - 平台课程库
 * @param {Array} learningPaths - 用户学习路径
 * @param {Array} completedCourses - 用户已完成课程
 * @param {Array} learningHistory - 用户学习历史记录
 */
function createMessages(userMessage, userInfo, resources, learningPaths, completedCourses = [], learningHistory = []) {
    const context = buildContext(userInfo, resources, learningPaths, completedCourses, learningHistory);
    
    return [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `以下是我的学习数据，请基于这些信息回答问题：\n\n${context}\n\n我的问题：${userMessage}` }
    ];
}

/**
 * 调用DeepSeek API
 * @param {Array} messages - 消息数组
 * @param {string} apiKey - API密钥
 */
async function callDeepSeekAPI(messages, apiKey) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: AI_MODEL,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000
        });

        const options = {
            hostname: DEEPSEEK_API_URL,
            port: 443,
            path: DEEPSEEK_API_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 30000 // 30秒超时
        };

        const req = https.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.error) {
                        reject(new Error(response.error.message || 'DeepSeek API错误'));
                    } else {
                        resolve(response.choices?.[0]?.message?.content || '抱歉，暂时无法回答。');
                    }
                } catch (e) {
                    reject(new Error('解析DeepSeek响应失败'));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.on('error', (e) => {
            reject(new Error(`网络请求失败: ${e.message}`));
        });

        req.write(data);
        req.end();
    });
}

/**
 * AI聊天入口
 * @param {string} userMessage - 用户提问
 * @param {Object} userInfo - 用户信息
 * @param {Array} resources - 平台课程库
 * @param {Array} learningPaths - 用户学习路径
 * @param {string} apiKey - DeepSeek API密钥
 * @param {Array} completedCourses - 用户已完成课程（可选）
 * @param {Array} learningHistory - 用户学习历史记录（可选）
 */
async function chat(userMessage, userInfo, resources, learningPaths, apiKey, completedCourses = [], learningHistory = []) {
    if (!apiKey) {
        throw new Error('DeepSeek API密钥未配置');
    }

    if (!userMessage || !userMessage.trim()) {
        throw new Error('消息内容不能为空');
    }

    const messages = createMessages(userMessage, userInfo, resources, learningPaths, completedCourses, learningHistory);
    const answer = await callDeepSeekAPI(messages, apiKey);
    return answer;
}

module.exports = {
    chat,
    SYSTEM_PROMPT
};