// 共用：根据批注的 start/end 字符位置，将原文切段并高亮
// 支持同一片段多次出现（用位置而非仅靠文字匹配），也支持批注区间重叠。

function getRanges(comments) {
  return (comments || [])
    .filter((c) => typeof c.start === 'number' && typeof c.end === 'number' && c.start < c.end)
    .map((c) => ({ start: c.start, end: c.end, id: c.id }))
    .sort((a, b) => a.start - b.start);
}

function buildSegments(text, comments) {
  const ranges = getRanges(comments);
  if (ranges.length === 0) return [{ start: 0, end: text.length, text: text, ids: [] }];
  const points = new Set([0, text.length]);
  ranges.forEach((r) => { points.add(r.start); points.add(r.end); });
  const sorted = Array.from(points).sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i], e = sorted[i + 1];
    if (e <= s) continue;
    const ids = ranges.filter((r) => r.start <= s && r.end >= e).map((r) => r.id);
    segs.push({ start: s, end: e, text: text.slice(s, e), ids });
  }
  return segs;
}

// ---------- 分享数据编/解码（自包含 URL，无需后端存储） ----------
function encodeShare(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return encodeURIComponent(btoa(bin));
}
function decodeShare(str) {
  const bin = atob(decodeURIComponent(str));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// container: DOM 元素；onSelect(ids): 点击高亮时回调；selectedId: 当前选中批注 id（用于高亮态）
function renderHighlights(container, text, comments, onSelect, selectedId) {
  container.innerHTML = '';
  const segs = buildSegments(text || '', comments);
  segs.forEach((seg) => {
    if (seg.ids.length === 0) {
      container.appendChild(document.createTextNode(seg.text));
    } else {
      const span = document.createElement('span');
      const isSel = selectedId && seg.ids.includes(selectedId);
      span.className = 'hl' + (isSel ? ' hl-sel' : '');
      span.textContent = seg.text;
      span.dataset.ids = seg.ids.join(',');
      span.addEventListener('click', () => onSelect(seg.ids));
      container.appendChild(span);
    }
  });
}

// 同时支持 Node 环境（仅用于自动化测试，浏览器中忽略）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildSegments, getRanges, encodeShare, decodeShare };
}
