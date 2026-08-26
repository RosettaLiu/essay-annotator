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
// 采用 gzip 压缩后再 base64，链接体积约为原文的 1/3~1/4，
// 大幅降低长链接在微信/跨设备复制时被截断或改坏的概率。
// 编码结果以 'z' 为前缀；旧版未压缩链接（无前缀）仍可正常解码。

function bytesToB64(bytes) {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function gzipBytes(bytes) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const ab = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(ab);
}
async function gunzipBytes(bytes) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const ab = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(ab);
}

async function encodeShare(obj) {
  const json = JSON.stringify(obj);
  const raw = new TextEncoder().encode(json);
  const gz = await gzipBytes(raw);
  return encodeURIComponent('z' + bytesToB64(gz));
}
async function decodeShare(enc) {
  const str = decodeURIComponent(enc);
  if (str[0] === 'z') {
    const raw = await gunzipBytes(b64ToBytes(str.slice(1)));
    return JSON.parse(new TextDecoder().decode(raw));
  }
  // 兼容旧版未压缩链接
  const bin = atob(str);
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
