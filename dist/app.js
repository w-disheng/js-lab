import { lessons, groups } from './lessons.js';
import { STORAGE_KEY, emptyState, sanitizeState, scheduleReview, reviewDue, stats, exerciseSource, escapeHTML as esc } from './core.js';
import { frameDocument, workerSource } from './sandbox.js';

const $ = selector => document.querySelector(selector);
const ids = lessons.map(l => l.id);
let state = emptyState();
let storageProblem = '';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) state = sanitizeState(JSON.parse(saved), ids);
} catch { storageProblem = '记录未能读取；请导出当前记录备份。'; }
let initialHash = '';
try { initialHash = decodeURIComponent(location.hash.slice(1)); } catch { /* Ignore a malformed link. */ }
let current = lessons.find(l => l.id === initialHash) || lessons.find(l => l.id === state.current) || lessons[0];
let mode = 'learn';
let filter = 'all';
let activeRun = null;
let toastTimer;
let pendingImport;
const entry = () => state.entries[current.id] ||= {};

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}

function save(preserveTraining = true) {
  state.current = current.id;
  try {
    if (preserveTraining) {
      const latest = localStorage.getItem(STORAGE_KEY);
      if (latest) {
        const fresh = sanitizeState(JSON.parse(latest), ids);
        if (fresh.training) state.training = fresh.training;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageProblem = '';
  } catch { storageProblem = '无法保存，请导出备份（存储空间或浏览器权限受限）。'; }
  $('#save-status').textContent = storageProblem || '已保存在此浏览器';
  $('#save-status').classList.toggle('error', !!storageProblem);
  if (storageProblem) notify(storageProblem);
}

function renderNav() {
  const query = $('#search').value.toLowerCase().trim();
  let count = 0;
  $('#lessons').innerHTML = groups.map((name, group) => {
    const items = lessons.filter(l => l.group === group && `${l.zh} ${l.en} ${l.id}`.toLowerCase().includes(query) &&
      (filter === 'all' || (filter === 'new' ? !state.entries[l.id]?.pass : reviewDue(state.entries[l.id]))));
    count += items.length;
    if (!items.length) return '';
    return `<div class="nav-group"><h3>${String(group + 1).padStart(2, '0')} / ${name}</h3>${items.map(l => {
      const e = state.entries[l.id] || {};
      return `<a class="lesson-link ${l.id === current.id ? 'current' : ''}" href="#${l.id}" ${l.id === current.id ? 'aria-current="page"' : ''}><span class="number">${String(lessons.indexOf(l) + 1).padStart(2, '0')}</span><span class="nav-text"><span class="nav-zh">${esc(l.zh)}</span><span class="nav-en">${esc(l.en)}</span></span><span class="nav-status" aria-label="${e.pass ? '检查通过' : reviewDue(e) ? '待复习' : '未通过检查'}">${e.pass ? '✓' : reviewDue(e) ? '↺' : ''}</span></a>`;
    }).join('')}</div>`;
  }).join('');
  if (!count) $('#lessons').innerHTML = `<p class="empty">${filter === 'due' && !query ? '目前没有到期复习。完成一次回忆，就会为你安排下次复习。' : '没有符合条件的知识点。试试其他关键词或“全部”。'}</p>`;
}

function renderStats() {
  const s = stats(state, lessons);
  $('#progress-summary').innerHTML = `<div class="stat"><strong>${s.explained}<small>/ ${lessons.length}</small></strong><span>能解释 · 自评</span></div><div class="stat"><strong>${s.passed}<small>/ ${lessons.length}</small></strong><span>本题检查通过</span></div><div class="stat"><strong>${s.due}</strong><span>到期复习</span></div>`;
  $('#due-count').textContent = s.due;
  const practiceRecord = $('.assessment p:last-child');
  if (practiceRecord) practiceRecord.textContent = passLabel(entry());
}

function highlight(source) {
  const expression = /\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|async|await|new|class|if|else|throw|try|catch|true|false|null)\b/g;
  let last = 0;
  let result = '';
  for (const match of source.matchAll(expression)) {
    result += esc(source.slice(last, match.index));
    const type = match[0].startsWith('//') ? 'comment' : /^["'`]/.test(match[0]) ? 'string' : 'keyword';
    result += `<span class="token-${type}">${esc(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return result + esc(source.slice(last));
}

function explainCheckbox() {
  return `<label class="check-label"><input type="checkbox" data-explained ${entry().explained ? 'checked' : ''}>我能用自己的话解释（自评）</label>`;
}

function renderLesson() {
  stopRun();
  const l = current;
  const e = entry();
  $('#lesson-meta').innerHTML = `<span class="chip">${groups[l.group]}</span><span>LESSON ${String(lessons.indexOf(l) + 1).padStart(2, '0')}</span><span>·</span><span>建议 ${l.minutes} 分钟</span>`;
  $('#lesson-title').innerHTML = `${esc(l.en)} <span>${esc(l.zh)}</span>`;
  $('#lesson-intro').textContent = l.intro;
  $('#next-lesson').disabled = lessons.indexOf(l) === lessons.length - 1;
  $('#panel-learn').innerHTML = `<div class="learn-grid"><div class="explanation"><div class="section-kicker">THE IDEA <span class="line"></span><span>核心概念</span></div><p class="definition" lang="en">${esc(l.english)}</p><p class="chinese">${esc(l.chinese)}</p><div class="analogy"><h3>◌ 换个生活中的说法</h3><p>${esc(l.analogy)}</p></div><div class="work-note"><h3>↳ 真实工作里，用在哪里？</h3><p>${esc(l.work)}</p></div></div><div class="code-side"><div class="code-top"><h3>看一个小例子</h3><span>先猜结果，再运行</span></div><div class="code-box"><div class="code-box-header"><span>example.js</span><span class="dots">● ● ●</span></div><pre><code>${highlight(l.example)}</code></pre></div><div class="code-actions"><button class="button small" id="run-example">▷ 运行示例</button><a class="text-button" href="${l.reference}" target="_blank" rel="noopener noreferrer">MDN 原文 ↗</a></div><div class="output-label">OUTPUT · 输出</div><pre id="example-output" class="example-output" role="log" aria-live="polite">点击运行，观察实际结果。</pre><details class="hint" style="margin-top:12px"><summary>对照预期输出</summary><pre style="margin-top:8px">${esc(l.output)}</pre></details></div></div><div class="pitfall"><strong>△ 容易踩的坑</strong><span>${esc(l.pitfall)}</span></div><div class="learn-bottom">${explainCheckbox()}<button class="button primary" data-go="practice">理解了，动手试试 <span>→</span></button></div>`;
  $('#panel-practice').innerHTML = `<div class="practice-grid"><div class="practice-brief"><div class="section-kicker">YOUR TURN <span class="line"></span></div><h3>把概念变成一次练习</h3><p>${esc(l.prompt)}</p><ul class="check-list">${l.checks.map(([name]) => `<li>${esc(name)}</li>`).join('')}</ul><details class="hint"><summary>给我一点提示</summary><p>${esc(l.hint)}</p></details><button class="text-button" id="reveal-solution">查看参考解法</button><div id="solution" class="reference-solution" hidden><p class="small-note">已经查看参考解法。之后通过会标记为“参考后通过”，仍需要自己复述原因。</p><pre>${esc(l.solution)}</pre><button class="button small" id="use-solution">把参考解法放入编辑器</button></div><div class="debug-card"><h4>◇ AI 写完后，你来检查</h4><p>${esc(l.debug)}</p><p class="small-note">检查通过仅代表本题用例通过，不代表所有情况都正确。</p></div></div><div class="editor-panel"><div class="editor-head"><label for="code">practice.js <span class="small-note">· 草稿自动保存</span></label><button class="text-button" id="reset-code">重置题目</button></div><textarea id="code" class="code-editor" aria-label="JavaScript 代码编辑器" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" maxlength="30000"></textarea><div class="editor-toolbar"><span>⌘ / Ctrl + Enter 运行<br>支持 await · 不支持 DOM / 联网</span><button class="button primary" id="run-code">▷ 运行并检查</button></div><div class="console"><div class="console-head"><span>CONSOLE & CHECKS</span><span id="run-state">就绪</span></div><div id="console-output" role="log" aria-live="polite"><div class="console-line">运行你的代码，查看输出和检查结果。</div></div></div><div id="run-result" class="run-result" role="status">${passLabel(e)}</div></div></div>`;
  $('#code').value = e.draft ?? l.starter;
  $('#panel-recall').innerHTML = `<div class="recall-grid"><div class="recall-card"><div class="section-kicker">ACTIVE RECALL <span class="line"></span><span>先回忆，再翻答案</span></div><h3>${esc(l.question)}</h3><p>试着用 30–60 秒解释：它是什么、何时使用、容易出什么问题。中英文都可以。</p><button class="button" id="flip-card">翻看参考回答 ↻</button><div id="recall-answer" class="answer-box" hidden>${esc(l.answer)}</div><div id="review-controls" hidden><div class="review-buttons"><button class="button small" data-remembered="false">还不熟 · 明天再看</button><button class="button small primary" data-remembered="true">能回忆起来 ✓</button></div><p class="small-note" style="margin-top:10px">按 1 → 3 → 7 → 14 → 30 天复习；这是一条简单的练习节奏，不是能力评分。</p></div><p id="review-date" class="review-date">${reviewLabel(e)}</p></div><div class="notes-panel"><label for="notes">用自己的话讲一遍</label><textarea id="notes" class="notes" maxlength="10000" placeholder="它是什么？\n生活中可以怎么比喻？\n工作里什么时候用？\nAI 写完以后，我会怎样验证？"></textarea><p class="small-note" style="margin-top:7px">笔记自动保存。复述和工程判断仍需在实际讨论中验证。</p><div class="assessment">${explainCheckbox()}<p>能解释和代码检查分开记录，不会因看过答案就自动完成。</p><p>${passLabel(e)}</p></div></div></div>`;
  $('#notes').value = e.note || '';
  $('#connections').innerHTML = l.related.map(id => {
    const other = lessons.find(x => x.id === id);
    return `<a class="connection" href="#${id}"><span>${esc(other.zh)}<small>${esc(other.en)}</small></span><span>↗</span></a>`;
  }).join('');
  selectTab(mode);
  renderNav();
  renderStats();
  bindLesson();
}

function passLabel(e) {
  if (!e.pass) return '尚未通过本题检查。';
  return `✓ 本题检查通过 · ${e.pass.kind === 'assisted' ? '参考后通过' : '未打开参考解法'} · ${new Date(e.pass.at).toLocaleDateString('zh-CN')}`;
}
function reviewLabel(e) {
  if (!e.reviewAt) return '尚未安排复习。完成一次回忆后选择熟悉程度。';
  return `${reviewDue(e) ? '已到复习时间' : '下次复习'}：${new Date(e.reviewAt).toLocaleDateString('zh-CN')}`;
}

function selectTab(next) {
  if (!['learn', 'practice', 'recall'].includes(next)) return;
  mode = next;
  document.querySelectorAll('[data-tab]').forEach(button => {
    const selected = button.dataset.tab === mode;
    button.setAttribute('aria-selected', selected);
    button.tabIndex = selected ? 0 : -1;
    $(`#panel-${button.dataset.tab}`).hidden = !selected;
  });
}

function codeChanged() {
  stopRun();
  entry().draft = $('#code').value;
  entry().pass = null;
  $('#run-result').textContent = '草稿已改变，运行检查来验证这一版。';
  $('#run-result').classList.remove('error');
  save(); renderStats(); renderNav();
}

function bindLesson() {
  document.querySelectorAll('[data-explained]').forEach(box => box.addEventListener('change', () => {
    entry().explained = box.checked;
    document.querySelectorAll('[data-explained]').forEach(other => { other.checked = box.checked; });
    save(); renderStats();
  }));
  $('[data-go="practice"]').onclick = () => { selectTab('practice'); $('#code').focus(); };
  $('#run-example').onclick = () => run(false);
  $('#run-code').onclick = () => run(true);
  $('#code').addEventListener('input', codeChanged);
  $('#code').addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); run(true); }
    // Tab remains native so keyboard users can leave the editor.
  });
  $('#reset-code').onclick = () => {
    if (!confirm('把当前代码恢复为初始题目？笔记保留，已查看参考解法的标记也会保留。')) return;
    $('#code').value = current.starter;
    codeChanged();
    notify('已恢复初始题目。');
  };
  $('#reveal-solution').onclick = () => {
    entry().revealed = true;
    $('#solution').hidden = false;
    $('#reveal-solution').hidden = true;
    save();
  };
  $('#use-solution').onclick = () => {
    if ($('#code').value !== current.starter && !confirm('用参考解法替换当前草稿？')) return;
    $('#code').value = current.solution;
    codeChanged();
    $('#code').focus();
  };
  $('#notes').addEventListener('input', () => { entry().note = $('#notes').value; save(); });
  $('#flip-card').onclick = () => {
    const show = $('#recall-answer').hidden;
    $('#recall-answer').hidden = !show;
    $('#review-controls').hidden = !show;
    $('#flip-card').textContent = show ? '收起参考回答 ↻' : '翻看参考回答 ↻';
  };
  document.querySelectorAll('[data-remembered]').forEach(button => button.onclick = () => {
    Object.assign(entry(), scheduleReview(entry(), button.dataset.remembered === 'true'));
    save(); renderStats(); renderNav();
    $('#review-date').textContent = reviewLabel(entry());
    $('#review-controls').hidden = true;
    $('#recall-answer').hidden = true;
    $('#flip-card').textContent = '翻看参考回答 ↻';
    notify('已安排下次复习。');
  });
}

function stopRun() {
  if (!activeRun) return;
  clearTimeout(activeRun.watchdog);
  activeRun.frame.remove();
  activeRun = null;
  document.querySelectorAll('#run-code,#run-example').forEach(b => { b.disabled = false; });
  if ($('#run-state')) $('#run-state').textContent = '就绪';
}

function consoleLine(text, kind = '') {
  const line = document.createElement('div');
  line.className = `console-line ${kind}`;
  line.textContent = text;
  $('#console-output').append(line);
}

function run(practice) {
  stopRun();
  const source = practice ? $('#code').value : current.example;
  if (!source.trim()) { notify('先写一点代码再运行。'); return; }
  if (practice) {
    entry().draft = source;
    entry().attempted = true;
    entry().pass = null;
    save(); renderStats(); renderNav();
    $('#console-output').replaceChildren();
    $('#run-result').textContent = '正在运行…';
    $('#run-result').classList.remove('error');
    $('#run-state').textContent = '运行中';
  } else $('#example-output').textContent = '';
  $('#run-code').disabled = true;
  $('#run-example').disabled = true;
  const frame = document.createElement('iframe');
  frame.title = '隔离代码运行环境';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.srcdoc = frameDocument;
  const id = crypto.randomUUID();
  activeRun = { frame, id, practice, lessonId: current.id, expected: practice ? current.checks.length : 0, received: 0, failed: 0, logs: 0 };
  frame.onload = () => {
    if (activeRun?.id !== id) return;
    frame.contentWindow.postMessage({ type: 'start', id, worker: workerSource, source: practice ? exerciseSource(source, current.checks) : '"use strict";\n' + source }, '*');
  };
  $('#runner-host').append(frame);
  // Parent-side deadline also handles a frame/worker that cannot initialize.
  activeRun.watchdog = setTimeout(() => {
    if (activeRun?.id !== id) return;
    finishRun(false, '运行超时或执行环境不可用。请检查代码后重试。');
  }, 4500);
}

function finishRun(ok, message) {
  if (!activeRun) return;
  const { practice, logs } = activeRun;
  if (practice) {
    if (ok) entry().pass = { at: Date.now(), kind: entry().revealed ? 'assisted' : 'independent' };
    $('#run-result').textContent = ok ? passLabel(entry()) : message;
    $('#run-result').classList.toggle('error', !ok);
    save(); renderStats(); renderNav();
  } else if (!ok) $('#example-output').textContent += '\n' + message;
  else if (!logs) $('#example-output').textContent = '执行完成，没有 console 输出。';
  stopRun();
}

window.addEventListener('message', event => {
  const r = activeRun;
  if (!r || event.source !== r.frame.contentWindow || event.data?.channel !== 'js-lab' || event.data.id !== r.id) return;
  const data = event.data;
  if (data.type === 'log') {
    if (r.logs++ >= 81) return;
    const text = String(data.text).slice(0, 4000);
    if (r.practice) consoleLine(text);
    else $('#example-output').textContent += (r.logs > 1 ? '\n' : '') + text;
  } else if (data.type === 'check' && r.practice) {
    if (r.received >= r.expected) return;
    r.received++;
    if (!data.ok) r.failed++;
    consoleLine(`${data.ok ? '✓' : '✕'} ${String(data.name).slice(0, 200)}${data.ok ? '' : '\n  ' + String(data.text).slice(0, 1500)}`, data.ok ? 'success' : 'error');
  } else if (data.type === 'error') {
    r.failed++;
    const text = String(data.text).slice(0, 2000);
    if (r.practice) consoleLine(text, 'error');
    else $('#example-output').textContent += '\n' + text;
  } else if (data.type === 'timeout') {
    finishRun(false, String(data.text));
  } else if (data.type === 'done') {
    const ok = !data.failed && !r.failed && (!r.practice || (r.received === r.expected && data.passed === r.expected && data.count === r.expected));
    finishRun(ok, r.received < r.expected ? '代码没有完成全部检查。检查语法、运行错误或过早的 return。' : '还有检查未通过。先读失败提示，再修改一个地方。');
  }
});

document.querySelectorAll('[data-tab]').forEach((button, index, buttons) => {
  button.onclick = () => selectTab(button.dataset.tab);
  button.onkeydown = e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (index + (e.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    selectTab(buttons[next].dataset.tab); buttons[next].focus();
  };
});
$('#search').oninput = renderNav;
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
  renderNav();
});
$('#next-lesson').onclick = () => { const next = lessons[lessons.indexOf(current) + 1]; if (next) location.hash = next.id; };
window.addEventListener('hashchange', () => {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) return;
  current = lesson; mode = 'learn';
  renderLesson(); save(); closeMenu();
});
function closeMenu() { $('.sidebar').classList.remove('open'); $('#menu').setAttribute('aria-expanded', 'false'); }
$('#menu').onclick = () => { const open = $('.sidebar').classList.toggle('open'); $('#menu').setAttribute('aria-expanded', open); };
$('#lessons').addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
$('#main').addEventListener('click', closeMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
$('#backup').onclick = () => {
  save();
  $('#backup-text').value = JSON.stringify(state, null, 2);
  $('#data-dialog').showModal();
};
$('#about').onclick = () => $('#about-dialog').showModal();
document.querySelectorAll('.close-dialog').forEach(button => { button.onclick = () => button.closest('dialog').close(); });
$('#export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `js-practice-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('已请求下载备份；若浏览器未下载，可复制备份文本。');
};
function previewImport(text) {
  pendingImport = null; $('#confirm-import').hidden = true;
  try {
    if (text.length > 1500000) throw new Error('备份过大，最多 1.5 MB。');
    pendingImport = sanitizeState(JSON.parse(text), ids);
    const count = Object.keys(pendingImport.entries).length;
    if (!count && !pendingImport.training) throw new Error('备份中没有可导入的记录。');
    $('#import-message').textContent = `找到 ${count} 个知识点的记录${pendingImport.training ? '及面试训练记录' : ''}。确认后会覆盖对应草稿、笔记与进度${pendingImport.training ? '，包括完整的训练任务、回答和复习记录' : '；现有面试训练记录保留'}。`;
    $('#confirm-import').hidden = false;
  } catch (error) { $('#import-message').textContent = `无法导入：${error.message}`; }
}
$('#preview-import').onclick = () => previewImport($('#restore-text').value);
$('#import-file').onchange = async event => {
  const file = event.target.files[0];
  pendingImport = null; $('#confirm-import').hidden = true;
  if (!file) return;
  try {
    if (file.size > 1500000) throw new Error('文件过大，请使用本应用导出的备份（最多 1.5 MB）。');
    previewImport(await file.text());
  } catch (error) { $('#import-message').textContent = error.message; }
  event.target.value = '';
};
$('#confirm-import').onclick = () => {
  if (!pendingImport) return;
  stopRun();
  Object.assign(state.entries, pendingImport.entries);
  const includesTraining = !!pendingImport.training;
  if (pendingImport.training) state.training = pendingImport.training;
  pendingImport = null;
  $('#confirm-import').hidden = true;
  $('#import-message').textContent = '导入完成。';
  $('#backup-text').value = JSON.stringify(state, null, 2);
  save(!includesTraining); renderLesson(); notify('学习记录已恢复。');
};
window.addEventListener('pagehide', stopRun);
renderLesson();
if (storageProblem) { $('#save-status').textContent = storageProblem; $('#save-status').classList.add('error'); notify(storageProblem); }
