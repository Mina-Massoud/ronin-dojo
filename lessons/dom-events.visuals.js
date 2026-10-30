/* DOM and events: the film and the guided pages. Every order, count and value on screen comes from a REAL dispatch:
   the page builds real elements, attaches real listeners and sends real events (dom-events.data.js), and
   dev/dom-events.test.js runs the same functions in jsdom. Live demos that listen on window or document stop
   when the step changes or the lesson leaves the page (AbortController). */
(function () {
  const { h, guided, svg: S } = Book;
  const V = Book.parts["dom-events"];
  const D = V.data;
  const fmtList = (a) => (a.length ? a.join(" → ") : "(nothing ran)");

  /* ---------- shared helpers ---------- */
  /* Abort `ctl` when `host` leaves the page, or the address (lesson) changes. */
  function watch(host, ctl) {
    let seen = false;
    const mo = new MutationObserver(() => { if (host.isConnected) seen = true; else if (seen) ctl.abort(); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", () => ctl.abort(), { signal: ctl.signal });
    ctl.signal.addEventListener("abort", () => mo.disconnect());
    return ctl;
  }
  function logBox(title) {
    const body = h("div.de-log-body", { "aria-live": "polite" });
    return {
      el: h("div.de-log", h("span.label", title), body),
      add(t) { body.append(h("div.de-log-line", t)); while (body.children.length > 40) body.firstChild.remove(); body.scrollTop = body.scrollHeight; },
      clear() { body.replaceChildren(); },
    };
  }
  const lineView = (lines, lit) => h("pre.code-block.de-code", { "aria-label": "The code" }, lines.map((l) => h("span.de-ln" + (lit && (lit === "cleanup" ? l.text.includes("{ signal }") : l.guard === lit && l.on) ? ".new" : ""), { html: Book.highlight(l.text) || " " })));
  const plainLines = (src) => src.split("\n").map((text) => ({ text }));
  const runCase = (id) => { const lab = D.buildLab(window, document.body); try { return D.trace(window, lab, D.STOP_CASES[id]); } finally { lab.ul.remove(); } };

  /* ---------- 01. Three boxes, one click (the visible boxes are the real elements) ---------- */
  V.clickProblem = () => guided({
    title: "You click one button. Which listeners run?",
    build(view) {
      const stage = h("div.de-stage");
      const log = logBox("Written by the real listeners");
      const chip = h("button.chip", { type: "button", "aria-pressed": "false" }, "Outer box: capture: true");
      const clear = h("button.chip", { type: "button" }, "Clear the log");
      const picker = h("div.de-chips", { hidden: true }, chip, clear);
      view.append(h("div.de-pair", stage, h("div.de-side", log.el)), picker);
      const s = { log, picker, n: null, order: [] };
      s.mount = (capture) => {
        if (s.n) s.n.stop();
        stage.replaceChildren(); log.clear(); s.order = [];
        s.n = D.nested(window, stage, (name) => { s.order.push(name); log.add(`${s.order.length}. ${name}`); });
        s.n.wire(capture);
        chip.setAttribute("aria-pressed", String(Boolean(capture)));
      };
      chip.addEventListener("click", () => s.mount(chip.getAttribute("aria-pressed") !== "true"));
      clear.addEventListener("click", () => { log.clear(); s.order = []; });
      return s;
    },
    steps: [
      { say: "Three boxes sit inside each other. Each one has a click listener that writes its own name in the log.", enter: (s) => { s.picker.hidden = true; s.mount(false); }, show: (s, ctx) => ctx.callout(s.n.btn, "the button you will click", "top") },
      {
        say: "All three listeners are made the normal way: addEventListener(\"click\", fn).", enter: (s) => { s.picker.hidden = true; s.mount(false); },
        guess: { q: "You click the button. Which listeners run, and in what order?", options: ["Only the button's", "button, then middle box, then outer box", "outer box, then middle box, then button"], answer: 1, why: "The click starts at the button, then goes up to its parents. This trip up is called bubbling." },
        action: { label: "Click the button", icon: "play", prompt: "Press the button. It sends a real click.", run: (s) => s.n.btn.click() },
        after: (s) => `The real order was: ${fmtList(s.order)}.`,
      },
      {
        say: "Now the outer box listens in a different way: addEventListener(\"click\", fn, { capture: true }). The other two stay normal.", enter: (s) => { s.picker.hidden = true; s.mount(true); },
        guess: { q: "You click the button again. What is the order now?", options: ["button, middle box, outer box", "outer box, button, middle box", "outer box, middle box, button"], answer: 1, why: "A capture listener runs on the way DOWN, before the click reaches the button. The two normal listeners run on the way up." },
        action: { label: "Click the button", icon: "play", prompt: "Press the button. It sends a real click.", run: (s) => s.n.btn.click() },
        after: (s) => `The real order was: ${fmtList(s.order)}.`,
      },
      { say: "Free play. Click the button, the middle box or the outer box yourself. Switch the outer box between the two ways.", enter: (s) => { s.picker.hidden = false; s.mount(false); } },
    ],
    takeaway: "A click goes down the tree first (capture), reaches the element you clicked, then goes back up (bubble). Normal listeners run on the way up.",
    check: { q: "Which listener runs first when you click the button?", options: ["A normal listener on the outer box", "A capture listener on the outer box", "The button's own listener, always"], answer: 1, why: ["Normal listeners run on the way up, after the button's.", "Yes. Capture listeners run on the way down, so the outer box comes first.", "The button's listener runs after every capture listener above it."] },
  });

  /* ---------- 02. The film: one click travels the tree (built from the recorded runs) ---------- */
  const ROWS = ["window", "document", "html", "body", "ul#list", "li#row", "button#del", "span#ico", "input#done"];
  const DEPTH = [0, 1, 2, 3, 4, 5, 6, 7, 6];
  const RUN_TITLES = { base: "Run 1 · a plain click", stop: "Run 2 · li: stopPropagation()", prevent: "Run 3 · checkbox, li: preventDefault()" };
  V.pathFilm = () => {
    const R = D.filmRuns(window, document.body);
    const G = (layout) => {
      const wide = layout === "wide";
      const g = { wide, W: wide ? 760 : 400, LW: wide ? 430 : 396, top: wide ? 54 : 50, rh: wide ? 38 : 33 };
      g.panel = wide ? { x: 456, y: 62 } : { x: 12, y: 50 + 9 * 33 + 26 };
      g.H = wide ? 420 : g.panel.y + 112;
      return g;
    };
    const dims = (l) => { const g = G(l); return [g.W, g.H]; };
    return Book.film({
      title: "One click travels the tree", wide: dims("wide"), tall: dims("tall"),
      build(svg, Fm, layout) {
        const g = G(layout);
        const laneL = 16, laneR = g.LW - 16;
        const rowY = (i) => g.top + i * g.rh + g.rh / 2;
        svg.append(S("text", { x: laneL - 6, y: g.top - 8, class: "fl-small", style: "font-size:12px" }, "capture ▼"), S("text", { x: g.LW - 8, y: g.top - 8, "text-anchor": "end", class: "fl-small", style: "font-size:12px" }, "bubble ▲"));
        const title = S("text", { x: 8, y: 20, class: "de-runtitle" });
        svg.append(title);
        const titles = ["", ...Object.values(RUN_TITLES)];
        const titleA = Fm.actor(title, { ver: 0 }, (p, n) => { n.textContent = titles[Math.round(p.ver)]; });
        /* rows and their badges */
        const rows = ROWS.map((name, i) => {
          const grp = S("g");
          const x = 34 + DEPTH[i] * (g.wide ? 9 : 7);
          const rect = S("rect", { x, y: rowY(i) - g.rh / 2 + 3, width: g.LW - 34 - 30 - DEPTH[i] * (g.wide ? 9 : 7), height: g.rh - 6, rx: 8, class: "de-rowrect" });
          const text = S("text", { x: x + 9, y: rowY(i) + 4.5, class: "de-rowtext", style: `font-size:${g.wide ? 13 : 12.5}px` }, name);
          const badge = (cx, extra) => S("circle", { cx, cy: rowY(i), r: extra ? 5 : 6.5, class: "de-badge" });
          const cap = badge(laneL), bub = badge(laneR), two = name === "li#row" ? badge(laneR - 30, true) : null;
          grp.append(rect, text, cap, bub);
          if (two) grp.append(two);
          svg.append(grp);
          const mk = (node) => node && Fm.actor(node, { on: 0 }, (p, n) => n.setAttribute("class", "de-badge" + (p.on > 0.5 ? " on" : "")));
          return { name, i, cap: mk(cap), bub: mk(bub), two: mk(two), fade: Fm.actor(grp, { o: 1 }, (p, n) => n.setAttribute("opacity", p.o.toFixed(3))), ver: 0 };
        });
        const rowOf = Object.fromEntries(rows.map((r) => [r.name, r]));
        /* the event: a dot */
        const dotN = S("circle", { r: g.wide ? 9 : 8, class: "de-dot" });
        svg.append(dotN);
        const dot = Fm.actor(dotN, { x: laneL, y: rowY(0), o: 0 }, (p, n) => { n.setAttribute("cx", p.x); n.setAttribute("cy", p.y); n.setAttribute("opacity", p.o.toFixed(3)); });
        /* the live panel: what the listener sees */
        const px = g.panel.x, py = g.panel.y;
        const cells = [["event.target", "target"], ["event.currentTarget", "current"], ["event.eventPhase", "phase"], ["event.defaultPrevented", "prevented"]];
        const cellPos = (k) => (g.wide ? { x: px, y: py + k * 50 } : { x: px + (k % 2) * 192, y: py + Math.floor(k / 2) * 52 });
        const texts = cells.map(([label], k) => {
          const pos = cellPos(k);
          const l = S("text", { x: pos.x, y: pos.y + 12, class: "fl-small", style: "font-size:12px" }, label);
          const v = S("text", { x: pos.x, y: pos.y + 32, class: "de-val" });
          svg.append(l, v);
          return v;
        });
        const versions = [{ target: "", current: "", phase: "", prevented: "" }];
        const panelA = Fm.actor(texts[0], { ver: 0 }, (p) => { const v = versions[Math.round(p.ver)]; cells.forEach(([, key], k) => { texts[k].textContent = v[key]; }); });
        const PHASE = { 1: "1 · capturing", 2: "2 · at target", 3: "3 · bubbling" };

        let T = 0;
        let lastTitle = 0;
        const resetRun = (key, leaf) => {
          Fm.to(dot, { o: 0 }, T, 0.3);
          rows.forEach((r) => { Fm.set(r.cap, { on: 0 }, T); Fm.set(r.bub, { on: 0 }, T); if (r.two) Fm.set(r.two, { on: 0 }, T); const onRoad = R[key].stops.includes(r.name); Fm.to(r.fade, { o: onRoad ? 1 : 0.28 }, T, 0.3); });
          versions.push({ ...versions[0], target: leaf }); Fm.set(panelA, { ver: versions.length - 1 }, T);
          Fm.set(titleA, { ver: ++lastTitle }, T);
          Fm.set(dot, { x: laneL, y: rowY(0) }, T + 0.3);
        };
        /* One beat: a caption, and the records that play while it is on screen. */
        const beat = (text, run, recs) => {
          Fm.say(T, text);
          const hold = D.frameSecs(text.replace(/`/g, ""));
          const step = recs.length ? Math.min(1.1, Math.max(0.3, hold / recs.length)) : 0;
          recs.forEach((rec, k) => {
            const t = T + k * step, mv = step * 0.7;
            const row = rowOf[rec.at];
            Fm.to(dot, { x: rec.kind === "capture" ? laneL : laneR, y: rowY(row.i), o: 1 }, t, mv);
            Fm.set(rec.kind === "capture" ? row.cap : rec.kind === "bubble" ? row.bub : row.two, { on: 1 }, t + mv);
            versions.push({ target: rec.target, current: rec.current, phase: PHASE[rec.phase], prevented: String(rec.prevented) }); Fm.set(panelA, { ver: versions.length - 1 }, t + mv);
          });
          T += Math.max(hold, recs.length * step);
        };
        const base = R.base.rec, split = (from, to) => base.slice(from, to);
        resetRun("base", "span#ico");
        Fm.chapter(T, "Capture: down the tree");
        beat("You click the word Delete. The click starts at the top and travels down.", "base", split(0, 4));
        beat("This trip down is the capture phase. Listeners set with `capture: true` run here.", "base", split(4, 7));
        Fm.chapter(T, "Target: where you clicked");
        beat("It reaches the target: the span you clicked. Its listeners run, then the click turns around.", "base", split(7, 9));
        Fm.chapter(T, "Bubble: back up");
        beat("On the way up, `currentTarget` changes at every stop. `target` stays the span.", "base", split(9, 16));
        T += 0.3;
        Fm.chapter(T, "stopPropagation");
        resetRun("stop", "span#ico"); T += 0.7;
        beat("Same click again. This time the li listener calls `stopPropagation()`.", "stop", R.stop.rec);
        beat("No bubble listener above li ran. A second listener on the same li still did.", "stop", []);
        Fm.chapter(T, "preventDefault");
        resetRun("prevent", "input#done"); T += 0.7;
        beat("Now click the checkbox. The li listener calls `preventDefault()`.", "prevent", R.prevent.rec);
        beat("The box stays unchecked, but the click still reached window.", "prevent", []);
        Fm.end(T + 1);
      },
    });
  };

  /* ---------- 03. target and currentTarget ---------- */
  V.targetDemo = () => guided({
    title: "Where did the click land?",
    build(view) {
      const stage = h("div.de-stage");
      const read = h("div.de-read");
      const chips = [["ico", "Click the word Delete"], ["btn", "Click the button's edge"], ["li", "Click the row's empty space"]].map(([k, t]) => { const b = h("button.chip", { type: "button" }, t); b.addEventListener("click", () => s.click(k)); return b; });
      const picker = h("div.de-chips", { hidden: true }, chips);
      view.append(h("div.de-pair", stage, h("div.de-side", read)), picker);
      const s = { read, picker, t: null, last: null, showCur: false, showAfter: false };
      const cell = (label, v, on) => h("div.de-cell" + (on ? ".hot" : ""), h("span.label", label), h("code", v ?? "…"));
      s.paint = (hot) => {
        const r = s.last;
        read.replaceChildren(cell("event.target", r && r.target, hot === "target"), cell("event.target.closest(\"button\")", r && r.closest, hot === "closest"),
          s.showCur ? cell("event.currentTarget", r && r.current, hot === "current") : null, s.showAfter ? cell("event.currentTarget, read after the whole click finished", r && r.after, hot === "after") : null);
      };
      s.mount = (showCur, showAfter) => {
        if (s.t) s.t.stop();
        stage.replaceChildren();
        s.last = null; s.showCur = Boolean(showCur); s.showAfter = Boolean(showAfter);
        const t = (s.t = D.targetDemo(window, stage, (r) => {
          s.last = { ...r, after: "(wait…)" }; s.paint();
          setTimeout(() => { if (s.t === t && s.last) { s.last.after = t.afterwards(); s.paint(); } }, 0); // after the event has finished
        }));
        s.paint();
      };
      s.click = (k) => { s.t[k].click(); s.last.after = s.t.afterwards(); s.paint(); };
      return s;
    },
    steps: [
      { say: "A list has ONE listener, on the ul. The row has a Delete button, and the word Delete is a span inside the button.", enter: (s) => { s.picker.hidden = true; s.mount(); }, show: (s, ctx) => { ctx.callout(s.t.ul, "the listener is here", "top"); } },
      {
        say: "You will click the word Delete.", enter: (s) => { s.picker.hidden = true; s.mount(); },
        guess: { q: "What is event.target?", options: ["The ul, because it has the listener", "The button", "The span inside the button"], answer: 2, why: "target is the deepest element under the pointer. The word is a span, so the span is the target." },
        action: { label: "Click the word Delete", icon: "play", run: (s) => s.click("ico") },
        after: (s) => `target was ${s.last.target}. Its closest button is ${s.last.closest}.`,
      },
      {
        say: "Now click the button's edge, not the word.", enter: (s) => { s.picker.hidden = true; s.mount(); },
        guess: { q: "What is event.target now?", options: ["Still the span", "The button", "The li"], answer: 1, why: "The pointer is over the button's own padding, not over the span." },
        action: { label: "Click the button's edge", icon: "play", run: (s) => s.click("btn") },
        after: (s) => `target was ${s.last.target}. Both clicks gave the same closest button: ${s.last.closest}. That is why code uses closest().`,
      },
      {
        say: "A new value appears in the box: currentTarget.", enter: (s) => { s.picker.hidden = true; s.mount(true); },
        guess: { q: "In both clicks, what was event.currentTarget?", options: ["Whatever was clicked", "The ul", "The li"], answer: 1, why: "currentTarget is the element whose listener is running now. It is the ul every time. target is what changes." },
        action: { label: "Click the word again", icon: "play", run: (s) => s.click("ico") },
        after: (s) => `currentTarget was ${s.last.current}. target was ${s.last.target}.`,
        onReveal: (s) => s.paint("current"),
      },
      {
        say: "A listener can save the event object and read it later.", enter: (s) => { s.picker.hidden = true; s.mount(true, true); },
        action: { label: "Click, then read the saved event", icon: "play", run: (s) => { s.saved = D.savedEventRun(window, document.createElement("div")); s.click("ico"); } },
        after: (s) => `The browser sets currentTarget to null when the whole click has finished. If you saved the event, it shows null later: here it read ${s.last.after}. Read inside a later listener on the parent, the saved event still showed ${s.saved.inParent}. Read what you need inside the listener.`,
        onReveal: (s) => s.paint("after"),
      },
      { say: "Free play: click in three places and watch the four values.", enter: (s) => { s.picker.hidden = false; s.mount(true, true); } },
    ],
    takeaway: "target is the element you clicked and stays the same while the click travels (inside a shadow DOM it can show the host); currentTarget is the element whose listener is running. closest() turns a click on an inner part into the element you care about.",
    check: { q: "A listener is on the ul. You click a span in a li. What is event.currentTarget?", options: ["The span", "The li", "The ul"], answer: 2, why: ["The span is event.target.", "The li has no listener here.", "Yes. currentTarget is where the listener is attached."] },
  });

  /* ---------- 04. Stop it halfway (every case is a real trace) ---------- */
  const CASES = { baseline: "No tricks", stopOnly: "li: stopPropagation()", stopNow: "li: stopImmediatePropagation()", stopCapture: "body, capture: stopPropagation()", prevent: "li: preventDefault() on the checkbox" };
  V.stopping = () => guided({
    title: "Stop it halfway",
    build(view) {
      const rows = ROWS.map((name, i) => { const cap = h("i.de-b"), bub = h("i.de-b"), two = name === "li#row" ? h("i.de-b.de-b2") : null; return { name, cap, bub, two, el: h("div.de-crow", { style: "--d:" + DEPTH[i] }, cap, h("code", name), two, bub) }; });
      const status = h("p.de-status", { "aria-live": "polite" });
      const chips = Object.entries(CASES).map(([id, t]) => { const b = h("button.chip", { type: "button" }, t); b.addEventListener("click", () => s.run(id)); return b; });
      const picker = h("div.de-chips", { hidden: true }, chips);
      view.append(h("div.de-chain", h("div.de-chead", h("span.label", "capture ▼"), h("span.label", "bubble ▲")), rows.map((r) => r.el)), status, picker);
      const s = { rows, status, picker, res: null, id: null };
      s.reset = (id) => { s.res = null; s.id = id; rows.forEach((r) => { r.el.classList.remove("off"); [r.cap, r.bub, r.two].forEach((b) => b && (b.className = b.className.replace(/ ?(ran|skip)/g, ""))); if (r.two) r.two.hidden = !(D.STOP_CASES[id] && D.STOP_CASES[id].second === "li#row"); }); status.textContent = ""; };
      s.run = (id) => {
        s.reset(id);
        const res = (s.res = runCase(id));
        const ran = new Set(res.rec.map((x) => `${x.at}|${x.kind}`));
        rows.forEach((r) => {
          if (!res.stops.includes(r.name)) { r.el.classList.add("off"); return; }
          [[r.cap, "capture"], [r.bub, "bubble"], [r.two, "bubble2"]].forEach(([b, k]) => b && !b.hidden && b.classList.add(ran.has(`${r.name}|${k}`) ? "ran" : "skip"));
        });
        const total = res.stops.length * 2 + (D.STOP_CASES[id].second ? 1 : 0);
        s.status.textContent = `${res.rec.length} of ${total} listeners ran. The checkbox is ${res.checked ? "checked" : "not checked"}.`;
        s.last = { res, total };
      };
      return s;
    },
    steps: [
      { say: "This is the road of a click on the word Delete. Every stop has a listener for the way down (left) and one for the way up (right).", enter: (s) => { s.picker.hidden = true; s.reset("baseline"); }, action: { label: "Click once, no tricks", icon: "play", run: (s) => s.run("baseline") }, after: (s) => `All ${s.last.res.rec.length} listeners ran, in this order: ${s.last.res.rec.map((x) => x.at.split("#")[0] + (x.kind === "capture" ? "↓" : "↑")).join(" ")}.` },
      {
        say: "The li has two listeners for the way up. The first one calls stopImmediatePropagation().", enter: (s) => { s.picker.hidden = true; s.reset("stopNow"); },
        guess: { q: "Does the SECOND li listener run?", options: ["Yes, it is on the same element", "No, it is stopped at once"], answer: 1, why: "stopPropagation() lets the other listeners on the same element run. stopImmediatePropagation() does not." },
        action: { label: "Click the word Delete", icon: "play", run: (s) => s.run("stopNow") },
        after: (s) => { const r = s.last.res.rec; return `The li ran ${r.filter((x) => x.at === "li#row" && x.kind !== "capture").length} bubble listener (the first one). ${r[r.length - 1].at} was the last stop.`; },
      },
      {
        say: "A different place: the body has a listener for the way DOWN, and it calls stopPropagation().", enter: (s) => { s.picker.hidden = true; s.reset("stopCapture"); },
        guess: { q: "Does the button's own listener run?", options: ["Yes, the button is the target", "No, the click never gets down to it", "Only its capture listener"], answer: 1, why: "The click was stopped on the way down, before it reached anything below body. Even the target hears nothing." },
        action: { label: "Click the word Delete", icon: "play", run: (s) => s.run("stopCapture") },
        after: (s) => `${s.last.res.rec.length} listeners ran (${s.last.res.rec.map((x) => x.at.split("#")[0]).join(", ")}). The span and the button heard nothing.`,
      },
      {
        say: "Last: you click a checkbox. The li listener calls preventDefault().", enter: (s) => { s.picker.hidden = true; s.reset("prevent"); },
        guess: { q: "Does the window listener still hear the click? Is the box checked?", options: ["Window hears nothing, box unchecked", "Window still hears it, box unchecked", "Window still hears it, box checked"], answer: 1, why: "preventDefault() cancels what the browser would do (checking the box). It does not stop the click from travelling." },
        action: { label: "Click the checkbox", icon: "play", run: (s) => s.run("prevent") },
        after: (s) => `Window ${s.last.res.rec.some((x) => x.at === "window" && x.kind === "bubble") ? "did" : "did not"} hear it. The box is ${s.last.res.checked ? "checked" : "not checked"}.`,
      },
      { say: "Free play: pick a case and watch which listeners run.", enter: (s) => { s.picker.hidden = false; s.reset("baseline"); }, action: { label: "Click once, no tricks", icon: "play", again: true, run: (s) => s.run("baseline") }, after: (s) => s.status.textContent },
    ],
    takeaway: "stopPropagation() stops the trip to other elements; stopImmediatePropagation() also stops the rest on the same element; preventDefault() cancels the browser's action but not the trip.",
    check: { q: "A capture listener on body calls stopPropagation(). Which listeners below body run?", options: ["All of them", "None", "Only the target's"], answer: 1, why: ["The click is stopped on its way down.", "Yes. Nothing below body hears the click.", "The target is below body, so it hears nothing too."] },
  });

  /* ---------- 05. Delegation (counts are real addEventListener calls) ---------- */
  V.delegation = () => guided({
    title: "One listener for a thousand rows",
    build(view) {
      const list = h("div.de-listbox");
      const read = h("div.de-read");
      const chips = [["perRow", "One listener per row"], ["oneListener", "One listener on the list"]].map(([m, t]) => { const b = h("button.chip", { type: "button", "aria-pressed": "false" }, t); b.addEventListener("click", () => s.mount(m, 5)); return b; });
      const add = h("button.chip", { type: "button" }, "Add a row");
      const picker = h("div.de-chips", { hidden: true }, chips, add);
      view.append(h("div.de-pair", list, h("div.de-side", read)), picker);
      const s = { list, read, picker, mode: null, ul: null, tally: null, hits: [], ctl: null, extra: h("div.de-extra"), many: null };
      s.paint = () => read.replaceChildren(h("div.de-cell", h("span.label", "Listeners added (counted)"), h("code", String(s.tally ? s.tally.added : 0))), h("div.de-cell", h("span.label", "Rows"), h("code", String(s.ul ? s.ul.children.length : 0))), h("div.de-cell", h("span.label", "Rows that answered a click"), h("code", s.hits.join(", ") || "none yet")));
      s.mount = (mode, n) => {
        if (s.ctl) s.ctl.abort();
        if (s.esc) { s.esc.stop(); s.esc = null; }
        if (s.seen && s.seen.stop) { s.seen.stop(); s.seen = null; }
        s.ctl = new AbortController(); s.mode = mode; s.hits = []; s.tally = { added: 0 }; s.many = null;
        list.replaceChildren(); s.ul = h("ul.de-ul");
        list.append(s.ul);
        D.addRows(window, s.ul, 0, n);
        (mode === "perRow" ? D.perRow : D.oneListener)(s.ul, (li) => { s.hits.push(li.dataset.id); s.paint(); }, s.tally, s.ctl.signal);
        chips.forEach((c, i) => c.setAttribute("aria-pressed", String(["perRow", "oneListener"][i] === mode)));
        s.paint();
      };
      s.addRow = () => { D.addRows(window, s.ul, s.ul.children.length, s.ul.children.length + 1); s.paint(); return s.ul.lastElementChild; };
      add.addEventListener("click", s.addRow);
      s.addAndClick = () => { s.hits = []; const li = s.addRow(); li.click(); };
      return s;
    },
    steps: [
      { say: "A list with 5 rows. We give each row its own click listener. Click a row yourself; the box on the right shows which row answered.", enter: (s) => { s.picker.hidden = true; s.mount("perRow", 5); } },
      {
        say: "Now a new row is added to the list while the page is open. Nothing else changes.", enter: (s) => { s.picker.hidden = true; s.mount("perRow", 5); },
        guess: { q: "You click the new row. What happens?", options: ["It works like the others", "Nothing: it has no listener"], answer: 1, why: "A listener belongs to one element. The new row never got one." },
        action: { label: "Add a row and click it", icon: "play", run: (s) => s.addAndClick() },
        after: (s) => `Rows that answered: ${s.hits.join(", ") || "none"}. The counter still says ${s.tally.added} listeners.`,
      },
      {
        say: "Delegation: remove the row listeners. Put ONE listener on the list.", enter: (s) => { s.picker.hidden = true; s.mount("oneListener", 5); },
        guess: { q: "Same test. Does the new row work now?", options: ["No, still nothing", "Yes"], answer: 1, why: "The click on the new row bubbles up to the list, and the list's listener finds the row. The row needs no listener of its own." },
        action: { label: "Add a row and click it", icon: "play", run: (s) => s.addAndClick() },
        after: (s) => `Rows that answered: ${s.hits.join(", ") || "none"}. Listeners added: ${s.tally.added}. The list's listener asked event.target.closest("li") which row was clicked.`,
      },
      {
        say: "Now scale up: 1,000 rows, built for real in both ways. The counter counts addEventListener calls.", enter: (s) => { s.picker.hidden = true; s.mount("oneListener", 5); },
        guess: { q: "How many listeners do the two ways need for 1,000 rows?", options: ["1,000 and 1,000", "1,000 and 1", "1 and 1"], answer: 1, why: "One per row is 1,000 calls. One on the list stays 1, however many rows come." },
        action: { label: "Build 1,000 rows both ways", icon: "play", run: (s) => { s.many = D.delegationRun(window, document.createElement("div"), 1000); } },
        after: (s) => `One listener per row: ${s.many.perRow.listeners} listeners (a row added later works: ${s.many.perRow.lateRowWorks}). One on the list: ${s.many.oneListener.listeners} listener (a row added later works: ${s.many.oneListener.lateRowWorks}).`,
      },
      {
        say: "Trap 1. Here the list sits inside an outer li.", enter: (s) => { s.picker.hidden = true; s.mount("oneListener", 0); s.list.replaceChildren(); s.esc = D.escapeDemo(window, s.list); s.esc.outer.classList.add("de-esc"); s.read.replaceChildren(); },
        guess: { q: "A handler uses only closest(\"li\"). You click the note inside the widget. Which li does it find?", options: ["None", "The outer li, outside the widget", "The first inner li"], answer: 1, why: "The note is not inside any inner li, so closest() keeps walking up and finds the outer li. The fix is to also check widget.contains(li)." },
        action: { label: "Click the note", icon: "play", run: (s) => { s.esc.unsafe.length = 0; s.esc.safe.length = 0; s.esc.gap.click(); } },
        after: (s) => `closest() looks at the element and ALL its parents, even outside your list. Handler with only closest: ${s.esc.unsafe.join() || "nothing"}. Handler that also checks contains(): ${s.esc.safe.join() || "nothing"}.`,
      },
      {
        say: "Trap 2. Some events do not bubble. Test focus: the form has three listeners (focus, focus in capture mode, and focusin).", enter: (s) => { s.picker.hidden = true; s.mount("oneListener", 0); s.list.replaceChildren(); },
        guess: { q: "You focus an input inside the form. Which listeners on the form run?", options: ["All three", "Only focusin and the capture one", "Only focus"], answer: 1, why: "focus does not bubble, so a normal listener on the parent never sees it. focusin bubbles. A capture listener sees every event on its way down. (mouseenter does not bubble either; mouseover does.)" },
        action: { label: "Focus the input", icon: "play", run: (s) => { if (s.seen && s.seen.stop) s.seen.stop(); s.seen = D.focusRun(window, s.list, true); } },
        after: (s) => (s.seen.length ? `Real result: ${s.seen.map((x) => x.label).join(" and ")}. The plain focus listener on the form heard nothing.` : "Your browser did not send focus events (the page may not have focus). Click inside the page and try again."),
      },
      { say: "Free play: switch between the two ways, add rows, and click them.", enter: (s) => { s.picker.hidden = false; s.mount("oneListener", 5); } },
    ],
    takeaway: "Put one listener on a parent, find the child with event.target.closest(selector), and check that the match is inside the parent. New children work with no extra listeners.",
    check: { q: "Why does a row added later work with one listener on the list?", options: ["The listener is copied to new rows", "The click bubbles from the new row to the list", "Browsers re-scan the page"], answer: 1, why: ["Listeners are never copied.", "Yes. The list hears every click from its children, old or new.", "Nothing is re-scanned. Bubbling does the work."] },
  });

  /* ---------- 06/07. Hold-to-play keys ---------- */
  const STORY = {
    out: { say: "Press key C with the mouse, slide off the key, and let go over the page.", q: "The mouse button is let go away from the key. Does the note stop?", options: ["Yes, the button was let go", "No, the key stays down", "The page shows an error"], answer: 1, why: "pointerup goes to the element under the pointer, which is not the key. The fix: also listen on window. (Touch screens often capture the pointer for you, so this bug is mostly a mouse bug.)" },
    repeat: { say: "Hold a letter on the keyboard. After a short wait the system sends keydown again and again. This is auto-repeat.", q: "A is held: 1 keydown, then 3 auto-repeat keydowns. How many times does onPress run?", options: ["1", "4", "3"], answer: 1, why: "Every keydown calls press(), and nothing here checks for repeats, so the sound would start again each time. event.repeat is true on the three repeats." },
    merge: { say: "A note can be held by the mouse and by the keyboard together. Press C with the mouse, press A (also C), then let go of the mouse.", q: "The mouse is let go, A is still held. What does this code do?", options: ["C stops, though A is still held", "C keeps sounding until A is let go", "It throws an error"], answer: 0, why: "release() forgets who else holds the note. The fix: remember WHO holds each note (a Set), and stop the note only when the Set is empty." },
    edit: { say: "Focus the text field below the keys and type the letter a.", q: "You type a in the field. What happens to the piano?", options: ["Nothing, the field takes the key", "Key C is pressed too", "The piano throws an error"], answer: 1, why: "keydown bubbles up to window, and the piano listens there. It hears every key you type. The fix: ignore events from inputs, textareas, selects and contenteditable elements." },
    blur: { say: "Hold A, then switch to another window (Alt+Tab).", q: "The window loses focus while A is held. Does the note stop?", options: ["Yes, the browser sends keyup anyway", "No, it keeps sounding", "It stops after one second"], answer: 1, why: "Usually no keyup arrives, because the other window gets it. Nothing releases the note. The fix: on window blur, release everything." },
    cleanup: { say: "The piano is removed from the page, so its keys are gone.", q: "The piano is removed. You press A. Does onPress still run?", options: ["No, the elements are gone", "Yes, the listeners on window are still there", "Only once"], answer: 1, why: "Listeners on window or document stay until someone removes them. The fix: pass one AbortSignal to every addEventListener, and call abort() when the piano goes away." },
  };
  const fmtRes = (r) => `keys still down: ${r.pressed}; onPress ran ${r.presses} time${r.presses === 1 ? "" : "s"}`;
  function pianoParts(view, withLog) {
    const codeBox = h("div.de-codebox"), piano = h("div.de-pianobox"), log = logBox(withLog || "What the piano reports");
    view.append(h("div.de-pair", codeBox, h("div.de-side", piano, log.el)));
    const s = { log, off: [], rig: null, codeBox };
    s.mount = (off, lit) => {
      if (s.rig) s.rig.done();
      log.clear(); piano.replaceChildren(); s.off = off;
      let rig = null;
      const mark = (n, on) => rig && rig.key(n).classList.toggle("down", on);
      rig = s.rig = D.pianoRig(window, piano, off, { onPress: (n) => { mark(n, true); log.add(`onPress(${n})`); }, onRelease: (n) => { mark(n, false); log.add(`onRelease(${n})`); } });
      watch(piano, rig.life);
      codeBox.replaceChildren(lineView(D.pianoLines(off), lit));
    };
    return s;
  }
  V.pianoBuild = () => guided({
    title: "Build a hold-to-play key, one edge case at a time",
    build(view) { return pianoParts(view); },
    steps: [
      { say: "A key sounds while you hold it. The simple code: pointerdown presses, pointerup releases, and the keyboard does the same. Try it with the mouse or the keys A S D F G H.", enter: (s) => s.mount(D.ORDER) },
      ...D.ORDER.map((g, k) => ({
        say: STORY[g].say, enter: (s) => s.mount(D.ORDER.slice(k)),
        guess: { q: STORY[g].q, options: STORY[g].options, answer: STORY[g].answer, why: STORY[g].why },
        action: {
          label: "Try it", icon: "play", prompt: "Press the button. It sends real events to the piano.",
          run: async (s, ctx) => {
            D.SCENARIOS[g].run(s.rig);
            s.bad = { pressed: s.rig.pressedList(), presses: s.rig.state.presses };
            await ctx.wait(1100);
            if (!ctx.alive()) return;
            s.mount(D.ORDER.slice(k + 1), g);
            D.SCENARIOS[g].run(s.rig);
            s.good = { pressed: s.rig.pressedList(), presses: s.rig.state.presses };
          },
        },
        after: (s) => `Without the fix, ${fmtRes(s.bad)}. With the fix (the highlighted lines), ${fmtRes(s.good)}.`,
      })),
      { say: "All six guards are on. This is the whole piano. Next page: play it and break it yourself.", enter: (s) => s.mount([]) },
    ],
    takeaway: "A hold-to-play key needs state per note (who holds it), window-level release, a repeat check, an editable-target check, a blur release, and one AbortSignal for cleanup.",
    check: { q: "Why does the piano listen for pointerup on window, not only on the key?", options: ["The mouse can be let go away from the key", "window is faster", "keys cannot hear pointerup"], answer: 0, why: ["Yes. pointerup goes to whatever is under the pointer then.", "Speed is not the reason.", "A key can hear pointerup, but only when the pointer is over it."] },
  });

  V.pianoPlay = () => guided({
    title: "Play it, then break it",
    build(view) {
      const s = pianoParts(view, "Real events and what the piano did");
      const chips = D.ORDER.map((g) => { const b = h("button.chip", { type: "button", "aria-pressed": "false" }, "guard off: " + g); b.addEventListener("click", () => { const off = s.off.includes(g) ? s.off.filter((x) => x !== g) : [...s.off, g]; s.mountLive(off); chips.forEach((c, i) => c.setAttribute("aria-pressed", String(off.includes(D.ORDER[i])))); }); return b; });
      s.picker = h("div.de-chips", { hidden: true }, chips);
      view.append(s.picker);
      s.chips = chips;
      /* a second set of listeners writes what the browser really sent */
      s.mountLive = (off) => {
        s.mount(off);
        const sg = s.rig.life.signal, lg = s.log;
        const keyOf = (e) => (e.target.closest && e.target.closest("[data-note]") ? "key " + e.target.closest("[data-note]").dataset.note : "the page");
        window.addEventListener("pointerdown", (e) => lg.add(`pointerdown on ${keyOf(e)}`), { signal: sg });
        window.addEventListener("pointerup", (e) => lg.add(`pointerup on ${keyOf(e)}`), { signal: sg });
        window.addEventListener("keydown", (e) => D.NOTES && /^Key[ASDFGH]$/.test(e.code) && lg.add(`keydown ${e.code}${e.repeat ? " (repeat)" : ""}`), { signal: sg });
        window.addEventListener("keyup", (e) => /^Key[ASDFGH]$/.test(e.code) && lg.add(`keyup ${e.code}`), { signal: sg });
        window.addEventListener("blur", () => lg.add("blur (window lost focus)"), { signal: sg });
      };
      return s;
    },
    steps: [
      { say: "Play with the mouse: press and hold a key, slide off, let go. Play with the keyboard: A S D F G H, even two at a time. Hold a key and press Alt+Tab.", enter: (s) => { s.picker.hidden = true; s.mountLive([]); } },
      { say: "Free play. Switch one guard off and try the edge case again. The code on the left changes with every switch.", enter: (s) => { s.picker.hidden = false; s.chips.forEach((c) => c.setAttribute("aria-pressed", "false")); s.mountLive([]); } },
    ],
    takeaway: "Every guard is one line or two. Switch it off and a real input breaks the piano.",
    check: { q: "You hold A and press Alt+Tab. Which guard releases the note?", options: ["The repeat check", "The blur listener on window", "The editable-target check"], answer: 1, why: ["That one ignores auto-repeat.", "Yes. The window gets a blur event, and the code releases every note.", "That one ignores keys typed in a field."] },
  });

  /* The checklist: what each guard breaks, measured by running the scenario for real (in an isolated document). */
  const BREAKS = {
    out: "The note sticks: the mouse was let go somewhere else.", repeat: "The sound restarts on every auto-repeat.", merge: "Letting go of the mouse stops a note the keyboard still holds.",
    edit: "Typing in a field plays notes.", blur: "Alt+Tab can leave a note sounding until you press that key again.", cleanup: "A removed piano still reacts to the keyboard, and the old listeners pile up.",
  };
  V.guardTable = () => h("div.de-table", { role: "table", "aria-label": "What each guard breaks" },
    D.ORDER.map((g, k) => {
      const bad = D.pianoScenario(window, g, D.ORDER.slice(k)), good = D.pianoScenario(window, g, D.ORDER.slice(k + 1));
      const all = D.pianoLines(D.ORDER.slice(k + 1));
      const lines = (g === "cleanup" ? all.filter((l) => l.text.includes("{ signal }")).slice(0, 3) : all.filter((l) => l.guard === g && l.on)).map((l) => l.text).join(String.fromCharCode(10));
      return h("div.de-trow", { role: "row" },
        h("div.de-tname", h("b", D.SCENARIOS[g].name), h("p", BREAKS[g])),
        h("div.de-tcode", Book.code(lines.trim())),
        h("div.de-tres", h("span.label", "Real run, guard off"), h("p", fmtRes(bad)), h("span.label", "Real run, guard on"), h("p", fmtRes(good)),
          g === "repeat" ? h("p.de-tnote", "This run has the merge guard off. With merge on, the Set also ignores a repeated key, so keep both.") : null));
    }));

  /* ---------- 10. From your work: a long-press drag, as a small model, with real timers ---------- */
  V.longPress = () => guided({
    title: "Long-press, scroll, or tap?",
    build(view) {
      const code = h("div.de-codebox", lineView(plainLines(D.LONGPRESS_SRC)));
      const tile = h("div.de-tile", "Booking tile"), zone = h("div.de-zone", { id: "zone" }, "Drop zone");
      const log = logBox("What the model reported");
      const chips = [["hold", "Hold 300 ms, lift over the zone"], ["scroll", "Move 12 px at once"], ["tap", "Lift at once"]].map(([k, t]) => { const b = h("button.chip", { type: "button" }, t); b.addEventListener("click", () => s.go(k)); return b; });
      const picker = h("div.de-chips", { hidden: true }, chips);
      view.append(h("div.de-pair", code, h("div.de-side", h("div.de-touchbox", tile, zone), log.el)), picker);
      const s = { log, picker, last: null, busy: false };
      s.go = async (kind) => {
        if (s.busy) return;
        s.busy = true; log.clear(); log.add(`finger: ${kind}`);
        const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.id === "zone" ? "the drop zone" : "nothing (the pointer was not over the zone)"; };
        s.last = await D.longPressRun(window, null, kind, hit, { tile, zone });
        s.last.forEach((t) => log.add(t));
        s.busy = false;
      };
      return s;
    },
    steps: [
      { say: "Speako's comment says iPad touch does not send HTML5 drag events, so it starts a drag after a 250 ms hold. It shows a ghost (a copy of the tile that follows the finger). This is a small model of that idea, not Speako's file.", enter: (s) => { s.picker.hidden = true; s.log.clear(); } },
      {
        say: "The finger touches the tile, stays still for 300 ms, then lifts over the drop zone.", enter: (s) => { s.picker.hidden = true; s.log.clear(); },
        guess: { q: "What does the model report?", options: ["cancelled: tap", "armed, then dropped on the zone", "cancelled: scroll"], answer: 1, why: "The 250 ms timer fired before the finger moved, so the drag was armed. Lifting over the zone drops it." },
        action: { label: "Run it (takes 0.3 s)", icon: "play", run: (s) => s.go("hold") },
        after: (s) => `Real events gave: ${(s.last || []).join(", then ")}.`,
      },
      {
        say: "Now the finger touches the tile and moves 12 px right away. The tolerance is 6 px.", enter: (s) => { s.picker.hidden = true; s.log.clear(); },
        guess: { q: "What does the model report?", options: ["armed, then dropped", "cancelled: scroll", "cancelled: tap"], answer: 1, why: "The finger moved more than 6 px before 250 ms, so the model treats it as a scroll and lets the page scroll." },
        action: { label: "Run it", icon: "play", run: (s) => s.go("scroll") },
        after: (s) => `Real events gave: ${(s.last || []).join(", then ")}.`,
      },
      { say: "Free play: run the three fingers.", enter: (s) => { s.picker.hidden = false; s.log.clear(); } },
    ],
    takeaway: "A long-press timer separates a drag from a scroll: if the finger moves before the timer fires, cancel; if it fires first, arm the drag.",
    check: { q: "Why does the model wait 250 ms before it starts a drag?", options: ["To tell a drag from a scroll", "Because timers are free", "To save battery"], answer: 0, why: ["Yes. Within 250 ms, movement means scroll.", "The timer is not the point; what it decides is.", "Battery is not the reason."] },
  });

  /* ---------- 12. On the job: the delete button that opens the details ---------- */
  V.ticket = () => guided({
    title: "Delete also opens the details",
    build(view) {
      const stage = h("div.de-stage"), code = h("div.de-codebox"), read = h("div.de-read");
      const chips = [["bug", "No fix"], ["stop", "stopPropagation"], ["closest", "closest check"]].map(([k, t]) => { const b = h("button.chip", { type: "button", "aria-pressed": "false" }, t); b.addEventListener("click", () => s.v(k)); return b; });
      const picker = h("div.de-chips", { hidden: true }, chips, h("span.label", "then click:"), ...[["del", "Delete"], ["text", "the row text"]].map(([w, t]) => { const b = h("button.chip", { type: "button" }, t); b.addEventListener("click", () => s.go(w)); return b; }));
      view.append(h("div.de-pair", code, h("div.de-side", stage, read)), picker);
      const s = { picker, variant: "bug", res: null };
      const cell = (l, v) => h("div.de-cell", h("span.label", l), h("code", v));
      s.show = () => { const r = s.res; read.replaceChildren(cell("Details opened?", r ? String(r.opened) : "…"), cell("Row deleted?", r ? String(r.deleted) : "…"), cell("Analytics saw the click on document?", r ? (r.tracked ? "yes" : "no") : "…")); };
      s.v = (variant) => {
        if (s.t) s.t.stop();
        s.variant = variant; s.res = null; stage.replaceChildren(); code.replaceChildren(Book.code(D.TICKET[variant]));
        s.t = D.ticketBuild(window, stage, variant, (r) => { s.res = { ...r }; s.show(); });
        watch(stage, s.t.ctl);
        chips.forEach((c, i) => c.setAttribute("aria-pressed", String(["bug", "stop", "closest"][i] === variant))); s.show();
      };
      s.go = (what) => { s.t.state.opened = s.t.state.deleted = false; s.t.state.tracked = 0; (what === "text" ? s.t.text : s.t.del).click(); s.res = { ...s.t.state }; s.show(); };
      return s;
    },
    steps: [
      { say: "Each row opens its details when you click it. The Delete button is inside the row. A tracking listener on document counts clicks.", enter: (s) => { s.picker.hidden = true; s.v("bug"); } },
      {
        say: "The first version: the row has a listener, and the button has its own. No fix yet.", enter: (s) => { s.picker.hidden = true; s.v("bug"); },
        guess: { q: "You click Delete. What happens?", options: ["The row is deleted only", "The row is deleted AND the details open", "The details open only"], answer: 1, why: "The click bubbles from the button up to the row, so the row's listener runs too." },
        action: { label: "Click Delete", icon: "play", run: (s) => s.go("del") },
        after: (s) => `Opened: ${s.res.opened}. Deleted: ${s.res.deleted}.`,
      },
      {
        say: "Fix A: the delete listener calls event.stopPropagation(). The click can no longer reach the row.", enter: (s) => { s.picker.hidden = true; s.v("stop"); },
        guess: { q: "Does the tracking listener on document still see the Delete click?", options: ["Yes", "No"], answer: 1, why: "The click never gets as far as document. Analytics, and outside-click code that listens in the bubble phase, would miss it." },
        action: { label: "Click Delete", icon: "play", run: (s) => s.go("del") },
        after: (s) => `Opened: ${s.res.opened}. Deleted: ${s.res.deleted}. Analytics saw it: ${s.res.tracked ? "yes" : "no"}.`,
      },
      {
        say: "Fix B: the row's own listener ignores clicks that came from the delete button.", enter: (s) => { s.picker.hidden = true; s.v("closest"); },
        guess: { q: "With fix B, does the tracking listener see the Delete click?", options: ["Yes", "No"], answer: 0, why: "The click travels all the way up. Only the row decides to ignore it. This is why the check in the parent is usually the better fix." },
        action: { label: "Click Delete", icon: "play", run: (s) => s.go("del") },
        after: (s) => `Opened: ${s.res.opened}. Deleted: ${s.res.deleted}. Analytics saw it: ${s.res.tracked ? "yes" : "no"}.`,
      },
      { say: "Free play: pick a version, then click Delete or the row text. Does the row text still open the details?", enter: (s) => { s.picker.hidden = false; s.v("closest"); } },
    ],
    takeaway: "Prefer a check in the parent (does this click come from the delete button?) over stopPropagation(), because stopping the click hides it from analytics and from outside-click code that listens in the bubble phase.",
    check: { q: "Which fix keeps the click visible to listeners on document?", options: ["stopPropagation() in the delete listener", "A closest() check in the row's listener", "Both of them"], answer: 1, why: ["That fix hides the click from everything above.", "Yes. The click is not stopped.", "Only the closest() check keeps it."] },
  });
})();
