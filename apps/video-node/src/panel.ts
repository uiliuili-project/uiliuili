import type { AssetRow } from './db';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = -1;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

const STYLES = `
  :root { color-scheme: light dark; --bg:#0f1115; --card:#171a21; --text:#e6e8ee; --muted:#8b93a7; --line:#272c36; --accent:#5aa9ff; }
  @media (prefers-color-scheme: light) {
    :root { --bg:#f5f6f8; --card:#fff; --text:#171a21; --muted:#5d6678; --line:#e2e5eb; --accent:#1266d6; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid var(--line); }
  header h1 { font-size:16px; margin:0; }
  header form { margin:0; }
  main { padding:24px; max-width:1100px; margin:0 auto; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .card b { display:block; font-size:20px; margin-top:4px; }
  .muted { color:var(--muted); font-size:12px; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  th, td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--line); font-size:13px; }
  th { color:var(--muted); font-weight:500; }
  tr:last-child td { border-bottom:0; }
  .badge { display:inline-block; padding:1px 8px; border-radius:999px; background:var(--line); font-size:12px; }
  .badge.ready { background:#1f6f43; color:#dcffe9; }
  .badge.failed { background:#7a2530; color:#ffe3e6; }
  .badge.transcoding, .badge.uploading { background:#2a4a73; color:#dbeaff; }
  form.login { max-width:340px; margin:14vh auto; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; }
  input[type=password] { width:100%; margin:12px 0; padding:9px 11px; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--text); }
  button { padding:8px 14px; border:1px solid var(--line); background:var(--card); color:var(--text); border-radius:8px; cursor:pointer; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; width:100%; }
  .error { color:#ff8b98; margin:8px 0; }
  .table-wrap { overflow-x:auto; }
`;

export const panelPage = {
  login(error = ''): string {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>视频节点登录</title><style>${STYLES}</style></head>
<body><form class="login" method="post" action="/panel/login">
  <h1>视频节点面板</h1>
  <p class="muted">请输入节点管理员密码。</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
  <input type="password" name="password" autocomplete="current-password" required autofocus>
  <button class="primary" type="submit">登录</button>
</form></body></html>`;
  },

  dashboard(
    name: string,
    assets: AssetRow[],
    usedBytes: number,
    config: { nodeId: string; publicUrl: string; maxConcurrency: number; region: string },
  ): string {
    const rows = assets
      .map((asset) => {
        const status = escapeHtml(asset.status);
        return `<tr>
          <td title="${escapeHtml(asset.id)}">${escapeHtml(asset.filename)}</td>
          <td><span class="badge ${status}">${status}</span></td>
          <td>${formatBytes(Number(asset.size))}</td>
          <td>${asset.duration_seconds > 0 ? `${Math.floor(asset.duration_seconds / 60)}:${String(asset.duration_seconds % 60).padStart(2, '0')}` : '-'}</td>
          <td>${asset.height > 0 ? `${asset.height}p` : '-'}</td>
          <td>${escapeHtml(asset.profile)}</td>
          <td class="muted">${escapeHtml(asset.created_at.toISOString().replace('T', ' ').slice(0, 19))}</td>
        </tr>`;
      })
      .join('');
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(name)} · 视频节点</title><style>${STYLES}</style></head>
<body>
<header>
  <h1>${escapeHtml(name)}</h1>
  <form method="post" action="/panel/logout"><button type="submit">退出</button></form>
</header>
<main>
  <div class="cards">
    <div class="card"><span class="muted">节点 ID</span><b>${escapeHtml(config.nodeId)}</b></div>
    <div class="card"><span class="muted">地区</span><b>${escapeHtml(config.region || '未设置')}</b></div>
    <div class="card"><span class="muted">已用存储</span><b>${formatBytes(usedBytes)}</b></div>
    <div class="card"><span class="muted">资产数</span><b>${assets.length}</b></div>
    <div class="card"><span class="muted">转码并发</span><b>${config.maxConcurrency}</b></div>
  </div>
  <p class="muted">公网地址：${escapeHtml(config.publicUrl)}</p>
  <div class="table-wrap">
  <table>
    <thead><tr><th>文件</th><th>状态</th><th>大小</th><th>时长</th><th>清晰度</th><th>预设</th><th>创建时间</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" class="muted">还没有资产</td></tr>'}</tbody>
  </table>
  </div>
</main>
</body></html>`;
  },
};
