import { lessons } from './lessons.js';
import { STORAGE_KEY, emptyState, sanitizeState, escapeHTML as esc } from './core.js';
import { emptyTraining, sanitizeTraining, initialSearch, searchStep } from './training-core.js';
import { days, dailyBlocks, questions, successSnippet } from './training-data.js';

const $ = s => document.querySelector(s);
const ids = lessons.map(l => l.id);
let root = emptyState(), writable = true, pendingImport = null;
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) root = sanitizeState(JSON.parse(saved), ids); }
catch { writable = false; }
let training = root.training || emptyTraining();
let questionIndex = 0;
let timers = [];
let runGeneration = 0;
let running = false;
let panels = [initialSearch(), initialSearch()];
const viewNames = ['today','lesson','plan','review'];
const currentView = () => viewNames.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';

function message(text) { $('#training-notice').textContent = text; $('#training-notice').hidden = !text; }
function freshRoot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? sanitizeState(JSON.parse(raw), ids) : emptyState();
}
function save() {
  root.training = training;
  if (!writable) { message('原记录无法读取，当前更改仅留在本次页面。请备份；原有存储不会被覆盖。'); return; }
  try {
    const next = freshRoot();
    next.training = sanitizeTraining(training);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); root = next;
    $('#training-save').textContent = '已保存在此浏览器';
  } catch { writable = false; message('无法保存，请导出本次记录。刷新可能丢失更改，原有存储未被覆盖。'); }
}
function stopExperiment() { runGeneration++; timers.forEach(clearTimeout); timers = []; running = false; }
function hero(eyebrow,title,subtitle) { return `<div class="training-hero"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>`; }
function section(title,body,classes='') { return `<section class="training-card ${classes}"><h2>${title}</h2>${body}</section>`; }
function render() {
  stopExperiment();
  const view = currentView();
  document.querySelectorAll('[data-view]').forEach(link => {
    if (link.dataset.view === view) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  if (view === 'today') renderToday();
  if (view === 'lesson') renderLesson();
  if (view === 'plan') renderPlan();
  if (view === 'review') renderReview();
}
function renderToday() {
  const day = days[training.day-1];
  const complete = day.tasks.filter((_,i)=>training.tasks[`${day.day}-${i}`]).length;
  $('#training-main').innerHTML = hero(`DAY ${String(day.day).padStart(2,'0')} / 21 · 4 HOURS`,day.title,'从你已有的前端经验出发。今天只推进眼前这一步。') +
    `<div class="daily-summary"><span class="chip">第 ${Math.ceil(day.day/7)} 周</span><span>已勾选 <strong id="task-count">${complete}</strong> / 5 项 · 自报完成，不代表能力通过</span><a href="#plan">切换学习日 ↗</a></div>` +
    `<div class="training-grid"><div>${section('今天的四小时',`<div class="task-list">${day.tasks.map((task,i)=>`<label class="daily-task"><input type="checkbox" data-task="${day.day}-${i}" ${training.tasks[`${day.day}-${i}`]?'checked':''}><span><strong>${esc(task)}</strong><small>${['独立编码与算法','前端机制与实现','设计与真实项目','英文表达','回忆与复盘'][i]}</small></span><em>${dailyBlocks[i]} 分钟</em></label>`).join('')}</div><p class="small-note">学习块之间另留休息时间。21 天是个人训练安排，不是已确认的 Google 面试流程。</p>`)}${section('先从一个实际问题进入',`<div class="analogy"><h3>生活里的对应关系</h3><p>${esc(day.analogy)}</p></div><p>${day.day===1?'为什么先搜 cat，再搜 car，页面却显示了 cat？今天用餐厅订单和双面板实验，看清每一次状态更新。':'先完成今天的一个短任务，再回到这里记录。后续情境课随教学逐步补充；本版完整情境课是“搜索竞态”。'}</p><div class="training-actions"><a class="button primary" href="${day.day===1?'#lesson':`./index.html#${day.lesson}`}">${day.day===1?'进入第一课 · 搜索竞态':'打开相关 JS 练习'} →</a><a class="button" href="#review">回顾我的记录</a></div>`)}</div><div>${section('第一课的验收目标',`<p>能说清楚问题，也能用代码验证。</p><ol class="training-steps"><li>理解：为什么旧结果会覆盖新结果？</li><li>判断：结果、错误和 loading 分别归谁？</li><li>实现：修改代码，让不同返回顺序都正确。</li></ol><p class="small-note">回答开放题只保存原文，不自动判断理解正确。选择题使用固定反馈；深入追问继续在聊天里进行。</p>`)}${section('用第一课把知识连起来',`<div class="knowledge-path">用户输入 → 发起请求 → 等待<br>↓<br>核对当前请求 → 更新界面</div><p class="small-note">连接到：闭包、async/await、React 状态、错误处理、测试。</p><a class="text-button" href="./index.html#closures">复习闭包 ↗</a>`)}</div></div>`;
  document.querySelectorAll('[data-task]').forEach(box=>box.onchange=()=>{
    training.tasks[box.dataset.task] = box.checked; save();
    $('#task-count').textContent = day.tasks.filter((_,i)=>training.tasks[`${day.day}-${i}`]).length;
  });
}
function renderPlan() {
  $('#training-main').innerHTML = hero('YOUR ROADMAP · 84 HOURS','三周，沿着一条主线走。','先诊断，再补缺，最后模拟。点击任意一天查看任务；不会自动标记掌握。') +
    `<div class="plan-intro">第一课已包含互动实验和代码检查。其余学习日提供任务安排与相关 JS 练习入口，完整情境课程将随着培训补充。</div>` +
    [0,1,2].map(week=>section(['01 / 恢复独立解题','02 / 连接实现、设计与验证','03 / 模拟与查漏补缺'][week],`<div class="day-grid">${days.slice(week*7,week*7+7).map(day=>`<button class="day-card ${training.day===day.day?'selected':''}" data-day="${day.day}"><span>DAY ${String(day.day).padStart(2,'0')}</span><strong>${esc(day.title)}</strong><small>${esc(day.tasks[0])}</small><em>${day.tasks.filter((_,i)=>training.tasks[`${day.day}-${i}`]).length} / 5 项自报完成</em></button>`).join('')}</div>`)).join('') +
    `<p class="small-note">依据公开 JD 设计。<a href="https://www.google.com/about/careers/applications/jobs/results/91721578139525830-software-engineer-iii-front-end" target="_blank" rel="noreferrer">前端岗位 ↗</a> · <a href="https://www.google.com/about/careers/applications/jobs/results/124713395193553606" target="_blank" rel="noreferrer">高级前端 / 全栈岗位 ↗</a>。具体面试范围与工具规则以招聘方为准。</p>`;
  document.querySelectorAll('[data-day]').forEach(button=>button.onclick=()=>{training.day=Number(button.dataset.day);save();location.hash='today';});
}
function renderLesson() {
  $('#training-main').innerHTML = hero('SCENARIO 01 · RACE CONDITION','旧订单，不能替新订单上菜。','异步请求与页面状态 · 看见问题 → 解释原因 → 动手修复 → 换个情境再试') +
    section('01 / 先把问题放回生活里',`<div class="training-grid"><div><div class="analogy"><h3>餐厅改订单</h3><p>你先点牛肉面，随后改成鸡肉面。牛肉面先做好，也不能当作最新订单送上来。旧订单做完，更不能让服务员告诉你“鸡肉面好了”。</p></div><p><strong>对应代码：</strong>每个请求保留自己的编号，服务员手中的最新订单号可以继续改变。请求返回时再比较，只有当前有效请求能更新页面。</p></div><div class="knowledge-path">输入 cat → 请求 #1<br>输入 car → 最新请求变成 #2<br><br>#1 返回：忽略它的页面更新<br>#2 返回：显示结果或错误<br><span>“最新”按发起顺序判断，不按返回顺序。</span></div></div>`) +
    section('02 / 亲眼观察两个版本',`<p>这是一场本机计时模拟，不会联网搜索。先发 #1，150 毫秒后发 #2；两个面板收到完全相同的事件。</p><form id="experiment-form"><fieldset id="experiment-settings"><legend>设置你的两次搜索</legend><div class="sim-controls"><div><label for="word-first">第一次搜索</label><input id="word-first" value="cat" required maxlength="30"><label for="delay-first">请求 #1 耗时 <output id="delay-first-label">2400 ms</output></label><input type="range" id="delay-first" min="200" max="4000" step="100" value="2400"><label><input type="checkbox" id="fail-first">让 #1 请求失败</label></div><div><label for="word-second">第二次搜索</label><input id="word-second" value="car" required maxlength="30"><label for="delay-second">请求 #2 耗时 <output id="delay-second-label">600 ms</output></label><input type="range" id="delay-second" min="200" max="4000" step="100" value="600"><label><input type="checkbox" id="fail-second">让 #2 请求失败</label></div></div></fieldset><div class="training-actions"><button type="submit" id="run-experiment" class="button primary">▶ 运行对比实验</button><button type="button" id="reset-experiment" class="button">停止并重置</button><span id="experiment-status" role="status">先猜：哪个词会留在页面上？</span></div></form><div class="sim-panels"><article class="sim-panel flawed"><span class="section-kicker">BEFORE · 没有检查编号</span><h3>谁回来，就更新谁</h3><div id="sim-naive" aria-live="polite"></div></article><article class="sim-panel fixed"><span class="section-kicker">AFTER · 只接受最新请求</span><h3>核对订单，再更新页面</h3><div id="sim-guarded" aria-live="polite"></div></article></div><ol id="event-log" class="event-log" aria-label="请求事件时间线" aria-live="polite"></ol><p class="small-note">再试一次：让 #1 比 #2 更快，观察旧请求是否提前关闭 loading。也可以让任一请求失败。新搜索采用清空旧结果的策略；保留旧内容时需要明确标记正在更新。</p>`) +
    section('03 / 把刚才的代码逐行看懂',`<details class="hint"><summary>展开：每个请求怎样拿到自己的号码？</summary><div class="code-box"><pre><code>${esc(successSnippet)}</code></pre></div><div class="walkthrough"><p><code>let latestRequestId = 0;</code> 放在函数外，每次搜索共享这份“最新订单记录”。</p><p><code>const requestId = ++latestRequestId;</code> 先把最新号加 1，再给这一次函数调用保留一个数字。新请求改成 2，不会把旧调用里的 1 也改掉。这不是仅仅因为 const：局部变量保存了当时的数字值，即使改用 let，只要不重新赋值，也仍然是 1。const 额外禁止重新赋值。</p><p><code>setLoading(true);</code> 告诉用户当前搜索还在等待。</p><p><code>const results = await searchAPI(word);</code> 这一次调用暂停等待；页面仍能响应输入，第二次搜索可以开始。</p><p><code>if (requestId !== latestRequestId) return;</code> 回来后核对订单。号码过时就结束这一次调用；它不是取消网络请求；此时旧结果已经返回，只是页面不采用。如果第二次搜索尚未发起，第一次就是当前有效请求，可以正常显示。</p><p><code>setResults(results); setLoading(false);</code> 只有有效请求才能显示结果并结束等待。仅成功路径的示例不处理失败，完整代码练习会补上 catch 和 finally。</p><p>餐厅对应：共享最新订单记录 → 每张小票自己的号码 → 等出餐 → 核对 → 上菜。</p></div></details><div class="training-actions"><a class="button primary" href="./index.html#search-race">进入代码练习 · 修改并检查 →</a><a class="text-button" href="./index.html#async">先复习 async / await ↗</a></div><p class="small-note">检查覆盖新旧成功顺序、旧失败、最新失败、loading，以及同词连续搜索。参考后通过会单独标记。React 页面还需考虑组件卸载和 Effect 清理。</p>`) +
    section('04 / 先回答，再展开解释',`<div class="question-navigation">${questions.map((q,i)=>`<button class="button small" data-question-index="${i}" aria-pressed="${i===questionIndex}">${i+1}. ${esc(q.title)}</button>`).join('')}</div><div id="question-body"></div>`) +
    `<div class="training-actions"><a class="button" href="#review">查看我的回答与复习记录 →</a><a class="text-button" href="https://react.dev/reference/react/useEffect#fetching-data-with-effects" target="_blank" rel="noreferrer">React 官方的过期响应处理说明 ↗</a></div>`;
  panels=[initialSearch(),initialSearch()]; drawPanels(); drawQuestion();
  for(const name of ['first','second']) $(`#delay-${name}`).oninput=e=>$(`#delay-${name}-label`).textContent=`${e.target.value} ms`;
  $('#experiment-form').onsubmit=e=>{e.preventDefault(); startExperiment();};
  $('#reset-experiment').onclick=()=>{stopExperiment();panels=[initialSearch(),initialSearch()];$('#experiment-settings').disabled=false;$('#run-experiment').disabled=false;$('#event-log').replaceChildren();$('#experiment-status').textContent='已重置，可以更改条件再试。';drawPanels();};
  document.querySelectorAll('[data-question-index]').forEach(b=>b.onclick=()=>{questionIndex=Number(b.dataset.questionIndex);document.querySelectorAll('[data-question-index]').forEach(x=>x.setAttribute('aria-pressed',x===b));drawQuestion();});
}
function drawPanels() {
  ['sim-naive','sim-guarded'].forEach((id,i)=>{
    const p=panels[i];
    $(`#${id}`).innerHTML=`<dl><div><dt>当前搜索</dt><dd>${esc(p.query||'尚未发起')} <small>${p.latest?`#${p.latest}`:''}</small></dd></div><div><dt>loading</dt><dd class="${p.loading?'waiting':''}">${p.loading?'true · 等待中':'false · 未在等待'}</dd></div><div><dt>结果</dt><dd>${p.result?`${esc(p.result)} 的模拟结果`:'—'}</dd></div><div><dt>错误</dt><dd class="${p.error?'error-text':''}">${esc(p.error||'—')}</dd></div></dl>`;
  });
}
function startExperiment() {
  if(running) return;
  const first=$('#word-first').value.trim(), second=$('#word-second').value.trim();
  if(!first||!second){$('#experiment-status').textContent='请填写两次搜索的内容。';return;}
  stopExperiment(); running=true;
  const generation=runGeneration, start=performance.now();
  const requests=[{id:1,word:first,delay:Number($('#delay-first').value),fail:$('#fail-first').checked},{id:2,word:second,delay:Number($('#delay-second').value),fail:$('#fail-second').checked}];
  let finished=0;
  panels=[initialSearch(),initialSearch()]; $('#event-log').replaceChildren();
  $('#experiment-settings').disabled=true;$('#run-experiment').disabled=true;$('#experiment-status').textContent='正在模拟两次搜索…';
  function deliver(event){
    if(generation!==runGeneration) return;
    const stale=event.type!=='start'&&event.id!==panels[1].latest;
    panels=panels.map((p,i)=>searchStep(p,event,i===1));drawPanels();
    const li=document.createElement('li');
    li.textContent=`${((performance.now()-start)/1000).toFixed(1)}s · #${event.id} ${event.word} ${event.type==='start'?'发起':event.type==='success'?'成功返回':'失败返回'}${stale?' → 右侧忽略旧请求的页面更新':''}`;
    $('#event-log').append(li);
  }
  function send(r){
    if(generation!==runGeneration) return;
    deliver({...r,type:'start'});
    timers.push(setTimeout(()=>{if(generation!==runGeneration)return;deliver({...r,type:r.fail?'failure':'success'});finished++;if(finished===2){running=false;$('#experiment-settings').disabled=false;$('#run-experiment').disabled=false;$('#experiment-status').textContent='实验完成。比较结果、错误与 loading，再换一个条件验证。';}},r.delay));
  }
  send(requests[0]);timers.push(setTimeout(()=>send(requests[1]),150));
}
function drawQuestion() {
  const q=questions[questionIndex], record=training.quiz[q.id];
  $('#question-body').innerHTML=`<h3>${esc(q.title)}</h3><p>${esc(q.prompt)}</p><label for="reason-answer">先写自己的理由（自动保存，不做 AI 评分）</label><textarea id="reason-answer" class="notes" maxlength="6000" placeholder="我会怎样处理？为什么？生活里可以怎么比喻？"></textarea><fieldset class="quiz-options"><legend>再选一个处理方式</legend>${q.options.map((text,i)=>`<label><input type="radio" name="quiz-choice" value="${i}" ${record?.choice===i?'checked':''}>${esc(text)}</label>`).join('')}</fieldset><button id="submit-question" class="button primary">提交选择，查看讲解</button><div id="question-feedback" role="status">${record?.submitted?feedback(q,record):''}</div>`;
  $('#reason-answer').value=training.answers[q.id]||'';
  $('#reason-answer').oninput=e=>{training.answers[q.id]=e.target.value;save();};
  document.querySelectorAll('[name="quiz-choice"]').forEach(input=>input.onchange=()=>{training.quiz[q.id]={choice:Number(input.value),submitted:false};save();$('#question-feedback').textContent='选择已改变，请重新提交。';});
  $('#submit-question').onclick=()=>{
    if(!training.quiz[q.id]){$('#question-feedback').textContent='请先选择一个处理方式。';return;}
    training.quiz[q.id].submitted=true;
    if(training.quiz[q.id].choice!==q.correct) training.reviewAt=Date.now()+86400000;
    save();$('#question-feedback').innerHTML=feedback(q,training.quiz[q.id]);
  };
}
function feedback(q,record){return `<div class="quiz-feedback ${record.choice===q.correct?'correct':'retry'}"><strong>${record.choice===q.correct?'本次选择正确':'还需要再想一步'}</strong><p>${esc(q.feedback[record.choice])}</p><p>${esc(q.reference)}</p><small>反馈来自固定选项；你的文字解释尚未评阅。选对不代表已经能独立实现。</small></div>`;}
function renderReview() {
  try { const fresh=freshRoot();root.entries=fresh.entries; } catch { /* Keep in-session evidence if reading fails. */ }
  const pass=root.entries['search-race']?.pass;
  const answered=questions.filter(q=>training.quiz[q.id]?.submitted).length;
  const correct=questions.filter(q=>training.quiz[q.id]?.submitted&&training.quiz[q.id].choice===q.correct).length;
  const due=training.reviewAt?(training.reviewAt<=Date.now()?'已到复习时间':'下次复习：'+new Date(training.reviewAt).toLocaleDateString('zh-CN')):'尚未安排复习';
  $('#training-main').innerHTML=hero('RECALL & EVIDENCE','留下自己的理解，不只留下答案。','回看思路如何改变，再用一个新情境验证。')+
    `<div class="evidence-row"><div><strong>${answered} / 3</strong><span>已提交选择</span></div><div><strong>${correct} / 3</strong><span>当前选对 · 固定反馈</span></div><div><strong>${pass?'已通过':'尚未通过'}</strong><span>代码用例 · ${pass?pass.kind==='assisted'?'参考后通过':'未打开参考解法':'待运行'}</span></div></div>`+
    section('我的解释与下一次复习',`<label class="check-label"><input id="training-explained" type="checkbox" ${training.explained?'checked':''}>我能用自己的话解释（自评，不代表代码通过）</label><label for="training-note">用自己的话总结，或者记录还不确定的地方</label><textarea id="training-note" class="notes" maxlength="10000" placeholder="旧响应应该被忽略，因为…\n餐厅里可以比作…\n我还需要验证…"></textarea><p id="next-review">${due}</p><div class="training-actions"><button id="review-tomorrow" class="button">还不熟 · 明天再练</button><button id="review-three" class="button">能复述 · 3 天后再练</button><a href="#lesson" class="button primary">重新进入情境实验 →</a></div>`)+
    section('我的三道情境题',questions.map((q,i)=>{const r=training.quiz[q.id];return `<article class="review-question"><h3>${esc(q.title)}</h3><p class="saved-answer">${esc(training.answers[q.id]||'还没有写下理由。')}</p><p class="small-note">${!r?.submitted?'待提交选择':r.choice===q.correct?'当前选择正确；文字理由待讨论':'当前选择需要复习'}</p><button class="text-button" data-review-question="${i}">重新练这一题 →</button></article>`;}).join(''))+
    section('聊天里的起点 · 历史记录',`<details class="hint"><summary>展开：我们已经讨论过什么？</summary><p><strong>你的第一反应：</strong>“make sure 缓存没有覆盖”。讨论后区分了缓存与异步响应覆盖。</p><p><strong>在编号提示之后：</strong>“先确认用户的搜索编号有没有更加新的。”这是提示后说明了判断规则，还没有验证独立实现。</p><p><strong>你的体验考虑：</strong>不想让用户看到空白而重复点击，提出 loading。我们进一步区分了“清楚说明等待”与“显示不匹配的旧结果”。</p><p class="small-note">以上是本次教学已有对话的摘要，不是软件自动评估，也不会随着点击完成而变成“已掌握”。新的文字回答仍需要在聊天里讨论。</p></details>`);
  $('#training-note').value=training.note;
  $('#training-note').oninput=e=>{training.note=e.target.value;save();};
  $('#training-explained').onchange=e=>{training.explained=e.target.checked;save();};
  const schedule=n=>{training.reviewAt=Date.now()+n*86400000;save();$('#next-review').textContent='下次复习：'+new Date(training.reviewAt).toLocaleDateString('zh-CN')+'（打开本页查看，不发送通知）';};
  $('#review-tomorrow').onclick=()=>schedule(1);$('#review-three').onclick=()=>schedule(3);
  document.querySelectorAll('[data-review-question]').forEach(b=>b.onclick=()=>{questionIndex=Number(b.dataset.reviewQuestion);location.hash='lesson';});
}
function backupData(){
  if(writable){try {root=freshRoot();} catch { /* Keep in-session backup. */ }}
  root.training=training;return JSON.stringify(root,null,2);
}
$('#training-backup').onclick=()=>{pendingImport=null;$('#training-confirm-import').hidden=true;$('#training-import-status').textContent='';$('#training-backup-text').value=backupData();$('#training-data').showModal();};
$('#close-training-data').onclick=()=>$('#training-data').close();
$('#training-export').onclick=()=>{
  const url=URL.createObjectURL(new Blob([backupData()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='js-training-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('#training-import-status').textContent='已请求下载；也可复制上方备份文本。';
};
$('#training-import-text').oninput=()=>{pendingImport=null;$('#training-confirm-import').hidden=true;};
$('#training-preview-import').onclick=()=>{
  pendingImport=null;$('#training-confirm-import').hidden=true;
  try{const text=$('#training-import-text').value;if(text.length>1500000)throw new Error('备份过大。');const parsed=sanitizeState(JSON.parse(text),ids);const count=Object.keys(parsed.entries).length;if(!parsed.training&&!count)throw new Error('备份没有可恢复记录。');pendingImport=parsed;$('#training-import-status').textContent=`将覆盖 ${count} 个知识点记录${parsed.training?'及完整的 21 天任务、回答和复习记录':'；备份不含训练记录，现有训练记录将保留'}。确认前不会修改。`;$('#training-confirm-import').hidden=false;}catch(e){$('#training-import-status').textContent='无法恢复：'+e.message;}
};
$('#training-confirm-import').onclick=()=>{
  if(!pendingImport)return;
  let next=root;
  if(writable){try {next=freshRoot();}catch{$('#training-import-status').textContent='现有记录无法读取，恢复已停止。请先备份当前内容。';return;}}
  Object.assign(next.entries,pendingImport.entries);if(pendingImport.training)training=pendingImport.training;next.training=training;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));root=next;writable=true;pendingImport=null;$('#training-confirm-import').hidden=true;$('#training-import-status').textContent='恢复完成。';$('#training-backup-text').value=backupData();message('');render();}catch{$('#training-import-status').textContent='未能保存恢复结果，请检查浏览器存储。';}
};
window.addEventListener('hashchange',()=>{if(location.hash!=='#training-main')render();$('#training-main').focus();});
window.addEventListener('pagehide',stopExperiment);
render();if(!writable)message('原记录无法读取。当前修改仅保留在本次页面，原有存储不会被覆盖；请先备份。');
