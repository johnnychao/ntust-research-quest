export const SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 1_000_000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function allGates(course) { return course.lessons.flatMap(lesson => lesson.gates); }
export function storageKey(config, course, year) { return `${config.courseId}:${course.contentVersion}:${year}`; }
export function newProgress(config, course, year) {
  return {schemaVersion: SCHEMA_VERSION, courseId: config.courseId, contentVersion: course.contentVersion,
    year, updatedAt: new Date().toISOString(), gates: {}, assignments: {}};
}
export function completedCount(progress, course) { return allGates(course).filter(gate => progress.gates[gate.id]?.completed).length; }
export function isUnlocked(id, progress, course, presenter = false) {
  const gates = allGates(course), index = gates.findIndex(gate => gate.id === id);
  return index >= 0 && (presenter || index === 0 || gates.slice(0, index).every(gate => progress.gates[gate.id]?.completed));
}
export function gateRecord(progress, id) {
  if (!progress.gates[id]) progress.gates[id] = {completed: false, answerIndex: null, attempts: 0, hints: 0, note: '', task: {done: false, values: []}};
  return progress.gates[id];
}

// Return a fresh, allow-listed object. Imported strings are displayed as text, never HTML.
export function validateProgress(input, config, course, expectedYear) {
  const fail = message => { throw new Error(message); };
  if (!object(input)) fail('進度檔必須是JSON物件。');
  if (input.schemaVersion !== SCHEMA_VERSION || input.courseId !== config.courseId) fail('這不是本課程支援的進度檔。');
  if (input.contentVersion !== course.contentVersion) fail('教材版本不同，請保留原檔並使用相同版本的網站。');
  if (input.year !== expectedYear) fail(`這份進度屬於${input.year}年，請先切換到對應開課年度。`);
  if (!config.availableYears.includes(input.year)) fail('開課年度不在目前設定中。');
  if (!object(input.gates) || !object(input.assignments)) fail('進度欄位不完整。');
  const gates = allGates(course), validIds = new Set(gates.map(gate => gate.id));
  const result = newProgress(config, course, expectedYear);
  for (const [id, row] of Object.entries(input.gates)) {
    if (!validIds.has(id) || !object(row)) fail('進度含有無法辨識的關卡。');
    const gate = gates.find(item => item.id === id);
    if (typeof row.completed !== 'boolean' || !Number.isSafeInteger(row.attempts) || row.attempts < 0 || row.attempts > 100000 || !Number.isSafeInteger(row.hints) || row.hints < 0 || row.hints > 100000) fail('關卡紀錄格式錯誤。');
    if (row.answerIndex !== null && (!Number.isInteger(row.answerIndex) || row.answerIndex < 0 || row.answerIndex >= gate.question.options.length)) fail('作答選項超出範圍。');
    if (typeof row.note !== 'string' || row.note.length > 6000) fail('研究筆記過長或格式錯誤。');
    if (!object(row.task) || typeof row.task.done !== 'boolean' || !Array.isArray(row.task.values) || row.task.values.length > 50 || row.task.values.some(value => !Number.isInteger(value) || value < -1 || value > 100)) fail('互動任務格式錯誤。');
    if (gate.task?.type === 'match' && row.task.values.length && (row.task.values.length !== gate.task.items.length || row.task.values.some((value,index) => value >= gate.task.items[index].choices.length))) fail('配對任務紀錄超出選項範圍。');
    if (gate.task?.type === 'order' && row.task.values.length && (row.task.values.length !== gate.task.items.length || new Set(row.task.values).size !== gate.task.items.length || row.task.values.some(value => value < 0 || value >= gate.task.items.length))) fail('排序任務紀錄格式錯誤。');
    if (row.task.exploreValue !== undefined && (typeof row.task.exploreValue !== 'number' || !Number.isFinite(row.task.exploreValue) || Math.abs(row.task.exploreValue) > 1000)) fail('探索紀錄格式錯誤。');
    if (row.completed && (row.answerIndex !== gate.question.answer || !row.task.done || row.attempts < 1)) fail('已完成關卡的紀錄不完整。');
    result.gates[id] = {completed: row.completed, answerIndex: row.answerIndex, attempts: row.attempts, hints: row.hints, note: row.note,
      task: {done: row.task.done, values: [...row.task.values], ...(row.task.exploreValue === undefined ? {} : {exploreValue: row.task.exploreValue})}};
  }
  let missingPrevious = false;
  for (const gate of gates) {
    if (!result.gates[gate.id]?.completed) missingPrevious = true;
    else if (missingPrevious) fail('關卡完成順序不連續，請核對原始進度檔。');
  }
  for (const [id, text] of Object.entries(input.assignments)) {
    if (!course.lessons.some(lesson => lesson.id === id) || typeof text !== 'string' || text.length > 12000) fail('作業草稿格式錯誤。');
    result.assignments[id] = text;
  }
  return result;
}
export function parseImport(text, config, course, year) {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error('進度檔過大，請選擇本站匯出的JSON檔。');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('JSON檔案損壞或格式不正確，原有進度尚未更動。'); }
  return validateProgress(value, config, course, year);
}
export function loadProgress(storage, config, course, year) {
  try {
    const saved = storage.getItem(storageKey(config, course, year));
    return {progress: saved ? parseImport(saved, config, course, year) : newProgress(config, course, year), warning: ''};
  } catch (error) {
    return {progress: newProgress(config, course, year), warning: `無法讀取瀏覽器進度：${error.message} 請先匯出本次成果備份。`};
  }
}
export function saveProgress(storage, progress, config, course) {
  progress.updatedAt = new Date().toISOString();
  try { storage.setItem(storageKey(config, course, progress.year), JSON.stringify(progress)); return ''; }
  catch { return '瀏覽器無法保存進度。本次仍可闖關，離開前請匯出JSON備份。'; }
}
