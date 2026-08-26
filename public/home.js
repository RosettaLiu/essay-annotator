const ta = document.getElementById('essay');
const btn = document.getElementById('start');
const msg = document.getElementById('msg');

btn.addEventListener('click', () => {
  const text = ta.value;
  if (!text.trim()) { msg.textContent = '请先粘贴作文内容。'; return; }
  // 手动批注模式：仅把作文带入教师页，不调用 AI
  localStorage.setItem('essayText', text);
  location.href = 'teacher.html';
});
