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

    const resourceCount = getFirst(db.exec('SELECT COUNT(*) AS c FROM resources')[0])?.c || 0;
    if (resourceCount === 0) {
        const now = new Date().toISOString();
        const stmt = db.prepare('INSERT INTO resources (title, desc, category, icon, emoji, image, color, students, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const seed = [
            { title: 'Python 自动化脚本实战', desc: '学会使用 Python 提高工作效率，涵盖文件处理、网页爬取等。', category: '编程开发', icon: 'terminal', emoji: '🐍', color: 'blue', students: '1.2k' },
            { title: 'Prompt Engineering 提示词工程', desc: '系统学习如何与 AI 对话，获得更精准的输出结果。', category: 'AI 技术', icon: 'messages-square', emoji: '🧠', color: 'indigo', students: '3.5k' },
            { title: '现代 UI 设计原则', desc: '掌握配色、间距、排版等核心 UI 设计技巧。', category: '设计美学', icon: 'palette', emoji: '🎨', color: 'purple', students: '890' },
            { title: 'SQL 数据库优化指南', desc: '深入浅出讲解数据库索引、查询优化与架构设计。', category: '后端技术', icon: 'database', emoji: '🗄️', color: 'emerald', students: '1.5k' },
            { title: 'TypeScript 高级用法', desc: '掌握泛型、类型体操等 TS 进阶技术。', category: '编程开发', icon: 'file-code', emoji: '🟦', color: 'blue', students: '856' },
            { title: '大模型应用开发指南', desc: '基于 LangChain 的 LLM 应用实战手册。', category: 'AI 技术', icon: 'bot', emoji: '🤖', color: 'orange', students: '1.2k' }
        ];
        seed.forEach((r) => stmt.run([r.title, r.desc, r.category, r.icon || null, r.emoji || null, r.image || null, r.color, r.students, now]));
        stmt.free();
    }

    const pathCount = getFirst(db.exec('SELECT COUNT(*) AS c FROM learning_paths')[0])?.c || 0;
    if (pathCount === 0) {
        const now = new Date().toISOString();
        const stmt = db.prepare('INSERT INTO learning_paths (title, stage, status, progress, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        const seed = [
            { title: '前端基础与工程化', stage: 1, status: 'completed', progress: 100, items: ['HTML5/CSS3 进阶', 'ES6+ 核心语法', 'Webpack/Vite 工具'] },
            { title: 'React 实战进阶', stage: 2, status: 'in_progress', progress: 65, items: ['Hooks 深度解析', '状态管理实战', 'React 性能优化'] },
            { title: 'Node.js 后端开发', stage: 3, status: 'pending', progress: null, items: ['Express 基础', '数据库操作', 'RESTful API 设计'] }
        ];
        seed.forEach((p) => stmt.run([p.title, p.stage, p.status, p.progress, JSON.stringify(p.items || []), now]));
        stmt.free();
    }

    const recCount = getFirst(db.exec("SELECT COUNT(*) AS c FROM recommendations")[0])?.c || 0;
    if (recCount === 0) {
        const now = new Date().toISOString();
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

    db.run(
        'INSERT INTO resources (title, desc, category, icon, emoji, image, color, students, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [title, desc, category, icon, emoji, image, color, students, now]
    );
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
        students: patch.students ?? existing.students
    };

    db.run(
        'UPDATE resources SET title = ?, desc = ?, category = ?, icon = ?, emoji = ?, image = ?, color = ?, students = ? WHERE id = ?',
        [next.title, next.desc, next.category, next.icon, next.emoji, next.image, next.color, next.students, id]
    );
    saveIfReady();
    return await getResourceById(id);
}

async function deleteResource(id) {
    await init();
    db.run('DELETE FROM resources WHERE id = ?', [id]);
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
    return queryAll('SELECT * FROM learning_paths ORDER BY stage ASC').map((p) => ({
        ...p,
        items: JSON.parse(p.items_json || '[]')
    }));
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
    listRecommendations
};
