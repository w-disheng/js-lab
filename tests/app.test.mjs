import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { lessons } from '../dist/lessons.js';
import { emptyState, sanitizeState, scheduleReview, reviewDue, stats, exerciseSource, escapeHTML } from '../dist/core.js';
import { workerSource, frameDocument } from '../dist/sandbox.js';

function execute(source) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const timers = new Set();
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Runner timed out')); }, 2000);
    function cleanup() { clearTimeout(timeout); for (const timer of timers) clearTimeout(timer); }
    const context = vm.createContext({
      self: {
        postMessage(data) { messages.push(data); if (data.type === 'done') { cleanup(); resolve(messages); } },
        addEventListener() {}
      },
      setTimeout(fn, delay) { const id = setTimeout(fn, delay); timers.add(id); return id; },
      clearTimeout(id) { clearTimeout(id); timers.delete(id); }
    });
    try {
      vm.runInContext(workerSource, context, { timeout: 1000 });
      context.self.onmessage({ data: { source } });
    } catch (error) { cleanup(); reject(error); }
  });
}

test('curriculum has unique IDs, complete lessons and valid connections', () => {
  assert.equal(lessons.length, 21);
  const ids = lessons.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of lessons) {
    for (const key of ['english','chinese','analogy','work','question','answer','prompt','starter','solution','hint','debug','reference']) assert.ok(l[key], `${l.id}.${key}`);
    for (const id of l.related) assert.ok(ids.includes(id), id);
    assert.ok(l.checks.length >= 2);
  }
});

for (const l of lessons) {
  test(`${l.id}: reference solution passes every behavioral check`, async () => {
    const result = await execute(exerciseSource(l.solution, l.checks));
    const done = result.at(-1);
    assert.equal(done.failed, false, JSON.stringify(result));
    assert.equal(done.passed, l.checks.length, JSON.stringify(result));
    assert.equal(done.count, l.checks.length);
  });
  test(`${l.id}: incomplete/buggy starter is not marked passed`, async () => {
    const result = await execute(exerciseSource(l.starter, l.checks));
    assert.notEqual(result.at(-1).passed, l.checks.length);
  });
  test(`${l.id}: example matches the published output`, async () => {
    const result = await execute('"use strict";\n' + l.example);
    assert.equal(result.at(-1).failed, false, JSON.stringify(result));
    assert.equal(result.filter(x => x.type === 'log').map(x => x.text).join('\n'), l.output);
  });
}

test('runner reports syntax errors and cannot pass skipped checks', async () => {
  const invalid = await execute(exerciseSource('function {', [['runs','assert(true)']]));
  assert.equal(invalid.at(-1).failed, true);
  const skipped = await execute(exerciseSource('return;', [['runs','assert(true)']]));
  assert.equal(skipped.at(-1).count, 0);
});
test('runner bounds output and handles circular data', async () => {
  const result = await execute('const x={}; x.self=x; console.log(x); for(let i=0;i<100;i++) console.log(i);');
  assert.equal(result.filter(x => x.type === 'log').length, 81);
  assert.match(result[0].text, /Circular/);
});
test('sandbox document disallows network and has no same-origin privilege', () => {
  assert.ok(frameDocument.includes("connect-src 'none'"));
  assert.ok(frameDocument.includes("default-src 'none'"));
});
test('import only accepts known IDs and bounded, typed values', () => {
  const data = JSON.parse('{"version":1,"current":"missing","entries":{"__proto__":{"polluted":true},"closures":{"note":"hello","explained":"yes","draft":"","pass":{"kind":"assisted","at":123},"reviewAt":"bad"},"unknown":{"note":"no"}}}');
  const clean = sanitizeState(data, lessons.map(l => l.id));
  assert.deepEqual(Object.keys(clean.entries), ['closures']);
  assert.equal(clean.entries.closures.explained, false);
  assert.equal(clean.entries.closures.draft, '');
  assert.equal(clean.entries.closures.reviewAt, 0);
  assert.equal(clean.entries.closures.pass.kind, 'assisted');
  assert.equal({}.polluted, undefined);
  assert.throws(() => sanitizeState({version:99}, []));
  assert.throws(() => sanitizeState({version:1,entries:[]}, []));
});
test('review timing advances, caps and resets; explanation does not imply passing', () => {
  let e = {};
  for (const interval of [1,3,7,14,30,30]) {
    e = scheduleReview(e, true, 1000);
    assert.equal(e.interval, interval);
    assert.equal(e.reviewAt, 1000 + interval * 86400000);
  }
  assert.equal(scheduleReview(e, false, 1000).interval, 1);
  assert.equal(reviewDue(e, e.reviewAt), true);
  assert.equal(reviewDue(e, e.reviewAt - 1), false);
  const state = emptyState();
  state.entries.closures = {explained:true};
  assert.equal(stats(state, lessons).explained, 1);
  assert.equal(stats(state, lessons).passed, 0);
});
test('saved text is escaped before HTML rendering', () => {
  assert.equal(escapeHTML('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
