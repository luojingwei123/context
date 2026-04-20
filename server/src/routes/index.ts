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
      // Human browser → rendered page with annotations
      const annotations = await storage.getAnnotations(spaceId, filePath);
      return res.type("text/html").send(renderFilePage(space, file, spaceId, filePath, annotations));
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
    res.type("text/html").send(page("Context", `
      <h1>📦 Context</h1>
      <p>多 Agent 协作协议引擎 — 共享空间 + 自动注入上下文</p>
      <hr>
      <h3>🔗 已有空间？</h3>
      <p>直接访问你的空间地址：</p>
      <form onsubmit="location.href='/s/'+document.getElementById('sid').value;return false;" style="margin:16px 0;">
        <input id="sid" placeholder="输入 Space ID" style="width:240px;" required>
        <button type="submit">进入</button>
      </form>
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
      <hr>
      <p style="color:#656d76;font-size:13px;">每个空间有独立地址：<code>/s/{spaceId}</code><br>
      由 Agent 或斜杠命令创建空间后会返回专属链接。</p>
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
    const annotations = await storage.getAnnotations(req.params.id, filePath);
    res.type("text/html").send(renderFilePage(space, file, req.params.id, filePath, annotations));
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

    // Store as pending notification for the agent to pick up
    await storage.addNotification(req.params.id, {
      type: "annotation",
      channel: space.channel,
      target: space.groupId,
      message: `💬 批注 @${ann.author} → ${ann.filePath}${ann.line > 0 ? ` 第${ann.line}行` : ""}:\n\n${ann.content}\n\n📎 查看: ${getBaseUrl(req)}/ctx/${req.params.id}/${ann.filePath}`,
      createdBy: "web-user",
    });

    res.redirect(`/s/${req.params.id}/view/${filePath || ann.filePath}?sent=1`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Upload file (multipart form) */
router.post("/s/:id/upload", async (req, res) => {
  try {
    const { path: filePath, content, modifiedBy } = req.body;
    if (!filePath) return res.status(400).send("path required");
    await storage.writeFile(req.params.id, filePath, content || "", modifiedBy || "web-user");
    res.redirect(`/s/${req.params.id}`);
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
        `<li><small>第 ${m.line} 行:</small> ${esc(m.text)}</li>`
      ).join("");
      return `<div style="margin:12px 0;padding:12px;background:#f6f8fa;border:1px solid #d1d9e0;border-radius:6px;">
        <b><a href="/s/${req.params.id}/view/${r.path}">${esc(r.path)}</a></b> <small>(${r.matches.length} 处匹配)</small>
        <ul style="margin-top:8px;">${matchLines}</ul>
      </div>`;
    }).join("");

    res.type("text/html").send(page(`搜索: ${q}`, `
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> / 搜索</div>
      <h2>🔍 搜索结果: "${esc(q)}"</h2>
      <p>${results.length} 个文件，${totalMatches} 处匹配</p>
      ${resultsHtml || "<p>未找到匹配内容。</p>"}
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
        <form method="POST" action="/s/${req.params.id}/resolve-annotation/${a.id}" style="display:inline;">
          <input type="hidden" name="filePath" value="${esc(a.filePath)}">
          <button type="submit" class="btn-small">✅ 标记已处理</button>
        </form>
        <form method="POST" action="/s/${req.params.id}/annotation-to-task/${a.id}" style="display:inline;margin-left:4px;">
          <input type="hidden" name="filePath" value="${esc(a.filePath)}">
          <button type="submit" class="btn-small">📋 转为任务</button>
        </form>
        <form method="POST" action="/s/${req.params.id}/annotation-to-chat/${a.id}" style="display:inline;margin-left:4px;">
          <input type="hidden" name="filePath" value="${esc(a.filePath)}">
          <button type="submit" class="btn-small">📢 发到群</button>
        </form>
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
      <style>
        .annotation { background: #fff8c5; border: 1px solid #d4a72c; border-radius: 6px; padding: 12px; margin: 8px 0; }
        .annotation.resolved { background: #f0fff0; border-color: #2da44e; opacity: 0.7; }
        .ann-header { font-size: 13px; margin-bottom: 4px; color: #656d76; }
        .ann-content { margin: 8px 0; }
        .btn-small { font-size: 12px; padding: 3px 8px; border-radius: 4px; border: 1px solid #d1d9e0; background: #f6f8fa; cursor: pointer; }
      </style>
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> / 批注清单</div>
      <h2>💬 批注清单</h2>
      <p>待处理: ${open.length} · 已处理: ${resolved.length}</p>
      ${openHtml || "<p>暂无待处理批注 🎉</p>"}
      ${resolvedHtml}
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
          <td>v${h.version}</td>
          <td>${esc(h.modifiedBy)}</td>
          <td>${new Date(h.savedAt).toLocaleString("zh-CN")}</td>
          <td>${h.size}B</td>
          <td><a href="/s/${req.params.id}/version/${h.version}/${filePath}">查看</a></td>
        </tr>
      `).join("")
      : "<tr><td colspan='5'>暂无历史版本</td></tr>";

    res.type("text/html").send(page(`历史 — ${filePath}`, `
      <div class="breadcrumb"><a href="/s/${req.params.id}">← ${esc(space.name)}</a> / <a href="/s/${req.params.id}/view/${filePath}">${esc(filePath)}</a> / 版本历史</div>
      <h2>📜 版本历史: ${esc(filePath)}</h2>
      <p>当前版本: v${currentFile?.version || '?'}</p>
      <table>
        <tr><th>版本</th><th>修改人</th><th>时间</th><th>大小</th><th>操作</th></tr>
        ${historyHtml}
      </table>
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
        <a href="/s/${req.params.id}">← ${esc(space.name)}</a> /
        <a href="/s/${req.params.id}/view/${filePath}">${esc(filePath)}</a> /
        <a href="/s/${req.params.id}/history/${filePath}">历史</a> / v${version}
      </div>
      <div class="meta">版本: v${version} · 修改: ${esc(data.modifiedBy)} · 时间: ${new Date(data.savedAt).toLocaleString("zh-CN")} · 大小: ${data.content.length}B</div>
      <pre style="white-space:pre-wrap;">${esc(data.content)}</pre>
    `));
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
  const allAnnotations = await storage.getAnnotations(spaceId, undefined, "open");

  const fileItems = files.map((f: any) => {
    const icon = f.path.endsWith(".md") ? "📝" : f.path.match(/\.(png|jpg|jpeg|gif|svg)$/i) ? "🖼️" : "📄";
    const size = f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`;
    const fileAnns = allAnnotations.filter((a: any) => a.filePath === f.path);
    const annBadge = fileAnns.length > 0 ? ` <span style="background:#d4a72c;color:#fff;padding:1px 6px;border-radius:10px;font-size:11px;">💬${fileAnns.length}</span>` : "";
    return `<li>
      <div class="file-info">${icon} <a href="/s/${spaceId}/view/${f.path}">${esc(f.path)}</a>${annBadge}</div>
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

    <h2>🔍 搜索</h2>
    <form method="GET" action="/s/${spaceId}/search" style="margin-bottom:20px;">
      <input name="q" placeholder="搜索文件内容..." style="width:300px;">
      <button type="submit">搜索</button>
    </form>

    <h2>📄 文件 (${files.length})</h2>
    <div class="actions">
      <a href="/s/${spaceId}/new" class="primary">➕ 新建文件</a>
      ${allAnnotations.length > 0 ? `<a href="/s/${spaceId}/annotations">💬 全部批注 (${allAnnotations.length})</a>` : ""}
    </div>
    <ul class="file-list">${fileItems || "<li>暂无文件</li>"}</ul>

    <h2>👥 成员 (${members.length})</h2>
    <ul>${memberItems || "<li>暂无成员。通过 Agent 工具 <code>context_add_member</code> 添加。</li>"}</ul>

    <hr>
    <h3>🔗 分享地址</h3>
    <p>
      <b>AI Agent:</b> <code><script>document.write(location.origin)</script>/ctx/${spaceId}/文件路径</code><br>
      <b>人类浏览器:</b> <code><script>document.write(location.origin)</script>/s/${spaceId}</code>
    </p>
    <p><a href="/s">← 首页</a></p>
  `);
}

function renderFilePage(space: any, file: any, spaceId: string, filePath: string, annotations?: any[]): string {
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
        <form method="POST" action="/s/${spaceId}/resolve-annotation/${a.id}" style="display:inline;">
          <input type="hidden" name="filePath" value="${esc(filePath)}">
          <button type="submit" class="btn-small">✅ 标记已处理</button>
        </form>
        <form method="POST" action="/s/${spaceId}/annotation-to-task/${a.id}" style="display:inline;margin-left:4px;">
          <input type="hidden" name="filePath" value="${esc(filePath)}">
          <button type="submit" class="btn-small">📋 转为任务</button>
        </form>
        <form method="POST" action="/s/${spaceId}/annotation-to-chat/${a.id}" style="display:inline;margin-left:4px;">
          <input type="hidden" name="filePath" value="${esc(filePath)}">
          <button type="submit" class="btn-small">📢 发到群</button>
        </form>
      </div>
    `).join("")
    : "<p>暂无批注</p>";

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

  return page(`${filePath} — ${space.name}`, `
    <style>
      .line-num { color: #656d76; text-align: right; padding-right: 12px; user-select: none; width: 40px; font-size: 12px; vertical-align: top; }
      .line-content { white-space: pre-wrap; word-break: break-all; font-family: monospace; font-size: 13px; }
      .code-table { border-collapse: collapse; width: 100%; border: 1px solid #d1d9e0; border-radius: 6px; }
      .code-table tr:hover { background: #f6f8fa; }
      .annotation { background: #fff8c5; border: 1px solid #d4a72c; border-radius: 6px; padding: 12px; margin: 8px 0; }
      .annotation.resolved { background: #f0fff0; border-color: #2da44e; opacity: 0.7; }
      .ann-header { font-size: 13px; margin-bottom: 4px; color: #656d76; }
      .ann-content { margin: 8px 0; }
      .btn-small { font-size: 12px; padding: 3px 8px; border-radius: 4px; border: 1px solid #d1d9e0; background: #f6f8fa; cursor: pointer; }
      .btn-small:hover { background: #eaeef2; }
      .add-annotation { background: #f6f8fa; border: 1px solid #d1d9e0; border-radius: 6px; padding: 16px; margin-top: 16px; }
    </style>

    <div class="breadcrumb"><a href="/s/${spaceId}">← ${esc(space.name)}</a> / ${esc(filePath)}</div>
    <div class="meta">
      版本: v${file.version} · 修改: ${esc(file.modifiedBy || "unknown")} · 时间: ${new Date(file.updatedAt).toLocaleString("zh-CN")} · 大小: ${file.size}B
      ${openAnns.length > 0 ? ` · <b style="color:#d4a72c;">💬 ${openAnns.length} 条批注</b>` : ''}
    </div>
    <div class="actions">
      <a href="/s/${spaceId}/edit/${filePath}">✏️ 编辑</a>
      <a href="/s/${spaceId}/history/${filePath}">📜 历史</a>
      <form method="POST" action="/s/${spaceId}/delete/${filePath}" style="display:inline;" onsubmit="return confirm('确定删除 ${esc(filePath)}？')">
        <button type="submit" class="danger">🗑️ 删除</button>
      </form>
    </div>

    ${file.mimeType.startsWith("image/")
      ? `<div style="text-align:center;padding:20px;"><img src="/ctx/${spaceId}/${filePath}" style="max-width:100%;border:1px solid #d1d9e0;border-radius:6px;" alt="${esc(filePath)}"></div>`
      : `<table class="code-table">${numberedContent}</table>`
    }

    <h3>💬 批注 (${openAnns.length} 条待处理)</h3>
    ${annListHtml}
    ${resolvedHtml}

    <div class="add-annotation" id="addAnnotation">
      <h4>➕ 添加批注 <small style="font-weight:normal;color:#656d76;">(或在代码区框选文字后右键→添加批注)</small></h4>
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

    <!-- 浮动批注弹窗 -->
    <div id="floatingAnnotation" style="display:none;position:fixed;bottom:20px;right:20px;width:380px;background:#fff;border:1px solid #d1d9e0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:16px;z-index:9998;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <b>💬 快速批注</b>
        <span id="floatClose" style="cursor:pointer;font-size:18px;">✕</span>
      </div>
      <p id="floatLineInfo" style="color:#0969da;font-size:13px;margin:4px 0;"></p>
      <form method="POST" action="/s/${spaceId}/annotate">
        <input type="hidden" name="filePath" value="${esc(filePath)}">
        <input type="hidden" name="line" id="floatLine" value="0">
        <input type="hidden" name="endLine" id="floatEndLine" value="0">
        <textarea name="content" id="floatContent" style="width:100%;height:60px;font-size:13px;" placeholder="写下修改意见..." required></textarea><br>
        <input name="author" placeholder="你的名字" style="width:120px;margin-top:6px;">
        <button type="submit" style="margin-left:8px;">💬 提交</button>
      </form>
    </div>

    <script>
    const SPACE_ID = '${spaceId}';
    const FILE_PATH = '${filePath.replace(/'/g, "\\'")}';
    const CTX_URL = location.origin + '/ctx/${spaceId}/${filePath}';

    // Close floating annotation
    document.getElementById('floatClose').addEventListener('click', function() {
      document.getElementById('floatingAnnotation').style.display = 'none';
    });

    // 框选代码行自动定位行号 + 弹窗
    var codeTable = document.querySelector('.code-table');
    if (codeTable) {
      codeTable.addEventListener('mouseup', function() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        let startNode = sel.anchorNode;
        let endNode = sel.focusNode;

        function findRow(node) {
          while (node && node.tagName !== 'TR') node = node.parentElement;
          return node;
        }

        const startRow = findRow(startNode);
        const endRow = findRow(endNode);
        if (!startRow || !endRow) return;

        const rows = Array.from(document.querySelectorAll('.code-table tr'));
        let startIdx = rows.indexOf(startRow) + 1;
        let endIdx = rows.indexOf(endRow) + 1;
        if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];

        // Update bottom form
        document.getElementById('annLine').value = startIdx;
        document.getElementById('annEndLine').value = endIdx;
        document.getElementById('selStartLine').textContent = startIdx;
        document.getElementById('selEndLine').textContent = endIdx;
        document.getElementById('selectionHint').style.display = 'block';

        // Show floating popup
        document.getElementById('floatLine').value = startIdx;
        document.getElementById('floatEndLine').value = endIdx;
        document.getElementById('floatLineInfo').textContent = '📌 第 ' + startIdx + (endIdx > startIdx ? '-' + endIdx : '') + ' 行';
        document.getElementById('floatingAnnotation').style.display = 'block';

        const selectedText = sel.toString().trim();
        var floatContent = document.getElementById('floatContent');
        if (floatContent && !floatContent.value) {
          floatContent.placeholder = '针对: "' + selectedText.slice(0, 40) + (selectedText.length > 40 ? '...' : '') + '"';
        }
      });
    }

    // 右键菜单
    const ctxMenu = document.createElement('div');
    ctxMenu.id = 'ctx-menu';
    ctxMenu.style.cssText = 'display:none;position:fixed;background:#fff;border:1px solid #d1d9e0;border-radius:8px;padding:4px 0;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:9999;min-width:180px;font-size:13px;';
    ctxMenu.innerHTML = '<div class="ctx-item" data-action="copy-ref">📋 拷贝引用 URL</div>' +
      '<div class="ctx-item" data-action="add-annotation">💬 添加批注</div>' +
      '<div class="ctx-item" data-action="create-task">📌 创建任务</div>' +
      '<hr style="margin:4px 0;border:none;border-top:1px solid #eee;">' +
      '<div class="ctx-item" data-action="copy-text">📄 拷贝文本</div>';
    document.body.appendChild(ctxMenu);

    // Style menu items
    const style = document.createElement('style');
    style.textContent = '.ctx-item{padding:6px 14px;cursor:pointer;}.ctx-item:hover{background:#f6f8fa;}';
    document.head.appendChild(style);

    // Show menu on right-click in code area
    document.querySelector('.code-table').addEventListener('contextmenu', function(e) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return; // Only show when text is selected

      e.preventDefault();
      ctxMenu.style.display = 'block';
      ctxMenu.style.left = e.clientX + 'px';
      ctxMenu.style.top = e.clientY + 'px';
    });

    // Hide menu on click elsewhere
    document.addEventListener('click', function() {
      ctxMenu.style.display = 'none';
    });

    // Menu actions
    ctxMenu.addEventListener('click', function(e) {
      const action = e.target.dataset?.action;
      if (!action) return;
      ctxMenu.style.display = 'none';

      const sel = window.getSelection();
      const selectedText = sel ? sel.toString().trim() : '';
      const lineInput = document.getElementById('annLine');
      const line = lineInput ? lineInput.value : '0';

      switch(action) {
        case 'copy-ref':
          const refUrl = CTX_URL + (line > 0 ? '#L' + line : '');
          navigator.clipboard.writeText(refUrl).then(() => alert('已复制: ' + refUrl));
          break;
        case 'add-annotation':
          document.getElementById('floatingAnnotation').style.display = 'block';
          document.getElementById('floatContent').focus();
          if (selectedText) {
            document.getElementById('floatContent').value = '';
            document.getElementById('floatContent').placeholder = '针对: "' + selectedText.slice(0, 40) + '"';
          }
          break;
        case 'create-task':
          const taskDesc = selectedText.slice(0, 60) || '来自 ' + FILE_PATH;
          if (confirm('将选中内容创建为任务?\\n\\n"' + taskDesc + '"')) {
            fetch('/api/spaces/' + SPACE_ID + '/annotations', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({filePath: FILE_PATH, line: parseInt(line)||0, content: selectedText || taskDesc, author: 'web-user', authorType: 'human'})
            }).then(r => r.json()).then(d => {
              return fetch('/api/spaces/' + SPACE_ID + '/annotations/' + d.annotation.id + '/to-task', {method:'POST', headers:{'Content-Type':'application/json'}});
            }).then(() => { alert('已创建任务！'); location.reload(); });
          }
          break;
        case 'copy-text':
          navigator.clipboard.writeText(selectedText).then(() => alert('已复制文本'));
          break;
      }
    });
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
