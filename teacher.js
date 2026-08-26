const $ = (id) => document.getElementById(id);

// 手动批注模式：作文来自首页粘贴（存于 localStorage），批注全部由教师手填，不调用 AI
let text = (localStorage.getItem('essayText') || '').trim();
if (!text) {
  alert('未找到作文数据，请返回首页重新粘贴作文。');
  location.href = 'index.html';
}

const STORE_KEY = 'essayWork'; // 自动保存到本浏览器的草稿

let overall = { summary: '', strengths: [], main_problems: [], next_step: '' };
let comments = [];
let selectedId = null;
let pendingSel = null; // 用户在原文中选中后暂存的 {start,end,text}

// 启动时尝试恢复本地草稿（仅当作文一致时才恢复，避免串号）
let restored = false;
(function restore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const w = JSON.parse(raw);
    if (!w || w.text !== text) return;
    overall = w.overall || overall;
    comments = Array.isArray(w.comments) ? w.comments : [];
    if (w.selectedId) selectedId = w.selectedId;
    restored = comments.length > 0 || (overall.summary || overall.strengths.length || overall.main_problems.length);
  } catch (e) { /* 草稿损坏则忽略 */ }
})();

// 每次改动后自动保存草稿
function saveLocal() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ text, overall, comments, selectedId }));
  } catch (e) { /* 存储满或禁用则忽略 */ }
}

function escapeHtml(s) {
  return (s == null ? '' : String(s)).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

function renderAll() { renderEssay(); renderComments(); renderOverall(); }

function renderEssay() {
  renderHighlights($('essay'), text, comments, (ids) => onSelect(ids), selectedId);
}

function onSelect(ids) {
  if (!ids || !ids.length) return;
  selectedId = ids[0];
  renderEssay();
  renderComments();
  const card = document.querySelector('.comment-card[data-id="' + selectedId + '"]');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderComments() {
  const list = $('comment-list');
  if (!comments.length) { list.innerHTML = '<p class="empty">暂无批注。可在下方新增。</p>'; return; }
  list.innerHTML = comments.map(cardHTML).join('');
}

function cardHTML(c) {
  const typeOpts = TYPE_OPTIONS.map((t) => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('');
  const lvlOpts = `<option value="error" ${c.level === 'error' ? 'selected' : ''}>错误</option>` +
                  `<option value="suggestion" ${c.level === 'suggestion' ? 'selected' : ''}>建议</option>`;
  return `<div class="comment-card ${c.id === selectedId ? 'sel' : ''}" data-id="${escapeAttr(c.id)}">
    <div class="cc-row">
      <span class="badge ${c.level === 'error' ? 'badge-err' : 'badge-sug'}">${LEVEL_LABEL[c.level] || c.level}</span>
      <select data-field="type">${typeOpts}</select>
      <select data-field="level">${lvlOpts}</select>
      <button data-act="locate" class="mini">定位</button>
      <button data-act="confirm" class="mini">${c.confirmed ? '已确认 ✓' : '确认'}</button>
      <button data-act="delete" class="mini danger">删除</button>
    </div>
    <div class="cc-field"><label>原文片段</label><input data-field="target_text" value="${escapeAttr(c.target_text)}"></div>
    <div class="cc-field"><label>修改建议</label><textarea data-field="suggestion" rows="2">${escapeHtml(c.suggestion)}</textarea></div>
    <div class="cc-field"><label>修改后表达</label><input data-field="replacement" value="${escapeAttr(c.replacement)}"></div>
    <div class="cc-field"><label>解释</label><textarea data-field="explanation" rows="2">${escapeHtml(c.explanation)}</textarea></div>
  </div>`;
}

function updateCommentField(id, field, value) {
  const c = comments.find((x) => x.id === id);
  if (!c) return;
  if (field === 'target_text') {
    c.target_text = value;
    const pos = text.indexOf(value);
    c.start = pos;
    c.end = pos >= 0 ? pos + value.length : 0;
  } else {
    c[field] = value;
  }
}

const list = $('comment-list');
function onFieldChange(e) {
  const card = e.target.closest('.comment-card');
  if (!card) return;
  const f = e.target.dataset.field;
  if (!f) return;
  updateCommentField(card.dataset.id, f, e.target.value);
  renderEssay();
  saveLocal();
}
list.addEventListener('input', onFieldChange);
list.addEventListener('change', onFieldChange);
list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const card = e.target.closest('.comment-card');
  const id = card.dataset.id;
  const idx = comments.findIndex((x) => x.id === id);
  const act = btn.dataset.act;
  if (act === 'delete') { comments.splice(idx, 1); selectedId = null; renderAll(); }
  else if (act === 'confirm') { comments[idx].confirmed = !comments[idx].confirmed; renderComments(); }
  else if (act === 'locate') { onSelect([id]); }
  saveLocal();
});

function renderOverall() {
  $('ov-summary').value = overall.summary || '';
  $('ov-strengths').value = (overall.strengths || []).join('\n');
  $('ov-problems').value = (overall.main_problems || []).join('\n');
  $('ov-next').value = overall.next_step || '';
}
function collectOverall() {
  return {
    summary: $('ov-summary').value,
    strengths: $('ov-strengths').value.split('\n').map((s) => s.trim()).filter(Boolean),
    main_problems: $('ov-problems').value.split('\n').map((s) => s.trim()).filter(Boolean),
    next_step: $('ov-next').value,
  };
}
// 总体评价输入框变化时实时同步并自动保存
['ov-summary', 'ov-strengths', 'ov-problems', 'ov-next'].forEach((id) => {
  $(id).addEventListener('input', () => { overall = collectOverall(); saveLocal(); });
});

const TYPE_OPTIONS = ['错别字', '病句', '用词', '标点', '句式/表达', '逻辑', '结构', '内容', '其他'];
const LEVEL_LABEL = { error: '错误', suggestion: '建议' };

// 把当前在 #essay 中选中的文字换算成相对于全文的 start/end 字符位置
function getSelectionInEssay() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const container = $('essay');
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const frag = sel.toString();
  if (!frag) return null;
  return { start, end: start + frag.length, text: frag };
}

// “用选中文字新建批注”：先选中原文，点此按钮即可自动补齐片段与位置
$('use-sel-btn').addEventListener('click', () => {
  const s = getSelectionInEssay();
  if (!s) { alert('请先在上方作文原文中选中一段文字。'); return; }
  $('add-target').value = s.text;
  pendingSel = s;
  document.getElementById('add-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('add-sug').focus();
});

$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const target = $('add-target').value.trim();
  if (!target) { alert('请填写原文片段，或在原文中选中文字后点“用选中文字新建批注”。'); return; }
  // 优先使用用户在原文中精确选中的位置，避免同一片段多次出现时串位
  let pos, end;
  if (pendingSel && pendingSel.text === target && text.slice(pendingSel.start, pendingSel.end) === target) {
    pos = pendingSel.start; end = pendingSel.end;
  } else {
    pos = text.indexOf(target);
    if (pos < 0) { alert('在原文中未找到该片段，请确认文字完全一致。'); return; }
    end = pos + target.length;
  }
  comments.push({
    id: 'comment_' + Date.now(),
    target_text: target, start: pos, end,
    type: $('add-type').value, level: $('add-level').value,
    suggestion: $('add-sug').value, replacement: $('add-rep').value,
    explanation: $('add-exp').value, confirmed: false,
  });
  pendingSel = null;
  e.target.reset();
  renderAll();
  saveLocal();
});

// ---------- 生成分享链接 / 预览 / 备份 ----------
async function buildShareUrl(payload) {
  const base = location.href.replace(/teacher\.html(\?.*)?(#.*)?$/, '');
  return base + 'share.html#s=' + await encodeShare(payload);
}

function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(() => alert('已复制链接'), () => fallbackCopy(t));
  } else fallbackCopy(t);
}
function fallbackCopy(t) {
  const ta = document.createElement('textarea');
  ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); alert('已复制链接'); }
  catch (e) { alert('复制失败，请手动复制上方文本框里的链接。'); }
  document.body.removeChild(ta);
}

function downloadBackup(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '作文批注备份.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

$('share-btn').addEventListener('click', async () => {
  const payload = { text, overall: collectOverall(), comments };
  saveLocal(); // 同时存草稿，刷新后可恢复
  const url = await buildShareUrl(payload);
  $('share-result').innerHTML =
    '<p>分享链接已生成（数据内嵌在链接中，无需服务器）：</p>' +
    '<textarea id="share-url" class="linkbox" readonly rows="5">' + escapeHtml(url) + '</textarea>' +
    '<div class="share-actions">' +
      '<button id="copy-btn" class="primary">复制链接</button>' +
      '<button id="open-btn" type="button">打开学生预览（新标签页）</button>' +
      '<button id="dl-btn" type="button">下载备份(.json)</button>' +
    '</div>' +
    '<p class="hint">把链接发给学生，学生打开即可查看（只读）。建议用“复制链接”按钮复制；也可直接“打开学生预览”自检。链接较长属正常。</p>';
  $('copy-btn').addEventListener('click', () => copyText(url));
  $('open-btn').addEventListener('click', () => window.open(url, '_blank'));
  $('dl-btn').addEventListener('click', () => downloadBackup(payload));
});

// ---------- 恢复：从分享链接 / 备份文件 ----------
$('import-link-btn').addEventListener('click', () => {
  const v = prompt('粘贴分享链接（以 share.html#s= 开头）：');
  if (!v) return;
  const m = v.match(/[#&]s=([^&]+)/);
  if (!m) { alert('链接格式不正确，未找到 #s= 数据。'); return; }
  let d;
  try { d = decodeShare(m[1]); } catch (e) { alert('链接解析失败（数据可能已损坏）。'); return; }
  if (!d || !d.text) { alert('链接内容为空。'); return; }
  if (d.text !== text) {
    if (!confirm('该链接里的作文与当前页面作文不一致，仍要载入其中的批注吗？（位置可能错位）')) return;
  }
  comments = Array.isArray(d.comments) ? d.comments : [];
  overall = d.overall || overall;
  selectedId = null;
  renderAll();
  saveLocal();
  alert('已从分享链接恢复批注。');
});

$('import-json-btn').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', () => {
  const f = $('file-input').files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !d.text) { alert('备份文件格式不正确。'); return; }
      if (d.text !== text && !confirm('备份里的作文与当前页面不一致，仍要载入批注吗？')) return;
      comments = Array.isArray(d.comments) ? d.comments : [];
      overall = d.overall || overall;
      selectedId = null;
      renderAll();
      saveLocal();
      alert('已导入备份。');
    } catch (e) { alert('导入失败：' + e.message); }
  };
  r.readAsText(f);
  $('file-input').value = '';
});

$('clear-btn').addEventListener('click', () => {
  if (!confirm('确定清除本浏览器保存的批改草稿？（不影响已生成的分享链接）')) return;
  localStorage.removeItem(STORE_KEY);
  alert('已清除本地草稿。');
});

if (restored) $('restore-note').classList.remove('hidden');

renderAll();
