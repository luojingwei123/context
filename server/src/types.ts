/**
 * Context Server — Types
 */

/** A collaboration space */
export interface Space {
  id: string;
  name: string;
  /** Channel type: discord, dmwork, telegram, slack, etc. */
  channel: string;
  /** Channel-specific group/guild ID */
  groupId: string;
  /** Optional channel ID within a guild (e.g., Discord channel) */
  channelId?: string;
  /** Creator identifier */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Webhook URL for sending notifications to the group chat */
  webhookUrl?: string;
}

/** A member of a space */
export interface SpaceMember {
  id: string;
  spaceId: string;
  /** Display name */
  name: string;
  /** Role: human or agent */
  type: "human" | "agent";
  /** Role in the project */
  role?: string;
  /** What tools/skills this member has */
  capabilities?: string[];
  /** Channel-specific user ID */
  channelUserId?: string;
  joinedAt: string;
}

/** A file in the space */
export interface SpaceFile {
  id: string;
  spaceId: string;
  /** Relative path within space (e.g., "SPACE.md", "docs/prd.md") */
  path: string;
  /** File content */
  content: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Version number */
  version: number;
  /** Who last modified */
  modifiedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Protocol file types — the core three */
export type ProtocolFileName = "SPACE.md" | "TEAM.md" | "TASK.md";

/** Space creation request */
export interface CreateSpaceRequest {
  name: string;
  channel: string;
  groupId: string;
  channelId?: string;
  createdBy: string;
  /** Project type for template selection */
  template?: "software-dev" | "content" | "research" | "blank";
}

/** Space lookup by channel group */
export interface SpaceLookupQuery {
  channel: string;
  groupId: string;
  channelId?: string;
}

/** An annotation/comment on a file */
export interface Annotation {
  id: string;
  spaceId: string;
  /** File path this annotation belongs to */
  filePath: string;
  /** Line number (1-based, 0 = whole file) */
  line: number;
  /** End line for range selection (0 = single line) */
  endLine: number;
  /** Comment content */
  content: string;
  /** Who created the annotation */
  author: string;
  /** Author type */
  authorType: "human" | "agent";
  /** Status: open = needs attention, done = bot completed (pending human review), resolved = human archived */
  status: "open" | "done" | "resolved";
  /** Who resolved it */
  resolvedBy?: string;
  resolvedAt?: string;
  /** Who is assigned to handle this */
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}
