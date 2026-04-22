/**
 * Context Server — CSS Styles
 * Apple-inspired Design System
 *
 * Brand: Apple Blue #2997FF
 * 白底 + 深色导航 + 大留白 + 胶囊按钮
 * 字体: SF Pro Display / Inter + PingFang SC
 */

export const CSS = `
  :root {
    /* ── Brand Apple Blue ── */
    --brand: #2997FF;
    --brand-hover: #0077ED;
    --brand-light: #EBF5FF;
    --brand-lighter: #D6EBFF;
    --primary: var(--brand);
    --primary-hover: var(--brand-hover);
    --primary-light: var(--brand-light);
    /* ── 背景层级（苹果白 + 浅灰） ── */
    --bg: #FFFFFF;
    --surface: #FBFBFD;
    --elevated: #F5F5F7;
    --bg-hover: #E8E8ED;
    --bg-card: #F5F5F7;
    --bg-code: #F5F5F7;
    /* ── 侧边栏 / 导航 ── */
    --sidebar-bg: rgba(29,29,31,.92);
    --sidebar-text: rgba(255,255,255,.8);
    --sidebar-active: rgba(255,255,255,.1);
    /* ── 文字层级（苹果精确灰度） ── */
    --ink: #1D1D1F;
    --ink-2: #1D1D1F;
    --ink-3: #6E6E73;
    --ink-4: #86868B;
    --text: var(--ink);
    --text-secondary: var(--ink-3);
    --text-muted: var(--ink-4);
    /* ── 语义色 ── */
    --success: #34C759;
    --success-light: rgba(52,199,89,.1);
    --warning: #FF9500;
    --warning-light: rgba(255,149,0,.1);
    --danger: #FF3B30;
    --danger-light: rgba(255,59,48,.08);
    /* ── 边框 ── */
    --border: #D2D2D7;
    --border-strong: #C7C7CC;
    /* ── 阴影（苹果风：极轻柔，大扩散） ── */
    --shadow-rest: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
    --shadow-hover: 0 4px 18px rgba(0,0,0,0.08);
    --shadow-float: 0 12px 40px rgba(0,0,0,0.12);
    --shadow-overlay: 0 20px 60px rgba(0,0,0,0.15);
    --shadow: var(--shadow-rest);
    --shadow-md: var(--shadow-hover);
    --shadow-lg: var(--shadow-float);
    /* ── 圆角（苹果大圆角） ── */
    --r-xs: 6px;
    --r-sm: 10px;
    --r: 14px;
    --r-lg: 18px;
    --r-xl: 22px;
    --r-pill: 980px;
    --radius: var(--r);
    --radius-lg: var(--r-lg);
    --radius-xl: var(--r-xl);
    /* ── 间距（8px 基准，苹果风大呼吸感） ── */
    --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
    --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: -apple-system, "SF Pro Display", "SF Pro Text", "Inter", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    margin: 0; padding: 0; line-height: 1.47059; letter-spacing: -.022em; color: var(--text); background: var(--bg);
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    font-variant-numeric: tabular-nums;
  }
  .container { max-width: 1000px; margin: 0 auto; padding: var(--sp-10) var(--sp-6); }

  /* ── Card（苹果风：大圆角 + 浅灰底 + 无边框 + hover 升浮） ── */
  .card { background: var(--bg-card); border: none; border-radius: var(--r-xl); padding: var(--sp-8); margin-bottom: var(--sp-6); box-shadow: none; transition: all .4s cubic-bezier(.25,.1,.25,1); }
  .card:hover { box-shadow: var(--shadow-hover); transform: translateY(-2px); }
  .card.glass { background: var(--bg-card); }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-5); padding-bottom: var(--sp-4); border-bottom: 1px solid var(--border); }
  .card-header h2 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: .012em; }

  /* ── Typography（苹果风：超大标题 + 精确字重） ── */
  h1 { font-size: 40px; font-weight: 700; margin: 0 0 var(--sp-3); color: var(--ink); letter-spacing: -.005em; line-height: 1.1; }
  h2 { font-size: 24px; font-weight: 600; color: var(--ink); margin-top: var(--sp-6); letter-spacing: .009em; }
  h3 { font-size: 17px; font-weight: 600; color: var(--ink); letter-spacing: -.022em; }
  a { color: var(--brand); text-decoration: none; transition: color .2s; }
  a:hover { color: var(--brand-hover); }
  hr { border: none; border-top: 1px solid var(--border); margin: var(--sp-5) 0; }
  blockquote { border-left: 3px solid var(--brand); padding: var(--sp-3) var(--sp-4); margin: var(--sp-3) 0; background: var(--brand-light); border-radius: 0 var(--r) var(--r) 0; color: var(--ink-2); font-size: 14px; }
  pre { background: var(--elevated); padding: var(--sp-4); border-radius: var(--r); overflow-x: auto; border: 1px solid var(--border); font-size: 13px; line-height: 1.6; }
  code { background: var(--elevated); padding: 2px 7px; border-radius: var(--r-xs); font-size: .85em; font-family: "SF Mono", "Fira Code", Menlo, monospace; }
  pre code { background: none; padding: 0; }

  /* ── Form Controls（苹果风：44px 高，大圆角，柔和 focus 光晕） ── */
  input[type="text"], input[type="number"], input[type="email"], input[type="url"], input[type="search"], input[type="password"],
  input:not([type]), textarea, select {
    font-family: inherit; font-size: 15px; line-height: 1.5;
    height: 44px; padding: 0 var(--sp-4); border: 1px solid var(--border); border-radius: var(--r);
    background: #FFFFFF; color: var(--ink); transition: all .3s cubic-bezier(.25,.1,.25,1);
    outline: none; width: 100%; letter-spacing: -.01em;
  }
  textarea { height: auto; padding: var(--sp-4); resize: vertical; min-height: 80px; }
  input:focus, textarea:focus, select:focus {
    border-color: var(--brand); box-shadow: 0 0 0 4px rgba(41,151,255,.15);
  }
  input::placeholder, textarea::placeholder { color: var(--ink-4); }
  select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M2 4l4 4 4-4'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right var(--sp-3) center; padding-right: 34px; }
  label { font-size: 12px; font-weight: 500; color: var(--ink-3); display: block; margin-bottom: 6px; }
  .form-grid { display: flex; flex-direction: column; gap: var(--sp-4); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  .form-group { display: flex; flex-direction: column; }
  .form-group input, .form-group select, .form-group textarea { margin-top: 0; }

  /* ── Tables（苹果风：轻量分割线，宽松行高） ── */
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: var(--sp-4) var(--sp-5); text-align: left; border-bottom: 1px solid var(--border); }
  th { font-weight: 500; font-size: 12px; color: var(--ink-4); letter-spacing: .02em; text-transform: uppercase; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .2s; height: 52px; }
  tbody tr:hover { background: var(--elevated); }
  .table-wrap { border: none; border-radius: var(--r-xl); overflow: hidden; background: var(--bg-card); }

  /* ── Breadcrumb ── */
  .breadcrumb { color: var(--ink-4); margin-bottom: var(--sp-5); font-size: 13px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--ink-3); font-weight: 500; }
  .breadcrumb a:hover { color: var(--brand); }
  .breadcrumb span { color: var(--ink-4); font-size: 10px; }

  /* ── Meta ── */
  .meta { background: var(--elevated); padding: var(--sp-3) var(--sp-4); border-radius: var(--r); margin: var(--sp-3) 0; border: 1px solid var(--border); font-size: 13px; color: var(--ink-3); line-height: 1.9; }
  .meta b { color: var(--ink); font-weight: 600; }

  /* ── Badge（苹果风：轻盈胶囊） ── */
  .badge { display: inline-flex; align-items: center; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 500; letter-spacing: .008em; }
  .badge-agent { background: rgba(41,151,255,.1); color: #0071E3; }
  .badge-human { background: rgba(52,199,89,.1); color: #248A3D; }
  .badge-creator { background: rgba(255,149,0,.1); color: #C45D09; }
  .badge-channel { background: var(--elevated); color: var(--ink-3); border: none; }

  /* ── Button（苹果风：胶囊按钮 pill 圆角） ── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 11px 22px; border-radius: var(--r-pill); font-size: 15px; font-weight: 400; border: none; background: var(--brand); color: #fff; cursor: pointer; text-decoration: none; transition: all .3s cubic-bezier(.25,.1,.25,1); line-height: 1.2; letter-spacing: -.01em; }
  .btn:hover { background: var(--brand-hover); text-decoration: none; color: #fff; transform: scale(1.02); }
  .btn:active { transform: scale(.98); }
  .btn-primary { background: var(--brand); color: #fff; }
  .btn-primary:hover { background: var(--brand-hover); color: #fff; }
  .btn-outline { background: transparent; color: var(--brand); border: 1.5px solid var(--brand); }
  .btn-outline:hover { background: var(--brand); color: #fff; }
  .btn-success { background: var(--success); color: #fff; }
  .btn-danger { background: transparent; color: var(--danger); border: 1.5px solid var(--danger); }
  .btn-danger:hover { background: var(--danger); color: #fff; }
  .btn-ghost { background: transparent; border: none; color: var(--ink-3); }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--ink); }
  .btn-text { background: none; border: none; color: var(--brand); padding: 0; font-weight: 400; font-size: 17px; }
  .btn-text:hover { color: var(--brand-hover); transform: none; }
  .btn-small { padding: 6px 16px; font-size: 12px; border-radius: var(--r-pill); border: 1px solid var(--border); background: var(--surface); cursor: pointer; transition: all .2s; color: var(--ink); font-family: inherit; font-weight: 500; }
  .btn-small:hover { background: var(--bg-hover); border-color: var(--border-strong); }
  .btn-group { display: flex; gap: var(--sp-3); flex-wrap: wrap; }

  /* ── File Grid（苹果风：大圆角卡片网格） ── */
  .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--sp-4); margin: var(--sp-5) 0; }
  .file-card { background: var(--bg-card); border: none; border-radius: var(--r-xl); padding: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-3); transition: all .4s cubic-bezier(.25,.1,.25,1); text-decoration: none; color: var(--ink); position: relative; box-shadow: none; }
  .file-card:hover { box-shadow: var(--shadow-float); text-decoration: none; transform: scale(1.02); color: var(--ink); }
  .file-card .icon { font-size: 36px; }
  .file-card .name { font-size: 17px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; overflow: hidden; letter-spacing: -.022em; }
  .file-card .name span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-card .name .ann-pill { flex-shrink: 0; white-space: nowrap; display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; font-size: 11px; font-weight: 500; background: rgba(255,149,0,.12); color: #C45D09; }
  .file-card .file-meta { font-size: 12px; color: var(--ink-4); letter-spacing: .008em; }

  /* ── Members ── */
  .member-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .member-chip { display: flex; align-items: center; gap: 6px; padding: var(--sp-2) var(--sp-3); background: var(--elevated); border: 1px solid var(--border); border-radius: 999px; font-size: 13px; transition: all .15s; }
  .member-chip:hover { border-color: var(--border-strong); background: var(--bg-hover); }

  /* ── Upload Zone（苹果风：虚线圆角，极简） ── */
  .upload-zone { border: 2px dashed var(--border); border-radius: var(--r-xl); padding: var(--sp-10); text-align: center; cursor: pointer; transition: all .4s cubic-bezier(.25,.1,.25,1); margin: var(--sp-5) 0; background: var(--bg-card); }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--brand); background: var(--brand-light); }
  .upload-zone p { margin: var(--sp-2) 0; color: var(--ink-4); font-size: 14px; letter-spacing: .008em; }
  .upload-zone .upload-icon { font-size: 40px; margin-bottom: var(--sp-3); opacity: .5; }

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

  /* ── Navigation（苹果风：磨砂玻璃导航） ── */
  .nav { background: var(--sidebar-bg); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); padding: 0 var(--sp-6); position: sticky; top: 0; z-index: 100; border-bottom: 0.5px solid rgba(255,255,255,.08); }
  .nav-inner { max-width: 1000px; margin: 0 auto; display: flex; align-items: center; gap: var(--sp-5); height: 48px; }
  .nav-brand { font-weight: 600; font-size: 17px; color: #F5F5F7; display: flex; align-items: center; gap: var(--sp-2); text-decoration: none; letter-spacing: -.02em; }
  .nav-brand:hover { color: rgba(255,255,255,.7); }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: var(--sp-5); font-size: 12px; }
  .nav-right a { color: var(--sidebar-text); font-weight: 400; font-size: 12px; letter-spacing: .008em; }
  .nav-right a:hover { color: #FFFFFF; }
  .nav-user { display: flex; align-items: center; gap: var(--sp-2); padding: 4px 12px 4px 4px; background: var(--sidebar-active); border-radius: 999px; font-size: 12px; font-weight: 400; color: #F5F5F7; }
  .nav-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--brand); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 600; }

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
  .assign-label { display:flex;align-items:center;gap:8px;padding:8px;cursor:pointer;border-radius:6px;transition:background .15s; }
  .assign-label:hover { background:#f3f4f6; }
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

  /* ── Hero（苹果风：超大标题 + 极简描述） ── */
  .hero { text-align: center; padding: var(--sp-16) var(--sp-6) var(--sp-10); position: relative; overflow: hidden; }
  .hero h1 { font-size: 48px; font-weight: 700; margin-bottom: var(--sp-4); color: var(--ink); letter-spacing: -.003em; line-height: 1.08; }
  .hero .hero-desc { font-size: 19px; color: var(--ink-3); max-width: 580px; margin: 0 auto var(--sp-8); line-height: 1.42; font-weight: 400; letter-spacing: .012em; }
  .hero-glow { position: absolute; top: -180px; left: 50%; transform: translateX(-50%); width: 800px; height: 500px; background: radial-gradient(ellipse, rgba(41,151,255,.06) 0%, transparent 70%); pointer-events: none; z-index: -1; }
  .hero-features { display: flex; justify-content: center; gap: var(--sp-10); margin-top: var(--sp-8); flex-wrap: wrap; }
  .hero-features .feature { text-align: center; }
  .hero-features .feature-icon { font-size: 32px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--r-xl); background: var(--bg-card); border: none; margin: 0 auto 12px; box-shadow: none; }
  .hero-features .feature-label { font-size: 14px; color: var(--ink-3); font-weight: 500; letter-spacing: .008em; }

  /* ── 404 ── */
  .not-found { text-align: center; padding: 120px var(--sp-6); }
  .not-found .nf-code { font-size: 96px; font-weight: 700; color: var(--ink-4); line-height: 1; letter-spacing: -.02em; }
  .not-found .nf-msg { font-size: 17px; color: var(--ink-3); margin: var(--sp-6) 0 var(--sp-10); }
  .img-preview { text-align: center; padding: var(--sp-6); }
  .img-preview img { max-width: 100%; border-radius: var(--r-lg); box-shadow: var(--shadow-float); }
  details { margin: var(--sp-2) 0; }
  details > summary { cursor: pointer; font-size: 13px; color: var(--ink-3); padding: 10px 0; user-select: none; font-weight: 500; }
  details > summary:hover { color: var(--brand); }

  /* ── Auth Pages（苹果风：左深色 + 右白色表单） ── */
  .auth-page { min-height: 100vh; display: flex; background: var(--bg); }
  .auth-hero { flex: 1; background: #1D1D1F; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--sp-12); color: #fff; position: relative; overflow: hidden; }
  .auth-hero h1 { font-size: 48px; font-weight: 700; color: #F5F5F7; margin-bottom: var(--sp-4); text-align: center; letter-spacing: -.003em; }
  .auth-hero-tags { display: flex; flex-wrap: wrap; gap: var(--sp-3); justify-content: center; margin-top: var(--sp-5); }
  .auth-hero-tag { backdrop-filter: blur(12px); background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 999px; padding: var(--sp-2) var(--sp-5); font-size: 13px; font-weight: 400; color: rgba(255,255,255,.7); letter-spacing: .008em; }
  .auth-form-side { width: 440px; min-width: 400px; display: flex; align-items: center; justify-content: center; padding: var(--sp-10); background: #FFFFFF; }
  .auth-card { width: 100%; max-width: 340px; text-align: center; }
  .auth-logo { font-size: 48px; margin-bottom: var(--sp-4); }
  .auth-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: var(--ink); letter-spacing: -.02em; }
  .auth-subtitle { font-size: 15px; color: var(--ink-3); margin-bottom: var(--sp-8); }
  .auth-form { text-align: left; display: flex; flex-direction: column; gap: var(--sp-5); }
  .auth-form .form-group { display: flex; flex-direction: column; }
  .auth-form label { font-size: 13px; font-weight: 500; color: var(--ink-3); margin-bottom: 8px; letter-spacing: .008em; }
  .auth-btn { width: 100%; height: 44px; border-radius: var(--r-pill); font-size: 15px; font-weight: 500; background: var(--brand); color: #fff; border: none; cursor: pointer; transition: all .3s cubic-bezier(.25,.1,.25,1); letter-spacing: -.01em; }
  .auth-btn:hover { background: var(--brand-hover); transform: scale(1.01); }
  .auth-btn:active { transform: scale(.98); }
  .auth-link { margin-top: var(--sp-6); font-size: 14px; color: var(--ink-3); text-align: center; }
  .auth-link a { font-weight: 400; color: var(--brand); }
  .auth-error { background: var(--danger-light); color: var(--danger); padding: var(--sp-3) var(--sp-4); border-radius: var(--r); font-size: 13px; margin-bottom: var(--sp-4); }
  .auth-success { background: var(--success-light); color: var(--success); padding: var(--sp-3) var(--sp-4); border-radius: var(--r); font-size: 13px; margin-bottom: var(--sp-4); }

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
