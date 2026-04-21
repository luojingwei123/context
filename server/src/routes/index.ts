/**
 * Context Server — API Routes (v1.1)
 *
 * 两套访问入口：
 * - /api/*  → JSON REST API（给 Agent tools / 插件调用）
 * - /s/*    → Web UI（给人类浏览器）
 * - /ctx/*  → 智能分流（浏览器→渲染页面，Agent→JSON/原文）
 */

import { Router } from "express";
import crypto from "crypto";
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

// ── Password hashing (scrypt, no deps) ──
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === check;
}

// ── Session cookie helpers ──
function getSessionToken(req: any): string | null {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/ctx_session=([^;]+)/);
  return match ? match[1] : null;
}
function setSessionCookie(res: any, token: string) {
  res.setHeader("Set-Cookie", `ctx_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`);
}
function clearSessionCookie(res: any) {
  res.setHeader("Set-Cookie", `ctx_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// ── Get current user from session (returns null if not logged in) ──
async function getCurrentUser(req: any): Promise<{ id: string; username: string; displayName: string; role: string } | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  const user = await storage.getSessionUser(token);
  if (!user) return null;
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

// ════════════════════════════════════════════════════════════════
// API Routes (JSON，给 Agent / Plugin 调用)
// ════════════════════════════════════════════════════════════════

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "context-server",
    version: "1.07",
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
      const ctxUser = await getCurrentUser(req); return res.type("text/html").send(await renderSpacePage(spaceId, space, ctxUser));
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
      const ctxUser2 = await getCurrentUser(req); return res.type("text/html").send(renderFilePage(space, file, spaceId, filePath, annotations, req, ctxUser2));
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
// Auth Routes (登录 / 注册 / 登出)
// ════════════════════════════════════════════════════════════════

/** Login page */
router.get("/auth/login", async (req, res) => {
  const user = await getCurrentUser(req);
  if (user) return res.redirect("/s");
  const error = req.query.error as string || "";
  const success = req.query.success as string || "";
  res.type("text/html").send(authPage("登录", `
    <div class="auth-card">
      <div class="auth-logo">📦</div>
      <h1 class="auth-title">欢迎回来</h1>
      <p class="auth-subtitle">登录你的 Context 账户</p>
      ${error ? `<div class="auth-error">${esc(error)}</div>` : ""}
      ${success ? `<div class="auth-success">${esc(success)}</div>` : ""}
      <form method="POST" action="/auth/login" class="auth-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input id="username" name="username" type="text" required autocomplete="username" placeholder="输入用户名">
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="输入密码">
        </div>
        <button type="submit" class="auth-btn">登录</button>
      </form>
      <p class="auth-link">还没有账户？ <a href="/auth/register">立即注册</a></p>
    </div>
  `));
});

/** Login handler */
router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.redirect("/auth/login?error=请填写用户名和密码");
    const user = await storage.getUserByUsername(username.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.redirect("/auth/login?error=用户名或密码错误");
    }
    const token = await storage.createSession(user.id);
    await storage.updateUserLogin(user.id);
    setSessionCookie(res, token);
    res.redirect("/s");
  } catch (err: any) { res.redirect("/auth/login?error=" + encodeURIComponent(err.message)); }
});

/** Register page */
router.get("/auth/register", async (req, res) => {
  const user = await getCurrentUser(req);
  if (user) return res.redirect("/s");
  const error = req.query.error as string || "";
  res.type("text/html").send(authPage("注册", `
    <div class="auth-card">
      <div class="auth-logo">📦</div>
      <h1 class="auth-title">创建账户</h1>
      <p class="auth-subtitle">加入 Context 协作平台</p>
      ${error ? `<div class="auth-error">${esc(error)}</div>` : ""}
      <form method="POST" action="/auth/register" class="auth-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input id="username" name="username" type="text" required autocomplete="username" placeholder="字母、数字、下划线" pattern="[a-zA-Z0-9_]{2,20}">
        </div>
        <div class="form-group">
          <label for="displayName">显示名称</label>
          <input id="displayName" name="displayName" type="text" required placeholder="你的名字">
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input id="password" name="password" type="password" required autocomplete="new-password" placeholder="至少 6 位" minlength="6">
        </div>
        <div class="form-group">
          <label for="password2">确认密码</label>
          <input id="password2" name="password2" type="password" required autocomplete="new-password" placeholder="再次输入密码">
        </div>
        <button type="submit" class="auth-btn">注册</button>
      </form>
      <p class="auth-link">已有账户？ <a href="/auth/login">去登录</a></p>
    </div>
  `));
});

/** Register handler */
router.post("/auth/register", async (req, res) => {
  try {
    const { username, displayName, password, password2 } = req.body;
    if (!username || !displayName || !password) return res.redirect("/auth/register?error=请填写所有字段");
    if (password.length < 6) return res.redirect("/auth/register?error=密码至少 6 位");
    if (password !== password2) return res.redirect("/auth/register?error=两次密码不一致");
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(cleanUsername)) return res.redirect("/auth/register?error=用户名只能包含字母、数字和下划线（2-20位）");
    const existing = await storage.getUserByUsername(cleanUsername);
    if (existing) return res.redirect("/auth/register?error=用户名已被使用");
    const hash = hashPassword(password);
    const user = await storage.createUser(cleanUsername, displayName.trim(), hash);
    const token = await storage.createSession(user.id);
    setSessionCookie(res, token);
    res.redirect("/s");
  } catch (err: any) { res.redirect("/auth/register?error=" + encodeURIComponent(err.message)); }
});

/** Logout */
router.get("/auth/logout", async (req, res) => {
  const token = getSessionToken(req);
  if (token) await storage.deleteSession(token);
  clearSessionCookie(res);
  res.redirect("/auth/login");
});

/** API: get current user */
router.get("/auth/me", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ user });
});

// ════════════════════════════════════════════════════════════════
// /s/* — Web UI（需要登录）
// ════════════════════════════════════════════════════════════════

/** Auth guard: all /s/* routes require login */
router.use("/s", async (req: any, res, next) => {
  const user = await getCurrentUser(req);
  if (!user) return res.redirect("/auth/login");
  req.ctxUser = user; // attach to request for downstream handlers
  next();
});

/** Home: my spaces list */
router.get("/s", async (req: any, res) => {
  try {
    const user = req.ctxUser;
    const mySpaces = await storage.getUserSpaces(user.id);

    const spacesHtml = mySpaces.length > 0
      ? `<div class="file-grid">${mySpaces.map((s: any) => `
          <a href="/s/${esc(s.id)}" class="file-card">
            <div class="icon">📦</div>
            <div class="name">${esc(s.name)}</div>
            <div class="file-meta">
              <span class="badge badge-channel">${esc(s.channel)}</span>
              · ${s.userRole === 'owner' ? '👑 所有者' : '👤 成员'}
            </div>
          </a>
        `).join("")}</div>`
      : `<div class="empty-state">
          <div class="empty-icon">📦</div>
          <p>还没有加入任何空间</p>
          <p style="font-size:13px;">创建一个新空间，或通过 Space ID 加入已有空间</p>
        </div>`;

    res.type("text/html").send(page("我的空间", user, `
      <div class="hero" style="padding:36px 24px 28px;">
        <div class="hero-glow"></div>
        <h1>我的空间</h1>
        <p class="hero-desc">欢迎回来，${esc(user.displayName)}</p>
      </div>

      <div class="card glass fade-in">
        <div class="card-header">
          <h2 style="margin:0;">📦 我的空间</h2>
          <span class="badge badge-channel">${mySpaces.length} 个空间</span>
        </div>
        ${spacesHtml}
      </div>

      <div class="card glass fade-in">
        <div class="card-header">
          <h2 style="margin:0;">🔗 加入空间</h2>
        </div>
        <form method="POST" action="/s/join" style="display:flex;gap:8px;">
          <input name="spaceId" placeholder="输入 Space ID" style="flex:1;" required>
          <button type="submit" class="btn btn-primary">加入 →</button>
        </form>
      </div>

      <div class="card glass fade-in">
        <div class="card-header">
          <h2 style="margin:0;">➕ 创建新空间</h2>
        </div>
        <form method="POST" action="/s/create" class="form-grid">
          <div class="form-row">
            <div class="form-group"><label>空间名称</label><input name="name" required placeholder="My Project"></div>
            <div class="form-group"><label>Channel</label><select name="channel"><option>discord</option><option>dmwork</option><option>telegram</option><option>slack</option><option>webchat</option></select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Group ID</label><input name="groupId" required placeholder="群 / 服务器 ID"></div>
            <div class="form-group">
              <label>模板</label>
              <select name="template">
                <option value="software-dev">🛠 软件开发</option>
                <option value="content">📝 内容创作</option>
                <option value="research">🔬 研究项目</option>
                <option value="blank">📄 空白</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="align-self:flex-start;">🚀 创建空间</button>
        </form>
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

/** Join a space by ID */
router.post("/s/join", async (req: any, res) => {
  try {
    const user = req.ctxUser;
    const spaceId = (req.body.spaceId || "").trim();
    if (!spaceId) return res.redirect("/s");
    const space = await storage.getSpace(spaceId);
    if (!space) return res.redirect("/s?error=space_not_found");
    await storage.addUserSpace(user.id, spaceId, "member");
    res.redirect(`/s/${spaceId}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

router.post("/s/create", async (req: any, res) => {
  try {
    const user = req.ctxUser;
    const { name, channel, groupId, template } = req.body;
    if (!name || !channel || !groupId) return res.status(400).send("name, channel, groupId required");

    const existing = await storage.findSpace({ channel, groupId });
    if (existing) {
      await storage.addUserSpace(user.id, existing.id, "member");
      return res.redirect(`/s/${existing.id}`);
    }

    const space = await storage.createSpace({ name, channel, groupId, createdBy: user.displayName });
    const tmpl = template || "software-dev";
    await storage.writeFile(space.id, "SPACE.md", getTemplate("SPACE.md", tmpl, { spaceName: name, channel }), user.displayName);
    await storage.writeFile(space.id, "TEAM.md", getTemplate("TEAM.md", tmpl, { spaceName: name }), user.displayName);
    await storage.writeFile(space.id, "TASK.md", getTemplate("TASK.md", tmpl, { spaceName: name }), user.displayName);
    await storage.addUserSpace(user.id, space.id, "owner");
    res.redirect(`/s/${space.id}`);
  } catch (err: any) { res.status(500).send(err.message); }
});

/** Space overview */
router.get("/s/:id", async (req, res) => {
  try {
    const space = await storage.getSpace(req.params.id);
    if (!space) return res.status(404).send(notFoundPage("Space not found"));
    const user = (req as any).ctxUser; res.type("text/html").send(await renderSpacePage(req.params.id, space, user));
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
    const user = (req as any).ctxUser; let html = renderFilePage(space, file, req.params.id, filePath, annotations, req, user);
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
    const user = (req as any).ctxUser;
    res.type("text/html").send(page(`编辑 ${filePath}`, user, `
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
    const user = (req as any).ctxUser;
    res.type("text/html").send(page("新建文件", user, `
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
            
            // Binary files → file_blobs, text files → files table
            if (storage.isBinaryFile(filename)) {
              await storage.writeBinaryFile(req.params.id, filename, trimmed, "web-upload");
            } else {
              const content = trimmed.toString("utf-8");
              await storage.writeFile(req.params.id, filename, content, "web-upload");
            }
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

    const user = (req as any).ctxUser;
    res.type("text/html").send(page(`搜索: ${q}`, user, `
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

    const user = (req as any).ctxUser;
    res.type("text/html").send(page("批注清单", user, `
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

    const user = (req as any).ctxUser;
    res.type("text/html").send(page(`历史 — ${filePath}`, user, `
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

    const user = (req as any).ctxUser;
    res.type("text/html").send(page(`v${version} — ${filePath}`, user, `
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
// HTML Rendering Helpers — Apple-inspired Design
// ════════════════════════════════════════════════════════════════

const CSS = `
  :root {
    --primary: #0071e3;
    --primary-hover: #0077ED;
    --primary-light: rgba(0,113,227,.08);
    --success: #30d158;
    --success-light: rgba(48,209,88,.1);
    --danger: #ff453a;
    --danger-light: rgba(255,69,58,.1);
    --warning: #ff9f0a;
    --warning-light: rgba(255,159,10,.1);
    --bg: #f5f5f7;
    --bg-card: rgba(255,255,255,.72);
    --bg-hover: rgba(0,0,0,.03);
    --bg-code: #f5f5f7;
    --border: rgba(0,0,0,.08);
    --border-strong: rgba(0,0,0,.12);
    --text: #1d1d1f;
    --text-secondary: #6e6e73;
    --text-muted: #aeaeb2;
    --shadow: 0 1px 3px rgba(0,0,0,.06);
    --shadow-md: 0 4px 12px rgba(0,0,0,.08);
    --shadow-lg: 0 8px 30px rgba(0,0,0,.12);
    --radius: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --blur: blur(20px) saturate(180%);
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --primary: #0a84ff;
      --primary-hover: #409cff;
      --primary-light: rgba(10,132,255,.15);
      --success: #30d158;
      --success-light: rgba(48,209,88,.15);
      --danger: #ff453a;
      --danger-light: rgba(255,69,58,.15);
      --warning: #ff9f0a;
      --warning-light: rgba(255,159,10,.15);
      --bg: #000000;
      --bg-card: rgba(28,28,30,.72);
      --bg-hover: rgba(255,255,255,.05);
      --bg-code: rgba(28,28,30,.9);
      --border: rgba(255,255,255,.08);
      --border-strong: rgba(255,255,255,.12);
      --text: #f5f5f7;
      --text-secondary: #a1a1a6;
      --text-muted: #636366;
      --shadow: 0 1px 3px rgba(0,0,0,.3);
      --shadow-md: 0 4px 12px rgba(0,0,0,.4);
      --shadow-lg: 0 8px 30px rgba(0,0,0,.5);
    }
  }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", "Noto Sans SC", sans-serif; margin: 0; padding: 0; line-height: 1.47059; color: var(--text); background: var(--bg); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; letter-spacing: -.022em; }
  .container { max-width: 980px; margin: 0 auto; padding: 28px 22px; }
  .card { background: var(--bg-card); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 20px; box-shadow: var(--shadow); transition: box-shadow .3s, transform .3s; }
  .card:hover { box-shadow: var(--shadow-md); }
  .card.glass { background: var(--bg-card); backdrop-filter: var(--blur); }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
  .card-header h2 { margin: 0; font-size: 17px; font-weight: 600; }
  h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px; color: var(--text); letter-spacing: -.025em; }
  h2 { font-size: 22px; font-weight: 600; color: var(--text); margin-top: 24px; letter-spacing: -.02em; }
  h3 { font-size: 17px; font-weight: 600; color: var(--text); }
  a { color: var(--primary); text-decoration: none; transition: opacity .2s; }
  a:hover { opacity: .75; }
  hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
  blockquote { border-left: 3px solid var(--primary); padding: 10px 16px; margin: 12px 0; background: var(--primary-light); border-radius: 0 var(--radius) var(--radius) 0; color: var(--text-secondary); font-size: 15px; }
  pre { background: var(--bg-code); padding: 16px; border-radius: var(--radius); overflow-x: auto; border: 1px solid var(--border); font-size: 13px; line-height: 1.6; }
  code { background: var(--bg-code); padding: 2px 7px; border-radius: 6px; font-size: .85em; font-family: "SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace; }
  pre code { background: none; padding: 0; }
  /* ── Form Controls (Apple-style) ── */
  input[type="text"], input[type="number"], input[type="email"], input[type="url"], input[type="search"], input[type="password"],
  input:not([type]), textarea, select {
    font-family: inherit; font-size: 15px; line-height: 1.47;
    padding: 10px 14px; border: 1px solid var(--border-strong); border-radius: var(--radius);
    background: var(--bg-card); color: var(--text); transition: all .2s;
    outline: none; width: 100%;
    backdrop-filter: var(--blur);
  }
  input:focus, textarea:focus, select:focus {
    border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-light);
  }
  textarea { resize: vertical; min-height: 80px; }
  select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236e6e73' d='M2 4l4 4 4-4'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 34px; }
  label { font-size: 13px; font-weight: 500; color: var(--text-secondary); display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .02em; }
  .form-grid { display: flex; flex-direction: column; gap: 18px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-group { display: flex; flex-direction: column; }
  .form-group input, .form-group select, .form-group textarea { margin-top: 0; }
  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
  th { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .15s; }
  tbody tr:hover { background: var(--bg-hover); }
  .table-wrap { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-card); backdrop-filter: var(--blur); }
  /* ── Components ── */
  .breadcrumb { color: var(--text-muted); margin-bottom: 20px; font-size: 13px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--text-secondary); font-weight: 500; }
  .breadcrumb a:hover { color: var(--primary); opacity: 1; }
  .breadcrumb span { color: var(--text-muted); font-size: 10px; }
  .meta { background: var(--bg-code); padding: 14px 18px; border-radius: var(--radius); margin: 14px 0; border: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); line-height: 1.9; }
  .meta b { color: var(--text); font-weight: 600; }
  .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: .01em; }
  .badge-agent { background: var(--primary-light); color: var(--primary); }
  .badge-human { background: var(--success-light); color: var(--success); }
  .badge-creator { background: var(--warning-light); color: var(--warning); }
  .badge-channel { background: var(--bg-code); color: var(--text-secondary); border: 1px solid var(--border); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; border-radius: 980px; font-size: 14px; font-weight: 500; border: none; background: var(--bg-code); color: var(--text); cursor: pointer; text-decoration: none; transition: all .2s; line-height: 1.2; letter-spacing: -.01em; }
  .btn:hover { opacity: .85; text-decoration: none; transform: scale(1.02); }
  .btn:active { transform: scale(.98); }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-primary:hover { background: var(--primary-hover); opacity: 1; }
  .btn-success { background: var(--success); color: #fff; }
  .btn-danger { background: var(--danger-light); color: var(--danger); }
  .btn-danger:hover { background: var(--danger); color: #fff; opacity: 1; }
  .btn-ghost { background: transparent; color: var(--text-secondary); }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text); opacity: 1; }
  .btn-small { padding: 5px 12px; font-size: 12px; border-radius: 980px; border: 1px solid var(--border); background: var(--bg-card); cursor: pointer; transition: all .2s; color: var(--text); font-family: inherit; font-weight: 500; }
  .btn-small:hover { background: var(--bg-hover); border-color: var(--border-strong); }
  .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
  .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin: 18px 0; }
  .file-card { background: var(--bg-card); backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 10px; transition: all .25s; text-decoration: none; color: var(--text); position: relative; }
  .file-card:hover { border-color: var(--primary); box-shadow: var(--shadow-md); text-decoration: none; transform: translateY(-3px); }
  .file-card .icon { font-size: 32px; }
  .file-card .name { font-size: 14px; font-weight: 500; word-break: break-all; display: flex; align-items: center; gap: 6px; }
  .file-card .file-meta { font-size: 12px; color: var(--text-muted); }
  .member-list { display: flex; flex-wrap: wrap; gap: 10px; }
  .member-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--bg-code); border: 1px solid var(--border); border-radius: 980px; font-size: 13px; transition: all .15s; }
  .member-chip:hover { border-color: var(--border-strong); background: var(--bg-hover); }
  .upload-zone { border: 2px dashed var(--border-strong); border-radius: var(--radius-xl); padding: 44px 32px; text-align: center; cursor: pointer; transition: all .25s; margin: 18px 0; }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--primary); background: var(--primary-light); }
  .upload-zone p { margin: 8px 0; color: var(--text-secondary); font-size: 15px; }
  .upload-zone .upload-icon { font-size: 40px; margin-bottom: 8px; opacity: .6; }
  .annotation { background: var(--warning-light); border: 1px solid rgba(255,159,10,.2); border-radius: var(--radius); padding: 16px 18px; margin: 12px 0; }
  .annotation.resolved { background: var(--bg-code); border-color: var(--border); opacity: .5; }
  .annotation .ann-header { font-size: 13px; margin-bottom: 8px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .annotation .ann-content { margin: 8px 0; font-size: 15px; line-height: 1.6; }
  .annotation .ann-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .code-table { border-collapse: collapse; width: 100%; font-size: 13px; font-family: "SF Mono", "Fira Code", Menlo, monospace; line-height: 1.6; }
  .code-table tr { transition: background .1s; }
  .code-table tr:hover { background: var(--bg-hover); }
  .code-table .line-num { color: var(--text-muted); text-align: right; padding: 2px 14px 2px 10px; user-select: none; width: 52px; min-width: 52px; font-size: 12px; vertical-align: top; border-right: 1px solid var(--border); }
  .code-table .line-content { white-space: pre-wrap; word-break: break-all; padding: 2px 16px; }
  .add-annotation { background: var(--bg-card); backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px; margin-top: 22px; box-shadow: var(--shadow); }
  .toast { position: fixed; top: 20px; right: 20px; padding: 14px 22px; border-radius: 980px; font-size: 14px; z-index: 9999; animation: slideIn .3s ease; pointer-events: none; backdrop-filter: var(--blur); font-weight: 500; }
  .toast-success { background: var(--success-light); color: var(--success); }
  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn .5s ease; }
  /* ── Navigation (Apple glass bar) ── */
  .nav { background: rgba(255,255,255,.72); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); border-bottom: 1px solid var(--border); padding: 0 22px; position: sticky; top: 0; z-index: 100; }
  @media (prefers-color-scheme: dark) { .nav { background: rgba(28,28,30,.72); } }
  .nav-inner { max-width: 980px; margin: 0 auto; display: flex; align-items: center; gap: 20px; height: 48px; }
  .nav-brand { font-weight: 600; font-size: 15px; color: var(--text); display: flex; align-items: center; gap: 8px; text-decoration: none; letter-spacing: -.01em; }
  .nav-brand:hover { opacity: .7; }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: 16px; font-size: 13px; }
  .nav-right a { color: var(--text-secondary); font-weight: 500; }
  .nav-right a:hover { color: var(--primary); opacity: 1; }
  .nav-user { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; background: var(--bg-code); border-radius: 980px; font-size: 13px; font-weight: 500; color: var(--text); }
  .nav-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #5856d6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 600; }
  .empty-state { text-align: center; padding: 52px 24px; color: var(--text-muted); }
  .empty-state .empty-icon { font-size: 52px; margin-bottom: 16px; opacity: .5; }
  .empty-state p { margin: 8px 0; font-size: 15px; }
  .search-result { background: var(--bg-card); backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; margin: 12px 0; transition: all .2s; }
  .search-result:hover { border-color: var(--primary); box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .search-result .result-path { font-weight: 600; font-size: 15px; }
  .search-result .result-count { font-size: 12px; color: var(--text-muted); margin-left: 8px; }
  .search-result ul { margin: 10px 0 0; padding-left: 0; list-style: none; }
  .search-result li { padding: 5px 0; font-size: 13px; color: var(--text-secondary); border-bottom: 1px solid var(--border); font-family: "SF Mono", Menlo, monospace; }
  .search-result li:last-child { border-bottom: none; }
  .search-result li small { color: var(--text-muted); margin-right: 10px; }
  .editor-area { width: 100%; min-height: 500px; font-family: "SF Mono", "Fira Code", Menlo, monospace; font-size: 14px; line-height: 1.6; padding: 18px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-code); color: var(--text); resize: vertical; tab-size: 2; }
  .editor-area:focus { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-light); }
  /* Split view */
  .split-view { display: flex; gap: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; min-height: 500px; background: var(--bg-card); }
  .split-pane { flex: 1; min-width: 0; overflow: auto; position: relative; }
  .split-pane-source { border-right: 1px solid var(--border); background: var(--bg-code); }
  .split-pane-source textarea { width: 100%; height: 100%; min-height: 500px; border: none; outline: none; padding: 16px; font-family: "SF Mono","Fira Code",Menlo,monospace; font-size: 13px; line-height: 1.6; resize: none; background: transparent; color: var(--text); tab-size: 2; }
  .split-pane-preview { padding: 20px 24px; background: var(--bg-card); }
  .split-pane-preview h1,.split-pane-preview h2,.split-pane-preview h3 { margin-top: 1em; margin-bottom: .5em; }
  .split-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: var(--bg-page); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  .split-header .save-indicator { font-size: 11px; color: var(--text-muted); font-weight: normal; text-transform: none; }
  .split-divider { width: 4px; background: var(--border); cursor: col-resize; flex-shrink: 0; transition: background .2s; }
  .split-divider:hover, .split-divider.dragging { background: var(--primary); }
  /* Circle select overlay */
  .circle-select-canvas { position: absolute; inset: 0; z-index: 50; cursor: crosshair; }
  .circle-select-rect { position: absolute; border: 2px dashed #3b82f6; background: rgba(59,130,246,.08); border-radius: 4px; pointer-events: none; z-index: 51; }
  .circle-toolbar { position: absolute; z-index: 9999; background: #1e293b; color: #fff; border-radius: 8px; padding: 8px 12px; box-shadow: 0 4px 16px rgba(0,0,0,.3); display: none; }
  .circle-toolbar button { background: none; border: none; color: #fff; cursor: pointer; padding: 4px 10px; border-radius: 4px; font-size: 13px; }
  .circle-toolbar button:hover { background: rgba(255,255,255,.15); }
  /* Mode toggle */
  .view-mode-toggle { display: inline-flex; background: var(--bg-code); border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden; }
  .view-mode-toggle button { padding: 6px 14px; font-size: 12px; border: none; background: none; cursor: pointer; color: var(--text-secondary); font-weight: 500; }
  .view-mode-toggle button.active { background: var(--primary); color: #fff; }
  .view-mode-toggle button:hover:not(.active) { background: var(--bg-hover); }
  /* ── Hero ── */
  .hero { text-align: center; padding: 56px 24px 48px; position: relative; overflow: hidden; }
  .hero h1 { font-size: 40px; margin-bottom: 14px; letter-spacing: -.03em; background: linear-gradient(135deg, var(--text) 0%, var(--text-secondary) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .hero .hero-desc { font-size: 17px; color: var(--text-secondary); max-width: 560px; margin: 0 auto 28px; line-height: 1.5; font-weight: 400; }
  .hero-glow { position: absolute; top: -120px; left: 50%; transform: translateX(-50%); width: 600px; height: 400px; background: radial-gradient(ellipse, var(--primary-light) 0%, transparent 70%); pointer-events: none; opacity: .6; z-index: -1; }
  .hero-features { display: flex; justify-content: center; gap: 36px; margin-top: 28px; flex-wrap: wrap; }
  .hero-features .feature { text-align: center; }
  .hero-features .feature-icon { font-size: 32px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--radius-lg); background: var(--bg-card); backdrop-filter: var(--blur); border: 1px solid var(--border); margin: 0 auto 10px; box-shadow: var(--shadow); }
  .hero-features .feature-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
  /* ── 404 ── */
  .not-found { text-align: center; padding: 100px 24px; }
  .not-found .nf-code { font-size: 80px; font-weight: 800; background: linear-gradient(135deg, var(--text-muted), var(--border-strong)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; }
  .not-found .nf-msg { font-size: 17px; color: var(--text-secondary); margin: 20px 0 32px; }
  .img-preview { text-align: center; padding: 24px; }
  .img-preview img { max-width: 100%; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); }
  details { margin: 8px 0; }
  details > summary { cursor: pointer; font-size: 13px; color: var(--text-secondary); padding: 10px 0; user-select: none; font-weight: 500; }
  details > summary:hover { color: var(--primary); }
  /* ── Auth Pages ── */
  .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 20px; }
  .auth-card { width: 100%; max-width: 400px; background: var(--bg-card); backdrop-filter: var(--blur); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 40px 36px; box-shadow: var(--shadow-lg); text-align: center; }
  .auth-logo { font-size: 48px; margin-bottom: 16px; }
  .auth-title { font-size: 28px; font-weight: 700; letter-spacing: -.03em; margin-bottom: 6px; }
  .auth-subtitle { font-size: 15px; color: var(--text-secondary); margin-bottom: 28px; }
  .auth-form { text-align: left; display: flex; flex-direction: column; gap: 16px; }
  .auth-form .form-group { display: flex; flex-direction: column; }
  .auth-form label { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .03em; }
  .auth-btn { width: 100%; padding: 12px; border-radius: var(--radius); font-size: 16px; font-weight: 600; background: var(--primary); color: #fff; border: none; cursor: pointer; transition: all .2s; letter-spacing: -.01em; }
  .auth-btn:hover { background: var(--primary-hover); }
  .auth-btn:active { transform: scale(.98); }
  .auth-link { margin-top: 20px; font-size: 14px; color: var(--text-secondary); text-align: center; }
  .auth-link a { font-weight: 500; }
  .auth-error { background: var(--danger-light); color: var(--danger); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 12px; }
  .auth-success { background: var(--success-light); color: var(--success); padding: 10px 14px; border-radius: var(--radius); font-size: 14px; margin-bottom: 12px; }
  /* ── Responsive ── */
  @media (max-width: 640px) {
    .container { padding: 16px 14px; }
    .card { padding: 18px; border-radius: var(--radius); }
    .file-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .card-header { flex-direction: column; align-items: flex-start; gap: 8px; }
    .member-list { flex-direction: column; }
    .hero h1 { font-size: 28px; }
    .hero .hero-desc { font-size: 15px; }
    .hero-features { gap: 16px; }
    .btn-group { flex-direction: column; }
    .nav-inner { gap: 12px; }
    .editor-area { min-height: 350px; font-size: 13px; }
    .form-row { grid-template-columns: 1fr; }
    .auth-card { padding: 28px 22px; }
  }
  @media (max-width: 400px) {
    .file-grid { grid-template-columns: 1fr; }
  }
`;

function page(title: string, user: any, body: string): string {
  const userHtml = user
    ? `<div class="nav-user"><div class="nav-avatar">${esc(user.displayName[0].toUpperCase())}</div>${esc(user.displayName)}</div><a href="/auth/logout">退出</a>`
    : '<a href="/auth/login">登录</a>';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Context</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📦</text></svg>"><style>${CSS}</style></head><body>
  <nav class="nav"><div class="nav-inner"><a href="/s" class="nav-brand">📦 Context</a><div class="nav-right">${userHtml}</div></div></nav>
  <div class="container">${body}</div></body></html>`;
}

function authPage(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — Context</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📦</text></svg>"><style>${CSS}</style></head><body>
  <div class="auth-page">${body}</div></body></html>`;
}

function notFoundPage(msg: string): string {
  return page("Not Found", null, `<div class="not-found"><div class="nf-code">404</div><div class="nf-msg">${esc(msg)}</div><a href="/s" class="btn btn-primary">← 回到首页</a></div>`);
}

async function renderSpacePage(spaceId: string, space: any, user?: any): Promise<string> {
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

  return page(space.name, user, `
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
          <input type="file" id="fileInput" name="file" multiple onchange="startUpload()">
        </form>
      </div>
      <!-- Upload loading overlay -->
      <div id="uploadOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:none;align-items:center;justify-content:center;">
        <div style="background:var(--bg-card,#fff);border-radius:16px;padding:32px 48px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);">
          <div class="spinner" style="width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
          <p style="font-size:16px;font-weight:500;margin:0;">上传中...</p>
          <p style="font-size:13px;color:var(--text-muted,#666);margin:6px 0 0;">请稍候</p>
        </div>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      <script>
      function startUpload() {
        document.getElementById('uploadOverlay').style.display = 'flex';
        document.getElementById('uploadForm').submit();
      }
      var zone = document.getElementById('uploadZone');
      zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', function() { zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', function(e) {
        e.preventDefault(); zone.classList.remove('drag-over');
        var input = document.getElementById('fileInput');
        input.files = e.dataTransfer.files;
        startUpload();
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

function renderFilePage(space: any, file: any, spaceId: string, filePath: string, annotations?: any[], req?: any, user?: any): string {
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
      : `<div style="position:relative;" id="officeContainer">
          <div id="officeLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg-card,#fff);border:1px solid var(--border);border-radius:var(--radius);z-index:10;">
            <div style="text-align:center;">
              <div id="officeSpinner" style="width:40px;height:40px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
              <p id="officeLoadText" style="font-size:15px;font-weight:500;margin:0;">文档加载中...</p>
              <p id="officeLoadSub" style="font-size:12px;color:var(--text-muted,#666);margin:6px 0 0;">正在连接 Office Online 预览服务</p>
            </div>
          </div>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
          <iframe id="officeFrame" src="${viewerUrl}" style="width:100%;height:600px;border:1px solid var(--border);border-radius:var(--radius);" title="Office Preview" onload="clearTimeout(window._officeTimeout);var el=document.getElementById('officeLoading');if(el)el.style.display='none';"></iframe>
          <script>
          window._officeTimeout = setTimeout(function() {
            var spinner = document.getElementById('officeSpinner');
            var text = document.getElementById('officeLoadText');
            var sub = document.getElementById('officeLoadSub');
            if (spinner) spinner.style.display = 'none';
            if (text) { text.textContent = '⚠️ 文档预览加载超时'; text.style.color = '#dc2626'; }
            if (sub) sub.innerHTML = '可能原因：文件损坏、网络问题或 Office Online 服务不可用<br><a href="${fileUrl}" download style="color:#2563eb;margin-top:8px;display:inline-block;">⬇️ 直接下载文件查看</a>';
          }, 15000);
          </script>
        </div>`;
    contentHtml = `<div style="margin-top:16px;">
      ${previewFrame}
      <div style="margin-top:12px;text-align:center;">
        <a href="/ctx/${spaceId}/${filePath}" class="btn btn-primary" download>⬇️ 下载文件</a>
        <span style="margin-left:12px;font-size:13px;color:var(--text-secondary);">${icons[ext] || "📄"} ${esc(filePath)} (${ext.toUpperCase()})</span>
      </div>
    </div>`;
  } else if (isMd) {
    const escapedContent = file.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    contentHtml = `
    <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
      <div class="view-mode-toggle" id="viewToggle">
        <button class="active" data-mode="split" onclick="setViewMode('split')">📐 分屏</button>
        <button data-mode="preview" onclick="setViewMode('preview')">👁️ 预览</button>
        <button data-mode="source" onclick="setViewMode('source')">📝 源码</button>
      </div>
      <button id="circleBtn" onclick="toggleCircleMode()" class="btn" style="font-size:12px;padding:4px 12px;">⭕ 圈选</button>
      <span id="circleHint" style="font-size:11px;color:var(--text-muted);display:none;">拖拽画框圈选区域，松手后可批注</span>
    </div>
    <div id="splitView" class="split-view">
      <div class="split-pane split-pane-source" id="sourcePane">
        <div class="split-header"><span>📝 源码 (可编辑)</span><span class="save-indicator" id="saveStatus">已保存</span></div>
        <textarea id="sourceEditor" spellcheck="false" oninput="onSourceEdit()">${esc(file.content)}</textarea>
      </div>
      <div class="split-divider" id="splitDivider"></div>
      <div class="split-pane split-pane-preview" id="previewPane" style="position:relative;">
        <div class="split-header"><span>👁️ 预览 (可框选批注 / 可圈选)</span></div>
        <div id="previewContent" style="padding:16px;">${mdToHtml(file.content)}</div>
      </div>
    </div>
    <div id="circleToolbar" class="circle-toolbar">
      <button onclick="doCircleAnnotate()">💬 批注此区域</button>
      <button onclick="cancelCircle()">✕ 取消</button>
    </div>
    <script>
    // ── Source content for live preview ──
    var sourceContent = \`${escapedContent}\`;

    // ── View mode toggle ──
    function setViewMode(mode) {
      var btns = document.querySelectorAll('#viewToggle button');
      btns.forEach(function(b) { b.classList.toggle('active', b.dataset.mode === mode); });
      var src = document.getElementById('sourcePane');
      var div = document.getElementById('splitDivider');
      var prev = document.getElementById('previewPane');
      if (mode === 'split') { src.style.display='block'; div.style.display='block'; prev.style.display='block'; }
      else if (mode === 'preview') { src.style.display='none'; div.style.display='none'; prev.style.display='block'; }
      else { src.style.display='block'; div.style.display='block'; prev.style.display='none'; }
    }

    // ── Live edit → preview ──
    var saveTimer = null;
    function onSourceEdit() {
      var ta = document.getElementById('sourceEditor');
      var preview = document.getElementById('previewContent');
      preview.innerHTML = miniMdToHtml(ta.value);
      document.getElementById('saveStatus').textContent = '● 未保存';
      document.getElementById('saveStatus').style.color = '#f59e0b';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function() { autoSave(ta.value); }, 2000);
    }

    function autoSave(content) {
      fetch('/api/spaces/${spaceId}/files/${filePath.replace(/'/g, "\\'")}', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content, modifiedBy: '${esc((user && user.displayName) || "web-user")}' })
      }).then(function(r) {
        if (r.ok) {
          document.getElementById('saveStatus').textContent = '✓ 已自动保存';
          document.getElementById('saveStatus').style.color = '#22c55e';
        }
      }).catch(function() {
        document.getElementById('saveStatus').textContent = '✕ 保存失败';
        document.getElementById('saveStatus').style.color = '#ef4444';
      });
    }

    // ── Mini markdown renderer (client-side) ──
    function miniMdToHtml(md) {
      var h = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      h = h.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');
      h = h.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      h = h.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
      h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      h = h.replace(/\\*\\*([^*]+)\\*\\*/g, '<b>$1</b>');
      h = h.replace(/\\*([^*]+)\\*/g, '<i>$1</i>');
      h = h.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
      h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
      h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
      h = h.replace(/(<li>[\\s\\S]*?<\\/li>\\n?)+/g, '<ul>$&</ul>');
      h = h.replace(/\\n\\n/g, '</p><p>');
      h = '<p>' + h + '</p>';
      h = h.replace(/<p>\\s*<\\/p>/g, '');
      return h;
    }

    // ── Resizable split divider ──
    (function() {
      var divider = document.getElementById('splitDivider');
      var split = document.getElementById('splitView');
      var src = document.getElementById('sourcePane');
      var isDragging = false;
      divider.addEventListener('mousedown', function(e) {
        isDragging = true; divider.classList.add('dragging');
        e.preventDefault();
      });
      document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        var rect = split.getBoundingClientRect();
        var pct = ((e.clientX - rect.left) / rect.width) * 100;
        pct = Math.max(20, Math.min(80, pct));
        src.style.flex = 'none'; src.style.width = pct + '%';
      });
      document.addEventListener('mouseup', function() {
        isDragging = false; divider.classList.remove('dragging');
      });
    })();

    // ── Circle select mode ──
    var circleMode = false;
    var circleCanvas = null;
    var circleRect = null;
    var circleStart = null;

    function toggleCircleMode() {
      circleMode = !circleMode;
      var btn = document.getElementById('circleBtn');
      var hint = document.getElementById('circleHint');
      var preview = document.getElementById('previewPane');
      if (circleMode) {
        btn.style.background = '#3b82f6'; btn.style.color = '#fff';
        hint.style.display = 'inline';
        // Create overlay canvas
        circleCanvas = document.createElement('div');
        circleCanvas.className = 'circle-select-canvas';
        circleCanvas.addEventListener('mousedown', circleDown);
        circleCanvas.addEventListener('mousemove', circleMove);
        circleCanvas.addEventListener('mouseup', circleUp);
        preview.style.position = 'relative';
        preview.appendChild(circleCanvas);
      } else {
        btn.style.background = ''; btn.style.color = '';
        hint.style.display = 'none';
        if (circleCanvas && circleCanvas.parentNode) circleCanvas.parentNode.removeChild(circleCanvas);
        if (circleRect && circleRect.parentNode) circleRect.parentNode.removeChild(circleRect);
        document.getElementById('circleToolbar').style.display = 'none';
        circleCanvas = null; circleRect = null;
      }
    }

    function circleDown(e) {
      if (circleRect && circleRect.parentNode) circleRect.parentNode.removeChild(circleRect);
      document.getElementById('circleToolbar').style.display = 'none';
      var pane = document.getElementById('previewPane');
      var r = pane.getBoundingClientRect();
      circleStart = { x: e.clientX - r.left + pane.scrollLeft, y: e.clientY - r.top + pane.scrollTop };
      circleRect = document.createElement('div');
      circleRect.className = 'circle-select-rect';
      pane.appendChild(circleRect);
    }

    function circleMove(e) {
      if (!circleStart || !circleRect) return;
      var pane = document.getElementById('previewPane');
      var r = pane.getBoundingClientRect();
      var cx = e.clientX - r.left + pane.scrollLeft;
      var cy = e.clientY - r.top + pane.scrollTop;
      var x = Math.min(circleStart.x, cx), y = Math.min(circleStart.y, cy);
      var w = Math.abs(cx - circleStart.x), h = Math.abs(cy - circleStart.y);
      circleRect.style.left = x + 'px'; circleRect.style.top = y + 'px';
      circleRect.style.width = w + 'px'; circleRect.style.height = h + 'px';
    }

    function circleUp(e) {
      if (!circleStart || !circleRect) return;
      var w = parseInt(circleRect.style.width); var h = parseInt(circleRect.style.height);
      if (w < 10 || h < 10) { if (circleRect.parentNode) circleRect.parentNode.removeChild(circleRect); circleStart = null; return; }
      // Show toolbar near the rect
      var toolbar = document.getElementById('circleToolbar');
      var pane = document.getElementById('previewPane');
      var pr = pane.getBoundingClientRect();
      toolbar.style.left = (pr.left + parseInt(circleRect.style.left) + w/2 - 80 + window.scrollX) + 'px';
      toolbar.style.top = (pr.top + parseInt(circleRect.style.top) + h + 10 + window.scrollY) + 'px';
      toolbar.style.display = 'block';
      circleStart = null;
    }

    function doCircleAnnotate() {
      document.getElementById('circleToolbar').style.display = 'none';
      var floatAnn = document.getElementById('floatingAnnotation');
      document.getElementById('floatLine').value = 0;
      document.getElementById('floatEndLine').value = 0;
      document.getElementById('floatLineInfo').textContent = '⭕ 圈选区域批注';
      var pane = document.getElementById('previewPane');
      var pr = pane.getBoundingClientRect();
      floatAnn.style.left = (pr.left + parseInt(circleRect.style.left) + window.scrollX) + 'px';
      floatAnn.style.top = (pr.top + parseInt(circleRect.style.top) + parseInt(circleRect.style.height) + 50 + window.scrollY) + 'px';
      floatAnn.style.display = 'block';
      document.getElementById('floatContent').focus();
    }

    function cancelCircle() {
      document.getElementById('circleToolbar').style.display = 'none';
      if (circleRect && circleRect.parentNode) circleRect.parentNode.removeChild(circleRect);
    }
    </script>`;
  } else {
    // Non-markdown text files: same split view but with code highlighting
    const escapedContent = file.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    contentHtml = `
    <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
      <div class="view-mode-toggle" id="viewToggle">
        <button class="active" data-mode="split" onclick="setViewMode('split')">📐 分屏</button>
        <button data-mode="source" onclick="setViewMode('source')">📝 源码</button>
      </div>
      <button id="circleBtn" onclick="toggleCircleMode()" class="btn" style="font-size:12px;padding:4px 12px;">⭕ 圈选</button>
    </div>
    <div id="splitView" class="split-view">
      <div class="split-pane split-pane-source" id="sourcePane">
        <div class="split-header"><span>📝 源码 (可编辑)</span><span class="save-indicator" id="saveStatus">已保存</span></div>
        <textarea id="sourceEditor" spellcheck="false" oninput="onSourceEdit()">${esc(file.content)}</textarea>
      </div>
      <div class="split-divider" id="splitDivider"></div>
      <div class="split-pane split-pane-preview" id="previewPane" style="position:relative;">
        <div class="split-header"><span>👁️ 带行号预览</span></div>
        <div id="previewContent"><table class="code-table">${numberedContent}</table></div>
      </div>
    </div>
    <div id="circleToolbar" class="circle-toolbar">
      <button onclick="doCircleAnnotate()">💬 批注此区域</button>
      <button onclick="cancelCircle()">✕ 取消</button>
    </div>
    <script>
    function setViewMode(mode) {
      var btns = document.querySelectorAll('#viewToggle button');
      btns.forEach(function(b) { b.classList.toggle('active', b.dataset.mode === mode); });
      var src = document.getElementById('sourcePane');
      var div = document.getElementById('splitDivider');
      var prev = document.getElementById('previewPane');
      if (mode === 'split') { src.style.display='block'; div.style.display='block'; prev.style.display='block'; }
      else if (mode === 'source') { src.style.display='block'; div.style.display='none'; prev.style.display='none'; }
      else { src.style.display='none'; div.style.display='none'; prev.style.display='block'; }
    }
    var saveTimer = null;
    function onSourceEdit() {
      document.getElementById('saveStatus').textContent = '● 未保存';
      document.getElementById('saveStatus').style.color = '#f59e0b';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function() {
        var ta = document.getElementById('sourceEditor');
        fetch('/api/spaces/${spaceId}/files/${filePath.replace(/'/g, "\\'")}', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: ta.value, modifiedBy: '${esc((user && user.displayName) || "web-user")}' })
        }).then(function(r) {
          if (r.ok) { document.getElementById('saveStatus').textContent = '✓ 已自动保存'; document.getElementById('saveStatus').style.color = '#22c55e'; }
        }).catch(function() { document.getElementById('saveStatus').textContent = '✕ 保存失败'; document.getElementById('saveStatus').style.color = '#ef4444'; });
      }, 2000);
    }
    // Resizable divider
    (function() {
      var divider = document.getElementById('splitDivider');
      var split = document.getElementById('splitView');
      var src = document.getElementById('sourcePane');
      var isDragging = false;
      divider.addEventListener('mousedown', function(e) { isDragging = true; divider.classList.add('dragging'); e.preventDefault(); });
      document.addEventListener('mousemove', function(e) { if (!isDragging) return; var rect = split.getBoundingClientRect(); var pct = ((e.clientX - rect.left) / rect.width) * 100; pct = Math.max(20, Math.min(80, pct)); src.style.flex = 'none'; src.style.width = pct + '%'; });
      document.addEventListener('mouseup', function() { isDragging = false; divider.classList.remove('dragging'); });
    })();
    // Circle select
    var circleMode = false, circleCanvas = null, circleRect = null, circleStart = null;
    function toggleCircleMode() {
      circleMode = !circleMode;
      var btn = document.getElementById('circleBtn');
      var preview = document.getElementById('previewPane');
      if (circleMode) {
        btn.style.background = '#3b82f6'; btn.style.color = '#fff';
        circleCanvas = document.createElement('div'); circleCanvas.className = 'circle-select-canvas';
        circleCanvas.addEventListener('mousedown', circleDown); circleCanvas.addEventListener('mousemove', circleMove); circleCanvas.addEventListener('mouseup', circleUp);
        preview.style.position = 'relative'; preview.appendChild(circleCanvas);
      } else {
        btn.style.background = ''; btn.style.color = '';
        if (circleCanvas && circleCanvas.parentNode) circleCanvas.parentNode.removeChild(circleCanvas);
        if (circleRect && circleRect.parentNode) circleRect.parentNode.removeChild(circleRect);
        document.getElementById('circleToolbar').style.display = 'none'; circleCanvas = null; circleRect = null;
      }
    }
    function circleDown(e) { if (circleRect && circleRect.parentNode) circleRect.parentNode.removeChild(circleRect); document.getElementById('circleToolbar').style.display='none'; var pane=document.getElementById('previewPane'); var r=pane.getBoundingClientRect(); circleStart={x:e.clientX-r.left+pane.scrollLeft,y:e.clientY-r.top+pane.scrollTop}; circleRect=document.createElement('div'); circleRect.className='circle-select-rect'; pane.appendChild(circleRect); }
    function circleMove(e) { if(!circleStart||!circleRect) return; var pane=document.getElementById('previewPane'); var r=pane.getBoundingClientRect(); var cx=e.clientX-r.left+pane.scrollLeft,cy=e.clientY-r.top+pane.scrollTop; circleRect.style.left=Math.min(circleStart.x,cx)+'px'; circleRect.style.top=Math.min(circleStart.y,cy)+'px'; circleRect.style.width=Math.abs(cx-circleStart.x)+'px'; circleRect.style.height=Math.abs(cy-circleStart.y)+'px'; }
    function circleUp(e) { if(!circleStart||!circleRect) return; var w=parseInt(circleRect.style.width),h=parseInt(circleRect.style.height); if(w<10||h<10){if(circleRect.parentNode)circleRect.parentNode.removeChild(circleRect);circleStart=null;return;} var toolbar=document.getElementById('circleToolbar'); var pane=document.getElementById('previewPane'); var pr=pane.getBoundingClientRect(); toolbar.style.left=(pr.left+parseInt(circleRect.style.left)+w/2-80+window.scrollX)+'px'; toolbar.style.top=(pr.top+parseInt(circleRect.style.top)+h+10+window.scrollY)+'px'; toolbar.style.display='block'; circleStart=null; }
    function doCircleAnnotate() { document.getElementById('circleToolbar').style.display='none'; var floatAnn=document.getElementById('floatingAnnotation'); document.getElementById('floatLine').value=0; document.getElementById('floatEndLine').value=0; document.getElementById('floatLineInfo').textContent='⭕ 圈选区域批注'; var pane=document.getElementById('previewPane'); var pr=pane.getBoundingClientRect(); floatAnn.style.left=(pr.left+parseInt(circleRect.style.left)+window.scrollX)+'px'; floatAnn.style.top=(pr.top+parseInt(circleRect.style.top)+parseInt(circleRect.style.height)+50+window.scrollY)+'px'; floatAnn.style.display='block'; document.getElementById('floatContent').focus(); }
    function cancelCircle() { document.getElementById('circleToolbar').style.display='none'; if(circleRect&&circleRect.parentNode)circleRect.parentNode.removeChild(circleRect); }
    </script>`;
  }

  return page(`${filePath} — ${space.name}`, user, `
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
