/**
 * Context Server — CSS Styles
 * Based on DeepMiner 3.0 Design System
 *
 * Brand: 紫蓝 #6366F1（极克制 <5%）
 * 浅灰底 + 深色导航 + 白卡片 三层色彩体系
 * 字体: Inter + PingFang SC · 不做暗色模式
 */

export const CSS = `
  :root {
    /* ── Brand 紫蓝（极克制，仅 CTA / 激活态 / Logo） ── */
    --brand: #6366F1;
    --brand-hover: #5558E6;
    --brand-light: #EEF2FF;
    --brand-lighter: #E0E7FF;
    --primary: var(--brand);
    --primary-hover: var(--brand-hover);
    --primary-light: var(--brand-light);
    /* ── 背景层级 ── */
    --bg: #F5F5F7;
    --surface: #FFFFFF;
    --elevated: #F0F0F2;
    --bg-hover: #E8E8EB;
    --bg-card: #FFFFFF;
    --bg-code: #F0F0F2;
    /* ── 侧边栏 / 导航 ── */
    --sidebar-bg: #1E1E2E;
    --sidebar-text: #9CA3AF;
    --sidebar-active: rgba(99,102,241,.15);
    /* ── 文字层级 ── */
    --ink: #1F2937;
    --ink-2: #374151;
    --ink-3: #6B7280;
    --ink-4: #9CA3AF;
    --text: var(--ink);
    --text-secondary: var(--ink-2);
    --text-muted: var(--ink-4);
    /* ── 语义色 ── */
    --success: #10B981;
    --success-light: rgba(16,185,129,.1);
    --warning: #F59E0B;
    --warning-light: rgba(245,158,11,.1);
    --danger: #EF4444;
    --danger-light: rgba(239,68,68,.1);
    /* ── 边框 ── */
    --border: #E5E7EB;
    --border-strong: #D1D5DB;
    /* ── 阴影（DM3 四级阴影） ── */
    --shadow-rest: 0 1px 3px rgba(0,0,0,0.04);
    --shadow-hover: 0 4px 16px rgba(0,0,0,0.06);
    --shadow-float: 0 8px 24px rgba(0,0,0,0.09);
    --shadow-overlay: 0 16px 48px rgba(0,0,0,0.12);
    --shadow: var(--shadow-rest);
    --shadow-md: var(--shadow-hover);
    --shadow-lg: var(--shadow-float);
    /* ── 圆角（4px 基准网格） ── */
    --r-xs: 4px;
    --r-sm: 8px;
    --r: 12px;
    --r-lg: 16px;
    --r-xl: 20px;
    --radius: var(--r);
    --radius-lg: var(--r-lg);
    --radius-xl: var(--r-xl);
    /* ── 间距（4px 基准） ── */
    --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
    --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-12: 48px;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: "Inter", "PingFang SC", -apple-system, system-ui, "Helvetica Neue", sans-serif;
    margin: 0; padding: 0; line-height: 1.5; color: var(--text); background: var(--bg);
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    font-variant-numeric: tabular-nums;
  }
  .container { max-width: 980px; margin: 0 auto; padding: var(--sp-8) var(--sp-6); }

  /* ── Card（白底 + 1px #E5E7EB 边框 + 淡阴影，hover 升浮） ── */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: var(--sp-5); margin-bottom: var(--sp-5); box-shadow: var(--shadow-rest); transition: box-shadow .3s, transform .3s; }
  .card:hover { box-shadow: var(--shadow-hover); transform: translateY(-1px); }
  .card.glass { background: var(--surface); }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-4); padding-bottom: var(--sp-3); border-bottom: 1px solid var(--border); }
  .card-header h2 { margin: 0; font-size: 16px; font-weight: 600; }

  /* ── Typography（Inter SemiBold/Regular） ── */
  h1 { font-size: 28px; font-weight: 700; margin: 0 0 var(--sp-2); color: var(--ink); }
  h2 { font-size: 20px; font-weight: 600; color: var(--ink); margin-top: var(--sp-6); }
  h3 { font-size: 16px; font-weight: 600; color: var(--ink); }
  a { color: var(--brand); text-decoration: none; transition: color .2s; }
  a:hover { color: var(--brand-hover); }
  hr { border: none; border-top: 1px solid var(--border); margin: var(--sp-5) 0; }
  blockquote { border-left: 3px solid var(--brand); padding: var(--sp-3) var(--sp-4); margin: var(--sp-3) 0; background: var(--brand-light); border-radius: 0 var(--r) var(--r) 0; color: var(--ink-2); font-size: 14px; }
  pre { background: var(--elevated); padding: var(--sp-4); border-radius: var(--r); overflow-x: auto; border: 1px solid var(--border); font-size: 13px; line-height: 1.6; }
  code { background: var(--elevated); padding: 2px 7px; border-radius: var(--r-xs); font-size: .85em; font-family: "SF Mono", "Fira Code", Menlo, monospace; }
  pre code { background: none; padding: 0; }

  /* ── Form Controls（DM3: 40px 高，12px 圆角，focus 品牌色框 + 光晕） ── */
  input[type="text"], input[type="number"], input[type="email"], input[type="url"], input[type="search"], input[type="password"],
  input:not([type]), textarea, select {
    font-family: inherit; font-size: 14px; line-height: 1.5;
    height: 40px; padding: 0 var(--sp-3); border: 1px solid var(--border); border-radius: var(--r);
    background: var(--surface); color: var(--ink); transition: all .2s;
    outline: none; width: 100%;
  }
  textarea { height: auto; padding: var(--sp-3); resize: vertical; min-height: 80px; }
  input:focus, textarea:focus, select:focus {
    border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-light);
  }
  input::placeholder, textarea::placeholder { color: var(--ink-4); }
  select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M2 4l4 4 4-4'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right var(--sp-3) center; padding-right: 34px; }
  label { font-size: 12px; font-weight: 500; color: var(--ink-3); display: block; margin-bottom: 6px; }
  .form-grid { display: flex; flex-direction: column; gap: var(--sp-4); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  .form-group { display: flex; flex-direction: column; }
  .form-group input, .form-group select, .form-group textarea { margin-top: 0; }

  /* ── Tables（DM3: 12px Medium 表头，13px 内容，~48px 行高） ── */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: var(--sp-3) var(--sp-4); text-align: left; border-bottom: 1px solid var(--border); }
  th { font-weight: 500; font-size: 12px; color: var(--ink-3); }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .15s; height: 48px; }
  tbody tr:hover { background: var(--elevated); }
  .table-wrap { border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; background: var(--surface); }

  /* ── Breadcrumb ── */
  .breadcrumb { color: var(--ink-4); margin-bottom: var(--sp-5); font-size: 13px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--ink-3); font-weight: 500; }
  .breadcrumb a:hover { color: var(--brand); }
  .breadcrumb span { color: var(--ink-4); font-size: 10px; }

  /* ── Meta ── */
  .meta { background: var(--elevated); padding: var(--sp-3) var(--sp-4); border-radius: var(--r); margin: var(--sp-3) 0; border: 1px solid var(--border); font-size: 13px; color: var(--ink-3); line-height: 1.9; }
  .meta b { color: var(--ink); font-weight: 600; }

  /* ── Badge（DM3: pill 胶囊） ── */
  .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-agent { background: var(--brand-light); color: var(--brand); }
  .badge-human { background: var(--success-light); color: var(--success); }
  .badge-creator { background: var(--warning-light); color: var(--warning); }
  .badge-channel { background: var(--elevated); color: var(--ink-3); border: 1px solid var(--border); }

  /* ── Button（DM3: 8px 圆角，hover 上浮 0.5px + 阴影加深） ── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; border-radius: var(--r-sm); font-size: 14px; font-weight: 500; border: 1px solid var(--border); background: var(--surface); color: var(--ink); cursor: pointer; text-decoration: none; transition: all .2s; line-height: 1.2; }
  .btn:hover { box-shadow: var(--shadow-hover); transform: translateY(-0.5px); text-decoration: none; color: var(--ink); }
  .btn:active { transform: translateY(0); box-shadow: none; }
  .btn-primary { background: var(--brand); color: #fff; border-color: var(--brand); }
  .btn-primary:hover { background: var(--brand-hover); border-color: var(--brand-hover); color: #fff; }
  .btn-success { background: var(--success); color: #fff; border-color: var(--success); }
  .btn-danger { background: var(--surface); color: var(--danger); border-color: var(--danger); }
  .btn-danger:hover { background: var(--danger); color: #fff; }
  .btn-ghost { background: transparent; border-color: transparent; color: var(--ink-3); }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--ink); }
  .btn-text { background: none; border: none; color: var(--brand); padding: 0; font-weight: 500; }
  .btn-text:hover { color: var(--brand-hover); box-shadow: none; transform: none; }
  .btn-small { padding: 4px 12px; font-size: 12px; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface); cursor: pointer; transition: all .2s; color: var(--ink); font-family: inherit; font-weight: 500; }
  .btn-small:hover { background: var(--bg-hover); border-color: var(--border-strong); }
  .btn-group { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

  /* ── File Grid（卡片 12px 圆角，hover 升浮 + 阴影） ── */
  .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--sp-3); margin: var(--sp-4) 0; }
  .file-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); transition: all .25s; text-decoration: none; color: var(--ink); position: relative; box-shadow: var(--shadow-rest); }
  .file-card:hover { border-color: var(--brand); box-shadow: var(--shadow-float); text-decoration: none; transform: translateY(-1px); color: var(--ink); }
  .file-card .icon { font-size: 32px; }
  .file-card .name { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; overflow: hidden; }
  .file-card .name span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-card .name .ann-pill { flex-shrink: 0; white-space: nowrap; display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; font-size: 11px; font-weight: 500; background: #FEF3C7; color: #92400E; }
  .file-card .file-meta { font-size: 12px; color: var(--ink-4); }

  /* ── Members ── */
  .member-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .member-chip { display: flex; align-items: center; gap: 6px; padding: var(--sp-2) var(--sp-3); background: var(--elevated); border: 1px solid var(--border); border-radius: 999px; font-size: 13px; transition: all .15s; }
  .member-chip:hover { border-color: var(--border-strong); background: var(--bg-hover); }

  /* ── Upload Zone ── */
  .upload-zone { border: 2px dashed var(--border-strong); border-radius: var(--r-xl); padding: var(--sp-8); text-align: center; cursor: pointer; transition: all .25s; margin: var(--sp-4) 0; }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--brand); background: var(--brand-light); }
  .upload-zone p { margin: var(--sp-2) 0; color: var(--ink-3); font-size: 14px; }
  .upload-zone .upload-icon { font-size: 40px; margin-bottom: var(--sp-2); opacity: .6; }

  /* ── Annotation ── */
  .annotation { background: var(--warning-light); border: 1px solid rgba(245,158,11,.2); border-radius: var(--r); padding: var(--sp-4); margin: var(--sp-3) 0; }
  .annotation.resolved { background: var(--elevated); border-color: var(--border); opacity: .5; }
  .annotation .ann-header { font-size: 13px; margin-bottom: var(--sp-2); color: var(--ink-3); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .annotation .ann-content { margin: var(--sp-2) 0; font-size: 14px; line-height: 1.6; }
  .annotation .ann-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: var(--sp-2); }

  /* ── Code Table ── */
  .code-table { border-collapse: collapse; width: 100%; font-size: 13px; font-family: "SF Mono", "Fira Code", Menlo, monospace; line-height: 1.6; }
  .code-table tr { transition: background .1s; }
  .code-table tr:hover { background: var(--elevated); }
  .code-table .line-num { color: var(--ink-4); text-align: right; padding: 2px 14px 2px 10px; user-select: none; width: 52px; min-width: 52px; font-size: 12px; vertical-align: top; border-right: 1px solid var(--border); }
  .code-table .line-content { white-space: pre-wrap; word-break: break-all; padding: 2px var(--sp-4); }
  .add-annotation { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: var(--sp-6); margin-top: var(--sp-6); box-shadow: var(--shadow-rest); }

  /* ── Toast ── */
  .toast { position: fixed; top: 20px; right: 20px; padding: var(--sp-3) var(--sp-5); border-radius: var(--r-sm); font-size: 14px; z-index: 9999; animation: slideIn .3s ease; pointer-events: none; font-weight: 500; }
  .toast-success { background: var(--success-light); color: var(--success); border: 1px solid rgba(16,185,129,.2); }
  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn .5s ease; }

  /* ── Navigation（DM3: 深蓝黑 #1E1E2E 导航栏） ── */
  .nav { background: var(--sidebar-bg); padding: 0 var(--sp-6); position: sticky; top: 0; z-index: 100; }
  .nav-inner { max-width: 980px; margin: 0 auto; display: flex; align-items: center; gap: var(--sp-5); height: 52px; }
  .nav-brand { font-weight: 600; font-size: 15px; color: #FFFFFF; display: flex; align-items: center; gap: var(--sp-2); text-decoration: none; }
  .nav-brand:hover { color: rgba(255,255,255,.8); }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: var(--sp-4); font-size: 13px; }
  .nav-right a { color: var(--sidebar-text); font-weight: 500; }
  .nav-right a:hover { color: #FFFFFF; }
  .nav-user { display: flex; align-items: center; gap: var(--sp-2); padding: 4px 12px 4px 4px; background: var(--sidebar-active); border-radius: 999px; font-size: 13px; font-weight: 500; color: #FFFFFF; }
  .nav-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--brand); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 600; }

  /* ── Empty State ── */
  .empty-state { text-align: center; padding: var(--sp-12) var(--sp-6); color: var(--ink-4); }
  .empty-state .empty-icon { font-size: 52px; margin-bottom: var(--sp-4); opacity: .5; }
  .empty-state p { margin: var(--sp-2) 0; font-size: 14px; }

  /* ── Search Result ── */
  .search-result { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: var(--sp-4); margin: var(--sp-3) 0; transition: all .2s; box-shadow: var(--shadow-rest); }
  .search-result:hover { border-color: var(--brand); box-shadow: var(--shadow-hover); transform: translateY(-1px); }
  .search-result .result-path { font-weight: 600; font-size: 15px; }
  .search-result .result-count { font-size: 12px; color: var(--ink-4); margin-left: var(--sp-2); }
  .search-result ul { margin: var(--sp-2) 0 0; padding-left: 0; list-style: none; }
  .search-result li { padding: 5px 0; font-size: 13px; color: var(--ink-3); border-bottom: 1px solid var(--border); font-family: "SF Mono", Menlo, monospace; }
  .search-result li:last-child { border-bottom: none; }
  .search-result li small { color: var(--ink-4); margin-right: 10px; }

  /* ── Editor Area ── */
  .editor-area { width: 100%; min-height: 500px; font-family: "SF Mono", "Fira Code", Menlo, monospace; font-size: 14px; line-height: 1.6; padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--r); background: var(--elevated); color: var(--ink); resize: vertical; tab-size: 2; height: auto; }
  .editor-area:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-light); }

  /* ── Split View ── */
  .split-view { display: flex; gap: 0; border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; min-height: 500px; background: var(--surface); }
  .ann-marker { position: absolute; right: 4px; width: 20px; height: 20px; background: var(--warning); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; color: #fff; font-weight: bold; z-index: 10; }
  .ann-marker:hover .ann-tooltip { display: block; }
  .ann-tooltip { display: none; position: absolute; right: 28px; top: -4px; background: var(--sidebar-bg); color: #fff; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-sm); font-size: 12px; white-space: pre-wrap; max-width: 280px; box-shadow: var(--shadow-float); z-index: 100; }
  .ann-highlight { background: #FEF3C7; border-bottom: 2px solid var(--warning); }
  .cart-panel { position: fixed; bottom: 88px; right: 24px; width: 360px; max-height: 400px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-float); z-index: 50; padding: var(--sp-3); }
  .preview-wrapper { position: relative; }
  .split-pane { flex: 1; min-width: 0; overflow: auto; position: relative; }
  .split-pane-source { border-right: 1px solid var(--border); background: var(--elevated); }
  .split-pane-source textarea { width: 100%; height: 100%; min-height: 500px; border: none; outline: none; padding: var(--sp-4); font-family: "SF Mono","Fira Code",Menlo,monospace; font-size: 13px; line-height: 1.6; resize: none; background: transparent; color: var(--ink); tab-size: 2; }
  .split-header { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-2) var(--sp-4); background: var(--elevated); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--ink-3); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  .split-header .save-indicator { font-size: 11px; color: var(--ink-4); font-weight: normal; text-transform: none; }
  .split-divider { width: 4px; background: var(--border); cursor: col-resize; flex-shrink: 0; transition: background .2s; }
  .split-divider:hover, .split-divider.dragging { background: var(--brand); }

  /* ── Annotation Sidebar ── */
  .ann-sidebar { width: 280px; min-width: 280px; border-left: 1px solid var(--border); overflow-y: auto; background: var(--bg); flex-shrink: 0; position: relative; }
  .ann-sidebar .ann-card { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--warning); border-radius: var(--r-sm); padding: var(--sp-3); margin: var(--sp-2); font-size: 12px; cursor: pointer; transition: box-shadow .15s; position: relative; }
  .ann-sidebar .ann-card:hover { box-shadow: var(--shadow-hover); }
  .ann-card-author { font-weight: 600; font-size: 11px; color: var(--ink-2); }
  .ann-card-quote { font-size: 11px; color: var(--ink-3); margin: 4px 0; padding: 4px 6px; background: #FEF3C7; border-radius: var(--r-xs); line-height: 1.3; max-height: 40px; overflow: hidden; }
  .ann-card-content { font-size: 12px; color: var(--ink); margin: 4px 0; line-height: 1.4; }
  .ann-card-actions { display: flex; gap: 4px; margin-top: 6px; }
  .ann-highlight-persistent { background: #FEF3C7; border-bottom: 2px solid var(--warning); border-radius: 2px; cursor: pointer; }
  .ann-input-card { background: var(--surface); border: 1px solid var(--brand); border-radius: var(--r-sm); padding: var(--sp-3); margin: var(--sp-2); }
  .ann-margin-bubble { position: relative; margin: 6px var(--sp-2); padding: var(--sp-2) var(--sp-3); background: var(--surface); border-left: 3px solid var(--warning); border-radius: 0 var(--r) var(--r) 0; font-size: 12px; line-height: 1.5; cursor: pointer; transition: all .15s; box-shadow: var(--shadow-rest); }
  .ann-margin-bubble:hover { background: #FDE68A; }
  .ann-margin-bubble .ann-bubble-author { font-weight: 600; color: var(--ink-3); font-size: 11px; }
  .ann-margin-bubble .ann-bubble-content { color: var(--ink); margin-top: 2px; }
  .ann-margin-bubble .ann-bubble-actions { display: flex; gap: 4px; margin-top: 4px; }
  .ann-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; padding: 0 4px; margin-left: 4px; }

  /* ── DOCX contenteditable ── */
  #previewPanel[contenteditable="true"] p { margin-bottom: 14px; }
  #previewPanel[contenteditable="true"] h1, #previewPanel[contenteditable="true"] h2, #previewPanel[contenteditable="true"] h3 { margin: 20px 0 10px; }
  #previewPanel[contenteditable="true"] table { border-collapse: collapse; width: 100%; margin: var(--sp-3) 0; }
  #previewPanel[contenteditable="true"] td, #previewPanel[contenteditable="true"] th { border: 1px solid var(--border-strong); padding: 6px 10px; }
  #previewPanel[contenteditable="true"] ul, #previewPanel[contenteditable="true"] ol { margin: var(--sp-2) 0 var(--sp-2) 20px; }
  #previewPanel[contenteditable="true"]:focus { outline: none; box-shadow: inset 0 0 0 2px var(--brand-light); }
  #docxToolbar .tb { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-xs); padding: 2px 7px; font-size: 12px; cursor: pointer; color: var(--ink-2); min-width: 26px; text-align: center; line-height: 1.4; }
  #docxToolbar .tb:hover { background: var(--bg-hover); }
  #docxToolbar .tb:active { background: var(--brand-light); border-color: var(--brand); }
  #docxToolbar .tb-sep { width: 1px; height: 16px; background: var(--border); margin: 0 3px; flex-shrink: 0; }

  /* ── Annotation cards in sidebar ── */
  .ann-card { padding: var(--sp-3); background: var(--surface); border-radius: var(--r-sm); margin: 6px 10px; font-size: 13px; transition: background .15s; border-left: 3px solid transparent; }
  .ann-card:hover { background: var(--bg-hover); border-left-color: var(--brand); }
  .ann-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; font-size: 12px; color: var(--ink-3); }
  .ann-card-content { color: var(--ink); line-height: 1.5; margin-bottom: 6px; }
  .ann-card-actions { display: flex; gap: 4px; flex-wrap: wrap; }
  .ann-highlight { background: #FEF3C7; border-bottom: 2px solid var(--warning); cursor: pointer; border-radius: 2px; }
  .ann-highlight:hover { background: #FDE68A; outline: 1px solid var(--warning); }

  /* ── Hero ── */
  .hero { text-align: center; padding: var(--sp-12) var(--sp-6) var(--sp-8); position: relative; overflow: hidden; }
  .hero h1 { font-size: 32px; margin-bottom: var(--sp-3); color: var(--ink); }
  .hero .hero-desc { font-size: 15px; color: var(--ink-3); max-width: 560px; margin: 0 auto var(--sp-6); line-height: 1.5; font-weight: 400; }
  .hero-glow { position: absolute; top: -120px; left: 50%; transform: translateX(-50%); width: 600px; height: 400px; background: radial-gradient(ellipse, var(--brand-light) 0%, transparent 70%); pointer-events: none; opacity: .4; z-index: -1; }
  .hero-features { display: flex; justify-content: center; gap: var(--sp-8); margin-top: var(--sp-6); flex-wrap: wrap; }
  .hero-features .feature { text-align: center; }
  .hero-features .feature-icon { font-size: 32px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--border); margin: 0 auto 10px; box-shadow: var(--shadow-rest); }
  .hero-features .feature-label { font-size: 13px; color: var(--ink-3); font-weight: 500; }

  /* ── 404 ── */
  .not-found { text-align: center; padding: 100px var(--sp-6); }
  .not-found .nf-code { font-size: 80px; font-weight: 800; color: var(--ink-4); line-height: 1; }
  .not-found .nf-msg { font-size: 15px; color: var(--ink-3); margin: var(--sp-5) 0 var(--sp-8); }
  .img-preview { text-align: center; padding: var(--sp-6); }
  .img-preview img { max-width: 100%; border-radius: var(--r-lg); box-shadow: var(--shadow-float); }
  details { margin: var(--sp-2) 0; }
  details > summary { cursor: pointer; font-size: 13px; color: var(--ink-3); padding: 10px 0; user-select: none; font-weight: 500; }
  details > summary:hover { color: var(--brand); }

  /* ── Auth Pages（DM3: 左右分屏，左品牌渐变 + 右白色表单） ── */
  .auth-page { min-height: 100vh; display: flex; background: var(--bg); }
  .auth-hero { flex: 1; background: linear-gradient(135deg, #7C5CFC, #6366F1, #3B82F6); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--sp-12); color: #fff; position: relative; overflow: hidden; }
  .auth-hero h1 { font-size: 36px; font-weight: 700; color: #fff; margin-bottom: var(--sp-4); text-align: center; }
  .auth-hero-tags { display: flex; flex-wrap: wrap; gap: var(--sp-2); justify-content: center; margin-top: var(--sp-4); }
  .auth-hero-tag { backdrop-filter: blur(8px); background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: var(--sp-2) var(--sp-4); font-size: 13px; font-weight: 500; color: #fff; }
  .auth-form-side { width: 420px; min-width: 380px; display: flex; align-items: center; justify-content: center; padding: var(--sp-8); background: var(--surface); }
  .auth-card { width: 100%; max-width: 340px; text-align: center; }
  .auth-logo { font-size: 48px; margin-bottom: var(--sp-4); }
  .auth-title { font-size: 20px; font-weight: 600; margin-bottom: 6px; color: var(--ink); }
  .auth-subtitle { font-size: 13px; color: var(--ink-3); margin-bottom: var(--sp-6); }
  .auth-form { text-align: left; display: flex; flex-direction: column; gap: var(--sp-4); }
  .auth-form .form-group { display: flex; flex-direction: column; }
  .auth-form label { font-size: 12px; font-weight: 500; color: var(--ink-3); margin-bottom: 6px; }
  .auth-btn { width: 100%; height: 40px; border-radius: var(--r-sm); font-size: 15px; font-weight: 600; background: var(--brand); color: #fff; border: none; cursor: pointer; transition: all .2s; }
  .auth-btn:hover { background: var(--brand-hover); }
  .auth-btn:active { transform: scale(.98); }
  .auth-link { margin-top: var(--sp-5); font-size: 13px; color: var(--ink-3); text-align: center; }
  .auth-link a { font-weight: 500; color: var(--brand); }
  .auth-error { background: var(--danger-light); color: var(--danger); padding: var(--sp-3); border-radius: var(--r-sm); font-size: 13px; margin-bottom: var(--sp-3); }
  .auth-success { background: var(--success-light); color: var(--success); padding: var(--sp-3); border-radius: var(--r-sm); font-size: 13px; margin-bottom: var(--sp-3); }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .auth-page { flex-direction: column; }
    .auth-hero { min-height: 200px; padding: var(--sp-8); }
    .auth-hero h1 { font-size: 24px; }
    .auth-form-side { width: 100%; min-width: unset; }
  }
  @media (max-width: 640px) {
    .container { padding: var(--sp-4) var(--sp-3); }
    .card { padding: var(--sp-4); border-radius: var(--r-sm); }
    .file-grid { grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
    .card-header { flex-direction: column; align-items: flex-start; gap: var(--sp-2); }
    .member-list { flex-direction: column; }
    .hero h1 { font-size: 24px; }
    .hero .hero-desc { font-size: 14px; }
    .hero-features { gap: var(--sp-4); }
    .btn-group { flex-direction: column; }
    .nav-inner { gap: var(--sp-3); }
    .editor-area { min-height: 350px; font-size: 13px; }
    .form-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 400px) {
    .file-grid { grid-template-columns: 1fr; }
  }
`;
