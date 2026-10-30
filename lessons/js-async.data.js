/* js-async data: the single source of truth for the "Promises, async/await and concurrency" lesson.
   Nothing here describes an output by hand. Every claim is either computed by a model that dev/js-async.test.js
   compares with REAL promises and timers in Node, or it is a code string the page and the test both run.
   Works in the browser (Book.parts["js-async"].data) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["js-async"] = root.Book.parts["js-async"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* The helpers the page SHOWS are the helpers the page RUNS: one source string, turned into functions. */
  const HELPERS_SRC = [
    "const later = (ms, value) => new Promise((resolve) => setTimeout(resolve, ms, value));",
    "const fail = (ms, msg) => new Promise((_, reject) => setTimeout(reject, ms, new Error(msg)));",
    "const waitFor = (ms, value, signal) => new Promise((resolve, reject) => {",
    "  if (signal?.aborted) return reject(signal.reason);",
    "  const id = setTimeout(resolve, ms, value);",
    "  signal?.addEventListener(\"abort\", () => { clearTimeout(id); reject(signal.reason); }, { once: true });",
    "});",
  ].join("\n");
  const { later, fail, waitFor } = new Function(`${HELPERS_SRC}\nreturn { later, fail, waitFor };`)();
  const fmtVal = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));
  const show = (a) => (typeof a === "string" ? a : JSON.stringify(a));
  const toState = (r) => (r.status === "fulfilled" ? { state: "fulfilled", value: r.value } : { state: "rejected", reason: String(r.reason) });

  /* Run a code string with console, later, fail and waitFor in scope. Returns { logs, value }. */
  async function runSnippet(body, extra = {}) {
    const logs = [];
    const cons = { log: (...a) => logs.push(a.map(show).join(" ")) };
    const names = ["console", "later", "fail", "waitFor", ...Object.keys(extra)];
    const fn = new Function(...names, `return (async () => {\n${body}\n})()`);
    const value = await fn(cons, later, fail, waitFor, ...Object.values(extra));
    return { logs, value };
  }

  /* ---------- 1. The promise chain model (film, stepper) ---------- */
  const st = {
    add: (n) => ({ op: "add", n }), mul: (n) => ({ op: "mul", n }), log: () => ({ op: "log" }),
    throws: (msg) => ({ op: "throws", msg }), recover: (value) => ({ op: "catch", value }),
    wait: (ms, n) => ({ op: "wait", ms, n }), fin: () => ({ op: "finally" }),
  };
  const go = {
    resolve: (value) => ({ kind: "resolve", value }), reject: (msg) => ({ kind: "reject", msg }),
    later: (ms, value) => ({ kind: "later", ms, value }), laterFail: (ms, msg) => ({ kind: "laterFail", ms, msg }),
  };
  const startCode = (s) => ({
    resolve: `Promise.resolve(${fmtVal(s.value)})`, reject: `Promise.reject(new Error(${JSON.stringify(s.msg)}))`,
    later: `later(${s.ms}, ${fmtVal(s.value)})`, laterFail: `fail(${s.ms}, ${JSON.stringify(s.msg)})`,
  })[s.kind];
  const stepCode = (s) => ({
    add: `.then((v) => v + ${s.n})`, mul: `.then((v) => v * ${s.n})`,
    log: ".then((v) => { console.log(\"got\", v); return v; })",
    throws: `.then((v) => { throw new Error(${JSON.stringify(s.msg)}); })`,
    catch: `.catch((err) => ${fmtVal(s.value)})`, wait: `.then((v) => later(${s.ms}, v + ${s.n}))`,
    finally: ".finally(() => console.log(\"cleanup\"))",
  })[s.op];
  const chainLines = (spec) => [startCode(spec.start), ...spec.steps.map((s) => "  " + stepCode(s))];
  const namedSource = (spec) => [
    `const p0 = ${startCode(spec.start)};`,
    ...spec.steps.map((s, i) => `const p${i + 1} = p${i}${stepCode(s)};`),
    `return Promise.allSettled([${spec.steps.map((_, i) => `p${i}`).concat(`p${spec.steps.length}`).join(", ")}]);`,
  ].join("\n");

  const pass = (p) => (p.state === "fulfilled" ? { state: p.state, value: p.value } : { state: p.state, reason: p.reason });
  const say = (p) => (p.state === "fulfilled" ? `fulfilled with ${fmtVal(p.value)}` : `rejected with ${p.reason}`);

  /* The model: what each promise in the chain becomes, and why. */
  function simulate(spec) {
    const nodes = [];
    const events = [];
    const logs = [];
    const n = spec.steps.length;
    const s = spec.start;
    let t = s.ms || 0;
    let cur = s.kind === "resolve" || s.kind === "later" ? { state: "fulfilled", value: s.value } : { state: "rejected", reason: `Error: ${s.msg}` };
    nodes.push({ k: 0, ...cur, at: t });
    const lateStart = s.kind === "later" || s.kind === "laterFail";
    events.push({
      kind: "create", k: 0, at: 0,
      text: `Each .then, .catch or .finally gives back a NEW promise at once: p1 to p${n}. ` + (lateStart ? `p0 is pending and settles after ${s.ms} ms; the others wait.` : `p0 is already ${say(cur)}; the others are pending.`),
    });
    if (lateStart) events.push({ kind: "p0", k: 0, at: t, ...pass(cur), text: `${s.ms} ms later, p0 is ${say(cur)}. A promise settles once and never changes again.` });
    spec.steps.forEach((step, i) => {
      const k = i + 1;
      const prev = cur;
      const ok = prev.state === "fulfilled";
      const from = `p${k - 1}`;
      const to = `p${k}`;
      let ran = false;
      let next = pass(prev);
      let text;
      let waitMs = 0;
      if (step.op === "add" || step.op === "mul") {
        if (ok) {
          ran = true;
          const r = step.op === "add" ? prev.value + step.n : prev.value * step.n;
          next = { state: "fulfilled", value: r };
          text = `${from} is ${say(prev)}, so the handler runs: ${prev.value} ${step.op === "add" ? "+" : "*"} ${step.n} = ${r}. ${to} is ${say(next)}.`;
        }
      } else if (step.op === "log") {
        if (ok) { ran = true; logs.push(`got ${prev.value}`); text = `${from} is ${say(prev)}, so the handler runs: it prints "got ${prev.value}" and returns the value. ${to} is ${say(next)}.`; }
      } else if (step.op === "throws") {
        if (ok) { ran = true; next = { state: "rejected", reason: `Error: ${step.msg}` }; text = `${from} is ${say(prev)}, so the handler runs and throws ${next.reason}. ${to} is ${say(next)}.`; }
      } else if (step.op === "catch") {
        if (!ok) { ran = true; next = { state: "fulfilled", value: step.value }; text = `${from} is ${say(prev)}, so .catch runs and returns ${fmtVal(step.value)}. ${to} is ${say(next)}: the error is handled.`; }
        else text = `${from} is ${say(prev)}, so .catch is skipped (it only runs on errors). ${to} gets the same value.`;
      } else if (step.op === "wait") {
        if (ok) { ran = true; waitMs = step.ms; next = { state: "fulfilled", value: prev.value + step.n }; }
      } else if (step.op === "finally") {
        ran = true; logs.push("cleanup");
        text = `${from} is ${say(prev)}. .finally prints "cleanup" and passes the same result on (unless its function throws), so ${to} is ${say(next)}.`;
      }
      if (!ran && !text) text = `${from} is ${say(prev)}, so the .then handler is skipped (it only runs on success). ${to} is ${say(next)}, the same error.`;
      const ev = { kind: ran ? "run" : "skip", k, at: t, step, ran, ...pass(next) };
      if (waitMs) {
        events.push({ ...ev, kind: "wait", pending: true, state: "pending", text: `${from} is ${say(prev)}, so the handler runs and returns a promise that takes ${waitMs} ms. ${to} stays pending until it settles.` });
        t += waitMs;
        events.push({ ...ev, kind: "done", at: t, text: `${waitMs} ms later, the inner promise is fulfilled with ${fmtVal(next.value)}. Now ${to} is ${say(next)}.` });
      } else events.push({ ...ev, text });
      nodes.push({ k, ...next, ran, at: t });
      cur = next;
    });
    const why = nodes.map((nd, k) => events.filter((e) => e.k === k && e.kind !== "create" && e.kind !== "p0").map((e) => e.text).join(" "));
    return { spec, nodes, events, logs, lines: chainLines(spec), why, end: t };
  }

  async function runForReal(spec) {
    const logs = [];
    const cons = { log: (...a) => logs.push(a.map(String).join(" ")) };
    const results = await new Function("console", "later", "fail", `return (async () => {\n${namedSource(spec)}\n})()`)(cons, later, fail);
    return { states: results.map(toState), logs };
  }
  async function runChainText(spec) {
    const logs = [];
    const cons = { log: (...a) => logs.push(a.map(String).join(" ")) };
    const res = await new Function("console", "later", "fail", `return Promise.allSettled([${chainLines(spec).join("\n")}]);`)(cons, later, fail);
    return { final: toState(res[0]), logs };
  }
  const simStates = (sim) => sim.nodes.map((nd) => (nd.state === "fulfilled" ? { state: "fulfilled", value: nd.value } : { state: "rejected", reason: nd.reason }));

  const chains = {
    happy: { id: "happy", title: "A chain that works", start: go.later(300, 2), steps: [st.mul(3), st.wait(200, 1), st.log(), st.add(10)] },
    error: { id: "error", title: "An error skips the .then handlers", start: go.resolve(5), steps: [st.mul(2), st.throws("too big"), st.add(1), st.recover(0), st.add(10), st.fin()] },
    quiz: { id: "quiz", title: "Follow the chain", start: go.resolve(4), steps: [st.add(1), st.throws("oops"), st.mul(2), st.recover(7), st.add(1)] },
  };

  /* ---------- 2. async/await is promises (the same function, two ways) ---------- */
  const PAIR = {
    setup: "const getUser = (id) => later(100, { id, name: \"Mina\" });\nconst getPosts = (userId) => later(100, [1, 2, 3]);",
    setupFail: "const getUser = (id) => fail(100, \"user not found\");\nconst getPosts = (userId) => later(100, [1, 2, 3]);",
    then: [
      "function showPosts(id) {", "  return getUser(id)", "    .then((user) => getPosts(user.id))", "    .then((posts) => console.log(posts.length))",
      "    .catch((err) => console.log(\"failed:\", err.message));", "}",
    ],
    await: [
      "async function showPosts(id) {", "  try {", "    const user = await getUser(id);", "    const posts = await getPosts(user.id);", "    console.log(posts.length);",
      "  } catch (err) {", "    console.log(\"failed:\", err.message);", "  }", "}",
    ],
    /* which lines match each other, step by step */
    map: [
      { then: [1], await: [2], say: "Start the request. With promises it is the first line of the chain; with await, the function pauses here until the answer comes." },
      { then: [2], await: [3], say: "Use the answer. A .then handler gets the value as its argument; with await, the value is the result of the line." },
      { then: [2], await: [3], say: "The handler returns another promise (getPosts), and the chain waits for it. With await, the next line simply waits." },
      { then: [3], await: [4], say: "The last step prints. It reads from top to bottom, like normal code." },
      { then: [4], await: [5, 6], say: "A rejected promise skips the .then handlers and reaches .catch. With await, the error is thrown at the await line, so try/catch gets it." },
    ],
  };
  const pairBody = (variant, failing) => `${failing ? PAIR.setupFail : PAIR.setup}\n${PAIR[variant].join("\n")}\nreturn showPosts(1);`;
  async function runPair(variant, failing) {
    const t0 = performance.now();
    const r = await runSnippet(pairBody(variant, failing));
    return { logs: r.logs, ms: performance.now() - t0 };
  }
  /* Count timer ticks while an awaiting function is paused: the page is NOT frozen. */
  async function awaitTicks(failing = false, onTick = () => {}) {
    let ticks = 0;
    const id = setInterval(() => { ticks++; onTick(ticks); }, 20);
    const r = await runPair("await", failing);
    clearInterval(id);
    return { ticks, ...r };
  }

  /* ---------- 3. One after another, or all together ---------- */
  async function timeRequests(mode, delays, marks = []) {
    const t0 = performance.now();
    const one = async (i) => { marks[i] = { start: performance.now() - t0, end: null }; await later(delays[i]); marks[i].end = performance.now() - t0; };
    if (mode === "sequential") for (let i = 0; i < delays.length; i++) await one(i);
    else await Promise.all(delays.map((_, i) => one(i)));
    return { mode, delays, marks, total: performance.now() - t0 };
  }
  const expectedTotal = (mode, delays) => (mode === "sequential" ? delays.reduce((a, b) => a + b, 0) : Math.max(...delays));
  const PARALLEL_SETS = [{ label: "100, 100, 100 ms", delays: [100, 100, 100] }, { label: "60, 160, 100 ms", delays: [60, 160, 100] }];

  /* ---------- 4. Write promiseAll yourself ---------- */
  const PA_IMPL = `// Your version of Promise.all. It must: keep the order, fail fast, and handle an empty array.
function promiseAll(items) {
  return new Promise((resolve, reject) => {
    const list = Array.from(items);
    const results = new Array(list.length);
    let left = list.length;
    if (left === 0) return resolve(results);
    list.forEach((item, i) => {
      Promise.resolve(item).then((value) => {   // turns a plain value into a promise, like the real one does
        results[i] = value;          // save at position i, not at the end
        if (--left === 0) resolve(results);
      }, reject);                    // the first rejection rejects the whole thing
    });
  });
}`;
  const PA_HARNESS = `
// ---- Edit only promiseAll above. The checks below are only the test. ----
// Each case runs your function and the real Promise.all, then compares.
const later = (ms, v) => new Promise((r) => setTimeout(r, ms, v));
const fail = (ms, msg) => new Promise((_, reject) => setTimeout(reject, ms, new Error(msg)));
const cases = [
  { name: "Keeps the order", make: () => [later(60, "slow"), later(10, "fast"), "plain value"] },
  { name: "Empty array", make: () => [] },
  { name: "Fails fast", make: () => [later(200, "slow"), fail(20, "boom")] },
  { name: "First failure wins", make: () => [fail(60, "late"), fail(10, "early")] },
];
async function observe(fn, items) {
  const t0 = performance.now();
  const stuck = later(400, { stuck: true });
  try {
    const value = await Promise.race([fn(items), stuck]);
    if (value && value.stuck) return { how: "never settled", ms: 400 };
    return { how: "fulfilled", value: JSON.stringify(value), ms: performance.now() - t0 };
  } catch (err) {
    return { how: "rejected", value: String(err), ms: performance.now() - t0 };
  }
}
for (const c of cases) {
  const mine = await observe(promiseAll, c.make());
  const real = await observe((items) => Promise.all(items), c.make());
  const same = mine.how === real.how && mine.value === real.value && Math.abs(mine.ms - real.ms) < 50;
  report(c.name, { pass: same, mine, real });
}`;
  const paReplace = (from, to) => PA_IMPL.replace(from, to);
  const PA_MUTANTS = {
    noIndex: { fails: "Keeps the order", impl: paReplace("results[i] = value;          // save at position i, not at the end", "results.push(value);") },
    sequential: {
      fails: "Fails fast",
      impl: `async function promiseAll(items) {\n  const results = [];\n  for (const item of Array.from(items)) results.push(await item);\n  return results;\n}`,
    },
    noEmpty: { fails: "Empty array", impl: paReplace("if (left === 0) return resolve(results);", "") },
    lastFailure: { fails: "First failure wins", impl: paReplace("}, reject);                    // the first rejection rejects the whole thing", "}, (e) => setTimeout(reject, 70, e));") },
  };
  async function runReports(code) {
    const reports = {};
    const fn = new Function("console", "report", `return (async () => {\n${code}\n})()`);
    await fn({ log() {} }, (name, data) => { reports[name] = data; });
    return reports;
  }

  /* ---------- 5. The combinators (examples run live and in the test) ---------- */
  const COMB = {
    all: {
      kind: "all", lanes: [{ ms: 40, ok: true }, { ms: 90, ok: true }, { ms: 25, ok: false }],
      example: "const results = await Promise.all([later(40, \"user\"), later(10, \"posts\")]);\nconsole.log(results); // the order of the input, not of finishing",
      expect: ["[\"user\",\"posts\"]"],
    },
    allSettled: {
      kind: "allSettled", lanes: [{ ms: 40, ok: true }, { ms: 80, ok: false }, { ms: 20, ok: true }],
      example: "const out = await Promise.allSettled([later(10, \"ok\"), fail(20, \"no\")]);\nconsole.log(out.map((r) => r.status));",
      expect: ["[\"fulfilled\",\"rejected\"]"],
    },
    race: {
      kind: "race", lanes: [{ ms: 90, ok: true }, { ms: 30, ok: true }, { ms: 60, ok: false }],
      example: "const winner = await Promise.race([later(50, \"slow\"), later(10, \"fast\")]);\nconsole.log(winner);",
      expect: ["fast"],
    },
    any: {
      kind: "any", lanes: [{ ms: 20, ok: false }, { ms: 80, ok: true }, { ms: 50, ok: true }],
      example: "const first = await Promise.any([fail(10, \"a\"), later(50, \"second try\"), fail(20, \"b\")]);\nconsole.log(first);",
      expect: ["second try"],
    },
    abort: {
      kind: "abort", lanes: [{ ms: 200, ok: true, abortAt: 20 }],
      example: "const ctrl = new AbortController();\nconst job = waitFor(200, \"data\", ctrl.signal); // like fetch(url, { signal })\nsetTimeout(() => ctrl.abort(), 20);\ntry { await job; } catch (err) { console.log(err.name); }",
      expect: ["AbortError"],
    },
    withResolvers: {
      kind: "withResolvers", lanes: null,
      example: "const { promise, resolve } = Promise.withResolvers();\nsetTimeout(resolve, 20, \"from outside\");\nconsole.log(await promise);",
      expect: ["from outside"],
    },
  };
  /* When does a combinator settle, and how? (drawn in the cards; the test measures real timers) */
  function settleOf(kind, lanes) {
    const byEnd = [...lanes].map((l, i) => ({ ...l, i })).sort((a, b) => a.ms - b.ms);
    const firstBad = byEnd.find((l) => !l.ok);
    const firstGood = byEnd.find((l) => l.ok);
    if (kind === "all") return firstBad ? { at: firstBad.ms, ok: false, lane: firstBad.i } : { at: byEnd[byEnd.length - 1].ms, ok: true, lane: byEnd[byEnd.length - 1].i };
    if (kind === "allSettled") return { at: byEnd[byEnd.length - 1].ms, ok: true, lane: byEnd[byEnd.length - 1].i };
    if (kind === "race") return { at: byEnd[0].ms, ok: byEnd[0].ok, lane: byEnd[0].i };
    if (kind === "any") return firstGood ? { at: firstGood.ms, ok: true, lane: firstGood.i } : { at: byEnd[byEnd.length - 1].ms, ok: false, lane: byEnd[byEnd.length - 1].i };
    return null;
  }
  async function measureComb(kind, lanes) {
    const t0 = performance.now();
    const list = lanes.map((l) => (l.ok ? later(l.ms, "v" + l.ms) : fail(l.ms, "x" + l.ms)));
    let ok = true;
    try { await Promise[kind](list); } catch { ok = false; }
    return { ms: performance.now() - t0, ok };
  }

  /* ---------- 6. Latest result wins ---------- */
  const realClock = { now: () => performance.now(), setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id) };
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  function fakeClock() {
    let time = 0;
    let seq = 0;
    const queue = [];
    return {
      now: () => time,
      setTimeout(fn, ms) { const id = ++seq; queue.push({ id, at: time + ms, fn }); return id; },
      clearTimeout(id) { const i = queue.findIndex((t) => t.id === id); if (i >= 0) queue.splice(i, 1); },
      async advance(ms) {
        const target = time + ms;
        for (;;) {
          queue.sort((a, b) => a.at - b.at || a.id - b.id);
          if (!queue.length || queue[0].at > target) break;
          const t = queue.shift();
          time = t.at;
          t.fn();
          await flush();
        }
        time = target;
        await flush();
      },
    };
  }
  /* Two keystrokes: "re", then "rea" 60 ms later. A fake server answers after `delay` ms. */
  const TYPED = {
    slowFirst: [{ at: 0, q: "re", delay: 400 }, { at: 60, q: "rea", delay: 100 }],
    fastFirst: [{ at: 0, q: "re", delay: 100 }, { at: 60, q: "rea", delay: 400 }],
  };
  const SEARCH_MODES = [
    { id: "none", label: "No fix" }, { id: "id", label: "Request id" }, { id: "abort", label: "AbortController" },
  ];
  function runSearch({ mode, typed, clock = realClock, onEvent = () => {} }) {
    return new Promise((resolve) => {
      const t0 = clock.now();
      const events = [];
      let latest = 0;
      let inflight = null;
      let ended = 0;
      let screen = null;
      let shownReq = 0;
      const emit = (e) => { const ev = { t: clock.now() - t0, ...e }; events.push(ev); onEvent(ev); };
      const finish = () => { if (++ended === typed.length) resolve({ events, shown: screen, mode }); };
      const api = (q, delay, signal) => new Promise((res, rej) => {
        const id = clock.setTimeout(() => res(q), delay);
        if (signal) signal.addEventListener("abort", () => { clock.clearTimeout(id); rej(signal.reason); }, { once: true });
      });
      typed.forEach((key, i) => clock.setTimeout(async () => {
        const req = i + 1;
        const mine = ++latest;
        let signal;
        if (mode === "abort") {
          if (inflight) { emit({ kind: "abort", req: inflight.req, q: inflight.q }); inflight.ctrl.abort(); }
          inflight = { req, q: key.q, ctrl: new AbortController() };
          signal = inflight.ctrl.signal;
        }
        emit({ kind: "send", req, q: key.q });
        try {
          const q = await api(key.q, key.delay, signal);
          const stale = mine !== latest;           // a newer keystroke exists
          const ignored = mode === "id" && stale;  // the request-id fix drops it
          const overwrote = !ignored && shownReq > req; // an old answer replaces a newer one on screen
          if (!ignored) { screen = q; shownReq = req; }
          emit({ kind: "arrive", req, q, stale, ignored, overwrote, screen });
        } catch (err) {
          if (!err || err.name !== "AbortError") throw err; // handle AbortError quietly, nothing else
        }
        finish();
      }, key.at));
    });
  }
  const SEARCH_CODE = {
    none: "// No fix: every answer is shown, in the order it arrives.\nconst data = await search(query);\nsetResults(data);",
    id: "// Fix 1: remember which request is the newest.\nlet latest = 0;\nasync function onType(query) {\n  const mine = ++latest;\n  const data = await search(query);\n  if (mine !== latest) return; // an older answer: ignore it\n  setResults(data);\n}",
    abort: "// Fix 2: cancel the old request when a new one starts.\nlet controller;\nasync function onType(query) {\n  controller?.abort();\n  controller = new AbortController();\n  try {\n    const data = await search(query, { signal: controller.signal });\n    setResults(data);\n  } catch (err) {\n    if (err.name !== \"AbortError\") throw err; // cancelled on purpose: stay quiet\n  }\n}",
  };

  /* ---------- 7. Retry with backoff and jitter ---------- */
  const RETRY_IMPL = `// A sleep that stops at once if the signal is aborted.
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const id = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(id); reject(signal.reason); });
});

async function retry(task, { retries = 4, base = 20, max = 200, signal, random = Math.random, onWait } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task(attempt);
    } catch (err) {
      if (attempt >= retries || signal?.aborted) throw err;       // out of tries, or cancelled
      const cap = Math.min(max, base * 2 ** attempt);              // 20, 40, 80, 160, 200 ...
      const wait = Math.round(random() * cap);                     // jitter: a random time from 0 to cap
      onWait?.(attempt + 1, wait, cap);
      await sleep(wait, signal);
    }
  }
}`;
  const RETRY_DEMO = `
// ---- Try it. The "random" numbers are fixed, so every run gives the same waits. ----
const rolls = [0.5, 0.9, 0.3, 0.7];
let r = 0;
let calls = 0;
const waits = [];
const flaky = async () => { calls++; if (calls < 4) throw new Error("server busy"); return "data"; };
const result = await retry(flaky, { random: () => rolls[r++], onWait: (n, wait, cap) => waits.push({ n, wait, cap }) });
report("Retry until it works", { result, calls, waits });

// A new query arrives while we wait: cancel the retry.
const controller = new AbortController();
let calls2 = 0;
const alwaysFails = async () => { calls2++; throw new Error("server busy"); };
let outcome = "finished";
try {
  await retry(alwaysFails, { signal: controller.signal, random: () => 0.5, onWait: (n) => { if (n === 2) controller.abort(); } });
} catch (err) {
  outcome = err.name;
}
report("A new query cancels the retry", { outcome, calls: calls2 });`;

  /* ---------- 8. From your work: optimistic seat booking (a small model of the hook, not the hook itself) ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const SEAT_BOOKING = { name: "Sam", party: 4 };
  const SEAT_START = { T3: { name: "Lee", party: 2, pending: false }, T4: null, T5: null };
  function seatTrace(scenario) {
    const tables = clone(SEAT_START);
    const frames = [{ kind: "start", tables: clone(tables), text: "Sam's booking (4 people) waits in the list. Table T4 is empty." }];
    const prior = tables.T4;
    tables.T4 = { ...SEAT_BOOKING, pending: true };
    frames.push({ kind: "optimistic", tables: clone(tables), text: "The host drops Sam on T4. onMutate saves the old state of T4 and shows Sam at once, marked pending (a ghost)." });
    frames.push({ kind: "waiting", tables: clone(tables), text: "The request travels to the server. The screen already shows the guess, so the app feels fast." });
    if (scenario === "success") {
      tables.T4 = { ...SEAT_BOOKING, pending: false };
      frames.push({ kind: "confirmed", tables: clone(tables), text: "The server says OK. The refetch brings the confirmed booking, and T4 turns solid." });
    } else {
      tables.T4 = prior;
      frames.push({ kind: "rollback", tables: clone(tables), toast: "Seat assignment failed", text: "The server says no. onError puts back the state saved in onMutate: T4 is empty again, and the host sees an error." });
    }
    return frames;
  }
  async function seatReal(scenario) {
    const store = clone(SEAT_START);
    const snaps = [clone(store)];
    const api = () => later(5).then(() => { if (scenario !== "success") throw new Error("Seat assignment failed"); });
    const prior = store.T4;                                   // onMutate: remember
    store.T4 = { ...SEAT_BOOKING, pending: true };            // onMutate: guess
    snaps.push(clone(store));
    try {
      await api();                                            // mutationFn
      store.T4 = { ...SEAT_BOOKING, pending: false };         // the refetch confirms
    } catch {
      store.T4 = prior ?? null;                               // onError: restore
    }
    snaps.push(clone(store));
    return snaps;
  }
  /* Excerpts of C:\\Projects\\JOBS\\Speako\\speako-web\\src\\components\\floor-plan-v2\\hooks\\useSeatBooking.ts (verbatim; the test compares them with the file). */
  const SEAT_FILE = "src/components/floor-plan-v2/hooks/useSeatBooking.ts";
  const SEAT_EXCERPTS = [
    { from: 82, to: 96, text: [
      "    onMutate: async ({ booking, shapeId }) => {",
      "      const state = store.getState();",
      "      const prior = state.bookingsByTableId[shapeId];",
      "",
      "      const optimistic: TableBooking = {",
      "        bookingId: booking.bookingId,",
      "        bookingRef: booking.bookingRef,",
      "        customerName: booking.customerName ?? \"Guest\",",
      "        partySize: booking.partySize ?? 0,",
      "        pending: true,",
      "      };",
      "      state.setBookingForTable(shapeId, optimistic);",
      "",
      "      return { shapeId, prior };",
      "    },",
    ] },
    { from: 133, to: 140, text: [
      "    onError: (_error, _vars, context) => {",
      "      if (!context) return;",
      "      // Restore whatever was on the table before the optimistic stamp.",
      "      store.getState().setBookingForTable(",
      "        context.shapeId,",
      "        context.prior ?? null,",
      "      );",
      "    },",
    ] },
  ];

  /* ---------- 9. Interview answers that contain code ---------- */
  const EMITTER_SRC = `function createEmitter() {
  const handlers = new Map(); // event name -> Set of functions
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => handlers.get(name).delete(fn); // call this to unsubscribe
    },
    emit(name, ...args) {
      for (const fn of [...(handlers.get(name) ?? [])]) fn(...args);
    },
  };
}`;
  const PRACTICE = {
    forEach: "const out = [];\n[1, 2].forEach(async (n) => {\n  await later(10);\n  out.push(n);\n});\nconsole.log(\"after the loop:\", out.length);\nawait later(50);\nconsole.log(\"later:\", out.length);",
    throwsInAsync: "async function boom() { throw new Error(\"no\"); }\nconst p = boom();\nconsole.log(p instanceof Promise);\ntry { await p; } catch (err) { console.log(\"caught\", err.message); }\ntry { boom().catch(() => {}); } catch { console.log(\"never printed\"); }\nconsole.log(\"the call did not throw\");",
    allVsSettled: "const jobs = [later(10, \"a\"), fail(20, \"b\"), later(30, \"c\")];\ntry { await Promise.all(jobs); } catch (err) { console.log(\"all:\", err.message); }\nconst s = await Promise.allSettled(jobs);\nconsole.log(\"allSettled:\", s.map((r) => r.status).join(\", \"));",
  };

  /* The program for the "where does await pause?" page. Its order comes from the event-loop simulator (passed in as Sim). */
  const awaitProgram = (Sim) => {
    const { L, A } = Sim.ops;
    return { id: "awaitOrder", title: "await pauses the function", ops: [L("start"), A(L("work: before await"), L("work: after await"), "work"), L("end")] };
  };

  /* What the three practice snippets print. The page shows these; the test runs the snippets and compares. */
  const PRACTICE_EXPECT = {
    forEach: ["after the loop: 0", "later: 2"],
    throwsInAsync: ["true", "caught no", "the call did not throw"],
    allVsSettled: ["all: b", "allSettled: fulfilled, rejected, fulfilled"],
  };

  return {
    later, fail, waitFor, fmtVal, runSnippet, HELPERS_SRC, toState,
    steps: st, starts: go, chains, simulate, runForReal, runChainText, simStates, chainLines, namedSource,
    PAIR, runPair, awaitTicks, pairBody,
    timeRequests, expectedTotal, PARALLEL_SETS,
    PA_IMPL, PA_HARNESS, PA_MUTANTS, runReports,
    COMB, settleOf, measureComb,
    fakeClock, realClock, TYPED, SEARCH_MODES, runSearch, SEARCH_CODE,
    RETRY_IMPL, RETRY_DEMO,
    SEAT_START, SEAT_FILE, SEAT_EXCERPTS, seatTrace, seatReal,
    EMITTER_SRC, PRACTICE, PRACTICE_EXPECT, awaitProgram,
  };
});
