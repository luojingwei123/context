/**
 * Context Server — File Renderers
 *
 * Built-in renderers for common file types.
 * Extensible: add new renderers by registering mime type → render function.
 */

export type RenderResult = { html: string; css?: string };
export type RendererFn = (content: string, filePath: string) => RenderResult;

const registry: Map<string, RendererFn> = new Map();

/** Register a renderer for a mime type pattern */
export function registerRenderer(mimePattern: string, fn: RendererFn) {
  registry.set(mimePattern, fn);
}

/** Get renderer for a file */
export function getRenderer(mimeType: string): RendererFn | null {
  // Exact match first
  if (registry.has(mimeType)) return registry.get(mimeType)!;
  // Prefix match (e.g., "image/" matches all images)
  for (const [pattern, fn] of registry) {
    if (pattern.endsWith("/*") && mimeType.startsWith(pattern.slice(0, -1))) return fn;
  }
  return null;
}

/** List registered renderers */
export function listRenderers(): string[] {
  return Array.from(registry.keys());
}

// ════════════════════════════════════════
// Built-in Renderers
// ════════════════════════════════════════

// JSON renderer with syntax highlighting and collapsible sections
registerRenderer("application/json", (content: string) => {
  try {
    const obj = JSON.parse(content);
    const formatted = JSON.stringify(obj, null, 2);
    const lines = formatted.split("\n");
    const highlighted = lines.map(line => {
      return line
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/: "([^"]*?)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/: (true|false|null)/g, ': <span class="json-bool">$1</span>')
        .replace(/: (\d+\.?\d*)/g, ': <span class="json-number">$1</span>');
    }).join("\n");
    return {
      html: `<pre class="json-view"><code>${highlighted}</code></pre>`,
      css: `.json-key{color:#0550ae;font-weight:500;}.json-string{color:#0a3069;}.json-bool{color:#cf222e;}.json-number{color:#0550ae;}.json-view{background:#f6f8fa;padding:16px;border-radius:6px;overflow-x:auto;font-size:13px;line-height:1.5;}`,
    };
  } catch {
    return { html: `<pre>${content.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>` };
  }
});

// Image renderer
registerRenderer("image/*", (_content: string, filePath: string) => {
  return {
    html: `<div style="text-align:center;padding:20px;"><img src="/ctx/SPACE_ID/${filePath}" style="max-width:100%;border:1px solid #d1d9e0;border-radius:6px;" alt="${filePath}"><p style="color:#656d76;margin-top:8px;">${filePath}</p></div>`,
  };
});

// HTML renderer (sandboxed iframe)
registerRenderer("text/html", (content: string) => {
  const encoded = Buffer.from(content).toString("base64");
  return {
    html: `<div style="border:1px solid #d1d9e0;border-radius:6px;overflow:hidden;"><iframe srcdoc="${content.replace(/"/g, '&quot;')}" style="width:100%;height:500px;border:none;" sandbox="allow-scripts"></iframe></div>`,
  };
});

// CSS renderer with syntax highlighting
registerRenderer("text/css", (content: string) => {
  const escaped = content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const highlighted = escaped
    .replace(/([.#\w-]+)\s*\{/g, '<span style="color:#6639ba;">$1</span> {')
    .replace(/([\w-]+)\s*:/g, '<span style="color:#0550ae;">$1</span>:');
  return { html: `<pre style="background:#f6f8fa;padding:16px;border-radius:6px;"><code>${highlighted}</code></pre>` };
});
