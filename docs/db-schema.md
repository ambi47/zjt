# 数据库表设计（SQLite / sql.js）

本项目使用 SQLite 数据库存储核心业务数据，数据库文件位于 `server/data.sqlite`，由后端在启动时自动初始化与种子数据填充。

## 1. users（用户表）

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| id | TEXT | PK | 用户唯一 ID（UUID） |
| username | TEXT | UNIQUE, NOT NULL | 用户名 |
| email | TEXT | NOT NULL | 邮箱 |
| password_hash | TEXT | NOT NULL | bcrypt 哈希后的密码 |
| role | TEXT | NOT NULL | 角色（user/admin） |
| interests_json | TEXT | NOT NULL | 兴趣标签 JSON 字符串（数组） |
| level | TEXT | NOT NULL | 学习等级文案 |
| learning_goal | TEXT | NOT NULL | 学习目标文案 |
| points | INTEGER | NOT NULL | 积分 |
| learning_days | INTEGER | NOT NULL | 学习天数 |
| badges | INTEGER | NOT NULL | 奖章数量 |
| created_at | TEXT | NOT NULL | 创建时间（ISO 字符串） |

## 2. resources（资源表）

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| id | INTEGER | PK, AUTOINCREMENT | 资源 ID |
| title | TEXT | NOT NULL | 标题 |
| desc | TEXT | NOT NULL | 简介 |
| category | TEXT | NOT NULL | 分类（用于筛选） |
| icon | TEXT |  | lucide 图标名（可选） |
| emoji | TEXT |  | 封面 Emoji（可选，优先展示） |
| image | TEXT |  | 封面图片 URL（可选） |
| color | TEXT | NOT NULL | 配色标识（用于前端样式） |
| students | TEXT | NOT NULL | 学习人数展示文案（如 1.2k） |
| created_at | TEXT | NOT NULL | 创建时间（ISO 字符串） |

## 3. learning_paths（学习路径表）

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| id | INTEGER | PK, AUTOINCREMENT | 路径 ID |
| title | TEXT | NOT NULL | 路径标题 |
| stage | INTEGER | NOT NULL | 阶段序号 |
| status | TEXT | NOT NULL | 状态（completed / in_progress / pending） |
| progress | INTEGER |  | 进度百分比（0-100，可为空） |
| items_json | TEXT | NOT NULL | 阶段条目 JSON 字符串（数组） |
| created_at | TEXT | NOT NULL | 创建时间（ISO 字符串） |

## 4. recommendations（推荐表）

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| id | INTEGER | PK, AUTOINCREMENT | 推荐 ID |
| scope | TEXT | NOT NULL | 推荐范围（home / personal） |
| title | TEXT | NOT NULL | 标题 |
| desc | TEXT | NOT NULL | 简介 |
| category | TEXT | NOT NULL | 标签文案 |
| color | TEXT | NOT NULL | 配色标识 |
| icon | TEXT |  | lucide 图标名（可选） |
| students | TEXT |  | 学习人数展示文案（可选） |
| created_at | TEXT | NOT NULL | 创建时间（ISO 字符串） |

