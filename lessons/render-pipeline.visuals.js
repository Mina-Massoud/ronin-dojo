/* Style, layout, paint, composite: the film and the guided pages.
   Stage names, the table of changes, the read/write loops and the puzzle answers all come from render-pipeline.data.js
   (checked by dev/render-pipeline.test.js). Anything about speed is MEASURED live in the reader's browser, only on a click. */
(function () {
  const { h, guided, svg: S } = Book;
  const V = Book.parts["render-pipeline"];
  const D = V.data;
  const NAME = Object.fromEntries(D.STAGES.map((s) => [s.id, s.name]));
  const reduced = () => Book.reduced;

  /* ---------- shared: the row of five stage chips (HTML, so text stays readable on phones) ---------- */
  function stripView() {
    const ids = D.STAGE_IDS;
    const chips = Object.fromEntries(ids.map((id) => [id, h("div.rp-chip", { "data-stage": id }, h("b", NAME[id]), h("span.rp-chip-state", " "))]));
    const el = h("div.rp-strip", { role: "group", "aria-label": "The five stages: " + ids.map((id) => NAME[id]).join(", then ") }, ids.flatMap((id, k) => [k ? h("i.rp-join", { "aria-hidden": "true" }, "›") : null, chips[id]]));
    const mark = (id, state, label) => {
      const c = chips[id];
      if (!c) return;
      c.classList.toggle("on", state === "on");
      c.classList.toggle("skip", state === "skip");
      c.querySelector(".rp-chip-state").textContent = label || " ";
    };
    return { el, mark, reset() { ids.forEach((id) => mark(id, "", "")); } };
  }

  /* ---------- 01. The film: one frame, five stages ---------- */
  const wrapText = (t, n) => { const out = []; let line = ""; for (const w of t.split(" ")) { if ((line + " " + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + " " + w).trim(); } out.push(line); return out; };
  const secs = (text) => Math.max(2.5, 1 + text.split(" ").length / 2.6);
  V.stagesFilm = () => Book.film({
    title: "One frame, five stages",
    wide: [760, 300],
    tall: [400, 540],
    build(svg, F, layout) {
      const wide = layout === "wide";
      const ST = D.STAGES;
      const cw = wide ? 128 : 340, chh = wide ? 120 : 64, gap = wide ? 12 : 10;
      const x0 = wide ? 36 : 30, y0 = wide ? 150 : 158;
      const pos = (i) => (wide ? { x: x0 + i * (cw + gap), y: y0 } : { x: x0, y: y0 + i * (chh + gap) });
      const bx = x0, by = 58, bw = wide ? 688 : 340, bh = 24;

      /* the frame bar: three frames, then one frame fills the bar */
      svg.append(S("text", { x: bx, y: by - 12, class: "fl-small" }, `One frame ≈ ${D.FRAME_MS} ms (60 per second)`), S("rect", { x: bx, y: by, width: bw, height: bh, rx: 12, class: "fl-field" }));
      const sw = (bw - 12) / 3;
      const segs = [0, 1, 2].map((i) => {
        const g = S("g");
        const r = S("rect", { x: bx + i * (sw + 6), y: by, width: sw, height: bh, rx: 12, class: "rp-seg" });
        const t = S("text", { x: bx + i * (sw + 6) + 12, y: by + 16, class: "fl-small" }, `frame ${i + 1}`);
        g.append(r, t);
        svg.append(g);
        return { r, a: F.actor(g, { o: 0, w: sw }, (p, n) => { n.setAttribute("opacity", Math.max(0, p.o).toFixed(3)); r.setAttribute("width", p.w.toFixed(1)); }) };
      });
      const cards = ST.map((st, i) => {
        const { x, y } = pos(i);
        const g = S("g");
        const rect = S("rect", { width: cw, height: chh, rx: 12, class: "rp-card" });
        g.append(rect, S("text", { x: 12, y: wide ? 30 : 26, class: "rp-name" }, `${i + 1}  ${st.name}`));
        const lines = wide ? wrapText(st.job, 17) : [st.job];
        lines.forEach((ln, k) => g.append(S("text", { x: 12, y: wide ? 56 + k * 18 : 48, class: "rp-job" }, ln)));
        const thread = i < 3 ? "main thread" : i === 4 ? "compositor thread" : "";
        const chip = thread ? S("text", wide ? { x: 12, y: chh - 12, class: "rp-thread" } : { x: cw - 12, y: 38, "text-anchor": "end", class: "rp-thread" }, thread) : null;
        if (chip) g.append(chip);
        svg.append(g);
        const a = F.actor(g, { o: 0, hot: 0, dim: 0, th: 0 }, (p, n) => {
          n.setAttribute("transform", `translate(${x} ${(y + (1 - Math.max(0, p.o)) * 8).toFixed(1)})`);
          n.setAttribute("opacity", (Math.max(0, p.o) * (1 - 0.6 * p.dim)).toFixed(3));
          rect.setAttribute("class", "rp-card" + (p.hot > 0.5 ? " hot" : ""));
          if (chip) chip.setAttribute("opacity", Math.max(0, Math.min(1, p.th)).toFixed(3));
        });
        return a;
      });

      let T = 0.3;
      const line = (text) => { F.say(T, text); const d = secs(text); return d; };

      /* chapter 1: a frame */
      F.chapter(T, "A frame");
      segs.forEach((s, i) => F.to(s.a, { o: 1 }, T + i * 0.25, 0.4, F.ease.out));
      T += line("Most screens show about 60 pictures each second. Each picture is called a frame.");
      T += line(`To keep up, the browser has about ${D.FRAME_MS} ms to make each frame.`);

      /* chapter 2: five stages, one at a time */
      F.chapter(T, "Five stages");
      F.to(segs[0].a, { w: bw }, T, 0.7);
      F.to(segs[1].a, { o: 0 }, T, 0.4);
      F.to(segs[2].a, { o: 0 }, T, 0.4);
      const stageText = [
        "First, JavaScript runs. Your code can change the page.",
        "Style: the browser matches CSS rules to elements. It works out each element's final styles.",
        "Layout: it works out the size and position of every element.",
        "Paint: it fills in pixels for text, colors, images, borders and shadows.",
        "Composite: it puts the painted layers on screen in the right order.",
      ];
      stageText.forEach((text, i) => {
        F.to(cards[i], { o: 1, hot: 1 }, T + 0.1, 0.5, F.ease.out);
        if (i > 0) F.to(cards[i - 1], { hot: 0 }, T + 0.1, 0.3);
        T += line(text);
      });
      F.to(cards[4], { hot: 0 }, T + 0.1, 0.3);
      T += line("When all five run, they must fit inside one frame.");

      /* chapter 3: later stages use what earlier ones made (no specific change is named here) */
      F.chapter(T, "Order matters");
      cards.forEach((c) => F.to(c, { dim: 1 }, T, 0.4));
      for (let i = 1; i < 5; i++) {
        F.to(cards[i], { dim: 0, hot: 1 }, T + 0.5 + (i - 1) * 0.55, 0.4);
        if (i > 1) F.to(cards[i - 1], { hot: 0 }, T + 0.5 + (i - 1) * 0.55, 0.3);
      }
      T += line("Later stages use what earlier ones made. So if one runs again, the later ones usually must too.");
      cards.forEach((c) => F.to(c, { dim: 0, hot: 0 }, T, 0.4));
      T += 0.6;

      /* chapter 4: two threads */
      F.chapter(T, "Two threads");
      cards.forEach((c, i) => { if (i !== 3) F.to(c, { th: 1 }, T + 0.2, 0.5); });
      T += line("JavaScript, style and layout use the main thread. In Chromium, the compositor thread is separate.");
      F.to(cards[4], { hot: 1 }, T, 0.4);
      T += line("It can keep scrolling, and some animations, moving while the main thread is busy.");
      F.end(T + 2);
    },
  });

  /* ---------- 02. Which stages run again? ---------- */
  const shuffleOrder = { width: ["paint", "layout", "composite"], color: ["layout", "composite", "paint"], transform: ["composite", "layout", "paint"] };
  const guessFor = (id) => {
    const ch = D.changeById(id);
    const options = shuffleOrder[id].map((k) => D.pathText(D.PATHS[k]));
    return { q: "Which stages run again after this line?", options, answer: shuffleOrder[id].indexOf(ch.kind), why: `${ch.why} (${D.pathText(D.stagesRun(ch))})` };
  };
  V.whichStages = () => guided({
    title: "Which stages run again?",
    build(view) {
      const strip = stripView();
      const codeBox = h("div.rp-codebox");
      const note = h("p.rp-note", { "aria-live": "polite" });
      const chips = D.CHANGES.map((c) => {
        const b = h("button.chip", { type: "button", "aria-pressed": "false" }, c.prop);
        b.addEventListener("click", async () => { if (s.ctxNow) { s.load(c.id); await s.run(s.ctxNow); } });
        return b;
      });
      const picker = h("div.rp-chips", { hidden: true }, h("span.label", "Change"), chips);
      view.append(codeBox, strip.el, note, picker);
      const s = { strip, note, picker, cur: null, ctxNow: null };
      s.load = (id) => {
        s.cur = D.changeById(id);
        codeBox.replaceChildren(Book.code(s.cur.code));
        strip.reset(); note.textContent = "";
        chips.forEach((b, i) => b.setAttribute("aria-pressed", String(D.CHANGES[i].id === id)));
      };
      s.run = async (ctx) => {
        strip.reset(); note.textContent = "";
        const run = new Set(D.stagesRun(s.cur));
        strip.mark("js", "on", "your code runs");
        await ctx.wait(500);
        for (const id of D.STAGE_IDS.slice(1)) {
          if (!ctx.alive()) return;
          if (run.has(id)) strip.mark(id, "on", "runs again"); else strip.mark(id, "skip", "skipped");
          await ctx.wait(500);
        }
        note.textContent = s.cur.why;
      };
      s.load("width");
      return s;
    },
    steps: [
      {
        say: "JavaScript changes the page. The browser runs only the stages it needs again.",
        enter: (s) => { s.load("width"); s.picker.hidden = true; },
        show: (s, ctx) => ctx.callout(s.strip.el, "the five stages, in order", "top"),
      },
      {
        say: "Here JavaScript sets a new width. Watch the stages light up, one by one.",
        enter: (s) => { s.load("width"); s.picker.hidden = true; },
        guess: guessFor("width"),
        action: { label: "Change the width", icon: "play", prompt: "Press the button and watch the stages.", run: (s, ctx) => s.run(ctx) },
        after: () => "Usually, in Chromium. The next steps show two cheaper paths.",
      },
      {
        say: "Now the text gets a new color. Nothing changes size or position.",
        enter: (s) => { s.load("color"); s.picker.hidden = true; },
        guess: guessFor("color"),
        action: { label: "Change the color", icon: "play", prompt: "Press the button and watch the stages.", run: (s, ctx) => s.run(ctx) },
        after: () => "Usually, in Chromium.",
      },
      {
        say: "Last one: JavaScript moves the box with transform.",
        enter: (s) => { s.load("transform"); s.picker.hidden = true; },
        guess: guessFor("transform"),
        action: { label: "Move the box", icon: "play", prompt: "Press the button and watch the stages.", run: (s, ctx) => s.run(ctx) },
        after: () => "Usually, in Chromium. This is why transform is the first choice for animation.",
      },
      {
        say: "Free play: pick any change and watch which stages run again.",
        enter: (s) => { s.load("top"); s.picker.hidden = false; },
        show: (s, ctx) => { s.ctxNow = ctx; },
      },
    ],
    takeaway: "Changing size or position re-runs Layout and everything after it. Changing only looks re-runs Paint. Changing only transform or opacity can usually skip both. This is the usual path in Chromium, not a law.",
    check: {
      q: "You animate the left property of a box. Which stages run on every frame?",
      options: [D.pathText(D.PATHS.composite), D.pathText(D.PATHS.layout), D.pathText(D.PATHS.paint)],
      answer: 1,
      why: ["That path is for transform and opacity. left changes position, and position is what Layout works out.", "Yes. left is a position, so Layout runs, and Paint and Composite follow.", "That path is for changes to looks only, like color. left moves the box, so Layout must run."],
    },
  });

  /* ---------- 03. Why can a read be slow? (a model: counts a read after a write) ---------- */
  V.thrashModel = () => {
    const N = 6;
    const sims = { thrash: D.simulate("thrash", N), batched: D.simulate("batched", N) };
    return guided({
      title: "Why can a read be slow?",
      build(view) {
        const code = h("div.rp-codebox");
        const ops = h("div.rp-ops", { "aria-label": "The reads and writes, in order" });
        const count = h("b.rp-count", "0");
        const meter = h("div.rp-meter", h("span.label", "Forced layouts (model)"), count);
        const chips = ["thrash", "batched"].map((key) => {
          const b = h("button.chip", { type: "button", "aria-pressed": "false" }, D.LOOPS[key].short);
          b.addEventListener("click", async () => { if (s.ctxNow) { s.load(key); await s.play(s.ctxNow); } });
          return b;
        });
        const picker = h("div.rp-chips", { hidden: true }, h("span.label", "Loop"), chips);
        view.append(h("div.rp-pair", code, h("div.rp-side", ops, meter)), picker);
        const s = { picker, code, key: "thrash", ctxNow: null };
        s.load = (key, ready = true) => {
          s.key = key;
          code.replaceChildren(Book.code(D.LOOPS[key].code));
          const sim = sims[key];
          ops.replaceChildren(...sim.ops.map((o, i) => h("span.rp-op" + (o.t === "R" ? ".read" : ".write") + (o.forced ? ".forced" : ""), { style: { visibility: ready ? "visible" : "hidden" } }, `${o.t === "R" ? "read" : "write"} ${o.i + 1}`, o.forced ? h("small", "layout runs") : null)));
          count.textContent = ready ? String(sim.forced) : "0";
          chips.forEach((c, i) => c.setAttribute("aria-pressed", String(["thrash", "batched"][i] === key)));
        };
        s.play = async (ctx) => {
          const sim = sims[s.key];
          const els = [...ops.children];
          els.forEach((e) => { e.style.visibility = "hidden"; });
          count.textContent = "0";
          let n = 0;
          for (let i = 0; i < els.length; i++) {
            if (!ctx.alive()) return;
            els[i].style.visibility = "visible";
            if (sim.ops[i].forced) { n++; count.textContent = String(n); }
            await ctx.wait(sim.ops[i].forced ? 380 : 240);
          }
        };
        s.load("thrash", false);
        return s;
      },
      steps: [
        {
          say: "The browser is lazy on purpose. It waits, and measures once before it paints.",
          enter: (s) => { s.load("thrash", false); s.picker.hidden = true; },
          show: (s, ctx) => ctx.callout(s.code, "6 boxes, one loop", "top"),
        },
        {
          say: "If your code asks for a size right after a change, the browser must measure now.",
          enter: (s) => { s.load("thrash", false); s.picker.hidden = true; },
          guess: { q: "The loop has 6 boxes, and layout is fresh at the start. How many times must the browser run layout during the loop?", options: ["0 times: it waits until the end", `${sims.thrash.forced} times`, `${sims.thrash.reads} times`], answer: 1, why: `The first read finds fresh layout. Each of the other ${sims.thrash.forced} reads comes right after a write, so layout is old and runs again.` },
          action: { label: "Run the loop", icon: "play", prompt: "Press the button and count.", run: (s, ctx) => s.play(ctx) },
          after: () => "This is called layout thrashing: a forced layout again and again. Here the count comes from a model of the rule, not from a stopwatch. The next page uses a stopwatch.",
        },
        {
          say: "Same work, new order: every read first, then every write.",
          enter: (s) => { s.load("batched", false); s.picker.hidden = true; },
          guess: { q: "How many forced layouts now?", options: ["5", "0", "6"], answer: 1, why: "All the reads happen while layout is still fresh. The writes come after, and the browser measures once, later, before it paints. Your code did not force it." },
          action: { label: "Run the loop", icon: "play", prompt: "Press the button and count.", run: (s, ctx) => s.play(ctx) },
          after: () => `The model counts ${sims.batched.forced}. The browser still runs layout once before painting, but you did not force it.`,
        },
        {
          say: "Free play: run either loop. Then think about 200 boxes instead of 6.",
          enter: (s) => { s.load("thrash", false); s.picker.hidden = false; },
          show: (s, ctx) => { s.ctxNow = ctx; },
          action: { label: "Run the loop", icon: "play", again: true, run: (s, ctx) => s.play(ctx) },
          after: (s) => `With 200 boxes the same model counts ${D.simulate("thrash", 200).forced} forced layouts for the mixed loop and ${D.simulate("batched", 200).forced} for the other.`,
        },
      ],
      takeaway: "Asking for a size right after a change forces layout at once. Do all your reads first, then all your writes.",
      check: {
        q: "Which loop avoids forced layouts?",
        options: ["For each box: write its width, then read its height", "Read all the heights, then write all the widths", "For each box: read its height, then write its width"],
        answer: 1,
        why: ["Each read comes right after a write, so layout runs again every turn.", "Yes. All reads happen while layout is fresh.", "Each read after the first comes right after a write. This is the loop from the page."],
      },
    });
  };

  /* ---------- 04. Measure it here (200 real boxes, timed on a click, capped under a second) ---------- */
  const CELLS = 200;
  const makeLab = () => {
    const cells = Array.from({ length: CELLS }, (_, i) => h("div.rp-cell", h("span", `Booking ${i + 1}`), h("span.rp-cell-sub", "Table for two · 19:30")));
    const lab = h("div.rp-lab", { "aria-label": `${CELLS} real boxes used for timing` }, cells);
    return { lab, cells, flush: () => lab.offsetHeight, reset: () => { for (const c of cells) c.style.height = ""; } };
  };
  V.thrashLive = () => guided({
    title: "Time both loops here",
    build(view) {
      const L = makeLab();
      const out = h("div.rp-out", { "aria-live": "polite" });
      view.append(h("div.rp-pair", h("div.rp-labbox", h("span.label", `${CELLS} real boxes (scroll the list)`), L.lab), out));
      const s = { L, res: null };
      s.measure = async (ctx) => {
        await ctx.wait(60);
        s.res = D.measureTiming({ boxes: L.cells, reset: L.reset, flush: L.flush });
      };
      return s;
    },
    steps: [
      {
        say: "These are 200 real boxes. We will time both loops with the browser clock.",
        enter: (s) => { s.res = null; },
        show: (s, ctx) => ctx.callout(s.L.lab, "200 real boxes", "top"),
      },
      {
        say: "Timing runs only when you press the button, and it takes less than a second.",
        enter: (s) => { s.res = null; },
        guess: { q: "Which loop makes the browser run layout more often?", options: ["Read all, then write all", "Read, write, read, write…", "The same number of times"], answer: 1, why: "The mixed loop forces a layout after almost every write. The other loop lets the layout wait until the end." },
        action: { label: "Time both loops", icon: "play", prompt: "Press the button. It takes less than a second.", run: (s, ctx) => s.measure(ctx) },
        after: (s) => (s.res ? Book.resultCard({
          title: "Measured just now, in this browser",
          rows: [{ label: "Read, write, read, write…", value: s.res.thrash, text: D.fmtMs(s.res.thrash) }, { label: "Read all, then write all", value: s.res.batched, text: D.fmtMs(s.res.batched) }],
          sentences: D.describeTiming(s.res),
          note: "Both timings include the one layout that is still waiting at the end. The result depends on your browser, your computer and the size of the page.",
        }) : ""),
      },
      {
        say: "Free play: press again a few times. The numbers change a little each time, and that is normal.",
        enter: (s) => { s.res = null; },
        action: { label: "Time both loops", icon: "play", again: true, run: (s, ctx) => s.measure(ctx) },
        after: (s) => (s.res ? D.describeTiming(s.res).join(" ") : ""),
      },
    ],
    takeaway: "Mixing reads and writes can cost many forced layouts. Reads first, then writes, lets the browser measure once.",
    check: {
      q: "On a small page, the two timings are almost the same. Why can that happen?",
      options: ["The browser skips layout on small pages", "Little has to be measured, so each forced layout is cheap", "The two loops do different work"],
      answer: 1,
      why: ["Layout still runs. It is just quick.", "Yes. The cost of a forced layout grows with how much the browser must measure, and with how often it happens.", "They do the same work in a different order."],
    },
  });

  /* ---------- 05. top vs transform, with the main thread blocked ---------- */
  V.animLab = () => guided({
    title: "top or transform: who keeps moving?",
    build(view) {
      const sq = () => h("div.rp-sq");
      const a = sq(), b = sq();
      const laneA = h("div.rp-lane", a), laneB = h("div.rp-lane", b);
      const cap = (t, sub) => h("div.rp-lane-cap", h("b", t), h("span", sub));
      const note = h("p.rp-note", { "aria-live": "polite" });
      const codes = h("div.rp-codes", { hidden: true }, Book.code(D.animCode("top")), Book.code(D.animCode("transform")));
      view.append(h("div.rp-lanes", h("div.rp-lanebox", cap("top", "Style → Layout → Paint → Composite"), laneA), h("div.rp-lanebox", cap("transform", "Style → Composite"), laneB)), note, codes);
      const s = { a, b, note, codes, anims: [], stall: null, ran: false };
      s.start = () => {
        s.stop();
        if (reduced()) { note.textContent = "Your system asks for less motion, so the boxes stay still. The freeze below is still measured."; return; }
        s.anims = [a.animate(D.animKeyframes("top"), D.animOptions()), b.animate(D.animKeyframes("transform"), D.animOptions())];
      };
      s.stop = () => { s.anims.forEach((x) => x.cancel?.()); s.anims = []; };
      s.block = async (ctx) => {
        s.start();
        await ctx.wait(500);
        const stamps = [];
        let go = true;
        const tick = (t) => { if (go) { stamps.push(t); requestAnimationFrame(tick); } };
        requestAnimationFrame(tick);
        await ctx.wait(160);
        D.busy(D.ANIM.busyMs);
        await ctx.wait(600);
        go = false;
        s.stop();
        s.stall = D.maxGap(stamps);
        s.ran = true;
      };
      return s;
    },
    steps: [
      {
        say: "Two boxes make the same trip, with box.animate. One changes top, the other changes transform.",
        enter: (s) => { s.stop(); s.codes.hidden = false; s.note.textContent = ""; },
      },
      {
        say: "Press the button. The two boxes should look the same.",
        enter: (s) => { s.stop(); s.codes.hidden = true; s.note.textContent = ""; },
        action: { label: "Start both", icon: "play", prompt: "Press the button and watch both boxes.", run: async (s, ctx) => { s.start(); await ctx.wait(2600); s.stop(); } },
        after: () => (reduced() ? "Your system asks for less motion, so the boxes stayed still. The difference is underneath: top needs Layout on every frame, and transform usually does not." : "They look alike. The difference is underneath: top needs Layout on every frame, and transform usually does not."),
      },
      {
        say: "JavaScript keeps the main thread busy for 0.8 seconds. It cannot run Layout or your next frame code.",
        enter: (s) => { s.stop(); s.codes.hidden = true; s.note.textContent = ""; s.stall = null; },
        guess: { q: "The main thread is blocked. What will the two boxes do?", options: ["Both stop", "Only the transform box keeps moving", "Only the top box keeps moving"], answer: 1, why: "In Chromium, a CSS or Web Animations animation of transform or opacity can run on the compositor thread, which is separate from the main thread. The top animation needs Layout, which is main-thread work, so it waits. Other browsers can differ, so watch your own screen." },
        action: { label: "Block the main thread", icon: "play", prompt: "Press the button and watch both boxes. The page will freeze for 0.8 seconds.", run: (s, ctx) => s.block(ctx) },
        after: (s) => (s.stall == null ? "Your tab was in the background, so no frames were measured." : `The main thread could not run a new frame callback for about ${Math.round(s.stall)} ms. That was measured. Did the transform box keep moving? ${reduced() ? "Your system asks for less motion, so the boxes did not move. " : ""}In Chromium, a CSS or Web Animations animation of transform or opacity can. Other browsers may differ.`),
      },
      {
        say: "Free play: block the main thread again, and watch the two boxes.",
        enter: (s) => { s.stop(); s.codes.hidden = true; s.note.textContent = ""; },
        action: { label: "Block the main thread", icon: "play", again: true, run: (s, ctx) => s.block(ctx) },
        after: (s) => (s.stall == null ? "" : `Frozen for about ${Math.round(s.stall)} ms this time.`),
      },
    ],
    takeaway: "An animation of top needs Layout on the main thread, so a busy main thread makes it stutter. In Chromium, a CSS or Web Animations animation of transform or opacity (not one driven by a JavaScript loop) can keep moving on the compositor thread.",
    check: {
      q: "Why did the top box freeze but the transform box (in Chromium) keep moving? (If you saw no motion, reduced motion is on: answer from what you read.)",
      options: ["The compositor thread can move a layer while the main thread is busy", "transform is written in a faster language", "The browser pauses every top animation"],
      answer: 0,
      why: ["Yes. Moving a finished layer is compositor work, and it does not wait for the main thread.", "Both are CSS properties. The difference is which stages and which thread do the work.", "The browser did not pause it. The main thread was busy, and the top animation needs the main thread."],
    },
  });

  /* ---------- 06. What forces layout? ---------- */
  const quizLines = (f) => [f.id === "cached" ? "// earlier: const savedTop = box.offsetTop;" : null, 'box.style.width = "50%";  // a write: the layout is now old', f.code].filter(Boolean).join("\n");
  V.forceQuiz = () => guided({
    title: "Does this line force layout?",
    build(view) {
      const code = h("div.rp-codebox");
      const note = h("p.rp-note", { "aria-live": "polite" });
      const out = h("div.rp-out", { "aria-live": "polite" });
      const lab = h("div.rp-lab.small", Array.from({ length: 300 }, (_, i) => h("div.rp-cell", h("span", `Row ${i + 1}`), h("span.rp-cell-sub", "Table for two · 19:30"))));
      const chips = D.FORCE.map((f) => {
        const b = h("button.chip", { type: "button", "aria-pressed": "false" }, f.member);
        b.addEventListener("click", () => s.load(f.id, true));
        return b;
      });
      const picker = h("div.rp-chips", { hidden: true }, h("span.label", "Line"), chips);
      const labbox = h("div.rp-labbox", { hidden: true }, h("span.label", "300 real rows (used for the timing)"), lab);
      view.append(code, note, picker, out, labbox);
      const s = { picker, out, res: null, lab, labbox, ctxNow: null };
      s.load = (id, explain = false) => {
        const f = D.forceById(id);
        code.replaceChildren(Book.code(quizLines(f)));
        note.textContent = explain ? `${f.forces ? "Layout runs now." : "Layout can wait."} ${f.why}` : "";
        chips.forEach((b, i) => b.setAttribute("aria-pressed", String(D.FORCE[i].id === id)));
      };
      s.showLine = () => { code.replaceChildren(Book.code('box.style.width = "50%";  // a write: the layout is now old\n// next, a line of code runs…')); note.textContent = ""; };
      s.probe = async (ctx) => {
        await ctx.wait(60);
        s.res = D.probeForces({ el: lab, write: (k) => { lab.style.width = k % 2 ? "92%" : "100%"; }, flush: () => lab.offsetHeight });
        lab.style.width = "";
      };
      return s;
    },
    steps: [
      {
        say: "The width just changed, so the old layout is out of date. Does the next line force layout?",
        enter: (s) => { s.showLine(); s.picker.hidden = true; s.labbox.hidden = true; s.out.replaceChildren(); },
      },
      ...D.QUIZ.map((id) => {
        const f = D.forceById(id);
        return {
          say: "Here is the next line. Does it make the browser run layout now?",
          enter: (s) => { s.load(id); s.picker.hidden = true; s.labbox.hidden = true; s.out.replaceChildren(); },
          guess: { q: "Does the browser have to run layout now?", options: ["Yes: layout runs now", "No: it can wait"], answer: f.forces ? 0 : 1, why: f.why },
        };
      }),
      {
        say: "Free play: read any answer, or time the lines here. Timings are noisy: a hint, not proof.",
        enter: (s) => { s.load("offsetTop"); s.picker.hidden = false; s.labbox.hidden = false; s.out.replaceChildren(); },
        show: (s, ctx) => { s.ctxNow = ctx; },
        action: { label: "Time them here", icon: "play", again: true, run: (s, ctx) => s.probe(ctx) },
        after: (s) => (s.res ? Book.resultCard({
          title: "Average time of each line, right after a write",
          rows: s.res.map((r) => ({ label: D.forceById(r.id).code.replace(/^const \w+ = /, "").replace(/;$/, ""), value: r.ms, text: D.fmtMs(r.ms) })),
          sentences: ["A longer bar means the browser did more work before the line finished.", "Browser clocks are coarse, so tiny bars are noise. Compare them with the answers above, not with each other."],
          note: `Each line was timed ${s.res[0].rounds} times, in a list of 300 rows. The width changed before every single try, and the time is the average. It stopped early if it ran out of time. A time under 0.1 ms is shown as "under 0.1 ms", because that is below what the clock can show.`,
        }) : ""),
      },
    ],
    takeaway: "Reading a size or position right after a write forces layout. Writes, saved numbers, and reads of properties that do not need layout do not.",
    check: {
      q: "Which of these lines is the safest right after a write?",
      options: ["const y = box.offsetTop;", "const y = savedTop;", "const r = box.getBoundingClientRect();"],
      answer: 1,
      why: ["offsetTop is a position, so the browser needs fresh layout.", "Yes. A saved number asks the browser nothing.", "The rectangle is a size and position, so the browser needs fresh layout."],
    },
  });

  /* ---------- 08. From your work: a CSS variable, or opacity? (a proxy measured live) ---------- */
  V.varLab = () => guided({
    title: "Variable or opacity: which write is cheaper?",
    build(view) {
      const kids = Array.from({ length: 3 }, (_, i) => h("div.rp-vl-kid", Array.from({ length: 5 }, (_, j) => (i === 2 && j === 4 ? h("i.rp-vl-wings") : h("i")))));
      const parent = h("div.rp-vl", kids);
      const out = h("div.rp-out", { "aria-live": "polite" });
      const code = h("div.rp-codebox");
      view.append(code, h("div.rp-labbox", h("span.label", "15 small boxes inside one parent"), parent), out);
      const s = { parent, wings: parent.querySelector(".rp-vl-wings"), res: null, code };
      s.show = (text) => code.replaceChildren(Book.code(text));
      s.measure = async (ctx) => {
        await ctx.wait(60);
        s.res = D.measureVarWrites({ parent: s.parent, wings: s.wings });
      };
      return s;
    },
    steps: [
      {
        say: "In the portfolio hero, a CSS variable on a parent was written every frame. One element read it.",
        enter: (s) => s.show('stage.style.setProperty("--hover", v); // a variable on the parent\n/* .wings { opacity: calc(1 - var(--hover)); } */'),
      },
      {
        say: "Two ways to change the same opacity. Make a guess, then time both here.",
        enter: (s) => s.show('stage.style.setProperty("--hover", v); // way 1: a variable on the parent\nwings.style.opacity = v;               // way 2: one element, no variable'),
        guess: { q: "Which write do you think is cheaper in your browser?", options: ["Writing the variable on the parent", "Writing opacity on the one element", "About the same"], answer: 1, why: "In the portfolio's PERF-REPORT, way 2 fixed the frame drops in Chrome: the custom property was inherited by the whole subtree, so each write made Chrome check every descendant. Your browser may differ, so read your own numbers below." },
        action: { label: "Time both writes here", icon: "play", prompt: "Press the button. It takes less than a second.", run: (s, ctx) => s.measure(ctx) },
        after: (s) => (s.res ? Book.resultCard({
          title: "Measured just now, in this browser",
          rows: [{ label: "Variable on the parent", value: s.res.variable, text: D.fmtUs(s.res.variable) }, { label: "Opacity on one element", value: s.res.direct, text: D.fmtUs(s.res.direct) }],
          sentences: D.compareSentences("Writing the variable", s.res.variable, "Writing opacity directly", s.res.direct, "Your browser may handle this case well. The report was about Chrome on the portfolio page, in April 2026, with other things on the page.", D.fmtUs),
          note: "Each write is followed by a read that makes the browser update styles at once. This is a stand-in for one frame's style work, not a trace of the real page.",
        }) : ""),
      },
      {
        say: "Free play: time them again.",
        enter: (s) => s.show('stage.style.setProperty("--hover", v); // variable\nwings.style.opacity = v;               // direct'),
        action: { label: "Time both writes", icon: "play", again: true, run: (s, ctx) => s.measure(ctx) },
        after: (s) => (s.res ? D.compareSentences("Writing the variable", s.res.variable, "Writing opacity directly", s.res.direct, "Press again a few times: the numbers move a little each time.", D.fmtUs).join(" ") : ""),
      },
    ],
    takeaway: "A CSS variable is inherited, so a write on a parent can make the browser check every child. Writing to the one element that needs the change keeps the work small.",
    check: {
      q: "Why can a custom property written on a parent cost more than opacity written on the child?",
      options: ["Custom properties are inherited, so the browser may need to check the whole subtree", "opacity is stored in the GPU", "Variables are slower to type"],
      answer: 0,
      why: ["Yes. That is the reason given in the portfolio's report. Some browsers have shortcuts, so measure in yours.", "The GPU is not the point. The cost here is style checking on the main thread.", "Typing is not the cost. The browser's style work is."],
    },
  });

  /* ---------- a small table for the scroll-listener model ---------- */
  V.scrollTable = () => h("div.rp-model", D.SCROLL_MODEL.map((m) => h("div.rp-model-row",
    h("span.rp-model-name", m.title),
    h("span.rp-model-ops", m.ops.split("").map((c) => h("i" + (c === "R" ? ".read" : ".write"), c === "R" ? "read" : "write"))),
    h("b.rp-model-n", `${m.forced} forced layout${m.forced === 1 ? "" : "s"}`))));

  Object.assign(V, { stripView });
})();
