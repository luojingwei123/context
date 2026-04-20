/**
 * Context Server — API Routes (v1.1)
 *
 * 两套访问入口：
 * - /api/*  → JSON REST API（给 Agent tools / 插件调用）
 * - /s/*    → Web UI（给人类浏览器）
 * - /ctx/*  → 智能分流（浏览器→渲染页面，Agent→JSON/原文）
 */

import { Router } from "express";
import * as storage from "../storage/index.js";
import { getTemplate } from "../templates/index.js";
import type { CreateSpaceRequest, SpaceLookupQuery } from "../types.js";

const router = Router();

// ════════════════════════════════════════════════════════════════
// API Routes (JSON，给 Agent / Plugin 调用)
// ════════════════════════════════════════════════════════════════

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "context-server", version: "1.1.0" });
});

// ─── Space CRUD ───

router.post("/spaces", async (req, res) => {
  try {
    const body: CreateSpaceRequest = req.body;
    if (!body.name || !body.channel || !body.groupId) {
      return res.status(400).json({ error: "name, channel, and groupId are required" });
    }
    const existing = await storage.findSpace({ channel: body.channel, groupId: body.groupId });
    if (existing) return res.json({ space: existing, existed: true });

    const space = await storage.createSpace(body);
    const template = body.template || "software-dev";
    await storage.writeFile(space.id, "SPACE.md", getTemplate("SPACE.md", template, { spaceName: body.name, channel: body.channel }), body.createdBy);
    await storage.writeFile(space.id, "TEAM.md", getTemplate("TEAM.md", template, { spaceName: body.name }), body.createdBy);
    await storage.writeFile(space.id, "TASK.md", getTemplate("TASK.md", template, { spaceName: body.name }), body.createdBy);
    res.status(201).json({ space, existed: false });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/spaces/lookup", async (req, res) => {
  try {
    const query: SpaceLookupQuery = { channel: req.query.channel as string, groupId: req.query.groupId as string };
    if (!query.channel || !query.groupId) return res.status(400).json({ error: "channel and groupId are required" });
    const space = await storage.findSpace(query);
    if (!space) return res.status(404).json({ error: "Space not found" });
    res.json({ space });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/spaces/:id", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).json({ error: "Space not found" });
    res.json({ space });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/spaces", async (_req, res) => {
  try { res.json({ spaces: await storage.listSpaces() }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Members ───

router.get("/spaces/:id/members", async (req, res) => {
  try { res.json({ members: await storage.getMembers(req.params.id) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/spaces/:id/members", async (req, res) => {
  try { res.status(201).json({ member: await storage.addMember(req.params.id, req.body) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/spaces/:id/members/:memberId", async (req, res) => {
  try {
    const removed = await storage.removeMember(req.params.id, req.params.memberId);
    if (!removed) return res.status(404).json({ error: "Member not found" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Files ───

router.get("/spaces/:id/files", async (req, res) => {
  try { res.json({ files: await storage.listFiles(req.params.id, req.query.prefix as string | undefined) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/spaces/:id/files/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const file = await storage.getFile(req.params.id, filePath);
    if (!file) return res.status(404).json({ error: "File not found" });
    res.json({ file });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/spaces/:id/files/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const { content, modifiedBy } = req.body;
    if (content === undefined) return res.status(400).json({ error: "content is required" });
    res.json({ file: await storage.writeFile(req.params.id, filePath, content, modifiedBy || "unknown") });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/spaces/:id/files/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const deleted = await storage.deleteFile(req.params.id, filePath);
    if (!deleted) return res.status(404).json({ error: "File not found" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Protocol (convenience) ───

router.get("/spaces/:id/protocol", async (req, res) => {
  try {
    const [s, t, k] = await Promise.all([
      storage.getFile(req.params.id, "SPACE.md"),
      storage.getFile(req.params.id, "TEAM.md"),
      storage.getFile(req.params.id, "TASK.md"),
    ]);
    res.json({ space: s?.content || "", team: t?.content || "", task: k?.content || "" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});


// ════════════════════════════════════════════════════════════════
// /ctx/* — 智能分流（裂变传播入口）
// ════════════════════════════════════════════════════════════════
//
// 浏览器 (Accept: text/html) → 渲染成网页
// Agent 有插件 (X-Context-Plugin: true) → 返回文件原文
// Agent 无插件 → 返回文件内容 + 安装提示（让它能看到内容的同时知道可以装插件）

router.get("/ctx/:spaceId", async (req, res) => {
  // Space overview
  const spaceId = req.params.spaceId;
  const wantsHtml = (req.headers.accept || "").includes("text/html");

  try {
    const space = await storage.getSpace(spaceId);
    if (!space) return res.status(404).send(wantsHtml ? notFoundPage("Space not found") : "Space not found");

    if (wantsHtml) {
      return res.type("text/html").send(await renderSpacePage(spaceId, space));
    }
    // API response
    const files = await storage.listFiles(spaceId);
    res.json({ space, files: files.map((f: any) => ({ path: f.path, size: f.size })) });
  } catch (err: any) { res.status(500).send(err.message); }
});

router.get("/ctx/:spaceId/*", async (req, res) => {
  const spaceId = req.params.spaceId;
  const filePath = (req.params as any)[0] || req.params["0"];
  const wantsHtml = (req.headers.accept || "").includes("text/html");
  const hasPlugin = req.headers["x-context-plugin"] === "true";

  try {
    const space = await storage.getSpace(spaceId);
    if (!space) return res.status(404).send(wantsHtml ? notFoundPage("Space not found") : "Space not found");

    const file = await storage.getFile(spaceId, filePath);
    if (!file) return res.status(404).send(wantsHtml ? notFoundPage(`File not found: ${filePath}`) : "File not found");

    if (wantsHtml) {
      // Human browser → rendered page with edit button
      return res.type("text/html").send(renderFilePage(space, file, spaceId, filePath));
    }

    if (hasPlugin) {
      // Agent with plugin → raw content
      return res.type(file.mimeType).send(file.content);
    }

    // Agent without plugin → content + install hint
    const hint = `\n\n---\n💡 Install the Context plugin for better integration:\n\`\`\`\nopenclaw plugin install context\n\`\`\`\nThis enables auto-injected collaboration context in every conversation.\n`;
    return res.type("text/markdown").send(file.content + hint);
  } catch (err: any) { res.status(500).send(err.message); }
});


// ════════════════════════════════════════════════════════════════
// /s/* — Web UI（人类浏览器完整功能）
// ════════════════════════════════════════════════════════════════

/** Home: list all spaces */
router.get("/s", async (_req, res) => {
  try {
    const spaces = await storage.listSpaces();
    const items = spaces.map((s: any) => 
      `<li><a href="/s/${s.id}">📁 <b>${esc(s.name)}</b></a> <small>(${s.channel} · ${new Date(s.createdAt).toLocaleDateString("zh-CN")})</small></li>`
    ).join("\n");
    res.type("text/html").send(page("Context Spaces", `
      <h1>📦 Context Spaces</h1>
      <ul>${items || "<li>暂无空间</li>"}</ul>
      <hr>
      <h3>➕ 创建新空间</h3>
      <form method="POST" action="/s/create">
        <label>名称: <input name="name" required></label><br>
        <label>Channel: <select name="channel"><option>discord</option><option>dmwork</option><option>telegram</option><option>slack</option></select></label><br>
        <label>Group ID: <input name="groupId" required></label><br>
        <label>模板: <select name="template"><option value="software-dev">软件开发</option><option value="content">内容生产</option><option value="research">科研</option><option value="blank">空白</option></select></label><br>
        <label>创建者: <input name="createdBy" value="web-user"></label><br><br>
        <button type="submit">创建</button>
      </form>
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Create space (form POST) */
router.post("/s/create", async (req, res) => {
  try {
    const { name, channel, groupId, template, createdBy } = req.body;
    if (!name || !channel || !groupId) return res.status(400).send("name, channel, groupId required");

    const existing = await storage.findSpace({ channel, groupId });
    if (existing) return res.redirect(`/s/${existing.id}`);

    const space = await storage.createSpace({ name, channel, groupId, createdBy: createdBy || "web-user" });
    const tmpl = template || "software-dev";
    await storage.writeFile(space.id, "SPACE.md", getTemplate("SPACE.md", tmpl, { spaceName: name, channel }), createdBy || "web-user");
    await storage.writeFile(space.id, "TEAM.md", getTemplate("TEAM.md", tmpl, { spaceName: name }), createdBy || "web-user");
    await storage.writeFile(space.id, "TASK.md", getTemplate("TASK.md", tmpl, { spaceName: name }), createdBy || "web-user");
    res.redirect(`/s/${space.id}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Space overview */
router.get("/s/:id", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    res.type("text/html").send(await renderSpacePage(req.params.id, space));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** View file */
router.get("/s/:id/view/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    const file = await storage.getFile(req.params.id, filePath);
    if (!file) return res.status(404).send(notFoundPage(`File not found: ${filePath}`));
    res.type("text/html").send(renderFilePage(space, file, req.params.id, filePath));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Edit file form */
router.get("/s/:id/edit/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    const file = await storage.getFile(req.params.id, filePath);
    const content = file?.content || "";
    res.type("text/html").send(page(`编辑 ${filePath}`, `
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> / 编辑: ${esc(filePath)}</div>
      <form method="POST" action="/s/${req.params.id}/save/${filePath}">
        <textarea name="content" style="width:100%;height:500px;font-family:monospace;font-size:14px;padding:12px;">${esc(content)}</textarea><br>
        <label>修改人: <input name="modifiedBy" value="web-user"></label>
        <button type="submit" style="margin-left:10px;">💾 保存</button>
        <a href="/s/${req.params.id}/view/${filePath}" style="margin-left:10px;">取消</a>
      </form>
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Save file (form POST) */
router.post("/s/:id/save/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    const { content, modifiedBy } = req.body;
    await storage.writeFile(req.params.id, filePath, content || "", modifiedBy || "web-user");
    res.redirect(`/s/${req.params.id}/view/${filePath}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** New file form */
router.get("/s/:id/new", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    res.type("text/html").send(page("新建文件", `
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> / 新建文件</div>
      <form method="POST" action="/s/${req.params.id}/create-file">
        <label>文件路径: <input name="path" placeholder="docs/design.md" required style="width:300px;"></label><br><br>
        <textarea name="content" style="width:100%;height:400px;font-family:monospace;font-size:14px;padding:12px;" placeholder="在此输入文件内容..."></textarea><br>
        <label>创建者: <input name="modifiedBy" value="web-user"></label>
        <button type="submit" style="margin-left:10px;">📄 创建文件</button>
      </form>
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Create file (form POST) */
router.post("/s/:id/create-file", async (req, res) => {
  try {
    const { path: filePath, content, modifiedBy } = req.body;
    if (!filePath) return res.status(400).send("path required");
    await storage.writeFile(req.params.id, filePath, content || "", modifiedBy || "web-user");
    res.redirect(`/s/${req.params.id}/view/${filePath}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Delete file */
router.post("/s/:id/delete/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    await storage.deleteFile(req.params.id, filePath);
    res.redirect(`/s/${req.params.id}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Upload file (multipart form) */
router.post("/s/:id/upload", async (req, res) => {
  try {
    // Handle raw text upload (form with path + content)
    const { path: filePath, content, modifiedBy } = req.body;
    if (!filePath) return res.status(400).send("path required");
    await storage.writeFile(req.params.id, filePath, content || "", modifiedBy || "web-user");
    res.redirect(`/s/${req.params.id}`);
  } catch (err: any) { res.status(500).send(err.message); }
});


// ════════════════════════════════════════════════════════════════
// HTML Rendering Helpers
// ════════════════════════════════════════════════════════════════

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1f2328; background: #fff; }
  h1 { border-bottom: 1px solid #d1d9e0; padding-bottom: 12px; }
  h2 { color: #24292f; margin-top: 30px; }
  a { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; border: 1px solid #d1d9e0; }
  code { background: #eff1f3; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  th, td { border: 1px solid #d1d9e0; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  ul { padding-left: 20px; }
  li { margin: 5px 0; }
  small { color: #656d76; }
  .breadcrumb { color: #656d76; margin-bottom: 20px; font-size: 14px; }
  .breadcrumb a { color: #0969da; }
  .meta { background: #f6f8fa; padding: 12px 16px; border-radius: 6px; margin: 16px 0; border: 1px solid #d1d9e0; font-size: 0.85em; color: #656d76; }
  .meta b { color: #1f2328; }
  .actions { margin: 16px 0; }
  .actions a, .actions button { 
    display: inline-block; padding: 6px 14px; border-radius: 6px; font-size: 13px; 
    border: 1px solid #d1d9e0; background: #f6f8fa; color: #24292f; cursor: pointer; margin-right: 8px; text-decoration: none;
  }
  .actions a:hover, .actions button:hover { background: #eaeef2; text-decoration: none; }
  .actions .primary { background: #2da44e; color: #fff; border-color: #2da44e; }
  .actions .primary:hover { background: #298e46; }
  .actions .danger { color: #cf222e; border-color: #cf222e; }
  .actions .danger:hover { background: #cf222e; color: #fff; }
  .file-list { list-style: none; padding: 0; }
  .file-list li { padding: 8px 12px; border-bottom: 1px solid #d1d9e0; display: flex; align-items: center; justify-content: space-between; }
  .file-list li:hover { background: #f6f8fa; }
  .file-list .file-info { display: flex; align-items: center; gap: 8px; }
  .file-list .file-meta { font-size: 12px; color: #656d76; }
  textarea { border: 1px solid #d1d9e0; border-radius: 6px; resize: vertical; }
  input, select { padding: 6px 10px; border: 1px solid #d1d9e0; border-radius: 6px; }
  button { padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid #d1d9e0; }
  form label { display: inline-block; margin: 8px 0; }
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Context</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function notFoundPage(msg: string): string {
  return page("Not Found", `<h1>404</h1><p>${esc(msg)}</p><a href="/s">← 回到首页</a>`);
}

async function renderSpacePage(spaceId: string, space: any): Promise<string> {
  const files = await storage.listFiles(spaceId);
  const members = await storage.getMembers(spaceId);

  const fileItems = files.map((f: any) => {
    const icon = f.path.endsWith(".md") ? "📝" : "📄";
    const size = f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`;
    return `<li>
      <div class="file-info">${icon} <a href="/s/${spaceId}/view/${f.path}">${esc(f.path)}</a></div>
      <div class="file-meta">${size} · v${f.version} · ${f.modifiedBy || ""}</div>
    </li>`;
  }).join("");

  const memberItems = members.map((m: any) =>
    `<li>${m.type === "agent" ? "🤖" : "👤"} <b>${esc(m.name)}</b> — ${esc(m.role || "未分配")} ${m.capabilities?.length ? `<small>(${m.capabilities.join(", ")})</small>` : ""}</li>`
  ).join("");

  return page(space.name, `
    <h1>📁 ${esc(space.name)}</h1>
    <div class="meta">
      <b>Space ID:</b> <code>${spaceId}</code> · <b>Channel:</b> ${esc(space.channel)} · <b>创建:</b> ${new Date(space.createdAt).toLocaleDateString("zh-CN")}
    </div>

    <h2>📄 文件 (${files.length})</h2>
    <div class="actions">
      <a href="/s/${spaceId}/new" class="primary">➕ 新建文件</a>
    </div>
    <ul class="file-list">${fileItems || "<li>暂无文件</li>"}</ul>

    <h2>👥 成员 (${members.length})</h2>
    <ul>${memberItems || "<li>暂无成员。通过 Agent 工具 <code>context_add_member</code> 添加。</li>"}</ul>

    <hr>
    <h3>🔗 分享地址</h3>
    <p>
      <b>AI Agent:</b> <code>http://localhost:3100/ctx/${spaceId}/文件路径</code><br>
      <b>人类浏览器:</b> <code>http://localhost:3100/s/${spaceId}</code>
    </p>
    <p><a href="/s">← 所有空间</a></p>
  `);
}

function renderFilePage(space: any, file: any, spaceId: string, filePath: string): string {
  const contentHtml = file.mimeType === "text/markdown"
    ? mdToHtml(file.content)
    : `<pre>${esc(file.content)}</pre>`;

  return page(`${filePath} — ${space.name}`, `
    <div class="breadcrumb"><a href="/s/${spaceId}">← ${esc(space.name)}</a> / ${esc(filePath)}</div>
    <div class="meta">
      版本: v${file.version} · 修改: ${esc(file.modifiedBy || "unknown")} · 时间: ${new Date(file.updatedAt).toLocaleString("zh-CN")} · 大小: ${file.size}B
    </div>
    <div class="actions">
      <a href="/s/${spaceId}/edit/${filePath}">✏️ 编辑</a>
      <form method="POST" action="/s/${spaceId}/delete/${filePath}" style="display:inline;" onsubmit="return confirm('确定删除 ${esc(filePath)}？')">
        <button type="submit" class="danger">🗑️ 删除</button>
      </form>
    </div>
    <div class="content">${contentHtml}</div>
  `);
}

// ─── Markdown → HTML (basic, no deps) ───

function mdToHtml(md: string): string {
  let h = esc(md);
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Tables
  h = h.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.slice(1, -1).split('|').map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return '';
    return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
  });
  h = h.replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, '<table>$&</table>');
  // Lists
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>');
  h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Paragraphs
  h = h.replace(/\n\n/g, '</p><p>');
  h = '<p>' + h + '</p>';
  h = h.replace(/<p>\s*<\/p>/g, '');
  h = h.replace(/<p>\s*(<[hH][1-4]>)/g, '$1');
  h = h.replace(/(<\/[hH][1-4]>)\s*<\/p>/g, '$1');
  h = h.replace(/<p>\s*(<pre>)/g, '$1');
  h = h.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  h = h.replace(/<p>\s*(<ul>)/g, '$1');
  h = h.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  h = h.replace(/<p>\s*(<table>)/g, '$1');
  h = h.replace(/(<\/table>)\s*<\/p>/g, '$1');
  return h;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default router;
