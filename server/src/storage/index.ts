/**
 * Context Server — Storage Index
 *
 * Re-exports database storage (libSQL/Turso).
 * Environment:
 *   TURSO_DATABASE_URL - database URL (default: file:./data/context.db)
 *   TURSO_AUTH_TOKEN   - auth token for Turso cloud
 */

export {
  createSpace,
  getSpace,
  findSpace,
  updateSpace,
  deleteSpace,
  writeFile,
  getFile,
  getFileRaw,
  deleteFile,
  listFiles,
  getFileHistory,
  getFileVersion,
  searchFiles,
  getMembers,
  addMember,
  removeMember,
  getAnnotations,
  addAnnotation,
  resolveAnnotation,
  deleteAnnotation,
  addNotification,
  getNotifications,
  getPendingNotifications,
  markNotificationSent,
  listSpaces,
} from "./db-storage.js";
