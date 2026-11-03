import { sanitizeTraining } from './training-core.js';
export const STORAGE_KEY = 'js-practice-room.v1';
export const emptyState = () => ({ version: 1, current: 'closures', entries: {} });
const clampText = (v, limit) => typeof v === 'string' ? v.slice(0, limit) : '';

export function sanitizeState(input, validIds) {
  if (!input || input.version !== 1 || !input.entries || typeof input.entries !== 'object' || Array.isArray(input.entries)) {
    throw new Error('备份格式不正确，请选择从本应用导出的 JSON 文件。');
  }
  const result = emptyState();
  if (Object.hasOwn(input, 'training')) result.training = sanitizeTraining(input.training);
  if (validIds.includes(input.current)) result.current = input.current;
  for (const id of validIds) {
    const item = input.entries[id];
    if (!item || typeof item !== 'object') continue;
    result.entries[id] = {
      ...(typeof item.draft === 'string' ? { draft: clampText(item.draft, 30000) } : {}),
      note: clampText(item.note, 10000),
      explained: item.explained === true,
      revealed: item.revealed === true,
      attempted: item.attempted === true,
      reviewAt: Number.isFinite(item.reviewAt) && item.reviewAt > 0 ? item.reviewAt : 0,
      interval: [1, 3, 7, 14, 30].includes(item.interval) ? item.interval : 0,
      pass: item.pass && ['independent', 'assisted'].includes(item.pass.kind) && Number.isFinite(item.pass.at)
        ? { kind: item.pass.kind, at: item.pass.at } : null
    };
  }
  return result;
}

export function scheduleReview(entry, remembered, now = Date.now()) {
  const steps = [1, 3, 7, 14, 30];
  const next = remembered ? steps[Math.min(steps.indexOf(entry.interval || 0) + 1, steps.length - 1)] : 1;
  return { interval: next, reviewAt: now + next * 86400000 };
}

export function reviewDue(entry, now = Date.now()) {
  return !!entry?.reviewAt && entry.reviewAt <= now;
}

export function stats(state, lessons, now = Date.now()) {
  const entries = lessons.map(l => state.entries[l.id] || {});
  return {
    explained: entries.filter(x => x.explained).length,
    passed: entries.filter(x => x.pass).length,
    due: entries.filter(x => reviewDue(x, now)).length,
    attempted: entries.filter(x => x.attempted).length
  };
}

// Each check runs in the same lexical scope as the student's declarations.
export function exerciseSource(source, checks) {
  return '"use strict";\n' + source + '\n;\n' + checks.map(([name, code]) =>
    `await check(${JSON.stringify(name)}, async () => {\n${code}\n});`
  ).join('\n');
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
