/* Scope and closures: the films and the guided pages. Every box, arrow, caption and printed value comes from the
   mini-interpreter (js-scope-closures.data.js), which dev/js-scope-closures.test.js checks against real Node.
   Real runs (the loop bug, hoisting errors, debounce timers) happen live in the reader's browser. */
(function () {
  const { h, guided, svg: S } = Book;
  const V = Book.parts["js-scope-closures"];
  const D = V.data;
  const PR = D.programs;
  const cache = {};
  const R = (id) => (cache[id] = cache[id] || D.run(PR[id]));

  /* ---------- shared: code with a lit line, a console, and nested boxes ---------- */
  function codeView(lines, bare) {
    const els = lines.map((t) => h("span.sc-ln", { html: Book.highlight(t) || " " }));
    const el = h("pre.code-block.sc-code", { "aria-label": "The program" }, els);
    return { el, mark(lit) { els.forEach((e, i) => e.classList.toggle("lit", i === lit)); } };
  }
  function consoleBox(title = "Console") {
    const body = h("div.sc-con-body", { "aria-live": "polite" });
    return { el: h("div.sc-console", h("span.label", title), body), set(lines) { body.replaceChildren(...lines.map((t) => h("div.sc-con-line", t))); } };
  }
  /* Boxes nested inside their parent boxes. Only boxes that exist (and are not freed) in this frame. */
  function nestView(res, f) {
    const kids = {};
    res.envs.forEach((e) => { if (e.vis && e.id < f.envs.length && !f.envs[e.id].dead) (kids[e.parent == null ? -1 : e.parent] = kids[e.parent == null ? -1 : e.parent] || []).push(e); });
    const label = (id) => res.envs[id].label;
    const box = (e) => h("div.sc-box", { "data-env": e.id },
      h("span.sc-box-name", e.label),
      f.envs[e.id].vars.map((v) => h("div.sc-vrow", { "data-var": `${e.id}:${v.n}` },
        h("code", v.n), " = ", h("span.sc-val" + (v.tdz ? ".dead" : ""), v.v),
        v.f && v.f.to != null ? h("span.sc-ptr", ` → created in ${label(v.f.to)}`) : null)),
      (kids[e.id] || []).map(box));
    const el = h("div.sc-nest", (kids[-1] || []).map(box));
    return {
      el,
      box: (id) => el.querySelector(`[data-env="${id}"]`),
      row: (id, n) => el.querySelector(`[data-var="${id}:${n}"]`),
      clear() { el.querySelectorAll(".look,.found").forEach((x) => x.classList.remove("look", "found")); },
    };
  }
  const outLines = (r) => (r.error ? [...r.logs, `${r.error.name}: ${r.error.message}`] : r.logs);
  const joinC = (a) => a.join(", ");
  const codeOf = (id) => R(id).lines;
  const showRun = async (con, res, ctx) => { const lines = outLines(res); for (let i = 1; i <= lines.length; i++) { con.set(lines.slice(0, i)); await ctx.wait(240); } if (!lines.length) con.set(["(nothing printed)"]); };

  /* ---------- 01. Why does this loop print 3, 3, 3? (the real problem, run for real) ---------- */
  V.loopProblem = () => {
    return guided({
      title: "Why does this loop print 3, 3, 3?",
      build(view) {
        const code = h("div.sc-codebox");
        const con = consoleBox("Real console output");
        const chips = [["var", "loopVar"], ["let", "loopLet"]].map(([name, id]) => {
          const b = h("button.chip", { type: "button", "aria-pressed": "false" }, name);
          b.addEventListener("click", () => s.load(id));
          return b;
        });
        const picker = h("div.sc-chips", { hidden: true }, h("span.label", "Try it with"), chips);
        view.append(h("div.sc-pair", code, h("div.sc-side", con.el)), picker);
        const s = {
          cur: null, real: null, con, picker,
          load(id) {
            s.cur = id; s.real = null;
            const cv = codeView(codeOf(id));
            code.replaceChildren(cv.el);
            con.set([]);
            chips.forEach((c, i) => c.setAttribute("aria-pressed", String(["loopVar", "loopLet"][i] === id)));
          },
          async run(ctx) { s.real = await D.runForReal(PR[s.cur]); await showRun(con, s.real, ctx); },
        };
        s.load("loopVar");
        return s;
      },
      steps: [
        { say: "Read this loop. It starts three timers. Each timer will print i. The timers run after the loop ends.", enter: (s) => { s.load("loopVar"); s.picker.hidden = true; } },
        {
          say: "You have not seen why yet. A wrong guess is fine: the next pages explain it.",
          enter: (s) => { s.load("loopVar"); s.picker.hidden = true; },
          guess: { q: "What will the three timers print?", options: ["0, 1, 2", "3, 3, 3", "0, 0, 0"], answer: 1, why: "All three timers read the same variable i. The loop finishes first, so i is already 3 when they run. The next pages show the scopes behind this." },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => (s.real ? `Your browser printed: ${joinC(outLines(s.real))}.` : "Press the button to run the real code."),
        },
        {
          say: "Now change one word: var becomes let. Nothing else changes.",
          enter: (s) => { s.load("loopLet"); s.picker.hidden = true; },
          guess: { q: "What will it print now?", options: ["3, 3, 3", "0, 1, 2", "2, 2, 2"], answer: 1, why: "let makes a new variable for every turn of the loop, so each timer remembers its own i." },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => (s.real ? `Your browser printed: ${joinC(outLines(s.real))}.` : "Press the button to run the real code."),
        },
        {
          say: "Free play: run both versions as often as you like. Then go to the next pages to see why.",
          enter: (s) => { s.picker.hidden = false; s.load(s.cur || "loopLet"); },
          action: { label: "Run it in this browser", icon: "play", again: true, run: (s, ctx) => s.run(ctx) },
          after: (s) => (s.real ? `${s.cur === "loopVar" ? "var" : "let"} printed: ${joinC(outLines(s.real))}.` : ""),
        },
      ],
      takeaway: "A loop with var shares one variable between all turns, so every timer sees its last value. A loop with let gives each turn its own variable.",
      check: {
        q: "Which loop prints 0, 1, 2?",
        options: ["for (var i = 0; ...) with setTimeout", "for (let i = 0; ...) with setTimeout", "Both of them"],
        answer: 1,
        why: ["With var there is only one i, and it is 3 when the timers run.", "Yes. let gives every turn its own i.", "The two loops differ in exactly this: var shares one variable, let does not."],
      },
    });
  };

  /* ---------- 02. Where can a variable be seen? (the scope chain) ---------- */
  V.chain = () => {
    const res = R("chain");
    const fr = res.frames.find((f) => f.looks.length === 3);
    const sh = R("shadow");
    const shFr = sh.frames.find((f) => f.caption.startsWith("console.log prints local"));
    const label = (r, id) => r.envs[id].label;
    return guided({
      title: "Where can a variable be seen?",
      build(view) {
        const code = h("div.sc-codebox");
        const nest = h("div.sc-nestbox");
        const con = consoleBox("Real console output");
        const chips = ["a", "b", "c"].map((n) => h("button.chip", { type: "button" }, `look up ${n}`));
        const picker = h("div.sc-chips", { hidden: true }, h("span.label", "Inside inner(), find"), chips);
        view.append(h("div.sc-pair", code, h("div.sc-side", nest, con.el)), picker);
        const s = { code, nest, con, picker, view, nv: null, cur: null, ctxNow: null };
        s.load = (r, f, lit) => {
          const cv = codeView(r.lines); cv.mark(lit);
          code.replaceChildren(cv.el);
          s.nv = nestView(r, f); s.cur = { r, f };
          nest.replaceChildren(s.nv.el);
          con.set([]);
        };
        /* walk the search: light each box in the path, then the variable that was found */
        s.walk = async (name, ctx) => {
          const { r, f } = s.cur;
          const k = f.looks.find((x) => x.name === name);
          s.nv.clear();
          for (const id of k.path) { const bx = s.nv.box(id); if (bx) bx.classList.add("look"); await ctx.wait(650); if (!ctx.alive()) return; }
          const row = s.nv.row(k.found, name);
          if (row) row.classList.add("found");
          return k;
        };
        s.path = (name) => s.cur.f.looks.find((x) => x.name === name).path.map((id) => label(s.cur.r, id)).join(" → ");
        chips.forEach((c, i) => c.addEventListener("click", async () => { if (s.ctxNow) await s.walk(["a", "b", "c"][i], s.ctxNow); }));
        s.load(res, fr, fr.line);
        return s;
      },
      steps: [
        {
          say: "Look at how the code is written. inner() is written inside outer(), and outer() is written inside the script. The scopes on the right are nested the same way: the inner() scope sits inside the outer() scope, which sits inside the global scope.",
          enter: (s) => { s.load(res, fr, fr.line); s.picker.hidden = true; },
          show: (s, ctx) => { const inner = s.nv.box(res.envs.findIndex((e) => e.label === "inner()")); if (inner) ctx.callout(inner, "the code running now: inner()", "top"); },
        },
        {
          say: "inner() is running, and it wants to read a. JavaScript looks for a in the scope of the code that is running now. If a is not there, it looks in the scope around it, and so on. It stops at the first match.",
          enter: (s) => { s.load(res, fr, fr.line); s.picker.hidden = true; },
          guess: { q: "Which scope does JavaScript look in FIRST for a?", options: ["The global scope", "The outer() scope", "The inner() scope"], answer: 2, why: "It always starts in the scope of the code that is running now (inner), then goes one scope outward at a time." },
          action: { label: "Look up a", icon: "search", prompt: "Press the button and watch the search.", run: (s, ctx) => s.walk("a", ctx) },
          after: (s) => `The search went: ${s.path("a")}. It stopped in ${label(res, fr.looks.find((x) => x.name === "a").found)}, where a is ${fr.envs[fr.looks.find((x) => x.name === "a").found].vars.find((v) => v.n === "a").v}.`,
        },
        {
          say: "Now look up b, which lives one scope further out, and c, which lives in inner() itself.",
          enter: (s) => { s.load(res, fr, fr.line); s.picker.hidden = true; },
          action: { label: "Look up b, then c", icon: "search", run: async (s, ctx) => { await s.walk("b", ctx); await ctx.wait(500); await s.walk("c", ctx); } },
          after: (s) => `b: ${s.path("b")}. c: ${s.path("c")}. The closer the variable, the shorter the search.`,
        },
        {
          say: "The search only goes outward. Code outside a function cannot see that function's variables. Here c lives inside outer(), but the last line asks for it. Run it and see.",
          enter: (s) => { const cv = codeView(D.SNIPPETS.outsideInner.code.split("\n")); cv.mark(4); s.code.replaceChildren(cv.el); s.nest.replaceChildren(); s.con.set([]); s.picker.hidden = true; },
          action: { label: "Run it in this browser", icon: "play", run: async (s, ctx) => { s.real = await D.runSnippet(D.SNIPPETS.outsideInner); await showRun(s.con, s.real, ctx); } },
          after: (s) => (s.real && s.real.error ? `Your browser says ${s.real.error.name}: ${s.real.error.message}. The wording is different in each browser, but the error is the same.` : ""),
        },
        {
          say: "Two scopes can each have a variable with the same name. The nearest one wins, and the outer one is hidden. This is called shadowing.",
          enter: (s) => { s.load(sh, shFr, shFr.line); s.picker.hidden = true; },
          action: { label: "Run it in this browser", icon: "play", run: async (s, ctx) => { s.real = await D.runForReal(PR.shadow); await showRun(s.con, s.real, ctx); } },
          after: (s) => `Your browser printed: ${joinC(outLines(s.real))}. Inside show() the search for x stops at show()'s own scope. Outside show(), only the global x exists.`,
        },
        {
          say: "Free play: pick a variable and watch the search from inside inner().",
          enter: (s) => { s.load(res, fr, fr.line); s.picker.hidden = false; },
          show: (s, ctx) => { s.ctxNow = ctx; },
        },
      ],
      takeaway: "JavaScript looks for a variable in the scope of the running code, then outward one scope at a time, and uses the first match.",
      check: {
        q: "Inside inner(), the code reads b. b is declared in outer(). What happens?",
        options: ["ReferenceError: b is not defined", "It finds b in the outer() scope", "It finds undefined"],
        answer: 1,
        why: ["The search goes outward, so outer() is searched.", "Yes. inner() is written inside outer(), so the outer() scope is its parent scope.", "undefined only appears for a var that is declared but not yet set. Here the real b is found."],
      },
    });
  };

  /* ---------- 03. Hoisting and the dead zone (every result comes from a real run) ---------- */
  V.hoisting = () => {
    const ids = ["hoistVar", "hoistLet", "snip:tdzBlock", "fnDecl", "fnExpr"];
    const SN_OF = (id) => D.SNIPPETS[id.slice(5)];
    const isSnip = (id) => id.startsWith("snip:");
    const title = (id) => (isSnip(id) ? ({ "snip:tdzTypeof": "typeof on a let", "snip:tdzClass": "new on a class", "snip:tdzBlock": "A let inside a block", "snip:tdzTimeEarly": "show() is called before let x runs", "snip:tdzTimeLate": "show() is called after let x runs" })[id] : PR[id].title);
    return guided({
      title: "Before the first line runs",
      build(view) {
        const stack = h("div.sc-stack");
        const chips = ids.map((id) => {
          const b = h("button.chip", { type: "button", "aria-pressed": "false" }, title(id));
          b.addEventListener("click", () => s.load([id]));
          return b;
        });
        const picker = h("div.sc-chips", { hidden: true }, h("span.label", "Try"), chips);
        view.append(stack, picker);
        const s = { stack, picker, panels: [], real: {} };
        s.load = (list, nested = true) => {
          s.list = list; s.real = {};
          s.panels = list.map((id) => {
            const sn = isSnip(id) ? SN_OF(id) : null;
            const r = sn ? null : R(id);
            const cv = codeView(sn ? sn.code.split("\n") : r.lines);
            const nv = nested && r ? nestView(r, r.frames[0]) : null;
            const con = consoleBox("Real console output");
            return { id, sn, cv, nv, con, el: h("div.sc-panel", h("div.sc-codebox", h("span.label", list.length > 1 ? title(id) : "The program"), cv.el), h("div.sc-side", nv ? h("div.sc-nestbox", h("span.label", "The global scope, before line 1"), nv.el) : null, con.el)) };
          });
          stack.replaceChildren(...s.panels.map((p) => p.el));
          chips.forEach((c, i) => c.setAttribute("aria-pressed", String(list.length === 1 && list[0] === ids[i])));
        };
        s.run = async (ctx) => {
          for (const p of s.panels) { s.real[p.id] = p.sn ? await D.runSnippet(p.sn) : await D.runForReal(PR[p.id]); await showRun(p.con, s.real[p.id], ctx); }
        };
        s.said = () => s.list.map((id) => `${s.list.length > 1 ? title(id) + ": " : ""}${joinC(outLines(s.real[id])) || "(nothing)"}`).join(" · ");
        s.load(["hoistVar"]);
        return s;
      },
      steps: [
        {
          say: "A scope starts when the script starts, when a function is called, or when a { } block is entered. Before its first line runs, JavaScript finds every variable and function declared in that scope and creates those names. This is called hoisting. The code is not moved anywhere: the names simply exist from the start of the scope.",
          enter: (s) => { s.load(["hoistVar"]); s.picker.hidden = true; },
          show: (s, ctx) => { const row = s.panels[0].nv.row(0, "a"); if (row) ctx.callout(row, "a already exists, before line 1", "bottom"); },
        },
        {
          say: "Every declared name exists from the start, but the starting value depends on how it was declared. A var starts with the value undefined. The value 5 is only stored when line 2 runs.",
          enter: (s) => { s.load(["hoistVar"]); s.picker.hidden = true; },
          guess: { q: "console.log(a) comes BEFORE var a = 5. What does it print?", options: ["5", "undefined", "An error"], answer: 1, why: "The name a already exists in the global scope, with the value undefined. The value 5 is only stored when line 2 runs." },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser printed: ${s.said()}.`,
        },
        {
          say: "A let is hoisted too. You can see it in the picture: the name a already exists before line 1. But it is not initialized, so it has no value at all, not even undefined. From the start of the scope until the let line runs, the variable is in the temporal dead zone (TDZ). Reading it during that time throws an error.",
          enter: (s) => { s.load(["hoistLet"]); s.picker.hidden = true; },
          guess: { q: "Same code, but with let. What happens?", options: ["It prints undefined", "It prints 5", "It throws an error"], answer: 2, why: "The name a exists from the start of the scope, but it is still in the TDZ on line 1, because line 2 has not run yet. Reading it throws a ReferenceError." },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser said: ${s.said()}. The words differ in each browser; the kind of error (ReferenceError) is the same.`,
        },
        {
          say: "Many people say that let is not hoisted. This program shows that it is. There is an outer x. Inside the block, the first line reads x, and the block's own let x comes one line later.",
          enter: (s) => { s.load(["snip:tdzBlock"], false); s.picker.hidden = true; },
          guess: { q: "What does the first line inside the block print?", options: ["outer", "It throws a ReferenceError", "undefined"], answer: 1, why: "If let were not hoisted, JavaScript would find the outer x and print outer. It throws instead, because the block's own x already exists from the start of the block. It hides the outer x, and it is still in the TDZ." },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser said: ${s.said()}. So console.log(x) found the block's own x, not the outer one.`,
        },
        {
          say: "The word temporal means time. The TDZ depends on WHEN the code runs, not on where it is written in the file. In both programs, show() is written above let x. The only difference is when show() is called.",
          enter: (s) => { s.load(["snip:tdzTimeEarly", "snip:tdzTimeLate"], false); s.picker.hidden = true; },
          guess: { q: "Which program works?", options: ["Both of them", "Only the second one", "Neither of them"], answer: 1, why: "In the first program, show() runs while x is still in the TDZ, so reading x throws. In the second program, the let x line has already run, so x is 1. The code inside show() is the same; only the time of the call is different." },
          action: { label: "Run both", icon: "play", prompt: "Press the button to run both programs.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser printed: ${s.said()}.`,
        },
        {
          say: "Functions are different again. A function declaration is hoisted with its whole body, so you can call it before its line. A function stored in a var is not: only the name sayHi is hoisted, with the value undefined.",
          enter: (s) => { s.load(["fnDecl", "fnExpr"]); s.picker.hidden = true; },
          guess: { q: "In both programs, sayHi() is called on line 1. Which one works?", options: ["Both of them", "Only the function declaration", "Only the one with var"], answer: 1, why: "The function declaration is created with its whole body before line 1. In the other program, sayHi is a var, so on line 1 its value is still undefined. Calling undefined throws a TypeError." },
          action: { label: "Run both", icon: "play", prompt: "Press the button to run both programs.", run: (s, ctx) => s.run(ctx) },
          after: (s) => s.said() + ".",
        },
        {
          say: "typeof does not protect you from the TDZ. A class declaration is hoisted like let, so it is also in the TDZ until its line runs.",
          enter: (s) => { s.load(["snip:tdzTypeof", "snip:tdzClass"], false); s.picker.hidden = true; },
          guess: { q: "Both lines use a name before its let or class line. Do they throw?", options: ["Neither: typeof is always safe", "Both throw a ReferenceError", "Only the class one"], answer: 1, why: "typeof is only safe for a name that was never declared at all. In the TDZ the name exists but is not initialized, so even typeof throws. A class behaves like let here." },
          action: { label: "Run both", icon: "play", prompt: "Press the button to run both.", run: (s, ctx) => s.run(ctx) },
          after: (s) => s.said() + ".",
        },
        {
          say: "Free play: pick a program and run it.",
          enter: (s) => { s.load(["hoistVar"]); s.picker.hidden = false; },
          action: { label: "Run it in this browser", icon: "play", again: true, run: (s, ctx) => s.run(ctx) },
          after: (s) => s.said() + ".",
        },
      ],
      takeaway: "Every name declared in a scope is created before the scope's first line runs. A var starts as undefined, and a function declaration starts as the whole function. A let, const or class starts without a value: it is in the TDZ until its line runs.",
      check: {
        q: "Which one throws an error when it is used before its line?",
        options: ["var", "let", "A function declaration"],
        answer: 1,
        why: ["A var is hoisted with the value undefined, so reading it early gives undefined, not an error.", "Yes. let (and const) are hoisted too, but they stay in the TDZ until their line runs.", "A function declaration is hoisted with its whole body, so you can call it from the first line."],
      },
    });
  };

  /* ---------- 04b. Predict the logs: the counters ---------- */
  V.predict = () => {
    const res = R("twoCounters");
    const logs = res.frames.filter((f) => f.caption.startsWith("console.log prints"));
    const shared = R("sharedCounters").console, fresh = R("freshCounters").console;
    const ask = [
      null,
      { q: "a() is called a second time. What does it print?", options: [fresh[1], res.console[1], "0"], answer: 1,
        why: `a() reads count from its parent scope, which still holds ${res.console[0]}. It adds 1 and prints ${res.console[1]}. (Printing ${fresh[1]} would mean count starts again from 0 on every call. It does not: the scope stays alive.)` },
      { q: "Now b() is called for the first time. What does it print?", options: [shared[2], res.console[2], "0"], answer: 1,
        why: `b was made by a second call of makeCounter(), so it has its own scope and its own count. It starts at 0 and prints ${res.console[2]}. (Printing ${shared[2]} would mean a and b share one scope. They do not.)` },
    ];
    return guided({
      title: "Your turn: what prints?",
      build(view) {
        const code = codeView(res.lines);
        const con = consoleBox();
        const nest = h("div.sc-nestbox");
        view.append(h("div.sc-pair", h("div.sc-codebox", code.el), h("div.sc-side", con.el, nest)));
        return {
          state(n) {
            const f = n > 0 ? logs[n - 1] : res.frames[res.frames.findIndex((x) => x.caption.startsWith("`b` now holds"))];
            code.mark(f.line);
            con.set(res.console.slice(0, n));
            const nv = nestView(res, f);
            nest.replaceChildren(h("span.label", "The scopes now"), nv.el);
          },
        };
      },
      steps: [
        { say: "This time makeCounter() is called twice, so we get two counters, a and b. Read the code. Each console.log prints the answer of one call.", enter: (s) => s.state(0) },
        { say: `The first call a() prints ${res.console[0]}: count starts at 0, and a adds 1.`, enter: (s) => s.state(1) },
        ...[1, 2].map((k) => ({ say: ["", "a() is called again.", "Now the other counter."][k], enter: (s) => s.state(k), guess: ask[k], after: undefined, onReveal: (s) => s.state(k + 1) })),
      ],
      takeaway: "Each call of makeCounter() makes its own scope, so each returned function has its own private count.",
      check: {
        q: "If makeCounter() declared count INSIDE the returned function, what would a() print the second time?",
        options: ["2", `${fresh[1]}`, "undefined"], answer: 1,
        why: ["Then count would be a new variable on every call, so nothing could remember the 1.", `Right. A new count starts at 0 each call, so it prints ${fresh[1]} again (the lesson's interpreter ran this variant).`, "count would still be set to 0 and then 1. It is never undefined."],
      },
    });
  };

  /* ---------- 06. The three fixes (and a fix that fails), all run for real ---------- */
  V.fixes = () => {
    const fixes = [
      { id: "loopLet", name: "Fix 1: use let", say: "Fix 1: change var to let. Every turn of the loop gets its own scope with its own i, and each timer remembers the i of its turn." },
      { id: "fixIife", name: "Fix 2: call a function each turn", say: "Fix 2: call a function on every turn and pass i to it. Each call gets its own scope with its own j, and the timer points to that scope. This pattern is called an IIFE (an immediately invoked function expression): a function that is called right where it is written. People used it before let existed." },
      { id: "fixArg", name: "Fix 3: hand i to setTimeout", say: "Fix 3: setTimeout can take extra arguments after the delay. It saves the value of i at that moment and passes it to your function later." },
    ];
    return guided({
      title: "Three fixes, and one that does not work",
      build(view) {
        const code = h("div.sc-codebox");
        const con = consoleBox("Real console output");
        const chips = [...fixes.map((f) => [f.id, f.name.split(":")[0]]), ["wrongFix", "var j"]].map(([id, name]) => {
          const b = h("button.chip", { type: "button", "aria-pressed": "false" }, name);
          b.addEventListener("click", () => s.load(id));
          return b;
        });
        const picker = h("div.sc-chips", { hidden: true }, h("span.label", "Run"), chips);
        view.append(h("div.sc-pair", code, h("div.sc-side", con.el)), picker);
        const s = { picker, real: null, cur: null, ids: [...fixes.map((f) => f.id), "wrongFix"] };
        s.load = (id) => { s.cur = id; s.real = null; code.replaceChildren(codeView(codeOf(id)).el); con.set([]); chips.forEach((c, i) => c.setAttribute("aria-pressed", String(s.ids[i] === id))); };
        s.run = async (ctx) => { s.real = await D.runForReal(PR[s.cur]); await showRun(con, s.real, ctx); };
        s.load("loopVar");
        return s;
      },
      steps: [
        { say: "The bug: every callback points to the same scope, where i is 3. To fix it, each callback must point to its OWN scope, with its own copy of the value.", enter: (s) => { s.load("loopVar"); s.picker.hidden = true; } },
        ...fixes.map((f) => ({
          say: f.say, enter: (s) => { s.load(f.id); s.picker.hidden = true; },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser printed: ${joinC(outLines(s.real))}.`,
        })),
        {
          say: "A tempting fix: copy i into another variable inside the loop, with var j = i.",
          enter: (s) => { s.load("wrongFix"); s.picker.hidden = true; },
          guess: { q: "Does var j = i fix it?", options: ["Yes: 0, 1, 2", "No: 3, 3, 3", "No: 2, 2, 2"], answer: 2, why: "var j is also ONE variable for the whole script, because var ignores the loop's { }. Each turn overwrites it. The last turn sets j to 2, so all callbacks print 2. The copy must live in a scope of its own." },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser printed: ${joinC(outLines(s.real))}.`,
        },
        {
          say: "Free play: run any of the versions.",
          enter: (s) => { s.picker.hidden = false; s.load("loopLet"); },
          action: { label: "Run it in this browser", icon: "play", again: true, run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser printed: ${joinC(outLines(s.real))}.`,
        },
      ],
      takeaway: "To fix the loop, give each callback its own scope: use let, call a function on each turn (an IIFE), or pass the value to setTimeout.",
      check: {
        q: "Why does var j = i inside the loop not help?",
        options: ["j is a var, so it is one variable for the whole script", "j is not declared", "setTimeout ignores j"], answer: 0,
        why: ["Yes. var ignores the loop's braces, so there is only one j, and the last turn writes 2 into it.", "It is declared. var is hoisted to the top of the script.", "setTimeout runs the callback, which reads j like any other variable."],
      },
    });
  };

  /* ---------- 07. Debounce on a timeline (real timers) ---------- */
  const TY = D.TYPING;
  V.debounceTimeline = () => {
    const W = () => (matchMedia("(max-width: 560px)").matches ? 340 : 640);
    const total = TY.settle;
    return guided({
      title: "Typing, with and without a pause",
      build(view) {
        const w = W();
        const X = (t) => 14 + (t / total) * (w - 28);
        const svg = S("svg", { viewBox: `0 0 ${w} 132`, class: "sc-lane", role: "img", "aria-label": "A timeline of key presses and the requests that were sent" });
        const lab = (y, text) => svg.append(S("text", { x: 14, y, class: "fl-small" }, text));
        lab(14, "Key presses (one per letter)");
        lab(70, "Requests sent: no debounce");
        lab(112, "Requests sent: debounce 100 ms");
        const mk = (cy, cls) => { const c = S("circle", { r: 6, cy, class: cls, opacity: 0 }); svg.append(c); return c; };
        const keys = TY.keys.map(([text, at]) => { const c = mk(34, "sc-key"); c.setAttribute("cx", X(at)); const t = S("text", { x: X(at), y: 54, "text-anchor": "middle", class: "fl-small", opacity: 0 }, text); svg.append(t); return { c, t, at }; });
        const raw = TY.keys.map(([, at]) => { const c = mk(86, "sc-send raw"); c.setAttribute("cx", X(at)); return { c, at }; });
        const deb = [mk(122, "sc-send"), mk(122, "sc-send")];
        const note = h("p.sc-note");
        view.append(svg, note);
        return { svg, keys, raw, deb, X, note, real: null, show(p) {
          const t = p * total;
          keys.forEach((k) => { const on = t >= k.at; k.c.setAttribute("opacity", on ? 1 : 0.15); k.t.setAttribute("opacity", on ? 1 : 0); });
        } };
      },
      steps: [
        { say: "A search box sends a request on every key press. Typing \"hello\" would send 5 requests, though only the last one matters.", enter: (s) => { s.keys.forEach((k) => { k.c.setAttribute("opacity", 1); k.t.setAttribute("opacity", 1); }); s.raw.forEach((r) => r.c.setAttribute("opacity", 1)); s.deb.forEach((d) => d.setAttribute("opacity", 0)); s.note.textContent = ""; } },
        {
          say: "Debounce means: wait until the typing stops for 100 ms, then send once. Here the person types h, e, l, l fast, waits, and then types o.",
          enter: (s) => { s.keys.forEach((k) => { k.c.setAttribute("opacity", 0.15); k.t.setAttribute("opacity", 0); }); s.raw.forEach((r) => r.c.setAttribute("opacity", 0)); s.deb.forEach((d) => d.setAttribute("opacity", 0)); s.note.textContent = ""; },
          guess: { q: "With debounce(100 ms), how many requests are sent for these 5 key presses?", options: ["5", "2", "1"], answer: 1, why: "The first four letters come less than 100 ms apart, so each one cancels the timer of the one before. After \"hell\" there is a pause, so it is sent. Then \"hello\" comes later, and is sent after its own pause." },
          action: { label: "Run it with real timers", icon: "play", prompt: "Press the button. It takes about half a second.", run: async (s, ctx) => {
            s.real = null;
            s.deb.forEach((d) => d.setAttribute("opacity", 0));
            /* each request dot appears at the moment the real timer sends it */
            const pending = D.runTyping(D.LIB.debounce.fn("debounce"), (m, i) => { if (ctx.alive() && s.deb[i]) { s.deb[i].setAttribute("cx", s.X(m.at)); s.deb[i].setAttribute("opacity", 1); } }).then((sent) => { s.real = sent; });
            await ctx.tween({ from: 0, to: 1, ms: total, ease: (t) => t, onUpdate: (p) => { if (ctx.alive()) { s.show(p); s.raw.forEach((r) => r.c.setAttribute("opacity", p * total >= r.at ? 1 : 0)); } } });
            await pending;
            s.show(1);
          } },
          after: (s) => (s.real ? `Without debounce: 5 requests. With debounce: ${s.real.length}, for ${s.real.map((m) => `"${m.text}" (at ${m.at} ms)`).join(" and ")}. These times were measured with real timers just now.` : ""),
        },
        { say: "Where is the closure? The function that debounce returns remembers one variable, timer. Each key press calls that function, which clears the old timer and starts a new one.", enter: (s) => { s.keys.forEach((k) => { k.c.setAttribute("opacity", 1); k.t.setAttribute("opacity", 1); }); s.raw.forEach((r) => r.c.setAttribute("opacity", 1)); s.deb.forEach((d, i) => { if (s.real && s.real[i]) { d.setAttribute("cx", s.X(s.real[i].at)); d.setAttribute("opacity", 1); } }); } },
      ],
      takeaway: "debounce keeps a timer variable in a closure: every call cancels the old timer and starts a new one, so only the last call in a burst runs.",
      check: {
        q: "What would happen if timer were declared INSIDE the returned function?",
        options: ["Nothing changes", "Each call would have its own timer, so no timer is ever cancelled", "It would throw an error"], answer: 1,
        why: ["The shared variable is the whole trick.", "Yes. clearTimeout would clear a fresh, empty timer, and all 5 requests would be sent.", "It would run without errors. It would just not debounce."],
      },
    });
  };

  /* ---------- From your work: why Speako's debounce timer lives in a ref (real timers) ---------- */
  V.refDemo = () => {
    const names = { refPlain: "A plain let timer", refShared: "A shared ref" };
    return guided({
      title: "Why the timer lives in a ref",
      build(view) {
        const code = h("div.sc-codebox");
        const con = consoleBox("Real console output");
        view.append(h("div.sc-pair", code, h("div.sc-side", con.el)));
        const s = { real: {} };
        s.load = (id) => { s.id = id; code.replaceChildren(codeView(D.SNIPPETS[id].code.split("\n")).el); con.set([]); };
        s.run = async (ctx) => { const r = await D.runSnippet(D.SNIPPETS[s.id]); s.real[s.id] = r; await showRun(con, r, ctx); };
        s.load("refPlain");
        return s;
      },
      steps: [
        { say: "In React, the component function runs again on every render. Each run makes new local variables. Here each key press renders, then calls handleSearch.", enter: (s) => s.load("refPlain") },
        {
          say: "First, the timer is a plain let inside the component. Three letters are typed, 15 ms apart. The pause is 60 ms.",
          enter: (s) => s.load("refPlain"),
          guess: { q: "How many searches are sent?", options: ["1: only \"hel\"", "3: \"h\", \"he\" and \"hel\"", "0"], answer: 1, why: "Every render made its own timer variable. The new handleSearch clears its own empty variable and cannot see the older timers, so none is ever cancelled." },
          action: { label: "Run it with real timers", icon: "play", prompt: "Press the button. It takes about a quarter of a second.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser printed: ${joinC(outLines(s.real.refPlain))}.`,
        },
        {
          say: "Now the timer lives in one object that every render shares. In React, useRef gives you this object.",
          enter: (s) => s.load("refShared"),
          action: { label: "Run it with real timers", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => `Your browser printed: ${joinC(outLines(s.real.refShared))}. Every render clears and sets the same ref object, so only the last search is sent.`,
        },
      ],
      takeaway: "A plain variable inside a component is new on every render. A ref is one object that all renders share, so it can remember a timer.",
      check: {
        q: "Why does Speako's help search keep its timer in useRef?",
        options: ["So all renders share one timer to cancel", "Because refs are faster", "Because let cannot hold a number"], answer: 0,
        why: ["Yes. The handler from each render must clear the same timer.", "Speed is not the reason.", "let can hold any value. The problem is that each render has its own let."],
      },
    });
  };
  /* ---------- The film: boxes, variables and arrows, generated from the interpreter's trace ---------- */
  const ROW = 19, HEAD = 25, PAD = 8, GAP = 9, LANES = 4;
  const fit = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  const frameSecs = (f) => Math.min(10, Math.max(2.5, 1 + f.caption.split(" ").length / 2.6));

  /* Which cards exist in a run, where they sit (indented by how deep they are), and how tall they are. */
  function plan(r) {
    const kids = {};
    r.envs.filter((e) => e.vis).forEach((e) => { const p = e.parent == null ? -1 : e.parent; (kids[p] = kids[p] || []).push(e); });
    const cards = [];
    const maxT = Math.max(0, ...r.frames.map((f) => f.timers.length));
    const walk = (pid, depth) => (kids[pid] || []).forEach((e) => { cards.push({ key: "e" + e.id, env: e, title: e.label, rows: e.names.length, depth }); walk(e.id, depth + 1); });
    walk(-1, 0);
    if (r.frames.some((f) => f.carry)) cards.push({ key: "carry", title: "Returning", rows: 1, depth: 0, pseudo: true });
    if (maxT) cards.push({ key: "timers", title: "Timer list (waiting)", rows: maxT, depth: 0, pseudo: true });
    cards.forEach((c) => { c.h = HEAD + c.rows * ROW + PAD; });
    return cards;
  }

  V.film = (ids, title = "Scopes, variables and arrows") => {
    const runs = ids.map(R);
    const plans = runs.map(plan);
    const maxLines = Math.max(...runs.map((r) => r.lines.length));
    const maxLen = Math.max(...runs.flatMap((r) => r.lines.map((l) => l.length)));
    const maxOut = Math.max(1, ...runs.map((r) => r.console.length));
    const sceneH = Math.max(...plans.map((p) => p.reduce((a, c) => a + c.h + GAP, 0))) + 40;
    const G = (layout) => {
      const wide = layout === "wide";
      const W = wide ? 780 : 400;
      const codeW = wide ? 300 : 376;
      const fs = Math.max(wide ? 9.5 : 11, Math.min(wide ? 12 : 11.5, (codeW - 24) / (0.6 * maxLen)));
      const lh = Math.round(fs * 1.45);
      const codeH = maxLines * lh + 24;
      const conH = maxOut * 18 + 34;
      const g = { wide, W, fs, lh, code: { x: 12, y: 34, w: codeW, h: codeH }, con: { x: 12, y: 34 + codeH + 10, w: codeW, h: conH } };
      g.scene = wide ? { x: 326, y: 34, w: W - 326 - 12 } : { x: 12, y: g.con.y + conH + 12, w: W - 24 };
      g.gutter = wide ? 54 : 46;
      g.indent = wide ? 18 : 12;
      g.R = g.scene.x + g.scene.w - g.gutter;
      g.cardsY = g.scene.y + 30;
      g.H = Math.max(wide ? 34 + codeH + 10 + conH + 24 : 0, g.cardsY + sceneH + 24);
      return g;
    };
    const dims = (l) => { const g = G(l); return [g.W, g.H]; };

    return Book.film({
      title, wide: dims("wide"), tall: dims("tall"),
      build(svg, Fm, layout) {
        const g = G(layout);
        let T = 0.3;
        runs.forEach((r, k) => {
          const grp = S("g");
          svg.append(grp);
          const runA = Fm.actor(grp, { o: 0 });
          Fm.to(runA, { o: 1 }, T, 0.5);

          /* the code */
          grp.append(S("rect", { x: g.code.x, y: g.code.y, width: g.code.w, height: g.code.h, rx: 12, class: "fl-code-bg" }), S("text", { x: g.code.x + 2, y: g.code.y - 10, class: "fl-small" }, "The program"));
          const bar = S("rect", { x: g.code.x + 4, width: g.code.w - 8, height: g.lh, rx: 5, class: "fl-line-bar" });
          grp.append(bar);
          r.lines.forEach((text, i) => {
            const tx = S("text", { x: g.code.x + 12, y: g.code.y + 12 + i * g.lh + g.lh * 0.78, class: "fl-code", style: `font-size:${g.fs}px`, "xml:space": "preserve" });
            for (const t of Book.tokens(text)) tx.append(S("tspan", { class: t.type === "plain" || t.type === "space" ? "syn-plain" : `syn-${t.type}` }, t.text));
            grp.append(tx);
          });
          const barA = Fm.actor(bar, { line: 0, o: 0 }, (p, n) => { n.setAttribute("y", g.code.y + 12 + p.line * g.lh); n.setAttribute("opacity", p.o); });

          /* the console */
          grp.append(S("rect", { x: g.con.x, y: g.con.y, width: g.con.w, height: g.con.h, rx: 12, class: "fl-field" }), S("text", { x: g.con.x + 12, y: g.con.y + 17, class: "fl-small" }, "Console"));
          const outs = r.console.map((text, i) => {
            const t = S("text", { x: g.con.x + 12, y: g.con.y + 38 + i * 18, class: "sc-con" }, text);
            grp.append(t);
            return Fm.actor(t, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));
          });

          /* "Running now" strip and a one-line legend */
          const strip = S("text", { x: g.scene.x + 2, y: g.scene.y + 14, class: "sc-strip" });
          grp.append(strip);
          const stripTexts = [];
          const stripA = Fm.actor(strip, { ver: 0 }, (p, n) => { n.textContent = stripTexts[Math.round(p.ver)] || ""; });
          grp.append(S("text", { x: g.scene.x + 2, y: g.cardsY + sceneH - 18, class: "fl-small", style: "font-size:11px" }, "ƒ = a function. Its arrow points to the scope where it was created."));

          /* the cards */
          let y = g.cardsY;
          const cards = plans[k].map((c) => {
            c.x = g.scene.x + c.depth * g.indent; c.w = g.R - c.x; c.y = y; y += c.h + GAP;
            const node = S("g");
            const rect = S("rect", { width: c.w, height: c.h, rx: 10, class: "sc-card" + (c.pseudo ? " pseudo" : "") });
            const titleT = S("text", { x: 10, y: 17, class: "sc-title" }, c.title);
            const freed = S("text", { x: c.w - 10, y: 17, "text-anchor": "end", class: "sc-freed", opacity: 0 }, "can be freed");
            node.append(rect, titleT, freed);
            const bgs = [], rows = [];
            for (let i = 0; i < c.rows; i++) {
              const bg = S("rect", { x: 4, y: HEAD + i * ROW, width: c.w - 8, height: ROW, rx: 5, class: "sc-hotrow", opacity: 0 });
              const t = S("text", { x: 10, y: HEAD + i * ROW + 13.5, class: "sc-row" });
              node.append(bg, t); bgs.push(bg); rows.push(t);
            }
            grp.append(node);
            c.versions = [[]]; c.sig = "[]";
            c.actor = Fm.actor(node, { o: 0, ver: 0, hot: 0, dead: 0 }, (p, n) => {
              n.setAttribute("transform", `translate(${c.x} ${c.y + (1 - p.o) * 8})`);
              n.setAttribute("opacity", (Math.max(0, p.o) * (1 - 0.55 * p.dead)).toFixed(3));
              const ver = c.versions[Math.max(0, Math.min(c.versions.length - 1, Math.round(p.ver)))];
              rows.forEach((t, i) => { const v = ver[i]; t.textContent = v ? v.t : ""; t.setAttribute("class", "sc-row" + (v && v.tdz ? " tdz" : "")); bgs[i].setAttribute("opacity", v && v.hot ? 1 : 0); });
              rect.setAttribute("class", "sc-card" + (c.pseudo ? " pseudo" : "") + (p.hot > 0.5 ? " hot" : ""));
              freed.setAttribute("opacity", p.dead);
            });
            c.shown = 0; c.hot = 0; c.isDead = false;
            return c;
          });
          const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));

          /* arrows: from a variable row (or the Returning / Timer list rows) to the card of the box where a function was born */
          const arrows = new Map();
          const arrow = (src, row, tgt) => {
            const key = `${src.key}.${row}.${tgt.key}`;
            if (arrows.has(key)) return arrows.get(key);
            const lane = arrows.size % LANES;
            const sy = src.y + HEAD + row * ROW + ROW / 2, ty = tgt.y + 13, R = g.R, lx = R + 12 + lane * 8;
            const node = S("g");
            node.append(S("circle", { cx: R - 10, cy: sy, r: 3, class: "sc-dot" }), S("path", { d: `M ${R - 10} ${sy} H ${lx} V ${ty} H ${R + 6}`, class: "sc-arrow" }), S("path", { d: `M ${R} ${ty} L ${R + 8} ${ty - 4.5} V ${ty + 4.5} Z`, class: "sc-head" }));
            grp.append(node);
            const a = { actor: Fm.actor(node, { o: 0 }, (p, n) => n.setAttribute("opacity", Math.max(0, p.o).toFixed(3))), on: 0 };
            arrows.set(key, a);
            return a;
          };

          const chs = PR[r.id].chapters;
          let ci = -1, lastGroup = null, lastLine = 0, shown = 0, lastStrip = "";
          r.frames.forEach((f) => {
            if (chs) { while (ci + 1 < chs.length && chs[ci + 1][0](f)) { ci++; Fm.chapter(T, chs[ci][1]); } }
            else if (f.group.id !== lastGroup) { Fm.chapter(T, lastGroup === null ? `Program ${k + 1}: ${r.title}` : f.group.title); lastGroup = f.group.id; }
            if (ids.length > 1 && f.i === 0) Fm.say(T, `Program ${k + 1}: ${r.title}. ${f.caption}`); else Fm.say(T, f.caption);
            const strip2 = "Running now: " + f.stack.join(" › ");
            if (strip2 !== lastStrip) { stripTexts.push(strip2); Fm.set(stripA, { ver: stripTexts.length - 1 }, T); lastStrip = strip2; }
            if (f.line != null) { lastLine = f.line; Fm.to(barA, { line: f.line, o: 1 }, T, 0.3); } else Fm.to(barA, { line: lastLine, o: 0.2 }, T, 0.3);
            while (shown < f.out) Fm.to(outs[shown++], { o: 1 }, T + 0.4, 0.4);

            const hotRows = new Set(f.looks.map((x) => `${x.found}:${x.name}`));
            const hotCards = new Set(f.looks.filter((x) => x.path.length > 1).flatMap((x) => x.path.concat(x.found)));
            const live = new Set();
            cards.forEach((c) => {
              let rowsNow = [];
              let present;
              if (c.key === "carry") {
                present = Boolean(f.carry);
                rowsNow = f.carry ? [{ t: fit("ƒ" + (f.carry.name ? " " + f.carry.name : ""), 30) }] : [];
                if (f.carry && byKey["e" + f.carry.to]) live.add(arrow(c, 0, byKey["e" + f.carry.to]));
              } else if (c.key === "timers") {
                present = f.timers.length > 0;
                rowsNow = f.timers.map((t) => ({ t: fit(`ƒ${t.name ? " " + t.name : ""} · after ${t.ms} ms${t.args.length ? " · gets " + t.args.join(",") : ""}`, 34) }));
                f.timers.forEach((t, i) => { if (byKey["e" + t.to]) live.add(arrow(c, i, byKey["e" + t.to])); });
              } else {
                const fe = f.envs[c.env.id];
                present = Boolean(fe);
                if (fe) {
                  rowsNow = fe.vars.map((v) => ({ t: fit(`${v.n} = ${v.tdz ? "(not initialized)" : v.v}`, 32), tdz: v.tdz, hot: hotRows.has(`${c.env.id}:${v.n}`) }));
                  if (!fe.dead) fe.vars.forEach((v, i) => { if (v.f && v.f.to != null && byKey["e" + v.f.to]) live.add(arrow(c, i, byKey["e" + v.f.to])); });
                }
              }
              if (present !== Boolean(c.shown)) { Fm.to(c.actor, { o: present ? 1 : 0 }, T + 0.05, 0.4, Fm.ease.out); c.shown = present ? 1 : 0; }
              const sig = JSON.stringify(rowsNow);
              if (sig !== c.sig) { c.versions.push(rowsNow); c.sig = sig; Fm.set(c.actor, { ver: c.versions.length - 1 }, T + 0.2); }
              const hot = c.env && hotCards.has(c.env.id) ? 1 : 0;
              if (hot !== c.hot) { Fm.to(c.actor, { hot }, T + 0.1, 0.3); c.hot = hot; }
              if (c.env) { const dead = Boolean(f.envs[c.env.id] && f.envs[c.env.id].dead); if (dead && !c.isDead) { Fm.to(c.actor, { dead: 1 }, T + 0.3, 0.6); c.isDead = true; } }
            });
            for (const a of arrows.values()) { const on = live.has(a) ? 1 : 0; if (on !== a.on) { Fm.to(a.actor, { o: on }, T + 0.35, 0.4, Fm.ease.out); a.on = on; } }
            T += frameSecs(f);
          });
          if (ids.length > 1 && k < ids.length - 1) { Fm.to(runA, { o: 0 }, T, 0.5); T += 0.9; }
        });
        const moral = runs.map((r) => PR[r.id].moral).filter(Boolean);
        Fm.chapter(T, "The idea");
        Fm.say(T, moral.length ? moral[moral.length - 1] : "Each call, block and loop turn makes a scope. A function remembers the scope where it was created.");
        Fm.end(T + 6);
      },
    });
  };

  Object.assign(V, { codeView, consoleBox, nestView, R });
})();
