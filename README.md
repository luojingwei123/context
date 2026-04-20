# Context

> 多 Agent 协作协议引擎 — 共享空间 + 自动注入上下文 + 裂变传播

## 是什么

Context 让多个 AI Agent 在同一个项目中按统一协议高效协作。

- **自动注入** — Agent 加入群聊时，自动获取项目的协作协议（SPACE.md / TEAM.md / TASK.md）
- **裂变传播** — Agent-A 分享文件 URL → Agent-B 没装插件时收到安装引导 → 装了就能协作
- **安装即配置** — 装完插件自动改写 Agent 行为规则（成果写 Space、分享用 URL）

## 快速开始

### 1. 启动 Server

```bash
cd server
npm install
npx tsx src/index.ts
# → Context Server running on http://localhost:3100
```

### 2. 安装插件到 OpenClaw

```bash
# 复制 plugin 到 OpenClaw extensions 目录
cp -r plugin/ ~/.openclaw/extensions/context/

# 在 openclaw.json 中添加配置
# plugins.allow 数组加入 "context"
# plugins.entries 加入:
#   "context": { "enabled": true, "config": { "serverUrl": "http://localhost:3100" } }
# plugins.installs 加入:
#   "context": { "source": "path", "installPath": "~/.openclaw/extensions/context", "version": "1.0.0" }

# 重启 OpenClaw
openclaw gateway restart
```

### 3. 在群里使用

```
/ctx_create name:我的项目        # 创建协作空间
/ctx_info                        # 查看空间信息
/ctx_files                       # 列出文件
/ctx_tasks                       # 查看任务
/ctx_team                        # 查看团队
```

或者直接在群里 @Agent，它会自动感知 Context Space 并使用协作协议。

## 架构

```
┌──────────────────────────────┐
│       IM Channels            │
│ (Discord/DMWork/Telegram/..) │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     OpenClaw Gateway         │
│  ┌────────────────────────┐  │
│  │    Context Plugin      │  │
│  │ • Prompt Hook (注入)   │  │
│  │ • 10 Agent Tools       │  │
│  │ • HTTP Routes (裂变)   │  │
│  │ • 5 Slash Commands     │  │
│  └────────────────────────┘  │
└──────────────┬───────────────┘
               │ REST API
               ▼
┌──────────────────────────────┐
│     Context Server           │
│     (localhost:3100)         │
│ • Spaces CRUD                │
│ • Files R/W/D                │
│ • Members Management         │
│ • Protocol Templates         │
│ • Viral URL (/ctx/*)         │
└──────────────────────────────┘
```

## 三个核心协议文件

| 文件 | 作用 | 自动注入 |
|------|------|----------|
| **SPACE.md** | 空间目标、协作原则、文件结构 | ✅ 每次对话注入 |
| **TEAM.md** | 成员列表、角色、能力、协作关系 | ✅ 每次对话注入 |
| **TASK.md** | 里程碑、任务、状态、负责人 | ✅ 每次对话注入 |

## Agent Tools

| 工具 | 功能 |
|------|------|
| `context_create_space` | 创建空间 |
| `context_lookup_space` | 查找群关联空间 |
| `context_read_file` | 读取文件 |
| `context_write_file` | 写入文件 |
| `context_list_files` | 列出文件 |
| `context_delete_file` | 删除文件 |
| `context_get_protocol` | 获取三个协议文件 |
| `context_update_task` | 更新 TASK.md |
| `context_add_member` | 添加成员 |
| `context_list_members` | 列出成员 |

## 项目模板

| 模板 | 适用场景 |
|------|----------|
| `software-dev` | 软件开发（需求→研发→测试→上线） |
| `content` | 内容生产（选题→撰写→审阅→发布） |
| `research` | 科研（文献→实验→分析→论文→投稿） |
| `blank` | 空白模板，完全自定义 |

## 裂变传播

```
Agent-A 写了文件 → 得到 URL: http://server/ctx/{spaceId}/docs/spec.md
Agent-A 发 URL 给 Agent-B

Agent-B 无插件 fetch URL → 收到安装引导
Agent-B 装了插件 fetch URL → 收到文件内容
```

## API

Server 提供 REST API（默认 `http://localhost:3100`）：

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/spaces` | 创建空间 |
| GET | `/api/spaces/lookup?channel=&groupId=` | 查找空间 |
| GET | `/api/spaces/:id/protocol` | 获取三个协议文件 |
| GET | `/api/spaces/:id/files` | 列出文件 |
| GET | `/api/spaces/:id/files/:path` | 读取文件 |
| PUT | `/api/spaces/:id/files/:path` | 写入文件 |
| DELETE | `/api/spaces/:id/files/:path` | 删除文件 |
| GET | `/api/spaces/:id/members` | 列出成员 |
| POST | `/api/spaces/:id/members` | 添加成员 |
| GET | `/ctx/:spaceId/*` | 裂变 URL（有/无插件分流） |

## 文档

- [产品需求文档 (PRD)](docs/PRD.md)
- [开发计划](docs/DEVPLAN.md)

## License

MIT
