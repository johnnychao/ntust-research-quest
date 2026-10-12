import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Uses an already installed runtime; no browser or dependency downloads.
const require = createRequire(import.meta.url);
const home = process.env.USERPROFILE || os.homedir();
const runtime = process.env.PLAYWRIGHT_MODULE || path.join(home, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {chromium} = require(runtime);
const base = process.argv[2] || 'http://127.0.0.1:8765/';
const out = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'ntust-browser-qa'));
await mkdir(out, {recursive:true});
const course = await (await fetch(new URL('data/course.json', base))).json();
const config = await (await fetch(new URL('data/config.json', base))).json();
const gates = course.lessons.flatMap(lesson => lesson.gates);
const key = `${config.courseId}:${course.contentVersion}:${config.defaultYear}`;
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
const results = [], errors = [], networkFailures = [], expectedDiagnostics = [], privateRequests = [];
let intentionalLoadFailure = false;
let context, page;
function observe(p) {
  p.on('request', r => {if(/teacher-course|teacher-timer|teacher\.js|180分鐘完整講稿/.test(r.url())) privateRequests.push(r.url());});
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => {if(m.type()==='error') (intentionalLoadFailure ? expectedDiagnostics : errors).push(m.text());});
  p.on('response', r => {if(r.status() >= 400) networkFailures.push(`${r.status()} ${r.url()}`);});
}
async function check(name, fn) {
  try {await fn(); results.push({name,status:'pass'}); console.log(`PASS ${name}`);}
  catch(e) {results.push({name,status:'fail',error:e.stack}); console.error(`FAIL ${name}: ${e.message}`); throw e;}
}
async function ready(p) {await p.locator('#course-title').filter({hasText:`${config.defaultYear}年`}).waitFor(); await p.locator('.world-map, .gate-layout, .empty-state h1').first().waitFor();}
async function go(p, route) {await p.evaluate(r => {location.hash = r;}, route); await p.waitForFunction(r => location.hash === `#${r}`, route); await p.waitForTimeout(70);}
async function saved(p) {return p.evaluate(k => JSON.parse(localStorage.getItem(k)), key);}
function stable(value) {const copy = structuredClone(value); delete copy.updatedAt; return copy;}
async function solveTask(p, gate) {
  if(gate.task.type === 'match') {
    for(let i=0;i<gate.task.items.length;i++) await p.locator(`[data-match="${i}"]`).selectOption(String(gate.task.items[i].answer));
  } else if(gate.task.type === 'order') {
    let order = gate.task.items.map((_,i)=>i);
    for(let desired=0;desired<order.length;desired++) {
      let at = order.indexOf(gate.task.correctOrder[desired]);
      while(at>desired) {await p.locator(`[data-action="move-order"][data-position="${at}"][data-direction="-1"]`).click(); [order[at-1],order[at]]=[order[at],order[at-1]]; at--;}
    }
    const labels = await p.locator('.order-row > span').allTextContents();
    assert.deepEqual(labels, gate.task.correctOrder.map((idx,i)=>`${i+1}. ${gate.task.items[idx]}`));
  } else {
    const slider = p.locator('[data-explore]'); await slider.focus();
    const atMax = await slider.evaluate(el=>Number(el.value)>=Number(el.max));
    await slider.press(atMax ? 'ArrowLeft' : 'ArrowRight');
    assert.equal(await p.locator('#explore-plot').getAttribute('data-changed'),'true');
  }
  await p.locator('[data-action="check-task"]').click();
  assert.match(await p.locator('#task-feedback').innerText(), /任務完成|已完成/);
}
async function solve(p, gate) {
  await solveTask(p,gate);
  await p.locator(`input[name="answer"][value="${gate.question.answer}"]`).check();
  await p.locator('#quiz-form button[type="submit"]').click();
  await p.waitForFunction(id => !!document.querySelector('#quiz-form fieldset[disabled]'), gate.id);
  assert.match(await p.locator('#quiz-feedback').innerText(), new RegExp(gate.question.explanation.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
}
async function noOverflow(p, label) {
  const dimensions = await p.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert.ok(dimensions.scroll <= dimensions.width + 1 && dimensions.body <= dimensions.width + 1, `${label}: ${JSON.stringify(dimensions)}`);
}
async function imagesLoaded(p) {
  await p.locator('footer').scrollIntoViewIfNeeded();
  await p.waitForFunction(() => [...document.images].every(i=>i.complete && i.naturalWidth>0));
  await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'});});
}
try {
  context = await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true}); page=await context.newPage(); observe(page);
  await page.goto(base); await ready(page);
  await check('24 gates, 4 lessons and fresh progress',async()=>{assert.equal(gates.length,24); assert.equal(await page.locator('.lesson-card').count(),4); assert.equal(await page.locator('#progress-text').innerText(),'0 / 24 關');});
  await check('public mode has no teacher entry or direct explanation',async()=>{assert.equal(await page.locator('#mode-toggle,[data-action=explain]').count(),0);assert.equal(await page.locator('body.presenter').count(),0);await go(page,`gate/${gates[0].id}`);assert.equal(await page.locator('[data-action=explain]').count(),0);assert.equal(await page.locator('#quiz-feedback').innerText(),'');});
  await check('public server refuses private scripts and documents',async()=>{for(const resource of ['data/teacher-course.json','teacher.js','teacher-timer.js','teacher.html','documents/運動科學研究探險隊_第1堂_180分鐘完整講稿.pdf']) {const response=await fetch(new URL(resource,base));assert.equal(response.status,404,resource);}});
  await check('locked direct hash rejects later gate',async()=>{await go(page,`gate/${gates[5].id}`);assert.match(await page.locator('#app').innerText(),/等待解鎖/);assert.equal(await page.locator('#quiz-form').count(),0);});
  await check('keyboard skip link moves focus to learning content',async()=>{await page.goto(base);await ready(page);await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('class'),'skip-link');await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'app');});
  await check('quiz requires task and selected answer; wrong task gets feedback',async()=>{await go(page,`gate/${gates[0].id}`);await page.locator('#quiz-form button[type=submit]').click();assert.match(await page.locator('#quiz-feedback').innerText(),/先完成/);await page.locator('[data-action=check-task]').click();assert.match(await page.locator('#task-feedback').innerText(),/未對上/);await solveTask(page,gates[0]);await page.locator('#quiz-form button[type=submit]').click();assert.match(await page.locator('#quiz-feedback').innerText(),/選擇一個/);});
  await check('wrong answer, hint, retry does not prematurely unlock',async()=>{const gate=gates[0];await page.locator(`input[name=answer][value="${(gate.question.answer+1)%gate.question.options.length}"]`).check();await page.locator('#quiz-form button[type=submit]').click();assert.match(await page.locator('#quiz-feedback').innerText(),/再想一步/);assert.equal((await saved(page)).gates[gate.id].completed,false);assert.equal(await page.locator('[data-action=go-gate][disabled]').count(),1);await page.locator('[data-action=hint]').click();assert.equal(await page.locator('#hint-panel').innerText(),gate.question.hint);});
  for(let index=0;index<gates.length;index++) {
    const gate=gates[index];
    await check(`DOM complete ${gate.id} (${gate.task.type})`,async()=>{await go(page,`gate/${gate.id}`);await solve(page,gate);assert.equal(await page.locator('#progress-text').innerText(),`${index+1} / 24 關`);const record=(await saved(page)).gates[gate.id];assert.equal(record.completed,true);assert.equal(record.answerIndex,gate.question.answer);assert.equal(record.task.done,true);assert.ok(record.attempts>=1);});
    if(index===0) await check('notes survive reload and malicious note stays plain text',async()=>{const text='<img src=x onerror="window.qaInjection=1"> 我的研究筆記';await page.locator('#gate-note').fill(text);await page.waitForTimeout(450);await page.reload();await page.locator('#gate-note').waitFor();assert.equal(await page.locator('#gate-note').inputValue(),text);assert.equal(await page.evaluate(()=>window.qaInjection),undefined);});
  }
  await check('completed progress remains complete after reload',async()=>{await page.reload();await page.locator('#quiz-form').waitFor();assert.equal(await page.locator('#progress-text').innerText(),'24 / 24 關');});
  await check('115 and 116 progress isolated and reload keeps correct records',async()=>{await page.locator('#year-select').selectOption('116');assert.equal(await page.locator('#progress-text').innerText(),'0 / 24 關');await go(page,`gate/${gates[1].id}`);assert.match(await page.locator('#app').innerText(),/等待解鎖/);assert.equal(await page.locator('#quiz-form').count(),0);await page.locator('#year-select').selectOption('115');assert.equal(await page.locator('#progress-text').innerText(),'24 / 24 關');});
  let exported;
  await check('actual JSON download contains all answers and reflection',async()=>{await go(page,'settings');const waiting=page.waitForEvent('download');await page.locator('[data-action=export]').click();const dl=await waiting;const filename=path.join(out,dl.suggestedFilename());await dl.saveAs(filename);exported=JSON.parse(await readFile(filename,'utf8'));assert.equal(Object.values(exported.gates).filter(g=>g.completed).length,24);assert.match(exported.gates[gates[0].id].note,/我的研究筆記/);assert.equal(exported.year,115);});
  await check('valid import restores all 24 gates in fresh browser storage',async()=>{await context.close();context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true});page=await context.newPage();observe(page);await page.goto(base);await ready(page);await go(page,'settings');await page.locator('#import-file').waitFor();assert.equal(await page.locator('#progress-text').innerText(),'0 / 24 關');page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已匯入'));assert.equal(await page.locator('#progress-text').innerText(),'24 / 24 關');});
  for(const [name,buffer] of [['broken JSON',Buffer.from('{broken')],['wrong year',Buffer.from(JSON.stringify({...exported,year:116}))],['oversized file',Buffer.alloc(1_000_001,32)]]) {
    await check(`${name} import rejected without changing records`,async()=>{const before=stable(await saved(page));await page.locator('#import-file').setInputFiles({name:`${name}.json`,mimeType:'application/json',buffer});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('匯入失敗'));assert.deepEqual(stable(await saved(page)),before);});
  }
  await check('cancel import preserves current answers and notes',async()=>{const before=stable(await saved(page));page.once('dialog',d=>d.dismiss());await page.locator('#import-file').setInputFiles({name:'cancel.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,gates:{},assignments:{}}))});await page.waitForTimeout(150);assert.deepEqual(stable(await saved(page)),before);});
  await check('report renders 24 answers and malicious text safely; PDF generated',async()=>{await go(page,'report');assert.equal(await page.locator('.report-gate').count(),24);assert.equal(await page.locator('img[src=x]').count(),0);assert.equal(await page.evaluate(()=>window.qaInjection),undefined);await page.screenshot({path:path.join(out,'report.png'),fullPage:true});await page.pdf({path:path.join(out,'learning-report.pdf'),format:'A4',printBackground:true});});
  for(const [width,height] of [[360,800],[390,844],[1366,768]]) {
    await page.setViewportSize({width,height});
    for(const route of ['map','resources','settings','report',...gates.map(g=>`gate/${g.id}`)]) await check(`no page overflow ${width} ${route}`,async()=>{await go(page,route);await noOverflow(page,route);});
    await check(`all rendered images load ${width}`,async()=>{await go(page,'map');await imagesLoaded(page);await page.screenshot({path:path.join(out,`map-${width}.png`),fullPage:true});await go(page,`gate/${gates[18].id}`);await imagesLoaded(page);await page.screenshot({path:path.join(out,`gate-${width}.png`),fullPage:true});});
    if(width<500) await check(`mobile main prose at least 18px and main buttons 44px ${width}`,async()=>{await go(page,'map');const small=await page.locator('.hero-copy>p:not(.eyebrow):not(.lesson-meta),.lesson-body>p:not(.eyebrow):not(.lesson-meta)').evaluateAll(nodes=>nodes.filter(n=>parseFloat(getComputedStyle(n).fontSize)<18).map(n=>({text:n.textContent,font:getComputedStyle(n).fontSize})));assert.deepEqual(small,[]);await go(page,`gate/${gates[0].id}`);const prose=await page.locator('.scene-panel .dialogue p,.choice>span,.panel>p:not(.eyebrow),.learning-list li').evaluateAll(nodes=>nodes.filter(n=>parseFloat(getComputedStyle(n).fontSize)<18).map(n=>({text:n.textContent,font:getComputedStyle(n).fontSize})));assert.deepEqual(prose,[]);const short=await page.locator('.button:visible').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<44).map(n=>n.textContent));assert.deepEqual(short,[]);});
  }
  await check('200 percent font enlargement has no page overflow',async()=>{await page.addStyleTag({content:'html{font-size:200%}body{font-size:36px}'});for(const route of ['map','resources','settings','report',`gate/${gates[18].id}`]) {await go(page,route);await noOverflow(page,`200% ${route}`);}await page.reload();});
  await check('reduced motion removes transitions and animated scroll',async()=>{await page.emulateMedia({reducedMotion:'reduce'});await go(page,'map');const style=await page.locator('.button').first().evaluate(el=>({transition:getComputedStyle(el).transitionDuration,scroll:getComputedStyle(document.documentElement).scrollBehavior}));assert.equal(style.transition,'0s');assert.equal(style.scroll,'auto');});
  await check('corrupt saved JSON recovers with warning and fresh progress',async()=>{const badContext=await browser.newContext();await badContext.addInitScript(k=>localStorage.setItem(k,'{broken'),key);const p=await badContext.newPage();observe(p);await p.goto(base);await ready(p);assert.equal(await p.locator('#progress-text').innerText(),'0 / 24 關');assert.match(await p.locator('#status').innerText(),/無法讀取.*JSON/);await badContext.close();});
  await check('course load failure presents retry without touching existing progress',async()=>{const before=stable(await saved(page));intentionalLoadFailure=true;await page.route('**/data/course.json',route=>route.abort());await page.reload();await page.locator('#retry-load').waitFor();assert.match(await page.locator('#app').innerText(),/教材尚未載入/);assert.deepEqual(stable(await saved(page)),before);await page.unroute('**/data/course.json');intentionalLoadFailure=false;await page.locator('#retry-load').click();await page.locator('#year-select').waitFor();await page.waitForFunction(()=>document.querySelector('#progress-text').textContent==='24 / 24 關');});
  await check('blocked storage get and quota set display actionable UX',async()=>{const failureContext=await browser.newContext();await failureContext.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('Blocked','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError')};});const p=await failureContext.newPage();observe(p);await p.goto(base);await ready(p);assert.match(await p.locator('#status').innerText(),/無法讀取瀏覽器進度/);await go(p,`gate/${gates[0].id}`);await solveTask(p,gates[0]);assert.match(await p.locator('#status').innerText(),/無法保存進度.*匯出JSON/);await p.locator(`input[name=answer][value="${gates[0].question.answer}"]`).check();await p.locator('#quiz-form button[type=submit]').click();assert.equal(await p.locator('#progress-text').innerText(),'1 / 24 關');assert.match(await p.locator('#status').innerText(),/無法保存進度.*匯出JSON/);await go(p,'settings');const downloading=p.waitForEvent('download');await p.locator('[data-action=export]').click();assert.ok(await downloading);await failureContext.close();});
  await check('no browser errors or HTTP failures',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(networkFailures,[]);assert.deepEqual(privateRequests,[]);});
} catch(e) {
  if(page) await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
  process.exitCode=1;
} finally {
  const report={url:base,scope:'Local browser acceptance with synthetic progress; not classroom UAT',timestamp:new Date().toISOString(),passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length,cases:results,consoleErrors:errors,httpFailures:networkFailures,expectedDiagnostics,privateRequests};
  await writeFile(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,failed:report.failed,output:out}));
  await browser.close();
}
