export const emptyTraining = () => ({ day: 1, tasks: {}, answers: {}, quiz: {}, explained: false, reviewAt: 0, note: '' });
export function sanitizeTraining(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('训练记录格式不正确。');
  const out = emptyTraining();
  if (Number.isInteger(input.day) && input.day >= 1 && input.day <= 21) out.day = input.day;
  for (let day = 1; day <= 21; day++) for (let task = 0; task < 5; task++) {
    const key = `${day}-${task}`;
    if (input.tasks?.[key] === true) out.tasks[key] = true;
  }
  for (const id of ['stale', 'loading', 'failure']) {
    if (typeof input.answers?.[id] === 'string') out.answers[id] = input.answers[id].slice(0, 6000);
    const q = input.quiz?.[id];
    if (q && Number.isInteger(q.choice) && q.choice >= 0 && q.choice <= 2) {
      out.quiz[id] = { choice: q.choice, submitted: q.submitted === true };
    }
  }
  out.explained = input.explained === true;
  out.note = typeof input.note === 'string' ? input.note.slice(0, 10000) : '';
  out.reviewAt = Number.isFinite(input.reviewAt) && input.reviewAt > 0 ? input.reviewAt : 0;
  return out;
}

// The same reducer drives both on-screen panels, with the guard as the only difference.
export const initialSearch = () => ({ latest: 0, query: '', result: '', error: '', loading: false });
export function searchStep(state, event, guarded) {
  if (event.type === 'start') return { ...state, latest: event.id, query: event.word, result: '', error: '', loading: true };
  if (guarded && event.id !== state.latest) return state;
  if (event.type === 'success') return { ...state, result: event.word, error: '', loading: false };
  if (event.type === 'failure') return { ...state, result: '', error: `${event.word} 请求失败`, loading: false };
  return state;
}
