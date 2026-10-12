import {allGates, newProgress, gateRecord, completedCount, isUnlocked, parseImport, loadProgress, saveProgress, MAX_IMPORT_BYTES} from './state.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const button = (label, action, extra = '', style = 'secondary') => `<button type="button" class="button ${style}" data-action="${action}" ${extra}>${label}</button>`;
let config, course, labs, progress, year, presenter = false, saveTimer, storage, storageWarning = '';
const taskDrafts = new Map();
const typeNames = {concept: '概念示意', synthetic: '合成教學情境', source: '來源摘要'};

function announce(text, error = false) {
  const node = $('#status'); node.textContent = storageWarning && !text.includes(storageWarning) ? `${text} ${storageWarning}` : text; node.classList.toggle('error', error || !!storageWarning);
}
function persist() {
  const warning = saveProgress(storage, progress, config, course); storageWarning = warning;
  if (warning) announce(warning, true);
  updateHeader();
}
function updateHeader() {
  const count = completedCount(progress, course);
  $('#progress-text').textContent = `${count} / 24 關`;
  $('#progress-bar').value = count;
  $('#course-title').textContent = `${year}年｜${config.title}`;
  $('#footer-year').textContent = `${year}年・${config.teacher}`;
  $('#mode-toggle').textContent = presenter ? '返回學生模式' : '教師投影模式';
  $('#mode-toggle').setAttribute('aria-pressed', String(presenter));
  document.body.classList.toggle('presenter', presenter);
}
function navigate(route) {
  if (location.hash === `#${route}`) render(); else location.hash = route;
  document.body.classList.remove('menu-open'); $('#menu-toggle').setAttribute('aria-expanded', 'false');
}
function nextGate() { return allGates(course).find(gate => !progress.gates[gate.id]?.completed) || allGates(course)[0]; }
function currentGate() { return allGates(course).find(gate => gate.id === location.hash.slice(6)); }
function findLesson(gate) { return course.lessons.find(lesson => lesson.gates.some(item => item.id === gate.id)); }
function sourceHTML(gate) {
  const sources = gate.sourceIds.map(id => course.sources.find(source => source.id === id)).filter(Boolean);
  return `<aside class="source-note"><span class="badge">${esc(typeNames[gate.evidence.type] || '教學情境')}</span><p>${esc(gate.evidence.locator)}</p>${sources.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>`).join('<br>')}</aside>`;
}
function renderCourseVideo() {
  const video = config.introVideo;
  if (!video) return '';
  return `<section class="panel course-video no-print" aria-labelledby="course-video-title"><div class="course-video-heading"><div><p class="eyebrow">出發前，先認識這趟旅程</p><h2 id="course-video-title">${esc(video.title)}</h2></div><span class="pill">90秒・中文字幕</span></div><p id="course-video-description">台科大「運動科學與身體活動研究法」碩博士班課程，採PBL問題導向學習，由趙恩擔任業界師資協同實作四堂課。</p><video id="course-intro-video" controls playsinline preload="none" poster="${esc(video.poster)}" aria-labelledby="course-video-title" aria-describedby="course-video-description" tabindex="0"><source src="${esc(video.src)}" type="video/mp4">您的瀏覽器不支援影片播放，請使用下方連結下載影片。</video><p id="course-video-error" class="feedback error" hidden role="status">影片暫時無法載入，請重新整理，或下載影片後播放。也可以閱讀下方文字稿。</p><div class="course-video-tools"><p class="course-video-note">按播放即可觀看，可使用播放器控制音量、進度與全螢幕。影片已附中文字幕；觀看不影響闖關進度。</p><a class="button secondary" href="${esc(video.src)}" download="運動科學研究探險隊_90秒課程介紹_v2.mp4">下載影片（約16MB）</a></div><details class="course-video-transcript"><summary>閱讀影片文字稿</summary>${video.transcript.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}<a href="${esc(video.transcriptUrl)}" download>下載旁白文字稿</a></details></section>`;
}
function renderMap() {
  document.body.dataset.world = 'community';
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">恩恩老師 × 運動科學研究小隊</p><h1>跟著證據，<br>走進運動科學研究。</h1><p>四堂課，兩個研究世界。從看不見的動機，到能公平比較的量尺，一步步完成自己的研究筆記。</p><div class="actions">${button(completedCount(progress, course) ? '繼續我的旅程 →' : '開始第一關 →', 'go-gate', `data-id="${nextGate().id}"`, 'primary')}${button('查看四堂任務', 'scroll-lessons')}</div><p class="lesson-meta">免登入・進度存於此瀏覽器・每堂180分鐘</p></div><div class="hero-art"><img src="assets/community.webp" alt="有步道與資料工作桌的社區運動科學研究站" class="hero-world"><img src="assets/teacher.webp" alt="恩恩老師3D chibi引導角色" class="hero-teacher"><span class="hero-stamp">研究日誌<br><strong>${String(completedCount(progress, course)).padStart(2,'0')} / 24</strong></span></div></section>
  ${renderCourseVideo()}
  <section id="lessons"><div class="lesson-heading"><div><p class="eyebrow">選擇研究旅程</p><h2>四堂課，循序解開線索</h2></div><span class="pill">${presenter ? '教師可直接進入任一關' : '完成上一關，解鎖下一關'}</span></div><div class="world-map">${course.lessons.map((lesson, index) => {
    const count = lesson.gates.filter(gate => progress.gates[gate.id]?.completed).length;
    const date = config.dates?.[String(year)]?.[index];
    return `<article class="lesson-card"><div class="lesson-cover"><img src="assets/${lesson.world}.webp" alt="${lesson.world === 'community' ? '社區運動科學研究站' : '雪梨運動校園'}" loading="lazy"><span class="lesson-number">0${index+1}</span></div><div class="lesson-body"><p class="eyebrow">${lesson.world === 'community' ? '社區運動科學研究站' : '雪梨運動校園'} · ${count}/6 關</p><h3>${esc(lesson.title)}</h3><p>${esc(lesson.subtitle)}</p><p class="lesson-meta">${date ? esc(date) : '上課日期由教師另行通知'} · 180分鐘</p><div class="gate-map">${lesson.gates.map((gate, gateIndex) => {const done = progress.gates[gate.id]?.completed, unlocked = isUnlocked(gate.id, progress, course, presenter); return `<button type="button" class="gate-node ${done ? 'completed' : unlocked ? 'current' : 'locked'}" data-action="go-gate" data-id="${gate.id}" aria-disabled="${!unlocked}" aria-label="第${index+1}堂第${gateIndex+1}關：${esc(gate.title)}，${done ? '已完成' : unlocked ? '可進入' : '尚未解鎖'}"><span aria-hidden="true">${done ? '✓' : !unlocked ? '◇' : gateIndex+1}</span><small>${esc(gate.title)}</small></button>`;}).join('')}</div>${button('本堂學習目標與作業', 'go-lesson', `data-id="${lesson.id}"`, 'ghost')}</div></article>`;
  }).join('')}</div></section>`;
}
function renderLesson(lesson) {
  document.body.dataset.world = lesson.world;
  return `<div class="lesson-heading"><div><p class="eyebrow">課堂任務</p><h1>${esc(lesson.title)}</h1></div>${button('返回地圖', 'go-map')}</div><section class="panel"><p>${esc(lesson.intro)}</p><h2>完成這堂課，你能……</h2><ul class="learning-list">${lesson.objectives.map(item => `<li>${esc(item)}</li>`).join('')}</ul><div class="actions">${button('進入本堂第一關', 'go-gate', `data-id="${lesson.gates[0].id}"`, 'primary')}</div></section><section class="panel"><p class="eyebrow">獨立練習與課後作業</p><h2>${esc(lesson.assignment.title)}</h2><ol>${lesson.assignment.instructions.map(item => `<li>${esc(item)}</li>`).join('')}</ol><h3>繳交內容</h3><ul>${lesson.assignment.deliverables.map(item => `<li>${esc(item)}</li>`).join('')}</ul><table class="data-table rubric"><caption>教師評閱規準</caption><thead><tr><th>評量項目</th><th>配分</th></tr></thead><tbody>${lesson.assignment.rubric.map(row => `<tr><td>${esc(row.criterion)}</td><td>${row.points}</td></tr>`).join('')}</tbody></table><label class="notebook">作業草稿（保存在本機，可隨成果匯出）<textarea data-assignment="${lesson.id}" rows="7" maxlength="12000" placeholder="寫下研究問題、分析選擇、證據與限制……">${esc(progress.assignments[lesson.id] || '')}</textarea></label><p>請依任課教師指定方式繳交；網站不會自動送出作業。</p></section>`;
}
function taskValues(gate) {
  if (taskDrafts.has(gate.id)) return taskDrafts.get(gate.id);
  const record = progress.gates[gate.id];
  const defaults = gate.task.type === 'order' ? gate.task.items.map((_, i) => i) : gate.task.type === 'match' ? gate.task.items.map(() => -1) : [];
  const values = record?.task?.values?.length === defaults.length ? [...record.task.values] : defaults;
  taskDrafts.set(gate.id, values); return values;
}
function taskHTML(gate) {
  const task = gate.task, values = taskValues(gate);
  if (task.type === 'match') return `<div>${task.items.map((item, index) => `<label class="task-row"><span>${esc(item.label)}</span><select class="task-choice" data-match="${index}"><option value="-1">請選擇</option>${item.choices.map((choice, choiceIndex) => `<option value="${choiceIndex}" ${values[index] === choiceIndex ? 'selected' : ''}>${esc(choice)}</option>`).join('')}</select></label>`).join('')}${button('核對我的配對', 'check-task')}</div>`;
  if (task.type === 'order') return `<ol class="order-list">${values.map((itemIndex, position) => `<li class="order-row"><span>${position+1}. ${esc(task.items[itemIndex])}</span><div>${button('↑', 'move-order', `data-position="${position}" data-direction="-1" aria-label="將${esc(task.items[itemIndex])}上移" ${position === 0 ? 'disabled' : ''}`, 'ghost')}${button('↓', 'move-order', `data-position="${position}" data-direction="1" aria-label="將${esc(task.items[itemIndex])}下移" ${position === values.length-1 ? 'disabled' : ''}`, 'ghost')}</div></li>`).join('')}</ol>${button('核對我的順序', 'check-task')}`;
  const model = task.model;
  const isGrowth = model === 'growth', isCohort = model === 'cohort', discrete = ['growth','cohort','fit','path'].includes(model);
  const value = progress.gates[gate.id]?.task?.exploreValue ?? (discrete ? 0 : 50);
  return `<p>${esc(task.caption || '')}</p><p class="source-note">以下圖形是概念示意；調整滑桿不會估計統計模型，也不產生研究結果。</p><label class="slider-row">${isGrowth ? '時間原點（第幾次測量）' : isCohort ? '切換入學世代' : model === 'measurement' ? '指標與構念連結強度' : model === 'fit' ? '切換配適判讀情境' : '檢視測量、結構與完整模型'}<input type="range" min="0" max="${isGrowth || isCohort ? 3 : discrete ? 2 : 100}" step="${discrete ? 1 : 10}" value="${value}" data-explore="${model}"><output id="explore-value">${value}</output></label><div id="explore-plot" class="plot">${plotHTML(model, value)}</div>${button('記錄這次探索', 'check-task')}<p id="explore-instruction">請先移動滑桿，再記錄你觀察到的變化。</p>`;
}
function plotHTML(model, value) {
  if (model === 'growth') {
    const points = [0,1,2,3].map(t => `${60+t*90},${165-t*28}`).join(' ');
    return `<svg viewBox="0 0 400 220" role="img" aria-label="同一條成長軌跡，時間原點改為第${value+1}次測量"><path d="M40 20 V180 H370" fill="none" stroke="currentColor"/><polyline points="${points}" fill="none" stroke="#27634c" stroke-width="4"/>${[0,1,2,3].map(t => `<circle cx="${60+t*90}" cy="${165-t*28}" r="${t === value ? 9 : 5}" fill="${t === value ? '#b64a26' : '#27634c'}"/><text x="${52+t*90}" y="205">${t-value}</text>`).join('')}</svg><p class="plot-label">原點移到第${value+1}次測量：示意截距＝${(2+value*0.4).toFixed(1)}，斜率仍為0.4。軌跡本身沒有改變。</p>`;
  }
  if (model === 'cohort') return `<div class="cohort-grid">${[0,1,2,3].map(group => `<div class="cohort-row ${group === value ? 'active' : ''}"><strong>世代${group+1}</strong>${[0,1,2,3].map(time => `<span style="grid-column:${group*2+time+2}">${group*2+time}</span>`).join('')}</div>`).join('')}</div><p class="plot-label">示意時間點有重疊；拼接前仍需檢查測量與世代差異。此圖不是原研究資料。</p>`;
  if (model === 'fit') {
    const scenarios = [
      {title:'整體與局部證據一致',cfi:'.970',rmsea:'.045',srmr:'.040',residual:'.05',note:'整體指標與局部殘差提供支持，仍需檢查理論、識別及其他診斷。'},
      {title:'整體配適仍待改善',cfi:'.880',rmsea:'.110',srmr:'.120',residual:'.22',note:'檢查模型設定、資料與局部問題；不要只依修正指數任意刪題或加路徑。'},
      {title:'整體良好，局部仍有問題',cfi:'.970',rmsea:'.045',srmr:'.040',residual:'.38',note:'整體指標可能掩蓋特定題項的局部殘差；通過常用整體門檻不等於每一部分都正確。'}
    ];
    const scenario=scenarios[Math.min(2,Math.max(0,value))];
    return `<h3>${scenario.title}</h3><div class="fit-metrics"><span><strong>${scenario.cfi}</strong>CFI</span><span><strong>${scenario.rmsea}</strong>RMSEA</span><span><strong>${scenario.srmr}</strong>SRMR</span></div><p>某一題項配對的標準化殘差：<strong>${scenario.residual}</strong></p><p>${scenario.note}</p><p class="plot-label">數字是自編概念情境，沒有樣本與估計結果；不是原研究數值，也不是本站R實跑結果。</p>`;
  }
  if (model === 'path') {
    const level=Math.min(2,Math.max(0,value));
    return `<div class="measurement-demo ${level === 1 ? 'structure-focus' : 'measurement-focus'}"><div><strong class="latent-node">動機構念</strong><p>↓ 測量箭頭</p><div class="indicator-stack">${[1,2,3].map(i=>`<span>示意動機指標${i}</span>`).join('')}</div></div><p class="structural-arrow">→<br><span>構念間路徑</span></p><div><strong class="latent-node">活力構念</strong><p>↓ 測量箭頭</p><div class="indicator-stack">${[1,2,3].map(i=>`<span>示意活力指標${i}</span>`).join('')}</div></div></div><p>${level === 0 ? '測量部分：構念如何與可觀察指標連結，並保留各題誤差。' : level === 1 ? '結構部分：待檢驗的動機與活力關係，需在測量部分適當的基礎上解讀。' : '完整模型同時包含測量與結構部分；示意箭頭不會自行提供因果證據。'}</p><p class="plot-label">這是第5章概念的自編簡化圖；每構念三指標僅供辨識箭頭，不代表原BREQ四因素規格或2014期刊分析。</p>`;
  }
  return `<svg viewBox="0 0 400 200" role="img" aria-label="潛在構念與三個指標的示意連結，強度${value}%"><ellipse cx="75" cy="100" rx="58" ry="38" fill="#e5efdc" stroke="#27634c"/>${[35,100,165].map((y,i) => `<path d="M135 100 L280 ${y}" stroke="#27634c" stroke-width="${1+value/20}"/><rect x="282" y="${y-20}" width="96" height="40" rx="7" fill="#fbf2e3" stroke="#8d6048"/><text x="300" y="${y+6}">指標${i+1}</text>`).join('')}<text x="42" y="106">構念</text></svg><p class="plot-label">連結粗細只是概念示意；因素負荷量應由資料與模型估計。</p>`;
}
function renderGate(gate) {
  const lesson = findLesson(gate), index = lesson.gates.indexOf(gate), record = progress.gates[gate.id];
  document.body.dataset.world = lesson.world;
  if (!isUnlocked(gate.id, progress, course, presenter)) return `<section class="empty-state"><h1>這一關還在等待解鎖</h1><p>完成前面的關卡後，就能繼續旅程。</p>${button('繼續目前關卡', 'go-gate', `data-id="${nextGate().id}"`, 'primary')}${button('返回地圖', 'go-map')}</section>`;
  const done = !presenter && record?.completed;
  return `<div class="lesson-heading"><div><p class="eyebrow">${esc(lesson.title)} · 第${index+1}/6關</p><h1>${esc(gate.title)}</h1></div>${button('返回地圖', 'go-map')}</div>${presenter ? '<p class="mode-notice">教師示範中：可跳關、顯示解說；示範作答不會改變學生進度。</p>' : ''}<div class="gate-layout"><aside class="scene-panel"><img class="scene-image" src="assets/${lesson.world}.webp" alt="${lesson.world === 'community' ? '社區運動科學研究站' : '雪梨運動校園'}"><img class="character" src="assets/teacher.webp" alt="恩恩老師"><div class="dialogue"><strong>恩恩老師</strong><p>${esc(gate.story)}</p></div><div class="scene-companions"><img src="assets/${lesson.world === 'campus' ? 'student' : 'athlete'}.webp" alt="${lesson.world === 'campus' ? '學生研究夥伴' : '運動科學研究夥伴'}"><img src="assets/researcher.webp" alt="研究員夥伴"></div></aside><div><section class="panel"><p>${esc(gate.summary)}</p><ul class="learning-list">${gate.learning.map(item => `<li>${esc(item)}</li>`).join('')}</ul>${sourceHTML(gate)}</section><section class="panel task-box"><p class="eyebrow">01 · 動手探索</p><h2>${esc(gate.task.prompt)}</h2>${taskHTML(gate)}<div id="task-feedback" role="status" class="feedback" ${record?.task.done && !presenter ? '' : 'hidden'}>${record?.task.done && !presenter ? '✓ 互動任務已完成，可以作答。' : ''}</div></section><section class="panel"><p class="eyebrow">02 · 核心判斷</p><form id="quiz-form"><fieldset ${done ? 'disabled' : ''}><legend>${esc(gate.question.prompt)}</legend><div class="choice-list">${gate.question.options.map((option, optionIndex) => `<label class="choice"><input type="radio" name="answer" value="${optionIndex}" ${record?.answerIndex === optionIndex && !presenter ? 'checked' : ''}><span>${esc(option)}</span></label>`).join('')}</div></fieldset><div class="actions">${done ? '<span class="badge">✓ 已完成此關</span>' : '<button type="submit" class="button primary">提交判斷</button>'}${button('給我一個提示', 'hint', '', 'ghost')}${presenter ? button('顯示教師解說', 'explain', '', 'ghost') : ''}</div></form><div id="quiz-feedback" class="feedback ${done ? 'success' : ''}" role="status" ${done ? '' : 'hidden'}>${done ? '✓ '+esc(gate.question.explanation) : ''}</div><div id="hint-panel" class="source-note" hidden></div></section><section class="panel"><p class="eyebrow">03 · 留下研究筆記</p><label class="notebook">${esc(gate.reflection)}<textarea id="gate-note" rows="4" maxlength="6000" placeholder="用自己的話寫下證據、判斷與仍待確認的部分……" ${presenter ? 'disabled' : ''}>${esc(record?.note || '')}</textarea></label><div class="actions">${index === 5 ? button('查看本堂獨立練習', 'go-lesson', `data-id="${lesson.id}"`, 'secondary') : ''}${nextGateButton(gate)}${button('匯出我的進度', 'export', '', 'ghost')}</div></section></div></div>`;
}
function nextGateButton(gate) {
  const gates = allGates(course), next = gates[gates.indexOf(gate)+1];
  return next ? button('下一關 →', 'go-gate', `data-id="${next.id}" ${isUnlocked(next.id, progress, course, presenter) ? '' : 'disabled'}`, 'primary') : button('查看我的學習成果', 'go-report', '', 'primary');
}
function modelTable() {
  if (!labs?.models?.length) return '<p>請下載R練習，查看各模型的驗證结果。</p>';
  return `<div class="table-wrap"><table class="data-table"><caption>合成資料：預先以R／lavaan估計的結果</caption><thead><tr><th>模型</th><th>N</th><th>CFI（robust）</th><th>RMSEA（robust）</th><th>SRMR</th></tr></thead><tbody>${labs.models.map(model => `<tr><th scope="row">${esc(model.label || model.id)}</th><td>${esc(model.n)}</td><td>${fmt(model.cfi)}</td><td>${fmt(model.rmsea)}</td><td>${fmt(model.srmr)}</td></tr>`).join('')}</tbody></table></div>`;
}
function fmt(value) { return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '—'; }
function renderResources() {
  return `<div class="lesson-heading"><div><p class="eyebrow">研究工具箱</p><h1>來源、練習與方法界線</h1></div>${button('返回地圖', 'go-map')}</div><section class="resource-grid">${course.sources.map(source => `<article class="resource-card"><span class="badge">${esc(source.kind)}</span><h2>${esc(source.title)}</h2><p>${esc(Array.isArray(source.authors) ? source.authors.join('、') : source.authors)}（${source.year}）</p><a class="button secondary" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">前往正式來源 ↗</a></article>`).join('')}</section><section class="panel"><h2>R實作：合成運動與校園資料</h2><p>下面結果來自附帶腳本的實際估計。練習資料全部合成，不代表原期刊或教科書研究結果。關卡內的滑桿圖形另屬概念示意。</p><div class="actions"><a class="button primary" href="labs/README.md" target="_blank">R操作指南</a><a class="button secondary" href="labs/analysis.R" download>下載分析腳本</a><a class="button secondary" href="labs/generate_data.R" download>下載資料生成腳本</a><a class="button secondary" href="${esc(config.repository)}/archive/refs/heads/main.zip">下載完整練習包</a></div>${modelTable()}<p class="source-note">不同模型比較需使用相同資料、指標與估計方法。ΔCFI定義為受限模型減前一模型，負值表示CFI降低；判準須結合研究設計判讀。</p><details><summary>查看方法與重現範圍</summary><ul>${(labs?.notes || []).map(note => `<li>${esc(note)}</li>`).join('')}</ul></details></section><section class="panel"><h2>課堂與網站使用</h2><div class="actions"><a class="button secondary" href="docs/student-guide.md" target="_blank">學生操作指南</a><a class="button secondary" href="docs/annual-update.md" target="_blank">年度更新指南</a><a class="button secondary" href="labs/codebook.md" target="_blank">合成資料欄位說明</a></div><p>學生的筆記與進度留在自己的瀏覽器，不會自動傳給教師。若換裝置，先匯出JSON，再在相同年度與教材版本匯入。</p></section>`;
}
function renderReport() {
  return `<div class="lesson-heading no-print"><div><p class="eyebrow">我的研究日誌</p><h1>把這趟旅程帶走</h1></div><div class="actions">${button('列印／另存PDF', 'print', '', 'primary')}${button('下載JSON進度', 'export')}</div></div><article class="report-sheet"><h2>${year}年｜${esc(config.title)}學習成果</h2><p>教材版本 ${esc(course.contentVersion)} · 完成${completedCount(progress, course)}/24關</p><p>這份成果供學習反思與教師評閱；請依任課教師規定繳交。</p>${course.lessons.map(lesson => `<section><h2>${esc(lesson.title)}</h2>${lesson.gates.map(gate => {const row = progress.gates[gate.id]; return `<div class="report-gate"><h3>${esc(gate.id)} ${esc(gate.title)} · ${row?.completed ? '✓ 已完成' : '尚未完成'}</h3><p>作答：${row?.answerIndex !== null && row?.answerIndex !== undefined ? esc(gate.question.options[row.answerIndex]) : '尚未提交'} · 嘗試${row?.attempts || 0}次 · 提示${row?.hints || 0}次</p><p class="report-note">${esc(row?.note || '尚未留下研究筆記')}</p></div>`;}).join('')}<h3>獨立練習／作業草稿</h3><p class="report-note">${esc(progress.assignments[lesson.id] || '尚未填寫作業草稿')}</p></section>`).join('')}</article>`;
}
function renderSettings() {
  return `<div class="lesson-heading"><div><p class="eyebrow">旅程管理</p><h1>備份與年度進度</h1></div>${button('返回地圖', 'go-map')}</div><section class="panel"><h2>${year}年的研究日誌</h2><p>目前完成${completedCount(progress, course)}/24關。切換年度可開始另一份旅程，原年度進度仍留在瀏覽器。</p><div class="actions">${button('下載JSON備份', 'export', '', 'primary')}<label class="button secondary" for="import-file">匯入JSON進度</label><input id="import-file" type="file" accept=".json,application/json" class="visually-hidden"></div><p>匯入會取代目前年度進度；系統會先核對課程、年度、版本與關卡紀錄，檔案錯誤時保留現有進度。</p><p class="source-note">無痕模式、清除瀏覽器資料或儲存空間不足，可能無法續玩。離開前匯出備份，換裝置時使用相同教材版本。</p></section><section class="panel"><h2>重新開始本年度</h2><p>只有目前年度的本機進度會被清除。請先匯出需要保留的筆記。</p>${button('清除本年度進度', 'reset', '', 'ghost')}</section>`;
}
function render(focus = true) {
  if (!course) return;
  const route = location.hash.slice(1) || 'map'; let html;
  if (route.startsWith('gate/')) {const gate = currentGate(); html = gate ? renderGate(gate) : '<section class="empty-state"><h1>找不到這個關卡</h1><a href="#map">返回地圖</a></section>';}
  else if (route.startsWith('lesson/')) {const lesson = course.lessons.find(item => item.id === route.slice(7)); html = lesson ? renderLesson(lesson) : renderMap();}
  else html = route === 'resources' ? renderResources() : route === 'report' ? renderReport() : route === 'settings' ? renderSettings() : renderMap();
  // Stop playback when navigation, year or presentation mode replaces the home page.
  $('#course-intro-video')?.pause();
  $('#app').innerHTML = html; updateHeader();
  const video = $('#course-intro-video');
  if (video) {
    const videoError = $('#course-video-error');
    const showVideoError = () => { if (video.isConnected) videoError.hidden = false; };
    video.addEventListener('error', showVideoError, {once: true});
    video.querySelector('source').addEventListener('error', showVideoError, {once: true});
  }
  document.querySelectorAll('[data-view]').forEach(node => {const active = node.dataset.view === route; node.setAttribute('aria-current', active ? 'page' : 'false');});
  if (focus) { $('#app').focus({preventScroll: true}); window.scrollTo({top: 0, behavior: 'instant'}); }
}
function taskFeedback(text, success) { const el = $('#task-feedback'); el.hidden = false; el.className = `feedback ${success ? 'success' : 'error'}`; el.textContent = text; }
function checkTask(gate) {
  const values = taskValues(gate); let done;
  if (gate.task.type === 'match') done = gate.task.items.every((item, index) => values[index] === item.answer);
  else if (gate.task.type === 'order') done = gate.task.correctOrder.every((item, index) => values[index] === item);
  else done = $('#explore-plot')?.dataset.changed === 'true' || (!presenter && progress.gates[gate.id]?.task.done);
  taskFeedback(done ? '✓ 任務完成。請用下面的核心問題說明你的判斷。' : gate.task.type === 'explore' ? '請先移動滑桿，觀察圖形與說明如何改變。' : '還有線索未對上。參考概念說明，調整後再試一次。', done);
  if (!presenter) {const record = gateRecord(progress, gate.id); record.task.values = [...values]; record.task.done = record.task.done || !!done; persist();}
  else $('#task-feedback').dataset.done = String(!!done);
}
function exportProgress() {
  clearTimeout(saveTimer); persist();
  download(JSON.stringify(progress, null, 2), `ntust-quest-${year}-${course.contentVersion}.json`, 'application/json;charset=utf-8');
  announce('進度JSON已下載。請保留備份；換裝置可在相同年度匯入。');
}
function download(text, filename, mime) {
  const url = URL.createObjectURL(new Blob([text], {type: mime})), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function importFile(file) {
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('進度檔過大，請選擇本站匯出的JSON檔。');
    const parsed = parseImport(await file.text(), config, course, year);
    if (!window.confirm(`匯入會取代${year}年目前的本機進度。已保留需要的備份嗎？`)) return;
    progress = parsed; taskDrafts.clear(); persist(); render(); announce('進度已匯入，原有檔案仍保留在您的裝置。');
  } catch (error) { announce(`匯入失敗：${error.message} 目前進度未更動。`, true); }
}
document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]'); if (nav && course) {navigate(nav.dataset.view); return;}
  const target = event.target.closest('[data-action]'); if (!target || !course) return;
  const action = target.dataset.action, gate = currentGate();
  if (action === 'go-gate') {if (isUnlocked(target.dataset.id, progress, course, presenter)) navigate(`gate/${target.dataset.id}`); else announce('請先完成前面的關卡，再進入這一關。');}
  else if (action === 'go-map') navigate('map');
  else if (action === 'go-report') navigate('report');
  else if (action === 'go-lesson') navigate(`lesson/${target.dataset.id}`);
  else if (action === 'scroll-lessons') $('#lessons').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  else if (action === 'hint' && gate) {$('#hint-panel').hidden = false; $('#hint-panel').textContent = gate.question.hint; if (!presenter) {gateRecord(progress, gate.id).hints++; persist();}}
  else if (action === 'explain' && gate) {$('#quiz-feedback').hidden = false; $('#quiz-feedback').className = 'feedback'; $('#quiz-feedback').textContent = `教師解說：${gate.question.explanation}`;}
  else if (action === 'check-task' && gate) checkTask(gate);
  else if (action === 'move-order' && gate) {const values = taskValues(gate), position = Number(target.dataset.position), next = position + Number(target.dataset.direction); if (next >= 0 && next < values.length) {[values[position],values[next]] = [values[next],values[position]]; if (!presenter) {gateRecord(progress, gate.id).task.values = [...values]; persist();} render(false); const moved = document.querySelector(`[data-position="${next}"][data-direction="${target.dataset.direction}"]`); moved?.focus();}}
  else if (action === 'export') exportProgress();
  else if (action === 'print') window.print();
  else if (action === 'reset' && window.confirm(`清除${year}年本機進度？其他年度不會更動。`)) {progress = newProgress(config, course, year); taskDrafts.clear(); persist(); render(); announce('已重新開始本年度旅程。');}
});
document.addEventListener('input', event => {
  const node = event.target, gate = currentGate(); if (!course) return;
  if (node.matches('[data-match]') && gate) {taskValues(gate)[Number(node.dataset.match)] = Number(node.value); if (!presenter) {gateRecord(progress, gate.id).task.values = [...taskValues(gate)]; persist();}}
  if (node.matches('[data-explore]') && gate) {const value = Number(node.value); $('#explore-value').textContent = value; $('#explore-plot').innerHTML = plotHTML(node.dataset.explore, value); $('#explore-plot').dataset.changed = 'true'; if (!presenter) {gateRecord(progress, gate.id).task.exploreValue = value; persist();}}
  if (node.id === 'gate-note' && gate && !presenter) {gateRecord(progress, gate.id).note = node.value; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 350);}
  if (node.matches('[data-assignment]') && !presenter) {progress.assignments[node.dataset.assignment] = node.value; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 350);}
});
document.addEventListener('change', event => {if (event.target.id === 'import-file') importFile(event.target.files[0]);});
document.addEventListener('submit', event => {
  if (event.target.id !== 'quiz-form') return; event.preventDefault(); const gate = currentGate();
  const node = $('#quiz-feedback'); node.hidden = false;
  const taskDone = presenter ? $('#task-feedback')?.dataset.done === 'true' : progress.gates[gate.id]?.task.done;
  if (!taskDone) {node.className = 'feedback error'; node.textContent = '請先完成上方互動任務，再提交核心判斷。'; return;}
  const answer = new FormData(event.target).get('answer');
  if (answer === null) {node.className = 'feedback error'; node.textContent = '請選擇一個判斷，再提交。'; return;}
  const correct = Number(answer) === gate.question.answer;
  node.className = `feedback ${correct ? 'success' : 'error'}`;
  node.textContent = correct ? `✓ ${gate.question.explanation}` : `再想一步：${gate.question.hint}`;
  if (!presenter) {const record = gateRecord(progress, gate.id); record.attempts++; if (!record.completed) record.answerIndex = Number(answer); if (correct) record.completed = true; persist(); if (correct) {render(false); $('#quiz-feedback').scrollIntoView({block: 'nearest'}); announce('關卡完成，下一關已解鎖。');}}
});
window.addEventListener('hashchange', () => render());
window.addEventListener('pagehide', () => {if (progress) {clearTimeout(saveTimer); persist();}});

async function loadJSON(path) {const response = await fetch(path, {cache: 'no-cache'}); if (!response.ok) throw new Error(`教材讀取失敗（${response.status}）`); return response.json();}
async function boot() {
  try {
    [config, course, labs] = await Promise.all([loadJSON('data/config.json'),loadJSON('data/course.json'),loadJSON('data/lab-results.json')]);
    if (allGates(course).length !== 24 || course.lessons.length !== 4) throw new Error('教材關卡數不完整，請重新載入。');
    year = config.defaultYear;
    try {storage = window.localStorage;} catch {storage = {getItem() {throw new Error('此瀏覽器封鎖儲存');}, setItem() {throw new Error('此瀏覽器封鎖儲存');}};}
    const loaded = loadProgress(storage, config, course, year); progress = loaded.progress;
    $('#year-select').innerHTML = config.availableYears.map(value => `<option value="${value}" ${value === year ? 'selected' : ''}>${value}年</option>`).join('');
    $('#year-select').addEventListener('change', () => {clearTimeout(saveTimer); persist(); year = Number($('#year-select').value); const loaded = loadProgress(storage, config, course, year); progress = loaded.progress; taskDrafts.clear(); navigate('map'); render(); announce(loaded.warning || `已切換到${year}年，進度獨立保存。`, !!loaded.warning);});
    $('#mode-toggle').addEventListener('click', () => {presenter = !presenter; taskDrafts.clear(); render(); announce(presenter ? '教師投影模式已開啟，可直接選擇任一關示範。' : '已返回學生模式。');});
    $('#menu-toggle').addEventListener('click', () => {const open = document.body.classList.toggle('menu-open'); $('#menu-toggle').setAttribute('aria-expanded', String(open));});
    render(false); if (loaded.warning) announce(loaded.warning, true);
  } catch (error) {
    $('#app').innerHTML = `<section class="empty-state"><h1>教材尚未載入</h1><p>${esc(error.message)}</p><p>請確認網路後重新整理。本機版本請先啟動預覽服務，再使用瀏覽器開啟。</p><button type="button" class="button primary" id="retry-load">重新載入</button></section>`;
    $('#retry-load').addEventListener('click', () => location.reload()); announce('教材載入失敗，尚未改變已保存進度。', true);
  }
}
boot();
