/* Values, equality and modules: the films and guided visuals.
   Every box, arrow, caption and result comes from js-values-modules.data.js, which runs the real code
   (dev/js-values-modules.test.js checks it, with real node for the module files). Nothing here is typed by hand. */
(function () {
  const { h, guided, svg: S } = Book;
  const V = (Book.parts["js-values-modules"] = Book.parts["js-values-modules"] || {});
  const D = V.data;
  const phone = () => matchMedia("(max-width: 560px)").matches;
  const opac = (p, n) => n.setAttribute("opacity", Math.max(0, Math.min(1, p.o)).toFixed(3));
  const readout = (label, value = "—") => { const b = h("b.tab", value); return { el: h("div.readout", h("span.label", label), b), set: (t) => { b.textContent = t; } }; };
  const words = (t) => t.split(/\s+/).length;
  const tokenize = (parent, text) => { for (const t of Book.tokens(text)) parent.append(S("tspan", { class: t.type === "plain" || t.type === "space" ? "syn-plain" : `syn-${t.type}` }, t.text)); };
  const codeView = (lines) => {
    const box = h("pre.code-block.vm-code", { "aria-label": "The program" });
    return { el: box, set(ls, done = [], lit = -1) { box.replaceChildren(...ls.map((t, i) => h("span.vm-ln" + (done.includes(i) ? ".done" : "") + (i === lit ? ".lit" : ""), { html: Book.highlight(t) || " " }))); } };
  };

  /* ================= the boxes-and-arrows scene, built from a trace ================= */
  const sameD = (x, y) => x && y && x.k === y.k && x.id === y.id && x.text === y.text;
  const readPath = (fr, path) => {
    const [n, ...ks] = path.split(".");
    let d = fr.vars[n];
    for (const k of ks) { if (!d || d.k !== "ref") return "—"; d = (fr.objects[d.id].props.find(([x]) => x === k) || [])[1]; }
    return d && d.k !== "unset" ? (d.k === "prim" ? d.text : "an object") : "—";
  };
  function buildScene(tr, narrow) {
    const C = narrow ? { sw: 62, c0x: 80, c0w: 128, c1x: 222, c1w: 78, W: 300 } : { sw: 92, c0x: 130, c0w: 176, c1x: 338, c1w: 112, W: 450 };
    const info = {};
    tr.frames.forEach((f, k) => Object.values(f.objects).forEach((o) => {
      const i = info[o.id] || (info[o.id] = { id: o.id, kind: o.kind, from: k, keys: [] });
      if (o.props.length > i.keys.length) i.keys = o.props.map(([key]) => key);
    }));
    const direct = new Set();
    tr.frames.forEach((f) => Object.values(f.vars).forEach((d) => d.k === "ref" && direct.add(d.id)));
    const ycol = [26, 26];
    const card = {};
    Object.values(info).sort((a, b) => a.id - b.id).forEach((i) => {
      const col = direct.has(i.id) ? 0 : 1;
      const ch = 34 + Math.max(1, i.keys.length) * 20;
      card[i.id] = { ...i, x: col ? C.c1x : C.c0x, y: ycol[col], w: col ? C.c1w : C.c0w, h: ch };
      ycol[col] += ch + 14;
    });
    const slot = tr.names.map((n, i) => ({ n, x: 0, y: 26 + i * 54, w: C.sw, h: 38, from: tr.frames.findIndex((f) => f.vars[n].k !== "unset") }));
    const H = Math.max(ycol[0], ycol[1], 26 + tr.names.length * 54) + 4;
    const arrow = (x1, y1, x2, y2) => {
      const dx = Math.max(24, (x2 - x1) / 2);
      const g = S("g");
      g.append(S("path", { d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2 - 1} ${y2}`, class: "vm-arrow" }), S("path", { d: `M ${x2} ${y2} l -8 -4.5 l 0 9 z`, class: "vm-head" }));
      return g;
    };
    const keyed = (f) => {
      const out = [];
      tr.names.forEach((n, i) => {
        const d = f.vars[n];
        const s = slot[i];
        if (d.k === "prim") out.push([`v:${n}:${d.text}`, () => S("text", { x: s.x + s.w - 10, y: s.y + 25, "text-anchor": "end", class: "vm-val" }, d.text)]);
        else if (d.k === "ref") out.push([`r:${n}:${d.id}`, () => { const g = S("g"); g.append(S("circle", { cx: s.x + s.w - 14, cy: s.y + 19, r: 5, class: "vm-dot" }), arrow(s.x + s.w - 14, s.y + 19, card[d.id].x, card[d.id].y + 18)); return g; }]);
      });
      Object.values(f.objects).forEach((o) => o.props.forEach(([key, d], j) => {
        const c = card[o.id];
        const y = c.y + 40 + j * 20;
        if (d.k === "prim") out.push([`p:${o.id}:${key}:${d.text}`, () => S("text", { x: c.x + c.w - 10, y, "text-anchor": "end", class: "vm-val" }, d.text)]);
        else out.push([`pa:${o.id}:${key}:${d.id}`, () => { const g = S("g"); g.append(S("circle", { cx: c.x + c.w - 14, cy: y - 4, r: 4.5, class: "vm-dot" }), arrow(c.x + c.w - 14, y - 4, card[d.id].x, card[d.id].y + 18)); return g; }]);
      }));
      return out;
    };
    /* An item lives from the frame where it first appears until the frame where it is gone. */
    const items = [];
    const active = new Map();
    tr.frames.forEach((f, k) => {
      const now = new Map(keyed(f));
      for (const [key, make] of now) if (!active.has(key)) { const it = { key, make, start: k, end: tr.frames.length }; items.push(it); active.set(key, it); }
      for (const [key, it] of active) if (!now.has(key)) { it.end = k; active.delete(key); }
    });
    return {
      W: C.W, H, slot, card, items,
      draw(g) {
        g.append(S("text", { x: 0, y: 12, class: "fl-small" }, "Boxes"));
        if (Object.keys(card).length) g.append(S("text", { x: C.c0x, y: 12, class: "fl-small" }, "Objects"));
        const slots = slot.map((s) => { const n = S("g"); n.append(S("rect", { x: s.x, y: s.y, width: s.w, height: s.h, rx: 10, class: "vm-slot" }), S("text", { x: s.x + 10, y: s.y + 25, class: "vm-name" }, s.n)); g.append(n); return n; });
        const cards = {};
        Object.entries(card).forEach(([id, c]) => {
          const n = S("g");
          n.append(S("rect", { x: c.x, y: c.y, width: c.w, height: c.h, rx: 10, class: "vm-card" }), S("text", { x: c.x + 10, y: c.y + 17, class: "fl-small" }, c.kind));
          c.keys.forEach((key, j) => n.append(S("text", { x: c.x + 10, y: c.y + 40 + j * 20, class: "vm-key" }, key + ":")));
          g.append(n);
          cards[id] = n;
        });
        return { slots, cards };
      },
    };
  }
  /* One frame of a scene, drawn still (used by the guided pages). */
  function renderStatic(sc, k) {
    const svg = S("svg", { viewBox: `0 0 ${sc.W} ${sc.H}`, class: "vm-scene", role: "img" });
    const g = S("g");
    svg.append(g);
    const { slots, cards } = sc.draw(g);
    slots.forEach((n, i) => { n.style.opacity = sc.slot[i].from >= 0 && k >= sc.slot[i].from ? "1" : "0"; });
    Object.entries(cards).forEach(([id, n]) => { n.style.opacity = k >= sc.card[id].from ? "1" : "0"; });
    sc.items.filter((it) => it.start <= k && k < it.end).forEach((it) => { const w = S("g", { class: "vm-it" + (it.start === k && k > 0 ? " vm-hot" : "") }); w.append(it.make()); g.append(w); });
    return svg;
  }

  /* ================= 01. film: names, boxes and arrows ================= */
  V.valuesFilm = () => {
    const ids = ["prim", "obj"];
    const trs = ids.map(D.runProgram);
    return Book.film({
      title: "Boxes and arrows: how JavaScript keeps values", wide: [620, 205], tall: [330, 320],
      build(svg, F, layout) {
        const tall = layout === "tall";
        const drawItem = (p, n) => { opac(p, n); n.classList.toggle("vm-hot", p.hot > 0.5); };
        let T = 0.3;
        trs.forEach((tr, pi) => {
          const prog = D.PROGRAMS[ids[pi]];
          const sc = buildScene(tr, true); // the compact scene (300 wide) fits both layouts
          const lh = 21;
          const codeW = tall ? 306 : 250;
          const codeH = tr.lines.length * lh + 20;
          const dx = tall ? 15 : 300;
          const dy = tall ? 54 + codeH + 22 : 40;
          const pg = S("g");
          svg.append(pg);
          pg.append(S("text", { x: 12, y: 20, class: "fl-col-title" }, `Program ${pi + 1}: ${prog.title}`), S("rect", { x: 12, y: 36, width: codeW, height: codeH, rx: 12, class: "fl-code-bg" }));
          const bar = S("rect", { x: 16, width: codeW - 8, height: lh, rx: 5, class: "fl-line-bar" });
          pg.append(bar);
          tr.lines.forEach((text, i) => { const tx = S("text", { x: 24, y: 46 + i * lh + lh * 0.72, class: "fl-code", "xml:space": "preserve" }); tokenize(tx, text); pg.append(tx); });
          const sg = S("g", { transform: `translate(${dx} ${dy})` });
          pg.append(sg);
          const { slots, cards } = sc.draw(sg);
          const progA = F.actor(pg, { o: 0 }, opac);
          const barA = F.actor(bar, { line: 0, o: 0 }, (p, n) => { n.setAttribute("y", 44 + p.line * lh); n.setAttribute("opacity", p.o); });
          const dur = (k) => Math.min(6, Math.max(3, 1 + words(D.explainFrame(tr, k)) * 0.2));
          const Ts = [];
          tr.frames.forEach((f, k) => { Ts[k] = k === 0 ? T + 0.8 : Ts[k - 1] + (k === 1 ? 3.4 : dur(k - 1)); });
          const end = Ts[tr.frames.length - 1] + dur(tr.frames.length - 1);
          F.chapter(T, `Program ${pi + 1}: ${prog.title}`);
          F.to(progA, { o: 1 }, T, 0.5);
          F.say(T + 0.3, `Program ${pi + 1}. Read the code. Each line will run for real, one at a time. Watch the boxes and the arrows.`);
          slots.forEach((n, i) => { const a = F.actor(n, { o: 0 }, opac); if (sc.slot[i].from >= 0) F.to(a, { o: 1 }, Ts[sc.slot[i].from], 0.4); });
          Object.entries(cards).forEach(([id, n]) => { const a = F.actor(n, { o: 0 }, opac); F.to(a, { o: 1 }, Ts[sc.card[id].from], 0.4); });
          sc.items.forEach((it) => {
            const w = S("g");
            w.append(it.make());
            sg.append(w);
            const a = F.actor(w, { o: 0, hot: 0 }, drawItem);
            F.to(a, { o: 1, hot: 1 }, Ts[it.start], 0.35);
            if (it.start + 1 < tr.frames.length) F.to(a, { hot: 0 }, Ts[it.start + 1], 0.3);
            if (it.end < tr.frames.length) F.to(a, { o: 0 }, Ts[it.end], 0.3);
          });
          tr.frames.forEach((f, k) => {
            if (k === 0) return;
            F.to(barA, { line: f.line, o: 1 }, Ts[k], 0.3);
            F.say(Ts[k], `Line ${f.line + 1}. ` + D.explainFrame(tr, k));
          });
          F.to(progA, { o: 0 }, end, 0.5);
          T = end + 0.8;
        });
        F.chapter(T, "The rule");
        const lines = ["A number or text sits inside its box. Copy it: you get a new box.", "An object lives outside. The box holds an arrow. Copy it: you get another arrow to the same object."];
        const rule = S("g");
        let ry = tall ? 70 : 64;
        lines.forEach((t) => { (t.match(tall ? /.{1,28}(\s|$)/g : /.{1,50}(\s|$)/g)).forEach((ln) => { rule.append(S("text", { x: tall ? 165 : 310, y: ry, "text-anchor": "middle", class: "fl-strong-s" }, ln.trim())); ry += 24; }); ry += tall ? 26 : 20; });
        svg.append(rule);
        const ruleA = F.actor(rule, { o: 0 }, opac);
        F.to(ruleA, { o: 1 }, T, 0.6);
        F.say(T, "That is the whole idea. Two names can hold arrows to one object, so a change through one name shows through the other.");
        F.end(T + 8);
      },
    });
  };

  /* ================= 02. guided: shallow and deep copies ================= */
  V.copy = () => {
    const shallow = D.runProgram("shallow");
    const deep = D.runProgram("deep");
    const narrow = phone();
    const cache = new Map();
    const sceneOf = (tr) => { if (!cache.has(tr)) cache.set(tr, buildScene(tr, narrow)); return cache.get(tr); };
    return guided({
      title: "Shallow copy and deep copy",
      build(view) {
        const code = codeView();
        const host = h("div.vm-host");
        const probe = h("div.vm-probe", { hidden: true });
        const chips = (list, on, set) => list.map(([id, label]) => { const b = h("button.chip", { type: "button", "aria-pressed": String(id === on) }, label); b.addEventListener("click", () => set(id, b)); return b; });
        const free = { copy: "spread", target: "tags" };
        const copyChips = chips([["spread", "Spread {...a}"], ["deep", "structuredClone"], ["json", "JSON trick"]], "spread", (id) => { free.copy = id; mark(); });
        const targetChips = chips([["name", "b.name"], ["tags", "b.tags.n"]], "tags", (id) => { free.target = id; mark(); });
        const mark = () => { [...copyChips, ...targetChips].forEach((b, i) => { const val = i < 3 ? ["spread", "deep", "json"][i] : ["name", "tags"][i - 3]; b.setAttribute("aria-pressed", String(val === (i < 3 ? free.copy : free.target))); }); };
        const pick = h("div.vm-pick", { hidden: true }, h("span.label", "Copy with"), copyChips, h("span.label", "then change"), targetChips);
        const read = readout("a.tags.n is");
        const readB = readout("b.tags.n is");
        const readA = readout("a.name is");
        view.append(h("div.vm-pair", code.el, host), pick, h("div.readouts", readA.el, read.el, readB.el), probe);
        const s = {
          show(tr, k) {
            const sc = sceneOf(tr);
            code.set(tr.lines, tr.frames.slice(1, k).map((f) => f.line), k > 0 ? tr.frames[k].line : -1);
            host.replaceChildren(renderStatic(sc, k));
            const fr = tr.frames[k];
            readA.set(readPath(fr, "a.name"));
            read.set(readPath(fr, "a.tags.n"));
            readB.set(readPath(fr, "b.tags.n"));
          },
          host, pick, probe, free, mark,
          clearProbe() { probe.hidden = true; probe.replaceChildren(); },
        };
        return s;
      },
      steps: [
        { say: "a is an object. It has a name, and inside it another object: tags. Box a holds an arrow.", enter: (s) => { s.pick.hidden = true; s.clearProbe(); s.show(shallow, 1); }, show: (s, ctx) => ctx.callout(s.host.querySelector(".vm-card"), "one object, with another object inside", "bottom") },
        {
          say: "Now copy a with spread: const b = { ...a };",
          enter: (s) => { s.show(shallow, 1); },
          action: { label: "Run: const b = { ...a }", icon: "play", run: async (s) => { s.show(shallow, 2); } },
          after: () => D.explainFrame(shallow, 2),
        },
        {
          say: "Now change b.name. What happens to a?",
          enter: (s) => s.show(shallow, 2),
          guess: { q: "b.name = \"Sam\". What is a.name now?", options: ["\"Sam\" (it changed too)", "\"Mina\" (it stays)"], answer: 1, why: "name is text. It was copied into the new object, so b has its own." },
          action: { label: "Run: b.name = \"Sam\"", icon: "play", run: async (s) => s.show(shallow, 3) },
          after: () => D.explainFrame(shallow, 3),
        },
        {
          say: "Now change the inner object: b.tags.n.",
          enter: (s) => s.show(shallow, 3),
          guess: { q: "b.tags.n = 2. What is a.tags.n now?", options: ["1 (it stays)", "2 (it changed too)"], answer: 1, why: "Spread copies only the first level. The tags arrow was copied, not the inner object. Both arrows still reach one object." },
          action: { label: "Run: b.tags.n = 2", icon: "play", run: async (s) => s.show(shallow, 4) },
          after: () => D.explainFrame(shallow, 4) + " This is a shallow copy.",
        },
        {
          say: "For nested data, use a deep copy: structuredClone copies the inner objects too.",
          enter: (s) => s.show(deep, 1),
          action: { label: "Run: const b = structuredClone(a)", icon: "play", run: async (s) => s.show(deep, 2) },
          after: () => D.explainFrame(deep, 2),
        },
        {
          say: "Same change as before.",
          enter: (s) => s.show(deep, 2),
          guess: { q: "b.tags.n = 2. What is a.tags.n now?", options: ["1 (it stays)", "2 (it changed too)"], answer: 0, why: "structuredClone made a new inner object for b. The arrows now reach two different objects." },
          action: { label: "Run: change b.name and b.tags.n", icon: "play", run: async (s) => s.show(deep, 4) },
          after: () => D.explainFrame(deep, 4),
        },
        {
          say: "structuredClone cannot copy everything. Try it on each of these. These run for real, in your browser now.",
          enter: (s) => { s.show(deep, 4); s.clearProbe(); },
          action: {
            label: "Clone each one", icon: "play",
            run: async (s, ctx) => {
              s.probe.hidden = false;
              s.probe.replaceChildren();
              for (const r of D.cloneProbe(true)) { s.probe.append(h("div.vm-prow", h("span", r.label), h("b.vm-out-" + r.outcome.split(" ")[0], r.outcome), h("small", r.detail))); await ctx.wait(220); }
              s.res = D.cloneProbe(true);
            },
          },
          after: (s) => `Errors (DataCloneError): ${s.res.filter((r) => r.outcome === "error").map((r) => r.label).join(", ")}. A class instance copies its data but loses its class.`,
        },
        {
          say: "Your turn. Pick a way to copy, pick what to change, and press the button. Real code runs each time.",
          enter: (s) => { s.clearProbe(); s.pick.hidden = false; s.show(shallow, 1); s.mark(); },
          action: {
            label: "Run it", icon: "play", again: true,
            run: async (s) => {
              const copy = { spread: "{ ...a }", deep: "structuredClone(a)", json: "JSON.parse(JSON.stringify(a))" }[s.free.copy];
              const change = s.free.target === "name" ? "b.name = \"Sam\";" : "b.tags.n = 2;";
              const tr = D.trace(["const a = { name: \"Mina\", tags: { n: 1 } };", `const b = ${copy};`, change], ["a", "b"]);
              s.show(tr, 3);
            },
          },
          after: () => "Look at a.name and a.tags.n. Spread shares tags. structuredClone and the JSON trick copy it.",
        },
      ],
      takeaway: "Spread copies one level. Inner objects stay shared. structuredClone copies all levels, but not functions or DOM nodes.",
      check: {
        q: "const b = { ...a } and then b.tags.n = 5. Does a.tags.n change?",
        options: ["Yes, tags is shared", "No, b has its own tags"],
        answer: 0,
        why: ["Right. Spread copies the arrow to tags, not the tags object.", "No. Spread is shallow, so b.tags and a.tags are the same object."],
      },
    });
  };

  /* ================= 03. equality explorer ================= */
  const opName = ["==", "===", "Object.is"];
  V.equality = () => guided({
    title: "Three ways to ask: are these equal?",
    build(view) {
      let pair = ["0", "\"0\""];
      let op = 0;
      const tiles = opName.map((name, i) => {
        const res = h("b.vm-res", "?");
        const ex = h("code.vm-ex", " ");
        return { el: h("div.vm-tile", h("span.label", name), ex, res), res, ex, i };
      });
      const hintTexts = ["Converts the types first, then compares.", "No converting. Same type and same value.", ["Like ===, but NaN equals NaN, and 0 and ", Book.word("-0", "negative zero. 0 === -0 is true, but Object.is(0, -0) is false."), " are different."]];
      const hints = h("div.vm-hints", opName.map((n, i) => h("p", h("b", n + ": "), hintTexts[i])));
      const pairBox = h("div.vm-pair-vals");
      const tileRow = h("div.vm-tiles", tiles.map((t) => t.el));
      const matrixHost = h("div.vm-matrix-host", { hidden: true });
      const opChips = opName.map((n, i) => { const b = h("button.chip", { type: "button", "aria-pressed": String(i === 0) }, n); b.addEventListener("click", () => { op = i; opChips.forEach((c, j) => c.setAttribute("aria-pressed", String(j === i))); paintMatrix(); }); return b; });
      const note = h("p.vm-note");
      view.append(pairBox, tileRow, hints, note, h("div.vm-ops", { hidden: true }, h("span.label", "Color the grid by"), opChips), matrixHost);
      const M = D.matrix();
      const ops = view.querySelector(".vm-ops");
      const paintMatrix = () => {
        const tbl = h("table.vm-matrix", { role: "grid", "aria-label": "Every pair of values, answered by the chosen operator" });
        tbl.append(h("tr", h("th", ""), D.VALUES.map((v) => h("th", h("code", v)))));
        D.VALUES.forEach((a, i) => tbl.append(h("tr", h("th", h("code", a)), D.VALUES.map((b, j) => {
          const yes = M[i][j][op];
          const sel = pair[0] === a && pair[1] === b;
          const btn = h("button.vm-cell" + (yes ? ".yes" : "") + (sel ? ".sel" : ""), { type: "button", "aria-label": `${a} ${opName[op]} ${b}: ${yes}`, "aria-pressed": String(sel) }, yes ? "✓" : "·");
          btn.addEventListener("click", () => { pair = [a, b]; s.reveal(); paintMatrix(); });
          return h("td", btn);
        }))));
        matrixHost.replaceChildren(tbl, h("p.vm-note", h("code", "\"\""), " = empty text, ", h("code", "[]"), " = empty array."));
      };
      const s = {
        setPair(a, b) { pair = [a, b]; },
        blank() {
          pairBox.replaceChildren(h("code", pair[0]), h("span", "and"), h("code", pair[1]));
          tiles.forEach((t) => { t.res.textContent = "?"; t.res.className = "vm-res"; t.ex.textContent = " "; });
          note.textContent = "";
        },
        reveal(only) {
          const c = D.compare(pair[0], pair[1]);
          pairBox.replaceChildren(h("code", pair[0]), h("span", "and"), h("code", pair[1]));
          tiles.forEach((t, i) => {
            if (only && !only.includes(i)) return;
            const v = [c.loose, c.strict, c.same][i];
            t.res.textContent = String(v);
            t.res.className = "vm-res " + (v ? "yes" : "no");
            t.ex.textContent = [c.ex.loose, c.ex.strict, c.ex.same][i];
          });
          note.textContent = pair[0] === "[]" && pair[1] === "[]" ? "These are two different arrays that look the same. Objects are equal only if they are the very same object." : "";
        },
        showMatrix(on) { matrixHost.hidden = !on; ops.hidden = !on; if (on) paintMatrix(); },
        setHints(on) { hints.hidden = !on; },
        get pair() { return pair; },
      };
      return s;
    },
    steps: [
      { say: "Here are two values: 0 and the text \"0\". You can ask three questions about them. Read what each one does.", enter: (s) => { s.setPair("0", "\"0\""); s.showMatrix(false); s.setHints(true); s.blank(); } },
      {
        say: "Ask all three questions about 0 and \"0\".",
        enter: (s) => { s.setPair("0", "\"0\""); s.showMatrix(false); s.setHints(true); s.blank(); },
        guess: { q: "Is 0 == \"0\" true or false?", options: ["true", "false"], answer: D.compare("0", "\"0\"").loose ? 0 : 1, why: "== turns the text \"0\" into the number 0 first. So it says true. === and Object.is do no converting, so they say false." },
        action: { label: "Ask the three questions", icon: "play", run: async (s) => s.reveal() },
        after: "One value is a number and the other is text. == converts. The other two do not.",
      },
      {
        say: "NaN means “not a number”. Ask the same three questions about NaN and NaN.",
        enter: (s) => { s.setPair("NaN", "NaN"); s.showMatrix(false); s.setHints(true); s.blank(); },
        guess: { q: "Is NaN === NaN true or false?", options: ["true", "false"], answer: D.compare("NaN", "NaN").strict ? 0 : 1, why: "By the rules of numbers, NaN is not equal to anything, even itself. Only Object.is says true." },
        action: { label: "Ask the three questions", icon: "play", run: async (s) => s.reveal() },
        after: "Object.is is the only one that finds NaN equal to NaN.",
      },
      {
        say: "Your turn. Click any cell to ask about that pair. Press == and then ===. Look for cells that change from ✓ to ·: those are the surprises. The next page explains four of them.",
        enter: (s) => { s.setPair("[]", "false"); s.setHints(false); s.showMatrix(true); s.reveal(); },
      },
    ],
    takeaway: "=== compares without converting. == converts first, with rules that surprise. Object.is is === with two small fixes: NaN and -0.",
    check: {
      q: "Which question says that NaN and NaN are the same?",
      options: ["===", "==", "Object.is"],
      answer: 2,
      why: ["=== says false for NaN and NaN.", "== also says false.", "Right. Object.is(NaN, NaN) is true."],
    },
  });

  /* ================= 04. the surprises ================= */
  V.surprises = () => {
    const line = (expr, expect, say) => {
      const got = D.show(D.evalExpr(expr));
      return h("div.vm-line", h("code", expr), h("b.vm-res." + (got === "true" ? "yes" : got === "false" ? "no" : "val"), got), h("p", say));
    };
    const stepFor = (sp) => {
      const first = D.evalExpr(sp.expr);
      return {
        say: `Guess first: what does ${sp.expr} give?`,
        enter: (s) => { s.box.replaceChildren(); s.extra.hidden = true; },
        guess: { q: `What does ${sp.expr} give?`, options: ["true", "false"], answer: first === true ? 0 : 1, why: sp.steps[0][2] },
        action: {
          label: "Show me why", icon: "play",
          run: async (s, ctx) => { s.box.replaceChildren(); for (const [e, x, say] of sp.steps) { s.box.append(line(e, x, say)); await ctx.wait(750); } },
        },
        after: `${sp.title}. ` + (sp.id === "empty-false" ? "Every step is a rule in the language. Nothing is random. That is why most teams use === and avoid ==." : "Lines with a result badge were run for real, just now."),
      };
    };
    return guided({
      title: "Four surprising equals",
      build(view) {
        const box = h("div.vm-lines");
        const extra = h("div.vm-chips", { hidden: true }, D.EXTRA.map(([e, x, say]) => { const b = h("button.chip", { type: "button" }, e); b.addEventListener("click", () => { box.replaceChildren(line(e, x, say)); }); return b; }));
        view.append(box, extra);
        return { box, extra };
      },
      steps: [
        ...D.SURPRISES.map(stepFor),
        { say: "Your turn. Tap any expression to run it. A good habit: if an == surprises you, use === and convert the value yourself, with Number(x) or String(x).", enter: (s) => { s.box.replaceChildren(); s.extra.hidden = false; } },
      ],
      takeaway: "== follows a long list of conversion rules. === never converts. Use === by default.",
      check: {
        q: "When is == a good idea?",
        options: ["Almost never. One common use: x == null checks both null and undefined", "Always, it is shorter", "Only for numbers"],
        answer: 0,
        why: ["Right. Many style guides allow x == null for that reason, and require === everywhere else.", "Short is not safe. The rules surprise people.", "== with two numbers is the same as ===, so there is no gain."],
      },
    });
  };

  /* ================= 05. immutability in React terms ================= */
  V.immutable = () => guided({
    title: "Why push and setState does nothing",
    build(view) {
      let st = D.makeStore(["a", "b"]);
      const chipsOf = (list) => list.map((x) => h("span.chip.vm-item", x));
      const mem = h("div.vm-lane", h("span.label", "The list in memory"), h("div.vm-items"));
      const scr = h("div.vm-lane.screen", h("span.label", "What the screen shows"), h("div.vm-items"));
      const renders = readout("Screen updates (the first draw counts as 1)");
      const verdict = readout("React decided");
      const same = readout("Object.is(old list, new list)");
      const btns = h("div.vm-btns", { hidden: true });
      const code = h("div.vm-codewrap");
      view.append(code, h("div.vm-lanes", mem, scr), h("div.readouts", renders.el, verdict.el, same.el), btns);
      const s = {
        paint(v = "—", sm = "—") {
          mem.querySelector(".vm-items").replaceChildren(...chipsOf(st.value));
          scr.querySelector(".vm-items").replaceChildren(...chipsOf(st.shown));
          renders.set(String(st.renders));
          verdict.set(v);
          same.set(sm);
        },
        reset() { st = D.makeStore(["a", "b"]); s.paint(); },
        code(text) { code.replaceChildren(Book.code(text)); },
        /* push into the same list, or build a new one; the toy store decides, like React does */
        push() { const before = st.value; before.push("c"); const v = st.set(before); s.paint(v, String(Object.is(before, st.value))); return v; },
        spread() { const before = st.value; const next = [...before, "c"]; const v = st.set(next); s.paint(v, String(Object.is(before, next))); return v; },
        nothing() { const before = st.value; const next = [...before]; const v = st.set(next); s.paint(v, String(Object.is(before, next))); return v; },
        btns,
        get store() { return st; },
      };
      return s;
    },
    steps: [
      { say: "A React component keeps a list in state. The screen shows a and b.", enter: (s) => { s.reset(); s.btns.hidden = true; s.code("const [items, setItems] = useState([\"a\", \"b\"]);"); } },
      {
        say: "We add \"c\" with push, then tell React: setItems(items).",
        enter: (s) => { s.reset(); s.btns.hidden = true; s.code("items.push(\"c\");\nsetItems(items);"); },
        guess: { q: "Does the screen show c?", options: ["Yes, the list has c", "No, nothing changes on screen"], answer: 1, why: "The list in memory has c. But React saw the very same list, so Object.is said 'same' and React skipped the update." },
        action: { label: "Run push + setItems", icon: "play", run: async (s) => { s.push(); } },
        after: (s) => `The list in memory has ${s.store.value.length} items, the screen shows ${s.store.shown.length}. The answer to “did it change?” was “skipped”. This page uses a tiny model, not real React. It shows only the Object.is check. Real React may call your component once more before it skips.`,
      },
      {
        say: "React asks Object.is(old, new): is it the very same object?",
        enter: (s) => { s.reset(); s.btns.hidden = true; s.code("items.push(\"c\");\nsetItems(items);          // Object.is(old, new) is true: skipped"); s.push(); },
        action: { label: "Compare with a new list", icon: "play", run: async (s) => { s.reset(); s.code("const next = [...items, \"c\"];   // a NEW list\nsetItems(next);          // Object.is(old, new) is false: update"); s.spread(); } },
        after: "A new list is a new object. Object.is says false, and React knows it must look again. That is why you must not change state in place.",
      },
      {
        say: "Now do it the React way: make a new list.",
        enter: (s) => { s.reset(); s.btns.hidden = true; s.code("setItems([...items, \"c\"]);"); },
        guess: { q: "Does the screen show c now?", options: ["Yes", "No"], answer: 0, why: "[...items, \"c\"] is a new list, so Object.is says it is different." },
        action: { label: "Run setItems([...items, \"c\"])", icon: "play", run: async (s) => { s.spread(); } },
        after: (s) => `Screen updates: ${s.store.renders}. The screen shows ${s.store.shown.length} items.`,
      },
      {
        say: "Your turn. Try each button and watch “React decided”. Notice: copying the list and adding nothing also updates the screen. React compares references, not contents.",
        enter: (s) => {
          s.reset(); s.code("// Press the buttons");
          s.btns.hidden = false;
          s.btns.replaceChildren(...[["Add c with push", "push"], ["Add c with spread", "spread"], ["Copy the list, add nothing", "nothing"], ["Reset", "reset"]].map(([label, fn]) => { const b = h("button.chip", { type: "button" }, label); b.addEventListener("click", () => s[fn]()); return b; }));
        },
      },
    ],
    takeaway: "React compares state by reference. Change a copy and give React the new one. Never change the old one in place.",
    check: {
      q: "Which line makes React update?",
      options: ["items.push(x); setItems(items)", "setItems([...items, x])", "items[0] = x; setItems(items)"],
      answer: 1,
      why: ["Same list, so Object.is says nothing changed.", "Right. A new list is a new reference.", "Still the same list. Mutation does not make a new reference."],
    },
  });

  /* ================= 07. film: tree-shaking ================= */
  V.shakeFilm = () => {
    const R = D.shake(D.FILES, "app.js");
    const files = ["math.js", "format.js"];
    const usedAll = files.flatMap((f) => R.modules[f].used);
    const unusedAll = files.flatMap((f) => R.modules[f].unused);
    const appLines = D.FILES["app.js"].split("\n");
    const bundleLines = R.bundle.split("\n");
    const cjsLines = D.DYNAMIC.files["pick.js"].split("\n");
    return Book.film({
      title: "Tree-shaking: why import makes it possible", wide: [640, 500], tall: [330, 708],
      build(svg, F, layout) {
        const tall = layout === "tall";
        const P = tall
          ? { app: { x: 12, y: 30, w: 290, h: 112 }, math: { x: 12, y: 166, w: 290, h: 76 }, format: { x: 12, y: 262, w: 290, h: 76 }, bundle: { x: 12, y: 362, w: 290, h: 112 }, cjs: { x: 12, y: 496, w: 306, h: 200 } }
          : { app: { x: 12, y: 30, w: 290, h: 112 }, math: { x: 346, y: 24, w: 210, h: 88 }, format: { x: 346, y: 134, w: 210, h: 88 }, bundle: { x: 12, y: 166, w: 290, h: 112 }, cjs: { x: 12, y: 296, w: 616, h: 196 } };
        const card = (p, title) => { const g = S("g"); g.append(S("rect", { x: p.x, y: p.y, width: p.w, height: p.h, rx: 12, class: "vm-card" }), S("text", { x: p.x + 12, y: p.y + 22, class: "fl-col-title" }, title)); svg.append(g); return F.actor(g, { o: 0 }, opac); };
        const cardA = { app: card(P.app, "app.js"), math: card(P.math, "math.js"), format: card(P.format, "format.js") };
        // import lines inside app.js
        const appG = S("g");
        appLines.forEach((t, i) => { const tx = S("text", { x: P.app.x + 12, y: P.app.y + 46 + i * 18, class: "fl-code", style: "font-size:12px", "xml:space": "preserve" }); tokenize(tx, t); appG.append(tx); });
        const hi = S("rect", { x: P.app.x + 6, y: P.app.y + 32, width: P.app.w - 12, height: 38, rx: 6, class: "fl-line-bar" });
        appG.prepend(hi);
        svg.append(appG);
        const appT = F.actor(appG, { o: 0 }, opac);
        const hiA = F.actor(hi, { o: 0 }, opac);
        // export chips
        const chips = {};
        files.forEach((f) => R.exportsOf[f].forEach((name, i) => {
          const x = P[f.replace(".js", "")].x + 12 + i * 62;
          const y = P[f.replace(".js", "")].y + 44;
          const g = S("g");
          const rect = (cls) => S("rect", { x, y, width: 54, height: 26, rx: 13, class: cls });
          g.append(rect("vm-chip"), rect("vm-chip-use"), rect("vm-chip-keep"), S("text", { x: x + 27, y: y + 17, "text-anchor": "middle", class: "vm-chip-t" }, name), S("text", { x: x + 27, y: y + 17, "text-anchor": "middle", class: "vm-chip-t inv" }, name), S("line", { x1: x + 8, x2: x + 46, y1: y + 13, y2: y + 13, class: "fl-strike" }));
          svg.append(g);
          chips[name] = { f, x, y, a: F.actor(g, { o: 0, use: 0, cut: 0, keep: 0 }, (p, n) => {
            const k = n.childNodes; const on = Math.max(p.use, p.keep);
            n.setAttribute("opacity", Math.max(0, Math.min(1, p.o)).toFixed(3));
            k[1].setAttribute("opacity", p.use); k[2].setAttribute("opacity", p.keep); k[3].setAttribute("opacity", 1 - on); k[4].setAttribute("opacity", on); k[5].setAttribute("opacity", p.cut);
          }) };
        }));
        // arrows from the import lines to the used chips
        const arrows = R.edges.map((e, i) => {
          const c = chips[e.names[0]];
          const to = P[e.to.replace(".js", "")];
          const x1 = P.app.x + P.app.w;
          const y1 = P.app.y + 41 + i * 18;
          const d = tall ? `M ${x1} ${y1} C ${x1 + 22} ${y1}, ${to.x + to.w + 22} ${c.y + 13}, ${to.x + to.w + 1} ${c.y + 13}` : `M ${x1} ${y1} C ${x1 + 22} ${y1}, ${to.x - 22} ${c.y + 13}, ${to.x - 1} ${c.y + 13}`;
          const g = S("g");
          g.append(S("path", { d, class: "vm-arrow" }), S("path", { d: tall ? `M ${to.x + to.w + 1} ${c.y + 13} l 8 -4.5 l 0 9 z` : `M ${to.x - 1} ${c.y + 13} l -8 -4.5 l 0 9 z`, class: "vm-head" }));
          svg.append(g);
          return F.actor(g, { o: 0 }, opac);
        });
        // the bundle
        const bg = S("g");
        bg.append(S("rect", { x: P.bundle.x, y: P.bundle.y, width: P.bundle.w, height: P.bundle.h, rx: 12, class: "vm-card vm-bundle" }), S("text", { x: P.bundle.x + 12, y: P.bundle.y + 22, class: "fl-col-title" }, "bundle.js"));
        svg.append(bg);
        const bundleA = F.actor(bg, { o: 0 }, opac);
        const bl = S("g");
        bundleLines.forEach((t, i) => { const tx = S("text", { x: P.bundle.x + 10, y: P.bundle.y + 46 + i * 20, class: "fl-code", style: "font-size:12px", "xml:space": "preserve" }); tokenize(tx, t); bl.append(tx); });
        svg.append(bl);
        const blA = F.actor(bl, { o: 0 }, opac);
        const bc = S("g");
        ["if these files used require:", "every export of math.js", "every export of format.js", "and the app code"].forEach((t, i) => bc.append(S("text", { x: P.bundle.x + 12, y: P.bundle.y + 46 + i * 17, class: i ? "fl-small" : "fl-strong-s", style: i ? null : "font-size:13px" }, t)));
        svg.append(bc);
        const bcA = F.actor(bc, { o: 0 }, opac);
        // the CommonJS strip
        const cg = S("g");
        cg.append(S("rect", { x: P.cjs.x, y: P.cjs.y, width: P.cjs.w, height: P.cjs.h, rx: 12, class: "fl-code-bg" }), S("text", { x: P.cjs.x + 12, y: P.cjs.y + 22, class: "fl-col-title" }, "pick.js (CommonJS)"));
        cjsLines.forEach((t, i) => { const tx = S("text", { x: P.cjs.x + 14, y: P.cjs.y + 48 + i * 19, class: "fl-code", style: "font-size:12px", "xml:space": "preserve" }); tokenize(tx, t); cg.append(tx); });
        D.DYNAMIC.runs.forEach(([pick, out], i) => cg.append(S("text", { x: P.cjs.x + 14, y: P.cjs.y + 48 + cjsLines.length * 19 + 20 + i * 20, class: "fl-status" }, `PICK=${pick}  →  loads ${pick}.js  →  "${out[0]}"`)));
        cg.append(S("text", { x: P.cjs.x + 14, y: P.cjs.y + P.cjs.h - 14, class: "fl-strong-s" }, "The path is built at run time."));
        svg.append(cg);
        const cgA = F.actor(cg, { o: 0 }, opac);

        const t1 = 0.3, t2 = 9.5, t3 = 21, t4 = 28, t5 = 40, t6 = 55;
        F.chapter(t1, "Three files");
        F.to(cardA.app, { o: 1 }, t1, 0.6); F.to(appT, { o: 1 }, t1 + 0.4, 0.6);
        F.to(cardA.math, { o: 1 }, t1 + 1, 0.6); F.to(cardA.format, { o: 1 }, t1 + 1.6, 0.6);
        Object.values(chips).forEach((c, i) => F.to(c.a, { o: 1 }, t1 + 2 + i * 0.25, 0.4));
        F.say(t1, `Three files. app.js uses code from the other two. The chips show everything each file exports: ${R.order.filter((f) => f !== "app.js").map((f) => `${f} has ${R.exportsOf[f].length}`).join(", ")}.`);
        F.chapter(t2, "Imports are plain text");
        F.to(hiA, { o: 1 }, t2, 0.4);
        arrows.forEach((a, i) => F.to(a, { o: 1 }, t2 + 0.5 + i * 0.7, 0.6));
        F.say(t2, "Look at the top of app.js. The import lines are plain text. A bundler can read them without running any code, and see which files and names are used.");
        F.chapter(t3, "Mark what is used");
        F.to(hiA, { o: 0 }, t3, 0.4);
        usedAll.forEach((n, i) => F.to(chips[n].a, { use: 1 }, t3 + i * 0.7, 0.5));
        F.say(t3, `app.js asks only for ${usedAll.join(" and ")}. Those ${usedAll.length} exports are marked as used.`);
        F.chapter(t4, "Shake the tree");
        unusedAll.forEach((n, i) => { F.to(chips[n].a, { cut: 1 }, t4 + i * 0.35, 0.4); F.to(chips[n].a, { o: 0.3 }, t4 + 1.8 + i * 0.2, 0.7); });
        F.to(bundleA, { o: 1 }, t4 + 3, 0.6); F.to(blA, { o: 1 }, t4 + 3.4, 0.6);
        F.say(t4, `The other ${unusedAll.length} exports (${unusedAll.join(", ")}) are never imported, so they are removed. The bundle keeps only what is used. This is tree-shaking.`);
        F.chapter(t5, "CommonJS cannot do this");
        arrows.forEach((a) => F.to(a, { o: 0 }, t5, 0.5));
        F.to(blA, { o: 0 }, t5, 0.5);
        Object.values(chips).forEach((c) => F.to(c.a, { o: 1, use: 0, cut: 0, keep: 1 }, t5, 0.8));
        F.to(bcA, { o: 1 }, t5 + 0.5, 0.6); F.to(cgA, { o: 1 }, t5 + 0.8, 0.7);
        F.say(t5, "Now CommonJS. require(...) is a function call. The path can even be built while the program runs. And module.exports is a plain object that code can change while it runs. So a bundler often cannot know which names are used, and it keeps everything to be safe.");
        F.chapter(t6, "Why it needs ESM");
        F.say(t6, "An import is fixed text, known before the code runs. A require is a call, known only when it runs. That is why tree-shaking works best with ESM.");
        F.end(t6 + 9);
      },
    });
  };

  /* ================= 08. live binding ================= */
  V.liveBinding = () => {
    const M = D.MOD;
    const exportFile = { esm: "counter.mjs", cjs: "counter.cjs", getter: "counter.cjs" };
    const mainFile = { esm: "main.mjs", cjs: "main.cjs", getter: "main.cjs" };
    return guided({
      title: "Live binding and copies",
      build(view) {
        const left = { code: h("div.vm-fcode"), box: h("b.tab.vm-bigval", "0"), name: h("span.vm-fname") };
        const right = { code: h("div.vm-fcode"), box: h("b.tab.vm-bigval", "0"), name: h("span.vm-fname"), tag: h("small.vm-tag") };
        const out = h("div.vm-out", { "aria-live": "polite" });
        const pane = (o, label) => h("div.vm-fpane", o.name, o.code, h("div.vm-var", h("span.label", label), o.box, o.tag));
        const free = h("div.vm-btns", { hidden: true });
        const root = h("div.vm-fpanes");
        const s = {
          mode: "esm", n: 0, left, right, out, free,
          set(mode) {
            root.classList.remove("order");
            s.mode = mode;
            const d = M[mode];
            left.name.textContent = exportFile[mode];
            right.name.textContent = mainFile[mode];
            left.code.replaceChildren(Book.code(d.files[exportFile[mode]]));
            right.code.replaceChildren(Book.code(d.files[mainFile[mode]]));
            right.tag.textContent = mode === "esm" ? "a window to the same variable" : mode === "cjs" ? "its own copy" : "asks the counter each time";
            s.value(0);
            out.replaceChildren();
          },
          order() {
            root.classList.add("order");
            left.name.textContent = "main.mjs (ESM): imports dep.mjs";
            right.name.textContent = "main.cjs (CommonJS): requires dep.cjs";
            left.code.replaceChildren(Book.code(M.orderEsm.files["main.mjs"]));
            right.code.replaceChildren(Book.code(M.orderCjs.files["main.cjs"]));
            out.replaceChildren();
          },
          /* After n calls to inc(): the exporter holds n. What main sees is in the real run's output (checked by the test). */
          value(n) { s.n = n; left.box.textContent = String(n); right.box.textContent = M[s.mode].expect[n]; },
          print(n) { out.replaceChildren(...M[s.mode].expect.slice(0, n + 1).map((t) => h("div.vm-out-line", t))); },
        };
        root.append(pane(left, "count here is"), pane(right, "count in main is"));
        view.append(root, h("div.vm-consolebox", h("span.label", "main prints"), out), free);
        return s;
      },
      steps: [
        { say: "Two files. counter has a variable count and a function inc(). main imports them. Between the two boxes, ESM puts a window: main looks at the same variable.", enter: (s) => { s.set("esm"); s.free.hidden = true; } },
        {
          say: "main prints count, then calls inc() three times, printing count each time.",
          enter: (s) => { s.set("esm"); s.free.hidden = true; },
          guess: { q: "What does main.mjs print?", options: [M.esm.expect.join(", "), M.cjs.expect.join(", ")], answer: 0, why: "An ES module import is a live binding: main reads the exporter's variable itself, so it sees every change." },
          action: { label: "Run main.mjs", icon: "play", run: async (s, ctx) => { for (let n = 0; n <= 3; n++) { s.value(n); s.print(n); await ctx.wait(550); } } },
          after: `Printed ${M.esm.expect.join(", ")}. main cannot assign to an import either. In Node, count = 5 gives “${M.assign.expect[0]}”, which is a TypeError. The wording differs between engines. Only counter changes count.`,
        },
        {
          say: "Same two files, written as CommonJS: module.exports and require.",
          enter: (s) => { s.set("cjs"); s.free.hidden = true; },
          guess: { q: "What does main.cjs print?", options: [M.esm.expect.join(", "), M.cjs.expect.join(", ")], answer: 1, why: "The exporter wrote count into a plain object when it loaded (the number 0 was copied there). The exporter's later changes do not reach that copy." },
          action: { label: "Run main.cjs", icon: "play", run: async (s, ctx) => { for (let n = 0; n <= 3; n++) { s.value(n); s.print(n); await ctx.wait(550); } } },
          after: `Printed ${M.cjs.expect.join(", ")}. The exporter's count went up (look at the left box), but main kept the copy it took at the start.`,
        },
        {
          say: "How to see new values with CommonJS: read the value when you need it, here with a getter.",
          enter: (s) => { s.set("getter"); s.free.hidden = true; },
          action: { label: "Run main.cjs", icon: "play", run: async (s, ctx) => { for (let n = 0; n <= 3; n++) { s.value(n); s.print(n); await ctx.wait(550); } } },
          after: `Printed ${M.getter.expect.join(", ")}. main asks counter.count each time, so it gets the current value. Calling a function works too.`,
        },
        {
          say: "One more difference: when does a module's code run? main logs first, then loads dep.",
          enter: (s) => { s.order(); s.free.hidden = true; },
          guess: { q: "In main.mjs, import \"./dep.mjs\" is written AFTER console.log(\"main starts\"). What prints first?", options: ["main starts", "dep runs"], answer: 1, why: "import lines are read and run before any other code in the file, wherever you write them." },
          action: { label: "Run both versions", icon: "play", run: async (s) => { s.out.replaceChildren(h("div.vm-out-line", h("b", "ESM:  "), M.orderEsm.expect.join("  →  ")), h("div.vm-out-line", h("b", "CJS:  "), M.orderCjs.expect.join("  →  "))); } },
          after: "In ESM, imports run first. In CommonJS, require runs when the line is reached, so “main starts” comes first.",
        },
        {
          say: "Your turn. Pick a style, then call inc() up to three times. ESM and the getter follow the exporter. Plain CommonJS keeps the first value.",
          enter: (s) => {
            s.set("esm");
            s.free.hidden = false;
            const mk = (label, fn) => { const b = h("button.chip", { type: "button" }, label); b.addEventListener("click", fn); return b; };
            s.free.replaceChildren(
              ...[["ESM", "esm"], ["CommonJS", "cjs"], ["CommonJS + getter", "getter"]].map(([l, m]) => mk(l, () => { s.set(m); s.print(0); })),
              mk("Call inc()", () => { if (s.n < 3) { s.value(s.n + 1); s.print(s.n); } }), mk("Reset", () => { s.set(s.mode); s.print(0); }));
            s.print(0);
          },
        },
      ],
      takeaway: "An ESM import is a live view of the exporter's variable. A CommonJS require gives you a copy of what was exported at that moment.",
      check: {
        q: "In CommonJS, the exporter changes its count after main required it. What does main's destructured count show?",
        options: ["The new value", "The old value, a copy"],
        answer: 1,
        why: ["That is ESM behaviour. With const { count } = require(...) the value was copied once.", "Right. Use a getter or a function if you need the current value."],
      },
    });
  };

  /* ================= small pictures for the hub cards ================= */
  V.picture = (kind) => () => {
    const label = { shared: "Two outer objects share one inner object", deep: "Two outer objects each have their own inner object", frozen: "An outer object is locked, the inner object inside it is not", json: "What the JSON round trip does to five types of value", eq: "A small table: what === and Object.is answer for three pairs" }[kind];
    const svg = S("svg", { viewBox: kind === "json" ? "0 0 220 130" : kind === "eq" ? "0 0 220 112" : "0 0 220 96", role: "img", "aria-label": label });
    const box = (x, y, w, hh, text, cls = "vm-card") => svg.append(S("rect", { x, y, width: w, height: hh, rx: 8, class: cls }), S("text", { x: x + 8, y: y + 15, class: "fl-small" }, text));
    const arr = (x1, y1, x2, y2) => svg.append(S("path", { d: `M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2 - 1} ${y2}`, class: "vm-arrow" }), S("path", { d: `M ${x2} ${y2} l -7 -4 l 0 8 z`, class: "vm-head" }));
    if (kind === "shared") { box(6, 6, 70, 34, "a"); box(6, 54, 70, 34, "b"); box(150, 28, 64, 40, "tags"); arr(60, 28, 150, 40); arr(60, 76, 150, 58); }
    if (kind === "deep") { box(6, 6, 70, 34, "a"); box(6, 54, 70, 34, "b"); box(150, 6, 64, 34, "tags"); box(150, 54, 64, 34, "tags"); arr(60, 28, 150, 23); arr(60, 76, 150, 71); }
    if (kind === "frozen") { box(6, 10, 110, 76, "frozen object"); box(140, 28, 74, 40, "list", "vm-card open"); arr(100, 52, 140, 48); svg.append(S("path", { d: "M 92 24 v -6 a 6 6 0 0 1 12 0 v 6", class: "vm-lock" }), S("rect", { x: 88, y: 24, width: 20, height: 14, rx: 3, class: "vm-lockbody" })); }
    if (kind === "json") {
      D.jsonFacts().forEach(([from, to], i) => {
        const y = 4 + i * 25;
        svg.append(S("rect", { x: 4, y, width: 84, height: 21, rx: 10.5, class: "vm-chip" }), S("text", { x: 46, y: y + 15, "text-anchor": "middle", class: "vm-chip-t" }, from),
          S("path", { d: `M 98 ${y + 10.5} h 24 m -6 -4 l 6 4 l -6 4`, class: "vm-arrow" }), S("text", { x: 134, y: y + 15, class: "vm-chip-t" }, to));
      });
    }
    if (kind === "eq") {
      svg.append(S("text", { x: 96, y: 15, "text-anchor": "middle", class: "fl-small" }, "==="), S("text", { x: 172, y: 15, "text-anchor": "middle", class: "fl-small" }, "Object.is"));
      D.eqTable().forEach((r, i) => {
        const y = 40 + i * 27;
        svg.append(S("text", { x: 4, y, class: "vm-key" }, `${r.a}, ${r.b}`), S("text", { x: 96, y, "text-anchor": "middle", class: "vm-val" }, String(r.strict)), S("text", { x: 172, y, "text-anchor": "middle", class: "vm-val" }, String(r.same)));
      });
    }
    return svg;
  };
})();
