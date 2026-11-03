const setup = `
const jobs = [];
const events = [];
const search = createSearchController(word => new Promise((resolve, reject) => jobs.push({word, resolve, reject})), patch => events.push(patch));
const view = () => Object.assign({}, ...events);
`;
export const raceLesson = {
  id: 'search-race', group: 2, en: 'Search race conditions', zh: '搜索竞态与页面状态', minutes: 25,
  intro: '先下单的不一定先出餐。只让当前有效订单更新结果、错误和 loading。',
  english: 'Only the latest request may update the current search state.',
  chinese: '发起时记录最新编号。成功、失败和结束等待时都核对编号；忽略旧响应不等于取消网络请求。',
  analogy: '牛肉面改成鸡肉面后，旧订单先出餐，也不能当成当前订单送来；旧订单出错或完成，都不能让服务员误报鸡肉面已经好了。',
  work: '搜索建议、筛选列表、切换用户详情都可能遇到乱序响应。React 中可以用 Effect 清理忽略过期响应，或用 ref 保存跨渲染的请求编号；不要在每次渲染中把计数器重置。',
  example: 'let latest = 0;\nconst first = ++latest;\nconst second = ++latest;\nconsole.log(first === latest);\nconsole.log(second === latest);',
  output: 'false\ntrue',
  pitfall: '只保护 setResults 不够：旧请求的 catch 或 finally 仍可能覆盖错误提示或提前关闭 loading。防抖能减少请求，但不能保证已发出的请求按顺序返回。',
  question: '旧请求返回时，新请求还没结束，为什么旧请求不能关闭 loading？',
  answer: 'loading 描述的是当前有效搜索。旧请求结束不代表新搜索结束。就像旧餐做好，不代表改点的新餐已做好。需要把结果、错误和 loading 都放在“仍是最新请求”的判断下。',
  prompt: '修复 createSearchController(request, onChange)。它返回一个 async search(word)。request(word) 返回 Promise，onChange 接收状态补丁。每次发起必须清空旧 result/error 并设置 loading:true；只有最新发起的请求能更新结果、错误和结束 loading。失败应被处理，不让返回的 Promise 拒绝。这里选择新搜索清空旧结果的策略。',
  starter: `function createSearchController(request, onChange) {
  return async function search(word) {
    onChange({ loading: true, error: "", result: "" });
    try {
      const result = await request(word);
      onChange({ result });
    } catch (error) {
      onChange({ error: error.message });
    } finally {
      onChange({ loading: false });
    }
  };
}`,
  solution: `function createSearchController(request, onChange) {
  let latest = 0;
  return async function search(word) {
    const id = ++latest;
    onChange({ loading: true, error: "", result: "" });
    try {
      const result = await request(word);
      if (id === latest) onChange({ result });
    } catch (error) {
      if (id === latest) onChange({ error: error.message });
    } finally {
      if (id === latest) onChange({ loading: false });
    }
  };
}`,
  hint: '把 latest 放在返回的 search 函数外，让每次调用共享它；每次调用拿到独立 id。检查 try、catch、finally 三处。',
  checks: [
    ['最新成功结果与结束状态', setup + 'const p=search("car"); assert(view().loading === true && view().error === "" && view().result === ""); jobs[0].resolve("CAR"); await p; assert(view().result === "CAR" && view().loading === false);'],
    ['旧成功不能覆盖新结果', setup + 'const a=search("cat"), b=search("car"); jobs[1].resolve("CAR"); await b; const n=events.length; jobs[0].resolve("CAT"); await a; assert(view().result === "CAR" && events.length === n, "旧请求不应触发任何状态更新");'],
    ['旧请求不能提前关闭新请求的 loading', setup + 'const a=search("cat"), b=search("car"); jobs[0].resolve("CAT"); await a; assert(view().loading === true && view().result === "", "car 还没结束，loading 应继续"); jobs[1].resolve("CAR"); await b;'],
    ['旧失败不能污染新搜索', setup + 'const a=search("cat"), b=search("car"); jobs[0].reject(new Error("old error")); await a; assert(view().error === "" && view().loading === true); jobs[1].resolve("CAR"); await b;'],
    ['最新失败保留正确错误，旧成功不覆盖', setup + 'const a=search("cat"), b=search("car"); jobs[1].reject(new Error("car unavailable")); await b; const n=events.length; jobs[0].resolve("CAT"); await a; assert(view().error === "car unavailable" && view().loading === false && view().result === "" && events.length === n);'],
    ['同一个词连续搜索也按请求编号区分', setup + 'const a=search("cat"), b=search("cat"); jobs[1].resolve("fresh data"); await b; jobs[0].resolve("old data"); await a; assert(view().result === "fresh data");'],
    ['新搜索清理上一次的结果和错误', setup + 'const a=search("cat"); jobs[0].reject(new Error("failed")); await a; const b=search("car"); assert(view().error === "" && view().result === "" && view().loading === true); jobs[1].resolve("CAR"); await b; const c=search("dog"); assert(view().result === ""); jobs[2].resolve("DOG"); await c;']
  ],
  debug: '如果 AI 只在 try 中检查编号，却在 finally 中无条件关闭 loading，哪一个用例会失败？如果两次搜索的词相同，只比较词是否足够？',
  related: ['closures', 'async', 'debounce', 'testing'],
  reference: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function'
};
