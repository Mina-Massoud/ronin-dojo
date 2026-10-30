/* Promises, async/await and concurrency: the films and guided visuals.
   Every state, caption, order and number comes from js-async.data.js (checked by dev/js-async.test.js against real promises and timers)
   or is measured live with real timers in the page. Nothing here is typed by hand. */
(function () {
  const { h, guided, fmt, svg: S } = Book;
  const V = Book.parts["js-async"];
  const D = V.data;
  const Sim = Book.parts["event-loop"].sim;
  const narrow = () => matchMedia("(max-width: 560px)").matches;
  const word = (t) => t.split(" ").length;

  const readout = (label, value = "—") => {
    const b = h("b.tab", value);
    return { el: h("div.readout", h("span.label", label), b), set: (t) => { b.textContent = t; } };
  };
  function codeView(lines) {
    const els = lines.map((t) => h("span.as-ln", { html: Book.highlight(t) || " " }));
    const el = h("pre.code-block.as-code", { "aria-label": "The code" }, els);
    return { el, mark(lit) { els.forEach((e, i) => e.classList.toggle("lit", lit.includes(i))); } };
  }
  const say = (p) => (p.state === "fulfilled" ? `fulfilled with ${D.fmtVal(p.value)}` : `rejected with ${p.reason}`);

  const PAGER_INTRO = [
    "const order = new Promise((resolve, reject) => {",
    "  // later, the kitchen calls ONE of these two:",
    "  resolve(\"ready\");                    // here: fulfilled with \"ready\"",
    "  // reject(new Error(\"out of food\"));  // failure: rejected with an error",
    "});",
    "order.then((meal) => console.log(meal));        // runs when it is fulfilled",
    "order.catch((err) => console.log(err.message)); // runs when it is rejected",
  ].join("\n");
  const PAGER_MISTAKE = [
    "const order = new Promise((resolve, reject) => {",
    "  setTimeout(() => {              // the kitchen takes 350 ms",
    "    resolve(\"ready\");",
    "    reject(new Error(\"sorry\"));",
    "    resolve(\"again\");",
    "  }, 350);",
    "});",
    "order.then((meal) => console.log(meal), (err) => console.log(err.message));",
  ].join("\n");
  /* ---------- 01. A promise is a pager ---------- */
  V.pager = () => guided({
    title: "A promise is a pager",
    build(view) {
      const state = h("b.as-pager-state", "pending");
      const detail = h("span.as-pager-detail", "waiting for the kitchen");
      const pager = h("div.as-pager", { "data-state": "pending" }, h("div.as-pager-face", { role: "img", "aria-label": "A pager that shows the state of the promise" }), h("div.as-pager-text", state, detail));
      const codeBox = h("div.as-codebox", { hidden: true });
      const note = h("p.as-hint", { "aria-live": "polite" });
      const chips = [["ready", "Kitchen says ready"], ["sorry", "Kitchen says sorry"]].map(([id, text]) => {
        const b = h("button.chip", { type: "button", "aria-pressed": String(id === "ready") }, text);
        b.addEventListener("click", () => { s.pick = id; chips.forEach((c) => c.setAttribute("aria-pressed", String(c === b))); });
        return b;
      });
      const chipRow = h("div.as-chips", { hidden: true }, h("span.label", "The kitchen will say"), chips);
      view.append(pager, codeBox, note, chipRow);
      const s = { pick: "ready", last: null, codeBox, chipRow, note, pager };
      s.setCode = (txt) => { codeBox.replaceChildren(Book.code(txt)); codeBox.hidden = false; };
      s.set = (st, text) => { pager.dataset.state = st; state.textContent = st; detail.textContent = text; };
      /* A real promise. `script` plays the kitchen after 350 ms. We count how many times our handler really runs. */
      s.order = async (script) => {
        s.set("pending", "waiting for the kitchen…");
        note.textContent = "";
        let calls = 0;
        const p = new Promise((resolve, reject) => setTimeout(() => script(resolve, reject), 350));
        p.then(() => { calls++; }, () => { calls++; });
        const out = await p.then((v) => ({ st: "fulfilled", text: `value: “${v}”` }), (e) => ({ st: "rejected", text: `error: ${e.message}` }));
        s.set(out.st, out.text);
        await new Promise((r) => setTimeout(r, 60));
        s.last = { ...out, calls };
      };
      return s;
    },
    steps: [
      {
        say: "You order food and get a pager. It shows nothing yet, because the food is not ready.",
        enter: (s) => { s.set("pending", "waiting for the kitchen"); s.codeBox.hidden = true; s.chipRow.hidden = true; s.note.textContent = ""; },
        show: (s, ctx) => ctx.callout(s.pager, "pending: no answer yet", "bottom"),
      },
      {
        say: "A promise is an object for an answer that is not ready yet. Later the kitchen calls resolve (usually success) or reject (failure).",
        enter: (s) => { s.set("pending", "waiting for the kitchen"); s.setCode(PAGER_INTRO); s.chipRow.hidden = true; s.note.textContent = ""; },
      },
      {
        say: "Here the kitchen makes a mistake. It calls resolve(\"ready\"), then reject, then resolve(\"again\").",
        enter: (s) => { s.set("pending", "waiting for the kitchen"); s.setCode(PAGER_MISTAKE); s.chipRow.hidden = true; s.note.textContent = ""; },
        guess: {
          q: "What does the pager show at the end?", options: ["fulfilled: “ready”", "rejected: sorry", "It changes three times"], answer: 0,
          why: "A promise settles only once. The first call wins: fulfilled with “ready”. Later calls to resolve or reject do nothing.",
        },
        action: { label: "Run it for real", icon: "play", prompt: "Press the button. This is a real promise in your browser.", run: (s) => s.order((resolve, reject) => { resolve("ready"); reject(new Error("sorry")); resolve("again"); }) },
        after: (s) => (s.last ? `The pager shows ${s.last.st} (${s.last.text}). Our handler ran ${s.last.calls} time${s.last.calls === 1 ? "" : "s"}. The two later calls were ignored.` : "Press the button to run it."),
      },
      {
        say: "Free play: choose what the kitchen says, then press the button. Every press makes a new promise.",
        enter: (s) => { s.set("pending", "waiting for the kitchen"); s.codeBox.hidden = true; s.chipRow.hidden = false; s.note.textContent = ""; },
        action: { label: "Order food", icon: "play", again: true, run: (s) => s.order((resolve, reject) => (s.pick === "ready" ? resolve("ready") : reject(new Error("out of food")))) },
        after: (s) => (s.last ? `${s.last.st}: ${s.last.text}. “fulfilled” and “rejected” are the two ways a promise can end. Together they are called “settled”.` : ""),
      },
    ],
    takeaway: "A promise starts pending, then settles once: fulfilled with a value, or rejected with an error. It never changes again.",
    check: {
      q: "A promise is fulfilled with 5. Can it later become rejected?",
      options: ["Yes, if an error happens later", "No, a settled promise never changes", "Yes, but only once"],
      answer: 1,
      why: ["An error later creates a new rejected promise, but this one stays as it is.", "Right. That is why you can trust a promise you hold: its answer is final.", "There is no second chance. Settled means final."],
    },
  });

  /* ---------- 02. The film: a promise chain, generated from the model ---------- */
  const secsFor = (text) => Math.min(4.2, Math.max(1.8, 0.8 + word(text) * 0.11));
  V.film = (specs = [D.chains.happy, D.chains.error], title = "A promise chain, step by step") => {
    const sims = specs.map((s) => D.simulate(s));
    const rows = Math.max(...sims.map((s) => s.nodes.length));
    const maxChars = Math.max(...sims.flatMap((s) => s.lines.map((l) => l.length)));
    const G = {
      wide: { W: 780, rowH: 46, top: 36, codeW: 392, boxX: 420, boxW: 348, fs: 12 },
      tall: { W: 400, rowH: 66, top: 34, codeW: 376, boxX: 12, boxW: 376, fs: 11 },
    };
    for (const g of Object.values(G)) { g.H = g.top + rows * g.rowH + 44; g.fs = Math.min(g.fs, (g.codeW - 24) / (maxChars * 0.6)); }
    const stateText = (nd) => (nd.state === "fulfilled" ? `fulfilled · ${D.fmtVal(nd.value)}` : `rejected · ${nd.reason}`);
    return Book.film({
      title, wide: [G.wide.W, G.wide.H], tall: [G.tall.W, G.tall.H],
      build(svg, Fm, layout) {
        const g = G[layout];
        const tall = layout === "tall";
        const clock = S("text", { x: g.W - 12, y: 20, "text-anchor": "end", class: "fl-small" }, "Time: 0 ms");
        svg.append(S("text", { x: 12, y: 20, class: "fl-small" }, tall ? "Code, and the promise each line makes" : "The code"), clock);
        if (!tall) svg.append(S("text", { x: g.boxX, y: 20, class: "fl-small" }, "The promises"));
        const clockA = Fm.actor(clock, { ms: 0 }, (p, n) => { n.textContent = `Time: ${Math.round(p.ms)} ms`; });
        let T = 0.3;
        sims.forEach((sim, k) => {
          const prog = S("g");
          svg.append(prog);
          const progA = Fm.actor(prog, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));
          const y = (r) => g.top + r * g.rowH;
          const bar = S("rect", { x: 4, width: g.codeW - 8, height: tall ? 17 : 22, rx: 6, class: "fl-line-bar" });
          prog.append(bar);
          const barA = Fm.actor(bar, { row: 0, o: 0 }, (p, n) => { n.setAttribute("y", y(p.row) + (tall ? 3 : 10)); n.setAttribute("opacity", p.o); });
          const lineA = sim.lines.map((text, r) => {
            const tx = S("text", { x: 12, y: y(r) + (tall ? 16 : 25), class: "fl-code", style: `font-size:${g.fs}px`, "xml:space": "preserve" });
            for (const t of Book.tokens(text)) tx.append(S("tspan", { class: t.type === "plain" || t.type === "space" ? "syn-plain" : `syn-${t.type}` }, t.text));
            prog.append(tx);
            return Fm.actor(tx, { skip: 0 }, (p, n) => { n.setAttribute("opacity", 1 - 0.6 * p.skip); n.style.textDecoration = p.skip > 0.5 ? "line-through" : "none"; });
          });
          const boxA = sim.nodes.map((nd, r) => {
            const by = y(r) + (tall ? 24 : 6);
            const grp = S("g");
            const bad = nd.state === "rejected";
            grp.append(
              S("rect", { x: g.boxX, y: by, width: g.boxW, height: 34, rx: 10, class: "as-box-pend", "data-pend": "1" }),
              S("rect", { x: g.boxX, y: by, width: g.boxW, height: 34, rx: 10, class: bad ? "as-box-bad" : "as-box-ok", "data-done": "1" }),
              S("text", { x: g.boxX + 12, y: by + 22, class: "as-box-name" }, `p${r}`),
              S("text", { x: g.boxX + 44, y: by + 22, class: "as-box-state", "data-pend": "1" }, "pending"),
              S("text", { x: g.boxX + 44, y: by + 22, class: "as-box-state", "data-done": "1" }, stateText(nd)));
            if (!tall && r < sim.nodes.length - 1) grp.append(S("path", { d: `M ${g.boxX + 22} ${by + 34} v 12 m -3 -3 l 3 3 l 3 -3`, class: "fl-arc", style: "stroke-dasharray:none" }));
            prog.append(grp);
            return Fm.actor(grp, { o: 0, done: 0 }, (p, n) => {
              n.setAttribute("opacity", p.o);
              n.querySelectorAll("[data-pend]").forEach((e) => e.setAttribute("opacity", 1 - p.done));
              n.querySelectorAll("[data-done]").forEach((e) => e.setAttribute("opacity", p.done));
            });
          });
          /* chapter 1: the code runs, every line makes a new promise */
          const chapters = new Set();
          const mark = (id, at, text) => { if (!chapters.has(id)) { chapters.add(id); Fm.chapter(at, text); } };
          const first = sim.events[0];
          const lateStart = sim.events.some((e) => e.kind === "p0");
          Fm.chapter(T, `Program ${k + 1}: ${sim.spec.title}`);
          chapters.add("start");
          Fm.to(progA, { o: 1 }, T, 0.5);
          Fm.say(T, first.text);
          sim.lines.forEach((_, r) => {
            const at = T + 0.6 + r * 0.32;
            Fm.to(barA, { row: r, o: 1 }, at, 0.25);
            Fm.to(boxA[r], { o: 1 }, at + 0.1, 0.3, Fm.ease.out);
            if (r === 0 && !lateStart) Fm.to(boxA[0], { done: 1 }, at + 0.35, 0.3);
          });
          T += 0.9 + sim.lines.length * 0.32 + secsFor(first.text) - 0.4;
          Fm.to(barA, { o: 0 }, T - 0.3, 0.3);
          /* the rest: promises settle, one at a time */
          sim.events.slice(1).forEach((ev) => {
            const isCatch = ev.step && ev.step.op === "catch";
            if (ev.kind === "p0") mark("settle", T, "A promise settles once");
            else if (ev.kind === "skip" && !isCatch) mark("skip", T, "An error skips every .then");
            else if (ev.kind === "run" && isCatch) mark("catch", T, "A .catch handles the error");
            else if (ev.kind === "wait") mark("wait", T, "A handler can return a promise");
            else if (ev.kind !== "done") mark("handlers", T, "Each handler settles the next promise");
            Fm.say(T, ev.text);
            Fm.to(clockA, { ms: ev.at }, T, 0.5);
            if (ev.k >= 1) Fm.to(barA, { row: ev.k, o: 1 }, T, 0.3);
            if (ev.kind === "skip") Fm.to(lineA[ev.k], { skip: 1 }, T + 0.2, 0.3);
            if (ev.kind !== "wait") Fm.to(boxA[ev.k], { done: 1 }, T + 0.5, 0.4);
            T += secsFor(ev.text);
          });
          Fm.to(barA, { o: 0 }, T, 0.3);
          T += 0.6;
          Fm.to(progA, { o: 0 }, T, 0.5);
          Fm.set(clockA, { ms: 0 }, T + 0.5);
          T += 1;
        });
        Fm.chapter(T, "The rules");
        Fm.say(T, "A promise settles once, and every .then and .catch makes a NEW promise. An error skips .then handlers until a .catch handles it.");
        Fm.end(T + 6);
      },
    });
  };

  /* ---------- 03. Your turn: follow the chain ---------- */
  V.chain = (spec = D.chains.quiz) => {
    const sim = D.simulate(spec);
    const n = sim.nodes.length;
    const strings = sim.nodes.map(say);
    return guided({
      title: "Follow the promise chain",
      build(view) {
        const rows = sim.lines.map((text, r) => {
          const chip = h("span.as-state", "pending");
          const row = h("div.as-row", h("span.as-row-name", `p${r}`), h("span.as-row-code", { html: Book.highlight(text.trim()) }), chip);
          return { row, chip };
        });
        const out = h("p.as-hint", { "aria-live": "polite" });
        view.append(h("div.as-rows", rows.map((r) => r.row)), out);
        const s = { real: null, out };
        /* upTo: promises 0..upTo are settled; lit: the one the reader is on */
        s.state = (upTo, lit) => rows.forEach((r, k) => {
          const nd = sim.nodes[k];
          const done = k <= upTo;
          r.chip.textContent = done ? (s.real ? say(s.real[k]) : strings[k]) : "pending";
          r.chip.dataset.state = done ? nd.state : "pending";
          r.row.classList.toggle("lit", k === lit);
          r.row.classList.toggle("skipped", done && k >= 1 && !nd.ran);
        });
        return s;
      },
      steps: [
        {
          say: `p0 is already fulfilled with ${D.fmtVal(sim.nodes[0].value)}. Each line is called on the promise above it, like p1 = p0.then(...), and makes a new promise.`,
          enter: (s) => { s.real = null; s.out.textContent = ""; s.state(0, 0); },
        },
        ...sim.nodes.slice(1).map((nd, i) => {
          const k = i + 1;
          const interesting = !(nd.ran && (sim.spec.steps[i].op === "add" || sim.spec.steps[i].op === "mul"));
          const base = { enter: (s) => { s.real = null; s.out.textContent = ""; s.state(k - 1, k); } };
          if (!interesting) return { ...base, say: sim.why[k], show: (s) => s.state(k, k) };
          const pool = [strings[k - 1], "fulfilled with undefined", "pending forever"].filter((x) => x !== strings[k]);
          const opts = [strings[k], pool[0], pool[1]];
          const rot = k % 3;
          const options = opts.map((_, j) => opts[(j + rot) % 3]);
          return {
            ...base,
            say: `Line ${k}: ${sim.lines[k].trim()}. What does p${k} become?`,
            guess: { q: `What is p${k}?`, options, answer: options.indexOf(strings[k]), why: sim.why[k] },
            onReveal: (s) => s.state(k, k),
          };
        }),
        {
          say: "Now run the same code in this browser, with real promises.",
          enter: (s) => { s.real = null; s.out.textContent = ""; s.state(n - 1, -1); },
          action: {
            label: "Run it for real", icon: "play", prompt: "Press the button to run the real code.",
            run: async (s) => { const r = await D.runForReal(sim.spec); s.real = r.states; s.state(n - 1, -1); s.agree = D.simStates(sim).every((x, k) => x.state === r.states[k].state && String(x.value ?? x.reason) === String(r.states[k].value ?? r.states[k].reason)); },
          },
          after: (s) => `The real promises finished like this: ${s.real.map((x, k) => `p${k} ${x.state}`).join(", ")}. ${s.agree ? "It matches what you just learned." : "The page and the model disagree: please report this."}`,
        },
      ],
      takeaway: "A .then handler runs only on success and a .catch handler only on failure. The other one is skipped, and its promise copies the one before.",
      check: {
        q: "p1 is rejected. p2 = p1.then(handler). What happens?",
        options: ["The handler runs with the error", "The handler is skipped and p2 is rejected with the same error", "p2 stays pending forever"],
        answer: 1,
        why: ["That is what .catch does. A .then handler gets only a good value.", "Right. The error travels down the chain until a .catch handles it.", "p2 settles very soon, in a microtask, because p1 is already settled."],
      },
    });
  };

  /* ---------- 04. async/await is promises (the same function, two ways) ---------- */
  V.pair = () => {
    const P = D.PAIR;
    return guided({
      title: "async/await is promises",
      build(view) {
        const left = codeView(P.then);
        const right = codeView(P.await);
        const lw = h("div.as-col", h("span.label", "With promises"), left.el);
        const rw = h("div.as-col", { hidden: true }, h("span.label", "With async / await"), right.el);
        const out = h("div.as-outs", { "aria-live": "polite" });
        view.append(h("div.as-pair", lw, rw), out);
        const s = { left, right, rw, out, ran: null };
        s.lit = (m) => { left.mark(m ? m.then : []); right.mark(m ? m.await : []); };
        return s;
      },
      steps: [
        { say: "This function loads a user, then the user's posts, and handles an error. It uses promises.", enter: (s) => { s.rw.hidden = true; s.lit(null); s.out.replaceChildren(); } },
        { say: "Here is the same function with async and await. Same work, same result.", enter: (s) => { s.rw.hidden = false; s.lit(null); s.out.replaceChildren(); } },
        ...P.map.map((m) => ({ say: m.say, enter: (s) => { s.rw.hidden = false; s.lit(m); s.out.replaceChildren(); } })),
        {
          say: "Both versions run the same way, even when the server fails. Let us check with real code.",
          enter: (s) => { s.rw.hidden = false; s.lit(null); s.out.replaceChildren(); },
          guess: { q: "getUser fails with “user not found”. Which version prints “failed: user not found”?", options: ["Only the promise version", "Only the await version", "Both"], answer: 2, why: "A rejected promise reaches .catch in the first version. In the second, await throws the error, and catch gets it. It is the same promise underneath." },
          action: {
            label: "Run both, with getUser failing", icon: "play", prompt: "Press the button. Both versions run for real.",
            run: async (s) => { const [a, b] = [await D.runPair("then", true), await D.runPair("await", true)]; s.ran = { a, b }; s.out.replaceChildren(h("p", h("b", "Promise version printed: "), a.logs.join(" | ")), h("p", h("b", "Await version printed: "), b.logs.join(" | "))); },
          },
          after: (s) => `Both printed the same thing (${s.ran.b.logs[0]}). async/await is a way to write promises, not a different tool.`,
        },
      ],
      takeaway: "await waits for a promise inside an async function, and try/catch catches a rejected promise. It is the same promise as .then and .catch, just written top to bottom.",
      check: {
        q: "What does an async function always return?",
        options: ["The value it returns, directly", "A promise", "Nothing, until you call await"],
        answer: 1,
        why: ["The caller gets a promise that will be fulfilled with that value.", "Right. If the function returns 3, you get a promise fulfilled with 3. If it throws, you get a rejected promise.", "await is only for waiting inside. The call itself returns a promise at once."],
      },
    });
  };

  /* ---------- 05. Where does await pause? ---------- */
  V.pause = () => {
    const prog = D.awaitProgram(Sim);
    const res = Sim.run(prog);
    const j = (a) => a.join(" > ");
    const options = [j(res.console), j(Sim.sourceOrder(prog)), j(["start", "end", "work: before await", "work: after await"])].sort();
    const code = Sim.generate(prog).lines;
    return guided({
      title: "Where does await pause?",
      build(view) {
        const dots = h("div.as-dots", { "aria-hidden": "true" });
        const ticks = readout("Timer ticks while waiting (every 20 ms)");
        const took = readout("The function waited");
        const printed = readout("It printed");
        const stats = h("div.readouts", ticks.el, took.el, printed.el);
        const cv = codeView(code);
        const con = h("p.as-hint", { "aria-live": "polite" });
        const codeBox = h("div.as-codebox", { hidden: true }, cv.el, con);
        const fnBox = h("div.as-codebox", Book.code(D.PAIR.setup + "\n\n" + D.PAIR.await.join("\n") + "\n\nshowPosts(1); // from page 04"));
        view.append(fnBox, h("div.as-tickbox", h("span.label", "The page is alive: a timer ticks"), dots), stats, codeBox);
        const s = { dots, ticks, took, printed, stats, codeBox, fnBox, con, cv, last: null, real: null };
        s.reset = () => { dots.replaceChildren(); ticks.set("—"); took.set("—"); printed.set("—"); };
        return s;
      },
      steps: [
        {
          say: "This is the async function from page 04 (getUser and getPosts take 100 ms each). A timer on this page ticks every 20 ms.",
          enter: (s) => { s.reset(); s.codeBox.hidden = true; s.fnBox.hidden = false; s.stats.hidden = false; },
          guess: { q: "While the function waits 200 ms, what happens to the page?", options: ["It freezes, like the busy loop on the event loop page", "It keeps working: timers and clicks still run", "Only clicks work"], answer: 1, why: "await pauses only the function. The browser is free, so it can run the timer, handle clicks and draw the page." },
          action: {
            label: "Run it and count the ticks", icon: "play", prompt: "Press the button. The timer should keep ticking.",
            run: async (s) => {
              s.reset();
              const r = await D.awaitTicks(false, (n) => { s.dots.append(h("i.as-dot")); s.ticks.set(String(n)); });
              s.last = r; s.ticks.set(String(r.ticks)); s.took.set(`${fmt(r.ms)} ms`); s.printed.set(r.logs.join(" "));
            },
          },
          after: (s) => (s.last ? `The function waited ${fmt(s.last.ms)} ms and the timer ticked ${s.last.ticks} times (measured just now). await did not stop the page.` : ""),
        },
        {
          say: "await pauses only the rest of this function. The code that called work() keeps going.",
          enter: (s) => { s.stats.hidden = true; s.fnBox.hidden = true; s.codeBox.hidden = false; s.cv.mark([]); s.con.textContent = ""; s.real = null; },
          guess: { q: "In what order do the four lines print?", options, answer: options.indexOf(j(res.console)), why: "“work: before await” prints at once, then the call returns and “end” prints. The rest of work() resumes later, as a microtask." },
          action: {
            label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.",
            run: async (s, ctx) => { s.real = await Sim.runForReal(prog); for (let i = 1; i <= s.real.length; i++) { s.con.textContent = j(s.real.slice(0, i)); await ctx.wait(240); } },
          },
          after: (s) => `Your browser printed: ${j(s.real)}. ${j(s.real) === j(res.console) ? "The event-loop simulator says the same." : "The event-loop simulator differs: please report this."} Even await null pauses the function for one tiny step, until the microtask queue runs.`,
        },
      ],
      takeaway: "await pauses only its own function. The page keeps running, and the rest of the function continues later as a microtask.",
      check: {
        q: "Code after an await runs...",
        options: ["Immediately, in the same step", "Later, as a microtask, after the current code finishes", "Only after all timers run"],
        answer: 1,
        why: ["That would not be a pause. The function has to wait for its promise.", "Right. This is the microtask queue from the event loop lesson. The rest of the function runs as soon as its promise is ready, before the next timer or click.", "Timers are tasks. Microtasks always go before the next task."],
      },
    });
  };

  /* ---------- 06. One by one, or all together? (real timers) ---------- */
  function lanes(delays, span) {
    const W = narrow() ? 340 : 640;
    const x0 = narrow() ? 22 : 24;
    const X = (t) => x0 + (t / span) * (W - x0 - 10);
    const svg = S("svg", { viewBox: `0 0 ${W} ${delays.length * 30 + 30}`, class: "as-lane", role: "img", "aria-label": "A timeline: when each request starts and ends" });
    const bars = delays.map((_, i) => {
      svg.append(S("text", { x: 4, y: 20 + i * 30, class: "fl-small" }, String(i + 1)));
      const r = S("rect", { x: x0, y: 8 + i * 30, width: 0, height: 18, rx: 5, class: "as-bar" });
      svg.append(r);
      return r;
    });
    const total = S("line", { y1: 2, y2: delays.length * 30 + 4, class: "as-total", opacity: 0 });
    const totalT = S("text", { y: delays.length * 30 + 22, class: "fl-small", "text-anchor": "end", opacity: 0 });
    svg.append(total, totalT, S("text", { x: x0, y: delays.length * 30 + 22, class: "fl-small" }, "0 ms"));
    return {
      el: svg,
      draw(marks, now, done) {
        bars.forEach((r, i) => {
          const m = marks[i];
          if (!m) { r.setAttribute("width", 0); return; }
          const end = m.end ?? now;
          r.setAttribute("x", X(m.start));
          r.setAttribute("width", Math.max(0, X(end) - X(m.start)));
          r.classList.toggle("done", m.end != null);
        });
        const last = Math.max(0, ...marks.map((m) => m?.end ?? 0));
        total.setAttribute("opacity", done ? 1 : 0); totalT.setAttribute("opacity", done ? 1 : 0);
        total.setAttribute("x1", X(last)); total.setAttribute("x2", X(last));
        totalT.setAttribute("x", X(last) - 4); totalT.textContent = `total ${fmt(last)} ms`;
      },
    };
  }
  const SEQ_CODE = [
    "// fetchItem(id) returns a promise",
    "// One by one: each request waits for the one before.",
    "for (const id of ids) {",
    "  await fetchItem(id);",
    "}",
  ].join("\n");
  const ALL_CODE = [
    "// fetchItem(id) returns a promise",
    "// All together: ids.map starts every request at once, then Promise.all waits.",
    "await Promise.all(ids.map((id) => fetchItem(id)));",
  ].join("\n");
  V.parallel = () => guided({
    title: "One by one, or all together?",
    build(view) {
      const sets = D.PARALLEL_SETS;
      const s = { set: sets[0], res: {}, charts: {} };
      const rows = { sequential: h("div.as-lanerow"), parallel: h("div.as-lanerow") };
      const stage = h("div.as-lanebox", rows.sequential, rows.parallel);
      const codeBox = h("div.as-codebox");
      const chips = sets.map((x, i) => {
        const b = h("button.chip", { type: "button", "aria-pressed": String(i === 0) }, x.label);
        b.addEventListener("click", () => { s.set = x; chips.forEach((c) => c.setAttribute("aria-pressed", String(c === b))); s.fresh(["sequential", "parallel"]); });
        return b;
      });
      const chipRow = h("div.as-chips", { hidden: true }, h("span.label", "Each request takes"), chips);
      const a = readout("One by one"), b = readout("All together");
      const stats = h("div.readouts", { hidden: true }, a.el, b.el);
      view.append(codeBox, stage, stats, chipRow);
      Object.assign(s, { chipRow, stats, a, b, codeBox, stage });
      /* Keep the matching half of the code on screen with each step. */
      s.setCode = (parts) => codeBox.replaceChildren(...parts.map((p) => Book.code(p)));
      /* A fresh chart for each way that is shown. Both use the same time scale (the sum of the delays). */
      s.fresh = (show) => {
        s.res = {};
        const span = D.expectedTotal("sequential", s.set.delays);
        for (const mode of ["sequential", "parallel"]) {
          rows[mode].hidden = !show.includes(mode);
          s.charts[mode] = lanes(s.set.delays, span);
          s.charts[mode].draw([], 0, false);
          rows[mode].replaceChildren(h("span.label", mode === "sequential" ? "One by one" : "All together"), s.charts[mode].el);
        }
        a.set("—"); b.set("—");
      };
      /* Run the real timers; redraw the bars on every frame while they run. */
      s.run = async (mode) => {
        const chart = s.charts[mode];
        const marks = [];
        const t0 = performance.now();
        let live = true;
        const loop = () => { if (!live) return; chart.draw(marks, performance.now() - t0, false); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        const r = await D.timeRequests(mode, s.set.delays, marks);
        live = false;
        chart.draw(r.marks, r.total, true);
        s.res[mode] = r;
        (mode === "sequential" ? a : b).set(`${fmt(r.total)} ms`);
      };
      return s;
    },
    steps: [
      {
        say: "Three friends each fetch one thing from a shop, 100 ms per trip. They can go one by one, or all at the same time.",
        enter: (s) => { s.set = D.PARALLEL_SETS[0]; s.setCode([SEQ_CODE, ALL_CODE]); s.chipRow.hidden = true; s.stats.hidden = true; s.fresh([]); },
      },
      {
        say: "First, one by one. Each request waits until the one before it has finished.",
        enter: (s) => { s.set = D.PARALLEL_SETS[0]; s.setCode([SEQ_CODE]); s.chipRow.hidden = true; s.stats.hidden = true; s.fresh(["sequential"]); },
        guess: { q: "Three requests, 100 ms each, one by one. About how long in total?", options: ["About 100 ms", "About 300 ms", "About 200 ms"], answer: 1, why: "Each request starts only when the one before is done, so the times add up: 100 + 100 + 100." },
        action: { label: "Run one by one (real timers)", icon: "play", prompt: "Press the button. Real timers run now.", run: (s) => s.run("sequential") },
        after: (s) => `It took ${fmt(s.res.sequential.total)} ms. The delays added up to ${D.expectedTotal("sequential", s.set.delays)} ms.`,
      },
      {
        say: "ids.map starts every request at once. Promise.all then waits for all of them.",
        enter: (s) => { s.set = D.PARALLEL_SETS[0]; s.setCode([ALL_CODE]); s.chipRow.hidden = true; s.stats.hidden = true; s.fresh(["parallel"]); },
        guess: { q: "Same three requests, all together. About how long?", options: ["About 300 ms", "About 100 ms", "About 30 ms"], answer: 1, why: "They all run at the same time, so the total is the time of the slowest one: 100 ms." },
        action: { label: "Run all together (real timers)", icon: "play", prompt: "Press the button.", run: (s) => s.run("parallel") },
        after: (s) => `It took ${fmt(s.res.parallel.total)} ms. That is the longest single delay (${D.expectedTotal("parallel", s.set.delays)} ms), not the sum.`,
      },
      {
        say: "Free play: pick the delays, then run both ways. Both charts use the same time scale.",
        enter: (s) => { s.setCode([SEQ_CODE, ALL_CODE]); s.chipRow.hidden = false; s.stats.hidden = false; s.fresh(["sequential", "parallel"]); },
        action: { label: "Run both", icon: "play", again: true, run: async (s) => { s.fresh(["sequential", "parallel"]); await s.run("sequential"); await s.run("parallel"); } },
        after: (s) => `One by one: ${fmt(s.res.sequential.total)} ms (the sum is ${D.expectedTotal("sequential", s.set.delays)}). Together: ${fmt(s.res.parallel.total)} ms (the longest is ${D.expectedTotal("parallel", s.set.delays)}).`,
      },
    ],
    takeaway: "Wait for requests one by one only when each needs the answer of the one before. Otherwise start them together and wait for all.",
    check: {
      q: "You need the user first, because the posts request needs user.id. Can you use Promise.all for both?",
      options: ["Yes, it is always faster", "No: the second request needs the first answer, so await them in order", "Yes, but only with async/await"],
      answer: 1,
      why: ["Promise.all only helps with requests that do not depend on each other.", "Right. Use Promise.all for independent work, and await in order for dependent work.", "async/await does not change this rule."],
    },
  });

  /* ---------- 09. Latest result wins ---------- */
  V.latest = () => {
    const SPAN = 520;
    return guided({
      title: "Latest result wins",
      build(view) {
        const W = narrow() ? 340 : 640;
        const x0 = 8;
        const X = (t) => x0 + (t / SPAN) * (W - x0 - 10);
        const svg = S("svg", { viewBox: `0 0 ${W} 150`, class: "as-lane", role: "img", "aria-label": "A timeline of two search requests and when each answer arrives" });
        const s = { mode: "none", which: "slowFirst", events: [], busy: false };
        const typedEl = h("b.tab", "—");
        const screen = h("b.tab", "—");
        const typedR = { el: h("div.readout", h("span.label", "You typed"), typedEl) };
        const screenR = { el: h("div.readout", h("span.label", "The screen shows"), screen) };
        const verdict = h("p.as-hint", { "aria-live": "polite" });
        const modeChips = D.SEARCH_MODES.map((m) => {
          const b = h("button.chip", { type: "button", "aria-pressed": String(m.id === "none") }, m.label);
          b.addEventListener("click", () => { s.mode = m.id; modeChips.forEach((c) => c.setAttribute("aria-pressed", String(c === b))); s.codeFor(); s.reset(); });
          return b;
        });
        const orderChips = [["slowFirst", "First answer is slow"], ["fastFirst", "First answer is fast"]].map(([id, label]) => {
          const b = h("button.chip", { type: "button", "aria-pressed": String(id === "slowFirst") }, label);
          b.addEventListener("click", () => { s.which = id; orderChips.forEach((c) => c.setAttribute("aria-pressed", String(c === b))); s.reset(); });
          return b;
        });
        const chipRow = h("div.as-chips", { hidden: true }, h("span.label", "Fix"), modeChips, h("span.label", "Network"), orderChips);
        const codeBox = h("div.as-codebox");
        view.append(svg, h("div.readouts", typedR.el, screenR.el), verdict, chipRow, codeBox);
        Object.assign(s, { svg, typedEl, screen, verdict, chipRow, codeBox });
        s.codeFor = () => codeBox.replaceChildren(Book.code(D.SEARCH_CODE[s.mode]));
        /* draw the timeline from the events so far (real timers), now = ms since start */
        s.draw = (events, now) => {
          svg.replaceChildren();
          svg.append(S("text", { x: x0, y: 14, class: "fl-small" }, "You type"));
          const plan = D.TYPED[s.which];
          plan.forEach((k, i) => {
            const sent = events.find((e) => e.kind === "send" && e.req === i + 1);
            if (sent) svg.append(S("rect", { x: X(sent.t) - 1.5, y: 20, width: 3, height: 12, rx: 1.5, class: "as-key" }), S("text", { x: X(sent.t) + 5, y: 31, class: "fl-small" }, `“${k.q}”`));
          });
          plan.forEach((k, i) => {
            const req = i + 1;
            const y = 52 + i * 38;
            const sent = events.find((e) => e.kind === "send" && e.req === req);
            const end = events.find((e) => (e.kind === "arrive" || e.kind === "abort") && e.req === req);
            if (!sent) return;
            const to = end ? end.t : now;
            svg.append(S("text", { x: x0, y: y - 6, class: "fl-small" }, `Request ${req} for “${k.q}”`),
              S("rect", { x: X(sent.t), y, width: Math.max(1, X(to) - X(sent.t)), height: 14, rx: 5, class: "as-bar" + (end ? " done" : "") }));
            if (end && end.kind === "arrive") {
              const bad = end.overwrote;
              svg.append(S("circle", { cx: X(end.t), cy: y + 7, r: 7, class: end.ignored ? "as-dot-ignored" : bad ? "as-dot-bad" : "as-dot-ok" }));
              svg.append(S("text", { x: Math.min(X(end.t) + 11, W - 4), y: y + 11, "text-anchor": X(end.t) + 11 > W - 90 ? "end" : "start", class: "fl-small" }, end.ignored ? "ignored" : bad ? "OLD answer replaces the new one" : end.stale ? "shown, but already old" : "shown"));
            }
            if (end && end.kind === "abort") svg.append(S("path", { d: `M ${X(end.t) - 6} ${y + 1} l 12 12 m 0 -12 l -12 12`, class: "as-x" }), S("text", { x: X(end.t) + 10, y: y + 11, class: "fl-small" }, "cancelled"));
          });
          svg.append(S("text", { x: x0, y: 142, class: "fl-small" }, "0 ms"), S("text", { x: W - 8, y: 142, class: "fl-small", "text-anchor": "end" }, `${SPAN} ms`));
        };
        s.reset = () => { s.events = []; s.draw([], 0); typedEl.textContent = "—"; screen.textContent = "—"; screen.classList.remove("as-bad"); verdict.textContent = ""; };
        s.run = async () => {
          s.reset();
          const t0 = performance.now();
          let live = true;
          const loop = () => { if (!live) return; s.draw(s.events, performance.now() - t0); requestAnimationFrame(loop); };
          requestAnimationFrame(loop);
          const r = await D.runSearch({ mode: s.mode, typed: D.TYPED[s.which], onEvent: (e) => { s.events.push(e); if (e.kind === "send") typedEl.textContent = e.q; if (e.kind === "arrive") screen.textContent = e.screen ? `results for “${e.screen}”` : "—"; } });
          live = false;
          s.draw(s.events, SPAN);
          s.result = r;
          const finalQ = D.TYPED[s.which][D.TYPED[s.which].length - 1].q;
          const good = r.shown === finalQ;
          screen.classList.toggle("as-bad", !good);
          verdict.textContent = good ? `The screen ends on “${r.shown}”, the last thing you typed.` : `You typed “${finalQ}”, but the screen shows results for “${r.shown}”: this is the bug.`;
          return r;
        };
        s.codeFor();
        return s;
      },
      steps: [
        { say: "You type “re”, then 60 ms later “a”: two requests go out. A search box does this on every key.", enter: (s) => { s.mode = "none"; s.which = "slowFirst"; s.chipRow.hidden = true; s.codeFor(); s.reset(); } },
        {
          say: "Servers answer in any order. The first request is slow (400 ms). The second is fast (100 ms).",
          enter: (s) => { s.mode = "none"; s.which = "slowFirst"; s.chipRow.hidden = true; s.codeFor(); s.reset(); },
          guess: { q: "After both answers arrive, what do the results on screen belong to?", options: ["“rea”, the newest query", "“re”, the old query", "Both lists mixed"], answer: 1, why: "The answer for “rea” arrives first, then the slow answer for “re” replaces it. The screen is wrong, and nothing throws an error." },
          action: { label: "Type and run (real timers)", icon: "play", prompt: "Press the button. The page really waits for both answers.", run: (s) => s.run() },
          after: (s) => s.verdict.textContent,
        },
        {
          say: "Fix 1: give each request a number, and ignore an answer that is not the newest.",
          enter: (s) => { s.mode = "id"; s.which = "slowFirst"; s.chipRow.hidden = true; s.codeFor(); s.reset(); },
          action: { label: "Run with the request-id fix", icon: "play", run: (s) => s.run() },
          after: (s) => `${s.verdict.textContent} The old request still finishes; only its answer is ignored.`,
        },
        {
          say: "Fix 2: cancel the old request when a new one starts, with an AbortController.",
          enter: (s) => { s.mode = "abort"; s.which = "slowFirst"; s.chipRow.hidden = true; s.codeFor(); s.reset(); },
          action: { label: "Run with AbortController", icon: "play", run: (s) => s.run() },
          after: (s) => `${s.verdict.textContent} The cancelled request ends with an AbortError, and we catch it quietly, because it was on purpose.`,
        },
        {
          say: "Free play: choose a fix and the network speed, then run.",
          enter: (s) => { s.chipRow.hidden = false; s.codeFor(); s.reset(); },
          action: { label: "Type and run", icon: "play", again: true, run: (s) => s.run() },
          after: (s) => s.verdict.textContent + (s.which === "fastFirst" && s.mode === "none" ? " The bug hides when the first answer is fast, so it is hard to find on a fast network." : ""),
        },
      ],
      takeaway: "Answers can arrive in a different order than the requests. Only show the answer to the latest request: ignore the old ones with an id, or cancel them with an AbortController.",
      check: {
        q: "Which fix also cancels the old request in the browser?",
        options: ["The request id", "AbortController", "Both do"],
        answer: 1,
        why: ["The id only ignores the old answer. The request still finishes.", "Right. Aborting tells the browser to cancel the request. (The server may still run, but the browser stops waiting.)", "Only abort cancels. The id just ignores."],
      },
    });
  };

  /* ---------- 11. From your work: the optimistic seat booking film ---------- */
  V.seatFilm = () => {
    const traces = { success: D.seatTrace("success"), error: D.seatTrace("error") };
    const G = {
      wide: { W: 780, H: 330, tables: { T3: [250, 120], T4: [430, 120], T5: [610, 120] }, list: [20, 100, 180, 90], toast: [430, 270] },
      tall: { W: 400, H: 470, tables: { T3: [90, 150], T4: [200, 150], T5: [310, 150] }, list: [20, 40, 360, 56], toast: [200, 430] },
    };
    return Book.film({
      title: "Seating a booking: a guess, then the truth", wide: [G.wide.W, G.wide.H], tall: [G.tall.W, G.tall.H],
      build(svg, Fm, layout) {
        const g = G[layout];
        const tall = layout === "tall";
        const R = 36;
        svg.append(S("text", { x: 12, y: 20, class: "fl-small" }, tall ? "Floor plan (a small model of the idea)" : "A small model of Speako's optimistic seat booking, not the real code"));
        const [lx, ly, lw, lh] = g.list;
        svg.append(S("rect", { x: lx, y: ly, width: lw, height: lh, rx: 12, class: "fl-field" }), S("text", { x: lx + 12, y: ly + 22, class: "fl-small" }, "Booking list"), S("text", { x: lx + 12, y: ly + 46, class: "as-t-name" }, "Sam · 4 people"));
        if (!tall) svg.append(S("text", { x: lx + 12, y: ly + 70, class: "fl-small" }, "waiting to be seated"));
        const tab = {};
        for (const [id, [cx, cy]] of Object.entries(g.tables)) {
          const grp = S("g");
          grp.append(S("circle", { cx, cy, r: R, class: "as-table", "data-t": "1" }), S("circle", { cx, cy, r: R, class: "as-table-solid", "data-solid": "1" }), S("circle", { cx, cy, r: R, class: "as-table-ghost", "data-ghost": "1" }),
            S("text", { x: cx, y: cy - 4, "text-anchor": "middle", class: "as-t-id" }, id), S("text", { x: cx, y: cy + 14, "text-anchor": "middle", class: "as-t-name", "data-name": "1" }, ""));
          svg.append(grp);
          tab[id] = { grp, cx, cy, a: Fm.actor(grp, { solid: id === "T3" ? 1 : 0, ghost: 0 }, (p, n) => {
            n.querySelector("[data-solid]").setAttribute("opacity", p.solid);
            n.querySelector("[data-ghost]").setAttribute("opacity", p.ghost);
            const nm = n.querySelector("[data-name]");
            nm.setAttribute("opacity", Math.max(p.solid, p.ghost));
          }) };
        }
        const names = { T3: "Lee · 2", T4: "Sam · 4", T5: "" };
        Object.entries(tab).forEach(([id, t]) => { t.grp.querySelector("[data-name]").textContent = names[id]; });
        const [tx, ty] = g.toast;
        const toast = S("g");
        toast.append(S("rect", { x: tx - 100, y: ty - 18, width: 200, height: 30, rx: 15, class: "as-toast" }), S("text", { x: tx, y: ty + 2, "text-anchor": "middle", class: "as-toast-t" }, "Seat assignment failed"));
        svg.append(toast);
        const toastA = Fm.actor(toast, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));
        let T = 0.4;
        const look = (tables) => Object.entries(tables).forEach(([id, v]) => {
          const t = tab[id];
          Fm.to(t.a, { solid: v && !v.pending ? 1 : 0, ghost: v && v.pending ? 1 : 0 }, T, 0.5);
        });
        const secs = (text) => Math.min(4.6, Math.max(2.2, 0.9 + word(text) * 0.12));
        [["success", "It works: the guess is confirmed"], ["error", "It fails: the guess is taken back"]].forEach(([key, name]) => {
          Fm.chapter(T, name);
          traces[key].forEach((f, i) => {
            Fm.say(T, f.text);
            if (i === 0) { Fm.to(toastA, { o: 0 }, T, 0.2); look(f.tables); }
            else look(f.tables);
            if (f.toast) Fm.to(toastA, { o: 1 }, T + 0.3, 0.4);
            T += secs(f.text);
          });
          T += 0.6;
        });
        Fm.say(T, "The host sees the result at once. The server's answer only confirms it, or takes it back.");
        Fm.end(T + 4);
      },
    });
  };
})();
