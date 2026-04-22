/**
 * Context Server — Storage Engine (Database-backed)
 *
 * Drop-in replacement for filesystem storage.
 * Uses libSQL/Turso for persistence.
 */

import { nanoid } from "nanoid";
import { getDb } from "../db.js";
import type { Space, SpaceMember, SpaceFile, CreateSpaceRequest, SpaceLookupQuery, Annotation } from "../types.js";

// ═══════════════════════════════════════
// Spaces

export async function createSpace(req: CreateSpaceRequest): Promise<Space> {
  const db = getDb();
  const id = nanoid(12);
  const now = new Date().toISOString();
  const space: Space = {
    id,
    name: req.name,
    channel: req.channel,
    groupId: req.groupId,
    createdBy: req.createdBy || "unknown",
    createdAt: now,
    updatedAt: now,
  };

  await db.execute({
    sql: "INSERT INTO spaces (id, name, channel, group_id, channel_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    args: [id, space.name, space.channel, space.groupId, req.channelId || null, space.createdBy, now, now],
  });

  // Create template files if specified
  if (req.template && req.template !== "blank") {
    const templates = getTemplateFiles(req.template, space.name, req.createdBy || "system");
    for (const [path, content] of Object.entries(templates)) {
      await writeFile(id, path, content, "system");
    }
  }

  return space;
}

export async function getSpace(spaceId: string): Promise<Space | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT * FROM spaces WHERE id = ?", args: [spaceId] });
  if (result.rows.length === 0) return null;
  return rowToSpace(result.rows[0]);
}

export async function findSpace(query: SpaceLookupQuery): Promise<Space | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM spaces WHERE channel = ? AND group_id = ?",
    args: [query.channel, query.groupId],
  });
  if (result.rows.length === 0) return null;
  return rowToSpace(result.rows[0]);
}

export async function updateSpace(spaceId: string, space: Space): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "UPDATE spaces SET name = ?, webhook_url = ?, updated_at = ? WHERE id = ?",
    args: [space.name, space.webhookUrl || null, space.updatedAt || new Date().toISOString(), spaceId],
  });
}

export async function deleteSpace(spaceId: string): Promise<boolean> {
  const db = getDb();
  const space = await getSpace(spaceId);
  if (!space) return false;

  // Delete all related data
  await db.executeMultiple(`
    DELETE FROM files WHERE space_id = '${spaceId}';
    DELETE FROM file_history WHERE space_id = '${spaceId}';
    DELETE FROM file_blobs WHERE space_id = '${spaceId}';
    DELETE FROM members WHERE space_id = '${spaceId}';
    DELETE FROM annotations WHERE space_id = '${spaceId}';
    DELETE FROM notifications WHERE space_id = '${spaceId}';
    DELETE FROM spaces WHERE id = '${spaceId}';
  `);
  return true;
}

function rowToSpace(row: any): Space {
  return {
    id: row.id as string,
    name: row.name as string,
    channel: row.channel as string,
    groupId: row.group_id as string,
    channelId: row.channel_id as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    webhookUrl: row.webhook_url as string | undefined,
  };
}

// ═══════════════════════════════════════
// Files

/** Check if a file extension is a binary (non-text) format */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const binaryExts = new Set([
    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf",
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff",
    "zip", "tar", "gz", "7z", "rar",
    "mp3", "mp4", "wav", "avi", "mov", "mkv",
    "ttf", "otf", "woff", "woff2", "eot",
  ]);
  return binaryExts.has(ext);
}

/** Write a binary file (Buffer) to file_blobs + a placeholder in files */
export async function writeBinaryFile(spaceId: string, filePath: string, data: Buffer, modifiedBy: string): Promise<SpaceFile> {
  const db = getDb();
  const now = new Date().toISOString();
  const mimeType = guessMimeType(filePath);
  const size = data.length;

  // Upsert into file_blobs
  await db.execute({
    sql: "INSERT OR REPLACE INTO file_blobs (space_id, path, data) VALUES (?, ?, ?)",
    args: [spaceId, filePath, data],
  });

  // Also upsert a placeholder in files table (for listing, version tracking, etc.)
  const existing = await db.execute({
    sql: "SELECT version FROM files WHERE space_id = ? AND path = ?",
    args: [spaceId, filePath],
  });

  let version = 1;
  if (existing.rows.length > 0) {
    version = (existing.rows[0].version as number) + 1;
    await db.execute({
      sql: "UPDATE files SET content = ?, mime_type = ?, version = ?, modified_by = ?, size = ?, updated_at = ? WHERE space_id = ? AND path = ?",
      args: [`[binary file: ${mimeType}, ${size} bytes]`, mimeType, version, modifiedBy, size, now, spaceId, filePath],
    });
  } else {
    await db.execute({
      sql: "INSERT INTO files (space_id, path, content, mime_type, version, modified_by, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [spaceId, filePath, `[binary file: ${mimeType}, ${size} bytes]`, mimeType, version, modifiedBy, size, now, now],
    });
  }

  return {
    id: filePath,
    spaceId,
    path: filePath,
    content: `[binary file: ${mimeType}, ${size} bytes]`,
    mimeType,
    size,
    version,
    modifiedBy,
    createdAt: now,
    updatedAt: now,
  };
}

export async function writeFile(spaceId: string, filePath: string, content: string, modifiedBy: string, mimeTypeOverride?: string): Promise<SpaceFile> {
  const db = getDb();
  const now = new Date().toISOString();
  const size = Buffer.byteLength(content, "utf-8");
  const mimeType = mimeTypeOverride || guessMimeType(filePath);

  // Check if exists
  const existing = await db.execute({
    sql: "SELECT version, content, modified_by, updated_at FROM files WHERE space_id = ? AND path = ?",
    args: [spaceId, filePath],
  });

  let version = 1;
  if (existing.rows.length > 0) {
    const oldVersion = existing.rows[0].version as number;
    version = oldVersion + 1;

    // Save old version to history
    await db.execute({
      sql: "INSERT INTO file_history (space_id, path, version, content, modified_by, saved_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [spaceId, filePath, oldVersion, existing.rows[0].content, existing.rows[0].modified_by, existing.rows[0].updated_at],
    });

    // Update file
    await db.execute({
      sql: "UPDATE files SET content = ?, mime_type = ?, version = ?, modified_by = ?, size = ?, updated_at = ? WHERE space_id = ? AND path = ?",
      args: [content, mimeType, version, modifiedBy, size, now, spaceId, filePath],
    });
  } else {
    await db.execute({
      sql: "INSERT INTO files (space_id, path, content, mime_type, version, modified_by, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [spaceId, filePath, content, mimeType, version, modifiedBy, size, now, now],
    });
  }

  return {
    id: filePath,
    spaceId,
    path: filePath,
    content,
    mimeType,
    size,
    version,
    modifiedBy,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getFile(spaceId: string, filePath: string): Promise<SpaceFile | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM files WHERE space_id = ? AND path = ?",
    args: [spaceId, filePath],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.path as string,
    spaceId,
    path: row.path as string,
    content: row.content as string,
    mimeType: row.mime_type as string,
    size: row.size as number,
    version: row.version as number,
    modifiedBy: row.modified_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getFileRaw(spaceId: string, filePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const db = getDb();
  // Check blobs table first (binary files)
  const blobResult = await db.execute({
    sql: "SELECT data FROM file_blobs WHERE space_id = ? AND path = ?",
    args: [spaceId, filePath],
  });
  if (blobResult.rows.length > 0) {
    const data = blobResult.rows[0].data;
    const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data as any);
    return { buffer, mimeType: guessMimeType(filePath) };
  }
  // Fallback to text content
  const file = await getFile(spaceId, filePath);
  if (!file) return null;
  return { buffer: Buffer.from(file.content, "utf-8"), mimeType: file.mimeType };
}

export async function deleteFile(spaceId: string, filePath: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "DELETE FROM files WHERE space_id = ? AND path = ?",
    args: [spaceId, filePath],
  });
  await db.execute({ sql: "DELETE FROM file_blobs WHERE space_id = ? AND path = ?", args: [spaceId, filePath] });
  return (result.rowsAffected || 0) > 0;
}

export async function listFiles(spaceId: string): Promise<SpaceFile[]> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM files WHERE space_id = ? ORDER BY path",
    args: [spaceId],
  });
  return result.rows.map((row: any) => ({
    id: row.path as string,
    spaceId,
    path: row.path as string,
    content: "", // Don't load content for listings
    mimeType: row.mime_type as string,
    size: row.size as number,
    version: row.version as number,
    modifiedBy: row.modified_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function getFileHistory(spaceId: string, filePath: string): Promise<Array<{ version: number; modifiedBy: string; savedAt: string; size: number }>> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT version, modified_by, saved_at, length(content) as size FROM file_history WHERE space_id = ? AND path = ? ORDER BY version DESC",
    args: [spaceId, filePath],
  });
  return result.rows.map((row: any) => ({
    version: row.version as number,
    modifiedBy: row.modified_by as string,
    savedAt: row.saved_at as string,
    size: row.size as number,
  }));
}

export async function getFileVersion(spaceId: string, filePath: string, version: number): Promise<{ version: number; content: string; modifiedBy: string; savedAt: string } | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM file_history WHERE space_id = ? AND path = ? AND version = ?",
    args: [spaceId, filePath, version],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    version: row.version as number,
    content: row.content as string,
    modifiedBy: row.modified_by as string,
    savedAt: row.saved_at as string,
  };
}

// ═══════════════════════════════════════
// Search

export async function searchFiles(spaceId: string, query: string): Promise<Array<{ path: string; line: number; content: string }>> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT path, content FROM files WHERE space_id = ? AND content LIKE ?",
    args: [spaceId, `%${query}%`],
  });

  const matches: Array<{ path: string; line: number; content: string }> = [];
  for (const row of result.rows) {
    const lines = (row.content as string).split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query.toLowerCase())) {
        matches.push({ path: row.path as string, line: i + 1, content: lines[i].trim() });
      }
    }
  }
  return matches;
}

// ═══════════════════════════════════════
// Members

export async function getMembers(spaceId: string): Promise<SpaceMember[]> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT * FROM members WHERE space_id = ? ORDER BY added_at",
    args: [spaceId],
  });
  return result.rows.map((row: any) => ({
    name: row.name as string,
    type: row.type as "human" | "agent",
    role: row.role as string | undefined,
    channelUserId: row.channel_user_id as string | undefined,
    capabilities: row.capabilities ? JSON.parse(row.capabilities as string) : undefined,
  }));
}

export async function addMember(spaceId: string, member: Omit<SpaceMember, "addedAt">): Promise<SpaceMember> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO members (space_id, name, type, role, channel_user_id, capabilities, added_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [spaceId, member.name, member.type, member.role || null, member.channelUserId || null, member.capabilities ? JSON.stringify(member.capabilities) : null, now],
  });
  return { ...member } as SpaceMember;
}

export async function removeMember(spaceId: string, memberName: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "DELETE FROM members WHERE space_id = ? AND name = ?",
    args: [spaceId, memberName],
  });
  return (result.rowsAffected || 0) > 0;
}

// ═══════════════════════════════════════
// Annotations

export async function getAnnotations(spaceId: string, filePath?: string, status?: string, assignee?: string): Promise<Annotation[]> {
  const db = getDb();
  let sql = "SELECT * FROM annotations WHERE space_id = ?";
  const args: any[] = [spaceId];

  if (filePath) {
    sql += " AND file_path = ?";
    args.push(filePath);
  }
  if (status && status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  if (assignee) {
    sql += " AND assignee = ?";
    args.push(assignee);
  }
  sql += " ORDER BY created_at DESC";

  const result = await db.execute({ sql, args });
  return result.rows.map(rowToAnnotation);
}

export async function addAnnotation(spaceId: string, ann: { filePath: string; line: number; endLine?: number; content: string; author: string; authorType?: string; assignee?: string }): Promise<Annotation> {
  const db = getDb();
  const id = nanoid(12);
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO annotations (id, space_id, file_path, line, end_line, content, author, author_type, status, assignee, selected_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)",
    args: [id, spaceId, ann.filePath, ann.line || 0, ann.endLine || 0, ann.content, ann.author, ann.authorType || "human", ann.assignee || null, ann.selectedText || null, now, now],
  });
  return {
    id,
    spaceId,
    filePath: ann.filePath,
    line: ann.line || 0,
    endLine: ann.endLine || 0,
    content: ann.content,
    author: ann.author,
    authorType: (ann.authorType || "human") as "human" | "agent",
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateAnnotationAssignee(spaceId: string, annotationId: string, assignee: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: "UPDATE annotations SET assignee = ?, updated_at = ? WHERE id = ? AND space_id = ?",
    args: [assignee, now, annotationId, spaceId],
  });
  return (result.rowsAffected || 0) > 0;
}

export async function completeAnnotation(spaceId: string, annotationId: string, completedBy: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: "UPDATE annotations SET status = 'done', resolved_by = ?, updated_at = ? WHERE id = ? AND space_id = ?",
    args: [completedBy, now, annotationId, spaceId],
  });
  return (result.rowsAffected || 0) > 0;
}

export async function resolveAnnotation(spaceId: string, annotationId: string, resolvedBy: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: "UPDATE annotations SET status = 'resolved', resolved_by = ?, updated_at = ? WHERE id = ? AND space_id = ?",
    args: [resolvedBy, now, annotationId, spaceId],
  });
  return (result.rowsAffected || 0) > 0;
}

export async function deleteAnnotation(spaceId: string, annotationId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "DELETE FROM annotations WHERE id = ? AND space_id = ?",
    args: [annotationId, spaceId],
  });
  return (result.rowsAffected || 0) > 0;
}

function rowToAnnotation(row: any): Annotation {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    filePath: row.file_path as string,
    line: row.line as number,
    endLine: row.end_line as number,
    content: row.content as string,
    author: row.author as string,
    authorType: row.author_type as "human" | "agent",
    status: row.status as "open" | "done" | "resolved",
    resolvedBy: row.resolved_by as string | undefined,
    assignee: row.assignee as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ═══════════════════════════════════════
// Notifications

export async function addNotification(spaceId: string, notif: { type: string; channel?: string; target?: string; message: string; createdBy: string }): Promise<void> {
  const db = getDb();
  const id = nanoid(12);
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO notifications (id, space_id, type, channel, target, message, created_by, sent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    args: [id, spaceId, notif.type, notif.channel || null, notif.target || null, notif.message, notif.createdBy, now],
  });
}

export async function getNotifications(spaceId: string, onlyUnsent = true): Promise<any[]> {
  const db = getDb();
  let sql = "SELECT * FROM notifications WHERE space_id = ?";
  if (onlyUnsent) sql += " AND sent = 0";
  sql += " ORDER BY created_at DESC LIMIT 50";
  const result = await db.execute({ sql, args: [spaceId] });
  return result.rows.map((row: any) => ({
    id: row.id,
    type: row.type,
    channel: row.channel,
    target: row.target,
    message: row.message,
    createdBy: row.created_by,
    sent: !!row.sent,
    createdAt: row.created_at,
  }));
}

export async function markNotificationSent(spaceId: string, notifId: string): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "UPDATE notifications SET sent = 1 WHERE id = ? AND space_id = ?",
    args: [notifId, spaceId],
  });
}

/** Alias for getNotifications(spaceId, true) */
export async function getPendingNotifications(spaceId: string): Promise<any[]> {
  return getNotifications(spaceId, true);
}

/** List all spaces */
export async function listSpaces(): Promise<Space[]> {
  const db = getDb();
  const result = await db.execute("SELECT * FROM spaces ORDER BY created_at DESC");
  return result.rows.map(rowToSpace);
}

// ═══════════════════════════════════════
// Templates

function getTemplateFiles(template: string, spaceName: string, creator: string): Record<string, string> {
  const now = new Date().toISOString().split("T")[0];

  if (template === "software-dev") {
    return {
      "SPACE.md": `# ${spaceName}\n\n创建于: ${now}\n创建者: ${creator}\n类型: 软件开发\n\n## 简介\n\n这是一个软件开发协作空间。`,
      "TEAM.md": `# 团队\n\n## 成员\n\n- ${creator} (创建者)\n\n## 角色分工\n\n待分配`,
      "TASK.md": `# 任务看板\n\n## [ready] 初始化项目\n\n- 确定技术栈\n- 搭建开发环境`,
    };
  }
  if (template === "content") {
    return {
      "SPACE.md": `# ${spaceName}\n\n创建于: ${now}\n创建者: ${creator}\n类型: 内容创作`,
      "TEAM.md": `# 团队\n\n- ${creator} (创建者)`,
      "TASK.md": `# 任务看板\n\n## [ready] 制定内容计划`,
    };
  }
  if (template === "research") {
    return {
      "SPACE.md": `# ${spaceName}\n\n创建于: ${now}\n创建者: ${creator}\n类型: 研究项目`,
      "TEAM.md": `# 团队\n\n- ${creator} (创建者)`,
      "TASK.md": `# 任务看板\n\n## [ready] 确定研究方向`,
    };
  }
  return {};
}

// ═══════════════════════════════════════
// MIME Types

function guessMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    md: "text/markdown",
    txt: "text/plain",
    json: "application/json",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "application/typescript",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] || "application/octet-stream";
}

// ═══════════════════════════════════════
// Users & Auth

export interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  avatar?: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
}

export async function createUser(username: string, displayName: string, passwordHash: string): Promise<User> {
  const db = getDb();
  const id = nanoid(12);
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO users (id, username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)",
    args: [id, username, displayName, passwordHash, now],
  });
  return { id, username, displayName, passwordHash, role: "user", createdAt: now };
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] });
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function updateUserLogin(userId: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "UPDATE users SET last_login_at = ? WHERE id = ?", args: [new Date().toISOString(), userId] });
}

export async function getUserCount(): Promise<number> {
  const db = getDb();
  const result = await db.execute("SELECT COUNT(*) as count FROM users");
  return (result.rows[0].count as number) || 0;
}

function rowToUser(row: any): User {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    passwordHash: row.password_hash as string,
    avatar: row.avatar as string | undefined,
    role: row.role as string,
    createdAt: row.created_at as string,
    lastLoginAt: row.last_login_at as string | undefined,
  };
}

// ── Session tokens ──

export async function createSession(userId: string, expiresInDays = 30): Promise<string> {
  const db = getDb();
  const token = nanoid(32);
  const now = new Date();
  const expires = new Date(now.getTime() + expiresInDays * 86400000);
  await db.execute({
    sql: "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    args: [token, userId, now.toISOString(), expires.toISOString()],
  });
  return token;
}

export async function getSessionUser(token: string): Promise<User | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT user_id, expires_at FROM sessions WHERE token = ?",
    args: [token],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (new Date(row.expires_at as string) < new Date()) {
    await db.execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
    return null;
  }
  return getUserById(row.user_id as string);
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
}

export async function cleanExpiredSessions(): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM sessions WHERE expires_at < ?", args: [new Date().toISOString()] });
}

// ═══════════════════════════════════════
// User ↔ Space relationships

export async function addUserSpace(userId: string, spaceId: string, role = "member"): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "INSERT OR IGNORE INTO user_spaces (user_id, space_id, role, joined_at) VALUES (?, ?, ?, ?)",
    args: [userId, spaceId, role, new Date().toISOString()],
  });
}

export async function removeUserSpace(userId: string, spaceId: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM user_spaces WHERE user_id = ? AND space_id = ?", args: [userId, spaceId] });
}

export async function getUserSpaces(userId: string): Promise<any[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT s.id, s.name, s.channel, s.group_id, s.created_at, s.updated_at,
                 us.role as user_role, us.joined_at as user_joined_at
          FROM user_spaces us
          JOIN spaces s ON s.id = us.space_id
          WHERE us.user_id = ?
          ORDER BY us.joined_at DESC`,
    args: [userId],
  });
  return result.rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    channel: r.channel as string,
    groupId: r.group_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    userRole: r.user_role as string,
    userJoinedAt: r.user_joined_at as string,
  }));
}

export async function isUserInSpace(userId: string, spaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM user_spaces WHERE user_id = ? AND space_id = ?",
    args: [userId, spaceId],
  });
  return result.rows.length > 0;
}

// ═══════════════════════════════════════
// Bot Registry

export interface Bot {
  id: string;
  name: string;
  channel: string;
  apiUrl: string;
  encryptedToken: string;
  registeredAt: string;
  updatedAt: string;
}

export async function registerBot(id: string, name: string, channel: string, apiUrl: string, token: string): Promise<Bot> {
  const db = getDb();
  const now = new Date().toISOString();
  // Simple base64 obfuscation for token (not true encryption, but better than plaintext)
  const encryptedToken = Buffer.from(token).toString("base64");
  await db.execute({
    sql: `INSERT INTO bots (id, name, channel, api_url, encrypted_token, registered_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=?, api_url=?, encrypted_token=?, updated_at=?`,
    args: [id, name, channel, apiUrl, encryptedToken, now, now, name, apiUrl, encryptedToken, now],
  });
  return { id, name, channel, apiUrl, encryptedToken, registeredAt: now, updatedAt: now };
}

export async function listBots(channel?: string): Promise<Array<{ id: string; name: string; channel: string }>> {
  const db = getDb();
  let sql = "SELECT id, name, channel FROM bots";
  const args: any[] = [];
  if (channel) { sql += " WHERE channel = ?"; args.push(channel); }
  sql += " ORDER BY name";
  const result = await db.execute({ sql, args });
  return result.rows.map((r: any) => ({ id: r.id as string, name: r.name as string, channel: r.channel as string }));
}

export async function getBot(botId: string): Promise<Bot | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT * FROM bots WHERE id = ?", args: [botId] });
  if (result.rows.length === 0) return null;
  const r = result.rows[0] as any;
  return { id: r.id, name: r.name, channel: r.channel, apiUrl: r.api_url, encryptedToken: r.encrypted_token, registeredAt: r.registered_at, updatedAt: r.updated_at };
}

export async function getBotToken(botId: string): Promise<string | null> {
  const bot = await getBot(botId);
  if (!bot) return null;
  return Buffer.from(bot.encryptedToken, "base64").toString("utf-8");
}

export async function setSpaceNotifyBot(spaceId: string, botId: string): Promise<void> {
  const db = getDb();
  await db.execute({ sql: "UPDATE spaces SET notify_bot_id = ? WHERE id = ?", args: [botId, spaceId] });
}

export async function getSpaceNotifyBot(spaceId: string): Promise<string | null> {
  const db = getDb();
  const result = await db.execute({ sql: "SELECT notify_bot_id FROM spaces WHERE id = ?", args: [spaceId] });
  if (result.rows.length === 0) return null;
  return (result.rows[0] as any).notify_bot_id || null;
}
