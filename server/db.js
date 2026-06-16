const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data.sqlite');

let SQL = null;
let db = null;

function locateFile(file) {
    return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
}

function toRows(result) {
    if (!result || !result.columns || !result.values) return [];
    return result.values.map((row) => {
        const obj = {};
        result.columns.forEach((col, idx) => {
            obj[col] = row[idx];
        });
        return obj;
    });
}

function getFirst(result) {
    const rows = toRows(result);
    return rows[0] || null;
}

function queryAll(sql, params = []) {
    if (!db) return [];
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

function queryOne(sql, params = []) {
    return queryAll(sql, params)[0] || null;
}

function saveIfReady() {
    if (!db) return;
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function hasColumn(tableName, columnName) {
    const cols = queryAll(`PRAGMA table_info(${JSON.stringify(tableName)})`);
    return cols.some((c) => c.name === columnName);
}

async function init() {
    if (db) return;
    SQL = await initSqlJs({ locateFile });
    if (fs.existsSync(DB_FILE)) {
        const buf = fs.readFileSync(DB_FILE);
        db = new SQL.Database(new Uint8Array(buf));
    } else {
        db = new SQL.Database();
    }

    db.run(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            interests_json TEXT NOT NULL DEFAULT '[]',
            level TEXT NOT NULL DEFAULT '学习新手',
            learning_goal TEXT NOT NULL DEFAULT '全栈开发探索者',
            points INTEGER NOT NULL DEFAULT 0,
            learning_days INTEGER NOT NULL DEFAULT 0,
            badges INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            desc TEXT NOT NULL,
            category TEXT NOT NULL,
            icon TEXT,
            emoji TEXT,
            image TEXT,
            color TEXT NOT NULL,
            students TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS learning_paths (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            stage INTEGER NOT NULL,
            status TEXT NOT NULL,
            progress INTEGER,
            items_json TEXT NOT NULL DEFAULT '[]',
            group_name TEXT NOT NULL DEFAULT '默认分组',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            title TEXT NOT NULL,
            desc TEXT NOT NULL,
            category TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT,
            students TEXT,
            created_at TEXT NOT NULL
        );
    `);

    if (!hasColumn('resources', 'url')) db.run('ALTER TABLE resources ADD COLUMN url TEXT');
    if (!hasColumn('resources', 'outline_json')) db.run("ALTER TABLE resources ADD COLUMN outline_json TEXT NOT NULL DEFAULT '[]'");
    if (!hasColumn('resources', 'provider')) db.run('ALTER TABLE resources ADD COLUMN provider TEXT');
    if (!hasColumn('resources', 'level')) db.run('ALTER TABLE resources ADD COLUMN level TEXT');
    if (!hasColumn('resources', 'duration')) db.run('ALTER TABLE resources ADD COLUMN duration TEXT');
    if (!hasColumn('learning_paths', 'group_name')) db.run("ALTER TABLE learning_paths ADD COLUMN group_name TEXT NOT NULL DEFAULT '默认分组'");

    const now = new Date().toISOString();
    const seedResources = [
        {
            title: 'HTML 入门到实践',
            desc: '从语义化结构到表单与媒体标签，快速补齐网页结构基础。',
            category: '前端基础',
            icon: 'layout-template',
            emoji: '🧱',
            color: 'blue',
            students: '6.8k',
            url: 'https://developer.mozilla.org/zh-CN/docs/Learn/HTML',
            provider: 'MDN',
            level: '入门',
            duration: '4-6 小时',
            outline: [
                { title: 'MDN：学习 HTML', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/HTML' },
                { title: 'MDN：HTML 元素参考', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element' },
                { title: 'MDN：表单基础', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/Forms' }
            ]
        },
        {
            title: 'CSS 布局与响应式',
            desc: '掌握 Flex/Grid、媒体查询与常见布局套路，做出自适应页面。',
            category: '前端基础',
            icon: 'columns-3',
            emoji: '🧩',
            color: 'indigo',
            students: '7.4k',
            url: 'https://developer.mozilla.org/zh-CN/docs/Learn/CSS',
            provider: 'MDN',
            level: '入门-进阶',
            duration: '6-8 小时',
            outline: [
                { title: 'MDN：学习 CSS', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/CSS' },
                { title: 'MDN：Flexbox 指南', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Flexbox' },
                { title: 'MDN：Grid 指南', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/CSS/CSS_layout/Grids' },
                { title: 'MDN：媒体查询', url: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/Media_Queries/Using_media_queries' }
            ]
        },
        {
            title: 'JavaScript 核心语法与思维',
            desc: '变量/函数/对象/数组/作用域/闭包/原型链，打牢 JS 根基。',
            category: '编程开发',
            icon: 'braces',
            emoji: '🟨',
            color: 'amber',
            students: '9.1k',
            url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide',
            provider: 'MDN',
            level: '入门-进阶',
            duration: '8-12 小时',
            outline: [
                { title: 'MDN：JavaScript 指南', url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide' },
                { title: 'MDN：表达式与运算符', url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Expressions_and_operators' },
                { title: 'MDN：对象基础', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Objects' },
                { title: 'javascript.info：现代 JS 教程', url: 'https://javascript.info/' }
            ]
        },
        {
            title: 'DOM 与事件实战',
            desc: '学会选择元素、事件监听、表单处理、动态渲染，做出可交互页面。',
            category: '前端实战',
            icon: 'mouse-pointer-2',
            emoji: '🖱️',
            color: 'blue',
            students: '5.3k',
            url: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Document_Object_Model',
            provider: 'MDN',
            level: '入门',
            duration: '3-5 小时',
            outline: [
                { title: 'MDN：DOM 概览', url: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Document_Object_Model' },
                { title: 'MDN：事件介绍', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Building_blocks/Events' },
                { title: 'MDN：事件目标与冒泡', url: 'https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Building_blocks/Events#%E4%BA%8B%E4%BB%B6%E5%86%92%E6%B3%A1%E4%B8%8E%E6%8D%95%E8%8E%B7' }
            ]
        },
        {
            title: 'Fetch 与前后端联调',
            desc: '掌握 fetch、JSON、错误处理与 Network 面板，提升联调效率。',
            category: '全栈联调',
            icon: 'radar',
            emoji: '🔄',
            color: 'emerald',
            students: '4.9k',
            url: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API',
            provider: 'MDN',
            level: '入门',
            duration: '2-4 小时',
            outline: [
                { title: 'MDN：Fetch API', url: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API' },
                { title: 'MDN：使用 Fetch', url: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API/Using_Fetch' },
                { title: 'Chrome DevTools：Network 面板', url: 'https://developer.chrome.com/docs/devtools/network/' }
            ]
        },
        {
            title: 'Node.js 基础与模块系统',
            desc: '理解事件循环、模块、npm、常用内置模块，打好后端基础。',
            category: '后端技术',
            icon: 'server',
            emoji: '🧠',
            color: 'indigo',
            students: '6.1k',
            url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
            provider: 'Node.js',
            level: '入门',
            duration: '3-6 小时',
            outline: [
                { title: 'Node.js：入门介绍', url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs' },
                { title: 'Node.js：模块系统', url: 'https://nodejs.org/api/modules.html' },
                { title: 'Node.js：文件系统 fs', url: 'https://nodejs.org/api/fs.html' }
            ]
        },
        {
            title: 'Express 官方入门',
            desc: '路由、中间件、静态资源、错误处理，快速搭一个可用 API。',
            category: '后端技术',
            icon: 'route',
            emoji: '🧭',
            color: 'blue',
            students: '8.0k',
            url: 'https://expressjs.com/en/starter/installing.html',
            provider: 'Express',
            level: '入门',
            duration: '3-5 小时',
            outline: [
                { title: 'Express：安装与快速开始', url: 'https://expressjs.com/en/starter/installing.html' },
                { title: 'Express：路由', url: 'https://expressjs.com/en/guide/routing.html' },
                { title: 'Express：中间件', url: 'https://expressjs.com/en/guide/using-middleware.html' },
                { title: 'Express：错误处理', url: 'https://expressjs.com/en/guide/error-handling.html' }
            ]
        },
        {
            title: 'RESTful API 设计清单',
            desc: '理解资源、路径、方法、状态码与分页，写出规范接口。',
            category: '后端技术',
            icon: 'list-checks',
            emoji: '📋',
            color: 'emerald',
            students: '3.7k',
            url: 'https://developer.mozilla.org/zh-CN/docs/Glossary/REST',
            provider: 'MDN',
            level: '入门',
            duration: '2-3 小时',
            outline: [
                { title: 'MDN：REST 术语', url: 'https://developer.mozilla.org/zh-CN/docs/Glossary/REST' },
                { title: 'MDN：HTTP 状态码', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status' },
                { title: 'MDN：HTTP 方法', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Methods' }
            ]
        },
        {
            title: 'SQL 基础（查询/排序/聚合）',
            desc: 'SELECT、WHERE、GROUP BY、JOIN，写出你后台需要的查询。',
            category: '数据库',
            icon: 'database',
            emoji: '🗄️',
            color: 'emerald',
            students: '7.0k',
            url: 'https://www.sqlitetutorial.net/sqlite-select/',
            provider: 'SQLite Tutorial',
            level: '入门',
            duration: '4-6 小时',
            outline: [
                { title: 'SQLite SELECT', url: 'https://www.sqlitetutorial.net/sqlite-select/' },
                { title: 'SQLite WHERE', url: 'https://www.sqlitetutorial.net/sqlite-where/' },
                { title: 'SQLite JOIN', url: 'https://www.sqlitetutorial.net/sqlite-join/' },
                { title: 'SQLite GROUP BY', url: 'https://www.sqlitetutorial.net/sqlite-group-by/' }
            ]
        },
        {
            title: 'SQLite 官方文档速查',
            desc: '了解 SQLite 的数据类型、约束、PRAGMA 与常用语法。',
            category: '数据库',
            icon: 'book-open',
            emoji: '📚',
            color: 'indigo',
            students: '2.9k',
            url: 'https://www.sqlite.org/docs.html',
            provider: 'SQLite',
            level: '入门-进阶',
            duration: '随用随查',
            outline: [
                { title: 'SQLite 文档索引', url: 'https://www.sqlite.org/docs.html' },
                { title: 'SQLite 数据类型', url: 'https://www.sqlite.org/datatype3.html' },
                { title: 'SQLite CREATE TABLE', url: 'https://www.sqlite.org/lang_createtable.html' },
                { title: 'SQLite PRAGMA', url: 'https://www.sqlite.org/pragma.html' }
            ]
        },
        {
            title: 'Git 基础与协作流程',
            desc: '学会 add/commit/pull --rebase/branch，团队协作更顺畅。',
            category: '工程协作',
            icon: 'git-branch',
            emoji: '🌿',
            color: 'orange',
            students: '8.6k',
            url: 'https://git-scm.com/book/zh/v2',
            provider: 'Pro Git',
            level: '入门',
            duration: '6-10 小时',
            outline: [
                { title: 'Pro Git（中文）', url: 'https://git-scm.com/book/zh/v2' },
                { title: '分支基础', url: 'https://git-scm.com/book/zh/v2/Git-%E5%88%86%E6%94%AF-%E5%88%86%E6%94%AF%E7%AE%80%E4%BB%8B' },
                { title: '远程协作', url: 'https://git-scm.com/book/zh/v2/Git-%E5%9C%A8%E6%9C%8D%E5%8A%A1%E5%99%A8%E4%B8%8A-Git-%E8%BF%9C%E7%A8%8B%E4%BB%93%E5%BA%93' }
            ]
        },
        {
            title: 'GitHub 使用速成',
            desc: '仓库、PR、Issues、协作者、README 规范，一次搞懂。',
            category: '工程协作',
            icon: 'github',
            emoji: '🐙',
            color: 'gray',
            students: '5.5k',
            url: 'https://docs.github.com/zh',
            provider: 'GitHub Docs',
            level: '入门',
            duration: '2-4 小时',
            outline: [
                { title: 'GitHub Docs（中文）', url: 'https://docs.github.com/zh' },
                { title: '协作与拉取请求', url: 'https://docs.github.com/zh/pull-requests' },
                { title: 'Issues 与项目管理', url: 'https://docs.github.com/zh/issues' }
            ]
        },
        {
            title: 'HTTP 基础与常见问题',
            desc: '请求/响应、缓存、Cookie、CORS，解决联调疑难杂症。',
            category: '网络基础',
            icon: 'globe',
            emoji: '🌐',
            color: 'blue',
            students: '6.2k',
            url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP',
            provider: 'MDN',
            level: '入门',
            duration: '4-6 小时',
            outline: [
                { title: 'MDN：HTTP 概览', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP' },
                { title: 'MDN：HTTP 头', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers' },
                { title: 'MDN：缓存', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Caching' },
                { title: 'MDN：CORS', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CORS' }
            ]
        },
        {
            title: 'JWT 登录鉴权原理',
            desc: '理解 token 结构、签名、过期与常见安全注意事项。',
            category: '安全与鉴权',
            icon: 'key-round',
            emoji: '🔐',
            color: 'indigo',
            students: '4.1k',
            url: 'https://jwt.io/introduction',
            provider: 'jwt.io',
            level: '入门',
            duration: '1-2 小时',
            outline: [
                { title: 'JWT 介绍', url: 'https://jwt.io/introduction' },
                { title: 'MDN：Authorization 头', url: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Authorization' }
            ]
        },
        {
            title: 'Web 安全基础（OWASP Top 10）',
            desc: '了解常见漏洞与防护点，写后端更安心。',
            category: '安全与鉴权',
            icon: 'shield-check',
            emoji: '🛡️',
            color: 'emerald',
            students: '3.3k',
            url: 'https://owasp.org/www-project-top-ten/',
            provider: 'OWASP',
            level: '入门',
            duration: '2-4 小时',
            outline: [
                { title: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
                { title: 'MDN：XSS', url: 'https://developer.mozilla.org/zh-CN/docs/Glossary/Cross-site_scripting' },
                { title: 'MDN：CSRF', url: 'https://developer.mozilla.org/zh-CN/docs/Glossary/CSRF' }
            ]
        },
        {
            title: 'Chrome DevTools 调试技巧',
            desc: '断点、Network、Console、性能分析，定位问题更快。',
            category: '开发效率',
            icon: 'bug',
            emoji: '🐞',
            color: 'orange',
            students: '5.9k',
            url: 'https://developer.chrome.com/docs/devtools/',
            provider: 'Chrome',
            level: '入门',
            duration: '2-4 小时',
            outline: [
                { title: 'DevTools 总览', url: 'https://developer.chrome.com/docs/devtools/' },
                { title: 'Console', url: 'https://developer.chrome.com/docs/devtools/console/' },
                { title: 'Network', url: 'https://developer.chrome.com/docs/devtools/network/' },
                { title: 'Sources（断点调试）', url: 'https://developer.chrome.com/docs/devtools/javascript/' }
            ]
        },
        {
            title: 'Tailwind CSS 官方快速上手',
            desc: '用实用类快速搭 UI，配合你们项目的 Tailwind 风格。',
            category: '前端实战',
            icon: 'sparkles',
            emoji: '✨',
            color: 'cyan',
            students: '7.2k',
            url: 'https://tailwindcss.com/docs/installation',
            provider: 'Tailwind',
            level: '入门',
            duration: '2-4 小时',
            outline: [
                { title: '安装与使用', url: 'https://tailwindcss.com/docs/installation' },
                { title: '常用样式速查', url: 'https://tailwindcss.com/docs' },
                { title: '布局与 Flex', url: 'https://tailwindcss.com/docs/flex' },
                { title: 'Grid', url: 'https://tailwindcss.com/docs/grid-template-columns' }
            ]
        },
        {
            title: 'Python 自动化脚本实战',
            desc: '学会使用 Python 提高工作效率，涵盖文件处理、网络请求等。',
            category: '编程开发',
            icon: 'terminal',
            emoji: '🐍',
            color: 'blue',
            students: '1.2k',
            url: 'https://docs.python.org/zh-cn/3/tutorial/',
            provider: 'Python Docs',
            level: '入门',
            duration: '6-10 小时',
            outline: [
                { title: 'Python 教程（中文）', url: 'https://docs.python.org/zh-cn/3/tutorial/' },
                { title: '标准库：os', url: 'https://docs.python.org/zh-cn/3/library/os.html' },
                { title: '标准库：pathlib', url: 'https://docs.python.org/zh-cn/3/library/pathlib.html' },
                { title: '标准库：urllib', url: 'https://docs.python.org/zh-cn/3/library/urllib.html' }
            ]
        },
        {
            title: 'Prompt Engineering 提示词工程',
            desc: '学习清晰表达需求、约束输出格式，提高 AI 产出质量。',
            category: 'AI 技术',
            icon: 'messages-square',
            emoji: '🧠',
            color: 'indigo',
            students: '3.5k',
            url: 'https://www.promptingguide.ai/zh',
            provider: 'Prompting Guide',
            level: '入门',
            duration: '2-4 小时',
            outline: [
                { title: '提示词工程指南（中文）', url: 'https://www.promptingguide.ai/zh' },
                { title: '提示词技巧', url: 'https://www.promptingguide.ai/zh/techniques' }
            ]
        },
        {
            title: '现代 UI 设计原则',
            desc: '掌握信息层级、排版、间距与一致性，让页面更“像产品”。',
            category: '设计美学',
            icon: 'palette',
            emoji: '🎨',
            color: 'purple',
            students: '890',
            url: 'https://www.refactoringui.com/',
            provider: 'Refactoring UI',
            level: '入门',
            duration: '随用随查',
            outline: [
                { title: 'Refactoring UI（主页）', url: 'https://www.refactoringui.com/' }
            ]
        },
        {
            title: 'SQL 数据库优化指南',
            desc: '索引、查询优化与建表设计，让后台更快更稳。',
            category: '后端技术',
            icon: 'database',
            emoji: '🗄️',
            color: 'emerald',
            students: '1.5k',
            url: 'https://www.sqlite.org/queryplanner.html',
            provider: 'SQLite',
            level: '进阶',
            duration: '2-4 小时',
            outline: [
                { title: 'SQLite 查询规划器', url: 'https://www.sqlite.org/queryplanner.html' },
                { title: 'SQLite EXPLAIN', url: 'https://www.sqlite.org/lang_explain.html' },
                { title: 'SQLite 索引', url: 'https://www.sqlite.org/lang_createindex.html' }
            ]
        },
        {
            title: 'TypeScript 高级用法',
            desc: '泛型、类型收窄、工具类型，写更可靠的前端代码。',
            category: '编程开发',
            icon: 'file-code',
            emoji: '🟦',
            color: 'blue',
            students: '856',
            url: 'https://www.typescriptlang.org/docs/',
            provider: 'TypeScript',
            level: '进阶',
            duration: '6-10 小时',
            outline: [
                { title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/' },
                { title: 'Utility Types', url: 'https://www.typescriptlang.org/docs/handbook/utility-types.html' }
            ]
        },
        {
            title: 'Postman API 测试入门',
            desc: '学会用 Postman/Collection 测接口，联调效率翻倍。',
            category: '全栈联调',
            icon: 'send',
            emoji: '📮',
            color: 'orange',
            students: '3.9k',
            url: 'https://learning.postman.com/',
            provider: 'Postman',
            level: '入门',
            duration: '2-3 小时',
            outline: [
                { title: 'Postman Learning Center', url: 'https://learning.postman.com/' },
                { title: '发送请求与环境变量', url: 'https://learning.postman.com/docs/sending-requests/requests/' }
            ]
        }
    ];

    const existingTitleRows = queryAll('SELECT title FROM resources');
    const existingTitles = new Set(existingTitleRows.map((r) => r.title));
    const insertStmt = db.prepare(
        'INSERT INTO resources (title, desc, category, icon, emoji, image, color, students, url, outline_json, provider, level, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const updateStmt = db.prepare(
        'UPDATE resources SET url = ?, outline_json = ?, provider = ?, level = ?, duration = ? WHERE title = ?'
    );
    seedResources.forEach((r) => {
        const outlineJson = JSON.stringify(r.outline || []);
        if (!existingTitles.has(r.title)) {
            insertStmt.run([
                r.title,
                r.desc,
                r.category,
                r.icon || null,
                r.emoji || null,
                r.image || null,
                r.color,
                r.students,
                r.url || null,
                outlineJson,
                r.provider || null,
                r.level || null,
                r.duration || null,
                now
            ]);
            return;
        }

        const existing = queryOne('SELECT url, outline_json FROM resources WHERE title = ?', [r.title]);
        const hasUrl = existing && existing.url && String(existing.url).trim().length > 0;
        const hasOutline = existing && existing.outline_json && String(existing.outline_json).trim() !== '[]';
        if (!hasUrl && !hasOutline) {
            updateStmt.run([r.url || null, outlineJson, r.provider || null, r.level || null, r.duration || null, r.title]);
        }
    });
    insertStmt.free();
    updateStmt.free();

    const pathCount = getFirst(db.exec('SELECT COUNT(*) AS c FROM learning_paths')[0])?.c || 0;
    if (pathCount === 0) {
        const stmt = db.prepare('INSERT INTO learning_paths (title, stage, status, progress, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        const seed = [
            // 前端开发路径
            { title: '前端基础与工程化', stage: 1, status: 'pending', progress: 0, items: ['HTML5 语义化与新特性', 'CSS3 布局与动画', 'JavaScript 核心语法', 'Webpack/Vite 工具链'] },
            { title: 'React 实战进阶', stage: 2, status: 'in_progress', progress: 65, items: ['React Hooks 深度解析', 'Redux/Zustand 状态管理', 'React 性能优化', 'Next.js 全栈框架'] },
            { title: 'Vue3 生态系统', stage: 3, status: 'pending', progress: 0, items: ['Vue3 Composition API', 'Pinia 状态管理', 'Vue Router', 'Vite 插件开发'] },
            
            // 后端开发路径
            { title: 'Node.js 后端开发', stage: 1, status: 'pending', progress: 0, items: ['Node.js 核心模块', 'Express 框架', 'MongoDB 数据库', 'RESTful API 设计'] },
            { title: 'Python Web 开发', stage: 2, status: 'pending', progress: 0, items: ['Python 基础语法', 'Django 框架', 'Flask 微服务', '数据处理与分析'] },
            { title: 'Go 语言后端', stage: 3, status: 'pending', progress: 0, items: ['Go 语言基础', 'Gin Web 框架', 'GORM 数据库', '微服务架构'] },
            
            // 全栈开发路径
            { title: '全栈开发工程师', stage: 1, status: 'pending', progress: 0, items: ['前端基础', '后端基础', '数据库设计', '部署与运维'] },
            { title: 'DevOps 与云原生', stage: 2, status: 'pending', progress: 0, items: ['Docker 容器化', 'Kubernetes 编排', 'CI/CD 流水线', '监控与日志'] },
            
            // AI/ML 路径
            { title: 'Python 机器学习入门', stage: 1, status: 'pending', progress: 0, items: ['Python 数据分析', 'NumPy/Pandas', 'Scikit-learn', '机器学习基础'] },
            { title: '深度学习与应用', stage: 2, status: 'pending', progress: 0, items: ['TensorFlow/PyTorch', '神经网络基础', '计算机视觉', '自然语言处理'] },
            
            // 移动开发路径
            { title: '移动端开发入门', stage: 1, status: 'pending', progress: 0, items: ['React Native 基础', 'Flutter 框架', '跨平台开发', '应用发布'] }
        ];
        seed.forEach((p) => stmt.run([p.title, p.stage, p.status, p.progress, JSON.stringify(p.items || []), now]));
        stmt.free();
    }

    const recCount = getFirst(db.exec("SELECT COUNT(*) AS c FROM recommendations")[0])?.c || 0;
    if (recCount === 0) {
        const stmt = db.prepare('INSERT INTO recommendations (scope, title, desc, category, color, icon, students, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const seed = [
            { scope: 'personal', title: '机器学习在金融领域的应用', desc: '深入探讨如何利用 AI 模型进行股票预测、风险评估及反欺诈分析。', category: '基于你的兴趣', color: 'blue', icon: 'brain', students: '4.8k' },
            { scope: 'home', title: '系统架构师核心素养', desc: '从代码编写到架构设计，掌握大型分布式系统的设计原则与权衡点。', category: '热门内容', color: 'indigo', icon: 'layers', students: '2.1k' }
        ];
        seed.forEach((r) => stmt.run([r.scope, r.title, r.desc, r.category, r.color, r.icon || null, r.students || null, now]));
        stmt.free();
    }

    const adminUser = queryOne('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
        const now = new Date().toISOString();
        const password = process.env.ADMIN_PASSWORD || 'admin123456';
        const hash = await bcrypt.hash(password, 10);
        const id = uuidv4();
        db.run(
            'INSERT INTO users (id, username, email, password_hash, role, interests_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, 'admin', 'admin@local', hash, 'admin', '[]', now]
        );
    }

    saveIfReady();
}

async function getUserByUsername(username) {
    await init();
    return queryOne('SELECT * FROM users WHERE username = ?', [username]);
}

async function createUser({ username, email, passwordHash, interests = [], role = 'user' }) {
    await init();
    const now = new Date().toISOString();
    const id = uuidv4();
    db.run(
        'INSERT INTO users (id, username, email, password_hash, role, interests_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, username, email, passwordHash, role, JSON.stringify(interests || []), now]
    );
    saveIfReady();
    return { id, username, email };
}

async function updateUserInfo(username, patch = {}) {
    await init();
    const existing = await getUserByUsername(username);
    if (!existing) return null;

    const next = {
        level: patch.level ?? existing.level,
        points: patch.points ?? existing.points,
        learning_days: patch.learningDays ?? existing.learning_days,
        badges: patch.badges ?? existing.badges,
        learning_goal: patch.learningGoal ?? existing.learning_goal,
        interests_json: patch.interests ? JSON.stringify(patch.interests) : existing.interests_json
    };

    db.run(
        'UPDATE users SET level = ?, points = ?, learning_days = ?, badges = ?, learning_goal = ?, interests_json = ? WHERE username = ?',
        [next.level, next.points, next.learning_days, next.badges, next.learning_goal, next.interests_json, username]
    );
    saveIfReady();
    return await getUserByUsername(username);
}

async function listResources() {
    await init();
    return queryAll('SELECT * FROM resources ORDER BY id ASC');
}

async function createResource(payload) {
    await init();
    const now = new Date().toISOString();
    const title = payload.title || '';
    const desc = payload.desc || '';
    const category = payload.category || '未分类';
    const icon = payload.icon || null;
    const emoji = payload.emoji || null;
    const image = payload.image || null;
    const color = payload.color || 'blue';
    const students = payload.students || '0';
    const url = payload.url || null;
    const outline_json = payload.outline ? JSON.stringify(payload.outline) : (payload.outline_json || '[]');
    const provider = payload.provider || null;
    const level = payload.level || null;
    const duration = payload.duration || null;

    const stmt = db.prepare('INSERT INTO resources (title, desc, category, icon, emoji, image, color, students, url, outline_json, provider, level, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.bind([title, desc, category, icon, emoji, image, color, students, url, outline_json, provider, level, duration, now]);
    stmt.step();
    stmt.free();
    const row = queryOne('SELECT last_insert_rowid() AS id');
    saveIfReady();
    return await getResourceById(row.id);
}

async function updateResource(id, patch = {}) {
    await init();
    const existing = await getResourceById(id);
    if (!existing) return null;

    const next = {
        title: patch.title ?? existing.title,
        desc: patch.desc ?? existing.desc,
        category: patch.category ?? existing.category,
        icon: patch.icon ?? existing.icon,
        emoji: patch.emoji ?? existing.emoji,
        image: patch.image ?? existing.image,
        color: patch.color ?? existing.color,
        students: patch.students ?? existing.students,
        url: patch.url ?? existing.url,
        outline_json: patch.outline ? JSON.stringify(patch.outline) : (patch.outline_json ?? existing.outline_json ?? '[]'),
        provider: patch.provider ?? existing.provider,
        level: patch.level ?? existing.level,
        duration: patch.duration ?? existing.duration
    };

    const stmt = db.prepare('UPDATE resources SET title = ?, desc = ?, category = ?, icon = ?, emoji = ?, image = ?, color = ?, students = ?, url = ?, outline_json = ?, provider = ?, level = ?, duration = ? WHERE id = ?');
    stmt.bind([next.title, next.desc, next.category, next.icon, next.emoji, next.image, next.color, next.students, next.url, next.outline_json, next.provider, next.level, next.duration, id]);
    stmt.step();
    stmt.free();
    saveIfReady();
    return await getResourceById(id);
}

async function deleteResource(id) {
    await init();
    const stmt = db.prepare('DELETE FROM resources WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    stmt.free();
    saveIfReady();
}

async function listUsers() {
    await init();
    return queryAll('SELECT id, username, email, role, level, learning_goal, points, learning_days, badges, created_at FROM users ORDER BY created_at DESC');
}

async function getSchema() {
    await init();
    const tables = queryAll(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
    );

    const enriched = tables.map((t) => {
        const columns = queryAll(`PRAGMA table_info(${JSON.stringify(t.name)})`);
        return {
            name: t.name,
            sql: t.sql,
            columns: columns.map((c) => ({
                cid: c.cid,
                name: c.name,
                type: c.type,
                notnull: c.notnull,
                dflt_value: c.dflt_value,
                pk: c.pk
            }))
        };
    });

    return { tables: enriched };
}

async function getResourceById(id) {
    await init();
    return queryOne('SELECT * FROM resources WHERE id = ?', [id]);
}

async function listLearningPaths() {
    await init();
    return queryAll('SELECT * FROM learning_paths ORDER BY stage ASC').map((p) => {
        let items = [];
        try {
            items = JSON.parse(p.items_json || '[]');
            // 兼容旧数据格式：字符串数组转对象数组
            if (items.length > 0 && typeof items[0] === 'string') {
                items = items.map(text => ({ text, completed: false }));
            }
        } catch (e) {
            items = [];
        }
        return { ...p, items };
    });
}

async function listLearningPathGroups() {
    await init();
    const rows = queryAll('SELECT DISTINCT group_name FROM learning_paths ORDER BY group_name ASC');
    // 确保"默认分组"始终存在
    const groups = rows.map(r => r.group_name);
    if (!groups.includes('默认分组')) {
        groups.unshift('默认分组');
    }
    return groups;
}

async function deleteLearningPathGroup(groupName) {
    await init();
    if (groupName === '默认分组') {
        throw new Error('无法删除默认分组');
    }
    
    // 将该分组下的所有学习路径移至默认分组
    const stmt = db.prepare('UPDATE learning_paths SET group_name = ? WHERE group_name = ?');
    stmt.bind(['默认分组', groupName]);
    stmt.step();
    stmt.free();
    saveIfReady();
    
    return true;
}

async function getLearningPathById(id) {
    await init();
    const path = queryOne('SELECT * FROM learning_paths WHERE id = ?', [id]);
    if (!path) return null;
    
    let items = [];
    try {
        items = JSON.parse(path.items_json || '[]');
        // 兼容旧数据格式：字符串数组转对象数组
        if (items.length > 0 && typeof items[0] === 'string') {
            items = items.map(text => ({ text, completed: false }));
        }
    } catch (e) {
        items = [];
    }
    
    return { ...path, items };
}

async function createLearningPath(payload) {
    await init();
    const now = new Date().toISOString();
    console.log('createLearningPath called with payload:', payload);
    
    // 处理 items：字符串数组转对象数组
    let items = payload.items || [];
    if (items.length > 0 && typeof items[0] === 'string') {
        items = items.map(text => ({ text, completed: false }));
    }
    
    const stmt = db.prepare(`
        INSERT INTO learning_paths (title, stage, status, progress, items_json, group_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const params = [
        payload.title,
        payload.stage !== undefined ? payload.stage : 1,
        payload.status || 'pending',
        0, // 初始进度为0
        JSON.stringify(items),
        payload.group_name || '默认分组',
        now
    ];
    
    console.log('Executing INSERT with params:', params);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    saveIfReady();
    
    const row = queryOne('SELECT last_insert_rowid() AS id');
    console.log('New learning path created, lastId:', row.id);
    return await getLearningPathById(row.id);
}

async function updateLearningPath(id, payload) {
    await init();
    const now = new Date().toISOString();
    
    const existingPath = await getLearningPathById(id);
    if (!existingPath) return null;
    
    // 只有在明确要设置新状态时才处理状态切换
    if (payload.status === 'in_progress') {
        const updateStmt = db.prepare('UPDATE learning_paths SET status = CASE WHEN status = "in_progress" THEN "pending" ELSE status END');
        updateStmt.step();
        updateStmt.free();
    }
    
    const stmt = db.prepare(`
        UPDATE learning_paths 
        SET title = ?, stage = ?, status = ?, progress = ?, items_json = ?, group_name = ?
        WHERE id = ?
    `);
    
    // 准备更新参数
    const newTitle = payload.title !== undefined ? payload.title : existingPath.title;
    const newStage = payload.stage !== undefined ? payload.stage : existingPath.stage;
    const newStatus = payload.status !== undefined ? payload.status : existingPath.status;
    // 只有当 payload.progress 明确存在时才更新，否则保持原样
    const newProgress = payload.progress !== undefined ? payload.progress : existingPath.progress;
    const newItemsJson = payload.items !== undefined ? JSON.stringify(payload.items) : existingPath.items_json;
    const newGroupName = payload.group_name !== undefined ? payload.group_name : existingPath.group_name;
    
    stmt.bind([
        newTitle,
        newStage,
        newStatus,
        newProgress,
        newItemsJson,
        newGroupName,
        id
    ]);
    stmt.step();
    stmt.free();
    saveIfReady();
    
    return await getLearningPathById(id);
}

async function deleteLearningPath(id) {
    await init();
    const stmt = db.prepare('DELETE FROM learning_paths WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    stmt.free();
    saveIfReady();
    return true;
}

async function toggleLearningPathItem(id, itemIndex) {
    await init();
    const existingPath = await getLearningPathById(id);
    if (!existingPath) return null;
    
    // 切换项目完成状态
    if (existingPath.items[itemIndex]) {
        existingPath.items[itemIndex].completed = !existingPath.items[itemIndex].completed;
    }
    
    // 计算新的进度
    const totalItems = existingPath.items.length;
    const completedItems = existingPath.items.filter(item => item.completed).length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    // 确定新状态
    let newStatus = existingPath.status;
    if (progress === 100) {
        newStatus = 'completed';
    } else if (progress > 0 && existingPath.status === 'pending') {
        newStatus = 'in_progress';
    } else if (progress === 0 && existingPath.status !== 'pending') {
        newStatus = 'pending';
    }
    
    const stmt = db.prepare('UPDATE learning_paths SET status = ?, progress = ?, items_json = ? WHERE id = ?');
    stmt.bind([newStatus, progress, JSON.stringify(existingPath.items), id]);
    stmt.step();
    stmt.free();
    saveIfReady();
    
    return await getLearningPathById(id);
}

async function updateLearningPathStatus(id, status, progress = null) {
    await init();
    if (status === 'in_progress') {
        const updateStmt = db.prepare('UPDATE learning_paths SET status = CASE WHEN status = "in_progress" THEN "pending" ELSE status END');
        updateStmt.step();
        updateStmt.free();
    }
    const stmt = db.prepare('UPDATE learning_paths SET status = ?, progress = ? WHERE id = ?');
    stmt.bind([status, progress, id]);
    stmt.step();
    stmt.free();
    saveIfReady();
    return await getLearningPathById(id);
}

async function listRecommendations(scope) {
    await init();
    return queryAll('SELECT * FROM recommendations WHERE scope = ? ORDER BY id ASC', [scope]);
}

module.exports = {
    init,
    DB_FILE,
    getUserByUsername,
    createUser,
    updateUserInfo,
    listResources,
    createResource,
    updateResource,
    deleteResource,
    listUsers,
    getSchema,
    getResourceById,
    listLearningPaths,
    listLearningPathGroups,
    getLearningPathById,
    createLearningPath,
    updateLearningPath,
    deleteLearningPath,
    updateLearningPathStatus,
    toggleLearningPathItem,
    deleteLearningPathGroup,
    listRecommendations
};
