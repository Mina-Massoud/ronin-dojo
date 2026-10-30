/* Lesson: this, prototypes and classes (Wave 2).
   Order: lose this → the ladder (film) → your turn → arrows and fields → the chain (film) → class → write bind → write map
   → ways to make objects → Anemone → job → interview → one sentence.
   Every output on these pages is computed by running the snippets in js-this-prototypes.data.js,
   which dev/js-this-prototypes.test.js checks in Node. */
(function () {
  const { h, word, step, runnable, prereqs, svg: S } = Book;
  const V = Book.parts["js-this-prototypes"];
  const D = V.data;
  const code = Book.code;

  /* ---------- Go deeper (URLs from research/frontend-syllabus.md only) ---------- */
  const L = {
    jsinfo: { title: "javascript.info", url: "https://javascript.info/", type: "doc", by: "javascript.info" },
    ydkjs: { title: "You Don't Know JS Yet", url: "https://github.com/getify/You-Dont-Know-JS", type: "book", by: "Kyle Simpson" },
  };

  /* ---------- runnables: result cards with a pass or fail line for every case ---------- */
  const explainCases = (key, title) => (r) => {
    const list = r[key];
    if (!Array.isArray(list)) return h("p.result-say", "No test report came back. Press Reset to get the original code back.");
    const isAdv = (c) => c.name.startsWith("advanced");
    const need = list.filter((c) => !isAdv(c));
    const passed = need.filter((c) => c.pass).length;
    const first = need.find((c) => !c.pass);
    const adv = list.find(isAdv);
    return Book.resultCard({
      title,
      rows: list.map((c) => ({ label: c.name, value: c.pass ? 1 : 0.004, text: c.pass ? "pass" : c.error ? `fail (${c.error})` : "fail" })),
      sentences: [
        `${passed} of ${need.length} required cases pass.`,
        first ? `Fix this one first: “${first.name}”. ${D.hints[first.name] || ""}` : "All required cases pass. Open the solution below and compare.",
      ],
      note: adv ? (adv.pass ? "The advanced case passes too." : "The advanced case is optional. It needs a deeper idea: see the note below.") : undefined,
    });
  };
  const solution = (label, ...blocks) => h("details.th-solution", h("summary", label), blocks.map((b) => (typeof b === "string" ? code(b) : b)));

  /* ---------- 09. Ways to make objects (hub) ---------- */
  const pic = (label, draw) => () => {
    const svg = S("svg", { viewBox: "0 0 300 124", class: "th-pic", role: "img", "aria-label": label });
    draw(svg);
    return svg;
  };
  const box = (svg, x, y, w, hgt, lines, cls = "") => {
    svg.append(S("rect", { x, y, width: w, height: hgt, rx: 8, class: "th-pb " + cls }));
    [].concat(lines).forEach((t, i, all) => svg.append(S("text", { x: x + w / 2, y: y + hgt / 2 + 4 + (i - (all.length - 1) / 2) * 15, "text-anchor": "middle", class: "th-pt" + (cls === "th-ink" ? " th-inv" : i ? " th-m" : "") }, t)));
  };
  const line = (svg, d) => svg.append(S("path", { d, class: "th-pa" }));
  const F = D.makerFacts();
  const HUB = [
    { id: "literal", name: "Object literal", short: "{ }", w: "H",
      picture: pic("One object written by hand", (s) => { box(s, 90, 22, 120, 72, ["{ name, speak }", "one object"]); }),
      problem: "Make one object, right now.", use: "Settings, one-off data, a single thing that nobody copies.",
      avoid: "When you need many alike objects. Each literal repeats its own methods.", lang: "js", example: D.MAKER_SRC.literal,
      note: `Live check: do a and b share one speak function? ${D.show(F.literalShare)}. Each literal made its own.` },
    { id: "factory", name: "Factory + closure", short: "function", w: "M",
      picture: pic("A function that keeps a private count", (s) => { box(s, 12, 14, 130, 96, ["makeCounter()", "count (private)"], "th-dash"); box(s, 190, 16, 90, 36, "inc()"); box(s, 190, 70, 90, 36, "get()"); line(s, "M 188 34 H 146 m 5 -4 l -5 4 l 5 4"); line(s, "M 188 88 H 146 m 5 -4 l -5 4 l 5 4"); }),
      problem: "Make objects and keep some data private, without class syntax.", use: "Private state, and no this to lose: the methods use the variable, not this.",
      avoid: "Thousands of objects: each one gets its own copy of every method. instanceof will not work.", lang: "js", example: D.MAKER_SRC.factory,
      note: `Live check: c.count is ${D.show(F.factoryPrivate)} (hidden), c.get() is ${D.show(F.factoryGet)}. Two counters share inc? ${D.show(F.factoryShare)}.` },
    { id: "ctor", name: "Constructor function + prototype", short: "new Dog()", w: "M",
      picture: pic("Two dogs share one prototype", (s) => { box(s, 12, 14, 90, 36, "a"); box(s, 12, 74, 90, 36, "b"); box(s, 170, 34, 120, 56, ["Dog.prototype", "speak"]); line(s, "M 104 32 L 168 54"); line(s, "M 104 92 L 168 70"); }),
      problem: "Many objects that share their methods.", use: "Old code and libraries. Learn it to understand what class does.",
      avoid: "New code: class says the same thing more clearly. Forgetting new is a classic bug.", lang: "js", example: D.MAKER_SRC.ctor,
      note: `Live check: share speak? ${D.show(F.ctorShare)}. Calling Dog("x") without new, in strict mode: ${F.ctorNoNew}. In sloppy mode it does not throw: it writes name onto globalThis.` },
    { id: "class", name: "class", short: "class Dog", w: "H",
      picture: pic("A class puts methods on the prototype", (s) => { box(s, 12, 14, 90, 36, "a"); box(s, 12, 74, 90, 36, "b"); box(s, 170, 34, 120, 56, ["class Dog", "speak"], "th-ink"); line(s, "M 104 32 L 168 54"); line(s, "M 104 92 L 168 70"); }),
      problem: "The same as a constructor function, with clear syntax.", use: "Most new code: shared methods, extends, super, private #fields.",
      avoid: "Deep inheritance trees. And when a plain function or object is enough.", lang: "js", example: D.MAKER_SRC.klass,
      note: `Live check: share speak? ${D.show(F.classShare)}. Dog("x") without new: ${F.classNoNew}.` },
    { id: "create", name: "Object.create", short: "link", w: "L",
      picture: pic("An object linked to another object", (s) => { box(s, 12, 40, 100, 44, "rex"); box(s, 188, 40, 100, 44, "animal"); line(s, "M 114 62 H 186 m -6 -5 l 6 5 l -6 5"); }),
      problem: "Make an object that links straight to another object. No constructor.", use: "Plain prototype links, and Object.create(null) for a dictionary with no inherited keys.",
      avoid: "When you need setup code for many instances: a class or factory is easier.", lang: "js", example: D.MAKER_SRC.create,
      note: `Live check: rex.speak() is ${D.show(F.createSpeak)}. Is "toString" in Object.create(null)? ${D.show(F.nullProto)}.` },
    { id: "mixin", name: "Mixin", short: "copy methods", w: "L",
      picture: pic("Methods copied from a helper object into a prototype", (s) => { box(s, 12, 40, 90, 44, "Swims"); box(s, 190, 22, 100, 80, ["Dog.prototype", "swim (copy)"]); line(s, "M 104 62 H 186 m -6 -5 l 6 5 l -6 5"); s.append(S("text", { x: 146, y: 54, "text-anchor": "middle", class: "th-pt th-m" }, "assign")); }),
      problem: "Share a few methods between unrelated classes. A class can have only one parent.", use: "Small helpers, such as swim or an event emitter, added to several classes.",
      avoid: "When names can clash (the last copy wins), or when you need instanceof: a mixin object cannot be tested that way.", lang: "js", example: D.MAKER_SRC.mixin,
      note: `Live check: rex.swim() is ${D.show(F.mixinSwim)}. rex instanceof Swims: ${F.mixinInstance}. Two helpers with the same name: the later one wins (${D.show(F.mixinClash)}). Changing Swims later does not change Dog: rex.swim() is still ${D.show(F.mixinCopy)}.` },
  ];

  /* ---------- 10. From your work: Anemone ---------- */
  const UTIL_JS = `// anemone/v2/js/audio/util.js (lines 35-58)
export class Smoothed {
  constructor(value, tau) {
    this.from = value;
    this.to = value;
    this.t0 = 0;
    this.tau = tau;
  }

  set(value, time) {
    this.from = this.at(time);
    this.to = value;
    this.t0 = time;
  }

  at(time) {
    const dt = Math.max(0, time - this.t0);
    return this.to + (this.from - this.to) * Math.exp(-dt / this.tau);
  }

  /** True when both the target and the current value are effectively zero. */
  silent(time, floor = 0.002) {
    return this.to < floor && this.at(time) < floor;
  }
}`;
  const PERF_JS = `// anemone/v2/js/perf.js (lines 355, 358-368, 389)
const rec = ctx.recorder;
// …
const tick = rec.tick.bind(rec);
rec.tick = (y, section) => {
  const before = rec.frames.at(-1);
  const s = performance.now();
  tick(y, section);
  if (rec.frames.at(-1) !== before) {
    // A frame was kept: the screen copied into a small texture (CPU time; the frame gap shows any GPU cost).
    recMs += performance.now() - s;
    recCount += 1;
  }
};
// …
rec.tick = tick;`;
  const REC_JS = `// anemone/v2/js/recorder.js (lines 13, 32, 36, 43-45)
export function createRecorder(THREE, renderer) {
  // …
  let lastY = -1e9;
  // …
  return {
    // …
    tick(y, section) {
      if (Math.abs(y - lastY) < viewH() * 0.14) return;
      lastY = y;`;
  const wrapRows = D.wrapTable();
  const row = (label, result) => h("div.th-trow", h("span", label), h("code", { class: /Error/.test(result) ? "th-bad" : "" }, result));

  /* ---------- 11. On the job ---------- */
  const bugRun = D.ticketRun("bug");
  const TEST_CODE = `test("Save sends the draft items", () => {
  const ui = fakeUi();               // calls handlers as fn(), like the real one
  new DraftEditor(ui);
  expect(ui.clickSave()).toEqual(["saved 2 items"]);
});`;

  /* ---------- 12. Interview ---------- */
  const caseRows = D.cases.filter((c) => c.id !== "new").map((c) => h("div.th-trow", h("span", `${c.title} (${c.mode})`), h("code", D.runCase(c))));
  const chk = D.checks(D.makeZoo(D.CLASS_SRC));
  const ctor = D.ctorReturn();
  const mnc = D.myNewCheck();
  const pv = D.PROTO_VS();
  const hf = D.hasOwnFacts();
  const mnk = D.myNewClass();
  const IQ = [
    {
      q: "Predict five this outputs (method call, detached call, bind, call on a bound function, an arrow returned from a method, a strict-mode plain call). Trace the Dog and Animal prototype chain (Object.create, instanceof, hasOwnProperty, delete). Rewrite it with class, extends and super. Explain why runLater(rex.speak) throws and give two fixes.",
      type: "coding", source: { company: "HubSpot", year: "Jan 2026", url: "https://prachub.com/interview-questions/javascript-fundamentals-prototype-chains-and-how-this-is-bound" },
      testing: "One consistent model of the receiver (the object a method is called on).",
      answer: [
        "Say the first two lines out loud first. The rest is for follow-ups.",
        "Start with the model, out loud: this is decided by the call. Check in this order: arrow function (uses the this of where it was written), new, call/apply/bind, a dot (obj.method()), then a plain call (undefined in strict mode, globalThis in sloppy mode).",
        h("div.th-table", caseRows),
        "The prototype chain: rex, then Dog.prototype, then Animal.prototype, then Object.prototype, then null. Reading a property walks up this chain. Writing a property usually sets it on the object itself.",
        code(D.FUNC_SRC),
        code(D.CLASS_SRC),
        `Both give the same results. Checked on this page: rex instanceof Animal is ${chk.instAnimal}; rex.hasOwnProperty("speak") is ${chk.ownSpeak}; rex.speak() is “${chk.speak}”. delete Dog.prototype.speak makes rex.speak() use Animal's version instead (“${D.shadowDelete().after}”). Modern code writes Object.hasOwn(rex, "name") (${hf.hasOwn}). It also works on Object.create(null), where rex.hasOwnProperty does not exist (typeof gives “${hf.bareMethod}”, and Object.hasOwn gives ${hf.bareHasOwn}).`,
        `Why runLater(rex.speak) throws: runLater calls fn() with no dot, and class code is strict, so this is undefined. Your browser's message: ${D.runTry("lost")}. Fix one: runLater(() => rex.speak()). Fix two: runLater(rex.speak.bind(rex)). Both print “${D.runTry("bind").replace(/"/g, "")}”.`,
        `Follow-ups. If a constructor returns an object, new gives you that object (${ctor.obj}). If it returns a primitive, the return is ignored and you get the new object (${ctor.prim}). Arrow functions cannot be constructors: ${D.arrowCtor()}. An arrow class field is one new function per instance; a method is shared (page 04). To write bind with new, see page 07.`,
      ],
    },
    {
      q: "Implement Array.prototype.map, filter and reduce.",
      type: "coding", source: { company: "Canva", url: "https://www.greatfrontend.com/interviews/company/canva/questions-guides" },
      testing: "Prototype and this handling. (The company guide has no year. The wording is from the research notes, not a verified prompt.)",
      answer: [
        "Say what you handle before you write. For map: call the callback with (value, index, array); use thisArg; skip holes in sparse arrays but keep them in the result; throw a TypeError if the callback is not a function; do not change the original array.",
        "For reduce: with no start value, use the first real item and start from the next; on an empty array with no start value, throw a TypeError; count the arguments, because a start value of undefined still counts.",
        "Page 08 has all three with tests that compare your code with the real methods. Say what you skip: subclasses (Symbol.species) and arrays that change while you loop.",
      ],
    },
    {
      q: "Build a Backbone-style Model class.",
      type: "coding", source: { company: "Airbnb", url: "https://www.greatfrontend.com/interviews/company/airbnb/questions-guides" },
      testing: "OOP in JavaScript: state, events, and this. (The company guide has no year, and the exact prompt is not public: this is a typical shape of the task.)",
      answer: [
        "Keep the data in one object, give it get and set, and fire events only when a value really changes. The trap is this: a listener such as view.show loses its view when it is called. Backbone's answer is a third argument, the context, which the model uses with apply.",
        code(D.MODEL_SRC),
        code(D.MODEL_USE),
        `The log it makes, from running this code: ${JSON.stringify(D.modelRun())}.`,
      ],
    },
  ];
  const PRACTICE = [
    { q: "What does new do, step by step?",
      a: ["Three steps: 1) make a new object that links to Ctor.prototype; 2) run the constructor with this set to that object; 3) if the constructor returned an object, use it, else use the new object.",
        h("div.th-stack", code(D.MY_NEW), h("p.th-note", `Checked against the real new on this page: the result's speak() is “${mnc.speak}”, its prototype is Dog.prototype (${mnc.proto}), and for a constructor that returns an object, myNew gives ${mnc.odd} and new gives ${mnc.realOdd}.`), h("p.th-note", `myNew works for old constructor functions only. A class needs Reflect.construct(Ctor, args). On this page, myNew(Cat, "Tom") gave ${mnk.myNew}, and Reflect.construct gave ${mnk.reflect}.`))] },
    { q: "What is the difference between __proto__ and prototype?",
      a: [`prototype belongs to a constructor function or class (Dog.prototype). It is the object that new instances will link to. __proto__ (use Object.getPrototypeOf instead) is the link an object has to its own prototype. For rex: rex.__proto__ === Dog.prototype is ${pv.viaProto}. Does rex have a prototype property? ${pv.rexHasPrototypeProp}. Does Dog? ${pv.dogHasPrototypeProp}.`] },
    { q: "An object has a method written as an arrow: { f: () => this }. What is this in o.f()?",
      a: [`At the top of a classic script, this is globalThis (window in a browser). In an ES module it is undefined. Either way the arrow does not make a new this, so o.f() does not give o (o.f() === o is ${D.show(D.arrowMethodIsO())} here). This run gave: ${D.arrowMethod()}. Use a normal method when you need the object.`] },
  ];

  Book.registerLesson("js-this-prototypes", {
    mount(root) {
      root.append(
        prereqs([
          ["Object", "A bag of keys and values, like { name: \"Rex\" }. A method is a function stored in an object."],
          ["Function call", "Running a function by writing f(). In this lesson, how you write the call matters more than how you write the function."],
          ["Strict mode", "A stricter way for JavaScript to run. Classes and modules are always strict. A plain script is not, unless it starts with \"use strict\". In sloppy mode (not strict), a plain call gets globalThis, the global object (window in a browser)."],
          ["class and new", "class Dog {…} is a recipe. new Dog(\"Rex\") makes one dog from it."],
        ]),
        step({
          n: "01", title: "Why does the method lose its object?",
          lines: [
            "A function does not know who owns it. It finds out from the call.",
            ["The word for “who is calling me?” is ", word("this", "A word inside a function. It points to the object the function was called on."), ". JavaScript decides it when you call the function, not when you write it."],
            "Press Next under the picture. You will break it on purpose, then fix it two ways.",
          ],
          demo: V.lose(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "02", title: "Who is this? One ladder for every call",
          lines: [
            "Five questions decide this. Ask them from the top. The first yes wins.",
            ["Some calls run in ", word("strict mode", "A stricter way JavaScript runs. For a plain call it leaves this undefined. In sloppy mode it becomes globalThis."), ", some in sloppy mode. The film tells you which."],
            "Press play, or drag the bar. Every result comes from running the code.",
          ],
          demo: V.ladder(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "03", title: "Your turn: who is this?",
          lines: ["Five new calls. Look at the last line, pick who this is, and see the real answer.", "Two of them are traps. Press Next under the picture."],
          demo: V.predict(), links: [L.jsinfo],
        }),
        step({
          n: "04", title: "Arrow functions and class fields",
          lines: [
            "An arrow function does not ask the call. It keeps the this of the place where it was written.",
            ["That is why ", word("class fields", 'A line like label = "Save" inside a class. Every new object gets its own copy.'), " like onClick = () => … are popular for handlers. It also has a cost."],
            "Press Next under the picture. Guess first, then see.",
          ],
          demo: V.arrows(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "05", title: "The prototype chain",
          lines: [
            ["Almost every object has a hidden link to another object. That object is its ", word("prototype", "The object that another object links to. If a key is missing, JavaScript looks in the prototype next. Dog.prototype is a normal property of the function Dog: it is the object that rex links to."), "."],
            "To read a key, JavaScript walks up these links until it finds the key, or reaches null.",
            "Watch four lookups, then instanceof and hasOwnProperty. The chain is found by really walking it.",
          ],
          demo: h("div.th-stack", V.chain(),
            h("div.th-table", ["before", "after"].map((k) => row(k === "before" ? "rex.speak() now" : "After delete Dog.prototype.speak", D.show(D.shadowDelete()[k]))),
            ), h("p.th-note", h("b", "Shadowing: "), "Dog.prototype.speak hides Animal's speak. Delete it (a copy of the objects, run on this page) and the lookup goes on to the next one.")),
          links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "06", title: "A class is the same chain",
          lines: ["class and extends do not add a new kind of object. They build the chain from page 05 for you.", "Compare the old way with class. Press Next under the picture."],
          demo: V.classChain(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "07", title: "Write bind yourself",
          lines: [
            "bind returns a new function with this locked. It can also lock the first arguments.",
            "Press Run. Some cases fail on purpose. Edit the code until every required case passes.",
            "The tests compare your function with what the real bind does.",
          ],
          demo: h("div.th-stack",
            runnable({ title: "Write Function.prototype.myBind", code: D.runnableCode.bind("starter"), rows: 30, explain: explainCases("bind", "Your myBind, case by case") }),
            solution("Show a solution", D.bindImpl.solution,
              h("p.th-note", h("b", "Advanced: new with a bound function. "), "new ignores the locked this and builds a fresh object. The real bind does that. Use this version: inside the returned function, new.target is only set when it was called with new."),
              D.bindImpl.advanced,
              h("p.th-note", `Checked in Node: a bound function called with new keeps the original prototype chain (${D.show(D.boundNew().inst)}) and ignores the locked this (${D.show(D.boundNew().lockedIgnored)}).`))),
          links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "08", title: "Write map, filter and reduce",
          lines: [
            "A common coding question: write Array.prototype.map, then filter and reduce.",
            "Here the real method is the judge. Each test runs both and compares, holes and errors too.",
            ["We handle ", word("holes", "An empty slot in an array, like [1, , 3]. The real map skips it."), " (empty slots like [1, , 3]), thisArg, TypeError and array-likes. We skip subclass results."],
          ],
          demo: h("div.th-stack",
            runnable({ title: "Write Array.prototype.myMap", code: D.runnableCode.map("starter"), rows: 32, explain: explainCases("map", "Your myMap, case by case") }),
            solution("Show a solution for map", D.mapImpl.solution),
            runnable({ title: "Write myFilter and myReduce", code: D.runnableCode.fr("starter"), rows: 34, explain: explainCases("fr", "Your filter and reduce, case by case") }),
            solution("Show a solution for filter and reduce", D.frImpl.solution)),
          links: [L.jsinfo],
        }),
        step({
          n: "09", title: "Six ways to make objects",
          lines: ["JavaScript gives you many ways to make an object. They differ in where the methods live and what stays private.", ["A ", word("closure", "A function that remembers the variables around it, even after the outer function has finished."), " keeps data private. Pick a card: each says when not to use it, and shows a check that ran on this page."]],
          demo: Book.hubSpoke({ title: "Where the methods live, for each way", items: HUB }), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "10", title: "From your work: a class, a bind, and a closure in Anemone",
          lines: [
            "Anemone's v2/js has one class: Smoothed. It uses this, and every call has a dot, so this is never lost.",
            ["perf.js uses one bind, to wrap a method and keep its object. recorder.js is a ", word("factory", "A plain function that builds and returns an object. No new and no class."), " that does not use this at all."],
            "Below: the three excerpts, then what happens if the recorder used this.",
          ],
          demo: h("div.th-stack",
            h("div.th-excerpt", h("span.label", "A class (the only one in v2/js)"), code(UTIL_JS),
              h("p.th-note", "Smoothed is used as sm.set(…), sm.silent(now) and sm.at(next) (see audio/voices-laughter.js lines 212-224). Always with a dot, so this is the Smoothed object."),
              h("p.th-note", "A copy of Smoothed is run on this page, with level = new Smoothed(0, 2) and level.set(1, 0)."),
              h("div.th-table", row("A normal call, with a dot: level.at(1)", D.smoothedTry("level.at(1)")), row("Detached: (0, level.at)(1)", D.smoothedTry("(0, level.at)(1)")))),
            h("div.th-excerpt", h("span.label", "A bound method"), code(PERF_JS),
              h("p.th-note", "The script keeps the old tick, swaps in a wrapper that measures time, and calls the old one with a plain call tick(y, section). bind(rec) keeps rec as this for that plain call, and the last line puts the old tick back.")),
            h("div.th-excerpt", h("span.label", "The recorder: a factory with a closure"), code(REC_JS),
              h("p.th-note", "tick uses the variable lastY, not this. So here the bind is safe but not needed. Below: the same wrapper pattern run on this page, in strict mode like an ES module."),
              h("div.th-table", wrapRows.map((r) => row(r.label, r.result)))),
            h("p.th-note", h("b", "Honest note: "), "the wrap-and-restore pattern (keep the old method, replace it, call the old one) is a well-known way to measure code. I found no place in v2/js where a class method is passed as a callback and loses this: the real lesson is the closure-versus-this choice in the recorder. All commits in this repo are under your names, but git cannot show which lines an AI helped with. Be ready to say which parts you wrote.")),
          links: [L.jsinfo],
        }),
        step({
          n: "11", title: "On the job",
          lines: ["A ticket arrives. Read it, think about your steps, and then compare."],
          demo: Book.onTheJob({
            id: "SPK-241", title: "Clicking Save throws “Cannot read properties of undefined (reading 'items')”",
            context: "A teammate wrote a small DraftEditor class. The Save button calls it through the page's UI helper. Support says: “Save does nothing, and the console shows an error.” It worked when the code was a plain function.",
            symptoms: [bugRun.error || "No error", "The stack points to save(), at the line that reads this.items.", "The UI helper stores the handler and later calls it as fn()."],
            code: D.TICKET_BUG,
            tasks: ["Find why this is undefined.", "Fix it in the smallest safe way.", "Add a test that fails before the fix.", "Find other places with the same mistake."],
            steps: [
              "Read the stack trace. The top frame is save, at this.items. The message says reading 'items' of undefined, so the missing thing is this, not items. (Message words are from Chrome and Node; other browsers say it differently.)",
              `Find where this is lost. In the constructor, ui.onSave(this.save) passes the method alone. The helper later calls fn() with no dot. Class code is strict, so this stays undefined. (With addEventListener the browser sets this to the element, the button. Then this is the button, and the button has no items, so the error changes to: “${D.ticketDom()}”.)`,
              h("div.th-stack", h("p", "Fix it. Best fit for a handler: an arrow field (save = () => {…}), so this is the editor wherever it is called. Two other fixes work too: this.save = this.save.bind(this) in the constructor, or ui.onSave(() => this.save()). All three were run on this page and give “saved 2 items”."), code(D.ticketVariants.arrow)),
              h("div.th-stack", h("p", "Add a regression test with a fake UI that calls handlers as fn(). Run it before the fix: it fails with the same message. After the fix it passes."), code(TEST_CODE)),
              h("div.th-stack", h("p", "Search for the same mistake: a this.method passed without being called. Expect a few false alarms (a method that never uses this is fine). It also finds onClick={this.save} in JSX."), code(D.GREP)),
            ],
          }),
          links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "12", title: "Real interview questions",
          lines: ["These were reported by real candidates. The company, date and link are on each card.", "Try each one out loud first, then open the answer."],
          demo: h("div.th-stack",
            Book.interviewQuestions(IQ),
            h("span.label", "Practice questions (not from a report)"),
            Book.drill(PRACTICE)),
          links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "13", title: "In one sentence",
          lines: ["this comes from the call. Methods come from the prototype chain."],
          demo: h("ol.th-rule",
            h("li", h("span", h("b", "Ask in order: "), "arrow, new, call/apply/bind, a dot, a plain call.")),
            h("li", h("span", h("b", "A plain call "), "gives undefined in strict mode and globalThis in sloppy mode.")),
            h("li", h("span", h("b", "Objects find methods "), "by walking the prototype chain. class builds that chain for you.")),
            h("li", h("span", h("b", "A method passed as a callback loses its object. "), "Wrap it in an arrow, bind it, or use an arrow field."))),
          links: [L.jsinfo, L.ydkjs],
        }),
      );
    },
  });
})();
