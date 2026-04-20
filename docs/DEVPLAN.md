# Context — 开发计划

> **日期:** 2026-04-20  
> **基于:** PRD v0.1  
> **原则:** 小步快跑，每个版本可独立验证，做完即推 GitHub

---

## 版本总览

| 版本 | 代号 | 目标 | 预计周期 |
|------|------|------|----------|
| v0.1 | **骨架** | Server 能跑、Space 能建、文件能读写 | 1天 |
| v0.2 | **注入** | Plugin hook 跑通、协议自动注入 system prompt | 1-2天 |
| v0.3 | **裂变** | URL 分流机制跑通、安装引导流程验证 | 1-2天 |
| v0.4 | **联调** | 接真实 IM 群（Discord + DMWork）端到端测试 | 2-3天 |
| v0.5 | **体验** | 斜杠命令完善、安装自动配置、Agent 行为规则 | 2天 |
| v0.6 | **协议** | 协作模板完善、TASK.md 状态流转 | 2天 |
| v1.0 | **发布** | 稳定版、可安装到其他 OpenClaw 实例 | 1-2天 |

---

## v0.1 — 骨架（Server 基础能力）

**目标：** Server 跑起来，能建 Space、读写文件、管理成员

### 任务清单

| # | 任务 | 验证方式 |
|---|------|----------|
| 1 | `cd server && npm install` 依赖安装 | 无报错 |
| 2 | `npm run dev` 启动 server | localhost:3100 返回 200 |
| 3 | POST `/api/spaces` 创建空间 | 返回 space ID + 自动生成三个 MD |
| 4 | GET `/api/spaces/lookup` 按 channel+groupId 查找 | 返回正确的 space |
| 5 | PUT `/api/spaces/:id/files/*` 写文件 | 文件写入 data/ 目录 |
| 6 | GET `/api/spaces/:id/files/*` 读文件 | 返回文件内容 |
| 7 | GET `/api/spaces/:id/protocol` 读三个协议 | 返回 space+team+task |
| 8 | GET `/ctx/:spaceId/*` 无 header | 返回安装引导 markdown |
| 9 | GET `/ctx/:spaceId/*` 有 header | 返回文件内容 |

### 交付标准

- `curl` 跑通所有 9 个验证
- 数据持久化在 `server/data/` 目录
- 推 GitHub tag: `v0.1.0`

---

## v0.2 — 注入（Plugin Prompt Hook）

**目标：** Plugin 注册到 OpenClaw，每次对话自动注入三个协议文件

### 任务清单

| # | 任务 | 验证方式 |
|---|------|----------|
| 1 | Plugin 安装到 OpenClaw extensions 目录 | gateway 启动无报错 |
| 2 | `before_prompt_build` hook 注册 | 日志打印 hook 触发 |
| 3 | 从 session key 提取 channel + groupId | 不同渠道都能正确解析 |
| 4 | 调 Server 获取 protocol 文件 | 返回三个 MD 内容 |
| 5 | 拼装注入内容，返回 `appendSystemContext` | LLM 请求包含协议上下文 |
| 6 | 无 Space 时不注入（静默跳过） | 无错误日志 |
| 7 | Server 连不上时优雅降级 | 超时后正常继续 |

### 交付标准

- 在一个已建 Space 的群里对话，Agent 回复中体现它知道协议内容
- 在没有 Space 的群里对话，表现正常无异常
- 推 GitHub tag: `v0.2.0`

---

## v0.3 — 裂变（URL 分流 + 安装引导）

**目标：** Agent-A 发 Context URL → Agent-B 无插件收到安装引导 → 装完能读

### 任务清单

| # | 任务 | 验证方式 |
|---|------|----------|
| 1 | Plugin 注册 HTTP route `/ctx` (prefix match) | 路由生效 |
| 2 | 有插件的 Agent fetch URL → 带 header → 返回内容 | 返回文件原文 |
| 3 | 无插件 fetch URL → 无 header → 返回安装引导 | 返回 markdown 引导 |
| 4 | 安装引导内容包含：插件名、安装命令、空间ID、文件路径 | 内容完整 |
| 5 | Agent tool `context_write_file` 返回值包含 URL | URL 格式正确 |
| 6 | Agent 分享时使用 URL 而非原文（规则注入验证） | 对话中验证 |

### 交付标准

- 模拟两个 Agent 场景：A 写文件并分享 URL，B fetch 到引导
- B 安装插件后再 fetch 同一 URL，得到实际内容
- 推 GitHub tag: `v0.3.0`

---

## v0.4 — 联调（真实 IM 渠道端到端）

**目标：** 在真实的 Discord 群和 DMWork 群中跑通完整流程

### 任务清单

| # | 任务 | 验证方式 |
|---|------|----------|
| 1 | Discord 群：@Agent → 自动检查/创建 Space | 群内可见结果 |
| 2 | DMWork 群：@Agent → 自动检查/创建 Space | 群内可见结果 |
| 3 | session key 解析覆盖 Discord guild 格式 | 正确提取 guildId |
| 4 | session key 解析覆盖 DMWork group 格式 | 正确提取 groupNo |
| 5 | 协议注入后 Agent 知道团队成员 | 对话验证 |
| 6 | Agent 调 tools 写文件成功 | 文件出现在 data/ |
| 7 | Agent 发 Context URL 到群聊 | URL 可访问 |
| 8 | 多个 Agent 在同一 Space 协作 | 互相可读对方文件 |

### 交付标准

- 真实 Discord 群 + DMWork 群各跑通一次完整流程
- 截图/录屏留证
- 推 GitHub tag: `v0.4.0`

---

## v0.5 — 体验（命令 + 自动配置 + 行为规则）

**目标：** 人可用斜杠命令管理、Agent 安装后自动知道协作规则

### 任务清单

| # | 任务 | 验证方式 |
|---|------|----------|
| 1 | `/ctx_create` 实现（真正调 server 创建） | 群内执行成功 |
| 2 | `/ctx_info` 实现（显示 space 信息） | 返回名称+文件数+成员数 |
| 3 | `/ctx_files` 实现（列出文件） | 正确列出 |
| 4 | `/ctx_tasks` 实现（显示 TASK.md） | 正确显示 |
| 5 | `/ctx_team` 实现（显示 TEAM.md） | 正确显示 |
| 6 | bootstrap hook：安装后注入协作规则到 AGENTS.md | 文件被修改 |
| 7 | Agent 自动遵循"成果写 Space，分享用 URL" | 对话验证 |
| 8 | Agent 开始工作前读 TASK.md | 对话验证 |

### 交付标准

- 5个斜杠命令全部可用
- 新安装的 Agent 自动遵循协作规则（无需人工配置）
- 推 GitHub tag: `v0.5.0`

---

## v0.6 — 协议（模板完善 + 状态流转）

**目标：** 软件开发模板真正好用，任务状态能自动流转

### 任务清单

| # | 任务 | 验证方式 |
|---|------|----------|
| 1 | SPACE.md 模板优化：加入 URL 拼接规则说明 | Agent 能自己拼 URL |
| 2 | TEAM.md 模板：自动从群成员列表初始化 | 创建时自动填充 |
| 3 | TASK.md：支持状态标签 (draft→ready→in-progress→done) | Agent 正确更新 |
| 4 | PM 打 ready → 研发 Agent 能感知 | 对话验证 |
| 5 | 研发完成 → 自动通知 QA | 消息验证 |
| 6 | 内容生产模板初版 | 创建时可选 |
| 7 | 科研模板初版 | 创建时可选 |
| 8 | 协议文件过长时的裁剪策略 | token 不超限 |

### 交付标准

- 软件开发流程能从头走到尾（需求→开发→测试→完成）
- 三个模板都可用
- 推 GitHub tag: `v0.6.0`

---

## v1.0 — 发布（可安装 + 文档 + 稳定）

**目标：** 任何 OpenClaw 用户可以一键安装使用

### 任务清单

| # | 任务 | 验证方式 |
|---|------|----------|
| 1 | Plugin 发布到 ClawHub | `clawhub install context` 成功 |
| 2 | Server 打包为可独立运行的 npm package | `npx context-server` 启动 |
| 3 | README 完善（安装、配置、使用示例） | 新用户可跟着走通 |
| 4 | 错误处理完善（网络异常、权限不足等） | 无未处理异常 |
| 5 | 日志规范化 | 关键操作有日志 |
| 6 | 性能：协议注入缓存（避免每次都请求 server） | 响应时间 < 100ms |
| 7 | 配置文档：openclaw.json 的 context 字段说明 | 文档齐全 |

### 交付标准

- 全新 OpenClaw 实例，10 分钟内装好并跑通多 Agent 协作
- 推 GitHub tag: `v1.0.0` + GitHub Release
- ClawHub 上架

---

## 开发节奏

```
4/20 ─── v0.1 骨架 ──→ 推 GitHub
  │
4/21 ─── v0.2 注入 ──→ 推 GitHub
  │
4/22 ─── v0.3 裂变 ──→ 推 GitHub
  │
4/23-25 ─ v0.4 联调 ──→ 推 GitHub（需要真实群测试）
  │
4/26-27 ─ v0.5 体验 ──→ 推 GitHub
  │
4/28-29 ─ v0.6 协议 ──→ 推 GitHub
  │
4/30 ─── v1.0 发布 ──→ GitHub Release + ClawHub
```

---

## 每个版本的工作流

```
1. 按任务清单逐项开发
2. 逐项验证通过
3. git commit + git push（推到 GitHub main 分支）
4. git tag v0.x.0 + push tag
5. 记录已知问题 / 下版本待解决
6. 进入下一个版本
```

---

## 风险与预案

| 风险 | 影响 | 预案 |
|------|------|------|
| OpenClaw hook API 行为与预期不符 | v0.2 卡住 | 先读源码确认 API，必要时发 issue |
| session key 格式不统一 | v0.4 解析失败 | 多抓几个真实 key 做正则适配 |
| 协议文件太长超 token 限制 | Agent 无法接收完整上下文 | 做摘要裁剪 / 按需加载 |
| Server 在公网不安全 | 部署后数据泄露 | Phase 1 只跑 localhost，公网部署放 Phase 2+ |
| DMWork 群 session key 格式未验证 | v0.4 失败 | 先打日志抓取真实格式 |

---

## 当前状态

- [x] GitHub 仓库创建：https://github.com/luojingwei123/context
- [x] PRD 文档完成
- [x] v0.1 骨架 — Server CRUD 全部验证通过
- [x] v0.2 注入 — Plugin tools (execute+jsonResult) 全部可用
- [x] v0.3 裂变 — URL 分流 + Gateway HTTP route 验证通过
- [x] v0.4 联调 — session key 解析修正 + Space 创建（待用户群测试）
- [x] v0.5 体验 — 5个斜杠命令实现 + bootstrap hook
- [x] v0.6 协议 — 4个模板完善 + token 裁剪
- [x] v1.0 发布 — README 完善 + 代码清理
