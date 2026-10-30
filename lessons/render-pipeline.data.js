/* Data for "Style, layout, paint, composite" (the single source of truth for this lesson, shared by the page and dev/render-pipeline.test.js).
   Node has no layout engine, so nothing here claims a timing. What lives here:
     1. the five stages and ONE table of changes -> which stages usually run again (sourced: web.dev "Rendering performance"),
     2. the read/write loops (real code strings) and a pretend-box meter that counts "forced layouts" (a MODEL: a read after a write),
     3. helpers that MEASURE in the reader's browser (the test runs them with a fake clock and fake boxes, only to check the logic),
     4. the "what forces layout?" puzzle table (sourced: Paul Irish's list),
     5. the runnable (write the fixed loop). Works in the browser (Book.parts["render-pipeline"].data) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["render-pipeline"] = root.Book.parts["render-pipeline"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* ---------- sources (all fetched and read on 2026-10-30) ---------- */
  const SRC = {
    rendering: "https://web.dev/articles/rendering-performance",
    compositor: "https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count",
    thrashing: "https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing",
    forces: "https://gist.github.com/paulirish/5d52fb081b3570c81e3a",
    crp: "https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path",
    willChange: "https://developer.mozilla.org/en-US/docs/Web/CSS/will-change",
    contain: "https://developer.mozilla.org/en-US/docs/Web/CSS/contain",
    contentVisibility: "https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility",
    resizeObserver: "https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver",
    intersectionObserver: "https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API",
    raf: "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame",
    renderingNG: "https://developer.chrome.com/docs/chromium/renderingng-architecture",
    devtools: "https://developer.chrome.com/docs/devtools/performance/reference",
    forcedReflow: "https://developer.chrome.com/docs/performance/insights/forced-reflow",
    animPerf: "https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance",
    inTheLoop: "https://www.youtube.com/watch?v=cCOL7MC4Pl0",
    learnPerf: "https://web.dev/learn/performance",
  };

  /* ---------- 1. Stages and the table of changes ---------- */
  const STAGES = [
    { id: "js", name: "JavaScript", job: "your code changes the page" },
    { id: "style", name: "Style", job: "which CSS rules apply to what" },
    { id: "layout", name: "Layout", job: "size and position" },
    { id: "paint", name: "Paint", job: "fill in the pixels" },
    { id: "composite", name: "Composite", job: "put the layers on screen" },
  ];
  const STAGE_IDS = STAGES.map((s) => s.id);
  /* web.dev, "Rendering performance": three paths through the pipeline. JavaScript is where the change starts, so it is not listed. */
  const PATHS = {
    layout: ["style", "layout", "paint", "composite"],
    paint: ["style", "paint", "composite"],
    composite: ["style", "composite"],
  };
  const FRAME_MS = Math.round((1000 / 60) * 10) / 10; // 16.7: web.dev says about 16.66 ms per frame at 60 Hz
  const CHANGES = [
    { id: "width", prop: "width", code: 'box.style.width = "200px";', kind: "layout", why: "A new width changes the size of the box, and may move its neighbours. The browser must work out the layout again." },
    { id: "height", prop: "height", code: 'box.style.height = "120px";', kind: "layout", why: "A new height changes the size of the box, and may push the boxes below it." },
    { id: "top", prop: "top", code: 'box.style.top = "40px";', kind: "layout", why: "top changes the position of the box. Position is what layout works out." },
    { id: "left", prop: "left", code: 'box.style.left = "40px";', kind: "layout", why: "left changes the position of the box. Position is what layout works out." },
    { id: "color", prop: "color", code: 'box.style.color = "tomato";', kind: "paint", why: "The text gets another color. Sizes and positions stay the same, so layout can be skipped. The pixels must be painted again." },
    { id: "background", prop: "background-image", code: 'box.style.backgroundImage = "url(sky.png)";', kind: "paint", why: "A new picture behind the box. Nothing moves or changes size, so only painting is needed." },
    { id: "shadow", prop: "box-shadow", code: 'box.style.boxShadow = "0 4px 12px black";', kind: "paint", why: "A shadow changes how pixels look, not where boxes are." },
    { id: "transform", prop: "transform", code: 'box.style.transform = "translateX(40px)";', kind: "composite", why: "The browser can often move the box's finished picture (its layer) without layout or paint, when the element has its own layer. This is the cheapest path." },
    { id: "opacity", prop: "opacity", code: "box.style.opacity = 0.5;", kind: "composite", why: "The browser can often blend the box's finished layer more or less see-through, without layout or paint, when the element has its own layer." },
  ];
  const stagesRun = (change) => PATHS[change.kind];
  const pathText = (ids) => ids.map((id) => STAGES.find((s) => s.id === id).name).join(" → ");
  const changeById = (id) => CHANGES.find((c) => c.id === id);
  /* The honest wording shown next to the table. */
  const HEDGE = "This is the usual path in Chromium, from web.dev. It is not a law: a browser may do more or less work, and transform and opacity are cheapest when the element has its own layer.";

  /* ---------- 2. The read/write loops, and a pretend box that counts forced layouts (a model) ---------- */
  /* The meter and the boxes are real code, shown in the runnable and run by the page and the test. */
  const METER_SRC = `function makeMeter(dirty = false) {
  return { reads: 0, writes: 0, forced: 0, dirty, ops: [] };
}
function fakeBoxes(n, meter) {
  return Array.from({ length: n }, (_, i) => {
    let height = 20;
    return {
      get offsetHeight() {
        const forced = meter.dirty; // a read after a write must measure again
        if (forced) meter.forced++;
        meter.dirty = false;
        meter.reads++;
        meter.ops.push({ t: "R", i, forced });
        return height;
      },
      style: {
        set height(v) { height = parseFloat(v); meter.writes++; meter.dirty = true; meter.ops.push({ t: "W", i }); },
        get height() { return height + "px"; },
      },
    };
  });
}`;
  const meterApi = new Function(`${METER_SRC}\nreturn { makeMeter, fakeBoxes };`)();
  const THRASH_CODE = `function thrash(boxes) {
  for (const box of boxes) {
    const h = box.offsetHeight;      // read: needs the layout to be fresh
    box.style.height = h + 1 + "px"; // write: makes the layout old again
  }
}`;
  const BATCH_CODE = `function batched(boxes) {
  const heights = boxes.map((box) => box.offsetHeight); // read everything first
  boxes.forEach((box, i) => {
    box.style.height = heights[i] + 1 + "px";           // then write everything
  });
}`;
  const LOOPS = {
    thrash: { name: "thrash", code: THRASH_CODE, title: "Read, write, read, write…", short: "Reads and writes mixed" },
    batched: { name: "batched", code: BATCH_CODE, title: "Read all, then write all", short: "All reads, then all writes" },
  };
  const loopFn = (key) => new Function(`${LOOPS[key].code}\nreturn ${LOOPS[key].name};`)();
  /* Run a loop on pretend boxes. Layout is clean when the loop starts (dirty = false). */
  function simulate(key, n, startDirty = false) {
    const meter = meterApi.makeMeter(startDirty);
    const boxes = meterApi.fakeBoxes(n, meter);
    loopFn(key)(boxes);
    return { ops: meter.ops, reads: meter.reads, writes: meter.writes, forced: meter.forced, heights: boxes.map((b) => b.style.height) };
  }
  /* Scroll listeners that run one after another when "something changed" (layout is old at the start). */
  const SCROLL_MODEL = [
    { id: "reads", title: "3 listeners that only read", ops: "RRR" },
    { id: "mixed", title: "3 listeners that each read, then write", ops: "RWRWRW" },
    { id: "batched", title: "The same work: all reads, then all writes", ops: "RRRWWW" },
  ].map((s) => {
    const meter = meterApi.makeMeter(true);
    const boxes = meterApi.fakeBoxes(3, meter);
    let nextRead = 0, nextWrite = 0; // reads and writes each walk through the three boxes in turn
    for (const c of s.ops) {
      if (c === "R") void boxes[nextRead++ % 3].offsetHeight;
      else boxes[nextWrite++ % 3].style.height = "21px";
    }
    return { ...s, forced: meter.forced };
  });

  /* ---------- 3. Live measuring (runs only on a click, in the reader's browser) ---------- */
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  /* Time both loops, in turns, until the cap is nearly used. The first pair is a warm-up when there is more than one. */
  function measureTiming(env) {
    const { boxes, reset, flush, now = () => performance.now(), capMs = 800, maxPairs = 5 } = env;
    const fns = { thrash: loopFn("thrash"), batched: loopFn("batched") };
    const runs = [];
    const t0 = now();
    let lastPair = 0;
    for (let k = 0; k < maxPairs; k++) {
      if (k > 0 && now() - t0 + lastPair > capMs) break;
      const start = now();
      const pair = {};
      for (const key of k % 2 === 0 ? ["thrash", "batched"] : ["batched", "thrash"]) {
        reset(); flush();
        const s = now();
        fns[key](boxes);
        flush(); // both pay for the one layout that is still waiting at the end
        pair[key] = now() - s;
      }
      lastPair = now() - start;
      runs.push(pair);
    }
    reset(); flush();
    const used = runs.length > 1 ? runs.slice(1) : runs;
    return { thrash: median(used.map((r) => r.thrash)), batched: median(used.map((r) => r.batched)), counted: used.length, total: runs.length, elapsed: now() - t0 };
  }
  const fmtMs = (n) => (n < 0.1 ? "under 0.1 ms" : (n >= 100 ? String(Math.round(n)) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + " ms");
  /* Plain sentences for a comparison of two durations; honest when the gap is small. fmt turns a number into text. */
  function compareSentences(nameA, a, nameB, b, extra, fmt = fmtMs) {
    const aSlower = a >= b;
    const [slowName, slow, fastName, fast] = aSlower ? [nameA, a, nameB, b] : [nameB, b, nameA, a];
    const ratio = fast > 0 ? slow / fast : Infinity;
    const r1 = Math.round(ratio * 10) / 10;
    const times = r1 >= 10 || Number.isInteger(r1) ? String(Math.round(r1)) : r1.toFixed(1);
    const out = [];
    if (ratio >= 2) out.push(`${slowName} took ${fmt(slow)}. ${fastName} took ${fmt(fast)}: about ${times} times faster.`);
    else if (ratio >= 1.2) out.push(`${slowName} took ${fmt(slow)}. ${fastName} took ${fmt(fast)}: a bit faster (${times} times).`);
    else out.push(`${slowName} took ${fmt(slow)}. ${fastName} took ${fmt(fast)}. The gap is small here.`);
    if (ratio < 1.2) out.push(extra || "That can be true: browsers are fast and this page is small. The gap grows with the size of the page and with the number of forced layouts.");
    return out;
  }
  function describeTiming(r) {
    const s = compareSentences("The mixed loop", r.thrash, "Read-all-then-write-all", r.batched);
    s.push(`The middle value of ${r.counted} run${r.counted === 1 ? "" : "s"}. Timings change a little each time you press the button.`);
    return s;
  }

  /* "top vs transform": two Web Animations, and a way to block the main thread. */
  const ANIM = { travel: 90, ms: 1400, busyMs: 800 };
  const animKeyframes = (kind) => (kind === "top"
    ? { top: ["0px", `${ANIM.travel}px`] }
    : { transform: ["translateY(0px)", `translateY(${ANIM.travel}px)`] });
  const animOptions = () => ({ duration: ANIM.ms, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
  const animCode = (kind) => `box.animate(\n  ${kind === "top" ? `{ top: ["0px", "${ANIM.travel}px"] }` : `{ transform: ["translateY(0px)", "translateY(${ANIM.travel}px)"] }`},\n  { duration: ${ANIM.ms}, iterations: Infinity, direction: "alternate", easing: "ease-in-out" }\n);`;
  const BUSY_CODE = `const end = performance.now() + ${ANIM.busyMs};\nwhile (performance.now() < end) {} // JavaScript keeps the main thread busy`;
  /* Block the thread for ms (never more than 900). Returns how long it really blocked. */
  function busy(ms, now = () => performance.now()) {
    const wait = Math.min(Math.max(0, ms), 900);
    const start = now();
    while (now() - start < wait) { /* busy on purpose */ }
    return now() - start;
  }
  /* The longest gap between two animation-frame timestamps, or null when fewer than two frames were seen. */
  function maxGap(stamps) {
    if (stamps.length < 2) return null;
    let g = 0;
    for (let i = 1; i < stamps.length; i++) g = Math.max(g, stamps[i] - stamps[i - 1]);
    return g;
  }

  /* ---------- 4. "What forces layout?" (source: Paul Irish's list, read 2026-10-30) ---------- */
  /* Names copied from the list. A read of one of these, when a write came before, makes the browser run layout now. */
  const GIST_LAYOUT_READS = ["offsetLeft", "offsetTop", "offsetWidth", "offsetHeight", "offsetParent", "clientLeft", "clientTop", "clientWidth", "clientHeight", "getClientRects", "getBoundingClientRect", "scrollWidth", "scrollHeight", "scrollLeft", "scrollTop", "scrollBy", "scrollTo", "scrollIntoView", "focus", "innerText"];
  /* getComputedStyle: layout is forced only when the asked property is one of these (or in a shadow tree, or with viewport media queries). */
  const GIST_COMPUTED_PROPS = ["height", "width", "top", "right", "bottom", "left", "margin", "padding", "transform", "transform-origin", "perspective-origin", "translate", "rotate", "scale", "grid", "grid-template", "grid-template-columns", "grid-template-rows"];
  const FORCE = [
    { id: "offsetTop", code: "const y = box.offsetTop;", member: "offsetTop", kind: "read", forces: true, why: "Yes. offsetTop is a position number, and the width just changed. The browser must run layout to give a correct answer.", read: (el) => el.offsetTop },
    { id: "cssColor", code: "const c = getComputedStyle(box).color;", member: "color", kind: "read", forces: false, why: "No layout. getComputedStyle can make the browser update styles, but a color does not depend on layout. In the list, layout is forced only for properties like height, width and top.", read: (el) => getComputedStyle(el).color },
    { id: "rect", code: "const r = box.getBoundingClientRect();", member: "getBoundingClientRect", kind: "read", forces: true, why: "Yes. The rectangle is a size and position, so the browser needs fresh layout before it can answer.", read: (el) => el.getBoundingClientRect().top },
    { id: "classList", code: 'box.classList.add("big");', member: "classList", kind: "write", forces: false, why: "No. This line is a write, not a question. It marks the styles as old, and the browser can wait to recalculate them.", read: (el) => el.classList.toggle("rp-flip") },
    { id: "cached", code: "const y = savedTop;", member: "savedTop", kind: "variable", forces: false, why: "No. savedTop is a plain number you saved earlier. Nothing asks the browser anything, so nothing is forced.", read: () => 0 },
    { id: "cssHeight", code: "const h = getComputedStyle(box).height;", member: "height", kind: "read", forces: true, why: "Yes. height is on the list of properties whose computed value needs layout.", read: (el) => getComputedStyle(el).height },
    { id: "scrollTop", code: "const s = list.scrollTop;", member: "scrollTop", kind: "read", forces: true, why: "Yes. Reading scrollTop is on the list. The scroll position depends on the size of the content.", read: (el) => el.scrollTop },
    { id: "clientWidth", code: "const w = box.clientWidth;", member: "clientWidth", kind: "read", forces: true, why: "Yes. clientWidth is a size, so the browser needs fresh layout.", read: (el) => el.clientWidth },
  ];
  /* Ask in this order in the guided page (a mix of yes and no). */
  const QUIZ = ["offsetTop", "cssColor", "rect", "classList", "cached"];
  const forceById = (id) => FORCE.find((f) => f.id === id);
  /* Time each probe right after a write that changes the layout. The mean of many rounds (a browser clock can be coarse, so one read can show 0);
     stops at the cap. The write gets a counter that goes up before EVERY timed read, so two writes in a row never set the same value
     (a browser ignores a write that changes nothing). */
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  function probeForces(env) {
    const { write, flush, el, items = FORCE, rounds = 24, capMs = 700, now = () => performance.now() } = env;
    const t0 = now();
    const times = Object.fromEntries(items.map((f) => [f.id, []]));
    let k = 0;
    outer: for (let r = 0; r < rounds; r++) {
      for (const f of items) {
        if (r > 1 && now() - t0 > capMs) break outer;
        write(k++); // a write that really changes the layout, outside the timing
        const s = now();
        f.read(el);
        times[f.id].push(now() - s);
        flush(); // bring layout up to date again, outside the timing
      }
    }
    return items.map((f) => ({ id: f.id, ms: mean(times[f.id].slice(1)), rounds: Math.max(0, times[f.id].length - 1) }));
  }

  /* "From your work": a CSS variable written on a parent vs opacity written on the one element that uses it.
     Each write is followed by reading the element's computed opacity, which makes the browser update styles now.
     This is a PROXY for the style work of one frame, not a frame trace. */
  function measureVarWrites(env) {
    const { parent, wings, now = () => performance.now(), iterations = 150, capMs = 600 } = env;
    const readBack = env.readBack || (() => getComputedStyle(wings).opacity);
    const variants = {
      variable: (v) => { parent.style.setProperty("--hover", String(v)); readBack(); },
      direct: (v) => { wings.style.opacity = String(v); readBack(); },
    };
    const per = { variable: [], direct: [] };
    const t0 = now();
    for (let pass = 0; pass < 4; pass++) {
      if (pass > 0 && now() - t0 > capMs) break;
      for (const key of pass % 2 === 0 ? ["variable", "direct"] : ["direct", "variable"]) {
        if (key === "variable") wings.style.opacity = ""; // once per pass, so the variable can show through; not a write per iteration
        const s = now();
        for (let i = 0; i < iterations; i++) variants[key](i % 2 ? 0.3 : 0.7);
        per[key].push(((now() - s) / iterations) * 1000); // microseconds per write
      }
    }
    wings.style.opacity = ""; parent.style.removeProperty("--hover");
    const use = (a) => (a.length > 1 ? a.slice(1) : a);
    return { variable: median(use(per.variable)), direct: median(use(per.direct)), passes: use(per.variable).length };
  }
  const fmtUs = (n) => (n >= 100 ? String(Math.round(n)) : n.toFixed(1)) + " µs";

  /* ---------- 5. The runnable: write the fixed loop ---------- */
  const FIX = {
    head: "function fixed(boxes) {\n",
    todo: "  // TODO: read every height first (box.offsetHeight),\n  // then write every height (box.style.height = ...).\n",
    body: '  const heights = boxes.map((box) => box.offsetHeight);\n  boxes.forEach((box, i) => {\n    box.style.height = heights[i] + 1 + "px";\n  });\n',
    tail: "}\n",
    harness: `${METER_SRC}

// --- the test (don't edit below)
const meter = makeMeter();
const boxes = fakeBoxes(6, meter); // six pretend boxes, each 20 px tall
fixed(boxes);
report("fixed", { reads: meter.reads, writes: meter.writes, forced: meter.forced, heights: boxes.map((b) => b.style.height) });`,
    checks: (r) => [
      { label: "every box is read once", ok: r.reads === 6, got: `${r.reads} read${r.reads === 1 ? "" : "s"}` },
      { label: "every box gets its new height (21px)", ok: r.writes === 6 && r.heights.every((x) => x === "21px"), got: `${r.writes} write${r.writes === 1 ? "" : "s"}, heights ${r.heights.join(" ")}` },
      { label: "no read comes after a write", ok: r.forced === 0 && r.reads > 0, got: `${r.forced} forced layout${r.forced === 1 ? "" : "s"}` },
    ],
  };
  FIX.solution = FIX.head + FIX.body + FIX.tail;
  FIX.starter = FIX.head + FIX.todo + FIX.tail;
  const fixCode = (solved) => `${solved ? FIX.solution : FIX.starter}\n${FIX.harness}\n`;
  async function runFix(code) {
    const results = {};
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFn("console", "report", code)({ log() {} }, (name, data) => { results[name] = data; });
    return results;
  }

  return {
    SRC, STAGES, STAGE_IDS, PATHS, FRAME_MS, CHANGES, HEDGE, stagesRun, pathText, changeById,
    METER_SRC, meterApi, LOOPS, loopFn, simulate, SCROLL_MODEL,
    median, mean, measureTiming, fmtMs, fmtUs, compareSentences, describeTiming,
    ANIM, animKeyframes, animOptions, animCode, BUSY_CODE, busy, maxGap,
    GIST_LAYOUT_READS, GIST_COMPUTED_PROPS, FORCE, QUIZ, forceById, probeForces, measureVarWrites,
    FIX, fixCode, runFix,
  };
});
