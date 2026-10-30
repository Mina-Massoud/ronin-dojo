/* Lesson: Promises, async/await and concurrency (Part A, Wave 2).
   Order: pager → chain film → follow the chain → async/await → where await pauses → one by one or together →
   write Promise.all → the combinators → latest result wins → retry with backoff → Speako → on the job → interview.
   Every output on these pages is computed by js-async.data.js (checked by dev/js-async.test.js against real promises and timers)
   or measured live with real timers. */
(function () {
  const { h, word, step, runnable, prereqs, svg: S, icon } = Book;
  const V = Book.parts["js-async"];
  const D = V.data;
  const C = D.COMB;

  /* ---------- Go deeper links (URLs from research/frontend-syllabus.md only; times are estimates) ---------- */
  const L = {
    lydia: { title: "JavaScript Visualized: Promises & Async/Await", url: "https://dev.to/lydiahallie/javascript-visualized-promises-async-await-5gke", type: "article", by: "Lydia Hallie", mins: 8 },
    tmqs: { title: "Tasks, microtasks, queues and schedules", url: "https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/", type: "article", by: "Jake Archibald", mins: 15 },
    loop: { title: "In The Loop", url: "https://www.youtube.com/watch?v=cCOL7MC4Pl0", type: "video", by: "Jake Archibald", mins: 36 },
    jsinfo: { title: "javascript.info", url: "https://javascript.info/", type: "doc", by: "javascript.info" },
    ydkjs: { title: "You Don't Know JS Yet", url: "https://github.com/getify/You-Dont-Know-JS", type: "book", by: "Kyle Simpson" },
    feih: { title: "Front End Interview Handbook", url: "https://www.frontendinterviewhandbook.com/", type: "doc", by: "Front End Interview Handbook" },
    gfe: { title: "GreatFrontEnd Study Plans", url: "https://www.greatfrontend.com/interviews/study-plans", type: "doc", by: "GreatFrontEnd" },
    gfeSD: { title: "GFE System Design Playbook", url: "https://www.greatfrontend.com/front-end-system-design-playbook", type: "article", by: "GreatFrontEnd" },
    mightNot: { title: "You Might Not Need an Effect", url: "https://react.dev/learn/you-might-not-need-an-effect", type: "doc", by: "react.dev" },
    effect: { title: "A Complete Guide to useEffect", url: "https://overreacted.io/a-complete-guide-to-useeffect/", type: "article", by: "Dan Abramov" },
  };

  /* ---------- 07. Write Promise.all yourself ---------- */
  const howIt = (r) => `${r.how}${r.value ? " " + r.value : ""} after ${Book.fmt(r.ms)} ms`;
  function explainPA(rep) {
    const cases = Object.entries(rep);
    if (!cases.length) return h("p.result-say", "No case reported. Press Reset to get the original code back.");
    const bad = cases.filter(([, r]) => !r.pass);
    return Book.resultCard({
      title: "Your promiseAll against the real Promise.all",
      rows: cases.map(([name, r]) => ({ label: name, value: r.pass ? 1 : 0.06, text: r.pass ? "same" : "different" })),
      sentences: bad.length
        ? bad.map(([name, r]) => `“${name}”: the real Promise.all ${howIt(r.real)}. Yours ${howIt(r.mine)}.`)
        : [`Your function matched the real Promise.all in all ${cases.length} cases: same result, same order, and the same speed.`],
      note: bad.length ? "Read the line that looks wrong, fix it, and press Run again." : "Try to break it: change results[i] = value to results.push(value), and run again. Watch the first case fail.",
    });
  }

  /* ---------- 08. The combinators ---------- */
  const lanePic = (id) => {
    const c = C[id];
    const lanes = c.lanes;
    const span = Math.max(...lanes.map((l) => l.ms)) * 1.05;
    const W = 300;
    const X = (t) => 10 + (t / span) * (W - 20);
    const svg = S("svg", { viewBox: `0 0 ${W} ${lanes.length * 24 + 26}`, role: "img", "aria-label": `Timelines of ${lanes.length} promises and when Promise.${c.kind} settles` });
    lanes.forEach((l, i) => {
      const y = 8 + i * 24;
      const stop = l.abortAt ?? l.ms;
      svg.append(S("rect", { x: 10, y, width: Math.max(2, X(stop) - 10), height: 14, rx: 5, class: "as-bar done" }));
      if (l.abortAt) svg.append(S("rect", { x: X(stop), y, width: X(l.ms) - X(stop), height: 14, rx: 5, class: "as-bar-plan" }), S("path", { d: `M ${X(stop) - 5} ${y + 2} l 10 10 m 0 -10 l -10 10`, class: "as-x" }));
      else svg.append(S("circle", { cx: X(l.ms), cy: y + 7, r: 6, class: l.ok ? "as-dot-ok" : "as-dot-bad" }));
    });
    const at = D.settleOf(c.kind, lanes);
    if (at) {
      svg.append(S("line", { x1: X(at.at), x2: X(at.at), y1: 2, y2: lanes.length * 24 + 4, class: "as-total" }));
      svg.append(S("text", { x: Math.min(X(at.at) + 4, W - 70), y: lanes.length * 24 + 20, class: "fl-small" }, `settles ${at.ok ? "ok" : "with an error"}`));
    } else svg.append(S("text", { x: 10, y: lanes.length * 24 + 20, class: "fl-small" }, "cancelled at the cross"));
    return svg;
  };
  const combPic = (id) => () => {
    const c = C[id];
    const out = h("p.as-comb-out", { "aria-live": "polite" }, "Press the button to run this example in your browser.");
    const btn = h("button.btn.sm", { type: "button" }, icon("play", 13), "Run this example");
    btn.addEventListener("click", async () => {
      if (id === "withResolvers" && typeof Promise.withResolvers !== "function") { out.textContent = "This browser does not have Promise.withResolvers yet."; return; }
      btn.disabled = true;
      try { out.textContent = "Printed: " + (await D.runSnippet(c.example)).logs.join(" | "); } catch (err) { out.textContent = "It stopped with: " + err.message; }
      btn.disabled = false;
    });
    return h("div.as-comb", c.lanes ? lanePic(id) : null, h("div.as-comb-run", btn, out));
  };
  const HUB = [
    { id: "all", name: "Promise.all", short: "wait for all", w: "H", picture: combPic("all"), lang: "js", example: C.all.example,
      problem: "Wait for several independent promises and get all answers, in the order you gave them.", use: "Load a user and their settings at the same time.",
      avoid: "When one failure should not stop the rest (use allSettled), or when one request needs the answer of another.",
      note: "It fails fast: it rejects as soon as one promise rejects. The others keep running, but their results are dropped. Promise.all([]) fulfils with []." },
    { id: "allSettled", name: "Promise.allSettled", short: "all, with a report", w: "M", picture: combPic("allSettled"), lang: "js", example: C.allSettled.example,
      problem: "Wait for all promises and learn what happened to each one.", use: "Upload five files and show which ones failed.",
      avoid: "When you want to stop at the first problem. You must check each result's status yourself.", note: "It does not reject because one promise failed. Each result is { status, value } or { status, reason }." },
    { id: "race", name: "Promise.race", short: "first to settle", w: "M", picture: combPic("race"), lang: "js", example: C.race.example,
      problem: "Take the first promise that settles, whether it succeeds or fails.", use: "A timeout: race your request against a timer that rejects.",
      avoid: "To get the first success (use any). The losers are not cancelled; they keep running.",
      note: "Promise.race([]) never settles." },
    { id: "any", name: "Promise.any", short: "first success", w: "L", picture: combPic("any"), lang: "js", example: C.any.example,
      problem: "Take the first promise that is fulfilled, and ignore failures until all of them fail.", use: "Ask three mirror servers and use the first good answer.",
      avoid: "When you need every result. If all promises fail, you get an AggregateError (one error that holds the list of all the errors, in .errors).",
      note: "Promise.any([]) rejects at once with an AggregateError." },
    { id: "abort", name: "AbortController", short: "cancel", w: "H", picture: combPic("abort"), lang: "js", example: C.abort.example,
      problem: "Cancel work that you no longer need, like an old request.", use: "Search boxes, leaving a page, and timeouts. Pass the signal to fetch(url, { signal }).",
      avoid: "Do not treat AbortError as a real error: catch it and stay quiet. A signal from AbortSignal.timeout() gives TimeoutError, so check for that name too.",
      note: "A promise itself cannot be cancelled. The code that does the work must listen to the signal. (waitFor above is a tiny example of that.)" },
    { id: "withResolvers", name: "Promise.withResolvers", short: "resolve from outside", w: "L", picture: combPic("withResolvers"), lang: "js", example: C.withResolvers.example,
      problem: "Make a promise and keep its resolve and reject functions outside, in your hands.", use: "When the answer comes later from an event or a callback somewhere else.",
      avoid: "When a normal new Promise or an async function does the job. It is a newer feature: check support for your users (the card's button tells you about this browser), or write the three lines yourself." },
  ];

  /* ---------- 10. Retry with backoff ---------- */
  function explainRetry(rep) {
    const a = rep["Retry until it works"];
    const b = rep["A new query cancels the retry"];
    if (!a || !b) return h("p.result-say", "One of the two parts did not report. Press Reset to get the original code back.");
    const total = a.waits.reduce((x, w) => x + w.wait, 0);
    return Book.resultCard({
      title: "The waits your retry chose",
      rows: a.waits.map((w) => ({ label: `Wait ${w.n}: a random time up to ${w.cap} ms`, value: w.wait, text: `${w.wait} ms` })),
      sentences: [
        `The task failed ${a.calls - 1} times and worked on call ${a.calls}. The waits were ${a.waits.map((w) => w.wait).join(", ")} ms (${total} ms in total).`,
        `Each wait is a random number between 0 and a cap. The cap doubles each time (${a.waits.map((w) => w.cap).join(", ")}), so a struggling server gets more room.`,
        `Part two: a new query cancelled the retry when the 2nd wait began. The task ran only ${b.calls} times, and the retry ended with ${b.outcome}. Without the cancel it would try up to 5 times.`,
      ],
      note: "Why random? If 1,000 users all retry after exactly 20 ms, they hit the server together again. Random waits spread them out. This is called jitter.",
    });
  }

  /* ---------- 11. From your work: Speako ---------- */
  const SEAT_NOTE = [
    h("b", "Honest note. "),
    "The idea is the standard optimistic update from React Query (save the old state, show the guess, restore on error, refetch to confirm). Here the old state is kept in a zustand store, and the refetch runs inside mutationFn. The film is a small model of the idea, not the real hook. ",
    "Authorship: your project notes say Speako authorship needs proof. In this checkout, git shows one commit on this file (“redesign phase 13”, 23 Apr 2026) under the name Mina-Massoud, but the project has many authors. A commit name does not show who wrote each line. ",
    h("b", "Be ready to say which parts you wrote, which you adapted from the docs, and which came from AI."),
  ];

  /* ---------- 12. On the job ---------- */
  const TICKET_CODE = `function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(\`/api/search?q=\${encodeURIComponent(query)}\`)
      .then((res) => res.json())
      .then((data) => setResults(data));
  }, [query]);

  return (/* an input bound to query, and a list of results */);
}`;
  const FIXED_CODE = `useEffect(() => {
  const controller = new AbortController();
  fetch(\`/api/search?q=\${encodeURIComponent(query)}\`, { signal: controller.signal })
    .then((res) => res.json())
    .then((data) => setResults(data))
    .catch((err) => { if (err.name !== "AbortError") setError(err); });
  return () => controller.abort(); // runs before the next effect, and when the component goes away
}, [query]);`;
  const TEST_CODE = `// An example, not run on this page. The idea is run by this lesson's own test, with a small fake clock.
it("shows the results of the newest query", async () => {
  vi.useFakeTimers();
  fakeServer.reply("re", { after: 400 });   // the old query answers slowly
  fakeServer.reply("rea", { after: 100 });  // the new query answers fast
  render(<Search />);
  type("re");
  await vi.advanceTimersByTimeAsync(60);
  type("rea");
  await vi.advanceTimersByTimeAsync(500);
  expect(screen.getByText("results for rea")).toBeVisible();
});`;

  /* ---------- 13. Interview questions (only the sourced ones in research/interview-questions.md) ---------- */
  const PA_ONLY = D.PA_IMPL.split("\n").slice(0, 15).join("\n");
  const IQ = [
    {
      q: "“Understanding Promises and async/await” and “Implement an Event Manager”.",
      type: "concept", level: "UI Eng 2", source: { company: "Flipkart", year: "Mar 2025", url: "https://roundz.substack.com/p/interview-experience-flipkart-frontend-engineer-sde2" },
      testing: "A clear mental model of promises, and a small API design.",
      answer: [
        "A promise is an object for a result that is not ready yet. It starts pending, then settles once: fulfilled with a value, or rejected with an error.",
        "promise.then(fn) runs fn when it is fulfilled and returns a NEW promise. Handlers run later, as microtasks, after the current code. If a handler returns a promise, the next promise waits for it.",
        "An error skips the .then steps until a .catch. async/await is the same thing written top to bottom: an async function always returns a promise, await waits for one, and try/catch catches a rejection.",
        "Event manager: keep a map from event name to a set of functions. on() adds one and returns an unsubscribe function. emit() calls every function with the arguments.",
        Book.code(D.EMITTER_SRC),
      ],
    },
    {
      q: "Implement promiseAll. Also: implement a HOC that awaits promise props and passes the resolved values to your component.",
      type: "coding", level: "senior", source: { company: "ServiceTitan", year: "Sep 2025", url: "https://www.jointaro.com/interviews/companies/servicetitan/experiences/senior-frontend-engineer-canada-september-1-2025-no-offer-positive-1190b77e/" },
      testing: "Promise mechanics and React composition.",
      answer: [
        "Say the three rules first: keep the order, reject on the first failure, and resolve with [] for an empty list. Then write it. (You can try it on page 07: it is checked against the real Promise.all.)",
        Book.code(PA_ONLY),
        "promiseAll should also accept plain values and any iterable (that is why it uses Promise.resolve(item) and Array.from).",
        "The HOC: it receives props where some values are promises. It keeps the resolved values in state, starts with a loading view, and runs Promise.all on the promise props in an effect. Show an error view if it rejects. In the effect cleanup, ignore a late answer (so an old answer cannot overwrite a new one).",
        "Promise props that are new on every render make the effect run in a loop. Depend on stable props, or on a key.",
      ],
    },
    {
      q: "Debug a React component whose fetched results sometimes do not match the current input, although each response is correct. Reproduce the timing bug, fix the effect, handle cancellation errors, and verify with a deterministic test.",
      type: "debugging", source: { company: "Tradedesk", year: "Sep 2026", url: "https://prachub.com/interview-questions/debug-a-frontend-component-that-shows-wrong-api-results" },
      testing: "Race-condition diagnosis.",
      answer: [
        "Name it first: a race condition. Responses can arrive in a different order than the requests. Page 09 shows it with real timers.",
        "Reproduce it: slow one request on purpose (throttling, or a fake server with delays), type two queries fast. Fix the effect: return a cleanup that calls controller.abort() so the old request stops. In the catch, ignore AbortError and report everything else. A simple alternative is a flag (let ignore = false; cleanup sets ignore = true) that makes the old then do nothing.",
        "Verify with a test that does not depend on real time: fake timers, a fake server that answers the old query slowly, and an expectation that the screen shows the newest query's results.",
      ],
    },
    {
      q: "Resilient autocomplete fetching: debounce, latest-result-wins, retry with backoff and jitter (a new query cancels the retry sequence), caching with TTL and eviction.",
      type: "coding", level: "senior?", source: { company: "Databricks", year: "Apr 2026", url: "https://prachub.com/interview-questions/implement-resilient-autocomplete-data-fetching" },
      testing: "Treating timers and requests as lifecycle state that can be cancelled.",
      answer: [
        "Each piece has one job. Debounce: wait until the user stops typing, so fewer requests start. Latest result wins: one AbortController per query; start the new one, abort the old one. Retry: wait a random time up to a cap that doubles (backoff with jitter).",
        "The key link: give the SAME abort signal to the request and to the retry sleep. A new query aborts it, so the request stops and the retry waits stop too. Pages 09 and 10 build both parts.",
        "Retry only errors that can go away (network failure, 503, 429), never a 400 or 404. Respect a Retry-After header if there is one.",
        "Cache with a TTL: store the answer with a time, serve it while it is fresh, and drop the oldest entries when the cache is full. Cache the final answer for a query, never a half-finished one.",
      ],
    },
    {
      q: "Build a React UI against an undocumented API, using coding agents deliberately: inspect the real response shape, caching, and manual verification.",
      type: "machine-coding", source: { company: "Stripe", year: "Jun 2026", url: "https://prachub.com/interview-questions/build-and-optimize-a-react-interface-against-an-undocumented-api" },
      testing: "Verification discipline over trusting generated code.",
      answer: [
        "Look at real responses first (the Network tab, or a quick script) and write down the shape: field names, null values, errors, empty lists. Do not trust a guessed shape, from an AI or from anyone.",
        "Then handle the cases that async code forgets: loading, error, empty, and an old response arriving late. Check the result by hand in the browser. Read every line the agent wrote and be able to explain it. (The page for this report gives no more detail, so this is a way to approach it, not a list of what they asked.)",
      ],
    },
    {
      q: "API Client: a chainable, fetch-based client.",
      type: "coding", source: { company: "Atlassian", year: "no year given", url: "https://www.greatfrontend.com/interviews/company/atlassian/questions-guides" },
      testing: "Not described in the source. Promise handling and API design are the likely themes.",
      answer: [
        "The source lists only the title, so there are no details to quote. Practice the parts you can predict: a base URL, get/post methods that return promises, JSON in and out, and errors.",
        "Chainable means config methods like .baseUrl() and .header() return the client, so you can chain them. The last call (.get or .post) returns a promise. A good design returns a NEW client each time, so a shared client is never changed.",
        "One fact to remember: fetch rejects on a network failure or an abort, but not on a 404 or 500. Those still give a fulfilled promise, so check response.ok yourself and throw.",
      ],
    },
  ];
  const PQ = [
    {
      q: "Promise.all or Promise.allSettled: what happens when one of three promises fails?",
      type: "concept", source: { label: "Practice question (not from a report)" },
      testing: "Knowing fail-fast, and choosing the right tool.",
      answer: [
        "Promise.all rejects as soon as one promise rejects, with that error. Promise.allSettled waits for all three and gives each status. This is the result of running both with one failing promise:",
        Book.code(D.PRACTICE.allVsSettled),
        h("p.as-out", h("b", "Output: "), D.PRACTICE_EXPECT.allVsSettled.join("  |  ")),
      ],
    },
    {
      q: "Why does await inside forEach not wait for the loop?",
      type: "concept", source: { label: "Practice question (not from a report)" },
      testing: "Understanding that forEach ignores the promises its callback returns.",
      answer: [
        "forEach calls your async function for each item and throws away the promise it returns. So the loop ends at once, and the work finishes later. Use for...of with await (one by one), or Promise.all with map (together).",
        Book.code(D.PRACTICE.forEach),
        h("p.as-out", h("b", "Output: "), D.PRACTICE_EXPECT.forEach.join("  |  ")),
      ],
    },
    {
      q: "What does an async function return when it throws?",
      type: "concept", source: { label: "Practice question (not from a report)" },
      testing: "Knowing that async functions turn throws into rejections.",
      answer: [
        "A rejected promise. The call itself does not throw: awaiting the promise throws, but a try/catch around the call without await catches nothing (the second try prints nothing).",
        Book.code(D.PRACTICE.throwsInAsync),
        h("p.as-out", h("b", "Output: "), D.PRACTICE_EXPECT.throwsInAsync.join("  |  ")),
      ],
    },
  ];

  Book.registerLesson("js-async", {
    mount(root) {
      root.append(
        prereqs([
          ["Callback", "A function you give to another function, to be called later. The function inside setTimeout is a callback."],
          ["Event loop", "The browser runs one job at a time. When the stack is empty it picks the next job. Promise callbacks (microtasks) go before timers."],
          ["Request and response", "Your page asks a server for data (the request) and gets an answer later (the response). It can be slow or fail."],
        ]),
        step({
          n: "01", title: "What is a promise?",
          lines: [
            ["A ", word("promise", "An object for an answer that is not ready yet. Later it holds a value or an error."), " is like a pager in a restaurant. The answer comes later."],
            ["It starts ", word("pending", "Still waiting for the answer."), ". Then it ", word("settles", "Stops waiting, once and for all. It becomes fulfilled or rejected."), ": ", word("fulfilled", "Finished well. The promise holds a value."), " or ", word("rejected", "Failed. The promise holds an error."), "."],
            "Press Next under the picture.",
          ],
          demo: V.pager(), links: [L.lydia, L.jsinfo],
        }),
        step({
          n: "02", title: "Watch a promise chain",
          lines: [
            ["Every ", word(".then", "A method of a promise. It takes a function and runs it when the promise is fulfilled. The function you give it is called a handler. It gives back a new promise.")," gives you a NEW promise, right away."],
            "An error skips the .then steps until a .catch handles it.",
            "Press play, pause, or drag the bar. Every state comes from a model that is checked against real promises.",
          ],
          demo: V.film(), links: [L.lydia, L.tmqs, L.ydkjs],
        }),
        step({
          n: "03", title: "Your turn: follow the chain",
          lines: ["Read each line and decide what the next promise becomes.", "Each line is called on the promise above it: p1 = p0.then(...). After each guess, you see the reason.", "At the end, the real code runs in your browser."],
          demo: V.chain(), links: [L.lydia, L.jsinfo],
        }),
        step({
          n: "04", title: "async/await is promises",
          lines: [
            ["An ", word("async function", "A function that always returns a promise. Inside it, you can use await."), " lets you write promises from top to bottom."],
            ["Inside, ", word("await", "Pauses this function until a promise settles. Then it gives you the value, or throws the error."), " waits for a promise. try/catch catches a rejection."],
            "Press Next. The two versions are shown side by side.",
          ],
          demo: V.pair(), links: [L.lydia, L.jsinfo, L.ydkjs],
        }),
        step({
          n: "05", title: "Where does await pause?",
          lines: ["await pauses the function. It does not pause the page.", "Watch a timer tick while the function waits. Then see when the rest of the function runs.", "Both parts run real code."],
          demo: V.pause(), links: [L.tmqs, L.loop],
        }),
        step({
          n: "06", title: "One by one, or all together?",
          lines: ["Three requests do not need each other. Should they wait in line?", "You will guess, then run the real timers. At first, each request is a timer of 100 ms.", "The bars are drawn from measured times."],
          demo: V.parallel(), links: [L.jsinfo, L.feih],
        }),
        step({
          n: "07", title: "Write Promise.all yourself",
          lines: ["Three rules: keep the order, fail fast, and handle an empty array.", "The code already works. Edit only promiseAll: the checks below it are only the test. Press Run to compare it with the real Promise.all.", "Then break it on purpose and see which case catches you."],
          demo: runnable({ title: "Your promiseAll", code: D.PA_IMPL + D.PA_HARNESS, rows: 30, explain: explainPA }), links: [L.feih, L.gfe, L.jsinfo],
        }),
        step({
          n: "08", title: "The combinators",
          lines: ["Promise.all is one of several tools. Each one answers a different question.", "Pick a card. Most cards have a picture, and all have a real example you can run and a note on when not to use it.", "The helpers (later, fail, waitFor) are shown first."],
          demo: h("div.demo-stack",
            h("div.as-excerpt", h("span.label", "Helpers used in the cards"), Book.code(D.HELPERS_SRC)),
            Book.hubSpoke({ title: "Which promise tool, and when", items: HUB })),
          links: [L.jsinfo, L.feih],
        }),
        step({
          n: "09", title: "Latest result wins",
          lines: [
            ["You type in a search box. Answers can arrive in a different order than the requests. This is a ", word("race condition", "A bug that depends on which of two things finishes first."), "."],
            "The page runs real timers, so you can see the bug, then two fixes.",
            "A candidate reported this question from a Tradedesk interview, Sep 2026.",
          ],
          demo: V.latest(), links: [L.mightNot, L.effect],
        }),
        step({
          n: "10", title: "Retry with backoff and jitter",
          lines: [
            ["When a request fails, wait and try again. The longest possible wait doubles each time: that is ", word("exponential backoff", "A limit on the wait that doubles after each failure: 20 ms, 40 ms, 80 ms..."), "."],
            [word("Jitter", "A random part in the wait, so many clients do not retry at the same moment."), " makes the real wait a random time below that limit, so many clients do not retry together."],
            "Read the comments in the code first. Then press Run: it waits less than half a second.",
          ],
          demo: runnable({ title: "Retry with backoff", code: D.RETRY_IMPL + D.RETRY_DEMO, rows: 34, explain: explainRetry }), links: [L.feih, L.gfe],
        }),
        step({
          n: "11", title: "From your work: Speako seat booking",
          lines: [
            "In Speako, dropping a booking on a table shows it at once, then the server confirms or the screen goes back.",
            ["It is an ", word("optimistic update", "Show the expected result at once. Take it back if the server says no."), ": the screen may be wrong for a moment, so we must be able to take the guess back."],
            "Read the real code, then watch the film.",
          ],
          demo: h("div.demo-stack",
            h("div.as-excerpt",
              h("p.as-note", word("onMutate", "A React Query option. It runs before the request starts, so you can show the guess."), " saves the old state of the table and shows the guess (pending: true). The API call runs in mutationFn. If it fails, ", word("onError", "A React Query option. It runs when the request fails."), " puts the saved state back. On success, the refetch brings the confirmed booking."),
              h("span.label", `${D.SEAT_FILE}, lines 82-96`), Book.code(D.SEAT_EXCERPTS[0].text.join("\n")),
              h("span.label", "lines 133-140"), Book.code(D.SEAT_EXCERPTS[1].text.join("\n"))),
            V.seatFilm(),
            h("p.as-note", ...SEAT_NOTE)),
          links: [L.gfeSD],
        }),
        step({
          n: "12", title: "On the job",
          lines: ["A ticket arrives. Read it, think about your steps, and then compare."],
          demo: Book.onTheJob({
            id: "SPK-310", title: "The search shows results for an old query",
            context: "A realistic ticket, made up for practice. Support says: “I type a customer name in the search box, but the list sometimes belongs to what I typed before.” It is rare on the office network and common on mobile.",
            symptoms: ["The bug is random: it depends on how fast each answer comes back.", "The network tab shows two requests; the older one finishes last.", "There is no error in the console."],
            code: TICKET_CODE,
            tasks: ["Reproduce the bug on purpose.", "Fix it, and keep the console clean.", "Add a test that does not depend on real time."],
            steps: [
              "Reproduce it. In DevTools, throttle the network (for example Slow 4G) and type two queries fast. Or add a delay to one request in a fake server. Look at the order of the responses in the Network tab: the old one comes last.",
              "Read the effect. Every time query changes, the effect starts a new request. Nothing stops the old one, and its last .then still calls setResults. Whichever answer arrives last wins.",
              ["Add cancellation with a cleanup function. The cleanup runs before the next effect, so each new query cancels the old request. (A flag named ignore, set in the cleanup, is a simple alternative: the old .then does nothing.)", Book.code(FIXED_CODE)],
              "Handle AbortError quietly. Aborting is on purpose, so it must not show an error message or fill the logs. Report every other error as usual.",
              ["Add a deterministic test. Use fake timers and a fake server, so the test does not wait for real time and never fails by chance.", Book.code(TEST_CODE)],
              "Check the result by hand with throttling on, and look for the same pattern (a fetch inside an effect, with no cleanup) in other components.",
            ],
          }),
          links: [L.mightNot, L.effect],
        }),
        step({
          n: "13", title: "Real interview questions",
          lines: ["These were reported by real candidates. The company, date and link are on each card.", "Try each one out loud first, then open the answer.", "Below them: practice questions that are not from a report."],
          demo: h("div.demo-stack",
            Book.interviewQuestions(IQ),
            h("h3.as-sub", "Practice questions (not from a report)"),
            Book.interviewQuestions(PQ)),
          links: [L.feih, L.gfe, L.jsinfo],
        }),
        step({
          n: "14", title: "In one sentence",
          lines: ["A promise is an answer that arrives later, and it settles only once."],
          demo: h("ol.as-rule",
            h("li", h("span", h("b", "A promise settles once"), ": fulfilled with a value, or rejected with an error.")),
            h("li", h("span", h("b", "Every .then and .catch makes a new promise"), ". An error skips .then steps until a .catch.")),
            h("li", h("span", h("b", "async/await is the same promises"), ", and await pauses only its own function.")),
            h("li", h("span", h("b", "Independent work goes together"), " (Promise.all). Dependent work goes in order.")),
            h("li", h("span", h("b", "Late answers lie"), ": ignore them with an id, or cancel them with AbortController. Retry with backoff, jitter and a cancel."))),
          links: [L.lydia, L.tmqs, L.ydkjs],
        }),
      );
    },
  });
})();
