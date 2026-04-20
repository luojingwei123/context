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

export default router;
