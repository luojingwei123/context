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
import * as menuRegistry from "../menu/index.js";
import type { CreateSpaceRequest, SpaceLookupQuery } from "../types.js";

const router = Router();

/** Get base URL from request (handles proxied environments) */
function getBaseUrl(req: any): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost:3100";
  return `${proto}://${host}`;
}

// ════════════════════════════════════════════════════════════════
// API Routes (JSON，给 Agent / Plugin 调用)
// ════════════════════════════════════════════════════════════════

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "context-server",
    version: "1.5.0",
    pluginVersion: "1.0.8",
    updateCommand: "clawhub update context-collab --force",
  });
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

/** Delete a space */
router.delete("/spaces/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteSpace(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Space not found" });
    res.json({ success: true, message: "Space deleted" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Update space settings (webhook, name, etc.) */
router.patch("/spaces/:id", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).json({ error: "Space not found" });
    const { webhookUrl, name } = req.body;
    if (webhookUrl !== undefined) space.webhookUrl = webhookUrl;
    if (name) space.name = name;
    space.updatedAt = new Date().toISOString();
    await storage.updateSpace(req.params.id, space);
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

/** Search files by content */
router.get("/spaces/:id/search", async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: "q (search query) required" });
    const results = await storage.searchFiles(req.params.id, q);
    res.json({ query: q, results, totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/spaces/:id/files/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const file = await storage.getFile(req.params.id, filePath);
    if (!file) return res.status(404).json({ error: "File not found" });
    // Include open annotations so AI can see human feedback
    const annotations = await storage.getAnnotations(req.params.id, filePath, "open");
    res.json({ file, annotations: annotations.length > 0 ? annotations : undefined });
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

// ─── Annotations API ───

/** List annotations for a file (or all in space) */
router.get("/spaces/:id/annotations", async (req, res) => {
  try {
    const filePath = req.query.file as string | undefined;
    const status = req.query.status as string | undefined;
    const anns = await storage.getAnnotations(req.params.id, filePath, status);
    res.json({ annotations: anns });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Add annotation */
router.post("/spaces/:id/annotations", async (req, res) => {
  try {
    const { filePath, line, endLine, content, author, authorType } = req.body;
    if (!filePath || !content || !author) return res.status(400).json({ error: "filePath, content, author required" });
    const ann = await storage.addAnnotation(req.params.id, {
      filePath, line: line || 0, endLine: endLine || 0, content, author, authorType: authorType || "human",
    });
    res.status(201).json({ annotation: ann });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Resolve annotation */
router.put("/spaces/:id/annotations/:annId/resolve", async (req, res) => {
  try {
    const { resolvedBy } = req.body;
    const ann = await storage.resolveAnnotation(req.params.id, req.params.annId, resolvedBy || "unknown");
    if (!ann) return res.status(404).json({ error: "Annotation not found" });
    res.json({ annotation: ann });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Delete annotation */
router.delete("/spaces/:id/annotations/:annId", async (req, res) => {
  try {
    const deleted = await storage.deleteAnnotation(req.params.id, req.params.annId);
    if (!deleted) return res.status(404).json({ error: "Annotation not found" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── File History API ───

/** Get file version history */
router.get("/spaces/:id/history/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    if (!filePath) return res.status(400).json({ error: "File path required" });
    const history = await storage.getFileHistory(req.params.id, filePath);
    res.json({ filePath, history });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Get specific version content */
router.get("/spaces/:id/version/:version/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    const version = parseInt(req.params.version);
    if (!filePath || isNaN(version)) return res.status(400).json({ error: "File path and version required" });
    const data = await storage.getFileVersion(req.params.id, filePath, version);
    if (!data) return res.status(404).json({ error: "Version not found" });
    res.json(data);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Convert annotation to task (append to TASK.md) */
router.post("/spaces/:id/annotations/:annId/to-task", async (req, res) => {
  try {
    const ann = (await storage.getAnnotations(req.params.id)).find(a => a.id === req.params.annId);
    if (!ann) return res.status(404).json({ error: "Annotation not found" });

    // Read current TASK.md
    const taskFile = await storage.getFile(req.params.id, "TASK.md");
    const taskContent = taskFile?.content || "# 任务\n\n## 当前任务\n";

    // Append new task from annotation
    const newTask = `\n### [ready] ${ann.content.slice(0, 60)}\n- **来源:** 批注 (${ann.filePath}${ann.line > 0 ? ` 第${ann.line}行` : ""})\n- **批注人:** ${ann.author}\n- **负责人:** 待认领\n- **说明:** ${ann.content}\n`;

    await storage.writeFile(req.params.id, "TASK.md", taskContent + newTask, "system");
    // Resolve the annotation
    await storage.resolveAnnotation(req.params.id, ann.id, "system(转为任务)");

    res.json({ success: true, message: "Annotation converted to task" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Notifications API ───

/** Get pending notifications */
router.get("/spaces/:id/notifications", async (req, res) => {
  try {
    const notifications = await storage.getPendingNotifications(req.params.id);
    res.json({ notifications });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Mark notification as sent */
router.put("/spaces/:id/notifications/:notifId/sent", async (req, res) => {
  try {
    await storage.markNotificationSent(req.params.id, req.params.notifId);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Context Menu API ───

/** List custom menu items */
router.get("/menu/items", (_req, res) => {
  res.json({ items: menuRegistry.listCustomMenuItems() });
});

/** Register a menu item */
router.post("/menu/items", (req, res) => {
  try {
    const { id, label, icon, fileTypes, actionType, actionUrl, registeredBy } = req.body;
    if (!id || !label || !actionType) return res.status(400).json({ error: "id, label, actionType required" });
    const item = menuRegistry.registerMenuItem({
      id, label, icon: icon || "⚡", fileTypes: fileTypes || ["*"],
      actionType: actionType || "url", actionUrl: actionUrl || "", registeredBy: registeredBy || "unknown",
    });
    res.status(201).json({ item });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** Remove a menu item */
router.delete("/menu/items/:id", (req, res) => {
  const removed = menuRegistry.removeMenuItem(req.params.id);
  if (!removed) return res.status(404).json({ error: "Menu item not found" });
  res.json({ success: true });
});

/** Get menu items for a specific file extension */
router.get("/menu/items/:ext", (req, res) => {
  res.json({ items: menuRegistry.getMenuItems(req.params.ext) });
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
    // API response (for agents without plugin)
    const files = await storage.listFiles(spaceId);
    const baseUrl = getBaseUrl(req);
    res.json({
      space: { name: space.name, id: spaceId, channel: space.channel },
      files: files.map((f: any) => ({ path: f.path, size: f.size, url: `${baseUrl}/ctx/${spaceId}/${f.path}` })),
      webUrl: `${baseUrl}/s/${spaceId}`,
      install: "clawhub install context-collab",
      hint: "Install the Context plugin to auto-inject collaboration context. Or use web_fetch on file URLs above.",
    });
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
      // Human browser → rendered page with annotations
      const annotations = await storage.getAnnotations(spaceId, filePath);
      return res.type("text/html").send(renderFilePage(space, file, spaceId, filePath, annotations, req));
    }

    if (hasPlugin) {
      // Agent with plugin → raw content (binary files get raw buffer)
      const isBinary = !file.mimeType?.startsWith("text/") && !["application/json", "application/javascript", "application/typescript"].includes(file.mimeType || "");
      if (isBinary) {
        const raw = await storage.getFileRaw(spaceId, filePath);
        if (raw) return res.type(raw.mimeType).send(raw.buffer);
      }
      return res.type(file.mimeType).send(file.content);
    }

    // Agent without plugin → content + install hint (or raw for binary)
    const isBinary = !file.mimeType?.startsWith("text/") && !["application/json", "application/javascript", "application/typescript"].includes(file.mimeType || "");
    if (isBinary) {
      const raw = await storage.getFileRaw(spaceId, filePath);
      if (raw) return res.type(raw.mimeType).send(raw.buffer);
    }
    const baseUrl = getBaseUrl(req);
    const hint = `\n\n---\n\n## 🔌 加入协作\n\n你正在查看 **${space.name}** 的共享文件。安装 Context 插件后，你可以：\n- ✅ 自动获取项目协作上下文（SPACE.md / TEAM.md / TASK.md）\n- ✅ 读写共享文件、管理任务、查看批注\n- ✅ 在群里 @你 时自动注入协作协议\n\n**一键安装：**\n\`\`\`\nclawhub install context-collab\n\`\`\`\n\n**不装插件也行** — 你可以直接用 web_fetch 读取文件：\n- 文件列表: ${baseUrl}/ctx/${req.params.spaceId}/\n- 当前文件: ${baseUrl}/ctx/${req.params.spaceId}/${filePath}\n- Web UI: ${baseUrl}/s/${req.params.spaceId}\n\n**Space ID:** \`${req.params.spaceId}\`\n`;
    return res.type("text/markdown").send(file.content + hint);
  } catch (err: any) { res.status(500).send(err.message); }
});


// ════════════════════════════════════════════════════════════════
// /s/* — Web UI（人类浏览器完整功能）
// ════════════════════════════════════════════════════════════════

/** Home: list all spaces */
router.get("/s", async (_req, res) => {
  try {
    res.type("text/html").send(page("Context", `
      <div class="hero">
        <h1>📦 Context</h1>
        <p>多 Agent 协作协议引擎 — 共享空间、自动注入上下文、实时批注与任务管理</p>
        <div class="hero-features">
          <div class="feature"><div class="feature-icon">🤖</div><div class="feature-label">多 Agent 协作</div></div>
          <div class="feature"><div class="feature-icon">📄</div><div class="feature-label">共享文件空间</div></div>
          <div class="feature"><div class="feature-icon">💬</div><div class="feature-label">实时批注</div></div>
          <div class="feature"><div class="feature-icon">📜</div><div class="feature-label">版本历史</div></div>
        </div>
      </div>

      <div class="card fade-in">
        <div class="card-header">
          <h2 style="margin:0;">🔗 进入已有空间</h2>
        </div>
        <form onsubmit="var v=document.getElementById('sid').value.trim();if(v)location.href='/s/'+v;return false;" style="display:flex;gap:8px;">
          <input id="sid" placeholder="输入 Space ID" style="flex:1;" required>
          <button type="submit" class="btn btn-primary">进入</button>
        </form>
      </div>

      <div class="card fade-in">
        <div class="card-header">
          <h2 style="margin:0;">➕ 创建新空间</h2>
        </div>
        <form method="POST" action="/s/create" style="display:flex;flex-direction:column;gap:16px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label>空间名称</label><br><input name="name" required style="width:100%;margin-top:4px;" placeholder="My Project"></div>
            <div><label>创建者</label><br><input name="createdBy" value="web-user" style="width:100%;margin-top:4px;"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label>Channel</label><br><select name="channel" style="width:100%;margin-top:4px;"><option>discord</option><option>dmwork</option><option>telegram</option><option>slack</option><option>webchat</option></select></div>
            <div><label>Group ID</label><br><input name="groupId" required style="width:100%;margin-top:4px;" placeholder="群 / 服务器 ID"></div>
          </div>
          <div>
            <label>模板</label><br>
            <select name="template" style="width:100%;margin-top:4px;">
              <option value="software-dev">🛠 软件开发</option>
              <option value="content">📝 内容创作</option>
              <option value="research">🔬 研究项目</option>
              <option value="blank">📄 空白</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="align-self:flex-start;">🚀 创建空间</button>
        </form>
      </div>

      <div style="text-align:center;padding:24px 0;color:var(--text-muted);font-size:13px;">
        <p>每个空间有独立地址：<code>/s/{spaceId}</code></p>
        <p style="margin-top:4px;">由 Agent 或斜杠命令创建后会返回专属链接</p>
      </div>
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Create space (form POST) */
/** Save space settings (webhook) */
router.post("/s/:id/settings", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.redirect("/s");
    const { webhookUrl } = req.body;
    if (webhookUrl !== undefined) space.webhookUrl = webhookUrl || undefined;
    space.updatedAt = new Date().toISOString();
    await storage.updateSpace(req.params.id, space);
    res.redirect(`/s/${req.params.id}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

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
    const annotations = await storage.getAnnotations(req.params.id, filePath);
    let html = renderFilePage(space, file, req.params.id, filePath, annotations, req);
    if (req.query.sent === "1") {
      html = html.replace("</h1>", '</h1><div style="background:#dafbe1;border:1px solid #1a7f37;border-radius:6px;padding:10px 14px;margin:8px 0;color:#1a7f37;">✅ 已发送到群聊</div>');
    }
    res.type("text/html").send(html);
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
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> <span>/</span> 编辑: <b>${esc(filePath)}</b></div>
      <div class="card">
        <div class="card-header"><h2 style="margin:0;">✏️ 编辑文件</h2></div>
        <form method="POST" action="/s/${req.params.id}/save/${filePath}" style="display:flex;flex-direction:column;gap:12px;">
          <textarea name="content" class="editor-area">${esc(content)}</textarea>
          <div style="display:flex;align-items:center;gap:12px;">
            <label>修改人: <input name="modifiedBy" value="web-user" style="width:140px;"></label>
            <div style="margin-left:auto;display:flex;gap:8px;">
              <a href="/s/${req.params.id}/view/${filePath}" class="btn">取消</a>
              <button type="submit" class="btn btn-primary">💾 保存</button>
            </div>
          </div>
        </form>
      </div>
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
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> <span>/</span> 新建文件</div>
      <div class="card">
        <div class="card-header"><h2 style="margin:0;">📄 新建文件</h2></div>
        <form method="POST" action="/s/${req.params.id}/create-file" style="display:flex;flex-direction:column;gap:12px;">
          <div><label>文件路径</label><br><input name="path" placeholder="docs/design.md" required style="width:100%;margin-top:4px;"></div>
          <textarea name="content" class="editor-area" style="min-height:400px;" placeholder="在此输入文件内容..."></textarea>
          <div style="display:flex;align-items:center;gap:12px;">
            <label>创建者: <input name="modifiedBy" value="web-user" style="width:140px;"></label>
            <button type="submit" class="btn btn-primary" style="margin-left:auto;">📄 创建文件</button>
          </div>
        </form>
      </div>
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

/** Add annotation (form POST) */
router.post("/s/:id/annotate", async (req, res) => {
  try {
    const { filePath, line, endLine, content, author } = req.body;
    if (!filePath || !content) return res.status(400).send("filePath and content required");
    await storage.addAnnotation(req.params.id, {
      filePath,
      line: parseInt(line) || 0,
      endLine: parseInt(endLine) || 0,
      content,
      author: author || "web-user",
      authorType: "human",
    });
    res.redirect(`/s/${req.params.id}/view/${filePath}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Resolve annotation (form POST) */
router.post("/s/:id/resolve-annotation/:annId", async (req, res) => {
  try {
    const { filePath } = req.body;
    await storage.resolveAnnotation(req.params.id, req.params.annId, "web-user");
    res.redirect(`/s/${req.params.id}/view/${filePath || ""}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Convert annotation to task (form POST) */
router.post("/s/:id/annotation-to-task/:annId", async (req, res) => {
  try {
    const { filePath } = req.body;
    const ann = (await storage.getAnnotations(req.params.id)).find(a => a.id === req.params.annId);
    if (!ann) return res.redirect(`/s/${req.params.id}`);

    const taskFile = await storage.getFile(req.params.id, "TASK.md");
    const taskContent = taskFile?.content || "# 任务\n\n## 当前任务\n";
    const newTask = `\n### [ready] ${ann.content.slice(0, 60)}\n- **来源:** 批注 (${ann.filePath}${ann.line > 0 ? ` 第${ann.line}行` : ""})\n- **批注人:** ${ann.author}\n- **负责人:** 待认领\n- **说明:** ${ann.content}\n`;
    await storage.writeFile(req.params.id, "TASK.md", taskContent + newTask, "system");
    await storage.resolveAnnotation(req.params.id, ann.id, "system(转为任务)");

    res.redirect(`/s/${req.params.id}/view/${filePath || "TASK.md"}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Send annotation to IM group (form POST) */
router.post("/s/:id/annotation-to-chat/:annId", async (req, res) => {
  try {
    const { filePath } = req.body;
    const ann = (await storage.getAnnotations(req.params.id)).find(a => a.id === req.params.annId);
    if (!ann) return res.redirect(`/s/${req.params.id}`);

    const space = await storage.getSpace(req.params.id);
    if (!space) return res.redirect(`/s/${req.params.id}`);

    const baseUrl = getBaseUrl(req);
    const message = `💬 批注通知\n\n👤 ${ann.author} → 📄 ${ann.filePath}${ann.line > 0 ? ` 第${ann.line}行` : ""}\n\n> ${ann.content}\n\n🔗 查看: ${baseUrl}/s/${req.params.id}/view/${ann.filePath}`;

    if (space.webhookUrl) {
      // Send to webhook
      try {
        await fetch(space.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: message, text: message, msg_type: "text" }),
        });
      } catch (e: any) {
        console.error(`[context] Webhook failed: ${e.message}`);
      }
    }

    // Also store in notification queue
    await storage.addNotification(req.params.id, {
      type: "annotation",
      channel: space.channel,
      target: space.groupId,
      message,
      createdBy: "web-user",
    });

    res.redirect(`/s/${req.params.id}/view/${filePath || ann.filePath}?sent=1`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Upload file (multipart form with actual file) */
router.post("/s/:id/upload", async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      const boundary = contentType.split("boundary=")[1];
      if (!boundary) return res.status(400).send("Invalid multipart");
      
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const body = Buffer.concat(chunks);
          const boundaryBuf = Buffer.from(`--${boundary}`);
          
          // Split by boundary
          let start = 0;
          const parts: Buffer[] = [];
          while (true) {
            const idx = body.indexOf(boundaryBuf, start);
            if (idx < 0) break;
            if (start > 0) parts.push(body.slice(start, idx));
            start = idx + boundaryBuf.length + 2; // skip \r\n
          }
          
          for (const part of parts) {
            const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
            if (headerEnd < 0) continue;
            
            const headerStr = part.slice(0, headerEnd).toString("utf-8");
            const filenameMatch = headerStr.match(/filename="([^"]+)"/);
            if (!filenameMatch) continue;
            
            const filename = filenameMatch[1];
            const fileData = part.slice(headerEnd + 4);
            // Remove trailing \r\n
            const trimmed = fileData.length > 2 && fileData[fileData.length - 2] === 0x0d && fileData[fileData.length - 1] === 0x0a
              ? fileData.slice(0, -2)
              : fileData;
            
            const content = trimmed.toString("utf-8");
            await storage.writeFile(req.params.id, filename, content, "web-upload");
          }
          res.redirect(`/s/${req.params.id}`);
        } catch (e: any) { res.status(500).send(e.message); }
      });
    } else {
      const { path: filePath, content, modifiedBy } = req.body;
      if (!filePath) return res.status(400).send("path required");
      await storage.writeFile(req.params.id, filePath, content || "", modifiedBy || "web-user");
      res.redirect(`/s/${req.params.id}`);
    }
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Search results page */
router.get("/s/:id/search", async (req, res) => {
  try {
    const q = req.query.q as string;
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    if (!q) return res.redirect(`/s/${req.params.id}`);

    const results = await storage.searchFiles(req.params.id, q);
    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

    const resultsHtml = results.map(r => {
      const matchLines = r.matches.map(m =>
        `<li><small>L${m.line}</small> ${esc(m.text)}</li>`
      ).join("");
      return `<div class="search-result">
        <a href="/s/${req.params.id}/view/${r.path}" class="result-path">${esc(r.path)}</a><span class="result-count">${r.matches.length} 处匹配</span>
        <ul>${matchLines}</ul>
      </div>`;
    }).join("");

    res.type("text/html").send(page(`搜索: ${q}`, `
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> <span>/</span> 搜索</div>
      <div class="card">
        <h2 style="margin:0 0 8px;">🔍 搜索结果</h2>
        <p style="color:var(--text-secondary);font-size:14px;">"<b>${esc(q)}</b>" — ${results.length} 个文件，${totalMatches} 处匹配</p>
        <form method="GET" action="/s/${req.params.id}/search" style="margin-top:12px;display:flex;gap:8px;">
          <input name="q" value="${esc(q)}" style="flex:1;">
          <button type="submit" class="btn btn-primary">🔍 搜索</button>
        </form>
      </div>
      ${resultsHtml || '<div class="empty-state"><div class="empty-icon">🔍</div><p>未找到匹配内容</p></div>'}
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** All annotations page */
router.get("/s/:id/annotations", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    const annotations = await storage.getAnnotations(req.params.id);
    const open = annotations.filter(a => a.status === "open");
    const resolved = annotations.filter(a => a.status === "resolved");

    const openHtml = open.map(a => `
      <div class="annotation">
        <div class="ann-header">
          ${a.authorType === "human" ? "👤" : "🤖"} <b>${esc(a.author)}</b>
          → <a href="/s/${req.params.id}/view/${a.filePath}">${esc(a.filePath)}</a>
          ${a.line > 0 ? ` 第 ${a.line}${a.endLine > a.line ? `-${a.endLine}` : ''} 行` : ''}
          · <small>${new Date(a.createdAt).toLocaleString("zh-CN")}</small>
        </div>
        <div class="ann-content">${esc(a.content)}</div>
        <div class="ann-actions">
          <form method="POST" action="/s/${req.params.id}/resolve-annotation/${a.id}" style="display:inline;">
            <input type="hidden" name="filePath" value="${esc(a.filePath)}">
            <button type="submit" class="btn-small">✅ 已处理</button>
          </form>
          <form method="POST" action="/s/${req.params.id}/annotation-to-task/${a.id}" style="display:inline;">
            <input type="hidden" name="filePath" value="${esc(a.filePath)}">
            <button type="submit" class="btn-small">📋 转任务</button>
          </form>
          <form method="POST" action="/s/${req.params.id}/annotation-to-chat/${a.id}" style="display:inline;">
            <input type="hidden" name="filePath" value="${esc(a.filePath)}">
            <button type="submit" class="btn-small">📢 发到群</button>
          </form>
        </div>
      </div>
    `).join("");

    const resolvedHtml = resolved.length > 0
      ? `<details><summary>已处理 (${resolved.length})</summary>` +
        resolved.map(a => `
          <div class="annotation resolved">
            <div class="ann-header">
              ${a.authorType === "human" ? "👤" : "🤖"} <b>${esc(a.author)}</b>
              → <a href="/s/${req.params.id}/view/${a.filePath}">${esc(a.filePath)}</a>
              · ✅ ${esc(a.resolvedBy || "")}
            </div>
            <div class="ann-content">${esc(a.content)}</div>
          </div>
        `).join("") + "</details>"
      : "";

    res.type("text/html").send(page("批注清单", `
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> <span>/</span> 批注清单</div>
      <div class="card">
        <div class="card-header"><h2 style="margin:0;">💬 批注清单</h2><span class="badge badge-channel">待处理 ${open.length} · 已处理 ${resolved.length}</span></div>
        ${openHtml || '<div class="empty-state"><div class="empty-icon">🎉</div><p>暂无待处理批注</p></div>'}
        ${resolvedHtml}
      </div>
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** File version history page */
router.get("/s/:id/history/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    const history = await storage.getFileHistory(req.params.id, filePath);
    const currentFile = await storage.getFile(req.params.id, filePath);

    const historyHtml = history.length > 0
      ? history.map(h => `
        <tr>
          <td><span class="badge badge-channel">v${h.version}</span></td>
          <td>${esc(h.modifiedBy)}</td>
          <td>${new Date(h.savedAt).toLocaleString("zh-CN")}</td>
          <td>${h.size < 1024 ? h.size + 'B' : (h.size/1024).toFixed(1) + 'KB'}</td>
          <td><a href="/s/${req.params.id}/version/${h.version}/${filePath}" class="btn-small">查看</a></td>
        </tr>
      `).join("")
      : "<tr><td colspan='5' style='text-align:center;color:var(--text-muted);padding:24px;'>暂无历史版本</td></tr>";

    res.type("text/html").send(page(`历史 — ${filePath}`, `
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> <span>/</span> <a href="/s/${req.params.id}/view/${filePath}">${esc(filePath)}</a> <span>/</span> 版本历史</div>
      <div class="card">
        <div class="card-header">
          <h2 style="margin:0;">📜 版本历史</h2>
          <span class="badge badge-channel">当前 v${currentFile?.version || '?'}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>版本</th><th>修改人</th><th>时间</th><th>大小</th><th>操作</th></tr></thead>
            <tbody>${historyHtml}</tbody>
          </table>
        </div>
      </div>
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});

/** View specific version */
router.get("/s/:id/version/:version/*", async (req, res) => {
  try {
    const filePath = (req.params as any)[0] || req.params["0"];
    const version = parseInt(req.params.version);
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    const data = await storage.getFileVersion(req.params.id, filePath, version);
    if (!data) return res.status(404).send(notFoundPage(`Version v${version} not found`));

    res.type("text/html").send(page(`v${version} — ${filePath}`, `
      <div class="breadcrumb">
        <a href="/s/${req.params.id}">${esc(space.name)}</a> <span>/</span>
        <a href="/s/${req.params.id}/view/${filePath}">${esc(filePath)}</a> <span>/</span>
        <a href="/s/${req.params.id}/history/${filePath}">历史</a> <span>/</span> <b>v${version}</b>
      </div>
      <div class="card">
        <div class="card-header">
          <h2 style="margin:0;">📜 v${version}</h2>
          <a href="/s/${req.params.id}/history/${filePath}" class="btn">← 返回历史</a>
        </div>
        <div class="meta">
          <b>版本:</b> v${version} · <b>修改:</b> ${esc(data.modifiedBy)} · <b>时间:</b> ${new Date(data.savedAt).toLocaleString("zh-CN")} · <b>大小:</b> ${data.content.length < 1024 ? data.content.length + 'B' : (data.content.length/1024).toFixed(1) + 'KB'}
        </div>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
        <pre style="margin:0;border:none;border-radius:0;white-space:pre-wrap;">${esc(data.content)}</pre>
      </div>
    `));
  } catch (err: any) { res.status(500).send(err.message); }
});


// ════════════════════════════════════════════════════════════════
// HTML Rendering Helpers
// ════════════════════════════════════════════════════════════════

const CSS = `
  :root {
    --primary: #2563eb;
    --primary-hover: #1d4ed8;
    --primary-light: #eff6ff;
    --success: #16a34a;
    --success-light: #dcfce7;
    --danger: #dc2626;
    --danger-light: #fef2f2;
    --warning: #d97706;
    --warning-light: #fffbeb;
    --bg: #f8fafc;
    --bg-card: #ffffff;
    --bg-hover: #f1f5f9;
    --bg-code: #f1f5f9;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --text: #0f172a;
    --text-secondary: #64748b;
    --text-muted: #94a3b8;
    --shadow: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);
    --shadow-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.04);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.04);
    --radius: 8px;
    --radius-lg: 12px;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --primary: #60a5fa;
      --primary-hover: #93bbfd;
      --primary-light: #1e293b;
      --success: #4ade80;
      --success-light: #052e16;
      --danger: #f87171;
      --danger-light: #450a0a;
      --warning: #fbbf24;
      --warning-light: #451a03;
      --bg: #0f172a;
      --bg-card: #1e293b;
      --bg-hover: #334155;
      --bg-code: #1e293b;
      --border: #334155;
      --border-strong: #475569;
      --text: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --shadow: 0 1px 3px rgba(0,0,0,.3);
      --shadow-md: 0 4px 6px rgba(0,0,0,.3);
      --shadow-lg: 0 10px 15px rgba(0,0,0,.3);
    }
    .badge-agent { background: #1e3a5f; color: #93c5fd; }
    .badge-human { background: #052e16; color: #86efac; }
    .badge-creator { background: #451a03; color: #fcd34d; }
    .annotation, .annotation-card { background: var(--warning-light); border-color: #92400e; }
    .annotation.resolved, .annotation-card.resolved { background: var(--bg-code); border-color: var(--border); }
  }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, system-ui, "Segoe UI", "Noto Sans SC", sans-serif; margin: 0; padding: 0; line-height: 1.6; color: var(--text); background: var(--bg); -webkit-font-smoothing: antialiased; }
  .container { max-width: 960px; margin: 0 auto; padding: 24px 20px; }
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 20px; box-shadow: var(--shadow); }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .card-header h2 { margin: 0; font-size: 18px; }
  h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px; color: var(--text); }
  h2 { font-size: 18px; font-weight: 600; color: var(--text); margin-top: 24px; }
  h3 { font-size: 15px; font-weight: 600; color: var(--text); }
  a { color: var(--primary); text-decoration: none; transition: color .15s; }
  a:hover { text-decoration: underline; }
  hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
  blockquote { border-left: 3px solid var(--primary); padding: 8px 16px; margin: 12px 0; background: var(--bg-code); border-radius: 0 var(--radius) var(--radius) 0; color: var(--text-secondary); }
  pre { background: var(--bg-code); padding: 14px; border-radius: var(--radius); overflow-x: auto; border: 1px solid var(--border); font-size: 13px; line-height: 1.5; }
  code { background: var(--bg-code); padding: 2px 6px; border-radius: 4px; font-size: 0.88em; font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace; }
  pre code { background: none; padding: 0; }
  /* ── Form Controls ── */
  input[type="text"], input[type="number"], input[type="email"], input[type="url"], input[type="search"],
  input:not([type]), textarea, select {
    font-family: inherit; font-size: 14px; line-height: 1.5;
    padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--bg-card); color: var(--text); transition: border-color .15s, box-shadow .15s;
    outline: none; width: auto;
  }
  input:focus, textarea:focus, select:focus {
    border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,.12);
  }
  textarea { resize: vertical; }
  select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px; }
  label { font-size: 14px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 6px; }
  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  th { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-secondary); background: var(--bg-code); }
  tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--bg-hover); }
  .table-wrap { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  /* ── Components ── */
  .breadcrumb { color: var(--text-secondary); margin-bottom: 16px; font-size: 13px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--primary); font-weight: 500; }
  .breadcrumb span { color: var(--text-muted); }
  .meta { background: var(--bg-code); padding: 12px 16px; border-radius: var(--radius); margin: 12px 0; border: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); line-height: 1.8; }
  .meta b { color: var(--text); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; line-height: 1.5; }
  .badge-agent { background: #dbeafe; color: #1e40af; }
  .badge-human { background: #dcfce7; color: #166534; }
  .badge-creator { background: #fef3c7; color: #92400e; }
  .badge-channel { background: var(--bg-code); color: var(--text-secondary); border: 1px solid var(--border); }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius); font-size: 13px; font-weight: 500; border: 1px solid var(--border); background: var(--bg-card); color: var(--text); cursor: pointer; text-decoration: none; transition: all .15s; line-height: 1.4; }
  .btn:hover { background: var(--bg-hover); text-decoration: none; border-color: var(--border-strong); }
  .btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
  .btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
  .btn-success { background: var(--success); color: #fff; border-color: var(--success); }
  .btn-danger { background: transparent; color: var(--danger); border-color: var(--danger); }
  .btn-danger:hover { background: var(--danger); color: #fff; }
  .btn-ghost { background: transparent; border-color: transparent; color: var(--text-secondary); }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text); }
  .btn-small { padding: 4px 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); cursor: pointer; transition: all .15s; color: var(--text); font-family: inherit; }
  .btn-small:hover { background: var(--bg-hover); border-color: var(--border-strong); }
  .btn-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
  .file-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: all .2s; text-decoration: none; color: var(--text); position: relative; }
  .file-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); text-decoration: none; transform: translateY(-2px); }
  .file-card .icon { font-size: 28px; }
  .file-card .name { font-size: 13px; font-weight: 500; word-break: break-all; display: flex; align-items: center; gap: 6px; }
  .file-card .file-meta { font-size: 11px; color: var(--text-muted); }
  .member-list { display: flex; flex-wrap: wrap; gap: 10px; }
  .member-chip { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-code); border: 1px solid var(--border); border-radius: 20px; font-size: 13px; transition: all .15s; }
  .member-chip:hover { border-color: var(--border-strong); }
  .upload-zone { border: 2px dashed var(--border-strong); border-radius: var(--radius-lg); padding: 40px 32px; text-align: center; cursor: pointer; transition: all .2s; margin: 16px 0; }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--primary); background: var(--primary-light); }
  .upload-zone p { margin: 8px 0; color: var(--text-secondary); font-size: 14px; }
  .upload-zone .upload-icon { font-size: 36px; margin-bottom: 4px; opacity: .7; }
  .annotation { background: var(--warning-light); border: 1px solid #fde68a; border-radius: var(--radius); padding: 14px 16px; margin: 10px 0; }
  .annotation.resolved { background: var(--bg-code); border-color: var(--border); opacity: .6; }
  .annotation .ann-header { font-size: 13px; margin-bottom: 6px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .annotation .ann-content { margin: 8px 0; font-size: 14px; line-height: 1.6; }
  .annotation .ann-actions { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
  .code-table { border-collapse: collapse; width: 100%; font-size: 13px; font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace; line-height: 1.55; }
  .code-table tr:hover { background: var(--bg-hover); }
  .code-table .line-num { color: var(--text-muted); text-align: right; padding: 2px 12px 2px 8px; user-select: none; width: 48px; min-width: 48px; font-size: 12px; vertical-align: top; border-right: 1px solid var(--border); }
  .code-table .line-content { white-space: pre-wrap; word-break: break-all; padding: 2px 14px; }
  .add-annotation { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; margin-top: 20px; box-shadow: var(--shadow); }
  .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: var(--radius); font-size: 14px; z-index: 9999; animation: slideIn .3s ease; pointer-events: none; }
  .toast-success { background: var(--success-light); border: 1px solid var(--success); color: var(--success); }
  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn .3s ease; }
  .nav { background: var(--bg-card); border-bottom: 1px solid var(--border); padding: 0 20px; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(8px); background: rgba(255,255,255,.85); }
  @media (prefers-color-scheme: dark) { .nav { background: rgba(30,41,59,.85); } }
  .nav-inner { max-width: 960px; margin: 0 auto; display: flex; align-items: center; gap: 16px; height: 52px; }
  .nav-brand { font-weight: 700; font-size: 15px; color: var(--text); display: flex; align-items: center; gap: 8px; text-decoration: none; }
  .nav-brand:hover { text-decoration: none; color: var(--primary); }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: 12px; font-size: 13px; }
  .nav-right a { color: var(--text-secondary); }
  .nav-right a:hover { color: var(--primary); text-decoration: none; }
  .empty-state { text-align: center; padding: 48px 24px; color: var(--text-muted); }
  .empty-state .empty-icon { font-size: 48px; margin-bottom: 12px; opacity: .6; }
  .empty-state p { margin: 8px 0; }
  .search-result { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin: 10px 0; transition: all .15s; }
  .search-result:hover { border-color: var(--primary); box-shadow: var(--shadow); }
  .search-result .result-path { font-weight: 600; font-size: 14px; }
  .search-result .result-count { font-size: 12px; color: var(--text-muted); margin-left: 8px; }
  .search-result ul { margin: 8px 0 0; padding-left: 0; list-style: none; }
  .search-result li { padding: 4px 0; font-size: 13px; color: var(--text-secondary); border-bottom: 1px solid var(--border); }
  .search-result li:last-child { border-bottom: none; }
  .search-result li small { color: var(--text-muted); font-family: "SF Mono", monospace; margin-right: 8px; }
  .editor-area { width: 100%; min-height: 500px; font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace; font-size: 14px; line-height: 1.6; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-code); color: var(--text); resize: vertical; tab-size: 2; }
  .editor-area:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
  .hero { text-align: center; padding: 48px 24px 40px; }
  .hero h1 { font-size: 32px; margin-bottom: 12px; }
  .hero p { font-size: 16px; color: var(--text-secondary); max-width: 520px; margin: 0 auto 24px; line-height: 1.7; }
  .hero-features { display: flex; justify-content: center; gap: 32px; margin-top: 24px; flex-wrap: wrap; }
  .hero-features .feature { text-align: center; max-width: 160px; }
  .hero-features .feature-icon { font-size: 28px; margin-bottom: 8px; }
  .hero-features .feature-label { font-size: 13px; color: var(--text-secondary); }
  .section-divider { display: flex; align-items: center; gap: 12px; margin: 28px 0 20px; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .office-preview { text-align: center; padding: 40px; background: var(--bg-code); border-radius: var(--radius-lg); border: 1px solid var(--border); }
  .office-preview .icon { font-size: 48px; margin-bottom: 12px; }
  .office-preview .info { color: var(--text-secondary); font-size: 14px; margin: 8px 0; }
  .img-preview { text-align: center; padding: 20px; }
  .img-preview img { max-width: 100%; border-radius: var(--radius); box-shadow: var(--shadow-md); }
  details { margin: 8px 0; }
  details > summary { cursor: pointer; font-size: 13px; color: var(--text-secondary); padding: 8px 0; user-select: none; }
  details > summary:hover { color: var(--text); }
  .not-found { text-align: center; padding: 80px 24px; }
  .not-found .nf-code { font-size: 72px; font-weight: 800; color: var(--text-muted); opacity: .4; line-height: 1; }
  .not-found .nf-msg { font-size: 18px; color: var(--text-secondary); margin: 16px 0 28px; }
  @media (max-width: 640px) {
    .container { padding: 16px 12px; }
    .card { padding: 16px; }
    .file-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .card-header { flex-direction: column; align-items: flex-start; gap: 8px; }
    .member-list { flex-direction: column; }
    .hero h1 { font-size: 24px; }
    .hero-features { gap: 20px; }
    .btn-group { flex-direction: column; }
    .nav-inner { gap: 10px; }
    .editor-area { min-height: 350px; font-size: 13px; }
  }
  @media (max-width: 400px) {
    .file-grid { grid-template-columns: 1fr; }
  }
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Context</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📦</text></svg>"><style>${CSS}</style></head><body>
  <nav class="nav"><div class="nav-inner"><a href="/s" class="nav-brand">📦 Context</a><div class="nav-right"><a href="/s">首页</a><a href="/api/health">API</a></div></div></nav>
  <div class="container">${body}</div></body></html>`;
}

function notFoundPage(msg: string): string {
  return page("Not Found", `<div class="not-found"><div class="nf-code">404</div><div class="nf-msg">${esc(msg)}</div><a href="/s" class="btn btn-primary">← 回到首页</a></div>`);
}

async function renderSpacePage(spaceId: string, space: any): Promise<string> {
  const files = await storage.listFiles(spaceId);
  const members = await storage.getMembers(spaceId);
  const allAnnotations = await storage.getAnnotations(spaceId, undefined, "open");

  function fileIcon(p: string): string {
    if (p.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return "🖼️";
    if (p.match(/\.(md|markdown)$/i)) return "📝";
    if (p.match(/\.json$/i)) return "📊";
    if (p.match(/\.(doc|docx)$/i)) return "📘";
    if (p.match(/\.(xls|xlsx)$/i)) return "📗";
    if (p.match(/\.(ppt|pptx)$/i)) return "📙";
    if (p.match(/\.pdf$/i)) return "📕";
    if (p.match(/\.(ts|js|py|go|rs)$/i)) return "💻";
    return "📄";
  }

  const fileCards = files.map((f: any) => {
    const size = f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`;
    const fileAnns = allAnnotations.filter((a: any) => a.filePath === f.path);
    const annBadge = fileAnns.length > 0 ? `<span style="background:#f59e0b;color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;">💬${fileAnns.length}</span>` : "";
    return `<a href="/s/${spaceId}/view/${f.path}" class="file-card">
      <div class="icon">${fileIcon(f.path)}</div>
      <div class="name">${esc(f.path)} ${annBadge}</div>
      <div class="file-meta">${size} · v${f.version} · ${f.modifiedBy || "unknown"}</div>
    </a>`;
  }).join("");

  // Members: show creator + registered members
  const creatorChip = `<div class="member-chip"><span class="badge badge-creator">创建者</span> ${esc(space.createdBy)}</div>`;
  const memberChips = members.map((m: any) => {
    const badge = m.type === "agent" ? '<span class="badge badge-agent">🤖 Agent</span>' : '<span class="badge badge-human">👤 人类</span>';
    return `<div class="member-chip">${badge} ${esc(m.name)}${m.role ? ` · ${esc(m.role)}` : ""}</div>`;
  }).join("");

  return page(space.name, `
    <div class="breadcrumb"><a href="/s">首页</a> <span>/</span> <b>${esc(space.name)}</b></div>

    <div class="card">
      <div class="card-header">
        <h1>${esc(space.name)}</h1>
        <span class="badge badge-channel">${esc(space.channel)}</span>
      </div>
      <div class="meta">
        <b>Space ID:</b> <code>${spaceId}</code> · <b>创建:</b> ${new Date(space.createdAt).toLocaleDateString("zh-CN")} · <b>创建者:</b> ${esc(space.createdBy)}
      </div>

      <form method="GET" action="/s/${spaceId}/search" style="margin-top:16px;display:flex;gap:8px;">
        <input name="q" placeholder="搜索文件内容..." style="flex:1;">
        <button type="submit" class="btn btn-primary">🔍 搜索</button>
      </form>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 style="margin:0;">📄 文件 (${files.length})</h2>
        <div>
          <a href="/s/${spaceId}/new" class="btn btn-primary">➕ 新建</a>
          ${allAnnotations.length > 0 ? `<a href="/s/${spaceId}/annotations" class="btn">💬 批注 (${allAnnotations.length})</a>` : ""}
        </div>
      </div>
      <div class="file-grid">${fileCards || '<p style="color:var(--text-muted);text-align:center;padding:20px;">暂无文件，点击上方"新建"或拖拽上传</p>'}</div>

      <!-- 上传区域 -->
      <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()">
        <div class="upload-icon">📁</div>
        <p>拖拽文件到此处上传，或点击选择文件</p>
        <p style="font-size:12px;color:var(--text-muted);">支持所有格式：文档、图片、代码文件等</p>
        <form id="uploadForm" method="POST" action="/s/${spaceId}/upload" enctype="multipart/form-data" style="display:none;">
          <input type="file" id="fileInput" name="file" multiple onchange="document.getElementById('uploadForm').submit()">
        </form>
      </div>
      <script>
      var zone = document.getElementById('uploadZone');
      zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', function() { zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', function(e) {
        e.preventDefault(); zone.classList.remove('drag-over');
        var input = document.getElementById('fileInput');
        input.files = e.dataTransfer.files;
        document.getElementById('uploadForm').submit();
      });
      </script>
    </div>

    <div class="card">
      <div class="card-header"><h2 style="margin:0;">👥 成员</h2></div>
      <div class="member-list">
        ${creatorChip}
        ${memberChips}
      </div>
      ${members.length === 0 ? '<p style="font-size:13px;color:var(--text-muted);margin-top:8px;">通过 Agent 工具 <code>context_add_member</code> 添加更多成员</p>' : ""}
    </div>

    <div class="card">
      <div class="card-header"><h2 style="margin:0;">🔗 分享 & 集成</h2></div>
      <div class="meta">
        <b>AI Agent URL:</b> <code><script>document.write(location.origin)</script>/ctx/${spaceId}/SPACE.md</code><br>
        <b>浏览器 URL:</b> <code><script>document.write(location.origin)</script>/s/${spaceId}</code>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--radius);padding:14px;margin-top:12px;">
        <h3 style="margin:0 0 8px;">🤖 让其他 Agent 加入</h3>
        <pre style="margin:8px 0;background:#0f172a;color:#e2e8f0;padding:10px 14px;border-radius:6px;">clawhub install context-collab</pre>
        <p style="font-size:12px;color:var(--text-secondary);margin:4px 0 0;">安装后 Agent 自动获取协作上下文。不装插件也能通过 URL 读取文件。</p>
      </div>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <h3 style="margin:0 0 8px;">🔔 Webhook 通知</h3>
        <form method="POST" action="/s/${spaceId}/settings" style="display:flex;gap:8px;align-items:center;">
          <input name="webhookUrl" value="${esc(space.webhookUrl || "")}" placeholder="Webhook URL（Discord / 飞书 / 钉钉）" style="flex:1;">
          <button type="submit" class="btn">保存</button>
        </form>
        ${space.webhookUrl ? '<p style="font-size:12px;color:var(--success);margin:6px 0 0;">✅ 已配置</p>' : '<p style="font-size:12px;color:var(--text-muted);margin:6px 0 0;">⚠️ 未配置 — "发到群"不可用</p>'}
      </div>
    </div>
  `);
}

function renderFilePage(space: any, file: any, spaceId: string, filePath: string, annotations?: any[], req?: any): string {
  const openAnns = (annotations || []).filter((a: any) => a.status === "open");
  const resolvedAnns = (annotations || []).filter((a: any) => a.status === "resolved");

  // Render content with line numbers for annotation reference
  const lines = file.content.split("\n");
  const isJson = file.mimeType === "application/json" || filePath.endsWith(".json");
  const numberedContent = lines.map((line: string, i: number) => {
    const lineNum = i + 1;
    const lineAnns = openAnns.filter((a: any) => a.line === lineNum || (a.line <= lineNum && a.endLine >= lineNum));
    const highlight = lineAnns.length > 0 ? ' style="background:#fff8c5;border-left:3px solid #d4a72c;padding-left:8px;"' : '';
    let content = esc(line) || '&nbsp;';
    // JSON syntax highlighting
    if (isJson) {
      content = content
        .replace(/(&quot;[^&]*?&quot;)\s*:/g, '<span style="color:#0550ae;">$1</span>:')
        .replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span style="color:#0a3069;">$1</span>')
        .replace(/:\s*(true|false|null)/g, ': <span style="color:#cf222e;">$1</span>')
        .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#0550ae;">$1</span>');
    }
    return `<tr${highlight}><td class="line-num">${lineNum}</td><td class="line-content">${content}</td></tr>`;
  }).join("\n");

  // Annotation list
  const annListHtml = openAnns.length > 0
    ? openAnns.map((a: any) => `
      <div class="annotation">
        <div class="ann-header">
          ${a.authorType === "human" ? "👤" : "🤖"} <b>${esc(a.author)}</b>
          ${a.line > 0 ? `· 第 ${a.line}${a.endLine > a.line ? `-${a.endLine}` : ''} 行` : '· 全文'}
          · <small>${new Date(a.createdAt).toLocaleString("zh-CN")}</small>
        </div>
        <div class="ann-content">${esc(a.content)}</div>
        <div class="ann-actions">
          <form method="POST" action="/s/${spaceId}/resolve-annotation/${a.id}" style="display:inline;">
            <input type="hidden" name="filePath" value="${esc(filePath)}">
            <button type="submit" class="btn-small">✅ 已处理</button>
          </form>
          <form method="POST" action="/s/${spaceId}/annotation-to-task/${a.id}" style="display:inline;">
            <input type="hidden" name="filePath" value="${esc(filePath)}">
            <button type="submit" class="btn-small">📋 转任务</button>
          </form>
          <form method="POST" action="/s/${spaceId}/annotation-to-chat/${a.id}" style="display:inline;">
            <input type="hidden" name="filePath" value="${esc(filePath)}">
            <button type="submit" class="btn-small">📢 发到群</button>
          </form>
        </div>
      </div>
    `).join("")
    : '<div class="empty-state" style="padding:20px;"><p style="color:var(--text-muted);">暂无批注</p></div>';

  const resolvedHtml = resolvedAnns.length > 0
    ? `<details><summary>已处理的批注 (${resolvedAnns.length})</summary>` +
      resolvedAnns.map((a: any) => `
        <div class="annotation resolved">
          <div class="ann-header">
            ${a.authorType === "human" ? "👤" : "🤖"} <b>${esc(a.author)}</b>
            · ${a.line > 0 ? `第 ${a.line} 行` : '全文'}
            · ✅ ${esc(a.resolvedBy || "")} 已处理
          </div>
          <div class="ann-content">${esc(a.content)}</div>
        </div>
      `).join("") + "</details>"
    : "";

  // Determine file render mode
  const isImage = file.mimeType?.startsWith("image/") || filePath.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
  const isMd = filePath.match(/\.(md|markdown)$/i);
  const isOffice = filePath.match(/\.(doc|docx|xls|xlsx|ppt|pptx|pdf)$/i);

  let contentHtml = "";
  if (isImage) {
    contentHtml = `<div class="img-preview"><img src="/ctx/${spaceId}/${filePath}" alt="${esc(filePath)}"><p style="margin-top:8px;font-size:13px;color:var(--text-muted);">${esc(filePath)}</p></div>`;
  } else if (isOffice) {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const icons: Record<string, string> = { doc: "📘", docx: "📘", pdf: "📕", xls: "📗", xlsx: "📗", ppt: "📙", pptx: "📙" };
    const fileUrl = `${getBaseUrl(req)}/ctx/${spaceId}/${filePath}`;
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
    const isPdf = ext === "pdf";
    const previewFrame = isPdf
      ? `<iframe src="${fileUrl}" style="width:100%;height:600px;border:1px solid var(--border);border-radius:var(--radius);" title="PDF Preview"></iframe>`
      : `<iframe src="${viewerUrl}" style="width:100%;height:600px;border:1px solid var(--border);border-radius:var(--radius);" title="Office Preview"></iframe>`;
    contentHtml = `<div style="margin-top:16px;">
      ${previewFrame}
      <div style="margin-top:12px;text-align:center;">
        <a href="/ctx/${spaceId}/${filePath}" class="btn btn-primary" download>⬇️ 下载文件</a>
        <span style="margin-left:12px;font-size:13px;color:var(--text-secondary);">${icons[ext] || "📄"} ${esc(filePath)} (${ext.toUpperCase()})</span>
      </div>
    </div>`;
  } else if (isMd) {
    contentHtml = `<div class="card" style="padding:20px 24px;">${mdToHtml(file.content)}</div>
    <details style="margin-top:12px;"><summary style="cursor:pointer;color:var(--text-secondary);font-size:13px;">📝 查看源码</summary>
    <table class="code-table">${numberedContent}</table></details>`;
  } else {
    contentHtml = `<div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;"><table class="code-table">${numberedContent}</table></div>`;
  }

  return page(`${filePath} — ${space.name}`, `
    <div class="breadcrumb">
      <a href="/s/${spaceId}">${esc(space.name)}</a> <span>/</span> <b>${esc(filePath)}</b>
    </div>

    <div class="card">
      <div class="card-header">
        <h1 style="font-size:18px;">${esc(filePath)}</h1>
        <div class="btn-group">
          <a href="/s/${spaceId}/edit/${filePath}" class="btn">✏️ 编辑</a>
          <a href="/s/${spaceId}/history/${filePath}" class="btn">📜 历史</a>
          <form method="POST" action="/s/${spaceId}/delete/${filePath}" style="display:inline;" onsubmit="return confirm('确定删除？')">
            <button type="submit" class="btn btn-danger">🗑️</button>
          </form>
        </div>
      </div>
      <div class="meta">
        v${file.version} · ${esc(file.modifiedBy || "unknown")} · ${new Date(file.updatedAt).toLocaleString("zh-CN")} · ${file.size}B
        ${openAnns.length > 0 ? ` · <b style="color:var(--warning);">💬 ${openAnns.length} 条批注</b>` : ''}
      </div>
    </div>

    ${contentHtml}

    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <h2 style="margin:0;">💬 批注 (${openAnns.length})</h2>
      </div>
      ${annListHtml}
      ${resolvedHtml}
    </div>

    <div class="add-annotation" id="addAnnotation">
      <h3>➕ 添加批注 <small style="font-weight:normal;color:var(--text-muted);">(在代码区框选文字可自动定位行号)</small></h3>
      <p class="selection-hint" id="selectionHint" style="color:#0969da;font-size:13px;display:none;">
        📌 已选中第 <span id="selStartLine">?</span>-<span id="selEndLine">?</span> 行
      </p>
      <form method="POST" action="/s/${spaceId}/annotate" id="annotateForm">
        <input type="hidden" name="filePath" value="${esc(filePath)}">
        <label>行号: <input name="line" id="annLine" type="number" min="0" max="${lines.length}" value="0" style="width:60px;"> </label>
        <label>到: <input name="endLine" id="annEndLine" type="number" min="0" max="${lines.length}" value="0" style="width:60px;"></label>
        <small>(0 = 全文批注)</small><br><br>
        <textarea name="content" id="annContent" style="width:100%;height:80px;" placeholder="写下你的批注/修改意见..." required></textarea><br>
        <label>批注人: <input name="author" value=""></label>
        <button type="submit" style="margin-left:10px;">💬 提交批注</button>
      </form>
    </div>

    <!-- 浮动工具栏（选中文字后在上方弹出） -->
    <div id="selToolbar" style="display:none;position:absolute;background:#1e293b;color:#fff;border-radius:8px;padding:4px 6px;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:9999;font-size:13px;white-space:nowrap;">
      <button onclick="doAnnotate()" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 10px;border-radius:4px;font-size:13px;">💬 批注</button>
      <button onclick="doCopyRef()" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 10px;border-radius:4px;font-size:13px;">🔗 引用</button>
      <button onclick="doCopyText()" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 10px;border-radius:4px;font-size:13px;">📋 复制</button>
      <button onclick="doCreateTask()" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 10px;border-radius:4px;font-size:13px;">📌 任务</button>
      <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:12px;height:12px;background:#1e293b;transform:translateX(-50%) rotate(45deg);"></div>
    </div>

    <!-- 浮动批注输入框（出现在选中文字下方） -->
    <div id="floatingAnnotation" style="display:none;position:absolute;width:360px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);padding:16px;z-index:9998;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b>💬 添加批注</b>
        <span id="floatClose" style="cursor:pointer;font-size:18px;color:var(--text-muted);">✕</span>
      </div>
      <p id="floatLineInfo" style="color:var(--primary);font-size:13px;margin:4px 0;"></p>
      <form method="POST" action="/s/${spaceId}/annotate">
        <input type="hidden" name="filePath" value="${esc(filePath)}">
        <input type="hidden" name="line" id="floatLine" value="0">
        <input type="hidden" name="endLine" id="floatEndLine" value="0">
        <textarea name="content" id="floatContent" style="width:100%;height:60px;font-size:13px;border:1px solid var(--border);border-radius:var(--radius);padding:8px;" placeholder="写下修改意见..." required></textarea><br>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
          <input name="author" placeholder="你的名字" style="flex:1;">
          <button type="submit" class="btn btn-primary" style="padding:6px 14px;">💬 提交</button>
        </div>
      </form>
    </div>

    <script>
    const SPACE_ID = '${spaceId}';
    const FILE_PATH = '${filePath.replace(/'/g, "\\'")}';
    const CTX_URL = location.origin + '/ctx/${spaceId}/${filePath}';

    let selStartLine = 0, selEndLine = 0, selText = '';

    // Close floating annotation
    document.getElementById('floatClose').addEventListener('click', function() {
      document.getElementById('floatingAnnotation').style.display = 'none';
    });

    // Hide toolbar on click elsewhere
    document.addEventListener('mousedown', function(e) {
      var toolbar = document.getElementById('selToolbar');
      var floatAnn = document.getElementById('floatingAnnotation');
      if (!toolbar.contains(e.target) && !floatAnn.contains(e.target)) {
        toolbar.style.display = 'none';
      }
    });

    // Show toolbar on text selection in code area
    var codeTable = document.querySelector('.code-table');
    if (codeTable) {
      codeTable.addEventListener('mouseup', function(e) {
        setTimeout(function() {
          var sel = window.getSelection();
          if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

          selText = sel.toString().trim();

          // Find line numbers
          function findRow(node) {
            while (node && node.tagName !== 'TR') node = node.parentElement;
            return node;
          }
          var startRow = findRow(sel.anchorNode);
          var endRow = findRow(sel.focusNode);
          if (!startRow || !endRow) return;

          var rows = Array.from(document.querySelectorAll('.code-table tr'));
          selStartLine = rows.indexOf(startRow) + 1;
          selEndLine = rows.indexOf(endRow) + 1;
          if (selStartLine > selEndLine) { var tmp = selStartLine; selStartLine = selEndLine; selEndLine = tmp; }

          // Position toolbar above selection
          var rect = sel.getRangeAt(0).getBoundingClientRect();
          var toolbar = document.getElementById('selToolbar');
          toolbar.style.left = (rect.left + rect.width/2 - 120 + window.scrollX) + 'px';
          toolbar.style.top = (rect.top + window.scrollY - 44) + 'px';
          toolbar.style.display = 'block';

          // Update bottom form too
          document.getElementById('annLine').value = selStartLine;
          document.getElementById('annEndLine').value = selEndLine;
          document.getElementById('selStartLine').textContent = selStartLine;
          document.getElementById('selEndLine').textContent = selEndLine;
          document.getElementById('selectionHint').style.display = 'block';
        }, 10);
      });
    }

    function doAnnotate() {
      document.getElementById('selToolbar').style.display = 'none';
      var floatAnn = document.getElementById('floatingAnnotation');
      document.getElementById('floatLine').value = selStartLine;
      document.getElementById('floatEndLine').value = selEndLine;
      document.getElementById('floatLineInfo').textContent = '📌 第 ' + selStartLine + (selEndLine > selStartLine ? '-' + selEndLine : '') + ' 行';
      var floatContent = document.getElementById('floatContent');
      if (!floatContent.value) {
        floatContent.placeholder = '针对: "' + selText.slice(0, 40) + (selText.length > 40 ? '...' : '') + '"';
      }
      // Position near selection
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        var rect = sel.getRangeAt(0).getBoundingClientRect();
        floatAnn.style.position = 'absolute';
        floatAnn.style.left = Math.max(10, rect.left + window.scrollX - 50) + 'px';
        floatAnn.style.top = (rect.bottom + window.scrollY + 10) + 'px';
      }
      floatAnn.style.display = 'block';
      floatContent.focus();
    }

    function doCopyRef() {
      document.getElementById('selToolbar').style.display = 'none';
      var ref = CTX_URL + '#L' + selStartLine + (selEndLine > selStartLine ? '-L' + selEndLine : '');
      navigator.clipboard.writeText(ref).then(function() { showToast('✅ 引用 URL 已复制'); });
    }

    function doCopyText() {
      document.getElementById('selToolbar').style.display = 'none';
      navigator.clipboard.writeText(selText).then(function() { showToast('✅ 已复制'); });
    }

    function doCreateTask() {
      document.getElementById('selToolbar').style.display = 'none';
      var content = selText.slice(0, 100);
      fetch('/api/spaces/' + SPACE_ID + '/files/TASK.md').then(r => r.json()).then(data => {
        var task = data.file ? data.file.content : '';
        task += '\\n\\n### [ready] ' + content + ' (第' + selStartLine + '行, ' + FILE_PATH + ')';
        return fetch('/api/spaces/' + SPACE_ID + '/files/TASK.md', {
          method: 'PUT', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({content: task, modifiedBy: 'web-user'})
        });
      }).then(function() { showToast('✅ 已创建任务'); }).catch(function() { showToast('❌ 创建失败'); });
    }

    function showToast(msg) {
      var t = document.createElement('div');
      t.className = 'toast toast-success';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function() { t.remove(); }, 3000);
    }

    </script>
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
