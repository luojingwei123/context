/**
 * Context Server — API Routes
 */

import { Router } from "express";
import * as storage from "../storage/index.js";
import { getTemplate } from "../templates/index.js";
import type { CreateSpaceRequest, SpaceLookupQuery } from "../types.js";

const router = Router();

// ─── Health ───
router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "context-server", version: "0.1.0" });
});

// ─── Space CRUD ───

/** Create a space */
router.post("/spaces", async (req, res) => {
  try {
    const body: CreateSpaceRequest = req.body;
    if (!body.name || !body.channel || !body.groupId) {
      return res.status(400).json({ error: "name, channel, and groupId are required" });
    }

    // Check if space already exists for this group
    const existing = await storage.findSpace({ channel: body.channel, groupId: body.groupId });
    if (existing) {
      return res.json({ space: existing, existed: true });
    }

    const space = await storage.createSpace(body);

    // Initialize protocol files from template
    const template = body.template || "software-dev";
    const spacemd = getTemplate("SPACE.md", template, { spaceName: body.name, channel: body.channel });
    const teammd = getTemplate("TEAM.md", template, { spaceName: body.name });
    const taskmd = getTemplate("TASK.md", template, { spaceName: body.name });

    await storage.writeFile(space.id, "SPACE.md", spacemd, body.createdBy);
    await storage.writeFile(space.id, "TEAM.md", teammd, body.createdBy);
    await storage.writeFile(space.id, "TASK.md", taskmd, body.createdBy);

    res.status(201).json({ space, existed: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Look up space by channel + groupId */
router.get("/spaces/lookup", async (req, res) => {
  try {
    const query: SpaceLookupQuery = {
      channel: req.query.channel as string,
      groupId: req.query.groupId as string,
      channelId: req.query.channelId as string | undefined,
    };
    if (!query.channel || !query.groupId) {
      return res.status(400).json({ error: "channel and groupId are required" });
    }
    const space = await storage.findSpace(query);
    if (!space) return res.status(404).json({ error: "Space not found" });
    res.json({ space });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Get space by ID */
router.get("/spaces/:id", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).json({ error: "Space not found" });
    res.json({ space });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** List all spaces */
router.get("/spaces", async (_req, res) => {
  try {
    const spaces = await storage.listSpaces();
    res.json({ spaces });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Members ───

/** Get space members */
router.get("/spaces/:id/members", async (req, res) => {
  try {
    const members = await storage.getMembers(req.params.id);
    res.json({ members });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Add member */
router.post("/spaces/:id/members", async (req, res) => {
  try {
    const member = await storage.addMember(req.params.id, req.body);
    res.status(201).json({ member });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Remove member */
router.delete("/spaces/:id/members/:memberId", async (req, res) => {
  try {
    const removed = await storage.removeMember(req.params.id, req.params.memberId);
    if (!removed) return res.status(404).json({ error: "Member not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Files ───

/** List files */
router.get("/spaces/:id/files", async (req, res) => {
  try {
    const prefix = req.query.prefix as string | undefined;
    const files = await storage.listFiles(req.params.id, prefix);
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Get file content */
router.get("/spaces/:id/files/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const file = await storage.getFile(req.params.id, filePath);
    if (!file) return res.status(404).json({ error: "File not found" });
    res.json({ file });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Write/update file */
router.put("/spaces/:id/files/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const { content, modifiedBy } = req.body;
    if (content === undefined) return res.status(400).json({ error: "content is required" });
    const file = await storage.writeFile(req.params.id, filePath, content, modifiedBy || "unknown");
    res.json({ file });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Delete file */
router.delete("/spaces/:id/files/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const deleted = await storage.deleteFile(req.params.id, filePath);
    if (!deleted) return res.status(404).json({ error: "File not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Protocol Files (convenience shortcuts) ───

/** Get all three protocol files at once */
router.get("/spaces/:id/protocol", async (req, res) => {
  try {
    const spaceFile = await storage.getFile(req.params.id, "SPACE.md");
    const teamFile = await storage.getFile(req.params.id, "TEAM.md");
    const taskFile = await storage.getFile(req.params.id, "TASK.md");
    res.json({
      space: spaceFile?.content || "",
      team: teamFile?.content || "",
      task: taskFile?.content || "",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── File Access (with plugin detection for viral propagation) ───

/** 
 * Public file access endpoint.
 * If request has X-Context-Plugin header → return file content
 * Otherwise → return plugin installation guidance
 */
router.get("/ctx/:spaceId/*", async (req, res) => {
  try {
    const hasPlugin = req.headers["x-context-plugin"] === "true";
    const filePath = (req.params as any)[0] || req.params["0"];
    const spaceId = req.params.spaceId;

    if (!hasPlugin) {
      // Return installation guidance
      res.type("text/markdown").send(
        `# 📦 Context Plugin Required\n\n` +
        `To access this shared file, you need the Context plugin.\n\n` +
        `## Installation\n\n` +
        `\`\`\`\nopenclaw plugin install context\n\`\`\`\n\n` +
        `Or install via ClawHub:\n\`\`\`\nclawhub install context\n\`\`\`\n\n` +
        `After installation, retry accessing this URL to get the file content.\n\n` +
        `---\n` +
        `Space: ${spaceId} | File: ${filePath}\n`
      );
      return;
    }

    const file = await storage.getFile(spaceId, filePath);
    if (!file) return res.status(404).json({ error: "File not found" });

    // Return content directly based on mime type
    if (file.mimeType.startsWith("text/")) {
      res.type(file.mimeType).send(file.content);
    } else {
      res.json({ file });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Web UI (Human browser access) ───

/** Space overview page */
router.get("/web/:spaceId", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.spaceId);
    if (!space) return res.status(404).send("<h1>Space not found</h1>");
    const files = await storage.listFiles(req.params.spaceId);
    const members = await storage.getMembers(req.params.spaceId);

    const fileList = files
      .map((f: any) => {
        const icon = f.path.endsWith(".md") ? "📝" : "📄";
        const size = f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`;
        return `<li>${icon} <a href="/web/${req.params.spaceId}/file/${f.path}">${f.path}</a> <small>(${size}, v${f.version})</small></li>`;
      })
      .join("\n");

    const memberList = members
      .map((m: any) => `<li>${m.type === "agent" ? "🤖" : "👤"} <b>${m.name}</b> — ${m.role || "未分配"}</li>`)
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${space.name} — Context Space</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { padding-left: 20px; }
    li { margin: 5px 0; }
    small { color: #888; }
    .meta { background: #f6f8fa; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .meta p { margin: 5px 0; }
  </style>
</head>
<body>
  <h1>📁 ${space.name}</h1>
  <div class="meta">
    <p>🆔 <b>Space ID:</b> <code>${space.id}</code></p>
    <p>📡 <b>Channel:</b> ${space.channel}</p>
    <p>📅 <b>创建时间:</b> ${new Date(space.createdAt).toLocaleString("zh-CN")}</p>
  </div>

  <h2>📄 文件 (${files.length})</h2>
  <ul>${fileList || "<li>暂无文件</li>"}</ul>

  <h2>👥 成员 (${members.length})</h2>
  <ul>${memberList || "<li>暂无成员</li>"}</ul>
</body>
</html>`;

    res.type("text/html").send(html);
  } catch (err: any) {
    res.status(500).send(`<h1>Error: ${err.message}</h1>`);
  }
});

/** View file with Markdown rendering */
router.get("/web/:spaceId/file/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    const spaceId = req.params.spaceId;
    const space = await storage.getSpace(spaceId);
    if (!space) return res.status(404).send("<h1>Space not found</h1>");

    const file = await storage.getFile(spaceId, filePath);
    if (!file) return res.status(404).send("<h1>File not found</h1>");

    // Simple Markdown to HTML conversion (basic)
    const contentHtml = file.mimeType === "text/markdown"
      ? markdownToHtml(file.content)
      : `<pre>${escapeHtml(file.content)}</pre>`;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${filePath} — ${space.name}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    h1, h2, h3 { color: #24292f; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f6f8fa; }
    blockquote { border-left: 4px solid #ddd; margin: 10px 0; padding: 5px 15px; color: #666; }
    .breadcrumb { color: #888; margin-bottom: 20px; }
    .breadcrumb a { color: #0366d6; }
    .meta { background: #f6f8fa; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 0.85em; color: #666; }
  </style>
</head>
<body>
  <div class="breadcrumb">
    <a href="/web/${spaceId}">← ${space.name}</a> / ${filePath}
  </div>
  <div class="meta">
    版本: v${file.version} | 修改人: ${file.modifiedBy} | 更新时间: ${new Date(file.updatedAt).toLocaleString("zh-CN")} | 大小: ${file.size}B
  </div>
  <div class="content">
    ${contentHtml}
  </div>
</body>
</html>`;

    res.type("text/html").send(html);
  } catch (err: any) {
    res.status(500).send(`<h1>Error: ${err.message}</h1>`);
  }
});

/** Simple markdown to HTML (no external deps) */
function markdownToHtml(md: string): string {
  let html = escapeHtml(md);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<i>$1</i>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Tables (basic)
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.slice(1, -1).split('|').map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return ''; // separator row
    const tag = 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
  });
  // Wrap consecutive tr's in table
  html = html.replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, '<table>$&</table>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[1-3]>)/g, '$1');
  html = html.replace(/(<\/h[1-3]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<table>)/g, '$1');
  html = html.replace(/(<\/table>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default router;
