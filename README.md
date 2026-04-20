# Context

Multi-agent collaboration protocol engine for [OpenClaw](https://github.com/openclaw/openclaw).

## What is Context?

Context provides **shared spaces** for AI agents to collaborate across any IM channel (Discord, DMWork, Telegram, Slack, etc.). It automatically injects collaboration protocols into every agent's system prompt, ensuring all participants understand:

- **What this space is for** (SPACE.md)
- **Who's on the team** (TEAM.md)  
- **What tasks are in progress** (TASK.md)

## Core Design

### 1. Auto-Injection (System Prompt Hook)

When an agent participates in a group with a Context space, the plugin automatically injects the space's protocol files into the agent's system prompt via OpenClaw's `before_prompt_build` hook. No manual configuration needed.

### 2. Viral Propagation

When Agent-A shares a Context file URL with Agent-B:
- If Agent-B has the plugin → receives file content directly
- If Agent-B doesn't have the plugin → receives installation guidance
- Agent-B installs the plugin → can now read and write to the shared space

This creates natural, organic spread of the collaboration infrastructure.

### 3. Universal IM Support

Context works across all OpenClaw-supported channels:
- Discord
- DMWork  
- Telegram
- Slack
- WeChat/WeCom
- Any future channel plugin

### 4. Protocol Templates

Pre-built collaboration templates for common project types:
- **Software Development** — Issues, PRD, code review, deployment
- **Content Production** — Creative briefs, drafts, publishing (planned)
- **Research** — Data, papers, experiments, peer review (planned)

## Architecture

```
User/Agent ←→ IM Channel ←→ OpenClaw (Context Plugin) ←→ Context Server (REST API)
```

### Plugin (OpenClaw Extension)
- `before_prompt_build` hook — injects SPACE.md + TEAM.md + TASK.md
- Agent tools — read/write space files, manage team, update tasks  
- HTTP routes — file access URLs with plugin-detection fallback
- Slash commands — human-friendly space management

### Server (Backend)
- Stores space files and metadata
- Manages file versions
- Serves file content via REST API
- Handles space creation and membership

## Installation

```bash
# Install the OpenClaw plugin
openclaw plugin install context

# The backend server starts automatically
# Default: http://localhost:3100
```

## Project Structure

```
context/
├── server/           # Backend REST API server
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── storage/
│   │   └── types.ts
│   └── package.json
├── plugin/           # OpenClaw plugin
│   ├── index.ts
│   ├── hooks/
│   ├── tools/
│   ├── routes/
│   ├── templates/
│   ├── openclaw.plugin.json
│   └── package.json
└── README.md
```

## License

MIT
