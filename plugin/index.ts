/**
 * Context Plugin — Main Entry Point
 *
 * Uses execute + jsonResult pattern (same as bundled plugins like firecrawl).
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
// Inline jsonResult to avoid import path issues with bundled SDK
function jsonResult(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text" as const, text }], details: payload };
}
import { fetchProtocol, buildPromptInjection } from "./hooks/prompt-hook.js";
import { handleContextFileRoute } from "./routes/file-access.js";

const CTX_BASE_DEFAULT = "http://localhost:3100";

async function ctxFetch(serverUrl: string, method: string, path: string, body?: any): Promise<any> {
  const opts: any = {
    method,
    headers: { "Content-Type": "application/json", "X-Context-Plugin": "true" },
    signal: AbortSignal.timeout(8000),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${serverUrl}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default definePluginEntry({
  id: "context",
  name: "context",
  description: "Multi-agent collaboration protocol engine — shared spaces with auto-injected context",

  register(api) {
    const logger = api.logger;
    const pluginConfig = (api.pluginConfig || {}) as { port?: number; serverUrl?: string; autoInject?: boolean };
    const serverUrl = pluginConfig.serverUrl || CTX_BASE_DEFAULT;
    const autoInject = pluginConfig.autoInject !== false;

    // ═══════════════════════════════════════
    // 1. PROMPT HOOK
    // ═══════════════════════════════════════

    if (autoInject) {
      api.on("before_prompt_build", async (_event, ctx) => {
        const channelId = ctx.channelId;
        if (!channelId) return;
        const sessionKey = ctx.sessionKey || "";
        logger.info(`[context] prompt-hook: sessionKey=${sessionKey}, channelId=${channelId}`);
        const cg = extractChannelGroup(sessionKey, channelId);
        if (!cg) return;
        const protocol = await fetchProtocol(cg.channel, cg.groupId);
        if (!protocol) return;
        let spaceId = "";
        try {
          const res = await fetch(
            `${serverUrl}/api/spaces/lookup?channel=${encodeURIComponent(cg.channel)}&groupId=${encodeURIComponent(cg.groupId)}`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (res.ok) { const d = await res.json() as any; spaceId = d.space?.id || ""; }
        } catch {}
        if (!spaceId) return;
        return { appendSystemContext: buildPromptInjection(protocol, spaceId) };
      });
    }

    // ═══════════════════════════════════════
    // 2. AGENT TOOLS (execute + jsonResult pattern)
    // ═══════════════════════════════════════

    api.registerTool({
      name: "context_create_space",
      label: "Create Context Space",
      description: "Create a new Context space for the current group/channel. A Context space enables multi-agent collaboration with shared files, team info, and task tracking.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Space name" },
          channel: { type: "string", description: "Channel type (discord, dmwork, telegram, slack, etc.)" },
          group_id: { type: "string", description: "Group/guild/chat ID" },
          created_by: { type: "string", description: "Creator identifier" },
          template: { type: "string", enum: ["software-dev", "content", "research", "blank"], description: "Project template (default: software-dev)" },
        },
        required: ["name", "channel", "group_id", "created_by"],
      },
      execute: async (_id: string, params: any) => {
        const { name, channel, group_id, created_by, template } = params;
        const data = await ctxFetch(serverUrl, "POST", "/api/spaces", {
          name, channel, groupId: group_id, createdBy: created_by, template: template || "software-dev",
        });
        if (data.existed) return jsonResult({ status: "already_exists", space: data.space });
        return jsonResult({ status: "created", space: data.space, message: "Space created with SPACE.md, TEAM.md, and TASK.md initialized." });
      },
    });

    api.registerTool({
      name: "context_lookup_space",
      label: "Lookup Context Space",
      description: "Look up the Context space associated with a specific channel group. Use this to check if a group already has a shared space.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", description: "Channel type (discord, dmwork, telegram, slack, etc.)" },
          group_id: { type: "string", description: "Group/guild/chat ID" },
        },
        required: ["channel", "group_id"],
      },
      execute: async (_id: string, params: any) => {
        const { channel, group_id } = params;
        try {
          const data = await ctxFetch(serverUrl, "GET", `/api/spaces/lookup?channel=${encodeURIComponent(channel)}&groupId=${encodeURIComponent(group_id)}`);
          return jsonResult({ found: true, space: data.space });
        } catch {
          return jsonResult({ found: false, message: "No Context space found for this group." });
        }
      },
    });

    api.registerTool({
      name: "context_read_file",
      label: "Read Context File",
      description: "Read a file from the shared Context space. Use this to access shared documents, protocol files (SPACE.md, TEAM.md, TASK.md), or any team artifacts.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
          path: { type: "string", description: "File path within the space (e.g., 'SPACE.md', 'docs/prd.md')" },
        },
        required: ["space_id", "path"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id, path } = params;
        const data = await ctxFetch(serverUrl, "GET", `/api/spaces/${space_id}/files/${path}`);
        return jsonResult({ file: { path: data.file.path, content: data.file.content, version: data.file.version, updatedAt: data.file.updatedAt } });
      },
    });

    api.registerTool({
      name: "context_write_file",
      label: "Write Context File",
      description: "Write or update a file in the shared Context space. All your work output should be written here, NOT to local workspace. This ensures all collaborators can access your results.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
          path: { type: "string", description: "File path within the space (e.g., 'docs/design.md')" },
          content: { type: "string", description: "File content" },
          modified_by: { type: "string", description: "Who is writing this file (your agent name or ID)" },
        },
        required: ["space_id", "path", "content", "modified_by"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id, path, content, modified_by } = params;
        const data = await ctxFetch(serverUrl, "PUT", `/api/spaces/${space_id}/files/${path}`, { content, modifiedBy: modified_by });
        return jsonResult({
          success: true,
          file: { path: data.file.path, version: data.file.version, size: data.file.size },
          url: `${serverUrl}/ctx/${space_id}/${path}`,
        });
      },
    });

    api.registerTool({
      name: "context_list_files",
      label: "List Context Files",
      description: "List all files in the shared Context space. Use to see what documents, artifacts, and protocol files exist.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
          prefix: { type: "string", description: "Optional path prefix filter (e.g., 'docs/')" },
        },
        required: ["space_id"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id, prefix } = params;
        const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
        const data = await ctxFetch(serverUrl, "GET", `/api/spaces/${space_id}/files${q}`);
        return jsonResult({ files: data.files.map((f: any) => ({ path: f.path, size: f.size, version: f.version, updatedAt: f.updatedAt })) });
      },
    });

    api.registerTool({
      name: "context_delete_file",
      label: "Delete Context File",
      description: "Delete a file from the shared Context space.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
          path: { type: "string", description: "File path to delete" },
        },
        required: ["space_id", "path"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id, path } = params;
        await ctxFetch(serverUrl, "DELETE", `/api/spaces/${space_id}/files/${path}`);
        return jsonResult({ success: true, message: `Deleted: ${path}` });
      },
    });

    api.registerTool({
      name: "context_get_protocol",
      label: "Get Context Protocol",
      description: "Get all three protocol files (SPACE.md, TEAM.md, TASK.md) at once. Use this to quickly understand the current collaboration state.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
        },
        required: ["space_id"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id } = params;
        const data = await ctxFetch(serverUrl, "GET", `/api/spaces/${space_id}/protocol`);
        return jsonResult(data);
      },
    });

    api.registerTool({
      name: "context_update_task",
      label: "Update Context Task",
      description: "Update the TASK.md file in the shared space. Call this when you start, complete, or make progress on a task.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
          content: { type: "string", description: "New TASK.md content (full replacement)" },
          modified_by: { type: "string", description: "Who is updating (your name/ID)" },
        },
        required: ["space_id", "content", "modified_by"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id, content, modified_by } = params;
        const data = await ctxFetch(serverUrl, "PUT", `/api/spaces/${space_id}/files/TASK.md`, { content, modifiedBy: modified_by });
        return jsonResult({ success: true, version: data.file.version });
      },
    });

    api.registerTool({
      name: "context_add_member",
      label: "Add Context Member",
      description: "Add a team member (human or agent) to the Context space. This updates the member registry.",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
          name: { type: "string", description: "Member display name" },
          type: { type: "string", enum: ["human", "agent"], description: "human or agent" },
          role: { type: "string", description: "Role (e.g., PM, Dev, QA, Design)" },
          channel_user_id: { type: "string", description: "Channel-specific user ID" },
          capabilities: { type: "array", items: { type: "string" }, description: "Skills/tools this member has" },
        },
        required: ["space_id", "name", "type"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id, name, type, role, channel_user_id, capabilities } = params;
        const data = await ctxFetch(serverUrl, "POST", `/api/spaces/${space_id}/members`, {
          name, type, role, channelUserId: channel_user_id, capabilities,
        });
        return jsonResult({ success: true, member: data.member });
      },
    });

    api.registerTool({
      name: "context_list_members",
      label: "List Context Members",
      description: "List all members of the Context space (both humans and agents).",
      parameters: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "Space ID" },
        },
        required: ["space_id"],
      },
      execute: async (_id: string, params: any) => {
        const { space_id } = params;
        const data = await ctxFetch(serverUrl, "GET", `/api/spaces/${space_id}/members`);
        return jsonResult({ members: data.members });
      },
    });

    // ═══════════════════════════════════════
    // 3. HTTP ROUTES
    // ═══════════════════════════════════════

    api.registerHttpRoute({
      path: "/ctx",
      match: "prefix",
      auth: "plugin",
      handler: handleContextFileRoute,
    });

    // ═══════════════════════════════════════
    // 4. SLASH COMMANDS
    // ═══════════════════════════════════════

    api.registerCommand({
      name: "ctx_create",
      description: "🏗️ Create a Context space for this group",
      options: [
        { name: "name", description: "Space name", type: "string", required: false },
        { name: "template", description: "Template: software-dev, content, research, blank", type: "string", required: false },
      ],
      acceptsArgs: true,
      handler: async (_ctx) => ({ text: "🏗️ Use `context_create_space` tool or @me to create a space." }),
    });

    api.registerCommand({ name: "ctx_info", description: "📊 Context space info", handler: async () => ({ text: "📊 Use `context_lookup_space` tool." }) });
    api.registerCommand({ name: "ctx_files", description: "📋 List space files", handler: async () => ({ text: "📋 Use `context_list_files` tool." }) });
    api.registerCommand({ name: "ctx_tasks", description: "📝 Current tasks", handler: async () => ({ text: "📝 Use `context_get_protocol` tool." }) });
    api.registerCommand({ name: "ctx_team", description: "👥 Team members", handler: async () => ({ text: "👥 Use `context_list_members` tool." }) });

    // ═══════════════════════════════════════
    // 5. BOOTSTRAP HOOK
    // ═══════════════════════════════════════

    api.registerHook("agent:bootstrap", async (event) => {
      if (event.type !== "agent" || event.action !== "bootstrap") return;
      logger.info("[context] Agent bootstrap — Context plugin active");
    }, { name: "context-bootstrap" });

    logger.info("[context] ✅ Plugin v0.2.0 registered (10 tools, prompt hook, HTTP routes)");
  },
});

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function extractChannelGroup(sessionKey: string, channelId: string): { channel: string; groupId: string } | null {
  // Discord: agent:main:discord:channel:<channelId>
  // Use channel ID as group identifier (one space per channel)
  const discordChannelMatch = sessionKey.match(/discord:channel:(\d+)/);
  if (discordChannelMatch) return { channel: "discord", groupId: discordChannelMatch[1] };
  // Discord alternative: agent:main:discord:guild:<guildId>
  const discordGuildMatch = sessionKey.match(/discord:guild:(\d+)/);
  if (discordGuildMatch) return { channel: "discord", groupId: discordGuildMatch[1] };

  // DMWork: agent:main:dmwork:group:<uuid>
  const dmworkMatch = sessionKey.match(/dmwork:group:([a-f0-9]+)/);
  if (dmworkMatch) return { channel: "dmwork", groupId: dmworkMatch[1] };
  // DMWork DM: agent:main:dmwork:default:direct:<uuid> — skip (not a group)
  if (sessionKey.includes("dmwork:default:direct:")) return null;

  // Telegram: agent:main:telegram:<chatId>
  const telegramMatch = sessionKey.match(/telegram:(-?\d+)/);
  if (telegramMatch) return { channel: "telegram", groupId: telegramMatch[1] };

  // Slack: agent:main:slack:<teamId>:<channelId>
  const slackMatch = sessionKey.match(/slack:(\w+):(\w+)/);
  if (slackMatch) return { channel: "slack", groupId: `${slackMatch[1]}:${slackMatch[2]}` };

  // Fallback: try channelId
  if (channelId && channelId.includes(":")) {
    const parts = channelId.split(":");
    if (parts.length >= 2) return { channel: parts[0], groupId: parts[1] };
  }
  return null;
}
