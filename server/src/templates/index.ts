/**
 * Context Server — Protocol Templates v0.6
 *
 * Pre-built templates for different project types.
 * These are written to new spaces as initial SPACE.md, TEAM.md, TASK.md.
 */

import type { ProtocolFileName } from "../types.js";

type TemplateVars = {
  spaceName?: string;
  channel?: string;
};

type TemplateType = "software-dev" | "content" | "research" | "blank";

const templates: Record<TemplateType, Record<ProtocolFileName, (vars: TemplateVars) => string>> = {
  "software-dev": {
    "SPACE.md": (vars) => `# ${vars.spaceName || "Project Space"}

## 空间说明

这是一个软件开发项目的协作空间。所有参与此项目的 AI 和人类成员共享此空间。

## 协作原则

1. **所有工作成果必须写入此空间** — 不要保存到本地 workspace，而是写到这个共享空间
2. **分享文件时使用 Context URL** — 不要发送文件原文，发送文件在此空间中的 URL
3. **及时更新 TASK.md** — 完成任务后立即更新状态
4. **遵循协作协议** — 按照下方定义的流程执行

## 协作协议（软件开发）

### 需求流程
1. 产品成员收集需求 → 写入需求文档 → 打上 \`ready\` 标签
2. 研发成员看到 \`ready\` 标签 → 认领任务 → 制定技术方案
3. 技术方案确认 → 提 PR → 测试通过 → 通知产品验收

### 文件规范
- \`docs/\` — 需求文档、PRD、设计稿
- \`dev/\` — 技术方案、架构设计
- \`test/\` — 测试用例、测试报告
- \`changelog/\` — 版本更新记录

### 状态标签
- \`draft\` — 草稿，还在编写
- \`ready\` — 就绪，可以被下游认领
- \`in-progress\` — 进行中
- \`review\` — 等待审阅
- \`done\` — 已完成

## 渠道关联

- **Channel:** ${vars.channel || "未指定"}
- **Space URL:** (自动生成)

## 如何使用

### 对 AI
- 你的所有产出（文档、代码、方案）都写到此空间对应目录
- 需要引用文件时，使用 Context URL 格式
- 每次开始工作前，先读 TASK.md 了解当前进度

### 对人类
- 通过 Web 界面查看和编辑文件
- 通过群聊中的斜杠命令管理空间
- 直接在文件上添加批注，AI 会读取并执行
`,

    "TEAM.md": (vars) => `# ${vars.spaceName || "Project"} — 团队成员

## 成员列表

| 名称 | 类型 | 角色 | ID | 能力 |
|------|------|------|-----|------|
| (待添加) | human/agent | 角色 | channel_id | 技能描述 |

## 角色说明

- **产品 (PM)**: 收集需求、编写 PRD、验收功能
- **研发 (Dev)**: 技术方案、编码实现、Code Review
- **测试 (QA)**: 编写测试用例、执行测试、报告 Bug
- **设计 (Design)**: UI/UX 设计、交互原型

## 协作关系

- 产品 → 研发: 需求文档打上 \`ready\` 标签后，研发可认领
- 研发 → 测试: PR 提交后，通知测试验证
- 测试 → 产品: 测试通过后，通知产品验收
- 任何人 → 全员: 重大变更在群里通知所有人
`,

    "TASK.md": (vars) => `# ${vars.spaceName || "Project"} — 任务看板

## Milestone

| 里程碑 | 截止日期 | 状态 | 说明 |
|--------|----------|------|------|
| (待规划) | - | draft | - |

## 当前任务

### [in-progress] 进行中

(暂无)

### [ready] 待认领

(暂无)

### [done] 已完成

(暂无)

---

## 任务格式

\`\`\`markdown
### [状态] 任务标题
- **负责人:** @名称
- **截止:** YYYY-MM-DD
- **依赖:** 依赖的其他任务
- **产出:** 预期产出文件路径
- **说明:** 详细描述
\`\`\`

## 状态流转

\`\`\`
draft → ready → in-progress → review → done
                     ↓
                  blocked (有阻塞时)
\`\`\`

### 规则
- **draft → ready:** 文档编写完毕，可以被下游认领
- **ready → in-progress:** 有人认领并开始执行
- **in-progress → review:** 执行完成，等待审阅
- **review → done:** 审阅通过
- **任意 → blocked:** 遇到阻塞，需说明原因
`,
  },

  "content": {
    "SPACE.md": (vars) => `# ${vars.spaceName || "Content Space"}

## 空间说明

这是一个内容生产协作空间。团队在此协作完成从选题到发布的全流程。

## 协作原则

1. **所有内容写入此空间** — 不要保存到本地，写到共享空间
2. **分享时用 Context URL** — 便于其他成员直接查看和评审
3. **及时更新 TASK.md** — 标记每篇内容的进度
4. **遵循流程** — 按下方定义的内容生产流程执行

## 协作协议（内容生产）

### 生产流程
1. **选题策划:** 在 \`ideas/\` 中创建选题文件，写明角度、受众、预期效果
2. **初稿撰写:** 选题通过后，在 \`drafts/\` 中写作，完成后标记 \`ready\`
3. **审阅修改:** 审阅者查看初稿，添加批注，作者修改后标记 \`review\`
4. **素材制作:** 配图、排版等素材放入 \`assets/\`
5. **发布归档:** 发布后将终稿移入 \`published/\`，附上发布链接

### 文件规范
- \`ideas/\` — 选题和创意
- \`drafts/\` — 文字初稿
- \`assets/\` — 配图、视频等素材
- \`published/\` — 已发布的内容归档
- \`references/\` — 参考资料

### 状态标签
- \`draft\` — 草稿中
- \`ready\` — 初稿完成，等待审阅
- \`revision\` — 审阅后修改中
- \`approved\` — 审阅通过，待发布
- \`published\` — 已发布

## 渠道关联

- **Channel:** ${vars.channel || "未指定"}
`,

    "TEAM.md": (vars) => `# ${vars.spaceName || "Content"} — 团队成员

## 成员列表

| 名称 | 类型 | 角色 | ID | 能力 |
|------|------|------|-----|------|
| (待添加) | human/agent | 角色 | channel_id | 技能描述 |

## 角色说明

- **策划 (Planner)**: 选题策划、内容规划、日历排期
- **写作 (Writer)**: 文案撰写、内容创作
- **审阅 (Reviewer)**: 内容审核、质量把关
- **设计 (Designer)**: 配图、排版、视觉设计
- **运营 (Operator)**: 发布、数据分析、反馈收集

## 协作关系

- 策划 → 写作: 选题通过后分配给写作者
- 写作 → 审阅: 初稿完成后提交审阅
- 审阅 → 设计: 文案确认后配图
- 设计 → 运营: 素材就绪后发布
`,

    "TASK.md": (vars) => `# ${vars.spaceName || "Content"} — 内容任务看板

## 内容日历

| 主题 | 计划日期 | 状态 | 负责人 |
|------|----------|------|--------|
| (待规划) | - | draft | - |

## 当前任务

### [in-progress] 进行中

(暂无)

### [ready] 待认领

(暂无)

### [published] 已发布

(暂无)

---

## 状态流转

\`\`\`
draft → ready → revision → approved → published
\`\`\`
`,
  },

  "research": {
    "SPACE.md": (vars) => `# ${vars.spaceName || "Research Space"}

## 空间说明

这是一个科研协作空间。研究团队在此共享文献、实验数据、分析结果和论文草稿。

## 协作原则

1. **数据和文献集中管理** — 所有参考文献、实验数据、分析脚本写入此空间
2. **实验记录可追溯** — 每次实验在 \`experiments/\` 下创建独立目录，记录参数和结果
3. **论文版本控制** — 论文草稿在 \`papers/\` 中迭代，通过版本号追踪变更
4. **及时同步进展** — 更新 TASK.md 标记研究进度

## 协作协议（科研）

### 研究流程
1. **文献综述:** 在 \`references/\` 中整理相关文献，撰写综述
2. **实验设计:** 在 \`experiments/design/\` 中编写实验方案
3. **数据采集:** 实验数据存入 \`data/\`，附元信息（来源、时间、参数）
4. **数据分析:** 分析脚本和结果放入 \`analysis/\`
5. **论文撰写:** 草稿放入 \`papers/\`，经多轮审阅后定稿
6. **投稿/发布:** 终稿和投稿记录归档

### 文件规范
- \`papers/\` — 论文草稿和终稿
- \`data/\` — 原始数据和处理后数据
- \`experiments/\` — 实验方案和结果
- \`analysis/\` — 分析脚本和可视化
- \`references/\` — 参考文献和笔记
- \`figures/\` — 图表

### 状态标签
- \`planning\` — 实验规划中
- \`collecting\` — 数据采集中
- \`analyzing\` — 分析中
- \`writing\` — 撰写中
- \`reviewing\` — 审阅中
- \`submitted\` — 已投稿
- \`published\` — 已发表

## 渠道关联

- **Channel:** ${vars.channel || "未指定"}
`,

    "TEAM.md": (vars) => `# ${vars.spaceName || "Research"} — 研究团队

## 成员列表

| 名称 | 类型 | 角色 | ID | 专长 |
|------|------|------|-----|------|
| (待添加) | human/agent | 角色 | channel_id | 专长描述 |

## 角色说明

- **PI (首席研究员)**: 研究方向把控、论文审阅、资源协调
- **研究员 (Researcher)**: 实验执行、数据分析、论文撰写
- **数据分析师 (Analyst)**: 数据清洗、统计分析、可视化
- **文献助理 (Literature)**: 文献检索、综述整理
- **AI 助手 (Agent)**: 辅助文献搜索、数据处理、写作润色

## 协作关系

- PI → 研究员: 分配研究任务和方向指导
- 研究员 → 分析师: 提供原始数据，协作分析
- 文献助理 → 全员: 提供相关文献参考
- AI 助手 → 全员: 按需辅助各环节
`,

    "TASK.md": (vars) => `# ${vars.spaceName || "Research"} — 研究任务看板

## 研究里程碑

| 里程碑 | 截止日期 | 状态 | 说明 |
|--------|----------|------|------|
| (待规划) | - | planning | - |

## 当前任务

### [in-progress] 进行中

(暂无)

### [planning] 待规划

(暂无)

### [published] 已发表

(暂无)

---

## 状态流转

\`\`\`
planning → collecting → analyzing → writing → reviewing → submitted → published
\`\`\`
`,
  },

  "blank": {
    "SPACE.md": (vars) => `# ${vars.spaceName || "Space"}

## 空间说明

(请填写此空间的用途和协作原则)

## 协作原则

1. 所有工作成果写入此空间
2. 分享文件使用 Context URL
3. 及时更新 TASK.md

## 文件结构

(请根据项目需要自定义目录结构)

## 渠道关联

- **Channel:** ${vars.channel || "未指定"}
`,

    "TEAM.md": (vars) => `# ${vars.spaceName || "Space"} — 团队

## 成员列表

| 名称 | 类型 | 角色 | ID |
|------|------|------|-----|
| (待添加) | - | - | - |
`,

    "TASK.md": (vars) => `# ${vars.spaceName || "Space"} — 任务

## 当前任务

(暂无)
`,
  },
};

export function getTemplate(
  fileName: ProtocolFileName,
  templateType: TemplateType | string,
  vars: TemplateVars
): string {
  const tmpl = templates[templateType as TemplateType] || templates["blank"];
  return tmpl[fileName](vars);
}

export function listTemplateTypes(): string[] {
  return Object.keys(templates);
}
