/* Values, equality and modules: the data and small pure helpers for this lesson.
   Everything the pages say about what code prints comes from here, and dev/js-values-modules.test.js runs the SAME snippets
   in Node and checks them (the module demos are written to temp files and run with real `node`).
   Works in the browser (Book.parts["js-values-modules"].data) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["js-values-modules"] = root.Book.parts["js-values-modules"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* ---------- 1. showing and checking values ---------- */
  const show = (v) => {
    if (Object.is(v, -0)) return "-0";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "function") return "function";
    if (Array.isArray(v)) return v.length ? "[" + v.map(show).join(", ") + "]" : "[]";
    if (v instanceof Date) return "Date";
    if (v && typeof v === "object") return "{…}";
    return String(v);
  };
  const evalExpr = (src, setup = "") => new Function(`${setup}\nreturn (${src});`)();
  /* A claim is [expr, expectedText] (or with a setup). evalClaim runs it for real. */
  const evalClaim = (c) => {
    const [expr, expect, setup] = Array.isArray(c) ? c : [c.expr, c.expect, c.setup];
    const got = show(evalExpr(expr, setup));
    return { expr, expect, got, ok: got === expect };
  };

  /* ---------- 2. a trace of really running small programs (names, boxes, arrows) ---------- */
  /* Each line of the program is run for real. After every line we look at the variables and describe them:
     a number or text is a "prim" (a value in the box), an object is a "ref" (an arrow to an object with an id). */
  function trace(lines, names) {
    const ids = new WeakMap();
    let next = 1;
    const describe = (v, reg) => {
      if (v === null || (typeof v !== "object" && typeof v !== "function")) return { k: "prim", text: show(v) };
      if (!ids.has(v)) ids.set(v, next++);
      const id = ids.get(v);
      if (!(id in reg)) {
        reg[id] = { id, kind: Array.isArray(v) ? "array" : "object", props: [] };
        reg[id].props = Object.keys(v).map((key) => [key, describe(v[key], reg)]);
      }
      return { k: "ref", id };
    };
    const frames = [];
    const snap = (line, getters) => {
      const objects = {};
      const vars = {};
      for (const n of names) {
        try { vars[n] = describe(getters[n](), objects); } catch (e) { vars[n] = { k: "unset" }; }
      }
      frames.push({ line, vars, objects });
    };
    snap(-1, Object.fromEntries(names.map((n) => [n, () => { throw new Error("unset"); }])));
    const src = lines.map((l, i) => `${l}\n__snap(${i}, {${names.map((n) => `${n}: () => ${n}`).join(", ")}});`).join("\n");
    new Function("__snap", src)(snap);
    return { lines, names, frames };
  }
  const PROGRAMS = {
    prim: { id: "prim", title: "Copying a number", names: ["a", "b"], lines: ["let a = 5;", "let b = a;", "b = 6;"] },
    obj: { id: "obj", title: "Copying an object", names: ["a", "b"], lines: ["const a = { name: \"Mina\" };", "const b = a;", "b.name = \"Sam\";"] },
    shallow: { id: "shallow", title: "A copy with spread", names: ["a", "b"], lines: ["const a = { name: \"Mina\", tags: { n: 1 } };", "const b = { ...a };", "b.name = \"Sam\";", "b.tags.n = 2;"] },
    deep: { id: "deep", title: "A copy with structuredClone", names: ["a", "b"], lines: ["const a = { name: \"Mina\", tags: { n: 1 } };", "const b = structuredClone(a);", "b.name = \"Sam\";", "b.tags.n = 2;"] },
    json: { id: "json", title: "A copy with JSON", names: ["a", "b"], lines: ["const a = { name: \"Mina\", tags: { n: 1 } };", "const b = JSON.parse(JSON.stringify(a));", "b.name = \"Sam\";", "b.tags.n = 2;"] },
  };
  const runProgram = (id) => trace(PROGRAMS[id].lines, PROGRAMS[id].names);

  /* All the ways to reach an object id from a variable: ["a", "b.tags"]. */
  function pathsTo(fr, id) {
    const out = [];
    const walk = (d, path, seen) => {
      if (d.k !== "ref" || seen.has(d.id)) return;
      if (d.id === id) out.push(path);
      const o = fr.objects[d.id];
      for (const [key, sub] of o.props) walk(sub, path + "." + key, new Set([...seen, d.id]));
    };
    for (const [n, d] of Object.entries(fr.vars)) walk(d, n, new Set());
    return out;
  }
  const sameD = (x, y) => x && y && x.k === y.k && x.id === y.id && x.text === y.text;

  /* A plain-English caption for frame k (the state after line k-1), made from the difference between two frames. */
  function explainFrame(tr, k) {
    const f = tr.frames[k];
    const p = tr.frames[k - 1];
    if (!p) return "";
    const out = [];
    for (const n of tr.names) {
      const a = p.vars[n];
      const b = f.vars[n];
      if (b.k === "unset" || sameD(a, b)) continue;
      if (b.k === "prim") {
        const src = tr.names.find((m) => m !== n && f.vars[m].k === "prim" && f.vars[m].text === b.text && new RegExp(`=\\s*${m}\\b`).test(tr.lines[k - 1]));
        if (a.k === "unset") out.push(src ? `Box ${n} is new. It gets a COPY of the value in box ${src}: ${b.text}. The two boxes are separate.` : `Box ${n} holds ${b.text}.`);
        else {
          const others = tr.names.filter((m) => m !== n && f.vars[m].k === "prim");
          out.push(`Box ${n} now holds ${b.text}.` + (others.length ? ` Box ${others.join(" and ")} did not change: ${others.map((m) => f.vars[m].text).join(" and ")}.` : ""));
        }
      } else if (!(b.id in p.objects)) {
        const o = f.objects[b.id];
        const shared = o.props.filter(([, d]) => d.k === "ref" && d.id in p.objects);
        const fresh = o.props.filter(([, d]) => d.k === "ref" && !(d.id in p.objects));
        out.push(`A new object is made, and box ${n} holds an arrow to it.` +
          shared.map(([key]) => ` Its ${key} arrow points to the SAME inner object as before: it was not copied.`).join("") +
          (fresh.length ? (Object.keys(p.objects).length ? ` Its ${fresh.map(([key]) => key).join(" and ")} is a new inner object too: a real copy.` : ` It has another object inside it: ${fresh.map(([key]) => key).join(" and ")}.`) : ""));
      } else {
        const same = tr.names.filter((m) => m !== n && f.vars[m].k === "ref" && f.vars[m].id === b.id);
        out.push(`Box ${n} gets a copy of the arrow. ${[...same, n].sort().join(" and ")} now point to the SAME object.`);
      }
    }
    for (const id of Object.keys(f.objects)) {
      const o = f.objects[id];
      const po = p.objects[id];
      if (!po) continue;
      const changed = o.props.filter(([key, d]) => !sameD(d, (po.props.find(([k2]) => k2 === key) || [])[1]));
      if (!changed.length) continue;
      const ways = pathsTo(f, Number(id));
      const [key, d] = changed[0];
      out.push(`The object changed: ${key} is now ${d.k === "prim" ? d.text : "another object"}.` +
        (ways.length > 1 ? ` You can reach this one object as ${ways.join(" and ")}, so every one of them sees the change.` : ` Only ${ways[0] || "one name"} reaches it. ${tr.names.filter((m) => f.vars[m].k === "ref" && !ways.some((w) => w.split(".")[0] === m)).map((m) => `${m} does not see it`).join(", ")}${tr.names.some((m) => f.vars[m].k === "ref" && !ways.some((w) => w.split(".")[0] === m)) ? "." : ""}`));
    }
    return out.join(" ");
  }

  /* ---------- 3. equality: the explorer, the four surprises ---------- */
  const VALUES = ["0", "\"\"", "\"0\"", "null", "undefined", "NaN", "[]", "false"];
  function compare(a, b) {
    const ex = { loose: `${a} == ${b}`, strict: `${a} === ${b}`, same: `Object.is(${a}, ${b})` };
    return { loose: evalExpr(ex.loose), strict: evalExpr(ex.strict), same: evalExpr(ex.same), ex };
  }
  const matrix = () => VALUES.map((a) => VALUES.map((b) => { const c = compare(a, b); return [c.loose, c.strict, c.same]; }));

  /* Each line is [expression, expected text]. The page runs it live; the test checks the same list. */
  const SURPRISES = [
    {
      id: "empty-false", title: "[] == false is true", expr: "[] == false",
      steps: [
        ["[] == false", "true", "JavaScript sees an array and a boolean. They are different types, so it makes them the same type first."],
        ["Number(false)", "0", "A boolean becomes a number. false becomes 0."],
        ["[] == 0", "true", "Now an array meets a number. JavaScript turns the array into a simple value first."],
        ["String([])", "\"\"", "An array becomes text by joining its items. An empty array has no items, so the text is empty."],
        ["\"\" == 0", "true", "Text and number: the text becomes a number."],
        ["Number(\"\")", "0", "Empty text becomes 0."],
        ["0 == 0", "true", "Same type now. They are equal."],
      ],
    },
    {
      id: "null-trio", title: "null is equal to undefined, not to 0", expr: "null == 0",
      steps: [
        ["null == undefined", "true", "== has one special rule: null and undefined equal each other."],
        ["null == 0", "false", "And null is equal to nothing else with ==. Not 0, not false, not \"\"."],
        ["null >= 0", "true", "But >= is not ==. It turns null into 0 first, so 0 >= 0 is true."],
        ["null === undefined", "false", "=== never converts. They are two different types, so not equal."],
      ],
    },
    {
      id: "nan", title: "NaN is not equal to itself", expr: "NaN === NaN",
      steps: [
        ["NaN === NaN", "false", "NaN means “not a number”. By the rule of numbers, it is never equal to anything, even itself."],
        ["NaN == NaN", "false", "== gives the same answer."],
        ["Object.is(NaN, NaN)", "true", "Object.is is the one that says yes."],
        ["[NaN].includes(NaN)", "true", "includes uses the same idea as Object.is for NaN."],
        ["[NaN].indexOf(NaN)", "-1", "indexOf uses ===, so it cannot find NaN."],
        ["isNaN(\"abc\")", "true", "The old global isNaN converts first: “abc” becomes NaN."],
        ["Number.isNaN(\"abc\")", "false", "Number.isNaN does not convert. “abc” is text, not NaN."],
      ],
    },
    {
      id: "zero-text", title: "\"0\" == false, but \"0\" counts as true", expr: "\"0\" == false",
      steps: [
        ["\"0\" == false", "true", "false becomes 0, and the text \"0\" becomes 0. So they match."],
        ["Boolean(\"0\")", "true", "But as a yes/no test, any text that is not empty counts as true. Even \"0\"."],
        ["Boolean([])", "true", "Rule: in an if(...) test, only \"\", 0, null, undefined, NaN and false count as no. Everything else counts as yes, even \"0\" and []."],
        ["\"0\" === false", "false", "=== does no converting. Text and boolean are different types."],
      ],
    },
  ];
  const EXTRA = [
    ["\"\" == 0", "true", "Empty text becomes 0."],
    ["\"1\" == 1", "true", "Text becomes a number first."],
    ["null == false", "false", "null equals only undefined (and itself)."],
    ["[] == ![]", "true", "![] is false. Then it is [] == false, the case you just saw."],
    ["[1] == 1", "true", "[1] becomes the text \"1\", then the number 1."],
    ["[1, 2] == \"1,2\"", "true", "An array becomes text by joining its items with commas."],
  ];

  /* ---------- 4. copying: what structuredClone can and cannot do, and what the JSON trick loses ---------- */
  class Dog { bark() { return "woof"; } }
  const PROBES = [
    ["a number", () => 1], ["a Date", () => new Date(0)], ["a Map", () => new Map([[1, 2]])],
    ["an object that points to itself", () => { const o = { name: "x" }; o.self = o; return o; }],
    ["a class instance (a Dog)", () => new Dog()], ["a function", () => () => 1], ["a Symbol", () => Symbol("x")],
    ["a DOM element (a div)", () => document.createElement("div")],
  ];
  function cloneProbe(includeDom) {
    return PROBES.filter(([label]) => includeDom || !/DOM/.test(label)).map(([label, make]) => {
      try {
        const v = make();
        const c = structuredClone(v);
        if (v instanceof Dog) return { label, outcome: "loses its class", detail: `clone instanceof Dog is ${c instanceof Dog}, and clone.bark is ${typeof c.bark}` };
        return { label, outcome: "works", detail: v instanceof Date ? `still a Date: ${c instanceof Date}` : "" };
      } catch (e) { return { label, outcome: "error", detail: e.name }; }
    });
  }
  const JSON_SETUP = "const a = { when: new Date(0), gone: undefined, run() {}, bad: NaN };\nconst b = JSON.parse(JSON.stringify(a));";
  const HUB_SNIPS = {
    strict: { setup: "", lines: [["5 === \"5\"", "false"], ["NaN === NaN", "false"], ["[1] === [1]", "false"]] },
    is: { setup: "", lines: [["Object.is(NaN, NaN)", "true"], ["0 === -0", "true"], ["Object.is(0, -0)", "false"]] },
    spread: { setup: "const a = { name: \"Mina\", tags: { n: 1 } };\nconst b = { ...a };", lines: [["b === a", "false"], ["b.tags === a.tags", "true"], ["Object.assign({}, a).tags === a.tags", "true"]] },
    clone: { setup: "class Dog {}\nconst a = { when: new Date(0), tags: { n: 1 }, dog: new Dog() };\nconst b = structuredClone(a);", lines: [["b.tags === a.tags", "false"], ["b.when instanceof Date", "true"], ["b.dog instanceof Dog", "false"]] },
    json: { setup: JSON_SETUP, lines: [["typeof b.when", "\"string\""], ["\"gone\" in b", "false"], ["\"run\" in b", "false"], ["b.bad", "null"]] },
    freeze: { setup: "const a = Object.freeze({ list: [1] });\na.list.push(2);", lines: [["a.list.length", "2"], ["Object.isFrozen(a)", "true"], ["Object.isFrozen(a.list)", "false"]] },
  };
  const snipText = (s) => [s.setup, ...s.lines.map(([e, v]) => `${e}; // → ${v}`)].filter(Boolean).join("\n");
  const FREEZE_MODES = [
    ["(() => { const a = Object.freeze({ x: 1 }); try { a.x = 2; return \"no error\"; } catch (e) { return e.name; } })()", "\"no error\""],
    ["(() => { \"use strict\"; const a = Object.freeze({ x: 1 }); try { a.x = 2; return \"no error\"; } catch (e) { return e.name; } })()", "\"TypeError\""],
  ];

  /* The runnable deepClone exercise: the JSON trick first, then a recursive version that passes everything. */
  const CLONE_NAIVE = "function deepClone(value) {\n  return JSON.parse(JSON.stringify(value));\n}";
  const CLONE_SOLUTION = `function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value; // numbers, text, booleans...
  if (seen.has(value)) return seen.get(value);                   // an object we already copied (circular)
  if (value instanceof Date) return new Date(value.getTime());
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) copy[key] = deepClone(value[key], seen);
  return copy;
}`;
  const CLONE_TESTS = `const cases = [
  ["nested object", () => ({ a: { b: 1 } }), (c, o) => c.a !== o.a && c.a.b === 1],
  ["array inside array", () => ({ list: [1, [2]] }), (c, o) => c.list[1] !== o.list[1] && c.list[1][0] === 2],
  ["a Date stays a Date", () => ({ d: new Date(0) }), (c) => c.d instanceof Date && c.d.getTime() === 0],
  ["undefined stays", () => ({ u: undefined }), (c) => "u" in c],
  ["a circular object", () => { const o = { name: "x" }; o.self = o; return o; }, (c) => c.self === c],
];
const results = {};
for (const [name, make, isOk] of cases) {
  let pass = false;
  try { const original = make(); pass = isOk(deepClone(original), original); } catch (e) { pass = false; }
  results[name] = pass ? 1 : 0;
}
report("tests", results);`;
  const cloneCode = (fn) => `// Make deepClone copy everything. It starts with the JSON trick. Press Run, then fix it.\n${fn}\n\n// ---- the tests ----\n${CLONE_TESTS}\n`;

  /* ---------- 5. immutability in React terms: a toy of "same reference, nothing to do" ---------- */
  function makeStore(initial) {
    let value = initial;
    let shown = [...initial];
    let renders = 1;
    return {
      get value() { return value; },
      get shown() { return shown; },
      get renders() { return renders; },
      set(next) {
        if (Object.is(next, value)) return "skipped";
        value = next;
        shown = [...next];
        renders += 1;
        return "re-rendered";
      },
    };
  }
  const STORE_CODE = `// A tiny model of how React decides to update the screen (this is NOT real React).
function makeState(initial) {
  let value = initial;
  let onScreen = [...initial];
  return {
    get value() { return value; },
    get onScreen() { return onScreen; },
    set(next) {
      if (Object.is(next, value)) return "skipped";  // same reference: nothing to do
      value = next;
      onScreen = [...next];                         // draw the new list
      return "re-rendered";
    },
  };
}`;

  /* ---------- 6. modules: a tiny "bundler" that marks used exports, and demos run by real node ---------- */
  const FILES = {
    "app.js": "import { add } from \"./math.js\";\nimport { fmt } from \"./format.js\";\nconsole.log(fmt(add(2, 3)));",
    "math.js": "export const add = (a, b) => a + b;\nexport const sub = (a, b) => a - b;\nexport const mul = (a, b) => a * b;",
    "format.js": "export const fmt = (n) => \"Total: \" + n;\nexport const pad = (s) => String(s).padStart(8);",
  };
  function parseModule(text) {
    const imports = [];
    const exports = [];
    const body = [];
    for (const line of text.split("\n")) {
      let m;
      if ((m = line.match(/^import \{([^}]*)\} from "\.\/([^"]+)";?$/))) imports.push({ from: m[2], names: m[1].split(",").map((s) => s.trim()).filter(Boolean) });
      else if ((m = line.match(/^export (?:const|function|class) (\w+)/))) exports.push({ name: m[1], line: line.replace(/^export /, "") });
      else body.push(line);
    }
    return { imports, exports, body };
  }
  /* Read the imports (no code runs), mark the used exports, keep only those. */
  function shake(files, entry) {
    const mods = {};
    const order = [];
    const visit = (name) => {
      if (mods[name]) return;
      mods[name] = parseModule(files[name]);
      for (const i of mods[name].imports) visit(i.from);
      order.push(name);
    };
    visit(entry);
    const used = Object.fromEntries(order.map((n) => [n, new Set()]));
    for (const n of order) for (const i of mods[n].imports) i.names.forEach((x) => used[i.from].add(x));
    const out = {};
    const lines = [];
    for (const n of order) {
      const m = mods[n];
      out[n] = { used: m.exports.filter((e) => used[n].has(e.name)).map((e) => e.name), unused: m.exports.filter((e) => !used[n].has(e.name)).map((e) => e.name) };
      m.exports.filter((e) => used[n].has(e.name)).forEach((e) => lines.push(e.line));
      lines.push(...m.body.filter(Boolean));
    }
    const edges = order.flatMap((n) => mods[n].imports.map((i) => ({ from: n, to: i.from, names: i.names })));
    return { order, modules: out, edges, bundle: lines.join("\n"), exportsOf: Object.fromEntries(order.map((n) => [n, mods[n].exports.map((e) => e.name)])) };
  }
  const DYNAMIC = {
    files: {
      "pick.js": "// PICK is known only at run time\nconst f = \"./\" + process.env.PICK;\nconst { run } = require(f);\nconsole.log(run());",
      "a.js": "module.exports = { run: () => \"from a\" };",
      "b.js": "module.exports = { run: () => \"from b\" };",
    },
    runs: [["a", ["from a"]], ["b", ["from b"]]],
  };
  const e3 = "for (let i = 0; i < 3; i++) {\n  inc();\n  console.log(count);\n}";
  const MOD = {
    esm: { main: "main.mjs", expect: ["0", "1", "2", "3"], files: { "counter.mjs": "export let count = 0;\nexport function inc() {\n  count += 1;\n}", "main.mjs": `import { count, inc } from "./counter.mjs";\nconsole.log(count);\n${e3}` } },
    cjs: { main: "main.cjs", expect: ["0", "0", "0", "0"], files: { "counter.cjs": "let count = 0;\nfunction inc() {\n  count += 1;\n}\nmodule.exports = { count, inc };", "main.cjs": `const { count, inc } = require("./counter.cjs");\nconsole.log(count);\n${e3}` } },
    getter: {
      main: "main.cjs", expect: ["0", "1", "2", "3"],
      files: { "counter.cjs": "let count = 0;\nmodule.exports = {\n  get count() { return count; },\n  inc() { count += 1; },\n};", "main.cjs": "const counter = require(\"./counter.cjs\");\nconsole.log(counter.count);\nfor (let i = 0; i < 3; i++) {\n  counter.inc();\n  console.log(counter.count);\n}" },
    },
    assign: { main: "main.mjs", expect: ["TypeError: Assignment to constant variable."], files: { "counter.mjs": "export let count = 0;", "main.mjs": "import { count } from \"./counter.mjs\";\ntry {\n  count = 5;\n} catch (e) {\n  console.log(e.name + \": \" + e.message);\n}" } },
    orderEsm: { main: "main.mjs", expect: ["dep runs", "main starts"], files: { "dep.mjs": "console.log(\"dep runs\");", "main.mjs": "console.log(\"main starts\");\nimport \"./dep.mjs\";" } },
    orderCjs: { main: "main.cjs", expect: ["main starts", "dep runs"], files: { "dep.cjs": "console.log(\"dep runs\");", "main.cjs": "console.log(\"main starts\");\nrequire(\"./dep.cjs\");" } },
  };

  /* ---------- 7. the work ticket, and "From your work" ---------- */
  const TICKET_CODE = `function setStatus(rows, id, status) {
  const next = [...rows];                       // a new array
  const row = next.find((r) => r.id === id);
  row.status = status;                           // but this row is the SAME object
  return next;
}`;
  const REPRO_CODE = `// The page keeps the old list so "Undo" can go back to it.
const rows = [{ id: 1, status: "new" }, { id: 2, status: "new" }];

function setStatus(rows, id, status) {          // the broken version from the ticket
  const next = [...rows];
  const row = next.find((r) => r.id === id);
  row.status = status;
  return next;
}
function setStatusFixed(rows, id, status) {     // your fix: copy only the row that changes
  return rows.map((r) => (r.id === id ? { ...r, status } : r));
}

const broken = setStatus(rows, 2, "done");
report("Broken version", { newArray: broken !== rows, oldRowChanged: rows[1].status === "done" });
rows[1].status = "new"; // put the old list back

const fixed = setStatusFixed(rows, 2, "done");
report("Fixed version", { newArray: fixed !== rows, oldRowChanged: rows[1].status === "done", otherRowShared: fixed[0] === rows[0] });
`;
  const WORK_CODE = `// The idea of Speako's SET_PRIMARY_LANGUAGE case, with the other fields removed.
const before = {
  primaryLanguage: "en",
  languagePresets: { fr: { enabled: true }, de: { enabled: true } },
};

function setPrimaryLanguage(state, code) {
  const presets = { ...state.languagePresets };            // copy the middle object
  if (presets[code]) presets[code] = { ...presets[code], enabled: false }; // copy only the one preset that changes
  return { ...state, primaryLanguage: code, languagePresets: presets };
}

const after = setPrimaryLanguage(before, "fr");
report("What changed", {
  oldStateUntouched: before.languagePresets.fr.enabled === true,
  newStateChanged: after.languagePresets.fr.enabled === false,
  presetsIsNew: after.languagePresets !== before.languagePresets,
  untouchedPresetShared: after.languagePresets.de === before.languagePresets.de,
});
`;

  /* ---------- 8. other claims that the text makes ---------- */
  const D_PASS = "function change(obj, n) { n = 5; obj.x = 1; obj = { x: 99 }; }\nconst a = { x: 0 };\nlet n = 1;\nchange(a, n);";
  const PASS_CODE = D_PASS + "\nconsole.log(a.x, n); // 1 1";
  /* What the JSON round trip does to five kinds of value (really run). */
  function jsonFacts() {
    const a = { d: new Date(0), u: undefined, f() {}, n: NaN, m: new Map([[1, 2]]) };
    const b = JSON.parse(JSON.stringify(a));
    return [["Date", typeof b.d === "string" ? "text" : "kept"], ["undefined", "u" in b ? "kept" : "gone"], ["function", "f" in b ? "kept" : "gone"], ["NaN", String(b.n)], ["Map", JSON.stringify(b.m)]];
  }
  /* Rows for the shared === / Object.is mini table (really run). */
  function eqTable() {
    return [["NaN", "NaN"], ["0", "-0"], ["[1]", "[1]"]].map(([a, b]) => ({ a, b, strict: evalExpr(`${a} === ${b}`), same: evalExpr(`Object.is(${a}, ${b})`) }));
  }
  /* Named claims used in answers and notes. The test runs each one. */
  const CLAIMS = {
    emptyNotEmpty: ["[] == ![]", "true"],
    typeofNull: ["typeof null", "\"object\""],
    constObject: ["(() => { const o = {}; o.x = 1; return o.x; })()", "1"],
    constReassign: ["(() => { try { eval(\"const c = 1; c = 2;\"); } catch (e) { return e.name + \": \" + e.message; } })()", "\"TypeError: Assignment to constant variable.\""],
    sameList: ["(() => { const a = [1]; const b = a; b.push(2); return a.length; })()", "2"],
    isNaNPair: ["Object.is(NaN, NaN) && !Object.is(0, -0)", "true"],
    twoArrays: ["Object.is([], [])", "false"],
    plusText: ["\"5\" + 1", "\"51\""],
    minusText: ["\"5\" - 1", "4"],
    setNaN: ["new Set([NaN, NaN]).size", "1"],
    setObjects: ["new Set([{}, {}]).size", "2"],
    mapKey: ["new Map([[{}, 1]]).get({})", "undefined"],
    jsonCircular: ["(() => { const o = {}; o.self = o; try { JSON.stringify(o); } catch (e) { return e.name; } })()", "\"TypeError\""],
    assignCopy: ["Object.assign({}, { tags: [] }).tags.length", "0"],
    nullish: ["null == undefined && undefined == null && null != 0", "true"],
    nullEmpty: ["null == \"\"", "false"],
    arrayTruthy: ["Boolean([])", "true"],
    sliceShallow: ["(() => { const a = [{ x: 1 }]; return a.slice()[0] === a[0]; })()", "true"],
    spreadNested: ["a.tags.n", "5", "const a = { name: \"Mina\", tags: { n: 1 } };\nconst b = { ...a };\nb.tags.n = 5;"],
    truthyRule: ["[\"\", 0, null, undefined, NaN, false].every((v) => !v) && [\"0\", [], {}, \"false\"].every((v) => Boolean(v))", "true"],
    passValue: ["a.x + \" \" + n", "\"1 1\"", D_PASS],
    cloneGetter: ["(() => { const c = structuredClone({ get g() { return 1; } }); const d = Object.getOwnPropertyDescriptor(c, \"g\"); return d.value === 1 && d.get === undefined; })()", "true"],
    clonePrivate: ["(() => { class P { #s = 1; v = 2; } const c = structuredClone(new P()); return Object.keys(c).join() + \",\" + (c instanceof P); })()", "\"v,false\""],
    cloneSymbolKey: ["Object.getOwnPropertySymbols(structuredClone({ [Symbol(\"k\")]: 1, a: 2 })).length", "0"],
    jsonMapSet: ["JSON.stringify({ m: new Map([[1, 2]]), s: new Set([1]) })", "\"{\\\"m\\\":{},\\\"s\\\":{}}\""],
    jsonArrayUndefined: ["JSON.stringify([undefined])", "\"[null]\""],
    freezeArrayPushSloppy: ["(() => { const a = Object.freeze([1]); try { a.push(2); } catch (e) { return e.name; } })()", "\"TypeError\""],
    freezeArrayPushStrict: ["(() => { \"use strict\"; const a = Object.freeze([1]); try { a.push(2); } catch (e) { return e.name; } })()", "\"TypeError\""],
    spreadOwnOnly: ["Object.keys({ ...Object.create({ inherited: 1 }, { own: { value: 2, enumerable: true } }) }).join()", "\"own\""],
    spreadGetter: ["(() => { const b = { ...{ get g() { return 1; } } }; const d = Object.getOwnPropertyDescriptor(b, \"g\"); return d.value === 1 && d.get === undefined; })()", "true"],
    ticketShared: ["setStatus(rows, 2, \"x\")[1] === rows[1]", "true", "const rows = [{ id: 1 }, { id: 2 }];\nfunction setStatus(rows, id, status) { const next = [...rows]; next.find((r) => r.id === id).status = status; return next; }"],
  };

  return {
    show, evalExpr, evalClaim, trace, PROGRAMS, runProgram, explainFrame, pathsTo,
    VALUES, compare, matrix, SURPRISES, EXTRA,
    cloneProbe, HUB_SNIPS, snipText, FREEZE_MODES, JSON_SETUP,
    CLONE_NAIVE, CLONE_SOLUTION, CLONE_TESTS, cloneCode,
    makeStore, STORE_CODE,
    FILES, parseModule, shake, DYNAMIC, MOD,
    TICKET_CODE, REPRO_CODE, WORK_CODE, CLAIMS, PASS_CODE, jsonFacts, eqTable,
  };
});
