/* Lesson: Scope, hoisting and closures (Wave 2, Part A).
   Order: the 3,3,3 puzzle → boxes and the scope chain → hoisting → a function keeps a box alive (film) → the loop bug and its fixes →
   once/memoize → debounce → curry → where closures show up → the React trap → your work → on the job → interview → one sentence.
   Every box, arrow, caption and printed output comes from the mini-interpreter (js-scope-closures.data.js) or a live run,
   and dev/js-scope-closures.test.js checks it against real Node (and real React 19 when it is installed). */
(function () {
  const { h, word, step, runnable, prereqs, svg: S } = Book;
  const V = Book.parts["js-scope-closures"];
  const D = V.data;
  const LIB = D.LIB;
  const SN = D.SNIPPETS;
  const R = V.R;

  /* ---------- Go deeper links (URLs only from research/frontend-syllabus.md; no lengths, because none are recorded there) ---------- */
  const L = {
    ydkjs: { title: "You Don't Know JS Yet (Scope & Closures)", url: "https://github.com/getify/You-Dont-Know-JS", type: "book", by: "Kyle Simpson" },
    jsinfo: { title: "javascript.info", url: "https://javascript.info/", type: "doc", by: "javascript.info" },
    useEffect: { title: "A Complete Guide to useEffect", url: "https://overreacted.io/a-complete-guide-to-useeffect/", type: "article", by: "Dan Abramov" },
    noEffect: { title: "You Might Not Need an Effect", url: "https://react.dev/learn/you-might-not-need-an-effect", type: "doc", by: "react.dev" },
    reactLearn: { title: "react.dev Learn", url: "https://react.dev/learn", type: "doc", by: "react.dev" },
    handbook: { title: "Front End Interview Handbook", url: "https://www.frontendinterviewhandbook.com/", type: "doc", by: "Front End Interview Handbook" },
    gfe: { title: "GreatFrontEnd study plans", url: "https://www.greatfrontend.com/interviews/study-plans", type: "doc", by: "GreatFrontEnd" },
    tasks: { title: "Tasks, microtasks, queues and schedules", url: "https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/", type: "article", by: "Jake Archibald" },
  };

  /* ---------- small helpers ---------- */
  const out = (id) => { const r = R(id); return r.error ? `${r.error.name}: ${r.error.message}` : r.console.join("  →  "); };
  const programCard = (id) => h("div.sc-answer", Book.code(R(id).lines.join("\n")), h("p.sc-text", h("b", "Output: "), out(id)));
  const snippetCard = (id) => { const sn = SN[id]; return h("div.sc-answer", Book.code(sn.code), h("p.sc-text", h("b", sn.error ? "Result: " : "Output: "), sn.error ? `${sn.error} (checked by running it)` : sn.out.join("  →  "))); };
  const withOut = (id) => SN[id].code + "\n" + SN[id].out.map((o) => `// → ${o}`).join("\n");
  const solution = (id) => h("details.sc-sol", h("summary", "Show one solution"), Book.code(LIB[id].solution));
  const note = (...kids) => h("p.sc-text", ...kids);

  /* A small picture for the hub cards: a function with an arrow to the box it remembers. */
  function pic(fnLabel, boxLabel, caption) {
    const svg = S("svg", { viewBox: "0 0 300 82", class: "sc-pic", role: "img", "aria-label": `${fnLabel} points to ${boxLabel}. ${caption}` });
    svg.append(
      S("rect", { x: 8, y: 8, width: 112, height: 34, rx: 9, class: "fl-ink" }), S("text", { x: 64, y: 29, "text-anchor": "middle", class: "fl-chip-inv", style: "font-size:12px" }, fnLabel),
      S("rect", { x: 180, y: 8, width: 112, height: 34, rx: 9, class: "fl-field" }), S("text", { x: 236, y: 29, "text-anchor": "middle", class: "fl-chip", style: "font-size:12px" }, boxLabel),
      S("path", { d: "M 122 25 H 172 m -6 -5 l 6 5 l -6 5", class: "sc-arrow" }),
      S("text", { x: 150, y: 68, "text-anchor": "middle", class: "fl-small" }, caption));
    return svg;
  }

  /* ---------- 06–08. The runnables: starter with a TODO, real tests, plain-words result ---------- */
  function explainLib(id) {
    return (results) => {
      const r = results[id];
      if (!r) return h("p.result-say", "The test did not report. Press Reset to get the original code back.");
      const checks = LIB[id].checks(r);
      const pass = checks.filter((c) => c.ok).length;
      const bad = checks.find((c) => !c.ok);
      let rows = checks.map((c) => ({ label: c.label, value: c.ok ? 1 : 0.05, text: `${c.ok ? "pass" : "not yet"} · ${c.got}` }));
      const sentences = [];
      let tail;
      if (id === "memoize") {
        rows = [{ label: "5 calls, no memoize", value: 5, text: "5 real calls" }, { label: "5 calls, your memoize", value: r.calls, text: `${r.calls} real call${r.calls === 1 ? "" : "s"}` }];
        tail = "The cache lives in the closure, so it stays alive as long as the memoized function does. That is the cost: the cache never shrinks by itself.";
      } else if (id === "debounce") {
        rows = [{ label: "Key presses", value: r.typed, text: `${r.typed} typed` }, { label: "Requests sent", value: r.sent.length, text: `${r.sent.length} sent` }];
        if (r.sent.length) sentences.push(`Your debounce sent ${r.sent.map((s) => `"${s.text}" at ${s.at} ms`).join(" and ")}. These times were measured with real timers.`);
        tail = "The variable timer lives in the closure. Every call clears the old timer and starts a new one.";
      } else if (id === "once") tail = "called and result live in the closure. Without a closure they would start fresh on every call.";
      else tail = "Each returned function remembers the arguments so far, in its closure.";
      sentences.unshift(pass === checks.length ? `All ${checks.length} checks pass.` : `${pass} of ${checks.length} checks pass. Next: ${bad.label} (your code gave: ${bad.got}). Fill in the TODO, then press Run again.`);
      return Book.resultCard({ title: "What happened", rows, sentences, note: tail });
    };
  }
  const lib = (id, title) => runnable({ title, code: D.runnableCode(id, false), rows: id === "debounce" ? 24 : 20, explain: explainLib(id) });

  /* ---------- 09. Where closures show up ---------- */
  const HUB = [
    { id: "events", name: "Event handlers", short: "remember a click count", w: "H", picture: () => pic("click handler", "clicks, button", "the handler remembers its box"),
      problem: "React to a click, and remember something between clicks.", use: "A handler that counts clicks, or knows which list item it belongs to.",
      avoid: "Trap: a handler keeps everything it captured alive until you remove it. If you add a listener on every render and never remove it, old handlers pile up (a memory leak).", lang: "js",
      example: "function setup(button) {\n  let clicks = 0; // one counter per button, kept alive by the handler\n  button.addEventListener(\"click\", () => {\n    clicks += 1;\n    button.textContent = `Clicked ${clicks} times`;\n  });\n}" },
    { id: "module", name: "Private state", short: "the module pattern", w: "H", picture: () => pic("deposit()", "balance", "outside code cannot reach it"),
      problem: "Hide a variable so only a few functions can change it.", use: "A counter, a cache, or a small service with private state. Anemone's audio scheduler is made this way.",
      avoid: "Don't use it when you need many instances. Every instance gets its own copy of every function. A class shares its methods and has real private fields (#name).", lang: "js", example: withOut("moduleBank") },
    { id: "hooks", name: "React hooks", short: "stale closure in useEffect", w: "H", picture: () => pic("effect callback", "render 1 box", "an old box can stay in use"),
      problem: "A component function runs again on every render. Each run is a new box. The handlers and effects you write inside it remember that render's values.", use: "Read props and state inside handlers and effects: they see the values of their own render.",
      avoid: "Trap: an effect with missing dependencies keeps reading an OLD render's values (a stale closure). List the dependencies, use a functional update, or keep the latest value in a ref.", lang: "js",
      example: "useEffect(() => {\n  const id = setInterval(() => setCount(count + 1), 1000);\n  return () => clearInterval(id);\n}, []); // count is always the first render's 0\n// the screen shows 1 and stays at 1\n\n// Fix: setCount((c) => c + 1) does not read count at all" },
    { id: "timers", name: "Timers", short: "setTimeout callbacks", w: "H", picture: () => pic("timer callback", "message, ms", "it runs later and still knows"),
      problem: "Run something later and still remember the data it needs.", use: "setTimeout and setInterval callbacks, debounce, delays and retries.",
      avoid: "Trap: a callback made in a var loop shares one variable (the 3, 3, 3 bug). A timer that is never cleared keeps its box alive.", lang: "js", example: withOut("later") },
    { id: "iter", name: "Iterators and generators", short: "state between calls", w: "L", picture: () => pic("next()", "i, n", "the position is kept in the box"),
      problem: "Hand out values one at a time, without building them all first.", use: "range(), reading a big file line by line, endless sequences. A generator function does the same job with yield: its local variables survive between yields.",
      avoid: "Don't use it when a plain array is fine. While you still hold the iterator, its variables stay alive.", lang: "js", example: withOut("iterator") },
  ];

  /* ---------- 11. From your work ---------- */
  const SPEAKO = `// speako-web/src/app/help/_components/help-header.tsx
// (lines 37 and 73-84; the body of fetchResults is left out)
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const fetchResults = useCallback(async (q: string) => {
  // ... calls the help search API, then setResults(data) ...
}, []);

function handleSearch(value: string) {
  setQuery(value);
  if (debounceRef.current) clearTimeout(debounceRef.current);
  if (value.trim().length < 2) {
    setResults([]);
    setIsOpen(false);
    setIsLoading(false);
    return;
  }
  setIsLoading(true);
  debounceRef.current = setTimeout(() => fetchResults(value), 300);
}`;
  const SCHEDULER = `// anemone/v2/js/audio/scheduler.js (lines 12-17 and 30-45)
export function createScheduler(ctx, onTick) {
  let timer = 0;
  let lastWake = 0;
  let lookahead = MIN_LOOKAHEAD;

  function tick() { /* ... uses lastWake and lookahead ... */ }

  return {
    start() {
      if (timer) return;
      lastWake = 0;
      timer = setInterval(tick, INTERVAL_MS);
      tick();
    },
    stop() {
      clearInterval(timer);
      timer = 0;
    },
    get running() {
      return timer !== 0;
    },
  };
}`;

  /* ---------- 12. On the job ---------- */
  const TICKET_CODE = `function BookingsList({ filter }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const id = setInterval(async () => {
      setRows(await fetchBookings(filter)); // which filter is this?
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // another effect (not shown) loads rows when filter changes
  return <Table rows={rows} />;
}`;

  /* ---------- 13. Interview questions (only the sourced ones in research/interview-questions.md, closures-scope) ---------- */
  const IQ = [
    {
      q: "Predict let and var behavior: block vs function scope, hoisting, the dead zone (TDZ), redeclaration, and closures made in loop turns.",
      type: "coding", level: "warm-up (level not stated)", source: { company: "Amazon", year: "Aug 2026", url: "https://prachub.com/interview-questions/predict-javascript-let-and-var-behavior" },
      testing: "Rule-based reasoning: can you say the rule first, then the output?",
      answer: () => [
        "Say the rules, then trace. var: function scope, hoisted, starts as undefined, can be declared twice. let and const: block scope, in the dead zone until their line, cannot be declared twice in one scope.",
        snippetCard("predict"),
        "typeof does not save you in the dead zone. class declarations are in the dead zone too, like let.",
        snippetCard("tdzTypeof"), snippetCard("tdzClass"),
        "Redeclaring: var x twice is allowed (it prints 2). let y twice is a SyntaxError, found before any code runs.",
        snippetCard("redeclareVar"), snippetCard("redeclareLet"),
        "Loops: var has one variable for the whole loop, let has one per turn.",
        programCard("loopVar"), programCard("loopLet"),
      ],
    },
    {
      q: "What is a closure and how does it work? And: var, let, const.",
      type: "concept", level: "junior-ish", source: { company: "Redisolve", year: "Jun 2025", url: "https://dev.to/seenuvasan_p/day-18-my-frontend-interview-experience-at-redisolve-what-i-learned-179" },
      testing: "A screening baseline: a plain definition and a small example.",
      answer: () => [
        "A closure is a function together with the box (scope) where it was written. The function keeps using that box's variables, even after the outer function has finished.",
        programCard("counter"),
        "makeCounter() ended, but the returned function still points to its box, so count lives on. Each call of makeCounter() makes a new box and a new count.",
        "var: function scope, hoisted as undefined. let: block scope, dead zone before its line. const: like let, and the name cannot be assigned again. But const does not freeze an object:",
        snippetCard("constAssign"),
      ],
    },
    {
      q: "Curry: convert a multi-argument function into a chain of unary calls. And: Console Log History (intercept console.log).",
      type: "coding", source: { company: "Meta", year: "GFE guide, no year", url: "https://www.greatfrontend.com/interviews/company/meta/questions-guides" },
      testing: "Closure fluency. (The exact task text is behind the guide, so check the details there.)",
      answer: () => [
        "Curry: each step returns a function that remembers the arguments so far. When there are enough arguments (fn.length), call the original.",
        Book.code(LIB.curry.solution),
        "This version also accepts add(1, 2)(3). If the task needs exactly one argument per call, take a single parameter (arg) instead of ...more. Mention the limit: fn.length ignores default and rest parameters.",
        snippetCard("fnLength"),
        "Console Log History: keep the old console.log and a history array in a closure, and replace console.log with a wrapper.",
        snippetCard("trackLogs"),
      ],
    },
    {
      q: "Write debounce. Follow-up: add cancel and flush.",
      type: "coding", source: { company: "Airbnb", year: "GFE guide, no year", url: "https://www.greatfrontend.com/interviews/company/airbnb/questions-guides" },
      testing: "Whether you can keep a timer in a closure, and handle the extra methods without breaking it. (GreatFrontEnd lists debounce for Canva and Shopify too; Airbnb's version has cancel and flush.)",
      answer: () => [
        "The closure holds timer and the last arguments. Each call clears the old timer and starts a new one. cancel clears it. flush runs the pending call now.",
        snippetCard("debounce2"),
        "Say the edge cases: flush with nothing pending does nothing; after cancel, flush does nothing; calling the wrapper again after a flush starts fresh.",
        "Mention this: use fn.apply(this, args) so a method keeps its this.",
        snippetCard("thisDebounce"),
      ],
    },
  ];
  const resolveAnswer = (a) => (typeof a === "function" ? a() : a);

  const PRACTICE = [
    { q: "What does this print? makeCounter() is called twice (a and b), then a(), a(), b().", a: [`It prints ${R("twoCounters").console.join(", ")}. Each call of makeCounter() makes its own box with its own count. Both calls of makeCounter() make a new box.`] },
    { q: "Is a closure a copy of a variable, or the variable itself?", a: [`The variable itself (a link to the box). If the variable changes later, the closure sees the new value. In the lesson's test, let x = 1; const show = () => x; x = 2; show() gives ${SN.liveVar.out[0]}.`] },
    { q: "Why can a memoize cache cause a memory leak?", a: ["The cache lives in the closure, so it lives as long as the memoized function. It stores every answer and every key. With many different inputs it only grows. Fix: limit the size (for example an LRU cache), or clear it. Also: object keys are compared by reference, so two equal objects are two keys."] },
    { q: "A setInterval in useEffect with [] calls setCount(count + 1). Why does the number stop at 1?", a: ["The effect ran once, in render 1, where count was 0. The callback closes over that box, so it always computes 0 + 1. Fix: setCount((c) => c + 1), or put count in the dependency array."] },
    { q: "Does a closure keep the whole outer scope alive?", a: ["Think of it that way: the function keeps its box. Real engines are smarter and may keep only the variables the inner functions use. But two closures from the same call can share one box, so one closure can keep alive a variable that only the other one uses. Be careful with big data inside such a scope."] },
  ];

  Book.registerLesson("js-scope-closures", {
    mount(root) {
      root.append(
        prereqs([
          ["Function", "A block of code with a name. You call it to run it. It can take values in and give one value back."],
          ["Variable", "A name for a value. let, const and var are three ways to make one."],
          ["Callback", "A function you give to another function, to be called later. The function inside setTimeout is a callback."],
        ]),
        step({
          n: "01", title: "What does this loop print?",
          lines: ["Three timers, each one prints i. You expect 0, 1, 2.", "It is a famous puzzle. The answer comes in a few pages.", "Guess first, then run the real code. Press Next under the picture."],
          demo: V.loopProblem(), links: [L.ydkjs, L.jsinfo],
        }),
        step({
          n: "02", title: "Where can a variable be seen?",
          lines: [
            "Every time a function runs, it gets a fresh box for its variables. Boxes sit inside other boxes, like rooms in a house.",
            ["JavaScript searches the ", word("scope chain", "The boxes JavaScript searches for a name: your own box first, then outward, one box at a time."), ": your own box first, then outward."],
            "Press Next under the picture.",
          ],
          demo: V.chain(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "03", title: "Before the first line runs",
          lines: [
            "JavaScript reads your code first and sets up the boxes. Then it runs line 1.",
            [word("Hoisting", "Before any line runs, names are set up. A var is undefined. A function declaration is ready."), " and the ", word("dead zone", "The time before a let or const line runs. Using the variable then throws an error. Also called the TDZ."), " come from this."],
            "Every result is a real run in your browser. Press Next under the picture.",
          ],
          demo: V.hoisting(), links: [L.ydkjs, L.jsinfo],
        }),
        step({
          n: "04", title: "What does a function keep alive?",
          lines: [
            "Press play. Watch the function makeCounter() in the picture.",
            ["When the call ends, its box is not freed. The returned function keeps an arrow to it. This pair is a ", word("closure", "A function plus the box where it was born. The box stays alive while the function can be reached."), "."],
            ["A box can be freed when nothing can reach it: ", word("garbage collection", "The engine finds memory that nothing can reach and frees it later. You do not decide when."), "."],
          ],
          demo: h("div.demo-stack",
            V.film(["counter"], "A counter and the box it keeps alive"),
            V.predict(),
            note(h("b", "Honest note: "), "this is a model. A real engine may keep only the variables that inner functions really use (the lesson's test checks this in Node). A real engine frees memory later, not at once. Think of the whole box, and you will not be surprised.")),
          links: [L.ydkjs, L.jsinfo],
        }),
        step({
          n: "05", title: "The loop bug, and three fixes",
          lines: [
            "Watch two loops. With var, three callbacks point to one box. With let, to three boxes.",
            "To fix the bug, give each callback its own box.",
            "Press play, then Next under the second picture.",
          ],
          demo: h("div.demo-stack", V.film(["loopVar", "loopLet"], "A loop with var, then with let"), V.fixes()),
          links: [L.ydkjs, L.tasks],
        }),
        step({
          n: "06", title: "Write once() and memoize()",
          lines: [
            "Two small tools. Both rely on one idea: the returned function remembers a variable.",
            [word("once", "Makes a function run only the first time. Later calls return the saved answer."), " keeps called and result. ", word("memoize", "Saves the answer for each input, so the same input is not computed twice."), " keeps a cache."],
            "Fill in each TODO and press Run. A solution is under each editor.",
          ],
          demo: h("div.demo-stack", lib("once", "Write once()"), solution("once"), lib("memoize", "Write memoize()"), solution("memoize"),
            note(h("b", "Traps: "), "Check with cache.has(arg), not with if (cache.get(arg)). A saved answer of 0, \"\" or undefined looks like 'not saved'. An object key is compared by reference, so two equal objects are two keys. (NaN works as a key: a Map treats NaN as equal to NaN.) The cache never shrinks."), note(h("b", "One argument only: "), "this version handles one argument. memoize((a, b) => …) would get only a, so the answer is wrong. For many arguments, build a key (for example JSON.stringify(args), which fails for functions and circular data) or let the caller pass a key function (like lodash's resolver).")),
          links: [L.handbook, L.gfe],
        }),
        step({
          n: "07", title: "Write debounce()",
          lines: [
            [word("Debounce", "Wait until the calls stop for a short time, then run once. Used for search boxes and resize events."), " runs the function only after the typing stops."],
            "It is one closure: the returned function remembers a timer variable.",
            "Watch real timers first. Then write it.",
          ],
          demo: h("div.demo-stack", V.debounceTimeline(), note(h("b", "Kinds: "), "this is the trailing kind: it runs after the pause. A leading kind runs on the first call. Throttle is different: it runs at most once per interval."), lib("debounce", "Write debounce()"), solution("debounce"),
            note(h("b", "Keep this: "), "fn.apply(this, args) lets a method keep its this when it is debounced. The test checks it with a method on an object.")),
          links: [L.handbook, L.gfe, L.tasks],
        }),
        step({
          n: "08", title: "Write curry()",
          lines: [
            [word("Curry", "Turn f(a, b, c) into f(a)(b)(c): one argument at a time."), " changes how you call a function."],
            "Each step returns a function that remembers the arguments so far.",
            "Fill in the TODO and press Run.",
          ],
          demo: h("div.demo-stack", lib("curry", "Write curry()"), solution("curry"),
            note(h("b", "Limit: "), "fn.length counts only the parameters before the first default value or rest parameter, so curry cannot see those. Checked by running it:"), snippetCard("fnLength")),
          links: [L.handbook, L.gfe],
        }),
        step({
          n: "09", title: "Where closures show up",
          lines: ["Closures are in handlers, timers, private state, hooks and iterators.", "Pick a card. Each one also tells you when not to use it, or the trap."],
          demo: Book.hubSpoke({ title: "Where closures show up", items: HUB }), links: [L.ydkjs, L.useEffect],
        }),
        step({
          n: "10", title: "The trap: stale closures in React",
          lines: [
            "A React component is a function. It runs again on every render, and each run makes a new box.",
            "An effect saves a function from one render. If React never replaces it, it keeps reading that old box.",
            "Watch the model, then read the real fixes below.",
          ],
          demo: h("div.demo-stack",
            V.film(["stale", "staleFixed"], "A stale closure, and the fix"),
            note(h("b", "Model, not React: "), "here render(count) stands for your component, and handler for the effect's callback. The same thing happens in real React (the lesson's test checks it with React 19 when it is installed). In React, the fix on the right is a dependency array with count in it."),
            Book.code(HUB[2].example),
            note("Three fixes: a functional update (setCount((c) => c + 1), no reading of count), the dependency array [count] (the effect is made again for every new count), or a ref that always holds the latest value. The lint rule react-hooks/exhaustive-deps warns about a missing dependency. Never silence it with eslint-disable.")),
          links: [L.useEffect, L.noEffect, L.reactLearn],
        }),
        step({
          n: "11", title: "From your work: a timer in a ref, a scheduler in a closure",
          lines: [
            "Speako's help search has a debounce. Its timer lives in a ref, not in a plain variable.",
            "Anemone's audio scheduler hides its variables in a closure.",
            "Be ready to say which parts you wrote.",
          ],
          demo: h("div.demo-stack",
            h("div.sc-excerpt", h("span.label", "Speako: the help search box (excerpt)"), Book.code(SPEAKO),
              note("debounceRef is one box that every render shares, so each handleSearch clears the same timer (see the demo below).")),
            V.refDemo(),
            h("div.sc-excerpt", h("span.label", "Anemone: createScheduler (excerpt)"), Book.code(SCHEDULER),
              note("timer, lastWake and lookahead are private: only start(), stop() and running can reach them.")),
            note(h("b", "Honest note: "), "a debounce with a timer in a ref, and a timer that wakes up and plans a little ahead, are both well-known patterns. In the local copy of Speako that was read for this page, git blame puts the debounce lines (5 March 2026) under the name Billy Chan, and your own commit on that file changed the API call. The Anemone scheduler is committed under your name. Say only what you wrote, and explain the rest in your own words.")),
          links: [L.useEffect, L.noEffect],
        }),
        step({
          n: "12", title: "On the job",
          lines: ["A ticket arrives. Read it, think about your steps, and then compare."],
          demo: Book.onTheJob({
            id: "PRACTICE-1", title: "The bookings list still shows the old filter",
            context: "A practice ticket (not from a real tracker). The bookings page polls the server every 5 seconds to stay fresh. A user says: “I change the filter to Today, but after a few seconds the list jumps back to all bookings.”",
            symptoms: ["Changing the filter works at first.", "After the next poll, the old rows come back.", "In the Network tab, every poll still sends the first filter."],
            code: TICKET_CODE,
            tasks: ["Reproduce it and find which value is old.", "Fix it in a way you can explain.", "Add a test that fails before the fix."],
            steps: [
              "Reproduce: change the filter to Today, wait for the next poll, and open the Network tab. The request still has the first filter (for example filter=All). Now you know the value is old, not the server.",
              "Read the closure: the interval callback was made in render 1. The dependency array is [], so React never makes it again. It reads filter from render 1's box, forever. The lint rule react-hooks/exhaustive-deps would have warned: “React Hook useEffect has a missing dependency: 'filter'. Either include it or remove the dependency array.”",
              "Fix, option A: put filter in the dependency array. The effect cleans up and starts a new interval for each new filter. Simple and correct. The timer restarts, which is fine here.",
              "Fix, option B (if restarting the timer is not wanted): keep the latest filter in a ref that an effect updates (filterRef.current = filter), and read filterRef.current inside the interval. The ref is one box all renders share. React 19.2 added useEffectEvent for exactly this case.",
              "Check the neighbours: when the filter changes while a request is still running, the old answer can arrive last and overwrite the new one. Ignore old answers (see the async lesson). Also make sure cleanup clears the interval.",
              "Add a test with fake timers: render with filter All, re-render with Today, advance 5000 ms, and expect the last fetchBookings call to have received Today. Run it on the old code first and see it fail.",
            ],
          }),
          links: [L.useEffect, L.noEffect],
        }),
        step({
          n: "13", title: "Real interview questions",
          lines: ["These were reported by real candidates. The company, date and link are on each card.", "Try each one out loud first, then open the answer."],
          demo: h("div.demo-stack",
            Book.interviewQuestions(IQ.map((it) => ({ ...it, answer: resolveAnswer(it.answer) }))),
            h("span.sc-sub", "Practice questions (not from a report)"),
            Book.drill(PRACTICE)),
          links: [L.handbook, L.gfe, L.ydkjs],
        }),
        step({
          n: "14", title: "In one sentence",
          lines: ["A closure is a function plus the box where it was born, and the box lives as long as the function can be reached."],
          demo: h("ol.sc-rule",
            h("li", h("span", h("b", "A function remembers where it was written"), ", not where it is called.")),
            h("li", h("span", h("b", "A name is searched outward"), ": your own box first, then one box out at a time.")),
            h("li", h("span", h("b", "var and function declarations are ready early"), "; let, const and class wait in the dead zone.")),
            h("li", h("span", h("b", "A box is freed only when nothing can reach it"), ": a returned function, a timer or a handler can keep it alive."))),
          links: [L.ydkjs, L.useEffect, L.jsinfo],
        }),
      );
    },
  });
})();
