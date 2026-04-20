/**
 * Context Server — Right-Click Menu Registry
 *
 * Third parties can register custom context menu items.
 * Menu items define: when to show (file type filter), label, icon, and action URL.
 */

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  /** File extensions this menu applies to (e.g., [".md", ".txt"]) or ["*"] for all */
  fileTypes: string[];
  /** Action type: "url" opens a URL, "api" calls an API endpoint */
  actionType: "url" | "api";
  /** URL template with {spaceId}, {filePath}, {line}, {selectedText} placeholders */
  actionUrl: string;
  /** Who registered this menu item */
  registeredBy: string;
  createdAt: string;
}

const menuItems: MenuItem[] = [];

// Built-in items (always present)
const BUILTIN_ITEMS: MenuItem[] = [
  { id: "copy-ref", label: "📋 拷贝引用 URL", icon: "📋", fileTypes: ["*"], actionType: "url", actionUrl: "", registeredBy: "system", createdAt: "" },
  { id: "add-annotation", label: "💬 添加批注", icon: "💬", fileTypes: ["*"], actionType: "url", actionUrl: "", registeredBy: "system", createdAt: "" },
  { id: "create-task", label: "📌 创建任务", icon: "📌", fileTypes: ["*"], actionType: "url", actionUrl: "", registeredBy: "system", createdAt: "" },
  { id: "copy-text", label: "📄 拷贝文本", icon: "📄", fileTypes: ["*"], actionType: "url", actionUrl: "", registeredBy: "system", createdAt: "" },
];

/** Register a custom menu item */
export function registerMenuItem(item: Omit<MenuItem, "createdAt">): MenuItem {
  const newItem: MenuItem = { ...item, createdAt: new Date().toISOString() };
  // Remove existing with same id
  const idx = menuItems.findIndex(m => m.id === item.id);
  if (idx >= 0) menuItems[idx] = newItem;
  else menuItems.push(newItem);
  return newItem;
}

/** Remove a custom menu item */
export function removeMenuItem(id: string): boolean {
  const idx = menuItems.findIndex(m => m.id === id);
  if (idx < 0) return false;
  menuItems.splice(idx, 1);
  return true;
}

/** Get all menu items for a file type */
export function getMenuItems(fileExt: string): MenuItem[] {
  const all = [...BUILTIN_ITEMS, ...menuItems];
  return all.filter(m => m.fileTypes.includes("*") || m.fileTypes.includes(fileExt));
}

/** List all registered custom menu items */
export function listCustomMenuItems(): MenuItem[] {
  return [...menuItems];
}
