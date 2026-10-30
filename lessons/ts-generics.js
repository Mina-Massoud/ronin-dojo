/* Lesson: Generics and utility types (Wave 3, Part B).
   Order: any loses the type → a type flows through a generic (film) → inference → constraints → keyof →
   build Partial, Readonly, Pick → build ReturnType (conditional + infer) → write groupBy → utility types you will meet →
   puzzles → your work → on the job → interview → one sentence.
   Every error, inferred type and printed result comes from ts-generics.data.js, which dev/ts-generics.test.js checks with the real
   TypeScript compiler (tsc 7) and by running the code. A browser cannot run tsc, so the pages show the saved answers. */
(function () {
  const { h, word, step, runnable, prereqs, svg: S } = Book;
  const V = Book.parts["ts-generics"];
  const D = V.data;
  const SN = D.SNIPS;
  const { tgCode } = V;

  /* ---------- Go deeper links (research files, or typescriptlang.org pages fetched and confirmed while building) ---------- */
  const L = {
    generics: { title: "TypeScript Handbook: Generics", url: "https://www.typescriptlang.org/docs/handbook/2/generics.html", type: "doc", by: "typescriptlang.org" },
    keyof: { title: "TypeScript Handbook: The keyof type operator", url: "https://www.typescriptlang.org/docs/handbook/2/keyof-types.html", type: "doc", by: "typescriptlang.org" },
    mapped: { title: "TypeScript Handbook: Mapped types", url: "https://www.typescriptlang.org/docs/handbook/2/mapped-types.html", type: "doc", by: "typescriptlang.org" },
    cond: { title: "TypeScript Handbook: Conditional types", url: "https://www.typescriptlang.org/docs/handbook/2/conditional-types.html", type: "doc", by: "typescriptlang.org" },
    utility: { title: "TypeScript Handbook: Utility types", url: "https://www.typescriptlang.org/docs/handbook/utility-types.html", type: "doc", by: "typescriptlang.org" },
    narrowing: { title: "TypeScript Handbook: Narrowing", url: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html", type: "doc", by: "typescriptlang.org" },
    basics: { title: "TypeScript Handbook: The basics", url: "https://www.typescriptlang.org/docs/handbook/2/basic-types.html", type: "doc", by: "typescriptlang.org" },
    gfeTs: { title: "TypeScript interview questions for senior developers", url: "https://www.greatfrontend.com/blog/typescript-interview-questions-for-senior-frontend-developers", type: "article", by: "GreatFrontEnd" },
    handbook: { title: "Front End Interview Handbook", url: "https://www.frontendinterviewhandbook.com/", type: "doc", by: "Front End Interview Handbook" },
    gfe: { title: "GreatFrontEnd study plans", url: "https://www.greatfrontend.com/interviews/study-plans", type: "doc", by: "GreatFrontEnd" },
  };

  /* ---------- small helpers ---------- */
  const note = (...kids) => h("p.tg-text", ...kids);
  const claimLines = (sn) => [
    ...sn.types.map((t) => `${t.of ? t.of : t.type} is ${t.is}`),
    ...sn.errors.filter((e) => !e.hidden).map((e) => `tsc, line ${e.line}: ${e.code} ${e.msg}`),
    ...(sn.out ? [`Prints: ${sn.out.join(" → ")}`] : sn.error ? [`When run, it throws a ${sn.error.name}.`] : []),
  ];
  const snipCard = (id, label) => h("div.tg-answer", tgCode(SN[id].code), h("ul.tg-claims", claimLines(SN[id]).map((l) => h("li", l))), label ? h("p.tg-text", label) : null);
  /* the example in a hub card: the tested code plus the tested claims, as comments */
  const hubExample = (id) => `${SN[id].code}\n\n${[...SN[id].types.map((t) => `// ${t.of || t.type}: ${t.is}`), ...SN[id].errors.filter((e) => !e.hidden).map((e) => `// error line ${e.line}, ${e.code}: ${e.msg}`), ...(SN[id].out ? [`// prints: ${SN[id].out.join(", ")}`] : [])].join("\n")}`;

  /* A small picture for the hub cards: one type becomes another. */
  function pic(a, b, caption) {
    const svg = S("svg", { viewBox: "0 0 300 82", class: "tg-pic", role: "img", "aria-label": `${a} becomes ${b}. ${caption}` });
    svg.append(
      S("rect", { x: 6, y: 8, width: 126, height: 34, rx: 9, class: "fl-ink" }), S("text", { x: 69, y: 29, "text-anchor": "middle", class: "fl-chip-inv", style: "font-size:12px" }, a),
      S("rect", { x: 168, y: 8, width: 126, height: 34, rx: 9, class: "fl-field" }), S("text", { x: 231, y: 29, "text-anchor": "middle", class: "fl-chip", style: "font-size:12px" }, b),
      S("path", { d: "M 136 25 H 160 m -6 -5 l 6 5 l -6 5", class: "tg-arrow" }),
      S("text", { x: 150, y: 68, "text-anchor": "middle", class: "fl-small" }, caption));
    return svg;
  }

  /* ---------- 08. The runnable: groupBy ---------- */
  function explainGroup(results) {
    const r = results.groupBy;
    if (!r) return h("p.result-say", "The test did not report. Press Reset to get the original code back.");
    const checks = D.GROUP_CHECKS(r);
    const pass = checks.filter((c) => c.ok).length;
    const bad = checks.find((c) => !c.ok);
    const rows = checks.map((c) => ({ label: c.label, value: c.ok ? 1 : 0.05, text: `${c.ok ? "pass" : "not yet"} · ${c.got}` }));
    const sentences = [pass === checks.length ? `All ${checks.length} checks pass.` : `${pass} of ${checks.length} checks pass. Next: ${bad.label} (your code gave: ${bad.got}). Fill in the TODO, then press Run again.`];
    if (r.roles.length) sentences.push(`Your groupBy made these groups: ${r.roles.map((k) => `${k}: [${(k === "admin" ? r.admins : r.members).join(", ")}]`).join("; ")}.`);
    return Book.resultCard({ title: "What happened", rows, sentences, note: "The groups object is built inside the function and handed back. Each key's list is made the first time that key is seen (the ??= line)." });
  }

  /* ---------- 09. Utility types you will meet ---------- */
  const HUB = [
    { id: "partial", name: "Partial", short: "all keys optional", w: "H", picture: () => pic("User", "Partial<User>", "every key gets a ?"),
      problem: "Describe a part of an object: an update, a form that is not filled in yet.", use: "A patch to send to the server: Partial<Omit<User, \"id\">> (the id must not change).",
      avoid: ["It is ", word("shallow", "Only the first level changes. Objects inside stay the same."), ": only the top-level keys become optional. tsc says Partial<{ a: { b: 1 } }> is { a?: { b: 1 } }, so b is still required."], id2: "hubPartial" },
    { id: "required", name: "Required", short: "no key optional", w: "L", picture: () => pic("Partial<User>", "Required<User>", "the ? is removed"),
      problem: "You filled in the defaults, and now every key exists.", use: "The result of merging user settings with defaults.",
      avoid: "It removes the ? (and the undefined that ? adds). A key that is required and typed string | undefined keeps its undefined (checked with tsc).", id2: "hubRequired" },
    { id: "readonly", name: "Readonly", short: "no writes", w: "M", picture: () => pic("User", "Readonly<User>", "every key is read-only"),
      problem: "Stop code from changing an object by mistake.", use: "Props, config, and state that you copy instead of changing.",
      avoid: ["It is a rule for the compiler only: the example prints Ben when it runs. It is also ", word("shallow", "Only the first level changes. Objects inside stay the same."), ": tsc allows a write to a nested key. Object.freeze stops a top-level write at run time (it throws in strict mode; otherwise the write is silently ignored), and it is shallow too."], id2: "hubReadonly" },
    { id: "pick", name: "Pick", short: "keep some keys", w: "H", picture: () => pic("User", "Pick<User, …>", "only the keys you name"),
      problem: "Take a small part of a big type, such as the fields a card shows.", use: "You name two or three keys. A typo in the key list is an error (TS2344).",
      avoid: "If you would list almost every key, Omit is shorter. But Omit also keeps any key added later, and does not check names.", id2: "hubPick" },
    { id: "omit", name: "Omit", short: "drop some keys", w: "H", picture: () => pic("User", "Omit<User, \"id\">", "the named keys go away"),
      problem: "Take everything except a few keys.", use: "A create form: the server makes the id, so the form type is Omit<User, \"id\">.",
      avoid: "Omit does not check its key names: Omit<User, \"nme\"> compiles and removes nothing (checked). Use Pick if you want typos caught. On a union, Omit keeps only the shared keys (see the puzzles).", id2: "hubOmit" },
    { id: "record", name: "Record", short: "keys to values", w: "H", picture: () => pic("\"small\" | \"large\"", "Record<…, number>", "one value for each key"),
      problem: "An object where every key in a list has the same kind of value.", use: "A price for each size, or a label for each status. Missing a key is an error.",
      avoid: ["With a plain string as the key, TypeScript says any key exists: prices[\"x\"] has type number. With the setting ", word("noUncheckedIndexedAccess", "A TypeScript setting that adds undefined to values you read by key."), " it becomes number | undefined (checked). Use Partial<Record<…>> or a Map when keys can be missing."], id2: "hubRecord" },
    { id: "return", name: "ReturnType", short: "what a function gives back", w: "M", picture: () => pic("typeof getUser", "{ id; name }", "the type after the arrow"),
      problem: "You need the result type of a function without writing it a second time.", use: "A function you do not own, or a result you want to keep in sync.",
      avoid: "You must write typeof: ReturnType<getUser> is an error (TS2749). If you control the code, name the type once and share it.", id2: "hubReturn" },
    { id: "params", name: "Parameters", short: "arguments as a tuple", w: "L", picture: () => pic("typeof send", "[string, number]", "the arguments, in order"),
      problem: "Wrap or reuse a function and keep its argument types.", use: "A wrapper that passes its arguments on, such as a debounce or a logger.",
      avoid: "It gives a tuple (a short list where each place has its own type), so you pick one with Args[0]. For a public API, write the argument type once and export it.", id2: "hubParams" },
    { id: "awaited", name: "Awaited", short: "unwrap a promise", w: "M", picture: () => pic("Promise<User>", "User", "what await would give"),
      problem: "A function returns a promise, but you want the type of the value inside.", use: "Awaited<ReturnType<typeof fetchUser>>. It also removes a promise inside a promise.",
      avoid: "Don't use it when you can just write the type you expect. It only changes a type; it does not wait for anything.", id2: "hubAwaited" },
    { id: "nonnull", name: "NonNullable", short: "remove null and undefined", w: "M", picture: () => pic("string | null", "string", "null and undefined go away"),
      problem: "A value may be null or undefined, and you want the type without those.", use: "After you checked the value yourself, or for the item type of a list, after you removed the empty items.",
      avoid: "It changes the type only. Nothing is checked when the code runs. If a value can be null, narrow it first with if (x != null) instead of forcing the type.", id2: "hubNonNull" },
    { id: "extract", name: "Extract / Exclude", short: "filter a union", w: "M", picture: () => pic("idle | loading | error", "loading | error", "Exclude takes members out"),
      problem: "Keep or remove some members of a union.", use: "Exclude<Status, \"idle\"> for the states where work is going on.",
      avoid: "They work on unions, one member at a time. To change the keys of an object type, use Pick and Omit.", id2: "hubExtract" },
  ].map((it) => ({ ...it, example: hubExample(it.id2) }));

  /* ---------- 11. From your work ---------- */
  const excerpt = (e) => `// speako-web/${e.file} (lines ${e.ranges.map((r) => r.join("-")).join(" and ")})\n${e.text.join("\n  // ... post, put, patch and delete have the same shape ...\n")}`;

  /* ---------- 13. Interview questions (only the sourced ones in research/interview-questions.md, ts-types) ---------- */
  const IQ = [
    {
      q: "Implement a publish-subscribe event bus in JavaScript or TypeScript.",
      type: "coding", level: "level not stated", source: { company: "Tradedesk", year: "onsite, Sep 2026", url: "https://prachub.com/interview-questions/implement-a-publish-subscribe-event-bus-in-javascript-or-typescript" },
      testing: "The research has the title and no criteria. It calls the typed-API angle its own inference (the page does not say it), so treat the typing part as a guess.",
      answer: () => [
        "Say the plan first: one list of handlers for each event name; on() adds a handler and returns a function that removes it; emit() calls the handlers. Then add types so an event name decides the payload type.",
        "The trick is one generic for the whole bus (Events is a map from name to payload) and one generic per method (K is one of the names):",
        snipCard("eventBus", "The class compiles with no error. The last three lines are deliberate mistakes."),
        "Say what to decide next: what if a handler throws (let the error go up, or catch each one), is the order of handlers part of the contract, and do you also need a once() method. State your choice; do not leave it open.",
        "Two limits of the typing, checked with tsc. Events extends Record<string, unknown> rejects an interface (an index signature is missing), so describe the events with a type. And an event with no payload (void) still needs a second argument when you emit:",
        snipCard("busLimits"),
      ],
    },
    {
      q: "Implement an event emitter.",
      type: "coding", level: "level not stated", source: { company: "Snowflake", year: "Jan 2026", url: "https://prachub.com/coding-questions/implement-an-event-emitter" },
      testing: "Only the title is known: the research did not open the page. It is the same shape as the question above.",
      answer: () => [
        "Start without types: a Map from event name to a list of handlers, plus on, off and emit. Get that right and tested first.",
        "Then add the generic version if they ask for TypeScript. It is the class in the answer above: Events extends Record<string, unknown>, and K extends keyof Events ties the name to its payload.",
        "Follow-ups to be ready for: off() while emit() is running (the class above replaces the array on removal, so the loop that is running keeps its old list), the same handler added twice, and once().",
      ],
    },
    {
      q: "Build a chainable rectangle manipulation API.",
      type: "coding", level: "level not stated", source: { company: "Robinhood", year: "Jul 2026", url: "https://prachub.com/interview-questions/build-a-chainable-rectangle-manipulation-api" },
      testing: "Only the title is known: the research did not open the page. A typed fluent API is the generics angle, and it is my reading of the title.",
      answer: () => [
        "Every method changes the rectangle and returns this, so calls chain: rect.move(1, 2).resize(3, 4).",
        "For types, the return type this (not Rect) matters as soon as there is a subclass. Compare:",
        snipCard("fluentOk", "move() returns this, so the chain still has the Square type and side() is allowed."),
        snipCard("fluentLoose", "With Rect as the return type, the chain turns into a Rect and loses side()."),
        "Follow-ups to be ready for: should a method change the rectangle or return a new one (a new one is easier to test and to undo), and what happens when a size is negative. State your choice before you code.",
      ],
    },
  ];
  const resolveAnswer = (a) => (typeof a === "function" ? a() : a);
  const PRACTICE = [
    { q: "Write a generic pick(obj, keys) that keeps key safety.", a: [`Use two blanks: function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>. For pick(user, ["id"]) the result is Pick<User, "id"> (checked with tsc). A typo is an error: ${SN.pickFn.errors[0].code} ${SN.pickFn.errors[0].msg}`] },
    { q: "Type an API patch payload with utility types.", a: [`type UserPatch = Partial<Omit<User, "id">>. Omit removes the id because a patch must not change it, and Partial makes the rest optional. tsc says it is ${SN.patch.types[0].is}.`] },
    { q: "Unwrap an async result with a conditional type and infer.", a: [`type Unwrap<T> = T extends Promise<infer U> ? U : T. Unwrap<Promise<string>> is string. But it removes one layer only: Unwrap<Promise<Promise<string>>> is Promise<string>, while the built-in Awaited gives string (all checked with tsc).`] },
    { q: "Why can't I write new T() inside a generic function?", a: [`Types are removed when the code runs, so T does not exist as a value. tsc says: ${SN.newT.errors[0].code} ${SN.newT.errors[0].msg} Pass the class in: function make<T>(ctor: new () => T): T { return new ctor(); }. Then make(Dog) has type Dog (checked).`] },
    { q: "What does extends mean in <T extends X> and in T extends X ? A : B?", a: ["In angle brackets it is a rule: T must fit X, or the call is an error. In a conditional type it is a question: does T fit X? The answer picks A or B. Both ask whether T can be used where X is expected. You saw both: the rule on the constraint page, the question on the ReturnType page."] },
  ];

  /* ---------- 12. On the job ---------- */
  const ticketSteps = () => [
    "Reproduce: ask the API (or a copy of it) for a user and look at the real JSON. It now has name, and the code reads fullName. The crash message names toUpperCase, far from the cause, so search the code for fullName.",
    ["Find why the compiler was silent: get() returns Promise<any>, and any fits everything. This is the first page of this lesson. Checked by running it:", snipCard("ticketAny")],
    ["Check the data at the edge. Write parseUser(data: unknown): User, which looks at each field, and let get() take the parser. Now T is not a promise from you: it comes from the check. (In a bigger app, a library such as zod can write parsers like this for you.)", tgCode(SN.parsed.code.split("\n\nasync function main")[0])],
    "Type each endpoint by naming its parser: getUser = (id) => get(\"/api/users/\" + id, parseUser). There is no <User> to write at the call site, so the type cannot disagree with the parser.",
    ["Fix every use. Change the User type to { id, name } and the compiler lists each place that still reads the old field:", snipCard("renamed")],
    ["Add a type test so the endpoint's type cannot change by accident, and one runtime test that feeds parseUser a bad object and expects the error message:", snipCard("typeTest", "Test1 passes; Test2 claims a different type, and the build stops on it.")],
  ];

  Book.registerLesson("ts-generics", {
    mount(root) {
      root.append(
        prereqs([
          ["Type", "A label for what kind of value something is: number, string, a User. TypeScript checks types before the code runs."],
          ["Compiler", "A program that reads your code and reports mistakes. For TypeScript it is called tsc. Types are removed when the code runs."],
          ["any", "A type that turns checking off for a value. TypeScript accepts anything you do with it."],
          ["Union", "A type that allows several types, written with |. string | number allows both."],
          ["Generic", "A function or type with a blank for a type, written <T>. Each call fills the blank."],
        ]),
        step({
          n: "01", title: "Why not just use any?",
          lines: ["A function that gives back the first item of a list must work for numbers, strings and users.", "A first idea is the type any. Is that good enough?", "Guess first, then press the buttons under the picture."],
          demo: h("div.demo-stack", V.anyProblem(), note(h("b", "Where the answers come from: "), `every compiler answer on this page is from the real TypeScript ${D.TSC_VERSION}, saved in the page's data and checked again by a test. A browser cannot run the compiler, so the page shows the saved answer. Older or newer versions may word a message differently.`)),
          links: [L.basics, L.generics],
        }),
        step({
          n: "02", title: "Watch a type flow through a function",
          lines: [
            ["A ", word("generic", "A function or type with a blank for a type, written <T>. Each call fills the blank."), " function has a blank. T is a ", word("type parameter", "A name for a type that is not known yet, like T in <T>. A call fills it in."), "."],
            "Press play. Watch the type go in, fill the blank, and come out.",
            "The last chapter shows a rule that stops a wrong type.",
          ],
          demo: h("div.demo-stack", V.film(),
            note(h("b", "Honest note: "), "this is a picture of the simple case: T[] meets number[], so T is number. The real algorithm does more, for example when the argument is a list with two kinds of item. The T and result of every call in the film are checked with tsc, and the error message in the last chapter is its real text.")),
          links: [L.generics, L.basics],
        }),
        step({
          n: "03", title: "How does TypeScript know what T is?",
          lines: [[word("Inference", "TypeScript works out a type by itself from the code, so you do not write it."), " finds T from the argument you pass."], "Usually you do not write T at all.", "Guess, then ask the compiler."],
          demo: V.inferLab(), links: [L.generics, L.basics],
        }),
        step({
          n: "04", title: "A rule for T",
          lines: ["Sometimes T must have something. A search by id needs items that have an id.", [word("A constraint", "A rule for a type parameter, written T extends Rule. T may be any type that follows the rule."), " is that rule."], "Press the buttons under the picture."],
          demo: V.constraint(), links: [L.generics, L.keyof],
        }),
        step({
          n: "05", title: "keyof: asking for the keys",
          lines: ["A generic function often takes an object and a key. The key must be a real one.", [word("keyof", "keyof User asks TypeScript for the keys of User."), " lists the keys of a type."], "Guess, then ask the compiler."],
          demo: V.keyof(), links: [L.keyof, L.generics],
        }),
        step({
          n: "06", title: "Build Partial, Readonly and Pick",
          lines: [["TypeScript's ", word("utility types", "Types that TypeScript gives you to change other types, like Partial<User> or Pick<User, \"id\">."), " are small. You can write them."], ["A ", word("mapped type", "A type that loops over the keys of another type and builds a new type, key by key."), " loops over the keys and builds a new type."], ["Some keys will be ", word("optional", "A key that may be missing. It is written with a ?, as in email?: string."), ". Guess, loop, and check."]],
          demo: h("div.demo-stack", V.mapped(),
            h("details.tg-sol", h("summary", "How the proof works"), tgCode(D.EQUALS),
              note("Equals<A, B> is true only when A and B are exactly the same type. The test writes a line like const ok: Equals<MyPartial<User>, Partial<User>> = true. If the types differed, tsc would stop with an error. The same test checks that Equals can say no: Equals<number, string> is false, and so is Equals<{ a?: 1 }, { a: 1 }>."),
              note("A wrong version. NotPartial makes each value T[K] | undefined, but the keys stay required:"), tgCode(SN.partialWrong.code),
              note("tsc agrees that NotPartial<User> is a different type from Partial<User> (checked)."))),
          links: [L.mapped, L.utility],
        }),
        step({
          n: "07", title: "Build ReturnType with infer",
          lines: ["ReturnType gets the type that a function gives back.", [["A ", word("conditional type", "A type with an if: T extends U ? X : Y. It is X when T fits U, otherwise Y."), " asks a question, and ", word("infer", "Inside a conditional type, infer R gives the name R to a piece of the matching type."), " names the answer."]], "Guess, then catch R."],
          demo: V.infer(), links: [L.cond, L.utility],
        }),
        step({
          n: "08", title: "Write groupBy()",
          lines: [["groupBy puts a list into groups by a key. It has two blanks: T for the items and K for the key, which must be a ", word("PropertyKey", "A built-in type for anything that can be an object key: string, number or symbol."), "."], "A browser cannot run TypeScript, so the editor holds the same code without its types.", "Fill in the TODO and press Run. The typed version is under the editor."],
          demo: h("div.demo-stack",
            note("The solution uses ", word("??=", "a ??= b means: if a has no value yet (null or undefined), put b in it."), " to make a new list when a key is seen for the first time."),
            runnable({ title: "Write groupBy()", code: D.groupCode(false), rows: 24, explain: explainGroup }),
            h("details.tg-sol", h("summary", "Show one solution (typed, then without types)"), tgCode(D.GROUP_TS), Book.code(D.GROUP_JS)),
            note(h("b", "Same code: "), "a test checks that the JavaScript above is exactly the TypeScript with the types removed, by Node's own type stripper."),
            snipCard("groupBy", "The call gets its type from the callback: K is the type the callback returns."),
            note(h("b", "Why Partial: "), "if groupBy promised ", word("Record<K, T[]>", "An object type whose keys are K and whose values are lists of T."), ", tsc would say byRole.member is User[] even when nobody has that role. With Partial<Record<K, T[]>> it says User[] | undefined, and that is true (both checked). The constraint also catches a callback that returns an object, with the TS2322 message above."),
            note(h("b", "A trap: "), "a key like \"constructor\" breaks a plain {}, because the object already has a constructor (the test runs it: TypeError, push is not a function). For user data, use Object.create(null) or a Map. Newer JavaScript has the built-in Object.groupBy.")),
          links: [L.generics, L.utility, L.handbook],
        }),
        step({
          n: "09", title: "Utility types you will meet",
          lines: ["These eleven are in many TypeScript code bases.", "Pick a card. Each one has a real example, and when not to use it.", "Every example was checked with tsc."],
          demo: h("div.demo-stack", note("All cards use this type:"), tgCode(D.HUB_PRE), Book.hubSpoke({ title: "Utility types you will meet", items: HUB })),
          links: [L.utility, L.mapped],
        }),
        step({
          n: "10", title: "Four quick type puzzles",
          lines: ["These are common TypeScript interview topics in prep guides (not from candidate reports).", "Guess, then ask the compiler.", "The last one is a trap that surprises many people."],
          demo: V.puzzles(), links: [L.cond, L.utility, L.gfeTs],
        }),
        step({
          n: "11", title: "From your work: http.get<T>",
          lines: ["Speako has a typed helper, http.get<T>. The T is your promise about the server.", "The helper does not check the shape of the answer. See what that means.", "Be ready to say which parts you wrote."],
          demo: h("div.demo-stack",
            h("div.tg-excerpt", h("span.label", "Speako: the typed HTTP wrapper (excerpt)"), tgCode(excerpt(D.SPEAKO.http)),
              note("Every http.get<T>(…) in the app ends in request<T>, which asks axios for a T. request<T> passes your T to axios, and axios also trusts it: the data comes from the network and nothing checks its shape. (If T were left out, axios would use any: axios 1.13.5, index.d.ts line 600.) The response interceptor in client.ts returns a good answer without changes; it only reshapes errors.")),
            V.trust(),
            h("div.tg-excerpt", h("span.label", "Speako: a hook with a default type parameter (excerpt)"), tgCode(excerpt(D.SPEAKO.ctrl)),
              note("Rest extends any[] = [] is a type parameter with a default, like a default value for an argument: if nobody says Rest and TypeScript cannot work it out from onChange, it is an empty list.")),
            h("div.tg-honest", note(h("b", "Honest note. What is typed: "), "in the local copy of Speako read for this page, the app has 37 typed calls like http.get<…>(…) in 25 files (not counting a comment in http.ts). ", word("zod", "A library that checks data at run time and gives it a type."), " is installed, but none of those 25 files imports it."),
              note(h("b", "What git blame says: "), "all 87 lines of http.ts are under the name Mina-Massoud (one commit, 23 April 2026), and use-controlled-state.tsx is under the name Mina (one commit, 29 November 2025). Git names do not prove who wrote each line."),
              note(h("b", "Be ready to say which parts you wrote."), " A typed HTTP wrapper and a controlled-state hook are both well-known patterns."))),
          links: [L.generics, L.narrowing],
        }),
        step({
          n: "12", title: "On the job",
          lines: ["A ticket arrives. Read it, think about your steps, and then compare."],
          demo: Book.onTheJob({
            id: "PRACTICE-2", title: "Our API client returns any, and a renamed field broke production silently",
            context: "A practice ticket (not from a real tracker). The backend team renamed fullName to name. Nobody saw a compile error. Users now see a blank profile page, and in Chrome the error log says: “Cannot read properties of undefined (reading 'toUpperCase')”.",
            symptoms: ["The build and the type check are green.", "The crash is in the profile page, but the cause is in the API.", "The same thing could happen to any endpoint."],
            code: SN.ticketAny.code,
            tasks: ["Find why the compiler did not catch it.", "Make the client safe in a way you can explain.", "Add a type test and a runtime test."],
            steps: ticketSteps(),
          }),
          links: [L.generics, L.narrowing],
        }),
        step({
          n: "13", title: "Real interview questions",
          lines: ["Real candidates reported these. The company, date and link are on each card.", "The sources have almost no first-hand TypeScript type questions, so there are only three, and two are titles only.", "Try each one out loud first, then open the answer."],
          demo: h("div.demo-stack",
            Book.interviewQuestions(IQ.map((it) => ({ ...it, answer: resolveAnswer(it.answer) }))),
            h("span.tg-sub", "Practice questions (not from a report)"),
            note("These are our own practice questions. A prep guide from GreatFrontEnd covers Pick, Partial and generics. The guide is not a candidate report."),
            Book.drill(PRACTICE)),
          links: [L.gfeTs, L.handbook, L.gfe],
        }),
        step({
          n: "14", title: "In one sentence",
          lines: ["A generic is a function or type with a blank for a type, and TypeScript fills the blank from what you pass."],
          demo: h("ol.tg-rule",
            h("li", h("span", h("b", "T is a blank that each call fills in"), ": TypeScript finds it from the arguments, so the type flows through.")),
            h("li", h("span", h("b", "T extends X is a rule"), ": inside you may use X, outside T keeps its full type.")),
            h("li", h("span", h("b", "A mapped type loops over keys"), "; a conditional type with infer reads a piece out of a type. Partial, Pick and ReturnType are small examples.")),
            h("li", h("span", h("b", "A type is a promise to the compiler"), ": for data from outside, check it at the edge and let T come from the check."))),
          links: [L.generics, L.utility, L.gfeTs],
        }),
      );
    },
  });
})();
