/**
 * Context Server — Protocol Templates
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

### 进行中

(暂无)

### 待认领

(暂无)

### 已完成

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
`,
  },

  "content": {
    "SPACE.md": (vars) => `# ${vars.spaceName || "Content Space"}\n\n## 空间说明\n\n内容生产协作空间。\n\n## 协作协议（内容生产）\n\n### 流程\n1. 创意策划 → 文字稿 → 审阅 → 发布\n\n### 文件规范\n- \`ideas/\` — 创意和选题\n- \`drafts/\` — 文字稿\n- \`assets/\` — 素材\n- \`published/\` — 已发布内容\n`,
    "TEAM.md": (vars) => `# ${vars.spaceName || "Content"} — 团队\n\n| 名称 | 类型 | 角色 | ID |\n|------|------|------|-----|\n| (待添加) | - | - | - |\n`,
    "TASK.md": (vars) => `# ${vars.spaceName || "Content"} — 任务\n\n## 当前任务\n\n(暂无)\n`,
  },

  "research": {
    "SPACE.md": (vars) => `# ${vars.spaceName || "Research Space"}\n\n## 空间说明\n\n科研协作空间。\n\n## 协作协议（科研）\n\n### 流程\n1. 文献综述 → 实验设计 → 数据采集 → 分析 → 论文撰写\n\n### 文件规范\n- \`papers/\` — 论文\n- \`data/\` — 实验数据\n- \`experiments/\` — 实验配置\n- \`references/\` — 参考文献\n`,
    "TEAM.md": (vars) => `# ${vars.spaceName || "Research"} — 团队\n\n| 名称 | 类型 | 角色 | ID |\n|------|------|------|-----|\n| (待添加) | - | - | - |\n`,
    "TASK.md": (vars) => `# ${vars.spaceName || "Research"} — 任务\n\n## 当前任务\n\n(暂无)\n`,
  },

  "blank": {
    "SPACE.md": (vars) => `# ${vars.spaceName || "Space"}\n\n## 空间说明\n\n(请填写此空间的用途和协作原则)\n`,
    "TEAM.md": (vars) => `# ${vars.spaceName || "Space"} — 团队\n\n| 名称 | 类型 | 角色 | ID |\n|------|------|------|-----|\n| (待添加) | - | - | - |\n`,
    "TASK.md": (vars) => `# ${vars.spaceName || "Space"} — 任务\n\n## 当前任务\n\n(暂无)\n`,
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
