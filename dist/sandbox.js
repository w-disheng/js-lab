// Code executes in a fresh worker inside an opaque-origin sandboxed iframe.
// The iframe's CSP is inherited by its blob worker: no network or extra workers.
export function workerMain() {
  const send = self.postMessage.bind(self);
  const delay = setTimeout.bind(self);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  let messages = 0;
  let failed = false;
  const format = value => {
    try {
      if (typeof value === 'string') return value.slice(0, 2000);
      if (value === undefined) return 'undefined';
      if (typeof value === 'function') return '[Function]';
      if (typeof value === 'bigint') return `${value}n`;
      if (value instanceof Error) return `${value.name}: ${value.message}`;
      const seen = new WeakSet();
      return JSON.stringify(value, (_, v) => {
        if (typeof v === 'bigint') return `${v}n`;
        if (v && typeof v === 'object') {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      })?.slice(0, 2000) ?? String(value);
    } catch { return '[无法显示的值]'; }
  };
  const log = (...args) => {
    if (messages++ < 80) send({ type: 'log', text: args.map(format).join(' ') });
    else if (messages === 81) send({ type: 'log', text: '…输出已截断（最多 80 条）' });
  };
  const reportError = e => { failed = true; send({ type: 'error', text: format(e) }); };
  self.addEventListener('error', e => { e.preventDefault(); reportError(e.error || e.message); });
  self.addEventListener('unhandledrejection', e => { e.preventDefault(); reportError(e.reason); });
  self.onmessage = async ({ data }) => {
    let count = 0;
    let passed = 0;
    const check = async (name, fn) => {
      count++;
      try { await fn(); passed++; send({ type: 'check', name, ok: true }); }
      catch (error) { send({ type: 'check', name, ok: false, text: format(error) }); }
    };
    const assert = (condition, message = '实际结果与要求不符，请检查返回值和边界情况。') => {
      if (!condition) throw new Error(message);
    };
    try {
      await new AsyncFunction('console', 'check', 'assert', data.source)(
        Object.freeze({ log, info: log, warn: log, error: log, table: log, debug: log }), check, assert
      );
      await new Promise(resolve => delay(resolve, 80));
      send({ type: 'done', passed, count, failed });
    } catch (error) {
      reportError(error);
      send({ type: 'done', passed, count, failed: true });
    }
  };
}

function frameMain() {
  let active;
  let deadline;
  let currentId;
  const finish = () => { if (active) active.terminate(); active = null; clearTimeout(deadline); };
  window.addEventListener('message', e => {
    if (e.source !== parent || e.data?.type !== 'start') return;
    finish();
    currentId = e.data.id;
    const relay = payload => parent.postMessage({ channel: 'js-lab', id: currentId, ...payload }, '*');
    try {
      const url = URL.createObjectURL(new Blob([e.data.worker], { type: 'text/javascript' }));
      active = new Worker(url);
      URL.revokeObjectURL(url);
      active.onmessage = event => {
        const data = event.data;
        if (!data || !['log', 'error', 'check', 'done'].includes(data.type)) return;
        relay(data);
        if (data.type === 'done') finish();
      };
      active.onerror = () => { relay({ type: 'error', text: '执行环境无法启动，或发生了未处理的脚本错误。' }); relay({ type: 'done', failed: true }); finish(); };
      active.postMessage({ source: e.data.source });
      deadline = setTimeout(() => {
        finish();
        relay({ type: 'timeout', text: '运行超过 3 秒，已停止。检查死循环、未结束的 Promise 或等待时间。' });
      }, 3000);
    } catch (error) { relay({ type: 'error', text: error.message }); relay({ type: 'done', failed: true }); finish(); }
  });
}

export const workerSource = `(${workerMain.toString()})()`;
export const frameDocument = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none';"><title>Code runner</title></head><body><script>(${frameMain.toString()})()<\/script></body></html>`;
