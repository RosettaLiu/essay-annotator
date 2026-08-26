const $ = (id) => document.getElementById(id);
const id = location.pathname.split('/share/')[1];
let lastData = {};

function escapeHtml(s) {
  return (s == null ? '' : String(s)).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function loadFromHash() {
  const m = location.hash.match(/[#&]s=([^&]+)/);
  if (!m) return false;
  try {
    const d = decodeShare(m[1]);
    if (!d || !d.text) return false;
    render(d);
    return true;
  } catch (e) {
    $('essay').textContent = '链接解析失败（数据可能已损坏）。';
    return true; // 已处理，不再走服务端
  }
}

async function load() {
  // 优先读取内嵌在 URL 中的数据（自包含链接，无需后端）
  if (loadFromHash()) return;
  // 兼容旧版：从服务端按 id 取
  try {
    const r = await fetch('/api/share/' + encodeURIComponent(id));
    const d = await r.json();
    if (d.error) { $('essay').textContent = '未找到该分享内容（链接无效或服务已重启）。'; return; }
    render(d);
  } catch (e) {
    $('essay').textContent = '加载失败：' + e.message;
  }
}

function render(d) {
  lastData = d;
  const o = d.overall || {};
  $('overall-summary').innerHTML = '<h3>总体评价</h3><p>' + (escapeHtml(o.summary) || '（无）') + '</p>';
  $('ov-full').innerHTML =
    '<p><strong>优点：</strong></p><ul>' + (o.strengths || []).map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>' +
    '<p><strong>主要问题：</strong></p><ul>' + (o.main_problems || []).map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>' +
    '<p><strong>下一步建议：</strong>' + escapeHtml(o.next_step || '（无）') + '</p>';
  renderHighlights($('essay'), d.text || '', d.comments || [], (ids) => showSheet(ids), null);
}

function showSheet(ids) {
  if (!ids || !ids.length) return;
  const c = (lastData.comments || []).find((x) => x.id === ids[0]);
  if (!c) return;
  const badge = c.level === 'error' ? 'badge-err' : 'badge-sug';
  const label = c.level === 'error' ? '错误' : '建议';
  $('sheet-content').innerHTML =
    '<div class="sheet-head">' +
      '<span class="badge ' + badge + '">' + label + '</span>' +
      '<span class="sheet-type">' + escapeHtml(c.type) + '</span>' +
      '<button id="sheet-close" class="mini">关闭</button>' +
    '</div>' +
    '<div class="sheet-body">' +
      '<p><strong>原文片段：</strong>' + escapeHtml(c.target_text) + '</p>' +
      '<p><strong>修改建议：</strong>' + escapeHtml(c.suggestion) + '</p>' +
      (c.replacement ? '<p><strong>修改后表达：</strong>' + escapeHtml(c.replacement) + '</p>' : '') +
      '<p><strong>解释：</strong>' + escapeHtml(c.explanation) + '</p>' +
    '</div>';
  $('sheet').classList.remove('hidden');
  $('sheet-backdrop').classList.remove('hidden');
  $('sheet-close').addEventListener('click', hideSheet);
}
function hideSheet() {
  $('sheet').classList.add('hidden');
  $('sheet-backdrop').classList.add('hidden');
}
$('sheet-backdrop').addEventListener('click', hideSheet);

load();
