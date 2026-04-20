/**
 * Context Server — File-based Storage Engine
 *
 * Stores spaces and files on local filesystem.
 * Simple, inspectable, git-friendly.
 */

import fs from "fs-extra";
import path from "path";
import { nanoid } from "nanoid";
import type { Space, SpaceMember, SpaceFile, CreateSpaceRequest, SpaceLookupQuery, Annotation } from "../types.js";

const DATA_DIR = process.env.CONTEXT_DATA_DIR || path.join(process.cwd(), "data");

/** Ensure data directories exist */
async function ensureDataDir(): Promise<void> {
  await fs.ensureDir(DATA_DIR);
  await fs.ensureDir(path.join(DATA_DIR, "spaces"));
}

/** Get space directory path */
function spaceDir(spaceId: string): string {
  return path.join(DATA_DIR, "spaces", spaceId);
}

/** Load space metadata */
export async function getSpace(spaceId: string): Promise<Space | null> {
  const metaPath = path.join(spaceDir(spaceId), "meta.json");
  if (!(await fs.pathExists(metaPath))) return null;
  return fs.readJson(metaPath);
}

/** Find space by channel + groupId */
export async function findSpace(query: SpaceLookupQuery): Promise<Space | null> {
  const indexPath = path.join(DATA_DIR, "index.json");
  if (!(await fs.pathExists(indexPath))) return null;
  const index: Record<string, string> = await fs.readJson(indexPath);
  const key = `${query.channel}:${query.groupId}`;
  const spaceId = index[key];
  if (!spaceId) return null;
  return getSpace(spaceId);
}

/** Create a new space */
export async function createSpace(req: CreateSpaceRequest): Promise<Space> {
  await ensureDataDir();

  const id = nanoid(12);
  const now = new Date().toISOString();

  const space: Space = {
    id,
    name: req.name,
    channel: req.channel,
    groupId: req.groupId,
    channelId: req.channelId,
    createdBy: req.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // Create space directory
  const dir = spaceDir(id);
  await fs.ensureDir(dir);
  await fs.ensureDir(path.join(dir, "files"));

  // Write metadata
  await fs.writeJson(path.join(dir, "meta.json"), space, { spaces: 2 });

  // Write to index
  const indexPath = path.join(DATA_DIR, "index.json");
  const index: Record<string, string> = (await fs.pathExists(indexPath))
    ? await fs.readJson(indexPath)
    : {};
  index[`${req.channel}:${req.groupId}`] = id;
  await fs.writeJson(indexPath, index, { spaces: 2 });

  // Initialize members list
  await fs.writeJson(path.join(dir, "members.json"), [], { spaces: 2 });

  return space;
}

/** List all spaces */
export async function listSpaces(): Promise<Space[]> {
  await ensureDataDir();
  const spacesDir = path.join(DATA_DIR, "spaces");
  if (!(await fs.pathExists(spacesDir))) return [];
  const dirs = await fs.readdir(spacesDir);
  const spaces: Space[] = [];
  for (const d of dirs) {
    const space = await getSpace(d);
    if (space) spaces.push(space);
  }
  return spaces;
}

// ═══════════════════════════════════════
// Members
// ═══════════════════════════════════════

/** Get members of a space */
export async function getMembers(spaceId: string): Promise<SpaceMember[]> {
  const membersPath = path.join(spaceDir(spaceId), "members.json");
  if (!(await fs.pathExists(membersPath))) return [];
  return fs.readJson(membersPath);
}

/** Add a member to a space */
export async function addMember(spaceId: string, member: Omit<SpaceMember, "id" | "spaceId" | "joinedAt">): Promise<SpaceMember> {
  const members = await getMembers(spaceId);
  const newMember: SpaceMember = {
    id: nanoid(8),
    spaceId,
    ...member,
    joinedAt: new Date().toISOString(),
  };
  members.push(newMember);
  await fs.writeJson(path.join(spaceDir(spaceId), "members.json"), members, { spaces: 2 });
  return newMember;
}

/** Remove a member */
export async function removeMember(spaceId: string, memberId: string): Promise<boolean> {
  const members = await getMembers(spaceId);
  const filtered = members.filter(m => m.id !== memberId);
  if (filtered.length === members.length) return false;
  await fs.writeJson(path.join(spaceDir(spaceId), "members.json"), filtered, { spaces: 2 });
  return true;
}

// ═══════════════════════════════════════
// Files
// ═══════════════════════════════════════

/** Get a file by path */
export async function getFile(spaceId: string, filePath: string): Promise<SpaceFile | null> {
  const dir = path.join(spaceDir(spaceId), "files");
  const metaDir = path.join(spaceDir(spaceId), "file-meta");

  // Check if file exists
  const fullPath = path.join(dir, filePath);
  if (!(await fs.pathExists(fullPath))) return null;

  // Read content
  const content = await fs.readFile(fullPath, "utf-8");
  const stat = await fs.stat(fullPath);

  // Read metadata if exists
  const metaPath = path.join(metaDir, filePath + ".json");
  let meta: any = {};
  if (await fs.pathExists(metaPath)) {
    meta = await fs.readJson(metaPath);
  }

  return {
    id: meta.id || filePath,
    spaceId,
    path: filePath,
    content,
    mimeType: meta.mimeType || "text/plain",
    size: stat.size,
    version: meta.version || 1,
    modifiedBy: meta.modifiedBy || "unknown",
    createdAt: meta.createdAt || stat.birthtime.toISOString(),
    updatedAt: meta.updatedAt || stat.mtime.toISOString(),
  };
}

/** Write a file */
export async function writeFile(
  spaceId: string,
  filePath: string,
  content: string,
  modifiedBy: string
): Promise<SpaceFile> {
  const dir = path.join(spaceDir(spaceId), "files");
  const metaDir = path.join(spaceDir(spaceId), "file-meta");

  const fullPath = path.join(dir, filePath);
  await fs.ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content, "utf-8");

  // Update metadata
  await fs.ensureDir(path.dirname(path.join(metaDir, filePath + ".json")));
  const metaPath = path.join(metaDir, filePath + ".json");
  let meta: any = {};
  if (await fs.pathExists(metaPath)) {
    meta = await fs.readJson(metaPath);
  }

  const now = new Date().toISOString();
  meta = {
    ...meta,
    id: meta.id || nanoid(8),
    version: (meta.version || 0) + 1,
    modifiedBy,
    mimeType: meta.mimeType || guessMimeType(filePath),
    createdAt: meta.createdAt || now,
    updatedAt: now,
  };
  await fs.writeJson(metaPath, meta, { spaces: 2 });

  const stat = await fs.stat(fullPath);
  return {
    id: meta.id,
    spaceId,
    path: filePath,
    content,
    mimeType: meta.mimeType,
    size: stat.size,
    version: meta.version,
    modifiedBy,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

/** List files in a space */
export async function listFiles(spaceId: string, prefix?: string): Promise<Omit<SpaceFile, "content">[]> {
  const dir = path.join(spaceDir(spaceId), "files");
  if (!(await fs.pathExists(dir))) return [];

  const results: Omit<SpaceFile, "content">[] = [];

  async function walk(currentDir: string, relativePath: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(currentDir, entry.name), rel);
      } else {
        if (prefix && !rel.startsWith(prefix)) continue;
        const stat = await fs.stat(path.join(currentDir, entry.name));
        const metaPath = path.join(spaceDir(spaceId), "file-meta", rel + ".json");
        let meta: any = {};
        if (await fs.pathExists(metaPath)) {
          meta = await fs.readJson(metaPath);
        }
        results.push({
          id: meta.id || rel,
          spaceId,
          path: rel,
          mimeType: meta.mimeType || guessMimeType(rel),
          size: stat.size,
          version: meta.version || 1,
          modifiedBy: meta.modifiedBy || "unknown",
          createdAt: meta.createdAt || stat.birthtime.toISOString(),
          updatedAt: meta.updatedAt || stat.mtime.toISOString(),
        });
      }
    }
  }

  await walk(dir, "");
  return results;
}

/** Delete a file */
export async function deleteFile(spaceId: string, filePath: string): Promise<boolean> {
  const fullPath = path.join(spaceDir(spaceId), "files", filePath);
  if (!(await fs.pathExists(fullPath))) return false;
  await fs.remove(fullPath);
  // Also remove metadata
  const metaPath = path.join(spaceDir(spaceId), "file-meta", filePath + ".json");
  if (await fs.pathExists(metaPath)) await fs.remove(metaPath);
  return true;
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".json": "application/json",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".ts": "application/typescript",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return map[ext] || "application/octet-stream";
}

// ═══════════════════════════════════════
// Annotations
// ═══════════════════════════════════════

function annotationsPath(spaceId: string): string {
  return path.join(spaceDir(spaceId), "annotations.json");
}

/** Get all annotations for a space */
export async function getAnnotations(spaceId: string, filePath?: string, status?: string): Promise<Annotation[]> {
  const p = annotationsPath(spaceId);
  if (!(await fs.pathExists(p))) return [];
  const all: Annotation[] = await fs.readJson(p);
  let result = all;
  if (filePath) result = result.filter(a => a.filePath === filePath);
  if (status) result = result.filter(a => a.status === status);
  return result;
}

/** Add an annotation */
export async function addAnnotation(spaceId: string, ann: {
  filePath: string;
  line: number;
  endLine?: number;
  content: string;
  author: string;
  authorType: "human" | "agent";
}): Promise<Annotation> {
  const p = annotationsPath(spaceId);
  const all: Annotation[] = (await fs.pathExists(p)) ? await fs.readJson(p) : [];
  const now = new Date().toISOString();
  const newAnn: Annotation = {
    id: nanoid(8),
    spaceId,
    filePath: ann.filePath,
    line: ann.line || 0,
    endLine: ann.endLine || 0,
    content: ann.content,
    author: ann.author,
    authorType: ann.authorType,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  all.push(newAnn);
  await fs.writeJson(p, all, { spaces: 2 });
  return newAnn;
}

/** Resolve an annotation */
export async function resolveAnnotation(spaceId: string, annotationId: string, resolvedBy: string): Promise<Annotation | null> {
  const p = annotationsPath(spaceId);
  if (!(await fs.pathExists(p))) return null;
  const all: Annotation[] = await fs.readJson(p);
  const ann = all.find(a => a.id === annotationId);
  if (!ann) return null;
  ann.status = "resolved";
  ann.resolvedBy = resolvedBy;
  ann.resolvedAt = new Date().toISOString();
  ann.updatedAt = ann.resolvedAt;
  await fs.writeJson(p, all, { spaces: 2 });
  return ann;
}

/** Delete an annotation */
export async function deleteAnnotation(spaceId: string, annotationId: string): Promise<boolean> {
  const p = annotationsPath(spaceId);
  if (!(await fs.pathExists(p))) return false;
  const all: Annotation[] = await fs.readJson(p);
  const filtered = all.filter(a => a.id !== annotationId);
  if (filtered.length === all.length) return false;
  await fs.writeJson(p, filtered, { spaces: 2 });
  return true;
}
