const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(ROOT, 'public', 'roadshow-shots');
const OUTPUT_DIR = path.join(ROOT, 'public', 'downloads');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'zhijiantong-roadshow.pptx');

const COLORS = {
  bg: '0B1220',
  panel: 'FFFFFF',
  ink: '0F172A',
  muted: '475569',
  line: 'E2E8F0',
  brand: '2563EB',
  brand2: '4F46E5',
  soft: 'EFF6FF',
  white: 'FFFFFF',
};

const FONT = 'Microsoft YaHei';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return filePath;
}

function img(name) {
  return assertFile(path.join(SHOTS_DIR, name));
}

function addPanel(slide) {
  slide.background = { color: COLORS.bg };
  slide.addShape('roundRect', {
    x: 0.25,
    y: 0.25,
    w: 12.83,
    h: 7.0,
    rectRadius: 0.15,
    line: { color: '9AA4B2', transparency: 65, pt: 1 },
    fill: { color: COLORS.panel },
  });
  slide.addText('', {
    x: 0.25,
    y: 0.25,
    w: 12.83,
    h: 7.0,
    line: { color: '000000', transparency: 100, pt: 0 },
    fill: { color: COLORS.panel, transparency: 100 },
    shadow: { type: 'outer', color: '000000', blur: 2, angle: 45, distance: 2, opacity: 0.15 },
  });
}

function addHeader(slide, title, subtitle, tag, tagFill) {
  slide.addText(title, {
    x: 0.7,
    y: 0.52,
    w: 7.4,
    h: 0.35,
    fontFace: FONT,
    fontSize: 22,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText(subtitle, {
    x: 0.7,
    y: 0.9,
    w: 9.5,
    h: 0.3,
    fontFace: FONT,
    fontSize: 9,
    color: COLORS.muted,
    margin: 0,
  });
  slide.addShape('roundRect', {
    x: 11.1,
    y: 0.58,
    w: 1.1,
    h: 0.38,
    rectRadius: 0.12,
    line: { color: tagFill || COLORS.brand, transparency: 100, pt: 0 },
    fill: { color: tagFill || COLORS.brand },
  });
  slide.addText(tag, {
    x: 11.1,
    y: 0.65,
    w: 1.1,
    h: 0.16,
    align: 'center',
    fontFace: FONT,
    fontSize: 9,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  slide.addShape('line', {
    x: 0.55,
    y: 1.24,
    w: 11.98,
    h: 0,
    line: { color: COLORS.line, pt: 1 },
  });
}

function addFooter(slide, hint, page) {
  slide.addShape('line', {
    x: 0.55,
    y: 6.62,
    w: 11.98,
    h: 0,
    line: { color: COLORS.line, pt: 1 },
  });
  slide.addText(hint, {
    x: 0.7,
    y: 6.72,
    w: 8.8,
    h: 0.2,
    fontFace: FONT,
    fontSize: 8,
    color: '64748B',
    margin: 0,
  });
  slide.addText(page, {
    x: 11.0,
    y: 6.7,
    w: 1.1,
    h: 0.2,
    fontFace: FONT,
    fontSize: 8,
    bold: true,
    color: '334155',
    align: 'right',
    margin: 0,
  });
}

function addCard(slide, cfg) {
  slide.addShape('roundRect', {
    x: cfg.x,
    y: cfg.y,
    w: cfg.w,
    h: cfg.h,
    rectRadius: 0.1,
    line: { color: cfg.lineColor || COLORS.line, pt: 1 },
    fill: { color: cfg.fill || COLORS.panel },
  });
  slide.addText(cfg.title, {
    x: cfg.x + 0.18,
    y: cfg.y + 0.12,
    w: cfg.w - 0.36,
    h: 0.22,
    fontFace: FONT,
    fontSize: 12,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });

  if (cfg.bullets && cfg.bullets.length) {
    const lines = [];
    cfg.bullets.forEach((text, index) => {
      lines.push({
        text,
        options: {
          bullet: { indent: 10 },
          breakLine: index < cfg.bullets.length - 1,
        },
      });
    });
    slide.addText(lines, {
      x: cfg.x + 0.18,
      y: cfg.y + 0.48,
      w: cfg.w - 0.36,
      h: cfg.h - 0.6,
      fontFace: FONT,
      fontSize: 10,
      color: COLORS.muted,
      valign: 'top',
      breakLine: false,
      paraSpaceAfterPt: 6,
      margin: 0,
    });
  }

  if (cfg.body) {
    slide.addText(cfg.body, {
      x: cfg.x + 0.18,
      y: cfg.y + 0.48,
      w: cfg.w - 0.36,
      h: cfg.h - 0.6,
      fontFace: FONT,
      fontSize: 10,
      color: COLORS.muted,
      valign: 'top',
      margin: 0,
      fit: 'shrink',
    });
  }

  if (cfg.note) {
    slide.addShape('roundRect', {
      x: cfg.x + 0.18,
      y: cfg.y + cfg.h - 0.75,
      w: cfg.w - 0.36,
      h: 0.45,
      rectRadius: 0.08,
      line: { color: 'CBD5E1', pt: 1, dash: 'dash' },
      fill: { color: 'F8FAFC' },
    });
    slide.addText(cfg.note, {
      x: cfg.x + 0.3,
      y: cfg.y + cfg.h - 0.62,
      w: cfg.w - 0.6,
      h: 0.18,
      fontFace: FONT,
      fontSize: 8.5,
      color: COLORS.muted,
      margin: 0,
      fit: 'shrink',
    });
  }
}

function addBulletBlock(slide, x, y, w, h, bullets, fontSize = 10) {
  const lines = [];
  bullets.forEach((text, index) => {
    lines.push({
      text,
      options: {
        bullet: { indent: 10 },
        breakLine: index < bullets.length - 1,
      },
    });
  });
  slide.addText(lines, {
    x,
    y,
    w,
    h,
    fontFace: FONT,
    fontSize,
    color: COLORS.muted,
    valign: 'top',
    paraSpaceAfterPt: 6,
    margin: 0,
  });
}

function addSingleImage(slide, imagePath, x, y, w, h, caption) {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    rectRadius: 0.1,
    line: { color: '94A3B8', pt: 1, dash: 'dash' },
    fill: { color: 'F8FAFC' },
  });
  slide.addImage({
    path: imagePath,
    x: x + 0.12,
    y: y + 0.12,
    w: w - 0.24,
    h: h - 0.34,
    sizing: { type: 'contain', x: x + 0.12, y: y + 0.12, w: w - 0.24, h: h - 0.34 },
  });
  if (caption) {
    slide.addText(caption, {
      x: x + 0.16,
      y: y + h - 0.18,
      w: w - 0.32,
      h: 0.12,
      fontFace: FONT,
      fontSize: 7.5,
      color: '64748B',
      margin: 0,
    });
  }
}

function addDualImages(slide, leftPath, rightPath, x, y, w, h) {
  const gap = 0.12;
  const itemW = (w - gap) / 2;
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    rectRadius: 0.1,
    line: { color: '94A3B8', pt: 1, dash: 'dash' },
    fill: { color: 'F8FAFC' },
  });
  [leftPath, rightPath].forEach((imagePath, index) => {
    const itemX = x + 0.12 + index * (itemW + gap);
    slide.addShape('roundRect', {
      x: itemX,
      y: y + 0.12,
      w: itemW - 0.12,
      h: h - 0.24,
      rectRadius: 0.08,
      line: { color: 'E2E8F0', pt: 1 },
      fill: { color: 'FFFFFF' },
    });
    slide.addImage({
      path: imagePath,
      x: itemX + 0.06,
      y: y + 0.18,
      w: itemW - 0.24,
      h: h - 0.36,
      sizing: { type: 'contain', x: itemX + 0.06, y: y + 0.18, w: itemW - 0.24, h: h - 0.36 },
    });
  });
}

function addKpi(slide, x, label, value) {
  slide.addShape('roundRect', {
    x,
    y: 1.65,
    w: 3.78,
    h: 0.95,
    rectRadius: 0.1,
    line: { color: COLORS.line, pt: 1 },
    fill: { color: COLORS.panel },
  });
  slide.addText(value, {
    x: x + 0.18,
    y: 1.83,
    w: 1.5,
    h: 0.22,
    fontFace: FONT,
    fontSize: 20,
    bold: true,
    color: COLORS.brand,
    margin: 0,
  });
  slide.addText(label, {
    x: x + 0.18,
    y: 2.15,
    w: 3.3,
    h: 0.16,
    fontFace: FONT,
    fontSize: 8.5,
    color: COLORS.muted,
    margin: 0,
  });
}

function addPill(slide, x, y, w, text) {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h: 0.28,
    rectRadius: 0.12,
    line: { color: '94A3B8', pt: 1 },
    fill: { color: 'FFFFFF', transparency: 10 },
  });
  slide.addText(text, {
    x: x + 0.08,
    y: y + 0.06,
    w: w - 0.16,
    h: 0.1,
    fontFace: FONT,
    fontSize: 8,
    bold: true,
    color: COLORS.ink,
    align: 'center',
    margin: 0,
    fit: 'shrink',
  });
}

function buildPresentation() {
  const deck = new PptxGenJS();
  deck.layout = 'LAYOUT_WIDE';
  deck.author = 'TRAE';
  deck.company = '智荐通';
  deck.subject = '智荐通课程项目路演';
  deck.title = '智荐通路演 PPT';
  deck.lang = 'zh-CN';
  deck.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
    lang: 'zh-CN',
  };
  deck.defineLayout({ name: 'ZHJ_WIDE', width: 13.333, height: 7.5 });
  deck.layout = 'ZHJ_WIDE';

  const cover = deck.addSlide();
  addPanel(cover);
  cover.addText('智荐通', {
    x: 0.72,
    y: 0.52,
    w: 2.2,
    h: 0.32,
    fontFace: FONT,
    fontSize: 26,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  cover.addText('资源库 + 学习路径 + DeepSeek AI 学习助理｜课程项目路演', {
    x: 0.72,
    y: 0.9,
    w: 7.4,
    h: 0.22,
    fontFace: FONT,
    fontSize: 9,
    color: COLORS.muted,
    margin: 0,
  });
  cover.addShape('roundRect', {
    x: 10.8,
    y: 0.58,
    w: 1.55,
    h: 0.42,
    rectRadius: 0.14,
    line: { color: COLORS.brand, transparency: 100, pt: 0 },
    fill: { color: COLORS.brand2 },
  });
  cover.addText('Roadshow', {
    x: 10.8,
    y: 0.67,
    w: 1.55,
    h: 0.12,
    align: 'center',
    fontFace: FONT,
    fontSize: 9,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  cover.addShape('line', {
    x: 0.55,
    y: 1.24,
    w: 11.98,
    h: 0,
    line: { color: COLORS.line, pt: 1 },
  });
  cover.addText('做一个真正能学的“学习平替”平台', {
    x: 0.8,
    y: 1.55,
    w: 9.5,
    h: 0.9,
    fontFace: FONT,
    fontSize: 28,
    bold: true,
    color: COLORS.ink,
    margin: 0,
    fit: 'shrink',
  });
  cover.addText('面向软件学习场景：把碎片化资源整理成可学的内容，把学习路径做成可跟踪的进度，再用 AI 把“答疑、出题、推荐、计划”串起来。', {
    x: 0.8,
    y: 2.65,
    w: 10.5,
    h: 0.55,
    fontFace: FONT,
    fontSize: 12,
    color: COLORS.muted,
    margin: 0,
    fit: 'shrink',
  });
  addPill(cover, 0.82, 3.3, 1.55, '课程：Web 应用开发');
  addPill(cover, 2.47, 3.3, 1.2, '小组：4 人协作');
  addPill(cover, 3.77, 3.3, 3.1, '技术栈：原生 JS + Node/Express + SQLite + DeepSeek');
  addPill(cover, 6.97, 3.3, 1.3, '日期：____ / ____');
  addSingleImage(
    cover,
    img('01-dashboard.png'),
    0.8,
    3.85,
    11.6,
    2.35,
    '截图说明：发现中心（展示侧边栏、资源列表与整体风格）。'
  );
  addFooter(cover, '直接打开即可放映，也可继续在 PPT 里按需微调。', '1 / 10');

  const bg = deck.addSlide();
  addPanel(bg);
  addHeader(bg, '选题背景与意义', '一句话痛点 + 一句话目标 + 一句话价值（老师建议一页就够）', '背景', COLORS.brand);
  addCard(bg, {
    x: 0.75, y: 1.55, w: 3.72, h: 1.45,
    title: '痛点：资源多但难学',
    bullets: ['资料太多，筛选成本高', '学到哪了不清楚，容易中断', '通用 AI 不懂你的课程库和学习进度'],
  });
  addCard(bg, {
    x: 4.78, y: 1.55, w: 3.72, h: 1.45,
    title: '目标：做一体化学习平替',
    fill: COLORS.soft,
    lineColor: 'BFD7FF',
    bullets: ['资源库：真实可学内容（链接 + 大纲）', '学习路径：阶段化拆解 + 进度追踪', 'AI 助理：答疑/推荐/出题/计划'],
  });
  addCard(bg, {
    x: 8.81, y: 1.55, w: 3.72, h: 1.45,
    title: '价值：更省心、更可持续',
    bullets: ['减少“找资料”的时间', '把学习过程变成可执行的步骤', '把 AI 变成“懂你数据”的学习助手'],
  });
  addSingleImage(bg, img('01-dashboard.png'), 0.75, 3.25, 11.78, 3.0, '可在答辩时口头标注：资源中心 / 学习路径 / 智能助理。');
  addFooter(bg, '讲法：30 秒讲完，别铺太多字。', '2 / 10');

  const team = deck.addSlide();
  addPanel(team);
  addHeader(team, '团队介绍与分工', '建议一页：谁负责什么 + 有哪些可展示的产出', '团队', '3B82F6');
  addCard(team, {
    x: 0.82, y: 1.62, w: 5.65, h: 3.75,
    title: '分工（按模块）',
    bullets: [
      '成员 A（前端）：资源库、学习路径交互、快速访问、UI 统一风格',
      '成员 B（后端）：Express API、鉴权与安全、推荐接口、AI 代理接口',
      '成员 C（数据库）：SQLite(sql.js) 表结构、初始化与种子数据、字段扩展',
      '成员 D（AI）：DeepSeek 接入、提示词规则、练习题/计划/推荐能力迭代',
    ],
  });
  addCard(team, {
    x: 6.78, y: 1.62, w: 5.75, h: 3.75,
    title: '协作方式',
    fill: COLORS.soft,
    lineColor: 'BFD7FF',
    bullets: [
      'GitHub 协作：分支/拉取、冲突处理、代码同步',
      '接口先行：前后端按 API 对齐联调',
      '每周迭代：功能可用 -> 体验优化 -> AI 能力完善',
    ],
    note: '把成员 A/B/C/D 替换成真实姓名与分工即可。',
  });
  addFooter(team, '讲法：每人一句话，最后强调“对齐 API 联调”。', '3 / 10');

  const arch = deck.addSlide();
  addPanel(arch);
  addHeader(arch, '系统整体架构', '前端 SPA + 后端 API + 数据库 + DeepSeek（通过后端代理）', '架构', COLORS.brand2);
  addKpi(arch, 0.78, '原生 JavaScript + Tailwind + Lucide', 'SPA');
  addKpi(arch, 4.78, 'Node.js + Express · JWT 鉴权', 'API');
  addKpi(arch, 8.78, 'SQLite（sql.js）· 初始化种子数据', 'DB');
  addCard(arch, {
    x: 0.82, y: 2.95, w: 5.55, h: 2.75,
    title: '数据流（讲清楚即可）',
    bullets: [
      '登录后前端携带 Token 调用 API',
      '资源 / 路径 / 推荐从 SQLite 读取',
      'AI：后端拼接用户学习上下文 -> 调用 DeepSeek -> 返回纯文本',
    ],
  });
  addSingleImage(arch, img('06-recommend.png'), 6.62, 2.95, 5.9, 2.75, '智能推荐页：用于讲“前端 -> 后端 -> 数据库 / AI”的数据流与落地效果。');
  addFooter(arch, '讲法：强调“DeepSeek 不直连前端，走后端代理更安全”。', '4 / 10');

  const lib = deck.addSlide();
  addPanel(lib);
  addHeader(lib, '核心功能一：资源库（可学的内容）', '不是摆设：每条资源有真实链接 + 学习大纲 + 可点击详情', '功能', COLORS.brand);
  addCard(lib, {
    x: 0.82, y: 1.72, w: 4.45, h: 3.95,
    title: '我们做到了什么',
    bullets: [
      '资源规模：100+（目前 120 条）',
      '每条资源：标题 / 分类 / 提供方 / 学习时长 / 链接 / 大纲',
      '分类筛选：按真实数据动态生成，避免“假分类”',
      '封面统一：自动生成 SVG 图案，每条不重复',
    ],
  });
  addDualImages(lib, img('02-library.png'), img('03-resource-modal.png'), 5.55, 1.72, 6.95, 3.95);
  addFooter(lib, '讲法：强调“可点击、可学习”，别只讲 UI。', '5 / 10');

  const pathSlide = deck.addSlide();
  addPanel(pathSlide);
  addHeader(pathSlide, '核心功能二：学习路径（阶段 + 进度）', '把“学什么、学到哪”做成可视化，并能直达对应资源', '功能', COLORS.brand);
  addCard(pathSlide, {
    x: 0.82, y: 1.72, w: 4.45, h: 3.95,
    title: '交互亮点',
    bullets: [
      '阶段化展示：每条路径拆成多个学习条目',
      '进度映射：进度百分比映射到“已学 / 正在学 / 待学”',
      '点击条目：直接打开最匹配的具体资源（如状态管理 -> React 状态管理进阶）',
      '详情弹窗：提示下一步学什么 + 一键继续学习',
    ],
  });
  addDualImages(pathSlide, img('04-learning-paths.png'), img('05-path-progress-modal.png'), 5.55, 1.72, 6.95, 3.95);
  addFooter(pathSlide, '讲法：把“可执行”说清楚，点一下就能继续学。', '6 / 10');

  const rec = deck.addSlide();
  addPanel(rec);
  addHeader(rec, '核心功能三：智能推荐 + 快速访问', '兴趣标签驱动推荐，最近学习可追溯、可跳转', '功能', COLORS.brand);
  addCard(rec, {
    x: 0.82, y: 1.7, w: 5.5, h: 1.7,
    title: '推荐逻辑（不夸张，讲清楚即可）',
    bullets: [
      '注册时填写兴趣标签',
      '后端按兴趣与资源标题 / 分类 / 描述匹配，返回 3-4 条可点推荐',
      '猜你喜欢同样来自真实资源库，点击能进详情',
    ],
  });
  addCard(rec, {
    x: 6.55, y: 1.7, w: 5.95, h: 1.7,
    title: '快速访问（更像真实产品）',
    fill: COLORS.soft,
    lineColor: 'BFD7FF',
    bullets: [
      '最近学习：记录你点击过的资源，重新登录也能继续',
      '关注标签：点击标签直接跳到相关资源',
    ],
  });
  addDualImages(rec, img('06-recommend.png'), img('07-quick-access.png'), 0.82, 3.7, 11.68, 2.55);
  addFooter(rec, '讲法：强调“点击能动、不是摆设”。', '7 / 10');

  const ai = deck.addSlide();
  addPanel(ai);
  addHeader(ai, 'AI 功能实现（DeepSeek）', '不是简单聊天：结合学习数据上下文 + 学习范围约束 + 出题 / 计划流程', 'AI', COLORS.brand2);
  addCard(ai, {
    x: 0.82, y: 1.72, w: 4.45, h: 3.95,
    title: '实现流程',
    bullets: [
      '前端请求：/api/ai-assistant/chat',
      '后端组装上下文：用户兴趣 + 学习路径 + 资源库',
      '调用 DeepSeek：返回纯文本，前端做轻量格式整理',
      '学习任务：可按当前学习主题生成练习题，也可结合路径与资源生成学习计划',
    ],
  });
  addDualImages(ai, img('08-ai-quiz.png'), img('09-ai-answers.png'), 5.55, 1.72, 6.95, 3.95);
  addFooter(ai, '讲法：强调“AI 读得懂平台数据”，不是纯外部问答。', '8 / 10');

  const retro = deck.addSlide();
  addPanel(retro);
  addHeader(retro, '过程复盘：我们怎么把功能做“能用”', '老师更爱看：发现问题 -> 定位原因 -> 修复验证（体现工程能力）', '复盘', '6366F1');
  addCard(retro, {
    x: 0.82, y: 1.7, w: 3.72, h: 1.65,
    title: '从“像”到“能用”',
    body: '资源库不再是摆设：补齐真实链接与大纲，点击能学习。',
  });
  addCard(retro, {
    x: 4.81, y: 1.7, w: 3.72, h: 1.65,
    title: '从“撞脸”到“统一”',
    fill: COLORS.soft,
    lineColor: 'BFD7FF',
    body: '封面统一 SVG 图案生成，风格一致且每条不重复。',
  });
  addCard(retro, {
    x: 8.8, y: 1.7, w: 3.72, h: 1.65,
    title: 'AI 迭代',
    body: '限制学习范围的同时，保留练习题 / 计划 / 推荐等学习任务可用。',
  });
  addDualImages(retro, img('08-ai-quiz.png'), img('09-ai-answers.png'), 0.82, 3.65, 11.68, 2.6);
  addFooter(retro, '讲法：用 3 个“我们遇到…后来…”的句子讲完。', '9 / 10');

  const end = deck.addSlide();
  addPanel(end);
  addHeader(end, '总结与展望', '对 AI 工具与功能实现的体会 + 下一步怎么做得更像产品', '总结', '2563EB');
  addCard(end, {
    x: 0.82, y: 1.72, w: 5.7, h: 3.5,
    title: '我们的体会（不生硬，讲真实）',
    bullets: [
      'AI 很强，但要“喂对上下文”和“给清楚规则”，才稳定可控',
      '做产品体验比做页面更难：能点、能学、能继续才算完成',
      '用 AI 辅助定位问题、改提示词、做迭代，比直接“堆功能”更有效',
    ],
  });
  addCard(end, {
    x: 6.8, y: 1.72, w: 5.72, h: 3.5,
    title: '后续可以怎么完善',
    fill: COLORS.soft,
    lineColor: 'BFD7FF',
    bullets: [
      '学习记录后端持久化：多端同步，支持更真实的推荐',
      '错题本与判题：练习题可作答、自动反馈与统计',
      '更细的推荐算法：结合点击 / 进度 / 兴趣动态调整',
    ],
  });
  addSingleImage(end, img('02-library.png'), 0.82, 5.45, 11.7, 0.95, '结束语建议：资源 + 路径 + AI，让学习过程更省心、更可持续。');
  addFooter(end, '讲法：30 秒，总结 1 句 + 展望 3 点。', '10 / 10');

  return deck;
}

let pptx;

async function main() {
  ensureDir(OUTPUT_DIR);
  pptx = buildPresentation();
  await pptx.writeFile({ fileName: OUTPUT_FILE });
  console.log(`PPT generated: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
