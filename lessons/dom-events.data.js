/* Data and real-DOM helpers for "DOM and events" (the single source of truth for this lesson).
   Nothing here is typed by hand as a result. Every helper takes a `win` (the browser window, or a jsdom window in
   dev/dom-events.test.js), builds REAL elements, attaches REAL listeners and dispatches REAL events.
   The films, guided pages and the test all call the same functions, so they cannot disagree.
   Works in the browser (Book.parts["dom-events"].data) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["dom-events"] = root.Book.parts["dom-events"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  const nameOf = (win, n) => (n === win ? "window" : n && n.nodeType === 9 ? "document" : n ? n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") : "null");
  function el(d, tag, attrs, ...kids) {
    const e = d.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) (k === "text" ? (e.textContent = v) : e.setAttribute(k, v));
    kids.forEach((k) => e.append(k));
    return e;
  }
  /* Count the listeners a demo adds to one node (a real count of real addEventListener calls). */
  function counted(node, tally) {
    const add = node.addEventListener.bind(node);
    node.addEventListener = (...a) => { tally.added++; return add(...a); };
    return node;
  }

  /* ---------- 1. The lab: one list row with a button (and a label inside it) and a checkbox ---------- */
  function buildLab(win, parent) {
    const d = win.document;
    const ico = el(d, "span", { id: "ico", text: "Delete" });
    const btn = el(d, "button", { id: "del", type: "button" }, ico);
    const chk = el(d, "input", { id: "done", type: "checkbox", "aria-label": "done" });
    const li = el(d, "li", { id: "row" }, btn, chk);
    const ul = el(d, "ul", { id: "list", hidden: "" }, li);
    parent.append(ul);
    return { ul, li, btn, ico, chk };
  }

  /* trace(): put a capture listener and a bubble listener on every stop, click the leaf, and record what each one saw.
     o.stop = { at, phase: "capture"|"bubble", fn: "stopPropagation"|"stopImmediatePropagation" }; o.prevent = name of the node
     whose bubble listener calls preventDefault(); o.second = name of a node that gets a second bubble listener. */
  function trace(win, lab, o = {}) {
    const d = win.document;
    const leaf = o.leaf === "chk" ? lab.chk : lab.ico;
    const stops = [win, d, d.documentElement, d.body, lab.ul, lab.li, ...(leaf === lab.chk ? [lab.chk] : [lab.btn, lab.ico])];
    const ctl = new win.AbortController();
    const signal = ctl.signal;
    const rec = [];
    let pathLen = 0;
    lab.chk.checked = false;
    stops.forEach((n) => {
      const at = nameOf(win, n);
      const run = (kind) => (e) => {
        if (!rec.length) pathLen = e.composedPath().length;
        rec.push({ at, kind, phase: e.eventPhase, target: nameOf(win, e.target), current: nameOf(win, e.currentTarget), prevented: e.defaultPrevented });
        if (o.stop && o.stop.at === at && kind !== "bubble2" && o.stop.phase === (kind === "capture" ? "capture" : "bubble")) e[o.stop.fn]();
        if (o.prevent === at && kind === "bubble") e.preventDefault();
      };
      n.addEventListener("click", run("capture"), { capture: true, signal });
      n.addEventListener("click", run("bubble"), { signal });
      if (o.second === at) n.addEventListener("click", run("bubble2"), { signal });
    });
    leaf.click();
    ctl.abort();
    return { rec, checked: lab.chk.checked, stops: stops.map((n) => nameOf(win, n)), extra: pathLen - stops.length };
  }
  /* The three runs the film draws. */
  const FILM_RUNS = {
    base: {},
    stop: { stop: { at: "li#row", phase: "bubble", fn: "stopPropagation" }, second: "li#row" },
    prevent: { leaf: "chk", prevent: "li#row" },
  };
  function filmRuns(win, parent) {
    const lab = buildLab(win, parent);
    const out = {};
    for (const [k, o] of Object.entries(FILM_RUNS)) out[k] = trace(win, lab, o);
    lab.ul.remove();
    return out;
  }
  /* Same idea for the "stop it halfway" page: each case is one trace, in the lab. */
  const STOP_CASES = {
    stopOnly: { stop: { at: "li#row", phase: "bubble", fn: "stopPropagation" }, second: "li#row" },
    stopNow: { stop: { at: "li#row", phase: "bubble", fn: "stopImmediatePropagation" }, second: "li#row" },
    stopCapture: { stop: { at: "body", phase: "capture", fn: "stopPropagation" } },
    prevent: { leaf: "chk", prevent: "li#row" },
    baseline: {},
  };

  /* ---------- 2. Three nested boxes (page 1): the visible boxes ARE the real elements ---------- */
  function nested(win, host, log) {
    const d = win.document;
    const btn = el(d, "button", { type: "button", class: "de-btn", text: "Button" });
    const mid = el(d, "div", { class: "de-box de-mid", "data-name": "middle box" }, btn);
    const outer = el(d, "div", { class: "de-box de-outer", "data-name": "outer box" }, mid);
    host.append(outer);
    let ctl = null;
    const names = new Map([[btn, "button"], [mid, "middle box"], [outer, "outer box"]]);
    const api = {
      outer, mid, btn,
      wire(captureOuter) {
        if (ctl) ctl.abort();
        ctl = new win.AbortController();
        const signal = ctl.signal;
        for (const n of [btn, mid]) n.addEventListener("click", () => log(names.get(n), n), { signal });
        outer.addEventListener("click", () => log("outer box", outer), { signal, capture: Boolean(captureOuter) });
      },
      stop() { if (ctl) ctl.abort(); },
    };
    api.wire(false);
    return api;
  }
  function nestedOrder(win, host, captureOuter) {
    const seen = [];
    const n = nested(win, host, (name) => seen.push(name));
    n.wire(captureOuter);
    n.btn.click();
    n.stop();
    n.outer.remove();
    return seen;
  }

  /* ---------- 3. target vs currentTarget (page 3) ---------- */
  function targetDemo(win, host, log) {
    const d = win.document;
    const ico = el(d, "span", { class: "de-ico", text: "Delete" });
    const btn = el(d, "button", { type: "button", class: "de-btn", id: "tdel" }, ico);
    const li = el(d, "li", { id: "trow" }, el(d, "span", { text: "Booking 1042 " }), btn);
    const ul = el(d, "ul", { id: "tlist", class: "de-tlist" }, li);
    host.append(ul);
    const ctl = new win.AbortController();
    let saved = null;
    ul.addEventListener("click", (e) => {
      saved = e;
      const hit = e.target.closest("button");
      log({ target: nameOf(win, e.target), current: nameOf(win, e.currentTarget), closest: hit ? nameOf(win, hit) : "null" });
    }, { signal: ctl.signal });
    return { ul, li, btn, ico, afterwards: () => (saved ? nameOf(win, saved.currentTarget) : "no event yet"), stop: () => ctl.abort() };
  }
  function targetRun(win, host, which) {
    const rows = [];
    const t = targetDemo(win, host, (r) => rows.push(r));
    t[which].click();
    const after = t.afterwards();
    t.stop();
    t.ul.remove();
    return { ...rows[0], after };
  }

  /* A saved event: inside a later listener on a parent it still shows the parent; only after the whole click is it null. */
  function savedEventRun(win, host) {
    const d = win.document;
    const btn = el(d, "button", { type: "button", id: "svb", text: "x" });
    const ul = el(d, "ul", { id: "svl" }, el(d, "li", {}, btn));
    host.append(ul);
    let saved = null, inParent = "";
    ul.addEventListener("click", () => { inParent = nameOf(win, saved.currentTarget); });
    btn.addEventListener("click", (e) => { saved = e; });
    btn.click();
    const after = nameOf(win, saved.currentTarget);
    ul.remove();
    return { inParent, after };
  }
  /* At the target: a capture listener added AFTER a normal one still runs first. */
  function atTargetOrder(win) {
    const b = el(win.document, "button", { type: "button" });
    const seen = [];
    b.addEventListener("click", () => seen.push("normal listener"));
    b.addEventListener("click", () => seen.push("capture listener"), true);
    b.click();
    return seen;
  }

  /* ---------- 4. Delegation (page 5) ---------- */
  function addRows(win, ul, from, to) {
    for (let i = from; i < to; i++) ul.append(el(win.document, "li", { "data-id": String(i), text: "Row " + i }));
  }
  /* one listener per row */
  function perRow(ul, hit, tally, signal) {
    for (const li of ul.children) counted(li, tally).addEventListener("click", () => hit(li), { signal });
  }
  /* one listener on the list; closest() finds the row; contains() keeps the match inside the list */
  function oneListener(ul, hit, tally, signal) {
    counted(ul, tally).addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (li && ul.contains(li)) hit(li);
    }, { signal });
  }
  function delegationRun(win, host, n) {
    const out = {};
    for (const mode of ["perRow", "oneListener"]) {
      const ul = el(win.document, "ul");
      host.append(ul);
      addRows(win, ul, 0, n);
      const tally = { added: 0 };
      const hits = [];
      const ctl = new win.AbortController();
      (mode === "perRow" ? perRow : oneListener)(ul, (li) => hits.push(li.dataset.id), tally, ctl.signal);
      addRows(win, ul, n, n + 1); // a row added later
      ul.children[0].click();
      ul.children[n].click();
      out[mode] = { listeners: tally.added, hits: hits.join(","), lateRowWorks: hits.includes(String(n)) };
      ctl.abort();
      ul.remove();
    }
    return out;
  }
  /* The trap: closest("li") can find an li OUTSIDE the container. */
  function escapeDemo(win, host) {
    const d = win.document;
    const gap = el(d, "p", { id: "gap", text: "A note inside the widget" });
    const li1 = el(d, "li", { id: "in1", text: "Inner row 1" });
    const inner = el(d, "ul", { id: "inner" }, li1);
    const widget = el(d, "div", { id: "widget", class: "de-widget" }, inner, gap);
    const outerLi = el(d, "li", { id: "outerRow" }, widget);
    const outer = el(d, "ul", { id: "outerList" }, outerLi);
    host.append(outer);
    const unsafe = [], safe = [];
    const ctl = new win.AbortController();
    widget.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) unsafe.push(li.id); }, { signal: ctl.signal });
    widget.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li && widget.contains(li)) safe.push(li.id); }, { signal: ctl.signal });
    return { outer, gap, li1, unsafe, safe, stop: () => ctl.abort() };
  }
  function escapeRun(win, host) {
    const e = escapeDemo(win, host);
    e.li1.click();
    const afterRow = { unsafe: e.unsafe.join(), safe: e.safe.join() };
    e.unsafe.length = 0; e.safe.length = 0;
    e.gap.click();
    const afterGap = { unsafe: e.unsafe.join() || "(nothing)", safe: e.safe.join() || "(nothing)" };
    e.stop(); e.outer.remove();
    return { afterRow, afterGap };
  }
  /* The trap: focus does not bubble. A capture listener, or focusin, sees it from a parent. */
  function focusRun(win, host, keep) {
    const d = win.document;
    const input = el(d, "input", { id: "fi", "aria-label": "name" });
    const form = el(d, "form", { id: "ff" }, input);
    host.append(form);
    const seen = [];
    const ctl = new win.AbortController();
    const add = (type, label, opt) => form.addEventListener(type, (e) => seen.push({ label, type, bubbles: e.bubbles, target: nameOf(win, e.target) }), { signal: ctl.signal, ...opt });
    add("focus", "focus (bubble listener)");
    add("focus", "focus (capture listener)", { capture: true });
    add("focusin", "focusin");
    input.focus({ preventScroll: true });
    input.blur();
    if (keep) seen.stop = () => { ctl.abort(); form.remove(); }; // the demo keeps the form on screen until the step changes
    else { ctl.abort(); form.remove(); }
    return seen;
  }

  /* ---------- 5. Hold-to-play keys: ONE source, many variants (guards switched on/off) ---------- */
  /* Each line has a guard id. A guard that is OFF swaps its lines for the naive version (the `off` text). */
  const PIANO = [
    { t: 'const KEYS = { KeyA: "C", KeyS: "D", KeyD: "E", KeyF: "F", KeyG: "G", KeyH: "A" };' },
    { t: "const down = new Map(); // note -> the inputs holding it" },
    { t: "" },
    { t: "function press(note, source) {" },
    { g: "merge", on: ["  const holders = down.get(note) ?? new Set();", "  const first = holders.size === 0;", "  down.set(note, holders.add(source));", "  if (first) onPress(note);"], off: ["  down.set(note, new Set([source]));", "  onPress(note);"] },
    { t: "}" },
    { g: "merge", on: ["function release(note, source) {", "  const holders = down.get(note);", "  if (!holders?.delete(source) || holders.size > 0) return;", "  down.delete(note);", "  onRelease(note);", "}"], off: ["function release(note) {", "  if (!down.delete(note)) return;", "  onRelease(note);", "}"] },
    { t: "" },
    { t: "for (const key of root.querySelectorAll(\"[data-note]\")) {" },
    { t: '  key.addEventListener("pointerdown", (e) => press(key.dataset.note, "pointer" + e.pointerId)@SIG);' },
    { g: "out", on: [], off: ['  key.addEventListener("pointerup", (e) => release(key.dataset.note, "pointer" + e.pointerId)@SIG);'] },
    { t: "}" },
    { g: "out", on: ["const letGo = (e) => {", '  for (const note of [...down.keys()]) release(note, "pointer" + e.pointerId);', "};", 'win.addEventListener("pointerup", letGo@SIG);', 'win.addEventListener("pointercancel", letGo@SIG);'], off: [] },
    { t: "" },
    { t: 'win.addEventListener("keydown", (e) => {' },
    { g: "edit", on: ["  if (isTyping(e.target)) return;"], off: [] },
    { t: "  const note = KEYS[e.code];" },
    { t: "  if (!note || e.ctrlKey || e.metaKey || e.altKey) return;" },
    { g: "repeat", on: ["  if (e.repeat) return;"], off: [] },
    { t: "  press(note, e.code);" },
    { t: "}@SIG);" },
    { t: 'win.addEventListener("keyup", (e) => {' },
    { t: "  const note = KEYS[e.code];" },
    { t: "  if (note) release(note, e.code);" },
    { t: "}@SIG);" },
    { g: "blur", on: ["", 'win.addEventListener("blur", () => {', "  for (const note of [...down.keys()]) { down.delete(note); onRelease(note); }", "}@SIG);"], off: [] },
    { g: "edit", on: ["", "const isTyping = (el) =>", '  el.isContentEditable === true || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);'], off: [] },
  ];
  const GUARDS = ["out", "merge", "repeat", "edit", "blur", "cleanup"];
  /* Lines for a variant. `off` is the list of guards that are switched OFF. Returns [{ text, guard }]. */
  function pianoLines(off = []) {
    const sig = off.includes("cleanup") ? "" : ", { signal }";
    const fix = (t) => t.replaceAll("@SIG", sig);
    const lines = [];
    for (const row of PIANO) {
      if (row.t != null) lines.push({ text: fix(row.t), guard: null });
      else (off.includes(row.g) ? row.off : row.on).forEach((t) => lines.push({ text: fix(t), guard: row.g, on: !off.includes(row.g) }));
    }
    return lines;
  }
  const pianoSource = (off = []) => pianoLines(off).map((l) => l.text).join("\n");
  /* Attach the piano to `root` (an element holding buttons with data-note). */
  function makePiano(win, root, opt) {
    const fn = new Function("root", "win", "signal", "onPress", "onRelease", pianoSource(opt.off || []));
    fn(root, win, opt.signal, opt.onPress || (() => {}), opt.onRelease || (() => {}));
  }
  const NOTES = ["C", "D", "E", "F", "G", "A"];
  function buildKeys(d, host) {
    const keys = NOTES.map((n, i) => el(d, "button", { type: "button", "aria-pressed": "false", class: "de-key", "data-note": n, "aria-label": "Key " + n + " (keyboard: " + "ASDFGH"[i] + ")" }, el(d, "span", { text: n })));
    const field = el(d, "input", { class: "de-field", type: "text", "aria-label": "Type here to test", placeholder: "Type here" });
    const box = el(d, "div", { class: "de-piano" }, ...keys);
    host.append(box, field);
    return { box, keys, field };
  }
  /* A rig: a piano plus helpers that dispatch real pointer and keyboard events.
     opt.doc = the document that owns the elements; opt.evWin = what the piano calls "win" (the real window, or an
     isolated document for hidden runs, so a hidden run cannot press keys on a visible piano). */
  function pianoRig(win, host, off, opt = {}) {
    const d = opt.doc || win.document;
    const evWin = opt.evWin || win;
    const ui = buildKeys(d, host);
    const key = (n) => ui.keys[NOTES.indexOf(n)];
    const ctl = new win.AbortController(); // the signal the piano code itself uses (the "cleanup" guard)
    const life = new win.AbortController(); // a safety net for the demo: when the page leaves, every listener goes, even in the versions that "forget" cleanup
    /* the piano code gets this scope as `win`; each listener ends when the code's own signal aborts OR the demo's life ends */
    const scope = {
      addEventListener(type, fn, o = {}) {
        const c = new win.AbortController();
        life.signal.addEventListener("abort", () => c.abort(), { once: true });
        if (o.signal) { if (o.signal.aborted) return; o.signal.addEventListener("abort", () => c.abort(), { once: true }); }
        evWin.addEventListener(type, fn, { ...o, signal: c.signal });
      },
    };
    const state = { pressed: new Set(), presses: 0 };
    makePiano(scope, ui.box, { off, signal: ctl.signal, onPress: (n) => { state.pressed.add(n); state.presses++; key(n).setAttribute("aria-pressed", "true"); if (opt.onPress) opt.onPress(n); }, onRelease: (n) => { state.pressed.delete(n); key(n).setAttribute("aria-pressed", "false"); if (opt.onRelease) opt.onRelease(n); } });
    const ptr = (type, target, id = 1) => target.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: "mouse", button: 0 }));
    const kb = (type, code, o = {}) => (o.target || d.body).dispatchEvent(new win.KeyboardEvent(type, { bubbles: true, cancelable: true, code, repeat: Boolean(o.repeat), ctrlKey: Boolean(o.ctrl) }));
    const done = () => { ctl.abort(); life.abort(); ui.box.remove(); ui.field.remove(); };
    return { ...ui, ctl, life, state, key, ptr, kb, done, d, win, evWin, pressedList: () => [...state.pressed].join("") || "(none)" };
  }
  /* One scenario per guard: what the keys look like at the end, with the guard switched ON and OFF. */
  const SCENARIOS = {
    out: { name: "Release outside the key", run: (r) => { r.ptr("pointerdown", r.key("C")); r.ptr("pointerup", r.d.body); } },
    repeat: { name: "Auto-repeat", run: (r) => { r.kb("keydown", "KeyA"); for (let i = 0; i < 3; i++) r.kb("keydown", "KeyA", { repeat: true }); } },
    merge: { name: "Mouse and keyboard together", run: (r) => { r.ptr("pointerdown", r.key("C")); r.kb("keydown", "KeyA"); r.ptr("pointerup", r.key("C")); } },
    edit: { name: "Typing in a field", run: (r) => { r.kb("keydown", "KeyA", { target: r.field }); } },
    blur: { name: "Window loses focus", run: (r) => { r.kb("keydown", "KeyA"); r.evWin.dispatchEvent(new r.win.Event("blur")); } },
    cleanup: { name: "Cleanup", run: (r) => { r.ctl.abort(); r.kb("keydown", "KeyA"); } },
  };
  /* The order the page builds the guards in (repeat before merge, so that repeat still matters when it is added). */
  const ORDER = ["out", "repeat", "merge", "edit", "blur", "cleanup"];
  /* Run a scenario in an isolated document with the given guards OFF. Returns what is left pressed and how many presses were reported. */
  function pianoScenario(win, id, off) {
    const iso = win.document.implementation.createHTMLDocument("");
    const r = pianoRig(win, iso.body, off, { doc: iso, evWin: iso });
    SCENARIOS[id].run(r);
    const res = { pressed: r.pressedList(), presses: r.state.presses };
    r.done();
    return res;
  }

  /* ---------- 6. A long-press drag, as a small model (Speako idea; not Speako's file) ---------- */
  const LONGPRESS = [
    "function longPress(tile, { holdMs = 250, tolerance = 6, hit, onArm, onDrop, onCancel, signal }) {",
    '  tile.addEventListener("pointerdown", (down) => {',
    '    if (down.pointerType === "mouse") return; // mouse uses the normal drag',
    "    let armed = false;",
    "    const done = new AbortController();",
    "    const timer = setTimeout(() => { armed = true; onArm(); }, holdMs);",
    "    const end = () => { clearTimeout(timer); done.abort(); };",
    '    tile.addEventListener("pointermove", (m) => {',
    "      const moved = Math.hypot(m.clientX - down.clientX, m.clientY - down.clientY);",
    '      if (!armed && moved > tolerance) { end(); onCancel("scroll"); }',
    "    }, { signal: done.signal });",
    '    tile.addEventListener("pointerup", (up) => {',
    "      end();",
    "      if (armed) onDrop(hit(up.clientX, up.clientY));",
    '      else onCancel("tap");',
    "    }, { signal: done.signal });",
    "  }, { signal });",
    "}",
  ];
  const LONGPRESS_SRC = LONGPRESS.join("\n");
  /* kind: "hold" (stay 300 ms, then lift over the zone), "scroll" (move 12 px at once), "tap" (lift at once) */
  async function longPressRun(win, host, kind, hit, parts = {}) {
    const d = win.document;
    const tile = parts.tile || el(d, "div", { class: "de-tile", text: "Booking tile" });
    const zone = parts.zone || el(d, "div", { class: "de-zone", id: "zone", text: "Drop zone" });
    if (!parts.tile) host.append(tile, zone);
    const mid = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const from = mid(tile), to = mid(zone);
    const ctl = new win.AbortController();
    const log = [];
    new Function("tile", "opt", "AbortController", LONGPRESS_SRC + "\nlongPress(tile, opt);")(tile, { hit, signal: ctl.signal, onArm: () => log.push("armed (ghost appears)"), onDrop: (t) => log.push("dropped on " + t), onCancel: (why) => log.push("cancelled: " + why) }, win.AbortController);
    const ev = (type, x, y) => tile.dispatchEvent(new win.PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "touch", clientX: x, clientY: y }));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    ev("pointerdown", from.x, from.y);
    if (kind === "hold") { await wait(300); ev("pointerup", to.x, to.y); }
    else if (kind === "scroll") { await wait(20); ev("pointermove", from.x, from.y + 12); await wait(300); ev("pointerup", from.x, from.y + 12); }
    else ev("pointerup", from.x, from.y);
    ctl.abort();
    if (!parts.tile) { tile.remove(); zone.remove(); }
    return log;
  }

  /* ---------- 7. The ticket: a delete button inside a clickable row ---------- */
  const TICKET = {
    bug: 'row.addEventListener("click", () => openDetails());\ndel.addEventListener("click", () => deleteRow());',
    stop: 'row.addEventListener("click", () => openDetails());\ndel.addEventListener("click", (e) => {\n  e.stopPropagation();\n  deleteRow();\n});',
    closest: 'row.addEventListener("click", (e) => {\n  if (e.target.closest("button.delete")) return;\n  openDetails();\n});\ndel.addEventListener("click", () => deleteRow());',
  };
  /* A real row on the page: the reader (or a test) clicks the real elements. */
  function ticketBuild(win, host, variant, onChange) {
    const d = win.document;
    const text = el(d, "span", { class: "de-rtxt", text: "Booking 1042 " });
    const del = el(d, "button", { type: "button", class: "delete de-btn", text: "Delete" });
    const row = el(d, "li", { id: "r1", class: "de-ticketrow" }, text, del);
    const list = el(d, "ul", { class: "de-tlist" }, row);
    host.append(list);
    const state = { opened: false, deleted: false, tracked: 0 };
    const ctl = new win.AbortController();
    const bump = () => { if (onChange) onChange(state); };
    d.addEventListener("click", (e) => { if (list.contains(e.target)) { state.tracked++; bump(); } }, { signal: ctl.signal });
    new Function("row", "del", "openDetails", "deleteRow", TICKET[variant])(row, del, () => { state.opened = true; bump(); }, () => { state.deleted = true; bump(); });
    return { list, row, text, del, state, ctl, stop: () => { ctl.abort(); list.remove(); } };
  }
  function ticketRun(win, host, variant, clickWhat) {
    const t = ticketBuild(win, host, variant);
    (clickWhat === "text" ? t.text : t.del).click();
    const s = { ...t.state };
    t.stop();
    return s;
  }

  /* ---------- 8. The runnable: write on(root, type, selector, handler) ---------- */
  const ON_STARTER = [
    "function on(root, type, selector, handler) {",
    "  // TODO: add ONE listener on root (not on every child).",
    "  // When it fires, find the element that matches selector, starting at event.target.",
    "  // Call handler(event, matchedElement), but only if the match is inside root.",
    "  // Return a function that removes the listener.",
    "}",
  ].join("\n");
  const ON_SOLUTION = [
    "function on(root, type, selector, handler) {",
    "  const listener = (event) => {",
    "    const match = event.target.closest?.(selector);",
    "    if (match && match !== root && root.contains(match)) handler(event, match);",
    "  };",
    "  root.addEventListener(type, listener);",
    "  return () => root.removeEventListener(type, listener);",
    "}",
  ].join("\n");
  const ON_TESTS = [
    "// ---- checks (they run your function for real) ----",
    'const click = (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));',
    "function setup() {",
    '  const outside = document.createElement("ul"); // an li that is OUTSIDE the root',
    "  outside.innerHTML = '<li id=\"out\"><div id=\"root\"><ul><li id=\"a\"><span id=\"s\">A</span></li><li id=\"b\">B</li></ul><p id=\"gap\">gap</p></div></li>';",
    "  return { q: (id) => outside.querySelector(\"#\" + id), root: outside.querySelector(\"#root\"), hits: [] };",
    "}",
    "const results = [];",
    "const check = (name, fn) => {",
    "  try { const got = fn(); results.push({ name, ok: got.ok, got: got.got }); }",
    "  catch (e) { results.push({ name, ok: false, got: \"error: \" + e.message }); }",
    "};",
    'check("a click on li#a calls handler(event, li#a)", () => { const s = setup(); on(s.root, "click", "li", (e, m) => s.hits.push(m.id)); click(s.q("a")); return { ok: s.hits.join() === "a", got: "handler got " + (s.hits.join() || "nothing") }; });',
    'check("a click on the span INSIDE li#a still gives li#a", () => { const s = setup(); on(s.root, "click", "li", (e, m) => s.hits.push(e.target.id + ">" + m.id)); click(s.q("s")); return { ok: s.hits.join() === "s>a", got: "target>match: " + (s.hits.join() || "nothing") }; });',
    'check("a click on the gap does nothing (the only li above it is outside root)", () => { const s = setup(); on(s.root, "click", "li", (e, m) => s.hits.push(m.id)); click(s.q("gap")); return { ok: s.hits.length === 0, got: s.hits.length ? "handler got " + s.hits.join() : "no call" }; });',
    'check("a row added later works", () => { const s = setup(); on(s.root, "click", "li", (e, m) => s.hits.push(m.id)); const li = document.createElement("li"); li.id = "c"; s.q("b").after(li); click(li); return { ok: s.hits.join() === "c", got: "handler got " + (s.hits.join() || "nothing") }; });',
    'check("the function you return removes the listener", () => { const s = setup(); const off = on(s.root, "click", "li", (e, m) => s.hits.push(m.id)); off(); click(s.q("a")); return { ok: s.hits.length === 0, got: s.hits.length + " calls after off()" }; });',
    'report("on", results);',
  ].join("\n");
  const onCode = (solved) => (solved ? ON_SOLUTION : ON_STARTER) + "\n\n" + ON_TESTS;
  /* Run the runnable's code with a given window (the test uses jsdom). */
  async function runOn(win, code) {
    const out = {};
    const fn = new Function("document", "MouseEvent", "report", "console", `return (async () => {\n${code}\n})()`);
    await fn(win.document, win.MouseEvent, (k, v) => { out[k] = v; }, { log() {} });
    return out.on;
  }

  /* ---------- 9. Small snippets: the code is what runs; `out` is what it prints (checked by the test in jsdom,
     and re-run live in the reader's browser when the page opens) ---------- */
  const SNIPPETS = {
    once: { code: 'const b = document.createElement("button");\nlet n = 0;\nb.addEventListener("click", () => { n += 1; }, { once: true });\nb.click();\nb.click();\nconsole.log(n);', out: ["1"] },
    abort: { code: 'const ctl = new AbortController();\nconst b = document.createElement("button");\nlet n = 0;\nb.addEventListener("click", () => { n += 1; }, { signal: ctl.signal });\nb.addEventListener("keydown", () => { n += 10; }, { signal: ctl.signal });\nb.click();\nctl.abort(); // removes both listeners\nb.click();\nb.dispatchEvent(new KeyboardEvent("keydown"));\nconsole.log(n);', out: ["1"] },
    removeSame: { code: 'const b = document.createElement("button");\nlet n = 0;\nb.addEventListener("click", () => { n += 1; });\nb.removeEventListener("click", () => { n += 1; }); // a NEW function: nothing is removed\nb.click();\nconsole.log(n);', out: ["1"] },
    custom: { code: 'const outer = document.createElement("div");\nconst inner = document.createElement("div");\nouter.append(inner);\nconst seen = [];\nouter.addEventListener("cart:add", (e) => seen.push("outer saw " + e.detail.id));\nouter.addEventListener("cart:add", (e) => seen.push("capture saw " + e.detail.id), true);\ninner.dispatchEvent(new CustomEvent("cart:add", { detail: { id: 7 } }));\ninner.dispatchEvent(new CustomEvent("cart:add", { detail: { id: 8 }, bubbles: true }));\nconsole.log(seen.join(" | "));', out: ["capture saw 7 | capture saw 8 | outer saw 8"] },
    passive: { code: 'const box = document.createElement("div");\nbox.addEventListener("wheel", (e) => e.preventDefault(), { passive: true });\nconst ev = new WheelEvent("wheel", { cancelable: true });\nbox.dispatchEvent(ev);\nconsole.log(ev.defaultPrevented);', out: ["false"] },
    notCancelable: { code: 'const box = document.createElement("div");\nbox.addEventListener("ping", (e) => e.preventDefault());\nconst plain = new Event("ping");\nconst cancelable = new Event("ping", { cancelable: true });\nbox.dispatchEvent(plain);\nbox.dispatchEvent(cancelable);\nconsole.log(plain.defaultPrevented, cancelable.defaultPrevented);', out: ["false true"] },
    corresponding: { code: 'function corresponding(rootA, nodeA, rootB) {\n  const path = []; // child index at each step, from nodeA up to rootA\n  for (let n = nodeA; n !== rootA; n = n.parentNode) {\n    if (!n) return null; // nodeA is not inside rootA\n    path.push(Array.prototype.indexOf.call(n.parentNode.children, n));\n  }\n  let node = rootB;\n  for (const i of path.reverse()) node = node?.children[i];\n  return node ?? null;\n}\nconst make = (word) => { const d = document.createElement("div"); d.innerHTML = `<p>One</p><ul><li>x</li><li>${word}</li></ul>`; return d; };\nconst a = make("y"), b = make("Y-in-page-B");\nconst target = a.querySelector("ul").children[1];\nconsole.log(corresponding(a, target, b).textContent);\nconsole.log(corresponding(a, target, document.createElement("div")));', out: ["Y-in-page-B", "null"] },
    angles: { code: 'function handAngles(date) {\n  const s = date.getSeconds(), m = date.getMinutes(), h = date.getHours() % 12;\n  return { second: s * 6, minute: m * 6 + s / 10, hour: h * 30 + m / 2 };\n}\nconsole.log(JSON.stringify(handAngles(new Date(2026, 0, 1, 3, 30, 0))));\nconsole.log(JSON.stringify(handAngles(new Date(2026, 0, 1, 21, 15, 30))));', out: ['{"second":0,"minute":180,"hour":105}', '{"second":180,"minute":93,"hour":277.5}'] },
    focus: { code: 'const form = document.createElement("form");\nconst input = document.createElement("input");\nform.append(input);\ndocument.body.append(form);\nconst seen = [];\nform.addEventListener("focus", () => seen.push("focus"));\nform.addEventListener("focus", () => seen.push("focus (capture)"), true);\nform.addEventListener("focusin", () => seen.push("focusin"));\ninput.focus({ preventScroll: true });\nconsole.log(seen.sort().join(", "));\nform.remove();', out: ["focus (capture), focusin"] },
    shadow: { code: 'const host = document.createElement("div");\nconst root = host.attachShadow({ mode: "open" });\nconst inner = document.createElement("span");\nroot.append(inner);\nconst seen = [];\nhost.addEventListener("ping", (e) => seen.push("host heard it, target is " + e.target.tagName.toLowerCase()));\ninner.dispatchEvent(new Event("ping", { bubbles: true }));\ninner.dispatchEvent(new Event("ping", { bubbles: true, composed: true }));\nconsole.log(seen.join(" | "));', out: ["host heard it, target is div"] },
    emitter: { code: 'const bus = new EventTarget();\nconst seen = [];\nconst ctl = new AbortController();\nbus.addEventListener("saved", (e) => seen.push(e.detail), { signal: ctl.signal });\nbus.dispatchEvent(new CustomEvent("saved", { detail: "first" }));\nctl.abort();\nbus.dispatchEvent(new CustomEvent("saved", { detail: "second" }));\nconsole.log(seen.join());', out: ["first"] },
  };
  const SNIPPET_GLOBALS = ["document", "window", "console", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "WheelEvent", "AbortController", "EventTarget", "Date"];
  function runSnippet(win, sn) {
    const out = [];
    const con = { log: (...a) => out.push(a.map(String).join(" ")) };
    const env = { ...Object.fromEntries(SNIPPET_GLOBALS.map((k) => [k, win[k] || (typeof globalThis !== "undefined" ? globalThis[k] : undefined)])), console: con };
    try { new Function(...SNIPPET_GLOBALS, sn.code)(...SNIPPET_GLOBALS.map((k) => env[k])); } catch (e) { return { out, error: e.name + ": " + e.message }; }
    return { out };
  }

  /* ---------- 10. Film timing: one rule, used by the film and the test ---------- */
  const frameSecs = (text) => Math.max(2.5, 1 + text.split(/\s+/).length / 2.6);

  return {
    nameOf, buildLab, trace, filmRuns, FILM_RUNS, STOP_CASES,
    nested, nestedOrder, targetDemo, targetRun, savedEventRun, atTargetOrder,
    addRows, perRow, oneListener, delegationRun, escapeDemo, escapeRun, focusRun, counted,
    PIANO, GUARDS, ORDER, pianoLines, pianoSource, makePiano, NOTES, buildKeys, pianoRig, SCENARIOS, pianoScenario,
    LONGPRESS_SRC, longPressRun, TICKET, ticketBuild, ticketRun,
    ON_STARTER, ON_SOLUTION, ON_TESTS, onCode, runOn,
    SNIPPETS, runSnippet, frameSecs,
  };
});
