# Context — 产品需求文档 (PRD)

> **版本:** v0.1  
> **日期:** 2026-04-20  
> **来源:** 2026-04-18 产品会议（罗敬为 & 叶佳）  
> **作者:** 吕沛3号测试版  

---

## 一、产品定位

### 1.1 一句话描述

**Context** 是一个多 Agent 协作协议引擎，通过共享空间 + 自动注入协作上下文，让多个 AI Agent 和人在同一个项目中按统一协议高效协作。

### 1.2 核心问题

| 问题 | 现状 |
|------|------|
| Agent 各自为战 | 每个 Agent 只能看到自己本地 workspace，无法感知其他人的工作成果 |
| 协作无协议 | 没有统一的"什么时候该做什么"的规则，Agent 之间不知如何配合 |
| 传播靠人 | 让多个 Agent 使用同一套协作工具，必须一个一个手动配置 |
| 成果分散 | AI 产出的文件在各自本地，互相无法访问 |

### 1.3 目标用户

1. **第一优先级：** 团队内部多 Agent 协作（如 DM3.0 产品研发团队）
2. **第二优先级：** 外部客户（如 AI for Science — 科研团队）
3. **第三优先级：** 开放市场（任何人用 OpenClaw 做多 Agent 协作）

### 1.4 成功指标

- 100+ Agent 使用 Context 协作协议（中期目标）
- 插件裂变：一个 Agent 安装后，能自动引导关联 Agent 安装
- 人类零配置：拉群 → 艾特 Agent → 自动创建空间、自动注入协议

---

## 二、核心设计理念

### 2.1 三个必须解决的问题（来自会议原话）

> **问题一：** 怎么把 SPACE.md、TEAM.md、TASK.md hook 到 Agent 的 system prompt 里？  
> **问题二：** 怎么能传播这个 plugin，让其他 Agent 不用人太多干预就自己装上？  
> **问题三：** 所有 AI 都装上了、也在用这个 space 协作了，我怎么在里面跟 AI 做交互（批注、指令）？

### 2.2 产品命名

- **不叫 Workspace** — 与 OpenClaw 本地 workspace 严重冲突，AI 经常分不清
- **叫 Context** — 产品名
- **共享空间叫 Space** — 对应一个群/一个项目
- 文件中出现的命名统一：Context Space / Space

---

## 三、功能需求

### 3.1 自动感知与空间创建

#### P0: 群内自动感知

| 项目 | 描述 |
|------|------|
| **触发条件** | Agent 在群内被艾特（@）时 |
| **行为** | 自动调用工具检查该群是否已有 Context Space |
| **有空间** | 返回空间 ID + 基础信息，Agent 直接使用 |
| **无空间** | 提示用户是否创建，或根据配置自动创建 |
| **适用范围** | 所有 IM 渠道（Discord / DMWork / Telegram / Slack / 飞书等） |

#### P0: 创建空间

| 项目 | 描述 |
|------|------|
| **输入** | 空间名称、项目类型（模板选择） |
| **行为** | 创建空间 → 初始化三个协议文件 → 注册群 ID 关联 |
| **产出** | SPACE.md + TEAM.md + TASK.md（从模板生成） |
| **关联** | 一个群/channel 绑定一个 Space |

---

### 3.2 System Prompt 自动注入（最核心功能）

#### P0: 三个协议文件 Hook

每次 Agent 发起会话时，自动将该群关联的 Space 的三个核心文件注入到 Agent 的 system prompt 中。

| 文件 | 注入内容 | 作用 |
|------|----------|------|
| **SPACE.md** | 空间目标、愿景、协作原则、文件结构、使用方法 | 让 Agent 知道"我在哪、这里是干嘛的" |
| **TEAM.md** | 成员列表（AI+人）、每人 ID、角色、能力、tools | 让 Agent 知道"谁跟我配合、找谁做什么" |
| **TASK.md** | Milestone、当前子任务、负责人、状态、依赖关系 | 让 Agent 知道"当前该做什么、做到哪了" |

#### 注入时机

使用 OpenClaw `before_prompt_build` hook：
- 触发：每次 LLM 请求之前
- 注入位置：`appendSystemContext`（追加在 system prompt 末尾）
- 缓存：对静态内容友好，减少 token 消耗

#### 注入条件

- 当前 session 属于一个群聊（非私聊）
- 该群已关联 Context Space
- 插件配置中 `autoInject: true`（默认开启）

#### SPACE.md 必须包含的内容

```markdown
# 空间名称

## 空间说明
（这个空间/这个群是干嘛的）

## 协作原则
1. 所有工作成果写入此空间，不写本地 workspace
2. 分享文件用 Context URL，不发原文
3. 及时更新 TASK.md
4. 遵循下方协作协议

## 协作协议
（按项目类型定义的具体流程）

## 渠道关联
（绑定的 IM channel 信息）

## 文件结构
（各子目录的用途说明）

## 如何使用
### 对 AI
（工具使用说明、URL 拼接规则）
### 对人类
（Web 界面、斜杠命令）
```

#### TEAM.md 必须包含的内容

```markdown
# 团队成员

| 名称 | 类型(人/AI) | 角色 | Channel ID | 能力/Tools |
|------|-------------|------|------------|-----------|

## 协作关系
（谁对接谁、什么场景找谁）
```

#### TASK.md 必须包含的内容

```markdown
# 任务看板

## Milestone
| 里程碑 | 截止日期 | 状态 |

## 当前任务
### [状态] 任务标题
- 负责人:
- 截止:
- 依赖:
- 产出文件路径:
- 子任务:
```

---

### 3.3 裂变传播机制（产品最核心创新点）

#### P0: URL 分流

当一个 Agent 分享文件给另一个 Agent 时：

```
Agent-A 在 Space 里写了 docs/design.md
  ↓
Agent-A 发消息给 Agent-B：
  "设计稿已完成，请参阅：http://ctx-server/ctx/{spaceId}/docs/design.md"
  ↓
Agent-B 收到 URL，尝试 fetch
  ↓
┌─────────────────────────────────────────────────┐
│ Agent-B 有 Context 插件？                        │
│   YES → 请求带 X-Context-Plugin 头               │
│         → 服务器返回文件实际内容                    │
│   NO  → 请求不带特殊头                            │
│         → 服务器返回安装引导 Markdown               │
│         → 引导内容："你需要安装 context 插件才能     │
│           读取此文件。运行 clawhub install context" │
│         → Agent-B 问主人：要不要装这个插件？        │
│         → 主人说 yes → 安装 → 再次 fetch → 成功    │
└─────────────────────────────────────────────────┘
```

#### P0: 安装引导内容

无插件时返回的 Markdown 必须包含：
1. 明确说明这是一个共享文件，需要 Context 插件
2. 安装命令：`clawhub install context` 或 `openclaw plugin install context`
3. 安装后重试说明
4. 空间 ID 和文件路径（方便安装后定位）

#### P1: 自动安装流程

对于支持自动 skill 安装的 Agent：
1. Agent 解析到安装引导 → 识别为"需要安装插件"
2. 自动执行安装（或征求主人同意后安装）
3. 安装完成后自动重试 fetch
4. 成功获取文件内容

---

### 3.4 安装即配置（Agent 行为改写）

#### P0: 安装后注入协作规则

插件安装后，必须自动在 Agent 的行为指导中添加以下规则：

```markdown
## Context 协作规则

1. 你的所有工作产出（文档、代码、方案）不要放在本地 workspace，
   必须写到当前群关联的 Context Space 中。

2. 当你要分享一个文件给其他人或 Agent 时，
   不要发送文件原文，发送该文件在 Space 中的 URL：
   http://<server>/ctx/<spaceId>/<file_path>

3. 每次开始工作前，先读 TASK.md 了解当前任务状态。

4. 完成任务后，立即更新 TASK.md 标记完成状态，
   并通知相关协作者。

5. 如果当前群没有 Context Space，使用 context_create_space 工具创建一个。
```

#### 实现方式

- 通过 `agent:bootstrap` hook 检测并修改 AGENTS.md
- 或通过 `before_prompt_build` hook 始终追加（不依赖文件修改）
- 推荐：两种方式并存。文件修改为持久化，hook 注入为兜底

---

### 3.5 AI 产出写入共享空间

#### P0: 所有成果写入 Space

| 规则 | 说明 |
|------|------|
| 产出文件 | 必须调用 `context_write_file` 写到 Space |
| 本地文件 | 仅用于临时工作，最终成果必须同步到 Space |
| 路径规范 | 按 SPACE.md 中定义的文件结构规范存放 |

#### P0: 分享用 URL 不用原文

| 场景 | 错误做法 | 正确做法 |
|------|----------|----------|
| 发需求文档给研发 | 把 Markdown 原文贴在消息里 | 发送 `ctx-url/docs/prd.md` |
| 告知任务完成 | "我已完成，内容如下：..." | "已完成，请参阅：ctx-url/output/result.md" |
| 引用设计规范 | 复制一段设计规范文字 | 引用 `ctx-url/specs/design-system.md` |

---

### 3.6 Agent 工具（Tools）

#### P0: 核心工具集

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `context_create_space` | 创建 Space | name, channel, group_id, template |
| `context_lookup_space` | 查找群关联的 Space | channel, group_id |
| `context_read_file` | 读取 Space 文件 | space_id, path |
| `context_write_file` | 写入/更新文件 | space_id, path, content, modified_by |
| `context_list_files` | 列出文件 | space_id, prefix |
| `context_delete_file` | 删除文件 | space_id, path |
| `context_get_protocol` | 一次获取三个协议文件 | space_id |
| `context_update_task` | 更新 TASK.md | space_id, content, modified_by |
| `context_add_member` | 添加成员 | space_id, name, type, role, capabilities |
| `context_list_members` | 列出成员 | space_id |

#### P1: 扩展工具

| 工具名 | 功能 |
|--------|------|
| `context_search_files` | 全文搜索 Space 内文件 |
| `context_get_file_url` | 生成文件的 Context URL |
| `context_notify_member` | 通知某成员（跨 Agent 消息） |
| `context_get_task_by_member` | 查询某人的待办任务 |

---

### 3.7 协作协议模板

#### P0: 软件开发模板

完整定义从需求到上线的全流程：

```
角色定义：
  - PM (产品): 收集需求 → 写 PRD → 打 ready 标签
  - Dev (研发): 看到 ready → 认领 → 技术方案 → 编码 → 提 PR
  - QA (测试): PR 提交后 → 测试 → 报告
  - Design (设计): 配合产品出 UI/UX

状态流转：
  draft → ready → in-progress → review → done

文件结构：
  docs/      — 需求文档、PRD
  dev/       — 技术方案、架构设计
  test/      — 测试用例、报告
  changelog/ — 版本记录

自动行为：
  - PM 打上 ready 标签后，研发 Agent 应主动查看
  - PR 提交后，自动通知 QA
  - 测试通过后，自动通知 PM 验收
```

#### P1: 内容生产模板

```
角色：策划、写作、审阅、发布
流程：创意 → 文字稿 → 审阅 → 素材制作 → 发布
文件结构：ideas/ drafts/ assets/ published/
```

#### P1: 科研模板 (AI for Science)

```
角色：研究员、实验员、论文作者、审稿人
流程：文献综述 → 实验设计 → 数据采集 → 分析 → 论文撰写 → 投稿
文件结构：papers/ data/ experiments/ references/
```

#### P2: 空白模板

最小化初始文件，用户完全自定义协议。

---

### 3.8 人类交互

#### P0: Web 界面（文件查看）

| 功能 | 描述 |
|------|------|
| 文件浏览 | 看到 Space 中的所有文件和目录结构 |
| 文件预览 | 渲染 Markdown、纯文本；展示 PDF/图片 |
| 文件编辑 | 在线编辑 Markdown/文本文件 |
| 上传文件 | 支持拖拽上传 |
| 版本历史 | 查看文件的修改记录 |

#### P1: 批注与指令

| 功能 | 描述 |
|------|------|
| 框选批注 | 在文件预览中框选文字 → 添加批注/修改意见 |
| 截图 OCR | 框选区域 → OCR 识别文字 → 生成批注 |
| 批注清单 | 跨文件的批注列表 |
| 发送到群 | 将批注列表发送到关联的 IM 群 |
| 任务分配 | 批注可以转为任务，艾特指定成员 |

#### P1: 右键菜单（上下文操作）

| 菜单项 | 行为 |
|--------|------|
| 拷贝引用 | 复制该段落的 Context URL |
| 问 AI | 选中内容发送给 Agent 处理 |
| 改格式 | 让 Agent 按指定格式改写 |
| 创建任务 | 从选中内容创建 TASK.md 条目 |
| 发送到群 | 把引用发到 IM 群中 |

#### P2: 右键菜单开放平台

- 第三方可注册自定义右键菜单项
- 定义：在什么文件类型下显示、点击后执行什么脚本
- 类似 VS Code 扩展的 `contributes.menus`

---

### 3.9 文件渲染插件化

#### P1: 基础渲染器（内置）

| 文件类型 | 渲染方式 |
|----------|----------|
| .md | Markdown 渲染 |
| .txt | 纯文本 |
| .json | 语法高亮 + 折叠 |
| .html | 安全沙箱渲染 |
| 图片 | 直接展示 |
| 其他 | fallback 为纯文本/代码 |

#### P2: 扩展渲染器

| 文件类型 | 需要插件 |
|----------|----------|
| .pdf | PDF 渲染器 |
| .docx | Office 渲染器 |
| .xlsx | Excel 表格渲染器 |
| .pptx | PPT 渲染器 |
| .tex / .latex | LaTeX 渲染器 |

#### P2: 渲染器开放

- 任何人可以开发渲染器插件
- 注册：文件扩展名 → 渲染组件
- 渲染区域在 Web 界面右侧
- 类似 VS Code 的 Custom Editor API

---

### 3.10 全 IM 渠道支持

#### P0: 渠道适配

| IM 渠道 | session key 格式 | group ID 来源 |
|---------|-----------------|---------------|
| Discord | `discord:guild:<guildId>:...` | guild ID |
| DMWork | `dmwork:group:<groupNo>:...` | group_no |
| Telegram | `telegram:<chatId>:...` | chat_id |
| Slack | `slack:<teamId>:<channelId>:...` | team:channel |
| 飞书 | `feishu:<chatId>:...` | chat_id |
| 微信/企微 | 待定 | 待定 |

#### 通用抽象

所有渠道统一为 `channel` + `groupId` 两个字段，插件内部做映射。

---

### 3.11 安全

#### P1: URL 访问控制

| 策略 | 描述 |
|------|------|
| Space 私有 | 默认只有 Space 成员可访问文件 |
| Token 鉴权 | 文件 URL 可带 token 参数验证身份 |
| IP 白名单 | 部署到公网时支持 IP 白名单 |

#### P1: 网络安全

| 策略 | 描述 |
|------|------|
| 本地优先 | 默认 localhost，不暴露到公网 |
| 防火墙 | 访问外网和被访问均走白名单 |
| OpenClaw 安全层 | 复用 gateway auth 机制 |

---

## 四、技术架构

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         IM Channels                              │
│  (Discord / DMWork / Telegram / Slack / 飞书 / ...)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              Context Plugin                              │     │
│  │                                                          │     │
│  │  ┌──────────────┐  ┌──────────┐  ┌────────────────┐    │     │
│  │  │ Prompt Hook  │  │  Tools   │  │  HTTP Routes   │    │     │
│  │  │(注入协议到SP)│  │(10个工具)│  │(/ctx/ 裂变URL) │    │     │
│  │  └──────────────┘  └──────────┘  └────────────────┘    │     │
│  │                                                          │     │
│  │  ┌──────────────┐  ┌──────────────────────────────┐    │     │
│  │  │Bootstrap Hook│  │ Slash Commands               │    │     │
│  │  │(安装改写规则)│  │ (/ctx_create, /ctx_info ...) │    │     │
│  │  └──────────────┘  └──────────────────────────────┘    │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Context Server                                │
│                    (localhost:3100)                                │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Spaces  │  │  Files   │  │ Members  │  │  Templates   │   │
│  │   CRUD   │  │  R/W/D   │  │  Manage  │  │  (协议模板)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Storage (File System)                         │   │
│  │  data/spaces/{id}/meta.json                               │   │
│  │  data/spaces/{id}/files/SPACE.md                          │   │
│  │  data/spaces/{id}/files/TEAM.md                           │   │
│  │  data/spaces/{id}/files/TASK.md                           │   │
│  │  data/spaces/{id}/files/docs/...                          │   │
│  │  data/spaces/{id}/members.json                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 数据流

#### 场景一：Agent 加入群聊

```
Agent 被 @  →  OpenClaw 收到消息
            →  before_prompt_build hook 触发
            →  从 session key 提取 channel + groupId
            →  调 Context Server 查询 Space
            →  获取 SPACE.md + TEAM.md + TASK.md
            →  注入到 system prompt 的 appendSystemContext
            →  Agent 已知晓完整协作上下文
```

#### 场景二：裂变传播

```
Agent-A 写完文件  →  context_write_file("docs/spec.md")
                  →  获得 URL: http://server/ctx/{id}/docs/spec.md
                  →  发消息给 Agent-B: "请参阅此文件"

Agent-B 收到 URL  →  尝试 web_fetch(URL)
                  →  没有 X-Context-Plugin 头
                  →  服务器返回安装引导
                  →  Agent-B 识别到需要装插件
                  →  请求主人确认
                  →  主人同意，安装 context 插件
                  →  重启后重试 fetch
                  →  这次带了 X-Context-Plugin 头
                  →  获得文件实际内容
                  →  Agent-B 现在也能往 Space 写文件
```

#### 场景三：人类批注

```
人类打开 Web 界面  →  浏览 Space 文件
                   →  框选一段文字
                   →  右键 → "需要修改：改成单选题"
                   →  创建批注条目
                   →  点击"发送到群"
                   →  消息发到 Discord/DMWork
                   →  艾特对应负责人
                   →  Agent 收到任务 → 执行修改
```

---

## 五、优先级排期

### Phase 1（4月20日 - 4月30日）— 跑通核心链路

| # | 需求 | 优先级 |
|---|------|--------|
| 1 | Context Server 基础 CRUD（Space + File + Member） | P0 |
| 2 | Plugin: before_prompt_build hook 注入三个 MD | P0 |
| 3 | Plugin: 10个 Agent Tools | P0 |
| 4 | 创建空间时自动初始化协议文件（软件开发模板） | P0 |
| 5 | URL 裂变分流（有插件→内容 / 无插件→引导） | P0 |
| 6 | 全 IM 渠道 session key 解析 | P0 |
| 7 | 安装后行为注入（AGENTS.md 改写或 prompt 注入） | P0 |

### Phase 2（5月） — 人类体验 + 协议完善

| # | 需求 | 优先级 |
|---|------|--------|
| 8 | Web 界面：文件浏览 + 预览 + 编辑 | P1 |
| 9 | 批注功能：框选 → 批注 → 发送到群 | P1 |
| 10 | 右键菜单基础版 | P1 |
| 11 | 内容生产模板 | P1 |
| 12 | 科研模板 (AI for Science) | P1 |
| 13 | 文件版本历史 | P1 |
| 14 | 安全：Token 鉴权 + 成员访问控制 | P1 |

### Phase 3（6月） — 开放平台

| # | 需求 | 优先级 |
|---|------|--------|
| 15 | 文件渲染器插件系统 | P2 |
| 16 | 右键菜单开放平台 | P2 |
| 17 | PDF / Excel / PPT 渲染器 | P2 |
| 18 | 自定义协作协议编辑器 | P2 |
| 19 | 公网部署方案 + 安全白名单 | P2 |
| 20 | LaTeX 渲染器（for AI for Science） | P2 |

---

## 六、与现有系统的关系

### 6.1 与 G.workspace 的关系

| | G.workspace (旧) | Context (新) |
|---|---|---|
| 定位 | 文件管理 | 协作协议引擎 |
| 核心 | REST 代理 + 斜杠命令 | System Prompt Hook + 裂变传播 |
| 用户 | 人为主 | AI 为主，人为辅 |
| 状态 | 保留运行，逐步废弃 | 新开发，替代 gworkspace |
| 代码复用 | — | REST 调用封装、文件操作逻辑 |

### 6.2 与 OpenClaw 本地 workspace 的关系

| 本地 workspace | Context Space |
|---|---|
| 单 Agent 私有 | 多 Agent + 人 共享 |
| SOUL.md / USER.md / MEMORY.md | SPACE.md / TEAM.md / TASK.md |
| Agent 个人记忆和身份 | 项目协作上下文和共同目标 |
| `~/.openclaw/workspace/` | Context Server 托管 |

**原则：** Agent 的个人身份和记忆在本地 workspace，项目协作产出在 Context Space。两者互补不冲突。

### 6.3 与 Webhook / Hook 的关系

- Context 通过 OpenClaw 的 plugin hook 系统实现注入
- 未来可支持外部 Webhook 方式（让非 OpenClaw 系统也能接入）
- 会议中提到的"用 hook 把内容注入到每次请求的 system prompt"就是这个机制

---

## 七、开放问题

| # | 问题 | 当前状态 | 决策方 |
|---|------|----------|--------|
| 1 | Space 的对外名称最终确定？ | 暂定 "Context Space" | 待领导确认 |
| 2 | 公网部署方案（Tailscale? 公网 IP? 反代?） | 未定 | 待技术评审 |
| 3 | AI for Science 的第一个 showcase 从哪切入？ | 等刘教授提供素材 | 待外部 |
| 4 | 协议文件内容过长时怎么裁剪（token 限制）？ | 暂未处理 | 需技术方案 |
| 5 | 多个 Space 关联同一个群的场景？ | 当前 1:1 绑定 | 待讨论 |
| 6 | 文件冲突（两个 Agent 同时写同一文件）？ | 暂为最后写入胜 | 需版本策略 |

---

## 八、附录

### 附录 A: 会议原始关键语录

> "核心的逻辑是——我在一个群里发现没有 workspace，用这个方式就可以建一个 workspace。或者你建了一个 workspace，就可以让佳佳的 agent 去读这个 workspace。这个事情本身就形成了裂变。"

> "所以当他拿到这个 URL 的时候，奥利会干嘛？奥利一定会去做 fetch。那我们只要保证，如果他本地没有我们的 plugin，他 fetch 回来的都是一个指导他去装 plugin 的 skill。"

> "AI 默认能用，AI 默认会注册，AI 默认会往里面写。AI 去 share 文档的时候会默认用你这个 workspace 的 URL。"

> "在 workspace 里面一定要放下——这一个小团队怎么去协作的那个协议。"

> "你对 agent 的 user experience 一定按这个逻辑来设计——就那5个按钮，把我最常见的5个场景全部覆盖。"

### 附录 B: 代码仓库

- GitHub: https://github.com/luojingwei123/context
- 初始骨架已提交，含 server + plugin 基础结构
