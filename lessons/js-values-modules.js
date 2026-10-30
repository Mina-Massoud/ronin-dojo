/* Lesson: Values, equality and modules (Wave 2, Part A, A6/A7).
   Order: boxes and arrows → copies → equality → surprises → immutability → deepClone → tree-shaking → live binding
   → tools map → from your work → on the job → interview → one sentence.
   Every output the page states comes from js-values-modules.data.js, which dev/js-values-modules.test.js runs (module files with real node). */
(function () {
  const { h, word, step, runnable, prereqs } = Book;
  const V = Book.parts["js-values-modules"];
  const D = V.data;

  /* ---------- Go deeper links (URLs from research/frontend-syllabus.md only) ---------- */
  const L = {
    jsinfo: { title: "javascript.info", url: "https://javascript.info/", type: "doc", by: "javascript.info" },
    ydkjs: { title: "You Don't Know JS Yet", url: "https://github.com/getify/You-Dont-Know-JS", type: "book", by: "Kyle Simpson" },
    react: { title: "react.dev Learn", url: "https://react.dev/learn", type: "doc", by: "React team" },
    comeau: { title: "Why React Re-Renders", url: "https://joshwcomeau.com/react/why-react-re-renders", type: "article", by: "Josh Comeau" },
    fih: { title: "Front End Interview Handbook", url: "https://www.frontendinterviewhandbook.com/", type: "doc", by: "Front End Interview Handbook" },
    gfe: { title: "GreatFrontEnd Study Plans", url: "https://www.greatfrontend.com/interviews/study-plans", type: "doc", by: "GreatFrontEnd" },
    perf: { title: "Learn Performance", url: "https://web.dev/learn/performance", type: "course", by: "web.dev" },
  };
  const got = (name) => D.evalClaim(D.CLAIMS[name]).got;
  const sub = (t) => h("h3.vm-sub", t);

  /* ---------- 06. See it as code: deepClone ---------- */
  function explainClone(r) {
    const t = r.tests || {};
    const names = Object.keys(t);
    const failing = names.filter((n) => !t[n]);
    return Book.resultCard({
      title: "The tests",
      rows: names.map((n) => ({ label: n, value: t[n] ? 1 : 0.02, text: t[n] ? "pass" : "FAIL" })),
      sentences: [
        `${names.length - failing.length} of ${names.length} tests pass.` + (failing.length ? ` Failing: ${failing.join(", ")}.` : " Every test passes."),
        !failing.length ? "Your version copies every level, and it remembers objects it already copied, so a circular object does not loop forever."
          : failing.some((n) => /Date|undefined|circular/.test(n)) ? "The JSON trick cannot keep a Date (it becomes text), cannot keep undefined (the key disappears), and throws a TypeError on a circular object."
          : "Look at the failing test name. Which kind of value does your function not handle?",
      ],
      note: "In real code, use structuredClone. This exercise shows what a deep copy has to do. It does not copy Map, Set, RegExp or class prototypes.",
    });
  }
  const yesNo = (v) => (v ? "yes" : "no");

  /* ---------- 09. Hub: copy and compare tools ---------- */
  const ex = (key) => D.snipText(D.HUB_SNIPS[key]);
  const HUB = [
    { id: "strict", name: "===", short: "compare, no converting", w: "H", picture: V.picture("eq"), problem: "Ask whether two values are the same, with no converting.", use: "Almost always. It is the default in most style guides.",
      avoid: "To compare objects by content: [1] === [1] is false, because they are two objects. And NaN === NaN is false.", lang: "js", example: ex("strict") },
    { id: "is", name: "Object.is", short: "=== with two fixes", w: "M", picture: V.picture("eq"), problem: "Compare values when NaN and -0 matter.", use: "Test for NaN with Number.isNaN(x). Use Object.is when you compare two values and NaN or -0 must count, as React does for state.",
      avoid: "For everyday comparing: === is shorter and everyone knows it.", note: "Object.is(0, -0) is false, but 0 === -0 is true.", lang: "js", example: ex("is") },
    { id: "spread", name: "Spread and Object.assign", short: "shallow copy", w: "H", picture: V.picture("shared"), problem: "Make a new object or array with the same first-level values.", use: ["Updating state in React or in a ", word("reducer", "A function that takes the old state and an action, and returns the new state."), ": copy, then change one field."],
      avoid: "When you change an inner object afterwards. The inner objects are shared between the old and the new one (see the picture).", lang: "js", example: ex("spread") },
    { id: "clone", name: "structuredClone", short: "deep copy", w: "H", picture: V.picture("deep"), problem: "Copy nested data so nothing is shared.", use: "Deep copies of plain data: objects, arrays, Date, Map, Set, and circular references.",
      avoid: "Functions, Symbols and DOM elements throw a DataCloneError. A class instance becomes a plain object, so it loses its methods. Getters become plain values. Private #fields and symbol keys are dropped.", note: "Built into current browsers and Node 17 or newer. Check the browsers you must support.", lang: "js", example: ex("clone") },
    { id: "json", name: "JSON round trip", short: "an old deep copy", w: "M", picture: V.picture("json"), problem: "An old way to deep copy: JSON.parse(JSON.stringify(x)).", use: "Data that is plain JSON anyway: numbers, text, booleans, arrays and plain objects.",
      avoid: "Dates become text, undefined and functions disappear, NaN becomes null, and a circular object throws. Map and Set become {}. In arrays, undefined becomes null. Use structuredClone instead.", lang: "js", example: ex("json") },
    { id: "freeze", name: "Object.freeze", short: "shallow lock", w: "M", picture: V.picture("frozen"), problem: "Stop code from changing an object's own properties.", use: "Constants and config objects.",
      avoid: "Thinking it is deep: inner objects can still change. And in old (non-strict) mode, a plain write to a frozen object fails silently, so a bug can hide.",
      note: `Plain assignment fails silently in old (non-strict) mode, but array methods such as push still throw a TypeError. In strict mode (modules and classes are strict), assignment throws too: ${D.evalClaim(D.FREEZE_MODES[1]).got.replace(/"/g, "")}.`, lang: "js", example: ex("freeze") },
    { id: "immer", name: "Immer (produce)", short: "write it like mutation", w: "M", problem: "Write an update as if you change the state. You get a new state. Parts you did not touch are reused.",
      use: "Deeply nested state, where spread gets long and easy to get wrong.", avoid: "Small, flat state. Spread is simpler and needs no library.",
      note: "Not run on this page: it needs the immer library.", lang: "js", example: "import { produce } from \"immer\";\n\nconst next = produce(state, (draft) => {\n  draft.rows[0].status = \"done\"; // looks like mutation\n});\n// state is untouched, next is a new object" },
  ];

  /* ---------- 10. From your work ---------- */
  const SPEAKO_JS = `// speako-web/src/app/(app)/(dashboard-layout)/agent/settings/voice/_components/voice-reducer.ts
// (lines 61-69 and 72-80)
    case "SET_PRIMARY_LANGUAGE": {
      // When primary language changes, disable it in language_presets
      // (it shouldn't appear as both primary and secondary)
      const newPresets = { ...state.languagePresets };
      if (newPresets[action.payload]) {
        newPresets[action.payload] = { ...newPresets[action.payload], enabled: false };
      }
      return { ...state, primaryLanguage: action.payload, languagePresets: newPresets, hasUnsavedChanges: true };
    }
    // …
    case "SET_LANGUAGE_PRESET":
      return {
        ...state,
        languagePresets: {
          ...state.languagePresets,
          [action.payload.languageCode]: action.payload.preset,
        },
        hasUnsavedChanges: true,
      };`;
  const ANEMONE_JS = `// anemone/v2/js/audio/util.js (line 3)
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// anemone/v2/js/audio/scheduler.js (lines 6 and 12)
import { clamp } from "./util.js";
export function createScheduler(ctx, onTick) {

// anemone/v2/index.html (lines 203-207): the browser runs the source as it is
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/",

// anemone/vite.config.js (lines 1-3): production is bundled
// Builds the v2 site into dist/ (what Cloudflare Pages serves): every module bundled and minified, with hashed
// names under build/ so browsers may keep them for good. The source in v2/ still runs as it is (import map, no
// build), so \`node scripts/serve.mjs\` previews keep working.`;
  function explainWork(r) {
    const w = r["What changed"];
    return Book.resultCard({
      title: "What the reducer did",
      rows: [
        { label: "Old state untouched?", value: w.oldStateUntouched ? 1 : 0.02, text: yesNo(w.oldStateUntouched) },
        { label: "New state changed?", value: w.newStateChanged ? 1 : 0.02, text: yesNo(w.newStateChanged) },
        { label: "languagePresets is a new object?", value: w.presetsIsNew ? 1 : 0.02, text: yesNo(w.presetsIsNew) },
        { label: "The preset it did not touch is shared?", value: w.untouchedPresetShared ? 1 : 0.02, text: yesNo(w.untouchedPresetShared) },
      ],
      sentences: [
        "The reducer copies the path from the top to the one preset that changes: the state, languagePresets, and the “fr” preset. Everything else is shared with the old state.",
        "That is called copying the path to the change. It keeps the old state safe (good for React, undo and tests), and it keeps unchanged parts as the same object (good for memo and fast checks).",
      ],
    });
  }

  /* ---------- 11. On the job ---------- */
  function explainRepro(r) {
    const b = r["Broken version"];
    const f = r["Fixed version"];
    if (!b || !f) return h("p.result-say", "One of the two parts did not report. Press Reset to get the original code back.");
    return Book.resultCard({
      title: "Reproduced",
      rows: [
        { label: "Broken: old list changed?", value: b.oldRowChanged ? 1 : 0.02, text: yesNo(b.oldRowChanged) },
        { label: "Fixed: old list changed?", value: f.oldRowChanged ? 1 : 0.02, text: yesNo(f.oldRowChanged) },
        { label: "Fixed: other row shared?", value: f.otherRowShared ? 1 : 0.02, text: yesNo(f.otherRowShared) },
      ],
      sentences: [
        `In the broken version the array is new (${yesNo(b.newArray)}), but row 2 is the same object, so the old list changed too: ${yesNo(b.oldRowChanged)}.`,
        `In the fixed version only row 2 is copied. The old list is safe (changed: ${yesNo(f.oldRowChanged)}), and row 1 is still the same object (${yesNo(f.otherRowShared)}), so React can skip it.`,
      ],
    });
  }

  /* ---------- 12. Interview questions ---------- */
  const IQ = [
    {
      q: "“var, let, const.” (Asked together with “What is a closure and how does it work?”)",
      type: "concept", level: "junior-ish", source: { company: "Redisolve", year: "Jun 2025", url: "https://dev.to/seenuvasan_p/day-18-my-frontend-interview-experience-at-redisolve-what-i-learned-179" },
      testing: "A screening baseline. The part that separates answers: does const freeze the value, or only the name?",
      answer: [
        "Scope: var belongs to the whole function. let and const belong to the block. The scope part of this question is in the lesson “Scope, hoisting and closures”.",
        "Values: const fixes the name, not the value. The box cannot hold a different arrow. But the object it points to can still change.",
        Book.code(`const o = {};\no.x = 1;      // works: o.x is ${got("constObject")}\nconst c = 1;\nc = 2;        // ${got("constReassign").replace(/"/g, "")}`),
        "To stop changes to an object's own properties, use Object.freeze. It is shallow: inner objects can still change.",
      ],
    },
    {
      q: "“Build tools like Webpack or Vite are used for?” Also: dev vs production, and npm vs yarn.",
      type: "concept", level: "junior-ish", source: { company: "Redisolve", year: "Jun 2025", url: "https://dev.to/seenuvasan_p/day-18-my-frontend-interview-experience-at-redisolve-what-i-learned-179" },
      testing: "A screening baseline for tooling. A strong answer names tree-shaking and why it needs ES modules.",
      answer: [
        "A bundler reads your import graph, joins many files into a few, removes unused exports (tree-shaking), makes the files small (minify), and gives them hashed names so browsers can keep them.",
        "Dev vs production: in development you want fast start and instant updates. In production you want small files and good caching, so you build and bundle.",
        "npm and yarn are both package managers. They install the packages in package.json. Each keeps a lock file, so everyone gets the same versions: package-lock.json for npm, yarn.lock for yarn. Yarn and pnpm are often faster at installing, and they support workspaces (several packages in one repo).",
        "Vite serves your source as native ES modules in development, and bundles for production. Webpack bundles in development too.",
        "Tree-shaking works because import and export are static text. See the film on this page.",
      ],
    },
    {
      q: "Recruiter-stage JavaScript snippets (Set, Map, Promise, setTimeout, let/const), explained aloud.",
      type: "concept", source: { company: "Canva", url: "https://www.greatfrontend.com/interviews/company/canva/questions-guides" },
      testing: "Whether you can say, line by line, what each value is. (A community write-up; no year is given. The Promise and setTimeout parts are in other lessons.)",
      answer: [
        "Read each line aloud and say the value after it. For values, the useful facts are about equality.",
        Book.code(`new Set([NaN, NaN]).size;     // ${got("setNaN")}: a Set treats NaN as equal to NaN\nnew Set([{}, {}]).size;       // ${got("setObjects")}: two objects are two values\nnew Map([[{}, 1]]).get({});   // ${got("mapKey")}: a new {} is a different key`),
        "A Set or a Map compares objects by reference, the same as ===.",
      ],
    },
  ];
  const PQ = [
    {
      q: "Why is [] == ![] true?",
      type: "concept", source: { label: "Practice question, not from a report" },
      testing: "Whether you can follow the conversion rules in order.",
      answer: [
        `First ![]: an array counts as true, so ![] is false. Now the question is [] == false. The result is ${got("emptyNotEmpty")}.`,
        "Then == turns false into 0, and the array into the text \"\" (an empty array has no items to join), and then \"\" into 0. 0 == 0 is true. Page 04 shows each step.",
        "In practice I use === and never write this.",
      ],
    },
    {
      q: "What is the difference between a shallow copy and a deep copy? How do you make each?",
      type: "concept", source: { label: "Practice question, not from a report" },
      testing: "Do you know what is shared after a copy?",
      answer: [
        "A shallow copy copies the first level. Inner objects are shared. Make one with spread { ...a } or [...list], Object.assign, or slice. A deep copy copies every level. Make one with structuredClone.",
        Book.code(ex("spread")),
        "Spread copies only own enumerable properties, and getters become plain values.",
        "Say what structuredClone cannot do: it throws for functions and DOM nodes, and class instances lose their class.",
      ],
    },
    {
      q: "Write a deepClone function.",
      type: "coding", source: { label: "Practice question, not from a report" },
      testing: "Recursion, and the edge cases: Date, circular references, undefined.",
      answer: [
        "Say first what you handle: plain objects, arrays, Date, and circular references. Use a WeakMap to remember objects you already copied.",
        Book.code(D.CLONE_SOLUTION),
        "Then say what you skip (Map, Set, RegExp, prototypes) and that in real code you would call structuredClone.",
      ],
    },
    {
      q: "Why does tree-shaking need ES modules, not CommonJS?",
      type: "concept", source: { label: "Practice question, not from a report" },
      testing: "Static versus runtime: the one idea behind the answer.",
      answer: [
        "import and export are fixed text at the top of a file. A bundler can read them before running anything, and see which names are used. require is a function call. Its path can be built while the program runs, and module.exports is a plain object that code can change. So the bundler usually has to keep the whole file.",
        "Code that runs when a file loads (a side effect) is kept, unless the package says it is safe to drop (package.json \"sideEffects\": false). ESM also has import() when you want to load code later.",
      ],
    },
    {
      q: "Is JavaScript pass by value or pass by reference?",
      type: "concept", source: { label: "Practice question, not from a report" },
      testing: "Do you know what a function receives when you pass an object?",
      answer: [
        "Always pass by value. For an object, the value is the arrow. The function gets a copy of the arrow (this is called call by sharing). Reassigning the parameter does not change the caller's variable. Changing the object through it does.",
        Book.code(D.PASS_CODE),
      ],
    },
    {
      q: "In React, items.push(x); setItems(items) does not update the screen. Why? What is the fix?",
      type: "debugging", source: { label: "Practice question, not from a report" },
      testing: "State compared by reference.",
      answer: [
        "React compares the new state with the old state using Object.is. It is the same array, so React skips the update. (React may still call your component one extra time first, but it does not update the screen or run effects.) The array in memory did change, so the next unrelated render shows x. That makes the bug confusing.",
        Book.code("setItems([...items, x]); // a new array: Object.is says it changed"),
      ],
    },
  ];

  Book.registerLesson("js-values-modules", {
    mount(root) {
      root.append(
        prereqs([
          ["Primitive and object", "A primitive is a number, text (a string in code), true or false (a boolean), null, undefined, and also Symbol and BigInt. An object is everything else: arrays, functions and { … }."],
          ["Reference", "A reference is an arrow to an object. Two names can hold arrows to the same object."],
          ["Module", "A module is a file that exports things and imports things from other files."],
        ]),
        step({
          n: "01", title: "When does JavaScript copy a value?",
          lines: [
            ["A ", word("variable", "A name for a box that holds a value."), " is a box. A number sits inside the box. An object does not fit: the box holds an arrow to it."],
            ["Copy a number, a ", word("string", "Text in code, like \"Mina\"."), " or a ", word("boolean", "true or false."), " and you get a new box. Copy an object name and you get another arrow to the same object."],
            "Press play. Every line runs for real, and the picture follows.",
          ],
          demo: V.valuesFilm(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "02", title: "Shallow copy, deep copy",
          lines: [
            ["A ", word("shallow copy", "A copy of only the first level. Inner objects are shared, not copied."), " copies one level. A ", word("deep copy", "A copy of every level, so nothing is shared."), " copies all of them."],
            ["Make a copy with ", word("spread", "The three dots ... copy the keys of an object into a new one."), ": { ...a }. Guess each answer, then press the button. The code runs for real."],
          ],
          demo: V.copy(), links: [L.jsinfo, L.fih],
        }),
        step({
          n: "03", title: "== or ===? Ask three questions",
          lines: [
            "Three questions can compare two values: ==, === and Object.is.",
            [word("Coercion", "JavaScript changes a value to another type, for example text to a number, so two values can be compared."), " means a value is changed to another type (kind) first. == does it. === does not."],
            "In the last step, click any cell to ask about a pair.",
          ],
          demo: V.equality(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "04", title: "Four surprising results",
          lines: ["Some == results look wrong. They follow rules, and you can read the rules one step at a time.", "Guess first. Then press the button. Every result on the screen was run just now."],
          demo: V.surprises(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "05", title: "Why doesn't my list update?",
          lines: [
            ["In React, state must be replaced, not changed. This is ", word("immutability", "Not changing a value after it is made. You make a new value instead."), "."],
            "React asks one question: is the new value the very same object? That is the Object.is check from page 03.",
            "This page uses a tiny model, not real React. It shows only the Object.is check. Real React may call your component once more before it skips.",
          ],
          demo: V.immutable(), links: [L.react, L.comeau],
        }),
        step({
          n: "06", title: "Write deepClone",
          lines: [["Interviewers ask for this. The JSON trick looks right, but it fails on dates, on undefined, and on a ", word("circular object", "An object that contains itself, for example o.self = o."), "."], ["Press Run. Read which tests fail. Then write a ", word("recursive", "A function that calls itself for each inner level."), " version. A solution is below."]],
          demo: h("div.demo-stack",
            runnable({ code: D.cloneCode(D.CLONE_NAIVE), rows: 28, explain: explainClone, title: "Make deepClone pass all tests" }),
            h("details.vm-sol", h("summary", "Show a solution"), Book.code(D.CLONE_SOLUTION), h("p.vm-note", "Replace the function at the top with this one and press Run. All five tests pass."))),
          links: [L.fih, L.gfe],
        }),
        step({
          n: "07", title: "Tree-shaking: dropping code nobody uses",
          lines: [
            ["A ", word("bundler", "A tool that joins many files into a few files for the browser."), " reads your imports and joins your files. ", word("Tree-shaking", "Removing code that nothing imports, so it does not reach the user."), " removes unused exports."],
            ["It works with ", word("ES modules (ESM)", "The import and export style of modules."), ". It works less well with ", word("CommonJS", "Node's older style: module.exports and require."), "."],
            "Press play. Import lines are plain text, known before the code runs.",
          ],
          demo: h("div.demo-stack", V.shakeFilm(),
            h("div.vm-excerpt",
              h("p.vm-note", h("b", "A trap: "), "import _ from \"lodash\" and import { debounce } from \"lodash\" both bring in the whole library, because lodash is written in CommonJS."),
              Book.code("import debounce from \"lodash/debounce\";\nimport { debounce } from \"lodash-es\";"),
              h("p.vm-note", ["Import one function, or use the ES module build lodash-es. A package can also say \"sideEffects\": false in package.json, so a bundler may drop files nobody imports. Check the result with a ", word("bundle analyzer", "A tool that shows what is inside your bundle."), "."]))),
          links: [L.perf, L.jsinfo],
        }),
        step({
          n: "08", title: "Live binding: import vs require",
          lines: [
            ["An ESM import is a ", word("live binding", "The imported name is a window to the exporter's variable. It always shows the current value."), ". A CommonJS export holds the value as it was when the file loaded."],
            "Guess each time. The outputs you see come from running these files with real Node.",
            ["To see changes in CommonJS, read through a ", word("getter", "A property that runs a function when you read it."), "."],
          ],
          demo: V.liveBinding(), links: [L.jsinfo, L.ydkjs],
        }),
        step({
          n: "09", title: "Copy and compare tools",
          lines: ["Seven tools. Pick a card to see when it fits, and when it does not.", "The results in the code examples were run for real."],
          demo: Book.hubSpoke({ title: "Copy and compare tools", items: HUB }), links: [L.jsinfo, L.react],
        }),
        step({
          n: "10", title: "From your work: reducers and modules",
          lines: [["Two real places where this lesson shows up: a ", word("reducer", "A function that takes the old state and an action, and returns the new state."), " in Speako, and ES modules in Anemone."], "Read the excerpts. Then run the small version of the reducer."],
          demo: h("div.demo-stack",
            h("div.vm-excerpt", h("span.label", "Speako: a reducer that never changes the old state"), Book.code(SPEAKO_JS),
              h("p.vm-note", "Spread copies the object. The middle object (languagePresets) is copied, and only the one preset that changes is copied again."),
              runnable({ code: D.WORK_CODE, rows: 20, explain: explainWork, title: "A small version of that reducer" }),
              h("p.vm-note", h("b", "Honest note: "), "This is the standard React and Redux way to write a reducer. This copy of the code may not have every commit."),
              h("details.vm-sol", h("summary", "More about who wrote it"), h("p.vm-note", "In the local Speako checkout, this file's commits are all by the author “Billy Chan”. Be ready to say which reducers you wrote yourself. The code in the runnable is a small rewrite of the idea, made for this lesson. It is not a copy."))),
            h("div.vm-excerpt", h("span.label", "Anemone: modules in the browser, a bundle in production"), Book.code(ANEMONE_JS),
              h("p.vm-note", ["The source is ES modules. The browser runs them with an ", word("import map", "A list in the page that says where each import name is loaded from."), ", and the production build bundles them with Vite."]),
              h("p.vm-note", h("b", "Honest note: "), "Tree-shaking here is Vite's default, not something you set up. What is yours: the no-build source with an import map, and the Vite build setup."),
              h("details.vm-sol", h("summary", "What was checked"), h("p.vm-note", "Checked when this lesson was built: util.js has 17 exports, and every one is used (loopSource is used inside util.js itself), so the bundler has nothing to drop in that file. The build was not run and no bundle was measured."))),
          ),
          links: [L.react, L.perf],
        }),
        step({
          n: "11", title: "On the job",
          lines: ["A ticket arrives. Read it, think about your steps, and then compare."],
          demo: h("div.demo-stack",
            Book.onTheJob({
              id: "SPK-247", title: "Changing one booking's status changes it in two places",
              context: "On the bookings page, you mark one booking as Done. The table shows it. But when the user presses Undo, the old list comes back with that booking still Done. Support says: “One change, and two places changed.”",
              symptoms: ["The new list is correct.", "The saved old list (for Undo) shows the new status too.", "The bug only shows for rows, not for the list length."],
              code: D.TICKET_CODE,
              tasks: ["Reproduce it in a few lines.", "Find which objects are shared.", "Fix it without copying the whole list.", "Add a test that would have caught it."],
              steps: [
                "Reproduce. Keep the old list in a variable, call setStatus, then read the old list. The runnable below does exactly that.",
                "Read the code. [...rows] copies only the array, which is the first level. The rows inside it are the same objects, so row.status = status writes into an object that both lists share. Check with next[1] === rows[1]: it is true.",
                "Fix it by copying the path to the change: rows.map((r) => (r.id === id ? { ...r, status } : r)). The array is new, the one changed row is new, and every other row stays the same object, so React can skip it. Do not use structuredClone on the whole list for every update: it is slower, and it makes every row a new object.",
                "Add a test. Check three things: the old list is unchanged, the changed row is a new object, and an unchanged row is the same object (toBe).",
                "Look for the same pattern. Search for [...x] or { ...x } followed by an assignment to an inner field. In TypeScript, type the list as ReadonlyArray<Readonly<Row>>: then row.status = status is a compile error (TS2540: Cannot assign to 'status' because it is a read-only property). For deeply nested state, Immer is another choice.",
              ],
            }),
            runnable({ code: D.REPRO_CODE, rows: 24, explain: explainRepro, title: "Reproduce it, then fix it" })),
          links: [L.react, L.fih],
        }),
        step({
          n: "12", title: "Real interview questions",
          lines: [
            "Only three reported questions fit this topic. Each has the company and the link.",
            "Below them are practice questions written for this lesson. They are not from a report.",
          ],
          demo: h("div.demo-stack", sub("Reported questions"), Book.interviewQuestions(IQ), sub("Practice questions (not from a report)"), Book.interviewQuestions(PQ)),
          links: [L.fih, L.gfe, L.ydkjs],
        }),
        step({
          n: "13", title: "In one sentence",
          lines: ["Numbers and text are copied. Objects are shared by arrow. And import is fixed text that a bundler can read."],
          demo: h("ol.vm-rule",
            h("li", h("span", h("b", "A copy of an object is shallow by default."), " Spread copies one level. Use structuredClone for all levels.")),
            h("li", h("span", h("b", "Use ==="), ", not ==. Use Object.is only when NaN or -0 matters.")),
            h("li", h("span", h("b", "Do not change state."), " Make a new object, because React compares by reference.")),
            h("li", h("span", h("b", "ESM imports are static, so bundlers can shake them."), " CommonJS require is a call that runs later."))),
          links: [L.ydkjs, L.jsinfo, L.react],
        }),
      );
    },
  });
})();
