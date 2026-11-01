/* Lesson: Scope, hoisting and closures (Wave 2, Part A).
   Order: the 3,3,3 puzzle → scopes and the scope chain → hoisting and the TDZ → a function keeps a scope alive (film) → the loop bug and its fixes →
   once/memoize → debounce → curry → where closures show up → the React trap → your work → on the job → interview → one sentence.
   Every scope, arrow, caption and printed output comes from the mini-interpreter (js-scope-closures.data.js) or a live run,
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

  /* A small picture for the hub cards: a function with an arrow to the scope it remembers. */
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
        rows = [{ label: "Calls to search()", value: 5, text: "5 calls" }, { label: "Searches that ran", value: r.sent.length, text: `${r.sent.length} ran` }];
        if (r.sent.length) sentences.push(`Your debounce ran the search for ${r.sent.map((t) => `"${t}"`).join(" and ")}. This used real timers.`);
        tail = "The variable timer lives in the closure, so every call of search() sees the same timer. Each call clears the old timer and starts a new one.";
      } else if (id === "once") tail = "The variables called and result live in the closure. Without a closure, they would start fresh on every call.";
      else tail = "Each returned function keeps the arguments it has received so far in its closure.";
      sentences.unshift(pass === checks.length ? `All ${checks.length} checks pass.` : `${pass} of ${checks.length} checks pass. Next: ${bad.label} (your code gave: ${bad.got}). Fill in the TODO, then press Run again.`);
      return Book.resultCard({ title: "What happened", rows, sentences, note: tail });
    };
  }
  const lib = (id, title) => runnable({ title, code: D.runnableCode(id, false), rows: id === "debounce" ? 23 : 20, explain: explainLib(id) });

  /* ---------- 09. Where closures show up ---------- */
  const HUB = [
    { id: "events", name: "Event handlers", short: "A handler remembers data between clicks.", w: "H", picture: () => pic("click handler", "clicks, button", "the handler remembers its scope"),
      problem: "React to a click, and remember something between clicks.", use: "A handler that counts clicks, or knows which list item it belongs to.",
      avoid: "The trap: a handler keeps every variable it uses alive until you remove the handler. If you add a listener on every render and never remove it, old handlers pile up. This is a memory leak.", lang: "js",
      example: "function setup(button) {\n  let clicks = 0; // one counter per button, kept alive by the handler\n  button.addEventListener(\"click\", () => {\n    clicks += 1;\n    button.textContent = `Clicked ${clicks} times`;\n  });\n}" },
    { id: "module", name: "Private state", short: "Only a few functions can change a variable.", w: "H", picture: () => pic("deposit()", "balance", "outside code cannot reach it"),
      problem: "Hide a variable so only a few functions can change it.", use: "A counter, a cache, or a small service with private state. Anemone's audio scheduler is made this way.",
      avoid: "Don't use it when you need many instances. Every instance gets its own copy of every function. A class shares its methods and has real private fields (#name).", lang: "js", example: withOut("moduleBank") },
    { id: "hooks", name: "React hooks", short: "An effect can read old values.", w: "H", picture: () => pic("effect callback", "render 1 scope", "an old scope can stay in use"),
      problem: "A component function runs again on every render. Each run makes a new scope. The handlers and effects you write inside it remember that render's values.", use: "Read props and state inside handlers and effects: they see the values of their own render.",
      avoid: "The trap: an effect with missing dependencies keeps reading an OLD render's values. This is called a stale closure. To fix it, list the dependencies, use a functional update, or keep the latest value in a ref.", lang: "js",
      example: "useEffect(() => {\n  const id = setInterval(() => setCount(count + 1), 1000);\n  return () => clearInterval(id);\n}, []); // count is always the first render's 0\n// the screen shows 1 and stays at 1\n\n// Fix: setCount((c) => c + 1) does not read count at all" },
    { id: "timers", name: "Timers", short: "A callback runs later and still remembers.", w: "H", picture: () => pic("timer callback", "message, ms", "it runs later and still knows"),
      problem: "Run something later and still remember the data it needs.", use: "setTimeout and setInterval callbacks, debounce, delays and retries.",
      avoid: "The trap: callbacks made in a var loop all share one variable (the 3, 3, 3 bug). Also, a timer that is never cleared keeps its scope alive.", lang: "js", example: withOut("later") },
    { id: "iter", name: "Iterators and generators", short: "next() remembers where it stopped.", w: "L", picture: () => pic("next()", "i, n", "the position is kept in the scope"),
      problem: "Hand out values one at a time, without building them all first.", use: "range(), reading a big file line by line, endless sequences. A generator function does the same job with yield: its local variables survive between yields.",
      avoid: "Don't use it when a plain array is enough. As long as you still hold the iterator, its variables stay alive.", lang: "js", example: withOut("iterator") },
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
      testing: "Whether you can say the rule first, and then use it to predict the output.",
      answer: () => [
        "Say the rules first, then trace the code line by line. A var belongs to the whole function, and the { } of an if or a loop do not limit it. It is hoisted with the value undefined, and you may declare it twice.",
        "A let or const belongs to the nearest { } block. It is hoisted too, but it is not initialized until its line runs. That time is the temporal dead zone (TDZ), and reading the variable during it throws a ReferenceError. Declaring the same let twice in one scope is a SyntaxError.",
        snippetCard("predict"),
        "A strong answer shows that let really is hoisted. Inside this block, the outer x is hidden by the block's own x, which is still in the TDZ:",
        snippetCard("tdzBlock"),
        "typeof does not protect you from the TDZ. A class declaration also stays in the TDZ until its line runs, like let.",
        snippetCard("tdzTypeof"), snippetCard("tdzClass"),
        "Declaring a var twice is allowed (this prints 2). Declaring a let twice is a SyntaxError, and JavaScript finds it before any code runs.",
        snippetCard("redeclareVar"), snippetCard("redeclareLet"),
        "In loops, var gives one variable for the whole loop, and let gives a new variable for each turn.",
        programCard("loopVar"), programCard("loopLet"),
      ],
    },
    {
      q: "What is a closure and how does it work? And: var, let, const.",
      type: "concept", level: "junior-ish", source: { company: "Redisolve", year: "Jun 2025", url: "https://dev.to/seenuvasan_p/day-18-my-frontend-interview-experience-at-redisolve-what-i-learned-179" },
      testing: "A basic screening question: a clear definition and one small example.",
      answer: () => [
        "A closure is a function together with the scope where it was written. The function keeps using that scope's variables, even after the outer function has finished.",
        programCard("counter"),
        "makeCounter() has ended, but the returned function still points to its scope, so count stays alive. Each call of makeCounter() makes a new scope with a new count.",
        "A var belongs to the whole function and is hoisted with the value undefined. A let belongs to its { } block, and it is in the TDZ until its line runs. A const works like let, and you cannot assign the name again. But const does not freeze an object:",
        snippetCard("constAssign"),
      ],
    },
    {
      q: "Curry: convert a multi-argument function into a chain of unary calls. And: Console Log History (intercept console.log).",
      type: "coding", source: { company: "Meta", year: "GFE guide, no year", url: "https://www.greatfrontend.com/interviews/company/meta/questions-guides" },
      testing: "Whether you are comfortable with closures. (The exact task text is behind the guide, so check the details there.)",
      answer: () => [
        "For curry, each step returns a function that remembers the arguments so far. When it has enough arguments (fn.length), it calls the original function.",
        Book.code(LIB.curry.solution),
        "This version also accepts add(1, 2)(3). If the task needs exactly one argument per call, take a single parameter (arg) instead of ...more. Also mention the limit: fn.length does not count default and rest parameters.",
        snippetCard("fnLength"),
        "For Console Log History, keep the original console.log and a history array in a closure, and replace console.log with a wrapper function.",
        snippetCard("trackLogs"),
      ],
    },
    {
      q: "Write debounce. Follow-up: add cancel and flush.",
      type: "coding", source: { company: "Airbnb", year: "GFE guide, no year", url: "https://www.greatfrontend.com/interviews/company/airbnb/questions-guides" },
      testing: "Whether you can keep a timer in a closure, and handle the extra methods without breaking it. (GreatFrontEnd lists debounce for Canva and Shopify too; Airbnb's version has cancel and flush.)",
      answer: () => [
        "The closure holds the timer and the last arguments. Each call clears the old timer and starts a new one. cancel() clears the timer. flush() runs the waiting call right now.",
        snippetCard("debounce2"),
        "Say the edge cases out loud. flush() with nothing waiting does nothing. After cancel(), flush() does nothing. Calling the function again after a flush starts a new wait.",
        "Also mention this: write fn.apply(this, args) instead of fn(...args), so that a debounced method keeps its this.",
        snippetCard("thisDebounce"),
      ],
    },
  ];
  const resolveAnswer = (a) => (typeof a === "function" ? a() : a);

  const PRACTICE = [
    { q: "What does this print? makeCounter() is called twice (a and b), then a(), a(), b().", a: [`It prints ${R("twoCounters").console.join(", ")}. Each call of makeCounter() makes its own scope with its own count, so a and b do not share anything.`] },
    { q: "Is a closure a copy of a variable, or the variable itself?", a: [`The variable itself, through a link to its scope. If the variable changes later, the closure sees the new value. In the lesson's test, let x = 1; const show = () => x; x = 2; show() gives ${SN.liveVar.out[0]}.`] },
    { q: "Why can a memoize cache cause a memory leak?", a: ["The cache lives in the closure, so it lives as long as the memoized function. It stores every answer and every key. With many different inputs it only grows. Fix: limit the size (for example an LRU cache), or clear it. Also: object keys are compared by reference, so two equal objects are two keys."] },
    { q: "A setInterval in useEffect with [] calls setCount(count + 1). Why does the number stop at 1?", a: ["The effect ran once, in render 1, where count was 0. The callback closes over that render's scope, so it always computes 0 + 1. Fix: setCount((c) => c + 1), or put count in the dependency array."] },
    { q: "Does a closure keep the whole outer scope alive?", a: ["It is safe to think of it that way: the function keeps its scope. Real engines are smarter and may keep only the variables the inner functions use. But two closures from the same call can share one box, so one closure can keep alive a variable that only the other one uses. Be careful with big data inside such a scope."] },
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
          lines: ["This loop starts three timers, and each timer prints i. Most people expect it to print 0, 1, 2.", "It is a famous interview puzzle. The full answer comes a few pages later.", "Guess first, then run the real code. Press Next under the picture."],
          demo: V.loopProblem(), links: [L.ydkjs, L.jsinfo],
        }),
        step({
          n: "02", title: "Where can a variable be seen?",
          lines: [
            ["A ", word("scope", "The part of the code where a variable can be used. Every function call and every { } block gets its own scope for its variables."), " is where a variable lives. Every function call and every { } block gets its own scope. When one function is written inside another, its scope sits inside the other one's scope."],
            ["To find a name, JavaScript searches the ", word("scope chain", "The list of scopes JavaScript searches for a name: the scope of the running code first, then outward, one scope at a time."), ": the scope of the running code first, then the scope around it, and so on outward."],
            "Press Next under the picture.",
          ],
          demo: V.chain(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "03", title: "Before the first line runs",
          lines: [
            "When a scope starts, JavaScript first creates every name declared in it. Only then does it run the first line of that scope.",
            ["This is called ", word("hoisting", "Before a scope runs its first line, JavaScript creates every name declared in it. The code is not moved. var, let, const, class and function declarations are all hoisted; they only start with different values."), ". All declarations are hoisted, including let and const. What differs is the starting value, and that is where the ", word("temporal dead zone (TDZ)", "The time from the start of a scope until a let, const or class line runs. The name already exists, but reading it throws a ReferenceError."), " comes from."],
            "Every result is a real run in your browser. Press Next under the picture.",
          ],
          demo: V.hoisting(), links: [L.ydkjs, L.jsinfo],
        }),
        step({
          n: "04", title: "What does a function keep alive?",
          lines: [
            "Press play. Watch the function makeCounter() in the picture.",
            ["When the call ends, its scope is not freed. The returned function keeps an arrow to it. A function together with that scope is called a ", word("closure", "A function plus the scope where it was created. The scope stays alive as long as the function can be reached."), "."],
            ["A scope is freed only when no code can reach it any more. This is called ", word("garbage collection", "The engine finds memory that nothing can reach and frees it later. You do not decide when."), "."],
          ],
          demo: h("div.demo-stack",
            V.film(["counter"], "A counter and the scope it keeps alive"),
            V.predict(),
            note(h("b", "Honest note: "), "this picture is a model. A real engine may keep only the variables that inner functions really use (the lesson's test checks this in Node), and it frees memory later, not at once. If you think of the whole scope as kept alive, you will not be surprised.")),
          links: [L.ydkjs, L.jsinfo],
        }),
        step({
          n: "05", title: "The loop bug, and three fixes",
          lines: [
            "Watch two loops. With var, all three callbacks point to the same scope. With let, each callback points to its own scope.",
            "So the fix is to give each callback its own scope.",
            "Press play, then Next under the second picture.",
          ],
          demo: h("div.demo-stack", V.film(["loopVar", "loopLet"], "A loop with var, then with let"), V.fixes()),
          links: [L.ydkjs, L.tasks],
        }),
        step({
          n: "06", title: "Write once() and memoize()",
          lines: [
            "Two small tools. Both rely on one idea: the returned function remembers a variable.",
            [word("once", "Makes a function run only the first time. Later calls return the saved answer."), " keeps two variables, called and result, in its closure. ", word("memoize", "Saves the answer for each input, so the same input is not computed twice."), " keeps a cache in its closure."],
            "Fill in each TODO and press Run. A solution is under each editor.",
          ],
          demo: h("div.demo-stack", lib("once", "Write once()"), solution("once"), lib("memoize", "Write memoize()"), solution("memoize"),
            note(h("b", "Common mistakes: "), "Check with cache.has(arg), not with if (cache.get(arg)). Otherwise a saved answer of 0, \"\" or undefined looks like it was never saved. An object key is compared by reference, so two equal objects are two keys. (NaN works as a key: a Map treats NaN as equal to NaN.) The cache never shrinks."), note(h("b", "It only handles one argument: "), "this version looks at the first argument only. memoize((a, b) => …) would get only a, so the answer is wrong. For many arguments, build a key (for example JSON.stringify(args), which fails for functions and circular data) or let the caller pass a key function (like lodash's resolver).")),
          links: [L.handbook, L.gfe],
        }),
        step({
          n: "07", title: "Write debounce()",
          lines: [
            [word("Debounce", "Wait until the calls stop for a short time, then run the function once. It is used for search inputs and resize events."), " runs a function only after the calls stop for a moment, for example when the user stops typing."],
            "It is built on one closure: the function that debounce returns remembers a timer variable.",
            "First watch it with real timers. Then write it yourself.",
          ],
          demo: h("div.demo-stack", V.debounceTimeline(), note(h("b", "There is more than one kind: "), "this is the trailing kind, which runs after the pause. A leading debounce runs on the first call instead. Throttle is a different tool: it runs at most once every so many milliseconds, even while the calls keep coming."), lib("debounce", "Write debounce()"), solution("debounce"),
            note(h("b", "Interview follow-up: "), "if the debounced function is a method on an object, it needs its this. Then write fn.apply(this, args) instead of fn(...args). The interview answer on page 13 shows this, together with cancel() and flush().")),
          links: [L.handbook, L.gfe, L.tasks],
        }),
        step({
          n: "08", title: "Write curry()",
          lines: [
            [word("Curry", "Turn f(a, b, c) into f(a)(b)(c): one argument at a time."), " changes how you call a function: you can pass the arguments one at a time."],
            "Each step returns a function that remembers the arguments so far.",
            "Fill in the TODO and press Run.",
          ],
          demo: h("div.demo-stack", lib("curry", "Write curry()"), solution("curry"),
            note(h("b", "A limit to mention: "), "fn.length counts only the parameters before the first default value or rest parameter, so curry cannot see those. This was checked by running it:"), snippetCard("fnLength")),
          links: [L.handbook, L.gfe],
        }),
        step({
          n: "09", title: "Where closures show up",
          lines: ["Closures appear in event handlers, timers, private state, React hooks and iterators.", "Pick a card. Each card also tells you when not to use the pattern, or what the common trap is."],
          demo: Book.hubSpoke({ title: "Where closures show up", items: HUB }), links: [L.ydkjs, L.useEffect],
        }),
        step({
          n: "10", title: "The trap: stale closures in React",
          lines: [
            "A React component is a function. It runs again on every render, and each run makes a new scope.",
            "An effect saves a function from one render. If React never replaces that function, it keeps reading the old render's scope.",
            "Watch the model, then read the real fixes below.",
          ],
          demo: h("div.demo-stack",
            V.film(["stale", "staleFixed"], "A stale closure, and the fix"),
            note(h("b", "This is a model, not real React: "), "here render(count) stands for your component, and handler for the effect's callback. The same thing happens in real React (the lesson's test checks it with React 19 when it is installed). In React, the fix on the right is a dependency array with count in it."),
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
              note("debounceRef is one object that every render shares, so each handleSearch clears the same timer (see the demo below).")),
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
              "Read the closure: the interval callback was made in render 1. The dependency array is [], so React never makes it again. It reads filter from render 1's scope, forever. The lint rule react-hooks/exhaustive-deps would have warned: “React Hook useEffect has a missing dependency: 'filter'. Either include it or remove the dependency array.”",
              "Fix, option A: put filter in the dependency array. The effect cleans up and starts a new interval for each new filter. Simple and correct. The timer restarts, which is fine here.",
              "Fix, option B (if restarting the timer is not wanted): keep the latest filter in a ref that an effect updates (filterRef.current = filter), and read filterRef.current inside the interval. The ref is one object that all renders share. React 19.2 added useEffectEvent for exactly this case.",
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
          lines: ["A closure is a function plus the scope where it was created, and that scope stays alive as long as the function can be reached."],
          demo: h("ol.sc-rule",
            h("li", h("span", h("b", "A function remembers the scope where it was written"), ", not the place where it is called.")),
            h("li", h("span", h("b", "JavaScript searches for a name outward"), ": first the scope of the running code, then one scope further out at a time.")),
            h("li", h("span", h("b", "Every declaration is hoisted to the top of its scope"), ". A var starts as undefined, and a function declaration is ready to call. A let, const or class is in the TDZ until its line runs.")),
            h("li", h("span", h("b", "A scope is freed only when nothing can reach it"), ". A returned function, a timer or an event handler can keep it alive."))),
          links: [L.ydkjs, L.useEffect, L.jsinfo],
        }),
      );
    },
  });
})();
