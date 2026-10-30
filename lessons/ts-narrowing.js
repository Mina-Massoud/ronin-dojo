/* Lesson: Types, unions and narrowing (Wave 3, Part B).
   Order: will this compile? -> the type narrows (film + predict) -> any vs unknown -> write a type guard -> why three fields go wrong ->
   discriminated union + exhaustive switch -> the ways to narrow (hub) -> your work -> on the job -> interview -> one sentence.
   Every error code, message and "type of v here" on these pages is stored in ts-narrowing.data.js and re-checked against the real
   TypeScript compiler (7.0.2) by dev/ts-narrowing.test.js. Everything that runs, runs live here as JavaScript with the types removed. */
(function () {
  const { h, word, step, runnable, prereqs, icon } = Book;
  const V = Book.parts["ts-narrowing"];
  const D = V.data;
  const F = D.FACTS;

  /* ---------- Go deeper links: the two from research/frontend-syllabus.md, and official pages fetched for this lesson ---------- */
  const L = {
    narrowing: { title: "TypeScript Handbook: Narrowing", url: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html", type: "doc", by: "typescriptlang.org" },
    basics: { title: "TypeScript Handbook: The Basics", url: "https://www.typescriptlang.org/docs/handbook/2/basic-types.html", type: "doc", by: "typescriptlang.org" },
    everyday: { title: "TypeScript Handbook: Everyday Types", url: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html", type: "doc", by: "typescriptlang.org" },
    ts55: { title: "TypeScript 5.5 release notes: inferred type predicates", url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html", type: "doc", by: "typescriptlang.org" },
    ts49: { title: "TypeScript 4.9 release notes: satisfies, and in on unknown", url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html", type: "doc", by: "typescriptlang.org" },
    ts37: { title: "TypeScript 3.7 release notes: assertion functions", url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html", type: "doc", by: "typescriptlang.org" },
    typeofMdn: { title: "MDN: the typeof operator", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof", type: "doc", by: "MDN" },
    fetchMdn: { title: "MDN: Using the Fetch API", url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_fetch", type: "doc", by: "MDN" },
    gfeTs: { title: "TypeScript interview questions for senior frontend developers", url: "https://www.greatfrontend.com/blog/typescript-interview-questions-for-senior-frontend-developers", type: "article", by: "GreatFrontEnd (a prep guide)" },
  };

  /* ---------- small helpers ---------- */
  const note = (...kids) => h("p.tn-text", ...kids);
  const stack = (...kids) => h("div.demo-stack", ...kids);
  const tsBlock = (text) => h("pre.code-block.tn-block", { html: V.tsHtml(text) });
  const probeNotes = (id) => {
    const sn = D.SN[id];
    const list = sn.probes || [];
    return list.length ? h("ul.tn-probes", list.map(([line, expr, members]) => h("li", `line ${line}: `, h("code", expr), " is ", h("code", V.typeText(members))))) : null;
  };
  /* A snippet with its real compiler answer, its probes, and (when it runs) buttons that run it live. */
  function proof(id, { compact = false, lit } = {}) {
    const sn = D.SN[id];
    const cb = V.codeBox();
    cb.show(id, { errors: true, lit });
    const tsc = V.tscBox();
    tsc.run(id);
    const out = V.outBox();
    const side = [tsc.el, probeNotes(id)];
    if (sn.run) {
      const runs = (sn.cases || [{ id: "", call: "Run it" }]).map((c) => {
        const b = h("button.chip", { type: "button" }, icon("play", 12), sn.cases ? c.label || c.call : "Run it in this browser");
        b.addEventListener("click", async () => out.show(c.id ? await D.runCase(id, c.id) : await D.runSnippetJs(id)));
        return b;
      });
      side.push(h("div.tn-runs", runs), out.el);
    }
    return h("div.tn-proof" + (compact ? ".compact" : ""), cb.el, h("div.tn-proofside", side));
  }
  const excerpt = (key) => {
    const ex = D.SPEAKO[key];
    const ranges = ex.parts.filter((p) => p.from).map((p) => (p.from === p.to ? `${p.from}` : `${p.from}-${p.to}`)).join(", ");
    return h("div.tn-excerpt", h("span.label", `speako-web/${ex.file.replace("(app)/(dashboard-layout)/", "…/")} · lines ${ranges}`), tsBlock(ex.parts.map((p) => p.text || p.gap).join("\n")));
  };

  /* ---------- 04. The runnable: write isUser ---------- */
  function explainGuard(results) {
    const r = results.isUser;
    if (!r) return h("p.result-say", "The test did not report. Press Reset to get the original code back.");
    const checks = D.isUserChecks(r);
    const pass = checks.filter((c) => c.ok).length;
    const bad = checks.find((c) => !c.ok);
    return Book.resultCard({
      title: "What happened",
      rows: checks.map((c) => ({ label: c.label, value: c.ok ? 1 : 0.05, text: `${c.ok ? "pass" : "not yet"} · ${c.got}` })),
      sentences: [pass === checks.length ? `All ${checks.length} checks pass.` : `${pass} of ${checks.length} checks pass. Next: ${bad.label} (${bad.got}). Fix the TODO, then press Run again.`],
      note: `A wrong guard lies to the compiler, and the compiler believes it. A guard that always says yes passes tsc, and the next line then fails: ${r.crash}. This was a live run.`,
    });
  }
  const solutionText = () => { const p = D.isUserParts(); return p.head + p.body + p.tail; };

  /* ---------- 07. Ways to narrow (hub and spoke) ---------- */
  const typeofTrap = () => h("div.tn-text", note(h("b", "Trap, run it: "), "these four lines print what typeof gives for null, an array, undefined and a function."), proof("typeofTraps", { compact: true }));
  const HUB = [
    { id: "typeof", name: "typeof", short: "string, number, boolean", w: "H", picture: () => stack(proof("hubTypeof", { compact: true }), typeofTrap()),
      problem: "Tell strings, numbers and booleans apart.", use: "A value can be a string or a number and you must treat them differently.",
      avoid: "typeof null is \"object\", and so is typeof of an array. Do not use it to find null or arrays." },
    { id: "truthy", name: "Truthiness", short: "if (name)", w: "H", picture: () => proof("hubTruthy", { compact: true }),
      problem: "Drop null and undefined with a short check.", use: "An optional value where an empty string or 0 is not a real answer.",
      avoid: "The check also drops \"\", 0 and NaN. Press greet(\"\"): an empty name is treated as missing. Look at line 4 too: after the block, name is still string | null." },
    { id: "equal", name: "Equality", short: "=== and == null", w: "H", picture: () => proof("hubEqual", { compact: true }),
      problem: "Remove null or undefined, or keep one exact value.", use: "s == null tests for null and undefined together: a common accepted use of ==. Also a === b: when both sides are unions, each side keeps only the types they share (press same).",
      avoid: "Do not use == for anything else. It converts values before it compares them (see the values lesson)." },
    { id: "in", name: "in", short: "\"swim\" in pet", w: "M", picture: () => stack(proof("hubIn", { compact: true }), proof("inTrap", { compact: true })),
      problem: "Tell object types apart by which properties they have.", use: "Union members with different property names, like Fish and Bird.",
      avoid: "If both members can have the property, even as optional, in cannot tell them apart. In the second code, x stays A | B inside the block." },
    { id: "instanceof", name: "instanceof", short: "e instanceof Error", w: "H", picture: () => stack(proof("hubInstanceof", { compact: true }), note("Under strict, the error in a catch block is unknown (compiler-checked):"), proof("catchUnknown", { compact: true })),
      problem: "Tell class instances apart: Error, Date, your own classes.", use: "With strict on, the error in a catch block is unknown. Check instanceof Error before you read e.message.",
      avoid: "An object from JSON is only a plain Object, never an Error or your class (press the second call). An Error from another iframe or window has a different Error class, so instanceof Error is false." },
    { id: "tag", name: "Tag property", short: "s.kind === \"circle\"", w: "H", picture: () => stack(proof("hubDisc", { compact: true }), proof("discTrap", { compact: true })),
      problem: "Pick one member of a union by a shared field with a fixed value.", use: "UI states, API results, Redux-style actions: any union with a kind, type or status field.",
      avoid: "The field must hold fixed values, like \"circle\", not just string. With type: string (second code) the check cannot tell A from B, and the compiler says so." },
    { id: "guard", name: "Type guard", short: "x is User", w: "H", picture: () => proof("hubGuard", { compact: true }),
      problem: "Check a shape that the built-in checks cannot express.", use: "Data from outside your code: JSON, localStorage, a message from another window.",
      avoid: "The compiler trusts your guard and does not check it. A guard that returns true every time compiles fine (page 04 shows the crash)." },
    { id: "asserts", name: "Assertion function", short: "asserts x is T", w: "L", picture: () => stack(proof("hubAsserts", { compact: true }), proof("assertsTrap", { compact: true })),
      problem: "Check, and throw if wrong, so every line after it can rely on the type.", use: "A rule that must hold, where a failure is a programmer mistake.",
      avoid: "It throws, so it is a poor fit for input that is often wrong. And every name in the call must have an explicit type: the arrow function in the second code has none." },
    { id: "satisfies", name: "satisfies", short: "check, do not widen", w: "M", picture: () => proof("hubSatisfies", { compact: true }),
      problem: "Check a value against a type, but keep the value's own exact type.", use: "Route tables and config objects: you want typos found and the keys remembered.",
      avoid: "It does not narrow. It checks the value and does not change its type. If you want the value to have the wide type, use an annotation." },
    { id: "as", name: "as", short: "not narrowing", w: "H", picture: () => stack(proof("hubAs", { compact: true }), proof("asTrap", { compact: true })),
      problem: "Tell the compiler a type with no check at all.", use: "Rarely. For example as the first line of a type guard, when the next lines check every field yourself.",
      avoid: "as checks nothing at run time. Run the first code: it compiles and crashes. It only blocks casts between types that do not overlap, like number as string." },
  ];

  /* ---------- 09. On the job ---------- */
  const caseOf = (id, c) => F[id].cases[c];
  const fmtRes = (r) => (r.error ? `${r.error.name}: ${r.error.message}` : JSON.stringify(r.value));
  const msgOf = (id, c) => fmtRes(caseOf(id, c));
  const loadLine = (c) => { const v = caseOf("loadUsers", c).value; return v.status === "error" ? `error, "${v.message}"` : "success, 2 users"; };

  /* ---------- 10. Interview questions (only the sourced ones in research/interview-questions.md, ts-types) ---------- */
  const IQ = [
    {
      q: "Implement a publish-subscribe event bus in JavaScript or TypeScript.",
      type: "coding", source: { company: "Tradedesk", year: "Sep 2026", url: "https://prachub.com/interview-questions/implement-a-publish-subscribe-event-bus-in-javascript-or-typescript" },
      testing: "Typed API design. (The typing angle is this lesson's reading, not stated on the page: it only says JavaScript or TypeScript, so treat that part as unverified.)",
      answer: () => [
        "A publish-subscribe bus lets one part of the app announce an event and other parts listen for it, without knowing each other. Start with the behavior: subscribe(type, handler) returns an unsubscribe function, and publish(event) calls every handler of that type, in the order they subscribed. Then add the types: the events are a discriminated union, so the type field tells them apart.",
        proof("bus", { compact: true }),
        "Say the edge case: publish loops over a copy of the handlers. Without the copy, a handler added during publish also runs in that same publish (a loop over a Set sees it), and if the handlers live in an array, removing one can skip the next. Press \"a handler unsubscribes itself\" above: a and b run, then only b.",
        "Three more things to say. Subscribing the same function twice collapses to one entry in a Set, and one unsubscribe removes it (the Emitter in the next answer shows it). A handler that throws stops the handlers after it, so a real bus catches errors per handler. And when the last handler of a type leaves, remove the empty Set so the Map does not grow.",
        "The follow-up an interviewer asks next: can the handler for \"login\" know its event is a login? With the simple signature it cannot, and the compiler says so (first code below). You either check e.type inside the handler, or type the bus with an event map, so that each event name has its own payload (second code; K is a placeholder type, the next lesson explains it).",
        proof("busUse", { compact: true }),
        proof("busMap", { compact: true }),
        "The error on line 12 is the point: a logout event has no userId, so the compiler stops you. Line 11 is fine.",
      ],
    },
    {
      q: "Implement an event emitter.",
      type: "coding", source: { company: "Snowflake", year: "Jan 2026", url: "https://prachub.com/coding-questions/implement-an-event-emitter" },
      testing: "Whether you can build on/off/emit and keep the edge cases right. (Only the title of this report was available, so the exact task is not known.)",
      answer: () => [
        "It is the same shape as the bus above, with an event map type. Keep a Map from event name to a Set of handlers. on adds, off removes, emit calls every handler. Returning the unsubscribe function from on is the neat way to support off.",
        proof("emitter", { compact: true }),
        "Press the four buttons: the same function added twice runs once, and one off removes it. A throwing handler is caught, so the next one still runs. once wraps the handler, so off(original) must still work: the wrapper remembers the original. An empty Set is removed from the Map.",
        "Where TypeScript helps: the last line of the code is a compile error, because 5 is not a { userId: string } payload. The public methods are fully checked. A cast or two stay inside the class, where the Map stores handlers of many types; say that out loud, and say why. Generics (K, E) are the next lesson.",
      ],
    },
  ];
  const resolveAnswer = (a) => (typeof a === "function" ? a() : a);
  const unkErr = F.unkList.errors[0];
  const PRACTICE = [
    { q: "What is the difference between any and unknown?", a: [`Both can hold anything. any switches the checks off: ${F.anyList.errors.length} compile errors for data.users, then a crash at run time. unknown keeps them on: the same line is error ${unkErr.code} (${unkErr.msg}) until you narrow.`, `They also differ in what you can assign them to. A value of type any can go into a string. A value of type unknown cannot: ${F.anyAssign.errors[0].code}, ${F.anyAssign.errors[0].msg}`, "Anything can be assigned to unknown or any. An unknown value can only go into unknown or any, until you narrow it."] },
    { q: "interface or type: what is a real difference?", a: ["Both describe object shapes. A real difference: two interfaces with the same name are merged into one. Two type aliases with the same name are an error.", `The compiler checked this: both type B lines give ${F.mergeIface.errors[0].code}: ${F.mergeIface.errors[0].msg} The two interface A lines are accepted.`] },
    { q: "What does never mean, and how does an exhaustive check use it?", a: [`never is the type of a value that cannot exist. After a switch handles every case, nothing is left, so the value is never. If you pass it to a function that takes never, a new unhandled case becomes a compile error: ${F.exh1.errors[0].code}, ${F.exh1.errors[0].msg}`, "Follow-up: types are gone at run time, so assertNever should also throw. That protects you from a server that sends a status the type does not know."] },
    { q: "Does JSON.parse(text) as User check anything?", a: [`No. as is a promise with no check. It compiles, and then crashes when you read a missing field. We ran it: ${fmtRes(F.hubAs.main)}`, "Use a type guard or a schema library at the edge, then use the checked value. Follow-up: res.json() also returns any (the compiler confirmed it), so every fetch result needs the same care."] },
    { q: "If TypeScript checks my types, why validate an API response?", a: ["The types are removed before the code runs. The server can send anything, and the compiler never saw the server. Press \"Show the JavaScript that runs\" on any code that has the button: there are no types left.", "So check at the edge once (a type guard or zod), return a union with an error state, and let the types protect the rest of the code."] },
  ];

  Book.registerLesson("ts-narrowing", {
    mount(root) {
      root.append(
        prereqs([
          ["Type", "A label for the kind of value: string, number, boolean. TypeScript checks the labels before the code runs."],
          ["Union", "A type with a choice. string | number means a string or a number."],
          ["Compile time and run time", "The compiler checks types first, on your computer. The browser runs the JavaScript later, with the types removed."],
          ["JSON", "Text that holds objects, arrays, strings and numbers. JSON.parse turns it into JavaScript values."],
        ]),
        step({
          n: "01", title: "Will TypeScript accept this function?",
          lines: [
            ["TypeScript checks the ", word("types", "A label for the kind of value, like string or number."), " in your code before it runs."],
            ["Here a value can be one of two types. That is a ", word("union type", "A type with a choice, written with |. For example string | number is a string or a number."), "."],
            ["Press Next under the picture. Guess first, then ask the real ", word("compiler", "The program that reads your TypeScript, checks the types and reports errors. It is called tsc."), "."],
          ],
          demo: stack(V.start(), note(h("b", "Where the answers come from: "), `the compiler messages on these pages were recorded from the real TypeScript compiler (tsc ${D.TSC_VERSION}, --strict). These answers are re-checked with tsc whenever the book changes. Your project's TypeScript may be older: error codes stay the same, and the wording can differ a little. The code that runs, runs live in your browser.`)),
          links: [L.basics, L.everyday],
        }),
        step({
          n: "02", title: "The type narrows as the code runs",
          lines: [
            "Press play and watch the lit line.",
            [word("Narrowing", "Making a type smaller in one part of the code. After typeof x === \"string\", x is a string."), ": every check removes types from what is left."],
            "Then guess the next types yourself, below the film.",
          ],
          demo: stack(V.film(), note(h("b", "Where this comes from: "), "each stop in the film is a real answer from the compiler for that line. The test adds a check to every stop, and tsc must agree."), V.predict()),
          links: [L.narrowing, L.basics],
        }),
        step({
          n: "03", title: "The same server answer, two ways",
          lines: [
            ["Data from outside, like JSON.parse, enters your code at the ", word("edge", "The place where outside data, like an API answer or JSON, enters your code."), ". TypeScript cannot know its shape."],
            [word("any", "A type that turns the checks off for a value."), " lets everything through. ", word("unknown", "A type that means: I do not know the shape yet. You must check before you use it."), " makes you check first."],
            ["You will use a ", word("type guard", "A check that tells TypeScript a value's type. typeof, in and instanceof are built in. You can write your own."), " to check the shape. Press Next under the picture."],
          ],
          demo: stack(V.anyUnknown(), note(h("b", "Not only JSON.parse: "), "await res.json() from fetch is also any. The compiler confirmed it:"), proof("resJson", { compact: true })),
          links: [L.narrowing, L.ts49],
        }),
        step({
          n: "04", title: "Write a type guard",
          lines: [
            ["A ", word("type guard", "A check that tells TypeScript a value's type. typeof, in and instanceof are built in. You can write your own."), " is a function that checks a value."],
            ["Its return type ", word("x is User", "A type predicate. Where the function returned true, TypeScript treats x as a User."), " is a promise to the compiler."],
            "Write the body, then press Run. The editor runs the same code with the types removed.",
          ],
          demo: stack(
            note(h("b", "In TypeScript: "), "this is the whole guard. The as tells the compiler to trust a type, with no check. It is fine here because the next line checks each field. Record<string, unknown> means an object with any text keys."),
            proof("isUserFn", { compact: true }),
            runnable({ title: "Write isUser()", code: D.isUserCode(false), rows: 28, explain: explainGuard }),
            h("details.tn-sol", h("summary", "Show one solution"), Book.code(solutionText())),
            note(h("b", "A wrong guard lies. "), "The compiler accepts any guard you write. This one always says yes, and it passes tsc (0 errors). Run it:"),
            proof("liar", { compact: true })),
          links: [L.narrowing, L.ts49],
        }),
        step({
          n: "05", title: "A screen with three separate fields",
          lines: [
            "Many screens keep isLoading, error and data as separate fields.",
            "Read the code, then count what it allows.",
            "Press Next under the picture. Guess first.",
          ],
          demo: stack(V.flags(), note(h("b", "Why a failed request can end up in the crash row: "), "fetch rejects only when the request cannot finish (for example, no network). An answer like HTTP 429 still resolves, and response.ok is false. If the code never checks ok, nothing sets error.")),
          links: [L.fetchMdn, L.everyday],
        }),
        step({
          n: "06", title: "Give each state its own shape",
          lines: [
            ["A ", word("discriminated union", "A union whose members share one field with different fixed values, like status. That field tells them apart."), " gives each state only its own fields."],
            "Press Next. Guess first.",
          ],
          demo: stack(V.union(), note(h("b", "A union can also come from a library: "), "zod's safeParse returns a result with a success field. It is a union too: check result.success, and then result.data has the type of your schema (checked with zod 3.25, the version in Speako).")),
          links: [L.narrowing, L.everyday],
        }),
        step({
          n: "07", title: "Eight ways to narrow, and two that only look like it",
          lines: ["Pick a card. Each one shows the real compiler answer, and when not to use it.", "Cards with buttons run the code in your browser."],
          demo: Book.hubSpoke({ title: "Ways to narrow a type", items: HUB }),
          links: [L.narrowing, L.ts55, L.ts37, L.typeofMdn],
        }),
        step({
          n: "08", title: "From your work: unknown data in, a union out",
          lines: [
            "Speako's floor plan reads saved JSON as unknown and builds a union from it.",
            "The billing page keeps one status field next to an optional message.",
            "Be ready to say which parts you wrote.",
          ],
          demo: stack(
            note(h("b", "Unknown in, checked union out. "), "coerceV3Shape takes raw: unknown and returns Shape | null. It checks the value is an object, reads the fields, and switches on raw.kind."),
            excerpt("coerce"), excerpt("isRecord"),
            note("Shape is a union with a kind tag (the fields are cut here to keep the picture short):"), excerpt("shape"),
            note("The selectors use a type predicate, so the result is TableShape[] and not Shape[]. Since TypeScript 5.5 the compiler can work this out alone. Both a and b in the code below give TableShape[] (the compiler confirmed it, in a simplified copy). It only works when the check proves the type both ways. x => !!x does not work for numbers, because 0 is also false. In that case write the x is T predicate yourself:"),
            excerpt("selector"), proof("speakoFilter", { compact: true }),
            note("The same idea with numbers (compiler-checked): a keeps number[] because x !== undefined proves the type both ways. b stays (number | undefined)[] because !!x is also false for 0. c has the explicit predicate:"),
            proof("filterInfer", { compact: true }),
            note(h("b", "A different shape, in the billing page. "), "status and errorMessage are two separate fields. This is the small version of page 05: the compiler accepts a success that carries an error message, and an error with no message."),
            excerpt("billing"), proof("flatTrial", { compact: true }),
            note(h("b", "Honest note: "), "unknown data checked by hand, and a union with a tag, are well-known patterns. Git blame puts the lines shown here in single commits under the name Mina-Massoud (the billing file has other commits under other names). A git name does not prove who wrote each line. Be ready to say which parts you wrote."),
          ),
          links: [L.narrowing, L.ts55],
        }),
        step({
          n: "09", title: "On the job",
          lines: ["A ticket arrives. Read the code, think about your steps, and then compare."],
          demo: stack(
            note(h("b", "The code in the ticket. "), "TypeScript shows 0 errors. A plain function stands in for the component, so the compiler can check it:"),
            proof("ticketBug", { compact: true }),
            Book.onTheJob({
              id: "PRACTICE-1", title: "The users page goes white when the API fails",
              context: "A practice ticket (not from a real tracker). Since the API started rate-limiting (HTTP 429 means too many requests), some people see a white screen on the users page. Support sends the console error.",
              symptoms: ["The screen goes white for some people, not for everyone.", `Console: ${msgOf("ticketBug", "429")}`, "The project compiles with no TypeScript errors."],
              tasks: ["Reproduce it without the real API.", "Make the impossible states impossible.", "Check the API answer once, at the edge.", "Add tests that fail before the fix."],
              steps: [
                `Reproduce: make fetch answer with HTTP 429 and call load() and render() from the ticket. We did this with a fake fetch: render throws ${msgOf("ticketBug", "429")}. The same run with a good answer prints "Amal, Omar", so the code only fails on the bad path.`,
                ["Find the cause: fetch does not reject on an HTTP error, so the 429 answer is treated as a success (", h("a", { href: L.fetchMdn.url, target: "_blank", rel: "noopener noreferrer" }, "MDN"), "). res.json() is any, so body.users is undefined and the compiler allows it. Nothing sets error, and isLoading is false. That is the crash row from page 05, and the ! in s.data! hid the compiler's only warning."],
                "Model the screen as a union with a status field: loading, error with an Error, success with data (page 06). Delete the three loose fields. A success without data can no longer be built.",
                "Make render() a switch on status with assertNever in the default branch. When someone adds a new status, the compiler points at this switch.",
                ["Check the answer once, at the edge. One function returns a State. It checks res.ok, checks the body with a type guard, and turns a network failure into an error state:", proof("loadUsers", { compact: true })],
                ["A schema library does the same job with less code. Speako already imports zod in src/types/scheduler/types/index.ts. One schema gives you the checker and the type (z.infer):", tsBlock(D.ZOD)],
                `Test it, including the bad paths. With a fake fetch, loadUsers gives: a good answer is ${loadLine("ok")}; HTTP 429 is ${loadLine("429")}; a user with no name is ${loadLine("shape")}; no network is ${loadLine("offline")}. Write these four as tests, and run them on the old code first to see them fail. Then search the project for other ! and as on API data.`,
              ],
            })),
          links: [L.fetchMdn, L.narrowing],
        }),
        step({
          n: "10", title: "Real interview questions",
          lines: ["These were reported by real candidates. The company, date and link are on each card.", "Honest gap: no candidate report asks about narrowing itself. These two are the closest reported prompts."],
          demo: stack(
            Book.interviewQuestions(IQ.map((it) => ({ ...it, answer: resolveAnswer(it.answer) }))),
            h("span.tn-sub", "Practice questions (not from a report)"),
            note("Two topics (interface vs type, any vs unknown) are on a prep guide's list. The other three are common questions chosen for this lesson. None is from a candidate report. The answers were checked with the compiler or by running the code."),
            Book.drill(PRACTICE)),
          links: [L.gfeTs, L.narrowing, L.everyday],
        }),
        step({
          n: "11", title: "In one sentence",
          lines: ["Narrowing turns a union into one real type, one check at a time, and the compiler keeps track."],
          demo: h("ol.tn-rule",
            h("li", h("span", h("b", "A check removes types"), ": inside the block you have the matches, and after a block that returns, they are gone.")),
            h("li", h("span", h("b", "Use unknown at the edge"), ": the compiler makes you check JSON and API answers before you use them.")),
            h("li", h("span", h("b", "Give each state its own shape"), ": a status field removes impossible states, and a never check makes the compiler find a missing case.")),
            h("li", h("span", h("b", "A guard or an as is a promise"), ": the compiler does not check it, so check the real thing yourself."))),
          links: [L.narrowing, L.everyday, L.basics],
        }),
      );
    },
  });
})();
