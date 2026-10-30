/* The event loop: the films and guided visuals. Every order, caption and number comes from the simulator
   (event-loop.sim.js), which dev/event-loop.test.js checks against real Node. Nothing here is typed by hand. */
(function () {
  const { h, guided, fmt, svg: S } = Book;
  const V = Book.parts["event-loop"];
  const Sim = V.sim;
  const F = Sim.FRAME_MS;
  const PR = Sim.programs;

  const readout = (label, value = "—") => {
    const b = h("b.tab", value);
    return { el: h("div.readout", h("span.label", label), b), set: (t) => { b.textContent = t; } };
  };
  /* Wait for the browser to really paint (hidden tabs never get a frame, so a timer is the fallback). */
  const painted = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 200); });
  const join = (a) => (a ? a.join(" ") : "—");

  /* ---------- shared: a code block with lit lines, and a console ---------- */
  function codeView(lines) {
    const els = lines.map((t) => h("span.el-ln", { html: Book.highlight(t) || " " }));
    const el = h("pre.code-block.el-code", { "aria-label": "The program" }, els);
    return { el, mark(done, lit) { els.forEach((e, i) => { e.classList.toggle("done", done.includes(i)); e.classList.toggle("lit", i === lit); }); } };
  }
  function consoleBox(title = "Console") {
    const body = h("div.el-con-body", { "aria-live": "polite" });
    return { el: h("div.el-console", h("span.label", title), body), set(lines) { body.replaceChildren(...lines.map((t) => h("div.el-con-line", t))); } };
  }

  /* ---------- 01. Why does the page freeze? (the real thing, on a click) ---------- */
  V.freeze = () => guided({
    title: "Why does the page freeze?",
    build(view) {
      const ring = h("div.el-spin", { role: "img", "aria-label": "A spinning ring. It stops when JavaScript is busy." }, h("i"));
      const status = h("p.el-status", { "aria-live": "polite" });
      const took = readout("The loop blocked the page for");
      const lost = readout("Frames the page could not draw");
      const wait = readout("Longest wait between two ring frames");
      const chips = ["300", "800", "1500"].map((ms) => {
        const b = h("button.chip", { type: "button", "aria-pressed": String(ms === "1500") }, `${Number(ms) / 1000} s`);
        b.addEventListener("click", () => { s.ms = Number(ms); chips.forEach((c) => c.setAttribute("aria-pressed", String(c === b))); });
        return b;
      });
      const chipRow = h("div.el-chips", { hidden: true }, h("span.label", "Loop length"), chips);
      const stats = h("div.readouts", took.el, lost.el, wait.el);
      view.append(h("div.el-freeze", ring, status), stats, chipRow);
      const s = { ring, status, took, lost, wait, stats, chipRow, ms: 1500, spinning: true, angle: 0, maxGap: 0, seen: false, last: null };
      let prev = performance.now();
      const tick = (now) => {
        if (s.seen && !ring.isConnected) return;
        if (ring.isConnected) s.seen = true;
        const gap = now - prev;
        prev = now;
        if (s.spinning) {
          s.angle = (s.angle + Math.min(gap, 40) * 0.36) % 360;
          ring.style.transform = `rotate(${Book.reduced ? Math.floor(s.angle / 45) * 45 : s.angle}deg)`;
        }
        s.maxGap = Math.max(s.maxGap, gap);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      s.show = (on) => { stats.classList.toggle("away", !on); };
      s.fill = () => {
        const r = s.last;
        took.set(r ? `${fmt(r.took)} ms` : "—");
        lost.set(r ? `about ${fmt(Math.floor(r.took / F))}` : "—");
        wait.set(r ? `${fmt(r.gap)} ms` : "—");
      };
      s.run = async () => {
        s.status.textContent = `Running a ${s.ms / 1000} s loop… the page cannot respond now.`;
        await painted();
        s.maxGap = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < s.ms) { /* this is the freeze: the thread is busy */ }
        const took = performance.now() - t0;
        await painted();
        await painted();
        s.last = { took, gap: s.maxGap };
        s.status.textContent = "The loop is finished. The ring moves again.";
        s.fill();
      };
      return s;
    },
    steps: [
      {
        say: "This ring is spinning. JavaScript turns it a little bit, many times each second.",
        enter: (s) => { s.spinning = true; s.show(false); s.chipRow.hidden = true; s.status.textContent = ""; s.fill(); },
        show: (s, ctx) => ctx.callout(s.ring, "JavaScript moves this", "bottom"),
      },
      {
        say: "Now JavaScript will run one loop that takes 1.5 seconds. Your page will really freeze for that time.",
        enter: (s) => { s.show(false); s.chipRow.hidden = true; s.status.textContent = ""; s.ms = 1500; },
        guess: { q: "While the loop runs, will the ring keep spinning?", options: ["Yes, it keeps spinning", "It stops until the loop ends", "It spins slower"], answer: 1, why: "There is one main thread. It runs your JavaScript, handles clicks and draws the page, one thing at a time. While your loop runs, it cannot move the ring." },
        action: { label: "Run the 1.5 s loop", icon: "play", prompt: "Press the button. Watch the ring.", run: async (s) => { await s.run(); s.show(true); } },
        after: (s) => (s.last ? `The loop blocked the page for ${fmt(s.last.took)} ms. The ring code waited ${fmt(s.last.gap)} ms for its next turn. These numbers were measured with performance.now() just now.` : "Press the button to measure it."),
      },
      {
        say: "On a 60 Hz screen, the browser wants a new frame every 16.7 ms (60 frames per second). Your loop made it miss many.",
        enter: (s) => { s.show(true); s.fill(); s.chipRow.hidden = true; s.status.textContent = ""; },
        after: "A frame that is not drawn is a moment where the page looks stuck. This is what “the page freezes” means.",
      },
      {
        say: "Your turn: choose how long the loop runs, and press the button.",
        enter: (s) => { s.show(true); s.fill(); s.chipRow.hidden = false; s.status.textContent = ""; },
        action: { label: "Run the loop", icon: "play", again: true, run: async (s) => { await s.run(); s.fill(); } },
        after: (s) => (s.last ? `${fmt(s.last.took)} ms blocked, so about ${fmt(Math.floor(s.last.took / F))} frames were lost.` : "Press the button to measure it."),
      },
    ],
    takeaway: "JavaScript, clicks and drawing all share one main thread, so a long loop freezes the whole page.",
    check: {
      q: "Your code runs a loop for 200 ms. Can the user click a button during that time?",
      options: ["Yes, the browser handles the click at once", "The click waits until the loop is finished", "The click is lost"],
      answer: 1,
      why: ["The click handler is JavaScript, and the single thread is busy with your loop.", "Right. The click waits in a queue until the thread is free.", "It is not lost. It waits, and then it runs."],
    },
  });

  /* ---------- 02. Predict the order ---------- */
  const orderOptions = (prog) => {
    const res = Sim.run(prog);
    const k = Sim.kindOrders(res);
    const list = [...new Set([join(Sim.sourceOrder(prog)), join(k.timersFirst), join(k.correct), join(k.promisesFirst)])].sort();
    return { res, list, answer: list.indexOf(join(k.correct)), k };
  };
  V.predict = () => {
    const basic = PR.basic;
    const o = orderOptions(basic);
    const kinds = Sim.logSteps(o.res).reduce((m, l) => { (m[l.ctx.kind === "script" ? "sync" : l.ctx.kind === "timer" ? "timer" : "micro"] ||= []).push(l.text); return m; }, {});
    const pickable = ["basic", "nested", "asyncOrder", "puzzle", "timers"];
    return guided({
      title: "Predict the order",
      build(view) {
        const code = h("div.el-codebox");
        const con = consoleBox("Real console output");
        const cmp = h("p.el-compare");
        const chips = pickable.map((id) => {
          const b = h("button.chip", { type: "button", "aria-pressed": "false" }, PR[id].title);
          b.addEventListener("click", () => s.load(PR[id]));
          return b;
        });
        const picker = h("div.el-chips", { hidden: true }, h("span.label", "Try another program"), chips);
        view.append(h("div.el-pair", code, h("div.el-side", con.el, cmp)), picker);
        const s = {
          code, con, cmp, picker, cur: null, real: null,
          load(p) {
            s.cur = p; s.real = null;
            const r = Sim.run(p);
            code.replaceChildren(codeView(r.lines).el);
            con.set([]); cmp.textContent = "";
            chips.forEach((c, i) => c.setAttribute("aria-pressed", String(PR[pickable[i]] === p)));
          },
          async run(ctx) {
            s.real = await Sim.runForReal(s.cur);
            for (let i = 1; i <= s.real.length; i++) { con.set(s.real.slice(0, i)); await ctx.wait(260); }
            const sim = Sim.run(s.cur).console;
            cmp.textContent = join(sim) === join(s.real) ? `The simulator said: ${join(sim)}. The browser printed the same.` : `The simulator said ${join(sim)} but the browser printed ${join(s.real)}.`;
          },
        };
        s.load(basic);
        return s;
      },
      steps: [
        {
          say: "Read this code. It has four console.log lines: A, B, C and D. Think before you press anything.",
          enter: (s) => { s.load(basic); s.picker.hidden = true; },
        },
        {
          say: "The code is the same. Guess the order of the four letters.",
          enter: (s) => { s.load(basic); s.picker.hidden = true; },
          guess: {
            q: "In what order will the letters print?", options: o.list, answer: o.answer,
            why: `Plain lines run first (${join(kinds.sync)}). Then the promise callback (${join(kinds.micro)}), because promise callbacks run before any timer. A timer always goes last (${join(kinds.timer)}), even at 0 ms. You'll see why on page 03.`,
          },
          action: { label: "Run it in this browser", icon: "play", prompt: "Press the button to run the real code.", run: (s, ctx) => s.run(ctx) },
          after: (s) => (s.real ? `Your browser printed: ${join(s.real)}.` : "Press the button to run the real code."),
        },
        {
          say: "Free play: pick a program, guess in your head, then run it. The simulator and your browser should always agree.",
          enter: (s) => { s.picker.hidden = false; s.load(s.cur || basic); },
          action: { label: "Run it in this browser", icon: "play", again: true, run: (s, ctx) => s.run(ctx) },
        },
      ],
      takeaway: "JavaScript runs plain lines first, then all promise callbacks (microtasks), then timers (tasks).",
      check: {
        q: "A setTimeout with 0 ms and a promise.then are both ready. Which callback runs first?",
        options: ["The setTimeout, because 0 ms is instant", "The promise.then, because microtasks go before the next task", "It is random"],
        answer: 1,
        why: ["0 ms means “as soon as possible after the current work”. It is still a task, and it waits.", "Yes. After the script ends, the loop empties the microtask queue before it takes any task.", "It is not random. The order is fixed by the rules you just saw."],
      },
    });
  };

  /* ---------- 03. The film, generated from the simulator ---------- */
  const IH = 34;
  const GAP = 4;
  const KIND = { script: "ink", call: "ink", timer: "timer", then: "micro", await: "micro", qm: "micro", spin: "micro", raf: "raf" };
  const fit = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  const phaseOf = (t) => (/^Task|^The page/.test(t) ? 0 : /^Micro/.test(t) ? 1 : /^Paint check/.test(t) ? 2 : /^Wait|^A timer/.test(t) ? 3 : -1);
  const PHASES = ["Run a task", "Microtasks", "Paint check", "Wait"];
  const frameSecs = (f) => Math.min(3.4, Math.max(1.5, 0.7 + f.caption.split(" ").length * 0.1));

  V.film = (programs = [PR.basic, PR.harder], title = "The event loop, step by step") => {
    const runs = programs.map((p) => Sim.run(p));
    const maxLines = Math.max(...runs.map((r) => r.lines.length));
    const maxOut = Math.max(...runs.map((r) => r.console.length));
    const wideCodeH = Math.max(250, maxLines * 17 + 26);
    const wideH = Math.max(470, 34 + wideCodeH + 40);
    const tallCodeH = maxLines * 15 + 26;
    const y1 = 34 + tallCodeH + 14;
    const conH = maxOut * 18 + 36;
    const G = {
      wide: { W: 780, H: wideH, lh: 17, fs: 12, code: { x: 12, y: 34, w: 292, h: wideCodeH }, stack: { x: 316, y: 34, w: 130, h: 200 }, apis: { x: 454, y: 34, w: 150, h: 200 }, tasks: { x: 316, y: 246, w: 288, h: 58 }, micro: { x: 316, y: 312, w: 288, h: 58 }, raf: { x: 316, y: 378, w: 288, h: 58 }, con: { x: 614, y: 34, w: 154, h: 402 }, strip: { x: 316, y: wideH - 22 } },
      tall: { W: 400, H: y1 + 388 + conH + 60, lh: 15, fs: 11, code: { x: 12, y: 34, w: 376, h: tallCodeH }, stack: { x: 12, y: y1, w: 180, h: 168 }, apis: { x: 204, y: y1, w: 184, h: 168 }, tasks: { x: 12, y: y1 + 180, w: 376, h: 58 }, micro: { x: 12, y: y1 + 246, w: 376, h: 58 }, raf: { x: 12, y: y1 + 312, w: 376, h: 58 }, con: { x: 12, y: y1 + 378, w: 376, h: conH }, strip: { x: 12, y: y1 + 378 + conH + 16 } },
    };
    return Book.film({
      title, wide: [G.wide.W, G.wide.H], tall: [G.tall.W, G.tall.H],
      build(svg, Fm, layout) {
        const g = G[layout];
        const panel = (key, text) => svg.append(S("rect", { x: g[key].x, y: g[key].y, width: g[key].w, height: g[key].h, rx: 12, class: "fl-field" }), S("text", { x: g[key].x + 10, y: g[key].y + 15, class: "fl-small" }, text));
        panel("stack", "Call stack"); panel("apis", "Browser timers"); panel("tasks", "Task queue"); panel("micro", "Microtask queue"); panel("raf", "Before paint (requestAnimationFrame)"); panel("con", "Console");
        svg.append(S("text", { x: g.code.x + 2, y: g.code.y - 10, class: "fl-small" }, "The program"));

        /* the loop strip at the bottom: which part of the loop are we in, and the clock */
        const chips = PHASES.map((name, i) => {
          const x = g.strip.x + i * 94;
          const grp = S("g");
          grp.append(S("rect", { x, y: g.strip.y, width: 88, height: 22, rx: 11, class: "fl-field" }), S("rect", { x, y: g.strip.y, width: 88, height: 22, rx: 11, class: "fl-ink", "data-on": "1" }),
            S("text", { x: x + 44, y: g.strip.y + 15, "text-anchor": "middle", class: "fl-chip", "data-off": "1", style: "font-size:11px" }, name), S("text", { x: x + 44, y: g.strip.y + 15, "text-anchor": "middle", class: "fl-chip-inv", "data-on": "1", style: "font-size:11px" }, name));
          svg.append(grp);
          return Fm.actor(grp, { lit: 0 }, (p, n) => {
            n.querySelectorAll("[data-on]").forEach((e) => e.setAttribute("opacity", p.lit));
            n.querySelectorAll("[data-off]").forEach((e) => e.setAttribute("opacity", 1 - p.lit));
          });
        });
        const clock = S("text", layout === "tall" ? { x: 12, y: g.strip.y + 40, class: "fl-small" } : { x: g.W - 12, y: g.strip.y + 15, "text-anchor": "end", class: "fl-small" }, "Time: 0 ms");
        svg.append(clock);
        const clockA = Fm.actor(clock, { ms: 0 }, (p, n) => { n.textContent = `Time: ${Math.round(p.ms)} ms`; });

        /* where does an item sit in a frame? */
        const place = (f) => {
          const pos = {};
          const vert = (ids, p, fromBottom) => {
            const step = ids.length > 1 ? Math.min(IH + GAP, (p.h - 38 - IH) / (ids.length - 1)) : 0;
            ids.forEach((id, i) => { pos[id] = { x: p.x + 8, y: fromBottom ? p.y + p.h - 6 - IH - i * step : p.y + 24 + i * step }; });
          };
          const horiz = (ids, p) => {
            const w = ids.map((id) => 20 + 7 * Math.max(fit(runs.cur.items[id].label, 12).length, fit(runs.cur.items[id].sub, 16).length * 0.8));
            const sum = w.reduce((a, b) => a + b, 0);
            const gap = ids.length > 1 ? Math.min(6, (p.w - 16 - sum) / (ids.length - 1)) : 0;
            let x = p.x + 8;
            ids.forEach((id, i) => { pos[id] = { x, y: p.y + 22 }; x += w[i] + gap; });
          };
          vert(f.stack, g.stack, true); vert(f.apis, g.apis, false);
          horiz(f.tasks, g.tasks); horiz(f.micro, g.micro); horiz(f.raf, g.raf);
          return pos;
        };
        const itemNode = (it) => {
          const w = 20 + 7 * Math.max(fit(it.label, 12).length, fit(it.sub, 16).length * 0.8);
          const n = S("g");
          n.append(S("rect", { width: w, height: IH, rx: 8, class: "el-it" }), S("rect", { x: 6, y: 6, width: 4, height: IH - 12, rx: 2, class: "el-k-" + KIND[it.kind] }),
            S("text", { x: 16, y: 15, class: "el-t1" }, fit(it.label, 12)), S("text", { x: 16, y: 27, class: "el-t2" }, fit(it.sub, 16)));
          svg.append(n);
          return n;
        };

        let T = 0.3;
        runs.forEach((r, k) => {
          runs.cur = r;
          /* code panel for this program */
          const cg = S("g");
          cg.append(S("rect", { x: g.code.x, y: g.code.y, width: g.code.w, height: g.code.h, rx: 12, class: "fl-code-bg" }));
          const top = g.code.y + 14;
          const bar = S("rect", { x: g.code.x + 4, width: g.code.w - 8, height: g.lh, rx: 5, class: "fl-line-bar" });
          cg.append(bar);
          r.lines.forEach((text, i) => {
            const tx = S("text", { x: g.code.x + 12, y: top + i * g.lh + g.lh * 0.78, class: "fl-code", style: `font-size:${g.fs}px`, "xml:space": "preserve" });
            for (const t of Book.tokens(text)) tx.append(S("tspan", { class: t.type === "plain" || t.type === "space" ? "syn-plain" : `syn-${t.type}` }, t.text));
            cg.append(tx);
          });
          svg.append(cg);
          const codeA = Fm.actor(cg, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));
          const barA = Fm.actor(bar, { line: 0, o: 0 }, (p, n) => { n.setAttribute("y", top + p.line * g.lh); n.setAttribute("opacity", p.o); });
          const outs = r.console.map((text, i) => {
            const t = S("text", { x: g.con.x + 12, y: g.con.y + 38 + i * 18, class: "el-con" }, text);
            svg.append(t);
            return Fm.actor(t, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));
          });
          Fm.to(codeA, { o: 1 }, T, 0.5);
          T += 0.6;

          const alive = new Map();
          let lastGroup = null;
          let shown = 0;
          let lastLine = 0;
          r.frames.forEach((f) => {
            if (!lastGroup || f.group.id !== lastGroup) {
              Fm.chapter(T, lastGroup ? f.group.title : `Program ${k + 1}: ${r.program.title}`);
              const ph = phaseOf(f.group.title);
              chips.forEach((c, i) => Fm.to(c, { lit: i === ph ? 1 : 0 }, T, 0.3));
              lastGroup = f.group.id;
            }
            Fm.say(T, (f.i === 0 ? `Program ${k + 1}. ` : "") + f.caption);
            Fm.to(clockA, { ms: f.time }, T, 0.5);
            if (f.line != null) { lastLine = f.line; Fm.to(barA, { line: f.line, o: 1 }, T, 0.3); } else Fm.to(barA, { line: lastLine, o: 0.25 }, T, 0.3);
            while (shown < f.out) Fm.to(outs[shown++], { o: 1 }, T + 0.3, 0.4);
            const pos = place(f);
            for (const [id, p] of Object.entries(pos)) {
              const a = alive.get(id);
              if (!a) {
                const actor = Fm.actor(itemNode(r.items[id]), { x: p.x, y: p.y + 10, o: 0 });
                alive.set(id, { actor, x: p.x, y: p.y });
                Fm.to(actor, { x: p.x, y: p.y, o: 1 }, T, 0.4, Fm.ease.out);
              } else if (a.x !== p.x || a.y !== p.y) {
                Fm.to(a.actor, { x: p.x, y: p.y }, T, 0.55);
                a.x = p.x; a.y = p.y;
              }
            }
            for (const [id, a] of alive) if (!pos[id]) { Fm.to(a.actor, { o: 0 }, T, 0.3); alive.delete(id); }
            T += frameSecs(f);
          });
          Fm.to(codeA, { o: 0 }, T, 0.5);
          Fm.to(barA, { o: 0 }, T, 0.3);
          outs.forEach((o) => Fm.to(o, { o: 0 }, T, 0.5));
          Fm.set(clockA, { ms: 0 }, T + 0.5);
          T += 1.0;
        });
        Fm.chapter(T, "The rule");
        chips.forEach((c, i) => Fm.to(c, { lit: 0 }, T, 0.3));
        Fm.say(T, "The rule: run a task. Empty the microtask queue. Check if a frame is due, and paint. Then take the next task. This order is the same in every modern browser.");
        Fm.end(T + 6);
      },
    });
  };

  /* ---------- 04. Your turn: what logs next? ---------- */
  V.stepper = (prog, title, check) => {
    const res = Sim.run(prog);
    const logs = Sim.logSteps(res);
    const order = Sim.sourceOrder(prog);
    const names = (ids) => ids.map((i) => res.items[i].label);
    return guided({
      title,
      build(view) {
        const code = codeView(res.lines);
        const con = consoleBox();
        const queues = h("div.el-queues");
        view.append(h("div.el-pair", code.el, h("div.el-side", con.el, queues)));
        return {
          /* n lines have printed; if lit, the n-th one just printed and its reason is on screen */
          state(n, lit) {
            code.mark(logs.slice(0, n - (lit ? 1 : 0)).map((l) => l.line), lit && n > 0 ? logs[n - 1].line : -1);
            con.set(logs.slice(0, n).map((l) => l.text));
            const f = res.frames[n > 0 ? logs[n - 1].frame : 0];
            const row = (label, ids) => ids.length ? h("div.el-q", h("span.label", label), names(ids).map((t) => h("span.chip", t))) : null;
            queues.replaceChildren(...(n > 0 ? [row("Microtask queue", f.micro), row("Timers and tasks waiting", [...f.apis, ...f.tasks])] : [h("p.el-hint", "The first task is the script. Read the code, then find the first line that prints.")]));
          },
        };
      },
      steps: [
        { say: "Read the code. Every console.log prints one text. You will find the order, one line at a time.", enter: (s) => s.state(0) },
        ...logs.map((l, k) => {
          const left = order.filter((t) => !logs.slice(0, k).some((x) => x.text === t));
          const base = { say: `Line ${k + 1} of ${logs.length} on the console. What prints next?`, enter: (s) => s.state(k), after: l.why };
          return left.length > 1
            ? { ...base, guess: { q: "Which one prints next?", options: left, answer: left.indexOf(l.text), why: l.why }, after: undefined, onReveal: (s) => s.state(k + 1, true) }
            : { ...base, say: `Last line. Only “${l.text}” is left. ${l.why}`, show: (s) => s.state(k + 1, true) };
        }),
      ],
      takeaway: "Run plain code first. Empty the whole microtask queue (including new microtasks). Only then take the next timer task.",
      check,
    });
  };

  /* ---------- shared: a timeline lane drawn from a simulator run ---------- */
  function lane(res, span, { busy = false, updates = false } = {}) {
    const W = matchMedia("(max-width: 560px)").matches ? 340 : 640; // narrower drawing on phones keeps the labels readable
    const X = (t) => 10 + (t / span) * (W - 20);
    const svg = S("svg", { viewBox: `0 0 ${W} ${updates ? 76 : 68}`, class: "el-lane", role: "img", "aria-label": "A timeline of frames, long tasks and paints" });
    const items = [];
    const add = (node, t, onClass) => { svg.append(node); items.push({ node, t, onClass }); };
    const paints = res.frames.filter((f) => f.paint);
    const lost = new Set();
    const ok = new Set();
    paints.forEach((p) => {
      const cur = Math.floor(p.time / F + 1e-6);
      ok.add(cur);
      for (let k = cur - p.missed; k < cur; k++) lost.add(k);
    });
    for (let k = 1; k * F < span; k++) {
      const r = S("rect", { x: X(k * F) + 1, y: 4, width: X(F) - X(0) - 2, height: 14, rx: 4, class: "el-slot" });
      const hit = ok.has(k) ? "ok" : lost.has(k) ? "lost" : null;
      add(r, hit ? (res.frames.find((f) => f.paint && Math.floor(f.time / F + 1e-6) >= k).time) : Infinity, hit);
    }
    svg.append(S("text", { x: 10, y: 66 + (updates ? 8 : 0), class: "fl-small" }, "0 ms"), S("text", { x: W - 10, y: 66 + (updates ? 8 : 0), class: "fl-small", "text-anchor": "end" }, `${Math.round(span)} ms`));
    if (busy) res.frames.filter((f) => f.busy).forEach((f) => add(S("rect", { x: X(f.busy.from) + 0.5, y: 24, width: Math.max(1, X(f.busy.to) - X(f.busy.from) - 1), height: 16, rx: 3, class: "el-busy" }), f.busy.to));
    if (updates) res.frames.filter((f) => f.kind === "log").forEach((f) => add(S("circle", { cx: X(f.time), cy: 30, r: 4.5, class: "el-upd" }), f.time));
    paints.forEach((p) => add(S("path", { d: `M ${X(p.time)} ${updates ? 40 : 42} l 5 6 l -5 6 l -5 -6 z`, class: "el-paint" }), p.time));
    return {
      el: svg,
      reveal(p) {
        const upTo = p * span;
        items.forEach((it) => {
          const on = upTo >= it.t - 1e-6;
          it.node.style.opacity = it.onClass || it.t === Infinity ? "" : on ? "1" : "0";
          if (it.onClass) it.node.setAttribute("class", "el-slot" + (on ? " " + it.onClass : ""));
        });
      },
      perPaint() {
        const out = [];
        let n = 0;
        res.frames.forEach((f) => { if (f.kind === "log") n++; if (f.paint) { out.push(n); n = 0; } });
        return out;
      },
    };
  }
  const grow = (ln, ctx, ms = 1600) => ctx.tween({ from: 0, to: 1, ms, ease: (t) => t, onUpdate: (p) => ctx.alive() && ln.reveal(p) });

  /* ---------- 05. Where rendering happens ---------- */
  V.frames = () => {
    const chunkRun = (ms) => {
      const make = (n) => (n <= 0 ? [] : [Sim.ops.T(0, Sim.ops.BUSY(ms), ...make(n - 1))]);
      return Sim.run({ id: "chunks", title: "chunks", ops: make(Math.round(120 / ms)) });
    };
    const A = Sim.run(PR.longTask);
    const span = (r) => Math.ceil((Math.max(r.endTime, 120) + 1) / F) * F;
    const supports = "scheduler" in window && "yield" in scheduler;
    return guided({
      title: "Where rendering happens",
      build(view) {
        const a = { run: A, ln: lane(A, span(A), { busy: true }), label: "One long task" };
        const b = { run: null, ln: null, label: "" };
        const rowA = h("div.el-row", h("span.label", a.label), a.ln.el);
        const rowB = h("div.el-row", { hidden: true });
        const legend = h("p.el-legend", [["ok", "frame painted"], ["lost", "frame lost"], ["busy", "JavaScript running"], ["pt", "paint"]].map(([k, t]) => h("span", h("i.sw." + k), t)));
        const chips = [5, 10, 30, 60].map((ms) => {
          const c = h("button.chip", { type: "button", "aria-pressed": String(ms === 10) }, `${ms} ms`);
          c.addEventListener("click", () => { s.chunk = ms; chips.forEach((x) => x.setAttribute("aria-pressed", String(x === c))); });
          return c;
        });
        const chipRow = h("div.el-chips", { hidden: true }, h("span.label", "Chunk size"), chips);
        view.append(rowA, rowB, legend, chipRow);
        const s = { a, rowA, rowB, chipRow, chunk: 10, b };
        s.setB = (ms) => {
          const r = chunkRun(ms);
          const ln = lane(r, Math.max(span(r), span(A)), { busy: true });
          s.b = { run: r, ln };
          rowB.replaceChildren(h("span.label", `The same 120 ms of work, in ${ms} ms chunks`), ln.el);
          rowB.hidden = false;
        };
        return s;
      },
      steps: [
        { say: "The browser can draw the screen about every 16.7 ms on a 60 Hz screen. Each box is one moment (16.7 ms) when the browser could draw the screen.", enter: (s) => { s.a.ln.reveal(0); s.rowB.hidden = true; s.chipRow.hidden = true; } },
        {
          say: "A task of 120 ms starts at time 0. While it runs, the browser cannot paint.",
          enter: (s) => { s.a.ln.reveal(0); s.rowB.hidden = true; s.chipRow.hidden = true; },
          guess: { q: "How many of those moments pass before the browser can draw again?", options: ["None, it draws on time", `About ${Math.round(A.dropped / 2)}`, `About ${A.dropped}`], answer: 2, why: `The task is 120 ms long and one box is 16.7 ms. The thread is busy for all of those moments (the simulator counted ${A.dropped}), so they cannot be drawn.` },
          action: { label: "Run the long task", icon: "play", run: (s, ctx) => grow(s.a.ln, ctx) },
          after: `The simulator counted ${A.dropped} lost frames. The first paint came only after the task ended, at 120 ms.`,
        },
        {
          say: "Now the same 120 ms of work, cut into 10 ms chunks. Between chunks, the browser gets a turn.",
          enter: (s) => { s.a.ln.reveal(1); s.setB(10); s.b.ln.reveal(0); s.chipRow.hidden = true; },
          action: { label: "Run the chunks", icon: "play", run: (s, ctx) => grow(s.b.ln, ctx) },
          after: (s) => `Frames lost: ${s.b.run.dropped}. The total work is the same. To give the browser a turn between chunks you can use setTimeout, or ${supports ? "await scheduler.yield() (your browser has it)" : "await scheduler.yield() (your browser does not have it yet, so test for it first)"}.`,
        },
        {
          say: "Free play: choose the chunk size. Bigger chunks block longer.",
          enter: (s) => { s.a.ln.reveal(1); s.setB(s.chunk); s.b.ln.reveal(1); s.chipRow.hidden = false; },
          action: { label: "Run the chunks", icon: "play", again: true, run: async (s, ctx) => { s.setB(s.chunk); await grow(s.b.ln, ctx); } },
          after: (s) => `${s.chunk} ms chunks: ${s.b.run.dropped} frame${s.b.run.dropped === 1 ? "" : "s"} lost.`,
        },
      ],
      takeaway: "A long task blocks painting. Cut the work into short chunks and the browser can paint (and answer clicks) in between.",
      check: {
        q: "You split 120 ms of work into 3 chunks of 40 ms. Will the page feel smooth?",
        options: ["Yes, the total is the same", "Not yet: each 40 ms chunk still blocks about 2 frames", "Yes, because chunks run in parallel"],
        answer: 1,
        why: ["The total does not matter. The longest single block matters.", "Right. Keep each chunk short, ideally under about 10 to 16 ms.", "Chunks do not run in parallel. JavaScript still has one thread."],
      },
    });
  };

  /* ---------- 08. Trade-offs ---------- */
  V.tradeoffs = () => {
    const CAP = 8;
    const starve = Sim.run(PR.starve, { microCap: CAP });
    const T1 = Sim.run(PR.timeoutAnim);
    const T2 = Sim.run(PR.rafAnim);
    const sp = Math.ceil((Math.max(T1.endTime, T2.endTime) + 1) / F) * F;
    return guided({
      title: "Two ways the loop gets stuck",
      build(view) {
        const ticks = Array.from({ length: CAP }, () => h("span.chip.el-tick", "tick"));
        const timer = h("span.chip.el-wait", "timer · 0 ms · waiting");
        const paint = h("span.chip.el-wait", "paint · waiting");
        const starveBox = h("div.el-starve", h("div.el-q", h("span.label", "Microtasks that ran"), ticks), h("div.el-q", h("span.label", "Still waiting"), timer, paint), h("p.el-hint", { "aria-live": "polite" }));
        const l1 = lane(T1, sp, { updates: true });
        const l2 = lane(T2, sp, { updates: true });
        const n1 = h("p.el-hint");
        const n2 = h("p.el-hint");
        const animBox = h("div.el-anim", h("div.el-row", h("span.label", "setTimeout(update, 20) in a loop"), l1.el, n1), h("div.el-row", h("span.label", "requestAnimationFrame(update) in a loop"), l2.el, n2), h("p.el-legend", [["ok", "frame painted"], ["lost", "frame lost"], ["upd", "update"], ["pt", "paint"]].map(([k, t]) => h("span", h("i.sw." + k), t))));
        view.append(starveBox, animBox);
        const note = () => { n1.textContent = `Frames lost: ${T1.dropped}. Updates in each frame, one number per frame: ${join(l1.perPaint())}`; n2.textContent = `Frames lost: ${T2.dropped}. Updates in each frame, one number per frame: ${join(l2.perPaint())}`; };
        return { ticks, timer, paint, starveBox, animBox, l1, l2, n1, n2, note, hint: starveBox.querySelector(".el-hint") };
      },
      steps: [
        {
          say: "Trap 1. A microtask can add another microtask, and another, forever.",
          enter: (s) => { s.starveBox.hidden = false; s.animBox.hidden = true; s.ticks.forEach((t) => t.classList.remove("on")); s.timer.classList.remove("on"); s.hint.textContent = ""; },
          guess: { q: "A 0 ms timer and an endless microtask chain are both ready. What happens?", options: ["The timer runs after a few microtasks", "The timer never runs"], answer: 1, why: "The loop empties the microtask queue before it takes any task. If the queue never gets empty, no timer runs and no paint happens. The tab hangs." },
          action: {
            label: `Run the simulator (stops at ${CAP} steps)`, icon: "play",
            run: async (s, ctx) => { for (const t of s.ticks) { if (!ctx.alive()) return; t.classList.add("on"); await ctx.wait(220); } s.timer.classList.add("on"); },
          },
          after: (s) => { s.hint.textContent = `After ${CAP} microtasks the queue still is not empty, so the timer and the paint are still waiting.`; return `The simulator stopped by itself after ${CAP} steps (that is its safety limit). A real page would never stop, and the timer ${starve.console.includes("timer") ? "ran" : "has not run"}.`; },
        },
        {
          say: "Trap 2. For animation, which one lines up with the screen?",
          enter: (s) => { s.starveBox.hidden = true; s.animBox.hidden = false; s.l1.reveal(0); s.l2.reveal(0); s.n1.textContent = ""; s.n2.textContent = ""; },
          guess: { q: "Both loops update 10 times. Which one never misses a frame of the screen?", options: ["setTimeout every 20 ms", "requestAnimationFrame", "Both the same"], answer: 1, why: "rAF callbacks run right before each paint, so every frame gets one update. A timer has its own clock and does not know when the screen refreshes, so some frames get no update at all (the red boxes)." },
          action: {
            label: "Run both", icon: "play",
            run: async (s, ctx) => { await Promise.all([grow(s.l1, ctx, 2000), grow(s.l2, ctx, 2000)]); },
          },
          after: (s) => { s.note(); return `With the timer, ${T1.dropped} frames got no update. With rAF, ${T2.dropped}. A frame with no update looks like a small stutter. Use rAF for animation.`; },
        },
        {
          say: "Rules of thumb. Animation: requestAnimationFrame. A delay: setTimeout. Keep microtask chains short.",
          enter: (s) => { s.starveBox.hidden = true; s.animBox.hidden = false; s.l1.reveal(1); s.l2.reveal(1); s.note(); },
          action: { label: "Replay the race", icon: "refresh", again: true, run: async (s, ctx) => { s.l1.reveal(0); s.l2.reveal(0); s.n1.textContent = ""; s.n2.textContent = ""; await Promise.all([grow(s.l1, ctx, 2000), grow(s.l2, ctx, 2000)]); s.note(); } },
        },
      ],
      takeaway: "The loop drains microtasks before anything else, so keep them short. For animation, rAF runs right before the paint; a timer does not.",
      check: {
        q: "Which is the better tool to move an element on every frame?",
        options: ["setInterval(move, 16)", "requestAnimationFrame(move)", "queueMicrotask(move)"],
        answer: 1,
        why: ["The timer has its own clock and drifts against the screen.", "Yes. It runs just before each paint, and it pauses in background tabs.", "A microtask runs before the paint and blocks it if it repeats."],
      },
    });
  };

  /* ---------- 09. Anemone: two clocks ---------- */
  /* The look-ahead rule is copied from Anemone's v2/js/audio/scheduler.js (tick()). */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function twoClocks() {
    const BEAT = 0.25;
    const wakes = [];
    for (let t = 0; t < 1.0; t += 0.04) wakes.push(+t.toFixed(2));
    wakes.push(2, 3, 4, 5);
    let lookahead = 0.15;
    let lastWake = 0;
    let nextBeat = BEAT;
    const rows = wakes.map((wake) => {
      if (lastWake || wake > 0) {
        const gap = wake - lastWake;
        const wanted = clamp(gap * 1.5 + 0.05, 0.15, 2);
        lookahead = wanted > lookahead ? wanted : lookahead + (wanted - lookahead) * 0.05;
      }
      lastWake = wake;
      const beats = [];
      while (nextBeat < wake + lookahead) { beats.push({ t: nextBeat, late: nextBeat < wake }); nextBeat += BEAT; }
      return { wake, lookahead, beats };
    });
    const all = rows.flatMap((r) => r.beats.map((b) => ({ ...b, wake: r.wake }))).filter((b) => b.t <= 5);
    const naive = all.map((b) => { const w = wakes.find((x) => x >= b.t); return { t: b.t, ms: (w - b.t) * 1000 }; });
    return { rows, all, naive, wakes, end: 5.2 };
  }
  V.clocks = () => {
    const M = twoClocks();
    const lateBeats = M.all.filter((b) => b.late);
    const lastLate = Math.max(...lateBeats.map((b) => b.t));
    const stallAt = M.rows.find((r) => r.lookahead > 1).wake;
    const W = 640;
    const X = (t) => 10 + (t / M.end) * (W - 20);
    return guided({
      title: "Two clocks: a rough timer and a precise one",
      build(view) {
        const svg = S("svg", { viewBox: `0 0 ${W} 150`, class: "el-lane", role: "img", "aria-label": "Timer wake-ups and exact audio beats on a timeline" });
        const mk = (node, t, lane) => { svg.append(node); return { node, t, lane }; };
        const els = [];
        svg.append(S("text", { x: 10, y: 14, class: "fl-small" }, "Timer clock: wake-ups"), S("text", { x: 10, y: 74, class: "fl-small" }, "Audio clock: beats at exact times"), S("text", { x: 10, y: 144, class: "fl-small" }, "0 s"), S("text", { x: W - 10, y: 144, class: "fl-small", "text-anchor": "end" }, "5 s"));
        M.rows.forEach((r) => {
          els.push(mk(S("line", { x1: X(r.wake), x2: X(r.wake), y1: 20, y2: 36, class: "el-wake" }), r.wake, r.wake < 1.2 ? 1 : 2));
          els.push(mk(S("rect", { x: X(r.wake), y: 40, width: Math.max(2, X(r.wake + r.lookahead) - X(r.wake)), height: 5, rx: 2, class: "el-window" }), r.wake, r.wake < 1.2 ? 1 : 2));
        });
        M.all.forEach((b) => els.push(mk(S("circle", { cx: X(b.t), cy: 96, r: 5, class: b.late ? "el-beat late" : "el-beat" }), b.wake, b.t < 1.2 ? 0 : 2)));
        M.naive.forEach((b) => els.push(mk(S("rect", { x: X(b.t), y: 112, width: Math.max(2, X(b.t + b.ms / 1000) - X(b.t)), height: 5, rx: 2, class: "el-naive" }), b.t + b.ms / 1000, 3)));
        els.push(mk(S("text", { x: 10, y: 130, class: "fl-small" }, "Red bars: how late each beat would be if a plain setTimeout played it"), 0, 3));
        const look = readout("Look-ahead window");
        const late = readout("Beats played late");
        const worst = readout("Worst delay with plain setTimeout");
        view.append(svg, h("div.readouts", look.el, late.el, worst.el), h("p.el-hint", "A model: a tab that wakes its timer every 40 ms, then goes to the background (1 s wake-ups in this model; real browsers vary). The look-ahead rule is Anemone's, copied from scheduler.js."));
        const s = {
          show(stage) {
            els.forEach((e) => { e.node.style.opacity = e.lane <= stage ? "1" : "0"; });
            const rs = M.rows.filter((r) => stage >= 2 || r.wake < 1.2);
            look.set(stage >= 1 ? `${Math.max(...rs.map((r) => r.lookahead)).toFixed(2)} s` : "—");
            late.set(stage >= 2 ? `${lateBeats.length}` : stage >= 1 ? "0" : "—");
            worst.set(stage >= 3 ? `${fmt(Math.max(...M.naive.map((n) => n.ms)))} ms` : "—");
          },
        };
        return s;
      },
      steps: [
        { say: "The audio clock is exact: a beat can start at 0.25 s, 0.50 s, 0.75 s. But JavaScript timers are rough: they wake up late.", enter: (s) => s.show(0) },
        { say: "Every 40 ms the timer wakes up and looks 0.15 s ahead. It gives the audio clock the exact times of the beats in that window.", enter: (s) => s.show(0), action: { label: "Run the scheduler", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.show(1); } }, after: "No beat is late. Each one was handed over before its time, and the audio clock plays it at the exact moment." },
        {
          say: "Now the tab goes to the background. In a background tab, browsers slow timers down a lot (often to once per second or less). Tabs playing audio are treated more gently. The code makes the look-ahead bigger at once when a wake-up is late.",
          enter: (s) => s.show(1),
          guess: { q: "What happens to the beats?", options: ["All beats play late from now on", "One gap, then they stay on time", "The music stops"], answer: 1, why: `The first slow wake-up (at ${stallAt} s) is a surprise: the look-ahead was still 0.15 s, so ${lateBeats.length} beats were late. The code then grows the look-ahead at once (to ${M.rows.find((r) => r.wake === stallAt).lookahead.toFixed(2)} s). After that, every beat arrives before its time.` },
          action: { label: "Send the tab to the background", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.show(2); } },
          after: `${lateBeats.length} beats were late (the last at ${lastLate.toFixed(2)} s). It is honest to say the scheduler does not fix the first surprise; it makes sure it happens only once.`,
        },
        {
          say: "Compare with the simple way: one setTimeout per beat.",
          enter: (s) => s.show(2),
          action: { label: "Show the plain setTimeout way", icon: "play", again: true, run: async (s, ctx) => { s.show(2); await ctx.wait(300); s.show(3); } },
          after: (s) => "With one timer per beat, each beat waits for the next wake-up. In the background that can be a second late or more. The look-ahead trick is why the score keeps its rhythm.",
        },
      ],
      takeaway: "Use the rough timer only to wake up and plan. Let the precise audio clock play the sound at the exact time.",
      check: {
        q: "Why does the scheduler look ahead (0.15 s or more) instead of playing each beat when the timer fires?",
        options: ["The timer can fire late, so beats are handed over early with exact times", "Looking ahead makes the timer faster", "It saves memory"],
        answer: 0,
        why: ["Right. The timer decides when to plan; the audio clock decides when to play.", "The timer is not faster. It is the same rough timer.", "Memory is not the reason."],
      },
    });
  }

})();
