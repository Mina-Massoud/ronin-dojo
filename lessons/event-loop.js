/* Lesson: The event loop (Wave 1, the first frontend golden lesson).
   Order: freeze → predict → film → your turn → rendering → code → every kind of task → trade-offs → Anemone → job → interview.
   Every order, trace and film comes from the simulator (event-loop.sim.js), which dev/event-loop.test.js checks against real Node. */
(function () {
  const { h, word, step, runnable, prereqs, svg: S } = Book;
  const V = Book.parts["event-loop"];
  const Sim = V.sim;
  const PR = Sim.programs;
  const FRAME = Sim.FRAME_MS;

  /* ---------- Go deeper links (URLs from research/frontend-syllabus.md only; times are estimates) ---------- */
  const L = {
    roberts: { title: "What the heck is the event loop anyway?", url: "https://www.youtube.com/watch?v=8aGhZQkoFbQ", type: "video", by: "Philip Roberts", mins: 27 },
    loop: { title: "In The Loop", url: "https://www.youtube.com/watch?v=cCOL7MC4Pl0", type: "video", by: "Jake Archibald", mins: 36 },
    tmqs: { title: "Tasks, microtasks, queues and schedules", url: "https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/", type: "article", by: "Jake Archibald", mins: 15 },
    lydia: { title: "JavaScript Visualized: Promises & Async/Await", url: "https://dev.to/lydiahallie/javascript-visualized-promises-async-await-5gke", type: "article", by: "Lydia Hallie", mins: 8 },
    jsinfo: { title: "javascript.info", url: "https://javascript.info/", type: "doc", by: "javascript.info" },
    ydkjs: { title: "You Don't Know JS Yet", url: "https://github.com/getify/You-Dont-Know-JS", type: "book", by: "Kyle Simpson" },
    inp: { title: "Interaction to Next Paint (INP)", url: "https://web.dev/articles/inp", type: "doc", by: "web.dev" },
    vitals: { title: "Web Vitals", url: "https://web.dev/articles/vitals", type: "doc", by: "web.dev" },
    perf: { title: "Learn Performance", url: "https://web.dev/learn/performance", type: "course", by: "web.dev" },
    crp: { title: "Critical rendering path", url: "https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path", type: "doc", by: "MDN" },
  };

  /* ---------- small helpers ---------- */
  const codeOf = (prog) => Book.code(Sim.generate(PR[prog]).lines.join("\n"));
  const orderOf = (prog) => Sim.run(PR[prog]).console.join("  →  ");
  const programCard = (prog) => h("div.el-card", codeOf(prog), h("p.el-order", h("b", "Output: "), orderOf(prog)));

  /* A small picture of the loop: boxes in a row; the active one is filled. */
  function loopPic(labels, active, note) {
    const w = 300;
    const bw = (w - 20 - (labels.length - 1) * 14) / labels.length;
    const svg = S("svg", { viewBox: `0 0 ${w} 74`, role: "img", "aria-label": `${labels.join(", then ")}. Active: ${labels[active]}.` });
    labels.forEach((t, i) => {
      const x = 10 + i * (bw + 14);
      svg.append(S("rect", { x, y: 8, width: bw, height: 34, rx: 9, class: i === active ? "fl-ink" : "fl-field", stroke: "none" }));
      svg.append(S("text", { x: x + bw / 2, y: 29, "text-anchor": "middle", class: i === active ? "fl-chip-inv" : "fl-chip", style: "font-size:11.5px" }, t));
      if (i < labels.length - 1) svg.append(S("path", { d: `M ${x + bw + 3} 25 h 8 m -3 -3 l 3 3 l -3 3`, class: "fl-arc", style: "stroke-dasharray:none" }));
    });
    svg.append(S("text", { x: w / 2, y: 62, "text-anchor": "middle", class: "fl-small" }, note));
    return svg;
  }
  const LOOP = ["Task", "Microtasks", "Paint", "Idle"];
  const loop = (i, note) => () => loopPic(LOOP, i, note);

  /* ---------- 06. See it as code ---------- */
  const CODE = `
// report(name, numbers) shows the results below. This page provides it.
// Make the thread busy for ms milliseconds (a stand-in for real work).
function doWork(ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {}
}
const TOTAL_MS = 400;

// 1) One long loop. Nothing else can run until it ends.
let t0 = performance.now();
doWork(TOTAL_MS);
report("One long loop", { blocked: performance.now() - t0 });

// 2) The same work in 10 ms chunks. After each chunk, give the browser a turn.
const CHUNK_MS = 10;
let done = 0, longest = 0;
t0 = performance.now();
while (done < TOTAL_MS) {
  const s = performance.now();
  doWork(CHUNK_MS);
  longest = Math.max(longest, performance.now() - s);
  done += CHUNK_MS;
  // Wait 0 ms with a timer. This lets the browser paint and handle clicks before the next chunk.
  await new Promise((resolve) => setTimeout(resolve));
}
report("In chunks", { longest, total: performance.now() - t0, chunks: TOTAL_MS / CHUNK_MS });

// Try: change CHUNK_MS to 50 and press Run again.
`;
  function explainRun(r) {
    const a = r["One long loop"];
    const b = r["In chunks"];
    if (!a || !b) return h("p.result-say", "One of the two parts did not report. Press Reset to get the original code back.");
    const frames = Math.floor(a.blocked / FRAME);
    return Book.resultCard({
      title: "What happened",
      rows: [
        { label: "One long loop", value: a.blocked, text: `blocked ${Book.fmt(a.blocked)} ms` },
        { label: "In chunks", value: b.longest, text: `longest block ${Book.fmt(b.longest, 1)} ms` },
      ],
      sentences: [
        `Your loop blocked the main thread for ${Book.fmt(a.blocked)} ms. At 60 fps that's about ${Book.fmt(frames)} frames that couldn't be drawn.`,
        `Split into chunks, the longest block was ${Book.fmt(b.longest, 1)} ms. The browser could paint and answer clicks between the chunks.`,
      ],
      note: `The chunked version took longer in total (${Book.fmt(b.total)} ms, about ${b.chunks} turns of the loop). That is the trade: a little slower in total, but the page stays alive.`,
    });
  }

  /* ---------- 07. Every kind of task ---------- */
  const HUB = [
    { id: "timer", name: "setTimeout / setInterval", short: "task", w: "H", picture: loop(0, "a task, after the delay"),
      problem: "Run code later, after at least some time.", use: "A delay, a retry, a debounce (wait until the user stops typing), or to give the browser a turn between chunks of work.",
      avoid: "For smooth animation (use requestAnimationFrame). The delay is a minimum, not a promise: a busy thread makes it later.",
      note: "The HTML spec says: after 5 nested timers, the delay is at least 4 ms. Browsers may differ. This lesson's simulator ignores it.", lang: "js",
      example: "const id = setTimeout(() => save(draft), 300);\nclearTimeout(id); // cancel it if the user keeps typing" },
    { id: "events", name: "DOM events and I/O", short: "task", w: "H", picture: loop(0, "each event is its own task"),
      problem: "React to a click, a key press, or a network answer.", use: "addEventListener, and the callback of a finished request.",
      avoid: "Heavy work inside the handler. The next click and the next paint must wait for it (that is bad INP).", lang: "js",
      example: "button.addEventListener(\"click\", () => {\n  // keep this short: a click is a task\n  startSave();\n});" },
    { id: "then", name: "Promise.then / await", short: "microtask", w: "H", picture: loop(1, "right after the current code"),
      problem: "Run code as soon as the current code ends, in order.", use: "Chaining async work. After an await, the rest of the function is a microtask.",
      avoid: "Heavy work inside a then. It is still on the one thread, so it blocks paint. An endless chain blocks the page.", lang: "js",
      example: "async function load() {\n  const res = await fetch(\"/api/bookings\");\n  return res.json(); // runs later, as a microtask\n}" },
    { id: "qm", name: "queueMicrotask", short: "microtask", w: "M", picture: loop(1, "same queue as promises"),
      problem: "Run a small piece of code right after the current code, before any task or paint.", use: "To run something after the current synchronous code, in the same turn.",
      avoid: "Loops that add more microtasks. If the queue never gets empty, nothing else runs.", lang: "js",
      example: "queueMicrotask(() => {\n  console.log(\"after the current code\");\n});" },
    { id: "mo", name: "MutationObserver", short: "microtask", w: "L", picture: loop(1, "its callback is a microtask"),
      problem: "Know that the DOM changed, without polling.", use: "React to DOM changes made by code you don't own.",
      avoid: "Changing the DOM in the callback in a way that triggers the observer again.", lang: "js",
      example: "new MutationObserver((records) => {\n  console.log(records.length, \"changes\");\n}).observe(list, { childList: true });" },
    { id: "raf", name: "requestAnimationFrame", short: "before paint", w: "M", picture: loop(2, "just before each paint"),
      problem: "Run code once per frame, right before the browser paints.", use: "Animation, and anything that must match the screen (like Anemone's scroll loop).",
      avoid: "Work that is not about the next frame. It is paused in background tabs, and heavy work here drops frames.", lang: "js",
      example: "function frame(now) {\n  moveBox(now);\n  requestAnimationFrame(frame);\n}\nrequestAnimationFrame(frame);" },
    { id: "ric", name: "requestIdleCallback", short: "when idle", w: "L", picture: loop(3, "only when nothing else needs the thread"),
      problem: "Do low-priority work when the browser has nothing better to do.", use: "Analytics, prefetching, work that can wait.",
      avoid: "Work that must finish soon. Not in every browser (Safari has lagged). Check support before relying on it, and fall back to setTimeout.", lang: "js",
      example: "requestIdleCallback((deadline) => {\n  while (deadline.timeRemaining() > 0 && queue.length) run(queue.shift());\n});" },
    { id: "yield", name: "scheduler.yield / postTask", short: "task", w: "M", picture: loop(0, "give the loop a turn, then continue"),
      problem: "Split a long task and let the browser paint and answer clicks in between.", use: "Long loops in a click handler. Available in Chromium browsers (Chrome, Edge); other browsers are adding it. Test whether it exists first ('scheduler' in window && 'yield' in scheduler), else use setTimeout.",
      avoid: "Don't assume it exists. Test for it first.", lang: "js",
      example: "const yieldNow = () =>\n  \"scheduler\" in window && \"yield\" in scheduler ? scheduler.yield() : new Promise((r) => setTimeout(r));\n\nfor (const item of items) {\n  handle(item);\n  await yieldNow(); // paint and clicks can happen here\n}" },
    { id: "node", name: "Node: nextTick and setImmediate", short: "Node only", w: "M", picture: () => loopPic(["timers", "poll", "check"], 2, "Node's own loop phases"),
      problem: "Node has its own loop with phases. Two helpers are special.", use: "process.nextTick runs before promise microtasks, right after the current operation. setImmediate runs in Node's 'check' step, right after I/O.",
      avoid: "Don't use nextTick in a loop: it can block I/O, like endless microtasks.", lang: "js",
      example: "setImmediate(() => console.log(\"check phase\"));\nprocess.nextTick(() => console.log(\"nextTick: before promises\"));\nPromise.resolve().then(() => console.log(\"promise\"));" },
  ];

  /* ---------- 09. Anemone ---------- */
  const MAIN_JS = `// anemone/v2/js/main.js (lines 225-229, 264-266, 271-273, 373-374)
const frame = (now) => {
  perf?.begin();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  lenis?.raf(now);
  // …
  const y = scrollY();
  const ih = viewH();
  const prog = (el) => Math.min(1, Math.max(0, (y - el.offsetTop) / Math.max(1, el.offsetHeight - ih)));
  // …
  const span = (el, before, after) => Math.min(1, Math.max(0, (y - (el.offsetTop - before * ih)) / ((before + after) * ih)));
  const t12 = span(s2, 1.4, 0.6);
  const t23 = span(s3, 0.7, 0.4);
  // …
  requestAnimationFrame(frame);
};`;
  const SCHEDULER_JS = `// anemone/v2/js/audio/scheduler.js (lines 1-25)
// Look-ahead scheduler ("two clocks"): a cheap JS timer wakes up every ~40 ms and
// asks each voice to schedule its events (drops, beats, hits) with sample-accurate
// AudioContext times inside [now, horizon). If timers get throttled, the look-ahead
// grows so events are still placed on time.

import { clamp } from "./util.js";

const INTERVAL_MS = 40;
const MIN_LOOKAHEAD = 0.15;
const MAX_LOOKAHEAD = 2;

export function createScheduler(ctx, onTick) {
  let timer = 0;
  let lastWake = 0;
  let lookahead = MIN_LOOKAHEAD;

  function tick() {
    const wake = performance.now();
    if (lastWake) {
      const gap = (wake - lastWake) / 1000;
      const wanted = clamp(gap * 1.5 + 0.05, MIN_LOOKAHEAD, MAX_LOOKAHEAD);
      // grow at once, shrink slowly
      lookahead = wanted > lookahead ? wanted : lookahead + (wanted - lookahead) * 0.05;
    }
    lastWake = wake;`;

  /* ---------- 10. On the job ---------- */
  const TICKET_CODE = `const rows = await loadBookings(); // 20,000 rows, kept in memory

input.addEventListener("input", (e) => {
  const text = e.target.value.toLowerCase();
  // runs on EVERY keystroke, on the main thread
  const matches = rows.filter((r) => r.customer.toLowerCase().includes(text));
  table.replaceChildren(...matches.map(renderRow)); // draws every match
});`;

  /* ---------- 11. Interview questions (only the sourced ones in research/interview-questions.md) ---------- */
  const IQ = [
    {
      q: "Explain scope, closures, timers and the event loop: var vs let in timer callbacks, TDZ, setTimeout/setInterval timing, microtask vs macrotask, what defer does.",
      type: "concept", source: { company: "Apple", year: "Jul 2026", url: "https://prachub.com/interview-questions/explain-javascript-scope-closures-timers-and-the-event-loop" },
      testing: "Whether you can trace execution order without running the code.",
      answer: () => [
        "In short. TDZ: a let variable can't be used before its line runs. defer: the script runs after the page is parsed.",
        "Order: plain code first. Then all microtasks (promises, queueMicrotask). Then the next task (a timer). A timer's delay is a minimum: if the thread is busy, the callback waits.",
        programCard("basic"),
        "var vs let in a timer loop: var has one variable for the whole loop, so every callback sees its final value. let makes a new variable for each turn.",
        Book.code("for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0); // 3, 3, 3\nfor (let j = 0; j < 3; j++) setTimeout(() => console.log(j), 0); // 0, 1, 2"),
        "TDZ (temporal dead zone): a let or const exists from the start of its block, but using it before its line runs throws a ReferenceError.",
        "defer: the browser downloads the script while it reads the HTML, and runs it after the HTML is parsed, in order, before DOMContentLoaded.",
      ],
    },
    {
      q: "Describe the output based on the event loop in JavaScript runtimes.",
      type: "coding", level: "senior", source: { company: "ServiceTitan", year: "Sep 2025", url: "https://www.jointaro.com/interviews/companies/servicetitan/experiences/senior-frontend-engineer-canada-september-1-2025-no-offer-positive-1190b77e/" },
      testing: "Output-prediction accuracy. (The exact code in that interview is not public; this is a well-known puzzle of the same kind.)",
      answer: () => [
        "Say the rule out loud while you trace: run the script, empty the microtasks, then take the next task.",
        programCard("puzzle"),
        "The async function runs until its await, so “async1 start” and “async2” print in order. The rest of async1 becomes a microtask. new Promise runs its function at once, so “promise1” prints. Then the script ends. The microtasks run in the order they were queued (async1 end, then promise2). The timer is a task, so it is last.",
      ],
    },
    {
      q: "How does the event loop work in JavaScript?",
      type: "concept", level: "UI Eng 2", source: { company: "Flipkart", year: "Mar 2025", url: "https://roundz.substack.com/p/interview-experience-flipkart-frontend-engineer-sde2" },
      testing: "A mental model, and clear words.",
      answer: [
        "JavaScript has one thread and a call stack. Slow things (timers, network) are handled by the browser, outside the stack. When they finish, their callbacks wait in queues.",
        "The event loop does this again and again: run one task until the stack is empty. Then run all the microtasks, including new ones. Then, if a frame is due, run rAF callbacks and paint. Then take the next task.",
        "Promises and await use the microtask queue. Timers, clicks and network callbacks are tasks.",
      ],
    },
    {
      q: "What is the event loop and how does it work?",
      type: "concept", source: { company: "Delivery Hero", year: "Aug 2024", url: "https://www.glassdoor.ie/Interview/Delivery-Hero-Interview-E504556-RVW97838643.htm" },
      testing: "Baseline JavaScript depth. (This source was seen only as a search summary.)",
      answer: [
        "The event loop is the part of the runtime that decides what code runs next. It watches the call stack. When the stack is empty, it takes the next callback from a queue.",
        "There are two kinds of queues. Microtasks (promises) always run first, and all of them run. Tasks (timers, events) run one at a time. A long task blocks everything, including painting.",
      ],
    },
    {
      q: "JavaScript fundamentals breadth (event loop, React reconciliation) in a UI and machine-coding round.",
      type: "concept", level: "SDE-1 UI", source: { company: "Zomato", year: "Jun 2025", url: "https://leetcode.com/discuss/post/8359475/zomato-sde-1-ui-interview-experience-by-84krj/" },
      testing: "Depth probing: after the first answer, they ask “why?” again. (This source was seen only as a search summary.)",
      answer: [
        "For the event loop part, give the rule, then one example, then the cost. Rule: stack, then microtasks, then (maybe) paint, then one task. Example: a setTimeout 0 runs after a promise.then.",
        "Then show you know the practical side: a long task freezes the page, so you split work with setTimeout or scheduler.yield, or move it to a Web Worker.",
      ],
    },
    {
      q: "How does the event loop work? And: synchronous vs asynchronous JavaScript.",
      type: "concept", level: "junior-ish", source: { company: "Redisolve", year: "Jun 2025", url: "https://dev.to/seenuvasan_p/day-18-my-frontend-interview-experience-at-redisolve-what-i-learned-179" },
      testing: "A screening baseline.",
      answer: [
        "Synchronous code runs line by line, and each line waits for the one before. Asynchronous code starts something now (a timer, a request) and gets its result later, through a callback, a promise or await.",
        "JavaScript has one thread, so async does not mean “at the same time”. It means “not blocking while we wait”. The event loop is what runs the callbacks when the thread is free.",
      ],
    },
  ];

  const resolveAnswer = (a) => (typeof a === "function" ? a() : a);

  Book.registerLesson("event-loop", {
    mount(root) {
      root.append(
        prereqs([
          ["Call stack", "The list of functions that are running now. The last one called finishes first."],
          ["Callback", "A function you give to another function, to be called later. The function inside setTimeout is a callback."],
          ["Promise", "An object for a result that is not ready yet. promise.then(fn) runs fn when the result is ready."],
        ]),
        step({
          n: "01", title: "Why did the page freeze?",
          lines: [
            "You click a button and the whole page stops. Even a spinner stops.",
            ["The reason: the ", word("main thread", "The one worker in the browser. It runs your JavaScript, handles clicks, and draws the page, one job at a time."), " does everything."],
            "Press Next. A button will appear. It freezes this page for 1.5 seconds.",
          ],
          demo: V.freeze(), links: [L.roberts, L.jsinfo],
        }),
        step({
          n: "02", title: "Predict the order",
          lines: ["Here are four console.log lines. One of them waits 0 ms.", "You haven't learned the rule yet. A wrong guess is fine: page 03 explains it.", "Guess first, then run the real code. Press Next under the picture."],
          demo: V.predict(), links: [L.tmqs, L.lydia],
        }),
        step({
          n: "03", title: "Watch the event loop run",
          lines: [
            ["The ", word("event loop", "A loop in the browser. When the call stack is empty, it picks the next piece of work to run."), " picks what runs next."],
            ["Promises use the ", word("microtask", "A small callback from a promise or queueMicrotask. It runs as soon as the stack is empty, before any timer."), " queue. Timers use the ", word("task", "A piece of work the browser takes from a queue: a script, a timer, a click. Tasks run one at a time."), " queue."],
            "Press play, pause, or drag the bar. This is a simplified model: real browsers have several task queues, and they paint only when a frame is due.",
          ],
          demo: V.film(), links: [L.roberts, L.loop, L.tmqs],
        }),
        step({
          n: "04", title: "Your turn: what logs next?",
          lines: ["Two programs. In each one, pick the line that prints next. Press Next under the picture.", "After every answer, you see the reason. The second program has a promise inside a promise."],
          demo: h("div.demo-stack",
            V.stepper(PR.asyncOrder, "Your turn: async and await", {
              q: "An async function reaches await. When does the code after the await run?",
              options: ["Right away, in the same step", "As a microtask, after the current code finishes", "As a task, after the timers"], answer: 1,
              why: ["await pauses the function. The code after it cannot run in the same step.", "Yes. It goes to the microtask queue, so it runs before any timer.", "That would be too late. It is a microtask, not a task."],
            }),
            V.stepper(PR.nested, "Your turn: a promise inside a promise", {
              q: "A then-callback adds a new then-callback while a timer is waiting. Which runs first?",
              options: ["The timer: it was waiting longer", "The new then: the loop empties the microtask queue first", "They run together"], answer: 1,
              why: ["A timer never goes before a microtask. The microtask queue must be empty first.", "Yes. New microtasks go to the end of the queue, but the whole queue empties before the next task.", "JavaScript runs one callback at a time."],
            })),
          links: [L.tmqs, L.lydia],
        }),
        step({
          n: "05", title: "Where does rendering happen?",
          lines: [
            "After a task, the browser may paint a new frame. On a 60 Hz screen that is about 60 times each second (many phones run at 120 Hz).",
            ["A long task blocks the paint, and a click must wait. That wait is what ", word("INP", "Interaction to Next Paint. INP measures how fast the page responds to clicks and key presses during a visit. It reports one of the slowest responses. Good is 200 ms or less."), " measures."],
            "Cut the work into chunks, and the browser can paint between them. Press Next under the picture.",
          ],
          demo: V.frames(), links: [L.inp, L.crp, L.vitals],
        }),
        step({
          n: "06", title: "See it as code",
          lines: ["Run a long loop, then the same work in chunks. The page measures both, for real.", "The first part freezes this page for about 0.4 seconds. That is the point."],
          demo: runnable({ code: CODE, rows: 26, explain: explainRun, title: "Measure a blocking loop" }), links: [L.inp, L.perf],
        }),
        step({
          n: "07", title: "Every kind of task",
          lines: ["Many APIs put code into the loop. They differ in where and when it runs.", "Pick a card. Each one also tells you when not to use it."],
          demo: Book.hubSpoke({ title: "Where each API puts your code", items: HUB }), links: [L.tmqs, L.loop],
        }),
        step({
          n: "08", title: "Trade-offs",
          lines: ["The loop gives you two traps.", "Microtasks can block the page. And a timer is the wrong clock for animation.", "Press Next under the picture."],
          demo: V.tradeoffs(), links: [L.tmqs, L.crp],
        }),
        step({
          n: "09", title: "From your work: Anemone's one loop",
          lines: [
            "Anemone has one requestAnimationFrame loop. It turns the scroll position into a progress number for each section.",
            "Its sound uses two clocks: a rough timer plans ahead, and the audio clock plays on time.",
            "In the last picture, press Next under it.",
          ],
          demo: h("div.demo-stack",
            h("div.el-excerpt", h("span.label", "The one loop (excerpts)"), Book.code(MAIN_JS),
              h("p.el-note", "prog(el) turns the scroll position into 0 to 1 for one section. span(el, before, after) makes two sections overlap, so the picture blends. Then the loop calls requestAnimationFrame(frame) again: one loop, one frame at a time.")),
            h("div.el-excerpt", h("span.label", "The audio scheduler"), Book.code(SCHEDULER_JS),
              h("p.el-note", "A timer every 40 ms is rough, but it is enough to wake up and plan. The exact sound times come from the audio clock (ctx.currentTime). The look-ahead grows when timers are slowed.")),
            V.clocks(),
            h("p.el-note", h("b", "Honest note: "), "this look-ahead pattern is the well-known one from Chris Wilson's article “A Tale of Two Clocks”. What is yours is applying it to Anemone's score, and the scroll-to-progress loop.")),
          links: [L.crp],
        }),
        step({
          n: "10", title: "On the job",
          lines: ["A ticket arrives. Read it, think about your steps, and then compare."],
          demo: Book.onTheJob({
            id: "SPK-233", title: "Typing in the bookings filter feels laggy (INP 600 ms)",
            context: "The bookings page has a text filter above a table of 20,000 rows. Support says: “When I type, the letters appear late, and the page feels stuck.” Field data shows INP is about 600 ms on this page. The good target is 200 ms or less.",
            symptoms: ["Each key press is slow.", "In a recording, there is one long task for each key press.", "The table redraws completely on every key."],
            code: TICKET_CODE,
            tasks: ["Find the real cause. Measure first.", "Make typing feel instant.", "Prove the fix, in the lab and in the field."],
            steps: [
              "Record in the Performance panel while typing. Find the long task under the input event (the red corner marks tasks over 50 ms). Open it: the flame chart shows how much time is filter() and how much is building the rows.",
              "Debounce the input: wait about 150 to 250 ms after the last key before filtering, so a burst of typing triggers one filter. (Debounce is setTimeout plus clearTimeout.)",
              "Move the work out of the event handler. Let the input update at once, then filter after. In React, startTransition lets the input update first and marks the list update as low priority. But a heavy filter() call still blocks while it runs, so also split the work into chunks (scheduler.yield or setTimeout), or move it to a Web Worker (a second thread that can't touch the page). Draw only the visible rows.",
              ["If the filter itself is still heavy, consider a ", word("Web Worker", "A second thread. It runs JavaScript on its own, but it can't touch the page."), ": send the text, get the matching ids back, and the main thread stays free. It costs copying data and more code, so do it after the steps above."],
              "Verify. Record again: the long task should be gone or well under 50 ms. After release, check INP in field data (for example the web-vitals library or your RUM tool): lab results are a guide, real users are the proof.",
            ],
          }),
          links: [L.inp, L.perf],
        }),
        step({
          n: "11", title: "Real interview questions",
          lines: ["These were reported by real candidates. The company, date and link are on each card.", "Try each one out loud first, then open the answer."],
          demo: Book.interviewQuestions(IQ.map((it) => ({ ...it, answer: resolveAnswer(it.answer) }))),
          links: [L.roberts, L.loop, L.ydkjs],
        }),
        step({
          n: "12", title: "In one sentence",
          lines: ["JavaScript has one thread. It runs a task, then empties the microtasks, then may paint, then takes the next task."],
          demo: h("ol.el-rule",
            h("li", h("span", h("b", "Run the script"), " (or one task) until the call stack is empty.")),
            h("li", h("span", h("b", "Empty the microtask queue"), ": promises and await, including new ones.")),
            h("li", h("span", h("b", "Render, if a frame is due"), ": rAF callbacks, then paint.")),
            h("li", h("span", h("b", "Take the next task"), ": a timer, a click, a network answer. Then repeat."))),
          links: [L.loop, L.tmqs, L.ydkjs],
        }),
      );
    },
  });
})();
