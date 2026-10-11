import test from 'node:test';
import assert from 'node:assert/strict';
import {newProgress, gateRecord, isUnlocked, parseImport, saveProgress, loadProgress, completedCount, storageKey} from '../state.js';
const config = {courseId: 'ntust-research-quest', availableYears: [115, 116]};
const course = {contentVersion: '1.0.0', lessons: [{id: 'L1', gates: [{id: 'L1-01', question: {options: ['a','b','c'], answer: 1}}, {id: 'L1-02', question: {options: ['a','b','c'], answer: 2}}]}]};
function pass(progress, id, answer) { Object.assign(gateRecord(progress, id), {completed: true, answerIndex: answer, attempts: 1, task: {done: true, values: [1]}}); }
test('student progression requires all previous gates; presenter bypass does not complete them', () => {
  const p = newProgress(config, course, 115);
  assert.equal(isUnlocked('L1-02', p, course), false);
  assert.equal(isUnlocked('L1-02', p, course, true), true);
  assert.equal(completedCount(p, course), 0);
  pass(p, 'L1-01', 1); assert.equal(isUnlocked('L1-02', p, course), true);
});
test('export roundtrip preserves notes; unknown fields are not injected', () => {
  const p = newProgress(config, course, 115); pass(p, 'L1-01', 1);
  p.gates['L1-01'].note = '<script>not executable</script>'; p.extra = 'drop';
  const parsed = parseImport(JSON.stringify(p), config, course, 115);
  assert.equal(parsed.gates['L1-01'].note, p.gates['L1-01'].note); assert.equal(parsed.extra, undefined);
});
test('reject malformed, wrong course, version, year, invalid options and skipped completion', () => {
  const p = newProgress(config, course, 115);
  assert.throws(() => parseImport('{', config, course, 115));
  for (const change of [{courseId: 'other'}, {contentVersion: '2'}, {year: 116}, {gates: []}]) assert.throws(() => parseImport(JSON.stringify({...p, ...change}), config, course, 115));
  pass(p, 'L1-02', 2); assert.throws(() => parseImport(JSON.stringify(p), config, course, 115));
  delete p.gates['L1-02']; pass(p, 'L1-01', 5); assert.throws(() => parseImport(JSON.stringify(p), config, course, 115));
});
test('annual storage isolation and quota failures', () => {
  const memory = new Map(), storage = {getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value)};
  const p = newProgress(config, course, 115); pass(p, 'L1-01', 1);
  assert.equal(saveProgress(storage, p, config, course), '');
  assert.equal(completedCount(loadProgress(storage, config, course, 115).progress, course), 1);
  assert.equal(completedCount(loadProgress(storage, config, course, 116).progress, course), 0);
  assert.notEqual(storageKey(config, course, 115), storageKey(config, course, 116));
  assert.match(saveProgress({setItem: () => {throw Error('quota');}}, p, config, course), /無法保存/);
  assert.match(loadProgress({getItem: () => {throw Error('blocked');}}, config, course, 115).warning, /無法讀取/);
});
test('reject oversized and incomplete completed records', () => {
  assert.throws(() => parseImport(' '.repeat(1000001), config, course, 115));
  const p = newProgress(config, course, 115); pass(p, 'L1-01', 1); p.gates['L1-01'].task.done = false;
  assert.throws(() => parseImport(JSON.stringify(p), config, course, 115));
});
