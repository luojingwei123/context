/**
 * Context Plugin — Main Entry Point
 *
 * Registers:
 * 1. before_prompt_build hook — injects protocol files into system prompt
 * 2. Agent tools — for AI to read/write shared space
 * 3. HTTP routes — for viral propagation (file access URLs)
 * 4. Slash commands — for human interaction
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { fetchProtocol, buildPromptInjection } from "./hooks/prompt-hook.js";
import { tools } from "./tools/index.js";
import { handleContextFileRoute } from "./routes/file-access.js";

const CTX_BASE_DEFAULT = "http://localhost:3100";

export default definePluginEntry({
  id: "context",
  name: "Context",
  description: "Multi-agent collaboration protocol engine — shared spaces with auto-injected context",

  register(api) {
    const logger = api.logger;
    const pluginConfig = (api.pluginConfig || {}) as { port?: number; serverUrl?: string; autoInject?: boolean };
    const serverUrl = pluginConfig.serverUrl || CTX_BASE_DEFAULT;
    const autoInject = pluginConfig.autoInject !== false;

    // ═══════════════════════════════════════
    // 1. PROMPT HOOK — Auto-inject collaboration context
    // ═══════════════════════════════════════

    if (autoInject) {
      api.on("before_prompt_build", async (event, ctx) => {
        // Only inject for group sessions with a channel
        const channelId = ctx.channelId;
        if (!channelId) return;

        // We need group context — extract from session metadata
        // The sessionKey often contains channel:groupId info
        const sessionKey = ctx.sessionKey || "";

        // Try to extract channel and group from session context
        // Format varies: "discord:guild:123:channel:456", "dmwork:group:789", etc.
        const channelGroupInfo = extractChannelGroup(sessionKey, channelId);
        if (!channelGroupInfo) return;

        const protocol = await fetchProtocol(channelGroupInfo.channel, channelGroupInfo.groupId);
        if (!protocol) return;

        // Look up space ID for URL generation
        let spaceId = "";
        try {
          const res = await fetch(
            `${serverUrl}/api/spaces/lookup?channel=${encodeURIComponent(channelGroupInfo.channel)}&groupId=${encodeURIComponent(channelGroupInfo.groupId)}`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (res.ok) {
            const data = await res.json() as any;
            spaceId = data.space?.id || "";
          }
        } catch {}

        if (!spaceId) return;

        const injection = buildPromptInjection(protocol, spaceId);

        return {
          appendSystemContext: injection,
        };
      });
    }

    // ═══════════════════════════════════════
    // 2. AGENT TOOLS
    // ═══════════════════════════════════════

    for (const tool of tools) {
      api.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        handler: tool.handler,
      });
    }

    // ═══════════════════════════════════════
    // 3. HTTP ROUTES — Viral propagation
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
      handler: async (ctx) => {
        // Implementation will resolve channel/group from ctx
        return { text: "🏗️ Use the agent tool `context_create_space` to create a space, or I'll detect the group automatically." };
      },
    });

    api.registerCommand({
      name: "ctx_info",
      description: "📊 Show Context space info for this group",
      handler: async (ctx) => {
        return { text: "📊 Checking space info..." };
      },
    });

    api.registerCommand({
      name: "ctx_files",
      description: "📋 List files in this group's Context space",
      handler: async (ctx) => {
        return { text: "📋 Listing files..." };
      },
    });

    api.registerCommand({
      name: "ctx_tasks",
      description: "📝 Show current tasks from TASK.md",
      handler: async (ctx) => {
        return { text: "📝 Fetching tasks..." };
      },
    });

    api.registerCommand({
      name: "ctx_team",
      description: "👥 Show team members from TEAM.md",
      handler: async (ctx) => {
        return { text: "👥 Fetching team..." };
      },
    });

    // ═══════════════════════════════════════
    // 5. AGENT BOOTSTRAP HOOK
    // ═══════════════════════════════════════

    // When this plugin is installed, guide the agent on how to use Context
    api.registerHook("agent:bootstrap", async (event) => {
      if (event.type !== "agent" || event.action !== "bootstrap") return;
      // We could modify AGENTS.md here to add Context guidelines
      // For now, the prompt hook handles the injection
      logger.info("[context] Agent bootstrap — Context plugin active");
    });

    logger.info(`[context] ✅ Plugin v0.1.0 registered (${tools.length} tools, prompt hook, HTTP routes)`);
  },
});

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

/**
 * Extract channel type and group ID from session key or channel ID.
 * Session keys vary by channel:
 *   discord: "discord:guild:<guildId>:..."
 *   dmwork:  "dmwork:group:<groupNo>:..."
 *   telegram: "telegram:<chatId>:..."
 *   slack: "slack:<teamId>:<channelId>:..."
 */
function extractChannelGroup(sessionKey: string, channelId: string): { channel: string; groupId: string } | null {
  // Try discord
  const discordMatch = sessionKey.match(/discord:guild:(\d+)/);
  if (discordMatch) return { channel: "discord", groupId: discordMatch[1] };

  // Try dmwork
  const dmworkMatch = sessionKey.match(/dmwork:group:(\d+)/);
  if (dmworkMatch) return { channel: "dmwork", groupId: dmworkMatch[1] };

  // Try telegram
  const telegramMatch = sessionKey.match(/telegram:(-?\d+)/);
  if (telegramMatch) return { channel: "telegram", groupId: telegramMatch[1] };

  // Try slack
  const slackMatch = sessionKey.match(/slack:(\w+):(\w+)/);
  if (slackMatch) return { channel: "slack", groupId: `${slackMatch[1]}:${slackMatch[2]}` };

  // Fallback: use channelId directly if it looks like a group identifier
  if (channelId && channelId.includes(":")) {
    const parts = channelId.split(":");
    if (parts.length >= 2) return { channel: parts[0], groupId: parts[1] };
  }

  return null;
}
