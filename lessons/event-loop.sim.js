/* The event-loop simulator: the single source of truth for the "event-loop" lesson.
   A program is DATA (a tree of operations). From that data we make:
     1. real JavaScript source code for the program (what the reader sees AND what the test runs in Node),
     2. a trace: frames with the call stack, the browser's timers, task queue, microtask queue, rAF list, console and a caption.
   Every film, stepper and "correct answer" in the lesson is generated from run(). Nothing is typed by hand.

   Model (HTML spec, simplified):
     task 1 = the script. When the stack is empty, drain ALL microtasks (including ones added meanwhile),
     then a paint check (if a frame is due: rAF callbacks, then paint), then the next task.
     A timer enters the task queue when its time is up; tasks are ordered by expiry, then by call order.
     await resumes as a microtask (the awaited value is already settled). No 4 ms clamp for nested timers.
   Works in the browser (Book.parts["event-loop"].sim) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["event-loop"] = root.Book.parts["event-loop"] || {}).sim = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const FRAME_MS = 1000 / 60;
  const EPS = 1e-6;
  const arr = (x) => (Array.isArray(x) ? x : [x]);
  const round1 = (n) => Math.round(n * 10) / 10;

  /* ---------- 1. Operations (the program is data) ---------- */
  const ops = {
    L: (text) => ({ op: "log", text }),
    T: (ms, ...body) => ({ op: "setTimeout", ms, body }),
    P: (...cbs) => ({ op: "promiseThen", chain: cbs.map(arr) }),
    Q: (...body) => ({ op: "queueMicrotask", body }),
    A: (before, after, name) => ({ op: "asyncFn", before: arr(before), after: arr(after), name }),
    NP: (executor, ...cbs) => ({ op: "newPromise", executor: arr(executor), chain: cbs.map(arr) }),
    R: (...body) => ({ op: "raf", body }),
    BUSY: (ms) => ({ op: "busy", ms }),
    SPIN: (...body) => ({ op: "microLoop", body }),
  };

  /* The bodies (lists of operations) that an operation contains. */
  const bodiesOf = (o) => {
    switch (o.op) {
      case "setTimeout": case "queueMicrotask": case "raf": case "microLoop": return [o.body];
      case "promiseThen": return o.chain;
      case "asyncFn": return [o.before, o.after];
      case "newPromise": return [o.executor, ...o.chain];
      default: return [];
    }
  };
  const firstLog = (list) => {
    for (const o of list) {
      if (o.op === "log") return o.text;
      for (const b of bodiesOf(o)) { const t = firstLog(b); if (t) return t; }
    }
    return null;
  };
  const allLogs = (list, out = []) => {
    for (const o of list) {
      if (o.op === "log") out.push(o.text);
      for (const b of bodiesOf(o)) allLogs(b, out);
    }
    return out;
  };

  /* Copy the program and give every operation an id (and every async function a name). */
  function prepare(program) {
    let n = 0;
    let fns = 0;
    let spins = 0;
    const walk = (list) => list.map((o) => {
      const c = { ...o, id: "o" + ++n };
      if (c.op === "asyncFn") c.name = c.name || "fn" + ++fns;
      if (c.op === "microLoop") c.name = "spin" + ++spins;
      if (c.body) c.body = walk(c.body);
      if (c.chain) c.chain = c.chain.map(walk);
      if (c.before) c.before = walk(c.before);
      if (c.after) c.after = walk(c.after);
      if (c.executor) c.executor = walk(c.executor);
      return c;
    });
    return { id: program.id, title: program.title, ops: walk(program.ops) };
  }

  /* ---------- 2. Real JavaScript source for the program ---------- */
  const PRELUDE = "function busy(ms) { const end = Date.now() + ms; while (Date.now() < end) {} }\n";

  function generate(prog) {
    const lines = [];
    const at = {};
    const put = (ind, text, key) => {
      lines.push("  ".repeat(ind) + text);
      if (key) at[key] = lines.length - 1;
    };
    const block = (list, ind) => list.forEach((o) => stmt(o, ind));
    const chain = (o, cbs, ind, first) => cbs.forEach((b, i) => {
      put(ind, ".then(() => {", `${o.id}.${i}`);
      block(b, ind + 1);
      put(ind, i === cbs.length - 1 ? "});" : "})");
    });
    function stmt(o, ind) {
      switch (o.op) {
        case "log": return put(ind, `console.log(${JSON.stringify(o.text)});`, o.id);
        case "busy": return put(ind, `busy(${o.ms}); // a loop that waits ${o.ms} ms`, o.id);
        case "setTimeout":
          put(ind, "setTimeout(() => {", o.id);
          block(o.body, ind + 1);
          return put(ind, `}, ${o.ms});`);
        case "queueMicrotask":
          put(ind, "queueMicrotask(() => {", o.id);
          block(o.body, ind + 1);
          return put(ind, "});");
        case "raf":
          put(ind, "requestAnimationFrame(() => {", o.id);
          block(o.body, ind + 1);
          return put(ind, "});");
        case "promiseThen":
          put(ind, "Promise.resolve()", o.id);
          return chain(o, o.chain, ind + 1);
        case "newPromise":
          put(ind, "new Promise((resolve) => {", o.id);
          block(o.executor, ind + 1);
          put(ind + 1, "resolve();");
          if (!o.chain.length) return put(ind, "});");
          put(ind, "})");
          return chain(o, o.chain, ind + 1);
        case "asyncFn":
          put(ind, `async function ${o.name}() {`, `${o.id}.def`);
          block(o.before, ind + 1);
          put(ind + 1, "await null;", `${o.id}.await`);
          block(o.after, ind + 1);
          put(ind, "}");
          return put(ind, `${o.name}();`, o.id);
        case "microLoop":
          put(ind, `function ${o.name}() {`, `${o.id}.def`);
          block(o.body, ind + 1);
          put(ind + 1, `queueMicrotask(${o.name});`, `${o.id}.again`);
          put(ind, "}");
          return put(ind, `queueMicrotask(${o.name});`, o.id);
        default: throw new Error("Unknown operation: " + o.op);
      }
    }
    block(prog.ops, 0);
    return { lines, at };
  }

  /* ---------- 3. The simulator ---------- */
  function simulate(program, opts = {}) {
    const prog = prepare(program);
    const gen = generate(prog);
    const at = gen.at;
    const microCap = opts.microCap ?? 5000;
    const S = {
      time: 0, frameNo: 1, seq: 0, nItem: 0, taskNo: 0, groupNo: 0, dropped: 0,
      stack: [], apis: [], tasks: [], micro: [], raf: [], out: [], items: {}, frames: [], group: null,
      stopped: false, truncated: false,
    };

    const mk = (kind, label, sub, extra = {}) => {
      const id = "i" + ++S.nItem;
      S.items[id] = { id, kind, label, sub, ...extra };
      return id;
    };
    const setGroup = (title) => { S.group = { id: "g" + ++S.groupNo, title }; };
    const snap = (kind, caption, line, extra = {}) => {
      S.frames.push({
        i: S.frames.length, kind, caption, line: line == null ? null : line, time: round1(S.time), group: S.group,
        stack: [...S.stack], apis: [...S.apis], tasks: [...S.tasks], micro: [...S.micro], raf: [...S.raf], out: S.out.length, ...extra,
      });
    };
    const name = (id) => S.items[id].label;
    const mkThen = (o, idx, born) => mk("then", firstLog(o.chain[idx]) || "then", idx === 0 ? "then" : "then #" + (idx + 1), { op: o, idx, born });

    function exec(list, ctx) { for (const o of list) step(o, ctx); }

    function step(o, ctx) {
      const callItem = (label, sub) => { const c = mk("call", label, sub); S.stack.push(c); return c; };
      switch (o.op) {
        case "log": {
          callItem("console.log", `"${o.text}"`);
          S.out.push(o.text);
          snap("log", `console.log prints “${o.text}” to the console.`, at[o.id], {
            logged: o.text,
            ctx: { kind: ctx.kind, born: ctx.born, micro: S.micro.map(name), timers: S.apis.filter((i) => S.items[i].kind === "timer").map(name), tasks: S.tasks.map(name) },
          });
          S.stack.pop();
          return;
        }
        case "setTimeout": {
          callItem("setTimeout", `${o.ms} ms`);
          S.apis.push(mk("timer", firstLog(o.body) || "callback", `setTimeout ${o.ms} ms`, { ms: o.ms, expiry: S.time + o.ms, seq: ++S.seq, op: o, born: ctx.kind }));
          snap("timer-set", `setTimeout gives the timer to the browser. The browser counts ${o.ms} ms. ` + (o.ms === 0 ? "Even at 0 ms, the callback must wait for an empty stack." : "The callback is not on the stack."), at[o.id]);
          S.stack.pop();
          return;
        }
        case "promiseThen": {
          callItem("then()", "Promise");
          S.micro.push(mkThen(o, 0, ctx.kind));
          snap("then-set", "This promise is already done, so its then-callback goes straight into the microtask queue.", at[o.id]);
          S.stack.pop();
          return;
        }
        case "queueMicrotask": {
          callItem("queueMicrotask", "adds a microtask");
          S.micro.push(mk("qm", firstLog(o.body) || "microtask", "queueMicrotask", { op: o, born: ctx.kind }));
          snap("then-set", "queueMicrotask puts the callback into the microtask queue.", at[o.id]);
          S.stack.pop();
          return;
        }
        case "microLoop": {
          callItem("queueMicrotask", "adds a microtask");
          S.micro.push(mk("spin", firstLog(o.body) || o.name, "queueMicrotask", { op: o, born: ctx.kind }));
          snap("then-set", `queueMicrotask puts ${o.name} into the microtask queue. When it runs, it will add itself again.`, at[o.id]);
          S.stack.pop();
          return;
        }
        case "raf": {
          callItem("requestAnimationFrame", "asks for a frame");
          S.raf.push(mk("raf", firstLog(o.body) || "frame callback", "requestAnimationFrame", { op: o, born: ctx.kind }));
          snap("raf-set", "requestAnimationFrame asks the browser to run this callback just before the next paint. It waits in the rAF list.", at[o.id]);
          S.stack.pop();
          return;
        }
        case "busy": {
          callItem(`busy(${o.ms})`, "long loop");
          const from = S.time;
          S.time += o.ms;
          snap("busy", `A long loop keeps the thread busy for ${o.ms} ms. While it runs, nothing else can happen: no timers, no clicks, no painting.`, at[o.id], { busy: { from, to: S.time } });
          S.stack.pop();
          promoteExpired(`${o.ms} ms passed while the thread was busy.`);
          return;
        }
        case "asyncFn": {
          const f = callItem(`${o.name}()`, "async function");
          snap("call", `${o.name}() is called. An async function runs like a normal function until its first await.`, at[o.id]);
          exec(o.before, { ...ctx, item: f });
          S.stack.pop();
          S.micro.push(mk("await", firstLog(o.after) || o.name, "after await", { op: o, born: ctx.kind }));
          snap("await", `await pauses ${o.name}(). The rest of it goes into the microtask queue, and the stack is free again.`, at[`${o.id}.await`]);
          return;
        }
        case "newPromise": {
          callItem("new Promise", "runs now");
          snap("call", "new Promise runs its function right away, not later. The executor is normal, synchronous code.", at[o.id]);
          exec(o.executor, ctx);
          S.stack.pop();
          if (o.chain.length) {
            S.micro.push(mkThen(o, 0, ctx.kind));
            snap("then-set", "resolve() was called, so the promise is done. Its then-callback goes into the microtask queue.", at[`${o.id}.0`]);
          }
          return;
        }
        default: throw new Error("Unknown operation: " + o.op);
      }
    }

    /* Move expired timers from Web APIs to the task queue: earliest first, then in call order. */
    function promoteExpired(reason) {
      const due = S.apis
        .filter((id) => S.items[id].kind === "timer" && S.items[id].expiry <= S.time + EPS)
        .sort((a, b) => S.items[a].expiry - S.items[b].expiry || S.items[a].seq - S.items[b].seq);
      if (!due.length) return false;
      S.apis = S.apis.filter((id) => !due.includes(id));
      S.tasks.push(...due);
      if (!S.group || S.group.title.startsWith("Paint check")) setGroup("A timer is ready");
      snap("expire", (reason ? reason + " " : "") + (due.length === 1 ? "A timer is done: its callback moves to the task queue." : `${due.length} timers are done. Their callbacks move to the task queue, earliest first.`), null);
      return true;
    }

    const RUN_CAPTION = {
      script: "The script is the first task. It moves onto the call stack and runs from top to bottom.",
      timer: "The loop takes the first task from the task queue. The timer's callback moves onto the call stack.",
      then: "Microtask: the loop takes the next callback from the microtask queue and runs it.",
      await: "Microtask: the function continues after its await.",
      qm: "Microtask: the queueMicrotask callback runs.",
      spin: "Microtask: it runs, and it will add itself to the queue again.",
      raf: "A frame is due. This rAF callback runs just before the paint.",
    };
    const HEADER = { timer: (it) => it.op.id, then: (it) => `${it.op.id}.${it.idx}`, await: (it) => `${it.op.id}.await`, qm: (it) => it.op.id, spin: (it) => `${it.op.id}.def`, raf: (it) => it.op.id };

    /* A callback moves from its queue onto the call stack, runs, and leaves. */
    function runItem(id) {
      const it = S.items[id];
      S.stack.push(id);
      snap("run", RUN_CAPTION[it.kind], it.kind === "script" ? null : at[HEADER[it.kind](it)]);
      const ctx = { kind: it.kind, born: it.born, item: id };
      if (it.kind === "script") exec(prog.ops, ctx);
      else if (it.kind === "then") exec(it.op.chain[it.idx], ctx);
      else if (it.kind === "await") exec(it.op.after, ctx);
      else exec(it.op.body, ctx);
      S.stack.pop();
      if (it.kind === "then" && it.idx + 1 < it.op.chain.length) {
        S.micro.push(mkThen(it.op, it.idx + 1, "then"));
        snap("then-next", "That then-callback is done, so its promise is done too. The next .then goes to the end of the microtask queue.", at[`${it.op.id}.${it.idx + 1}`]);
      }
      if (it.kind === "spin") {
        S.micro.push(mk("spin", it.label, "queueMicrotask", { op: it.op, born: "spin" }));
        snap("then-next", `${it.op.name} added itself to the microtask queue again.`, at[`${it.op.id}.again`]);
      }
    }

    function drain(title) {
      if (!S.micro.length) return;
      if (title) setGroup(title);
      let n = 0;
      while (S.micro.length) {
        if (n >= microCap) {
          S.truncated = true;
          S.stopped = true;
          snap("cap", `The simulator stops after ${microCap} microtasks. A real page would never get out of this loop: the task queue and the paint would wait forever.`, null);
          return;
        }
        runItem(S.micro.shift());
        n++;
      }
      snap("micro-end", "The microtask queue is empty. The loop can move on.", null);
    }

    function renderCheck() {
      setGroup("Paint check");
      if (S.time + EPS < S.frameNo * FRAME_MS) {
        const wait = Math.ceil(S.frameNo * FRAME_MS - S.time);
        snap("render-skip", `Paint check: the next frame is due in ${wait} ms, so the browser does not paint now.` + (S.raf.length ? " The rAF callbacks wait for that frame." : ""), null);
        return;
      }
      snap("render-due", S.raf.length ? "A frame is due. First the rAF callbacks run, then the browser paints." : "A frame is due. No rAF callbacks are waiting, so the browser goes straight to painting.", null);
      for (const id of [...S.raf]) {
        S.raf.splice(S.raf.indexOf(id), 1);
        runItem(id);
        drain();
        if (S.stopped) return;
      }
      const cur = Math.floor(S.time / FRAME_MS + EPS);
      const missed = Math.max(0, cur - S.frameNo);
      S.dropped += missed;
      snap("paint", missed > 0
        ? `Paint. But the page could not paint for a while: about ${missed} frame${missed === 1 ? " was" : "s were"} lost because the thread was busy.`
        : "Paint. The browser draws the new frame on the screen.", null, { paint: true, missed });
      S.frameNo = cur + 1;
    }

    /* ---- the loop ---- */
    S.tasks.push(mk("script", "script", "the first task"));
    setGroup("The page starts");
    snap("start", "The page starts. The script is the first task in the task queue.", null);
    let guard = 0;
    while (!S.stopped && guard++ < 20000 && S.frames.length < 4000) {
      promoteExpired();
      if (S.tasks.length) {
        const id = S.tasks.shift();
        const it = S.items[id];
        setGroup(it.kind === "script" ? `Task ${++S.taskNo}: the script` : `Task ${++S.taskNo}: timer “${it.label}”`);
        runItem(id);
        snap("task-end", S.micro.length ? "The callback is done and the call stack is empty. Before the next task, the loop empties the microtask queue." : "The callback is done and the call stack is empty. No microtasks are waiting.", null);
        drain("Microtasks");
        if (S.stopped) break;
        renderCheck();
        continue;
      }
      const timers = S.apis.filter((id) => S.items[id].kind === "timer").map((id) => S.items[id].expiry);
      const target = Math.min(timers.length ? Math.min(...timers) : Infinity, S.raf.length ? S.frameNo * FRAME_MS : Infinity);
      if (target === Infinity) break;
      const waited = Math.round(target - S.time);
      S.time = Math.max(S.time, target);
      setGroup("Waiting");
      if (!promoteExpired(`Nothing is running, so the loop waits (${waited} ms).`)) {
        snap("idle", `Nothing is running, so the loop waits ${waited} ms for the next frame.`, null);
        renderCheck();
      }
    }
    setGroup("Done");
    snap("end", S.truncated ? "Stopped (see the last step)." : "Nothing is left to run. The loop is idle.", null);

    return {
      program: prog, frames: S.frames, items: S.items, console: S.out, endTime: S.time, truncated: S.truncated,
      dropped: S.dropped, lines: gen.lines, at, code: gen.lines.join("\n"),
    };
  }

  /* ---------- 4. Run the generated code for real (browser or Node) ---------- */
  function runForReal(program) {
    const r = simulate(program, { microCap: 50 });
    if (r.truncated) return Promise.reject(new Error("This program never ends; it is not run for real."));
    return new Promise((resolve, reject) => {
      const out = [];
      let pending = 0;
      const check = () => setTimeout(() => { if (pending === 0) resolve(out); }, 0);
      const wrapped = (fn, ms) => {
        pending++;
        return setTimeout(() => {
          pending--;
          try { fn(); } catch (e) { reject(e); return; }
          check();
        }, ms);
      };
      try {
        new Function("console", "setTimeout", PRELUDE + r.code)({ log: (...a) => out.push(a.join(" ")) }, wrapped);
      } catch (e) { reject(e); return; }
      check();
    });
  }

  /* ---------- 5. Helpers the visuals use ---------- */
  /* Why did this line log at this moment? Plain English, from the frame's own context. */
  function reasonFor(f) {
    const c = f.ctx || {};
    const timers = c.timers && c.timers.length ? c.timers : c.tasks || [];
    const waitingTimer = timers.length ? ` It runs before the timer “${timers[0]}”.` : "";
    switch (c.kind) {
      case "script": return "The script is one task, and it runs from top to bottom without stopping. Plain (synchronous) lines always go first.";
      case "then": case "qm": case "await": {
        const how = c.kind === "await" ? "await put the rest of the function into the microtask queue" : "This callback is a microtask";
        const late = c.born === "then" || c.born === "await" || c.born === "qm" ? " It joined the line late, so it runs after the callbacks already waiting." : "";
        return `${how}. Microtasks run when the stack is empty, before any task.${waitingTimer}${late} The queue is a line: first to join, first to run.`;
      }
      case "timer": return "A timer callback is a task. Tasks wait until the script and all microtasks are done. Then they run one at a time, earliest timer first.";
      case "raf": return "rAF callbacks run when a frame is due, just before the paint.";
      default: return "";
    }
  }
  /* The log lines of a finished run, each with its reason and the source line. */
  const logSteps = (result) => result.frames.filter((f) => f.kind === "log").map((f) => ({ text: f.logged, line: f.line, frame: f.i, why: reasonFor(f), ctx: f.ctx }));
  /* Order in which console.log lines appear when you read the code top to bottom. */
  const sourceOrder = (program) => allLogs(prepare(program).ops);
  /* Order if you believed: sync first, then (A) timers, then promises, or (B) promises, then timers, or (C) promises first. */
  function kindOrders(result) {
    const steps = logSteps(result);
    const group = (k) => (k === "script" ? 0 : k === "timer" ? 1 : k === "raf" ? 1 : 2);
    const by = (order) => [...steps].sort((a, b) => order.indexOf(group(a.ctx.kind)) - order.indexOf(group(b.ctx.kind)) || a.frame - b.frame).map((s) => s.text);
    return { correct: by([0, 2, 1]), timersFirst: by([0, 1, 2]), promisesFirst: by([2, 0, 1]) };
  }

  /* ---------- 6. Named programs ---------- */
  const { L, T, P, Q, A, NP, R, BUSY, SPIN } = ops;
  const nest = (n, make, i = 0) => (i >= n ? [] : make(i, nest(n, make, i + 1)));
  const programs = {
    basic: { id: "basic", title: "Sync, timer, promise", ops: [L("A"), T(0, L("B")), P(L("C")), L("D")] },
    harder: {
      id: "harder", title: "Async function, nested promise, timer inside a promise",
      ops: [
        L("A"),
        T(0, L("T1"), P(L("T2"))),
        A(L("B"), L("C"), "load"),
        P([L("D"), P(L("E")), T(0, L("F"))]),
        L("G"),
      ],
    },
    asyncOrder: {
      id: "asyncOrder", title: "async / await",
      ops: [L("start"), T(0, L("timer")), A(L("fn: before await"), L("fn: after await"), "work"), P(L("then")), L("end")],
    },
    nested: {
      id: "nested", title: "A promise inside a promise",
      ops: [L("start"), T(0, L("timer")), P([L("then 1"), P(L("nested then"))]), P(L("then 2")), L("end")],
    },
    chains: { id: "chains", title: "Two promise chains", ops: [P([L("1")], [L("2")]), P([L("3")], [L("4")])] },
    microVsThen: { id: "microVsThen", title: "queueMicrotask and then", ops: [P(L("then 1")), Q(L("queueMicrotask")), P(L("then 2")), T(0, L("timeout")), L("sync")] },
    timers: { id: "timers", title: "Timers with different times", ops: [T(30, L("30 ms")), T(30, L("30 ms (second)")), T(10, L("10 ms"), T(30, L("10 + 30 ms"))), T(0, L("0 ms")), L("sync")] },
    thenInTimer: { id: "thenInTimer", title: "A promise inside a timer", ops: [T(0, L("timer 1"), P(L("then in timer 1"))), T(0, L("timer 2")), L("sync")] },
    timerInThen: { id: "timerInThen", title: "A timer inside a promise", ops: [P([L("then"), T(0, L("timer from then"))]), T(20, L("timer 20 ms")), L("sync")] },
    puzzle: {
      id: "puzzle", title: "A well-known puzzle",
      ops: [
        L("script start"),
        T(0, L("setTimeout")),
        A([L("async1 start"), L("async2")], L("async1 end"), "async1"),
        NP(L("promise1"), L("promise2")),
        L("script end"),
      ],
    },
    busyTimer: { id: "busyTimer", title: "A busy loop delays a timer", ops: [T(0, L("timer")), BUSY(50), P(L("then")), L("end")] },
    /* Browser rule: a timer's time starts when setTimeout is called. Node starts it from a cached loop time, so Node can differ here; this one is NOT compared with Node. */
    busyBetween: { id: "busyBetween", title: "A busy loop between two timers", ops: [T(10, L("timer 10 ms")), BUSY(50), T(0, L("timer 0 ms")), L("end")] },
    freeze: { id: "freeze", title: "One long task", ops: [R(L("frame")), BUSY(120), L("done")] },
    starve: { id: "starve", title: "An endless microtask", ops: [T(0, L("timer")), SPIN(L("tick")), L("sync")] },
    longTask: { id: "longTask", title: "One long task", ops: [BUSY(120)] },
    chunked: { id: "chunked", title: "The same work in chunks", ops: nest(12, (i, rest) => [T(0, BUSY(10), ...rest)]) },
    timeoutAnim: { id: "timeoutAnim", title: "Animation with setTimeout", ops: nest(10, (i, rest) => [T(20, L("update"), ...rest)]) },
    rafAnim: { id: "rafAnim", title: "Animation with requestAnimationFrame", ops: nest(10, (i, rest) => [R(L("update"), ...rest)]) },
  };

  return { FRAME_MS, ops, programs, simulate, run: simulate, generate: (p) => generate(prepare(p)), PRELUDE, runForReal, logSteps, reasonFor, sourceOrder, kindOrders, allLogs };
});
