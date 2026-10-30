/* Lesson: Style, layout, paint, composite (Wave 3, Part C).
   Order: one frame, five stages (film) → which stages run again → why a read can be slow (model) → time it in your browser + write the fix →
   top vs transform with a busy main thread → what forces layout → tools that keep frames cheap → your work → on the job → interview → one sentence.
   Stage paths, loops, counts and puzzle answers come from render-pipeline.data.js (dev/render-pipeline.test.js checks them).
   Speed is not stated by hand: it is measured live in the reader's browser, on a click. Sourced facts are worded "usually, in Chromium". */
(function () {
  const { h, word, step, runnable, prereqs, svg: S } = Book;
  const V = Book.parts["render-pipeline"];
  const D = V.data;
  const SRC = D.SRC;

  /* ---------- Go deeper links (each URL was fetched and read; the CRP, vitals, learn-performance and In the Loop links are also in research/) ---------- */
  const L = {
    rendering: { title: "Rendering performance", url: SRC.rendering, type: "article", by: "web.dev" },
    compositor: { title: "Stick to compositor-only properties and manage layer count", url: SRC.compositor, type: "article", by: "web.dev" },
    thrashing: { title: "Avoid large, complex layouts and layout thrashing", url: SRC.thrashing, type: "article", by: "web.dev" },
    forces: { title: "What forces layout/reflow. The comprehensive list.", url: SRC.forces, type: "article", by: "Paul Irish" },
    crp: { title: "Critical rendering path", url: SRC.crp, type: "doc", by: "MDN" },
    renderingNG: { title: "RenderingNG architecture", url: SRC.renderingNG, type: "doc", by: "Chrome developers" },
    devtools: { title: "Performance panel reference", url: SRC.devtools, type: "doc", by: "Chrome DevTools" },
    forcedReflow: { title: "Forced reflow (performance insight)", url: SRC.forcedReflow, type: "doc", by: "Chrome DevTools" },
    animPerf: { title: "CSS and JavaScript animation performance", url: SRC.animPerf, type: "doc", by: "MDN" },
    willChange: { title: "will-change", url: SRC.willChange, type: "doc", by: "MDN" },
    contain: { title: "contain", url: SRC.contain, type: "doc", by: "MDN" },
    contentVisibility: { title: "content-visibility", url: SRC.contentVisibility, type: "doc", by: "MDN" },
    raf: { title: "requestAnimationFrame()", url: SRC.raf, type: "doc", by: "MDN" },
    resizeObserver: { title: "ResizeObserver", url: SRC.resizeObserver, type: "doc", by: "MDN" },
    intersectionObserver: { title: "Intersection Observer API", url: SRC.intersectionObserver, type: "doc", by: "MDN" },
    vitals: { title: "Web Vitals", url: "https://web.dev/articles/vitals", type: "doc", by: "web.dev" },
    learnPerf: { title: "Learn Performance", url: SRC.learnPerf, type: "course", by: "web.dev" },
    inTheLoop: { title: "In The Loop", url: SRC.inTheLoop, type: "video", by: "Jake Archibald" },
  };

  const note = (...kids) => h("p.rp-text", ...kids);
  const details = (summary, ...kids) => h("details.rp-sol", h("summary", summary), ...kids);

  /* A small picture for the hub cards: a thing with an arrow to what it makes cheaper. */
  function pic(left, right, caption) {
    const svg = S("svg", { viewBox: "0 0 300 86", class: "rp-pic", role: "img", "aria-label": `${left} leads to ${right}. ${caption}` });
    svg.append(
      S("rect", { x: 6, y: 8, width: 118, height: 36, rx: 9, class: "fl-ink" }), S("text", { x: 65, y: 31, "text-anchor": "middle", class: "fl-chip-inv", style: "font-size:12px" }, left),
      S("rect", { x: 176, y: 8, width: 118, height: 36, rx: 9, class: "fl-field" }), S("text", { x: 235, y: 31, "text-anchor": "middle", class: "fl-chip", style: "font-size:12px" }, right),
      S("path", { d: "M 126 26 H 168 m -6 -5 l 6 5 l -6 5", class: "rp-arrow" }),
      S("text", { x: 150, y: 72, "text-anchor": "middle", class: "fl-small", style: "font-size:12px" }, caption));
    return svg;
  }

  /* ---------- 02. A table of every change (from the same data as the guided page) ---------- */
  const KIND = { layout: "Layout path", paint: "Paint path", composite: "Composite path" };
  const changeTable = () => h("div.rp-table", D.CHANGES.map((c) => h("div.rp-trow." + c.kind, h("code", c.prop), h("span.rp-kind", KIND[c.kind]), h("span.rp-path", D.pathText(D.stagesRun(c))))));

  /* ---------- 04. The runnable: write the fixed loop ---------- */
  function explainFix(results) {
    const r = results.fixed;
    if (!r) return h("p.result-say", "The test did not report. Press Reset to get the original code back.");
    const checks = D.FIX.checks(r);
    const pass = checks.filter((c) => c.ok).length;
    const bad = checks.find((c) => !c.ok);
    const mixed = D.simulate("thrash", 6).forced;
    return Book.resultCard({
      title: "What happened",
      rows: [{ label: "The mixed loop from page 03", value: mixed, text: `${mixed} forced layouts` }, { label: "Your loop", value: r.forced, text: `${r.forced} forced layout${r.forced === 1 ? "" : "s"}` }],
      sentences: [pass === checks.length ? `All ${checks.length} checks pass. No read comes after a write.` : `${pass} of ${checks.length} checks pass. Next: ${bad.label} (your code gave: ${bad.got}). Fill in the TODO, then press Run again.`],
      note: "This counts forced layouts in a model: a read right after a write. The page before timed real boxes.",
    });
  }

  /* ---------- 07. Tools that keep frames cheap ---------- */
  const HUB = [
    { id: "transform", name: "transform and opacity", short: "usually skip Layout and Paint", w: "H", picture: () => pic("transform", "Style → Composite", "usually skips Layout and Paint"),
      problem: "Move, scale or fade something on every frame without making the browser measure and paint again.",
      use: "Animations and transitions: slide with translate, scale, fade. Use transform instead of top and left.",
      avoid: "Don't use it when the neighbours must make room: transform does not change how much space the box takes. It is also cheapest when the element has its own layer, and web.dev warns that each layer costs memory.",
      example: "// the cheap path, usually\nbox.animate({ transform: [\"translateX(0)\", \"translateX(200px)\"] }, { duration: 300 });\n// the costly path\nbox.animate({ left: [\"0px\", \"200px\"] }, { duration: 300 });", lang: "js" },
    { id: "willchange", name: "will-change", short: "a hint, used sparingly", w: "M", picture: () => pic("will-change", "own layer", "ready before the change"),
      problem: "Tell the browser an element is about to change, so it can get ready (for example, give the element its own layer).",
      use: "As a last resort for a slow animation you already measured. MDN suggests turning it on with script just before the change, and off after.",
      avoid: "Don't put it on many elements, and not \"just in case\". MDN warns that overuse can slow the page down, and web.dev says each layer needs memory and management. It can also create a stacking context and a containing block (MDN and the CSS spec), which can change how children are placed.",
      example: "box.addEventListener(\"pointerenter\", () => { box.style.willChange = \"transform\"; });\nbox.addEventListener(\"transitionend\", () => { box.style.willChange = \"auto\"; });", lang: "js" },
    { id: "contain", name: "contain", short: "limit the work to a box", w: "L", picture: () => pic("contain", "smaller job", "work stays inside the box"),
      problem: "Tell the browser that what happens inside a box stays inside it, so it can limit layout and paint work to that box.",
      use: "Self-contained pieces: a card in a long list, a comment, a widget. contain: content means layout, paint and style together.",
      avoid: "contain: paint means descendants are not shown outside the box (MDN). Don't use it on a box whose menu, tooltip or shadow must stick out.",
      example: ".card {\n  contain: content; /* layout paint style */\n}", lang: "js" },
    { id: "cv", name: "content-visibility", short: "skip work for off-screen parts", w: "M", picture: () => pic("off-screen", "skipped", "contents wait until needed"),
      problem: "A long page has many sections the reader cannot see yet, but the browser still prepares them.",
      use: "Long pages with many separate sections. With content-visibility: auto the browser skips the contents of a section while it is not relevant to the reader (MDN).",
      avoid: "Give skipped sections a placeholder size with contain-intrinsic-size, or the page can jump (MDN's example does this). MDN lists it as Baseline 2024, \"newly available\", so check support for your users.",
      example: "section {\n  content-visibility: auto;\n  contain-intrinsic-size: auto 500px;\n}", lang: "js" },
    { id: "batch", name: "Batch reads and writes", short: "reads first, then writes, in rAF", w: "H", picture: () => pic("reads, then writes", "one layout", "no read after a write"),
      problem: "A loop that reads a size and then writes a style forces layout again and again.",
      use: "Any code that measures and changes many elements. Do every read, then every write, inside requestAnimationFrame: MDN says that callback runs before the next repaint.",
      avoid: "Don't put must-run work in requestAnimationFrame: MDN says it is paused in background tabs. Batching also cannot help when each write truly depends on the result of the last read.",
      example: "let queued = false;\nfunction update() {\n  const heights = rows.map((row) => row.offsetHeight);   // all reads\n  rows.forEach((row, i) => { row.style.height = heights[i] + 1 + \"px\"; }); // all writes\n  queued = false;\n}\nlist.addEventListener(\"scroll\", () => {\n  if (!queued) { queued = true; requestAnimationFrame(update); }\n}, { passive: true });", lang: "js" },
    { id: "ro", name: "ResizeObserver", short: "watch a size, do not poll", w: "M", picture: () => pic("ResizeObserver", "size changed", "no timer, no polling"),
      problem: "You need to know when an element changes size. Polling with offsetWidth in a timer wastes work, can force layout when something changed, and can miss changes between polls.",
      use: "Charts, components that depend on their own width, virtual lists. MDN: it reports changes to an element's content or border box.",
      avoid: "Don't change the size of the observed element in a way that triggers the callback again. The browser reports \"ResizeObserver loop completed with undelivered notifications\" (MDN).",
      example: "const ro = new ResizeObserver((entries) => {\n  for (const entry of entries) chart.resize(entry.contentRect.width);\n});\nro.observe(container);", lang: "js" },
    { id: "io", name: "IntersectionObserver", short: "ask \"is it visible?\" without measuring", w: "M", picture: () => pic("IntersectionObserver", "tells you", "no rect reads on scroll"),
      problem: "A scroll handler that calls getBoundingClientRect to check visibility can cause layout work on every scroll.",
      use: "Lazy loading, infinite scroll, and parking work nobody can see (MDN lists these). The portfolio hero stops its render loop when it is off screen.",
      avoid: "Don't use it for an effect that must follow every pixel of scroll. It tells you when something crosses a line, not a smooth position.",
      example: "const io = new IntersectionObserver((entries) => {\n  for (const e of entries) e.target.classList.toggle(\"in-view\", e.isIntersecting);\n});\nrows.forEach((row) => io.observe(row));", lang: "js" },
  ];

  /* ---------- 08. From your work (excerpts are exact lines of scripts/hero-shader.mjs, read-only) ---------- */
  const SCROLL_EXCERPT = `// portfolio: scripts/hero-shader.mjs (lines 60-76, and line 402)
// Shared scroll dispatcher. Each shader block (hero, dragon, liberty) needs
// its \`rect\` refreshed on scroll, but 3 separate scroll listeners means 3
// forced layouts per frame once Lenis starts emitting synthetic scroll
// events at 60Hz. This batches them into one rAF tick.
const scrollSubs = [];
let scrollScheduled = false;
const flushScroll = () => {
  scrollScheduled = false;
  for (let i = 0; i < scrollSubs.length; i++) scrollSubs[i]();
};
window.addEventListener('scroll', () => {
  if (!scrollScheduled) {
    scrollScheduled = true;
    requestAnimationFrame(flushScroll);
  }
}, { passive: true });
const onScroll = (cb) => scrollSubs.push(cb);
// ...
onScroll(() => { stageRect = stage.getBoundingClientRect(); });`;
  const OPACITY_EXCERPT = `// portfolio: scripts/hero-shader.mjs (lines 521-540, inside the frame loop)
// Expose hover strength to CSS so the samurai wings fade with the reveal.
// Expose hover strength to the samurai-wings layer so it fades
// with the reveal. Previously we wrote \`--hover\` as a CSS custom
// property on .portrait-stage, and .samurai-wings read it via
// \`opacity: calc(1 - var(--hover))\`. But setProperty on a custom
// property invalidates every descendant's computed style in
// Chrome (custom properties inherit, so the engine can't prove
// nothing else reads it) — a ~15-descendant subtree recalc
// every frame was dropping us from 60 to ~40 fps.
// Writing opacity directly to the single consumer is
// compositor-only work; no cascade walk, no invalidation.
// The >0.005 gate skips no-op DOM writes when hov.t has
// settled (lerp asymptotes for many frames before hitting 0).
if (samuraiWings) {
  const wingsOpacity = 1 - hov.t;
  if (Math.abs(wingsOpacity - lastWingsOpacity) > 0.005) {
    lastWingsOpacity = wingsOpacity;
    samuraiWings.style.opacity = wingsOpacity.toFixed(3);
  }
}`;

  /* ---------- 09. On the job ---------- */
  const TICKET_CODE = `list.addEventListener("scroll", () => {
  for (const row of rows) {
    const top = row.getBoundingClientRect().top;   // read
    row.style.opacity = top < 80 ? 0.4 : 1;         // write
    row.style.height = top < 80 ? "56px" : "72px";  // write
  }
});`;

  /* ---------- 10. Interview questions: only the browser-rendering items in research/interview-questions.md ---------- */
  const IQ = [
    {
      q: "Diagnose two cases: a cold page load, and a browser asked to render ten million API records.",
      type: "debugging / system", level: "level not stated", source: { company: "Apple", year: "Jul 2026 (technical screen)", url: "https://prachub.com/interview-questions/diagnose-cold-load-and-massive-table-performance-in-a-web-app" },
      testing: "Measurement-driven performance reasoning. (PracHub lists several evaluation criteria, such as measuring first, cutting the critical path, memory cost, cancelling stale work and checking with real-user data. That list is the site's own, not an interviewer's rubric.)",
      answer: [
        h("p", "Start with measuring, not guessing. For the cold load, record a Performance trace or run Lighthouse with the cache off, and read the ", word("waterfall", "A chart of every file the page loads, showing when each one starts and ends."), ". For the big table, record a trace while it renders and look at scripting, style, layout and paint time, and at memory."),
        h("p", "Cold load: shorten the ", word("critical path", "The files and steps the browser must finish before it can draw the first screen."), ". CSS blocks rendering (MDN), so send less of it, and send only the JavaScript the first screen needs. Check the time to first byte (TTFB), turn on compression, and serve files from a CDN with good cache headers, so the next visit is faster."),
        h("p", "Ten million records: do not make ten million elements. In this lesson, every element can add style, layout and paint work, and each one costs memory. Decide who owns the work: the server filters, sorts, aggregates and pages the data. If the browser must receive a lot of data, stream it in chunks (for example NDJSON, one JSON record per line), and use a Web Worker to parse, sort and filter so the main thread stays free. Then show it with ", word("virtualization", "Render only the rows on screen, and swap them as the user scrolls."), ". With ten million rows, the scrollbar has to be mapped to a window of rows, because browsers limit how tall an element can be. Cancel old requests when the user changes a filter, and keep real table semantics and keyboard access for the rows you do show."),
        "Follow-up they may ask: how do you know it worked? Record the same trace with the same throttling, and then check real-user data, not only your own laptop.",
      ],
    },
    {
      q: "Client-side vs server-side rendering. And: what is an SPA?",
      type: "concept", level: "junior-ish", source: { company: "Redisolve", year: "Jun 2025", url: "https://dev.to/seenuvasan_p/day-18-my-frontend-interview-experience-at-redisolve-what-i-learned-179" },
      testing: "A screening baseline. (This question fits better in the lesson on SSR, SSG and hydration. Here is only the rendering-pipeline angle.)",
      answer: [
        "An SPA is one HTML page. JavaScript changes the DOM when the user moves around, without loading a new page.",
        "With client-side rendering the browser first gets a mostly empty page and JavaScript. It must run that code before the content can appear. With server-side rendering the server sends HTML that already has the content, so the browser can start the pipeline (style, layout, paint) on real content sooner. The page is still not interactive until its JavaScript has run.",
        "A senior follow-up is the trade-off: server rendering costs server work and needs hydration (attaching the JavaScript to the HTML), client rendering is simpler to host but waits for JavaScript. The SSR lesson goes deeper.",
      ],
    },
    {
      q: "Do you know Core Web Vitals? Describe them.",
      type: "concept", level: "level not stated", source: { company: "Yahoo (Taipei)", year: "Jan 2022 (old)", url: "https://www.jointaro.com/interviews/companies/yahoo/experiences/front-end-developer-taipei-january-1-2022-no-offer-positive-a7f9392e/" },
      testing: "Baseline performance vocabulary. This report is from 2022, so it is old: the set of metrics has changed since (see below). The Web Vitals lesson covers this in full.",
      answer: [
        "Today web.dev names three: Largest Contentful Paint (loading, good is 2.5 seconds or less), Interaction to Next Paint (interactivity, good is 200 ms or less) and Cumulative Layout Shift (visual stability, good is 0.1 or less). They are measured at the 75th percentile of real visits.",
        "In 2022 the interactivity metric was First Input Delay. web.dev says INP became a stable Core Web Vital in 2024, so a current answer should say INP.",
        "Link to this lesson: a busy main thread can delay the next paint after a click, and content that moves after it was first drawn is what layout shift measures.",
      ],
    },
  ];
  const PRACTICE = [
    { q: "What is the difference between reflow and repaint?", a: ["Reflow is layout running again: the browser works out sizes and positions. Repaint is paint running again: the browser fills in pixels. A change to width usually does both (Style, Layout, Paint, Composite). A change to color usually only repaints. A change to transform or opacity can usually skip both. Follow-up: say \"usually\", because browsers decide, and transform is cheapest when the element has its own layer."] },
    { q: "Why is animating transform better than animating top?", a: ["top is a position, so Layout must run on every frame, and Paint and Composite follow. transform can usually skip Layout and Paint, so only Style and Composite run (web.dev). In Chromium, a CSS or Web Animations animation of transform or opacity (not one driven by a JavaScript loop) can also keep moving on the compositor thread while the main thread is busy. Follow-up: transform does not change the space a box takes, so neighbours do not move."] },
    { q: "What is layout thrashing, and how do you fix it?", a: ["Layout thrashing is forced layouts again and again: a loop that writes a style and then reads a size, many times. Fix: do all the reads first, then all the writes. Often inside requestAnimationFrame. Follow-up: find it in a Performance recording; Chrome's performance insights can flag a forced reflow."] },
    { q: "When would you use will-change, and when not?", a: ["Only as a last resort for an animation you measured as slow, and turned on just before the change and off after. MDN warns that overusing it can make the page slower, and web.dev says each layer costs memory. Follow-up: on a low-memory device the cost of layers can be bigger than the gain."] },
    { q: "A page janks while scrolling. How do you find the cause?", a: ["Record a Performance trace while scrolling, with CPU throttling to match a mid-range phone. Look for long tasks, the rendering events (DevTools shows rendering activity in purple), and forced reflows in the insights. Then read the scroll handler: does it read geometry after writing? Fix the first cause you can prove, then record again with the same settings."] },
    { q: "Why use requestAnimationFrame for visual updates?", a: ["MDN: the callback runs before the next repaint, so your changes land in the frame that is about to be drawn. A setTimeout is not tied to frames. Follow-up: requestAnimationFrame is paused in background tabs, so do not use it for work that has to run while the tab is hidden."] },
  ];

  Book.registerLesson("render-pipeline", {
    mount(root) {
      root.append(
        prereqs([
          ["Frame", "One picture on your screen. Most screens show about 60 each second, so a frame gets about 16.7 ms."],
          ["Main thread", "The one thread that runs your JavaScript and most page work. While it is busy, clicks and drawing wait."],
          ["CSS property", "A style setting like width, color or transform. You can set it in a stylesheet or with JavaScript, like box.style.width."],
        ]),
        step({
          n: "01", title: "What does the browser do in one frame?",
          lines: [
            "Most screens show a new picture, called a frame, about 60 times each second.",
            ["A frame can go through five stages. The last one is done by the ", word("compositor thread", "In Chromium, a helper thread that moves and blends finished layers. It is separate from the main thread."), "."],
            ["The facts here are for ", word("Chromium", "The open-source engine behind Chrome and Edge. Other browsers have their own engines."), ". Press play."],
          ],
          demo: h("div.demo-stack", V.stagesFilm(),
            note(h("b", "Honest note: "), "this is a simple picture of the pipeline, taken from web.dev. A real engine has more steps, and it spreads work over several threads.")),
          links: [L.rendering, L.crp, L.renderingNG],
        }),
        step({
          n: "02", title: "Which stages run again?",
          lines: [
            "Change something with JavaScript and the browser runs some stages again, but often not all of them.",
            "Guess which stages run for three changes.",
            ["Later you will see the word ", word("layer", "A finished picture of part of the page that can be moved or blended on its own."), ". Press Next under the picture."],
          ],
          demo: h("div.demo-stack", V.whichStages(),
            details("Show the table after your guesses", changeTable()),
            note(h("b", "Source and limits: "), "the three paths are from web.dev, Rendering performance. ", D.HEDGE)),
          links: [L.rendering, L.compositor, L.learnPerf],
        }),
        step({
          n: "03", title: "Why can a read be slow?",
          lines: [
            ["The browser is lazy on purpose. It measures once, before it paints, unless your code forces it to measure earlier. That is a ", word("forced layout", "Layout run at once because your code asked for a size right after a change. Also called forced reflow."), "."],
            "Read a size right after a change, and the browser must measure now.",
            "Press Next under the picture.",
          ],
          demo: h("div.demo-stack", V.thrashModel(),
            note(h("b", "Model, not a stopwatch: "), "the counts follow one rule: a read right after a write is forced. The rule is from web.dev (forced synchronous layout). The next page times real boxes.")),
          links: [L.thrashing, L.forcedReflow, L.forces],
        }),
        step({
          n: "04", title: "Time it in your browser, then fix it",
          lines: [
            "Now a stopwatch: 200 real boxes, two loops, and your browser's clock.",
            "The gap can be big or small. It depends on your browser, your computer and the page.",
            "After that, write the fixed loop yourself.",
          ],
          demo: h("div.demo-stack", V.thrashLive(),
            runnable({ title: "Write the fixed loop", code: D.fixCode(false), rows: 34, explain: explainFix }),
            details("Show one solution", Book.code(D.FIX.solution)),
            note(h("b", "In real code: "), "the same idea works with any read and write, for example measuring a row and then setting its style. Batching them, and running them in ", word("requestAnimationFrame", "A browser function that runs your code just before the next frame is drawn."), ", is one of the tools on page 07.")),
          links: [L.thrashing, L.forcedReflow],
        }),
        step({
          n: "05", title: "top or transform: who keeps moving?",
          lines: [
            ["Two boxes make the same trip, with the ", word("Web Animations API", "box.animate(...) starts a CSS-style animation from JavaScript."), ". One changes top, the other changes transform."],
            "Then JavaScript blocks the main thread, and you watch.",
            "The page freezes for 0.8 seconds, once, when you press the button.",
          ],
          demo: h("div.demo-stack", V.animLab(),
            note(h("b", "What is measured, and what is not: "), "the freeze is real and measured on your machine. What the transform box does during the freeze depends on your browser. The claim here is for Chromium, from the Chrome team's RenderingNG notes: a CSS or Web Animations animation of transform or opacity (not one driven by a JavaScript loop) can run on the compositor thread while the main thread is busy. Scrolling can also stay smooth, but only if the browser does not have to ask the main thread first. A wheel or touch listener that might call preventDefault makes it ask, and a passive listener promises it will not.")),
          links: [L.compositor, L.renderingNG, L.animPerf],
        }),
        step({
          n: "06", title: "What forces layout?",
          lines: [
            "Some lines of code make the browser run layout at once. Others do not.",
            "Guess five of them. Then time eight in your browser.",
            "The answers come from Paul Irish's list of what forces layout.",
          ],
          demo: h("div.demo-stack", V.forceQuiz(),
            note(h("b", "Limits: "), "the list is community work for Chromium and it changes over time. Its comments report differences, for example about window.innerHeight. The timing button is only a hint. When you must be sure, record a Performance trace and look for forced reflow.")),
          links: [L.forces, L.thrashing, L.devtools],
        }),
        step({
          n: "07", title: "Tools to keep frames cheap",
          lines: ["Seven tools, one card each.", "Each card also says when not to use it."],
          demo: Book.hubSpoke({ title: "Tools to keep frames cheap", items: HUB }), links: [L.compositor, L.willChange, L.contentVisibility, L.raf, L.intersectionObserver],
        }),
        step({
          n: "08", title: "From your work: two frame-cost fixes in your portfolio",
          lines: [
            "The portfolio hero (scripts/hero-shader.mjs) batches scroll listeners into one animation frame.",
            ["It also writes opacity on one element, not a ", word("CSS variable", "A named value like --hover. You set it once, and other styles read it with var()."), " on its parent."],
            "Be ready to say which parts you wrote.",
          ],
          demo: h("div.demo-stack",
            h("div.rp-excerpt", h("span.label", "Portfolio: one scroll dispatcher (excerpt)"), Book.code(SCROLL_EXCERPT),
              note("The comment says three listeners meant three forced layouts. Count it with the rule from page 03 (model):"),
              V.scrollTable(),
              note("These callbacks only read. Reads one after another need one layout, so the saving can be smaller than the comment says. What costs more is a write between reads. Batching still runs the work once per frame, right before painting. Measure before you say a number in an interview.")),
            h("div.rp-excerpt", h("span.label", "Portfolio: opacity written directly (excerpt)"), Book.code(OPACITY_EXCERPT),
              note("The report adds will-change: opacity to that element, so it gets its own layer. web.dev says transform and opacity work best on their own layer."),
              note(h("b", "In plain words: "), word("cascade walk", "The browser checking every element below a parent to see what the change affects."), ", ", word("lerp", "Moving a number a small step toward its target on every frame."), " and ", word("rAF tick", "One run of the requestAnimationFrame callback, once per frame."), " are three terms in that comment. A CSS variable is ", word("inherited", "Passed down from a parent to all its children automatically."), ", so a write on the parent touches its whole ", word("subtree", "An element and everything inside it."), ".")),
            V.varLab(),
            note(h("b", "Honest note: "), "git names do not prove who wrote a line: in the local copy read for this page, blame shows the name Mina-Massoud on these lines and \"Claude\" on some lines nearby. The report's numbers, such as about 15 ms saved per frame, are AI-assisted estimates, and it says scroll performance was reported as \"looks good\" and not re-verified. Say what you wrote and how you measured.")),
          links: [L.rendering, L.compositor, L.intersectionObserver],
        }),
        step({
          n: "09", title: "On the job",
          lines: ["A ticket arrives. Read it, think about your steps, and then compare."],
          demo: Book.onTheJob({
            id: "PRACTICE-1", title: "Scrolling the bookings list is janky on a mid-range Android",
            context: "A practice ticket (not from a real tracker). A user says: “When I scroll the bookings list on my phone, it stutters. On the office laptop it is fine.” The list has a few hundred rows. A scroll handler fades and shrinks rows near the top.",
            symptoms: ["Scrolling stutters on a mid-range Android phone.", "The laptop looks fine.", "The scroll handler runs for every row on every scroll event."],
            code: TICKET_CODE,
            tasks: ["Prove where the time goes, with a recording.", "Fix it in a way you can explain.", "Show that it got better, with the same recording."],
            steps: [
              "Reproduce on the phone, or in DevTools with CPU throttling turned on to match a slower device. Record a Performance trace while scrolling. Do not guess first.",
              "Read the trace. Look for long tasks on the main thread. In the Performance panel, purple events are rendering work (style and layout). Chrome's performance insights include a \"Forced reflow\" insight: it describes JavaScript that asks for geometry after the DOM changed. Find the scroll handler in the trace.",
              "Name the cause. The handler reads getBoundingClientRect, then writes opacity and height, row after row. That is the loop from page 03: a read after a write, many times, and the height write also changes layout.",
              "Fix, step A: stop measuring on every scroll. If you only need \"is this row above the line?\", use an IntersectionObserver. If you must measure, read all the rects first, then write, inside requestAnimationFrame.",
              "Fix, step B: change what you animate. Fade with opacity and shrink with transform: scale (the row keeps its space). Changing height on every scroll event makes the browser run layout again. For a long list, content-visibility: auto or a windowed list also cuts the work (see the list lesson).",
              "Measure again with the same recording and the same throttling. Look at the Layout events, the long tasks and the forced reflow insight. Report what changed in your own numbers, from your own trace.",
            ],
          }),
          links: [L.devtools, L.forcedReflow, L.intersectionObserver],
        }),
        step({
          n: "10", title: "Real interview questions",
          lines: ["These were reported by real candidates. The company, date and link are on each card.", "Try each one out loud first, then open the answer."],
          demo: h("div.demo-stack",
            Book.interviewQuestions(IQ),
            h("span.rp-sub", "Practice questions (not from a report)"),
            Book.drill(PRACTICE)),
          links: [L.crp, L.vitals, L.learnPerf],
        }),
        step({
          n: "11", title: "In one sentence",
          lines: ["A frame can include JavaScript, Style, Layout, Paint and Composite. Cheap changes skip stages, and your code can force extra work."],
          demo: h("ol.rp-rule",
            h("li", h("span", h("b", "A change re-runs its stage and the stages after it"), ". Size and position start at Layout. Color starts at Paint.")),
            h("li", h("span", h("b", "transform and opacity can usually skip Layout and Paint"), ", in Chromium. Many layers use a lot of memory.")),
            h("li", h("span", h("b", "A read right after a write forces layout"), ". Read everything first, then write everything.")),
            h("li", h("span", h("b", "Measure before you fix"), ": record a Performance trace, and measure again the same way."))),
          links: [L.rendering, L.thrashing, L.inTheLoop],
        }),
      );
    },
  });
})();
