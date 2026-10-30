/* this, prototypes and classes: the single source of truth.
   Every snippet the lesson shows is a string here. The page runs it live, and dev/js-this-prototypes.test.js
   runs the same strings in Node and checks what the page says about them. Nothing here is typed as "an output".
   Works in the browser (Book.parts["js-this-prototypes"].data) and in Node (module.exports).
   Mode matters: classes and "use strict" code give an undefined `this` for a plain call, sloppy code gives globalThis.
   Every case says which mode it runs in, and runs in exactly that mode (new Function bodies are sloppy unless they start with "use strict"). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["js-this-prototypes"] = root.Book.parts["js-this-prototypes"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  /* ---------- running a snippet: setup lines + one expression, in a chosen mode ---------- */
  const err = (e) => `${e && e.name ? e.name : "Error"}: ${e && e.message}`;
  /* Shows a value the way a console would, in a few characters. */
  const show = (v) => {
    if (v === undefined) return "undefined";
    if (v === globalThis) return "globalThis";
    if (typeof v === "function") return "[function]";
    if (typeof v === "string") return JSON.stringify(v);
    try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
  };
  /* Runs `setup` then returns the value of `expr`. strict: true adds "use strict" to the snippet itself. */
  function run(setup, expr, strict) {
    const src = (strict ? '"use strict";\n' : "") + setup + "\nreturn " + expr + ";";
    try { return { ok: true, value: new Function(src)() }; } catch (e) { return { ok: false, error: err(e) }; }
  }
  const shown = (r) => (r.ok ? show(r.value) : r.error);

  /* ---------- A. the seven "who is this?" cases (one HubSpot-style set plus `new`) ---------- */
  const SPEAK = 'const rex = {\n  name: "Rex",\n  speak() { return this; },\n};';
  /* What `this` was, as one word. */
  const labelOf = (v) =>
    v === undefined ? "undefined"
      : v === globalThis ? "globalThis"
        : v && typeof v === "object" && typeof v.name === "string" ? v.name : String(v);

  /* rule: arrow | new | explicit | method | plain.  yes: why that rule fires, in simple English. */
  const cases = [
    { id: "new", title: "Called with new", mode: "sloppy", setup: ["function Dog(name) { this.name = name; }"], call: 'new Dog("Milo")', rule: "new", expect: "Milo",
      yes: "new makes a fresh empty object and runs Dog with this set to that object." },
    { id: "method", title: "A method call", mode: "sloppy", setup: [SPEAK], call: "rex.speak()", rule: "method", expect: "Rex",
      yes: "There is a dot: rex.speak(). this is the object left of the dot." },
    { id: "detached", title: "A detached method", mode: "sloppy", setup: [SPEAK, "const f = rex.speak;"], call: "f()", rule: "plain", expect: "globalThis",
      yes: "f() has no dot. This is a plain call. In sloppy mode, this becomes globalThis." },
    { id: "bind", title: "A bound function", mode: "sloppy", setup: [SPEAK, "const f = rex.speak.bind(rex);"], call: "f()", rule: "explicit", expect: "Rex",
      yes: "bind made a new function with this locked to rex. No dot is needed." },
    { id: "bound-call", title: "call on a bound function", mode: "sloppy", setup: [SPEAK, 'const cat = { name: "Tom" };', "const f = rex.speak.bind(rex);"], call: "f.call(cat)", rule: "explicit", expect: "Rex",
      yes: "call asks for cat, but bind locked this to rex first. A bound function cannot be changed." },
    { id: "arrow", title: "An arrow returned from a method", mode: "sloppy", setup: ['const rex = {\n  name: "Rex",\n  speaker() { return () => this; },\n};', "const arrow = rex.speaker();"], call: "arrow()", rule: "arrow", expect: "Rex",
      yes: "An arrow has no this of its own. It uses the this of speaker(), where it was written. That call was rex.speaker()." },
    { id: "strict", title: "A plain call in strict mode", mode: "strict", setup: [SPEAK, "const f = rex.speak;"], call: "f()", rule: "plain", expect: "undefined",
      yes: "Same plain call, but strict mode does not replace this. It stays undefined." },
  ];
  const caseCode = (c) => (c.mode === "strict" ? '"use strict";\n' : "") + c.setup.join("\n") + "\n" + c.call;
  const runCase = (c) => {
    const r = run(c.setup.join("\n"), c.call, c.mode === "strict");
    return r.ok ? labelOf(r.value) : r.error;
  };

  /* The ladder, top to bottom. The film checks the rows in this order. */
  const ladder = [
    { id: "arrow", name: "Arrow function?", sub: "this = where it was written", no: "No, a normal function." },
    { id: "new", name: "1. Called with new?", sub: "this = the new object", no: "No new." },
    { id: "explicit", name: "2. call, apply or bind?", sub: "this = what you gave", no: "No call, apply or bind." },
    { id: "method", name: "3. Called as obj.method()?", sub: "this = obj (left of the dot)", no: "No dot before the call." },
    { id: "plain", name: "4. A plain call f()?", sub: "strict: undefined · sloppy: globalThis", no: "" },
  ];

  /* ---------- B. "Same function, a different this" and the lost receiver ---------- */
  const DOG_SRC = `class Dog {
  constructor(name) { this.name = name; }
  speak() { return this.name + " says woof"; }
}
const rex = new Dog("Rex");
const tom = new Dog("Tom");
function runLater(fn) { return fn(); }`;
  /* Classes always run in strict mode, so these snippets need no "use strict". */
  const lose = {
    src: DOG_SRC,
    tries: {
      rex: { label: "rex.speak()", expr: "rex.speak()" },
      tom: { label: "tom.speak()", expr: "tom.speak()" },
      lost: { label: "runLater(rex.speak)", expr: "runLater(rex.speak)" },
      arrow: { label: "runLater(() => rex.speak())", expr: "runLater(() => rex.speak())" },
      bind: { label: "runLater(rex.speak.bind(rex))", expr: "runLater(rex.speak.bind(rex))" },
      wrong: { label: "runLater(rex.speak.bind(tom))", expr: "runLater(rex.speak.bind(tom))" },
    },
  };
  const runTry = (key) => shown(run(lose.src, lose.tries[key].expr, false));

  /* Practice: five more `this` puzzles (not the film's cases). */
  const SPEAK2 = SPEAK + '\nconst tom = { name: "Tom" };';
  const puzzles = [
    { id: "destructure", mode: "sloppy", setup: [SPEAK2, "const { speak } = rex;"], call: "speak()", expect: "globalThis", options: ["Rex", "globalThis", "undefined"],
      why: "Taking speak out of rex gives you only the function. The call speak() has no dot, so it is a plain call." },
    { id: "call", mode: "sloppy", setup: [SPEAK2], call: "rex.speak.call(tom)", expect: "Tom", options: ["Rex", "Tom", "undefined"],
      why: "call is an explicit rule. It beats the dot rule: this is the first argument, tom." },
    { id: "paren", mode: "sloppy", setup: [SPEAK2], call: "(rex.speak)()", expect: "Rex", options: ["Rex", "globalThis", "undefined"],
      why: "Brackets around rex.speak change nothing. It is still a method call, so this is rex." },
    { id: "comma", mode: "sloppy", setup: [SPEAK2], call: "(0, rex.speak)()", expect: "globalThis", options: ["Rex", "globalThis", "undefined"],
      why: "The comma gives you the plain function value, and the link to rex is lost. Now it is a plain call." },
    { id: "nested", mode: "sloppy", setup: [SPEAK2, 'const team = { name: "Team", rex };'], call: "team.rex.speak()", expect: "Rex", options: ["Rex", "Team", "undefined"],
      why: "this is the object directly left of the last dot: rex. Not team." },
  ];
  const runPuzzle = (p) => { const r = run(p.setup.join("\n"), p.call, p.mode === "strict"); return r.ok ? labelOf(r.value) : r.error; };
  const puzzleCode = (p) => p.setup.join("\n") + "\n" + p.call;

  /* ---------- C. arrows and class fields ---------- */
  const FIELD_SRC = `class Button {
  label = "Save";
  onClick = () => this.label;
  show() { return this.label; }
}
const a = new Button();
const b = new Button();`;
  const ARROW_SRC = `"use strict";
const rex = {
  name: "Rex",
  plainFn() { return function () { return this; }; },
  arrowFn() { return () => this; },
};
const tom = { name: "Tom" };`;
  const arrowTries = {
    plain: "rex.plainFn()()",
    arrow: "rex.arrowFn()()",
    arrowCall: "rex.arrowFn().call(tom)",
    plainCall: "rex.plainFn().call(tom)",
  };
  const arrowTry = (k) => { const r = run(ARROW_SRC, arrowTries[k], false); return r.ok ? labelOf(r.value) : r.error; };
  const fieldTry = (expr, extra) => shown(run(FIELD_SRC + (extra ? "\n" + extra : ""), expr, false));
  const fieldFacts = () => {
    const a = new Function(FIELD_SRC + "\nreturn { a, b, Button };")();
    return {
      ownA: Object.getOwnPropertyNames(a.a),
      protoKeys: Object.getOwnPropertyNames(a.Button.prototype),
      sharedMethod: a.a.show === a.b.show,
      sharedField: a.a.onClick === a.b.onClick,
      methodOwn: hasOwn(a.a, "show"),
      fieldOwn: hasOwn(a.a, "onClick"),
      beforeCtor: new Function("class A { x = 1; constructor() { this.seen = this.x; } }\nreturn new A().seen;")(),
      subOverride: new Function(FIELD_SRC + "\nclass Sub extends Button { onClick() { return 'sub'; } }\nreturn new Sub().onClick();")(),
    };
  };

  /* ---------- D. prototypes: the same Dog two ways, and a chain walker ---------- */
  const FUNC_SRC = `function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return this.name + " makes a sound"; };

function Dog(name) { Animal.call(this, name); }
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
Dog.prototype.speak = function () { return Animal.prototype.speak.call(this) + " and barks"; };
Dog.prototype.fetch = function () { return this.name + " fetches"; };

const rex = new Dog("Rex");`;
  const CLASS_SRC = `class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name + " makes a sound"; }
}
class Dog extends Animal {
  speak() { return super.speak() + " and barks"; }
  fetch() { return this.name + " fetches"; }
}

const rex = new Dog("Rex");`;
  const makeZoo = (src) => new Function(src + "\nreturn { Animal, Dog, rex };")();

  const PREFER = ["constructor", "speak", "fetch", "name", "hasOwnProperty", "toString"];
  const rank = (k) => { const i = PREFER.indexOf(k); return i === -1 ? 99 : i; };
  /* Walk the REAL chain with Object.getPrototypeOf. Each node: { label, keys (a few own names), more, obj }. */
  function walkChain(obj, name, max = 4) {
    const nodes = [];
    let cur = obj;
    let label = name;
    while (cur !== null) {
      const names = Object.getOwnPropertyNames(cur);
      const pool = names.filter((k) => !k.startsWith("__")).sort((x, y) => rank(x) - rank(y));
      const shown = pool.slice(0, names.length > max ? max - 1 : max);
      nodes.push({ label, keys: shown, more: names.length - shown.length, total: names.length, obj: cur });
      cur = Object.getPrototypeOf(cur);
      if (cur !== null) label = hasOwn(cur, "constructor") && typeof cur.constructor === "function" ? cur.constructor.name + ".prototype" : "(an object)";
    }
    nodes.push({ label: "null", keys: [], more: 0, total: 0, obj: null, end: true });
    return nodes;
  }
  /* A property lookup, done by hand with hasOwnProperty at each step. */
  function lookup(chain, key) {
    const real = chain.filter((n) => !n.end);
    const steps = real.map((n) => hasOwn(n.obj, key));
    const foundAt = steps.indexOf(true);
    return { key, steps, foundAt, shadowed: steps.map((s, i) => s && i > foundAt && foundAt !== -1) };
  }
  const myInstanceOf = (obj, C) => {
    for (let p = Object.getPrototypeOf(obj); p !== null; p = Object.getPrototypeOf(p)) if (p === C.prototype) return true;
    return false;
  };
  const lookups = [
    { key: "name", expr: "rex.name" },
    { key: "speak", expr: "rex.speak()" },
    { key: "toString", expr: "rex.toString()" },
    { key: "fly", expr: "rex.fly" },
  ];
  const lookupValue = (zoo, l) => show(new Function("rex", "return " + l.expr + ";")(zoo.rex));
  /* The checks the film shows at the end: instanceof and hasOwnProperty, all real. */
  const checks = (zoo) => ({
    instDog: zoo.rex instanceof zoo.Dog,
    instAnimal: zoo.rex instanceof zoo.Animal,
    instArray: zoo.rex instanceof Array,
    ownName: zoo.rex.hasOwnProperty("name"),
    ownSpeak: zoo.rex.hasOwnProperty("speak"),
    staticLink: Object.getPrototypeOf(zoo.Dog) === zoo.Animal,
    sameProto: Object.getPrototypeOf(zoo.rex) === zoo.Dog.prototype,
    ctorOk: zoo.Dog.prototype.constructor === zoo.Dog,
    speak: zoo.rex.speak(),
  });
  /* Delete the shadowing method, and the lookup falls through to Animal. */
  const shadowDelete = () => {
    const z = makeZoo(CLASS_SRC);
    const before = z.rex.speak();
    delete z.Dog.prototype.speak;
    return { before, after: z.rex.speak() };
  };

  /* ---------- E. runnables: bind, map, filter and reduce ---------- */
  const BIND_HEAD = '"use strict";\n// Make every case pass. The last one is advanced and optional.\n';
  const bindImpl = {
    starter: `Function.prototype.myBind = function (thisArg) {
  const fn = this;
  return function (...args) {
    return fn.apply(thisArg, args);
  };
};
`,
    solution: `Function.prototype.myBind = function (thisArg, ...preset) {
  const fn = this;
  return function (...later) {
    return fn.apply(thisArg, [...preset, ...later]);
  };
};
`,
    advanced: `Function.prototype.myBind = function (thisArg, ...preset) {
  const fn = this;
  return function bound(...later) {
    const args = [...preset, ...later];
    // called with new: ignore thisArg, build a real instance
    return new.target ? new fn(...args) : fn.apply(thisArg, args);
  };
};
`,
  };
  const BIND_TESTS = `
// ---- the tests: leave these ----
const rex = { name: "Rex" };
const cat = { name: "Tom" };
function greet(hello, mark) { return hello + ", " + this.name + mark; }
function add(a, b) { return a + b; }
function Point(x, y) { this.x = x; this.y = y; }

const cases = [
  ["this is fixed", () => greet.myBind(rex)("Hi", "!") === "Hi, Rex!"],
  ["call cannot change it", () => greet.myBind(rex).call(cat, "Hi", "!") === "Hi, Rex!"],
  ["preset arguments", () => add.myBind(null, 1)(2) === 3],
  ["preset and later arguments, in order", () => greet.myBind(rex, "Yo")("?") === "Yo, Rex?"],
  ["returns a new function each time", () => greet.myBind(rex) !== greet.myBind(rex)],
  ["advanced: works with new", () => { const p = new (Point.myBind(null, 1))(2); return p.x === 1 && p.y === 2 && p instanceof Point; }],
];
const results = cases.map(([name, test]) => {
  try { return { name, pass: test() === true }; } catch (e) { return { name, pass: false, error: e.name }; }
});
delete Function.prototype.myBind;
report("bind", results);
`;

  const SAME = `// same(a, b): equal values, and the same holes
const same = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a.keys()].every((i) => (i in a) === (i in b) && same(a[i], b[i]));
  }
  return Object.is(a, b);
};
// attempt(f): the result, or the name of the error it threw
const attempt = (f) => { try { return f(); } catch (e) { return e.name; } };
`;
  const mapImpl = {
    starter: `Array.prototype.myMap = function (callback) {
  const result = [];
  for (const item of this) {
    result.push(callback(item));
  }
  return result;
};
`,
    solution: `Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== "function") throw new TypeError(callback + " is not a function");
  const arr = Object(this);
  const result = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    if (i in arr) result[i] = callback.call(thisArg, arr[i], i, arr);
  }
  return result;
};
`,
  };
  const MAP_TESTS = `
// ---- the tests: the real map is the judge ----
${SAME}const spy = (map, list) => { const seen = []; map.call(list, function (...args) { seen.push([args[0], args[1], args[2] === list]); }); return seen; };
const cases = [
  ["doubles numbers", (map) => map.call([1, 2, 3], (x) => x * 2)],
  ["passes value, index and array", (map) => spy(map, ["a", "b"])],
  ["uses thisArg", (map) => map.call([1, 2], function (x) { return x + this.add; }, { add: 10 })],
  ["does not change the original", (map) => { const a = [1, 2]; map.call(a, (x) => x * 9); return a; }],
  ["keeps holes, and skips them", (map) => map.call([1, , 3], (x) => x * 2)],
  ["visits undefined values", (map) => map.call([undefined, 1], (x) => String(x))],
  ["empty array", (map) => map.call([], (x) => x)],
  ["TypeError if callback is not a function", (map) => attempt(() => map.call([], undefined))],
  ["works on array-like objects", (map) => map.call({ length: 2, 0: "a", 1: "b" }, (s) => s.toUpperCase())],
];
const results = cases.map(([name, test]) => ({
  name,
  pass: same(attempt(() => test(Array.prototype.map)), attempt(() => test(Array.prototype.myMap))),
}));
delete Array.prototype.myMap;
report("map", results);
`;
  const frImpl = {
    starter: `Array.prototype.myFilter = function (callback, thisArg) {
  const result = [];
  for (let i = 0; i < this.length; i++) {
    if (callback.call(thisArg, this[i], i, this)) result.push(this[i]);
  }
  return result;
};

Array.prototype.myReduce = function (callback, initial) {
  let acc = initial;
  for (let i = 0; i < this.length; i++) {
    acc = callback(acc, this[i]);
  }
  return acc;
};
`,
    solution: `Array.prototype.myFilter = function (callback, thisArg) {
  if (typeof callback !== "function") throw new TypeError(callback + " is not a function");
  const arr = Object(this);
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i in arr && callback.call(thisArg, arr[i], i, arr)) result.push(arr[i]);
  }
  return result;
};

Array.prototype.myReduce = function (callback, ...rest) {
  if (typeof callback !== "function") throw new TypeError(callback + " is not a function");
  const arr = Object(this);
  let i = 0;
  let acc;
  if (rest.length) {
    acc = rest[0];                       // an initial value was given, even if it is undefined
  } else {
    while (i < arr.length && !(i in arr)) i++;   // no initial value: start from the first real item
    if (i >= arr.length) throw new TypeError("Reduce of empty array with no initial value");
    acc = arr[i++];
  }
  for (; i < arr.length; i++) {
    if (i in arr) acc = callback(acc, arr[i], i, arr);
  }
  return acc;
};
`,
  };
  const FR_TESTS = `
// ---- the tests: the real filter and reduce are the judges ----
${SAME}const pairs = [
  ["filter: keeps matching items", "filter", (f) => f.call([1, 2, 3, 4], (x) => x % 2 === 0)],
  ["filter: passes value, index, array", "filter", (f) => { const seen = []; f.call(["a", "b"], (v, i, arr) => { seen.push([v, i, Array.isArray(arr)]); }); return seen; }],
  ["filter: skips holes", "filter", (f) => f.call([1, , 3], () => true)],
  ["reduce: sums with a start value", "reduce", (r) => r.call([1, 2, 3], (a, x) => a + x, 10)],
  ["reduce: no start value uses item 0", "reduce", (r) => r.call([1, 2, 3], (a, x) => a + x)],
  ["reduce: passes index and array", "reduce", (r) => { const seen = []; r.call([5, 6], (a, x, i, arr) => { seen.push([i, Array.isArray(arr)]); return a; }, 0); return seen; }],
  ["reduce: empty array, no start value", "reduce", (r) => attempt(() => r.call([], (a, x) => a + x))],
  ["reduce: start value undefined still counts", "reduce", (r) => r.call([1, 2], (a, x) => String(a) + x, undefined)],
];
const results = pairs.map(([name, kind, test]) => {
  const real = kind === "filter" ? Array.prototype.filter : Array.prototype.reduce;
  const mine = kind === "filter" ? Array.prototype.myFilter : Array.prototype.myReduce;
  return { name, pass: same(attempt(() => test(real)), attempt(() => test(mine))) };
});
delete Array.prototype.myFilter;
delete Array.prototype.myReduce;
report("fr", results);
`;
  const runnableCode = {
    bind: (kind) => BIND_HEAD + bindImpl[kind] + BIND_TESTS,
    map: (kind) => '"use strict";\n// Make every case pass. The real map is the judge.\n' + mapImpl[kind] + MAP_TESTS,
    fr: (kind) => '"use strict";\n// Make every case pass. The real filter and reduce are the judges.\n' + frImpl[kind] + FR_TESTS,
  };
  /* A hint for each case, shown when it fails. */
  const hints = {
    "this is fixed": "Use fn.apply(thisArg, args) so the function runs with the this you chose.",
    "call cannot change it": "Return a new function that always uses thisArg, whatever call gets.",
    "preset arguments": "Collect extra arguments with ...preset, and put them before the later ones.",
    "preset and later arguments, in order": "Call fn with [...preset, ...later].",
    "returns a new function each time": "bind returns a new function. Do not return fn itself.",
    "advanced: works with new": "Inside the returned function, new.target is set when it was called with new. Then build with new fn(...args).",
    "passes value, index and array": "Call callback with three arguments: arr[i], i, arr.",
    "uses thisArg": "Use callback.call(thisArg, value, index, array).",
    "keeps holes, and skips them": "Check i in arr. Do not call the callback for a hole, and leave the hole in the result.",
    "TypeError if callback is not a function": "Check typeof callback first, even when the array is empty.",
    "works on array-like objects": "Do not use for...of. Use arr.length and arr[i].",
    "filter: passes value, index, array": "Pass this[i], i and the array.",
    "filter: skips holes": "Check i in arr before calling the callback.",
    "reduce: no start value uses item 0": "With no start value, the first real item becomes the first running total.",
    "reduce: passes index and array": "The callback gets four arguments: acc, item, index, array.",
    "reduce: empty array, no start value": "The real reduce throws a TypeError here.",
    "reduce: start value undefined still counts": "Count the arguments (...rest). Do not test initial === undefined.",
  };

  /* ---------- F. ways to make objects (the hub) ---------- */
  const MAKER_SRC = {
    literal: 'const a = { name: "Rex", speak() { return this.name; } };\nconst b = { name: "Tom", speak() { return this.name; } };',
    factory: "function makeCounter() {\n  let count = 0;\n  return { inc() { return ++count; }, get() { return count; } };\n}\nconst c = makeCounter();\nc.inc(); c.inc();",
    ctor: 'function Dog(name) { this.name = name; }\nDog.prototype.speak = function () { return this.name; };\nconst a = new Dog("Rex");\nconst b = new Dog("Tom");',
    klass: 'class Dog {\n  constructor(name) { this.name = name; }\n  speak() { return this.name; }\n}\nconst a = new Dog("Rex");\nconst b = new Dog("Tom");',
    create: 'const animal = { speak() { return this.name + " speaks"; } };\nconst rex = Object.create(animal);\nrex.name = "Rex";',
    mixin: 'const Swims = { swim() { return this.name + " swims"; } };\nclass Dog { constructor(name) { this.name = name; } }\nObject.assign(Dog.prototype, Swims);\nconst rex = new Dog("Rex");',
  };
  const ev = (key, expr, strict) => run(MAKER_SRC[key], expr, strict);
  const makerFacts = () => ({
    literalShare: ev("literal", "a.speak === b.speak").value,
    factoryPrivate: ev("factory", "c.count").value,
    factoryGet: ev("factory", "c.get()").value,
    factoryShare: new Function(MAKER_SRC.factory + "\nreturn makeCounter().inc === makeCounter().inc;")(),
    ctorShare: ev("ctor", "a.speak === b.speak").value,
    ctorProto: ev("ctor", "Object.getPrototypeOf(a) === Dog.prototype").value,
    ctorNoNew: shown(ev("ctor", 'Dog("x")', true)),
    classShare: ev("klass", "a.speak === b.speak").value,
    classNoNew: shown(ev("klass", 'Dog("x")', false)),
    createProto: ev("create", "Object.getPrototypeOf(rex) === animal").value,
    createSpeak: ev("create", "rex.speak()").value,
    nullProto: ev("create", '"toString" in Object.create(null)').value,
    mixinSwim: ev("mixin", "rex.swim()").value,
    mixinInstance: shown(ev("mixin", "rex instanceof Swims")),
    mixinOnProto: ev("mixin", 'Object.getPrototypeOf(rex).hasOwnProperty("swim")').value,
    mixinClash: new Function('return Object.assign({}, { hi() { return "A"; } }, { hi() { return "B"; } }).hi();')(),
    mixinCopy: ev("mixin", 'Swims.swim = function () { return "changed"; }, rex.swim()').value,
  });
  /* Sloppy mode, no new: the constructor writes onto globalThis. Used by the test only (it would change window.name in a browser). */
  const sloppyLeak = () => new Function(["function Dog(name) { this.name = name; }", 'Dog("leaked");', "const seen = globalThis.name;", "delete globalThis.name;", "return seen;"].join("\n"))();

  /* ---------- G. From your work: Anemone ---------- */
  const WRAP_SRC = {
    closure: "function makeRec() { let n = 0; return { tick() { return ++n; } }; }",
    thisStyle: "function makeRec() { return { n: 0, tick() { return ++this.n; } }; }",
  };
  /* The pattern at perf.js:358: keep the old tick, replace it with a measuring wrapper, call the old one. strict = ES module. */
  const wrapRun = (style, bound) => {
    const code = `${WRAP_SRC[style]}
const rec = makeRec();
const tick = ${bound ? "rec.tick.bind(rec)" : "rec.tick"};
rec.tick = () => tick();
return rec.tick();`;
    const r = run("", "(function () {\n" + code + "\n})()", true);
    return r.ok ? "ok: " + show(r.value) : r.error;
  };
  const wrapTable = () => [
    { style: "closure", bound: false, label: "Closure style (like createRecorder), no bind", result: wrapRun("closure", false) },
    { style: "this", bound: false, label: "Same idea written with this, no bind", result: wrapRun("thisStyle", false) },
    { style: "this", bound: true, label: "Written with this, and bind(rec)", result: wrapRun("thisStyle", true) },
    { style: "closure", bound: true, label: "Closure style, with bind(rec) (as in Anemone)", result: wrapRun("closure", true) },
  ];
  /* Smoothed, copied from audio/util.js:35-58 (without the JSDoc), so a reader can detach a method and see it break. */
  const SMOOTHED_SRC = `class Smoothed {
  constructor(value, tau) { this.from = value; this.to = value; this.t0 = 0; this.tau = tau; }
  set(value, time) { this.from = this.at(time); this.to = value; this.t0 = time; }
  at(time) {
    const dt = Math.max(0, time - this.t0);
    return this.to + (this.from - this.to) * Math.exp(-dt / this.tau);
  }
}
const level = new Smoothed(0, 2);
level.set(1, 0);`;
  const smoothedTry = (expr) => shown(run(SMOOTHED_SRC, expr, false));

  /* ---------- H. On the job: the Save button ---------- */
  const TICKET_BUG = `class DraftEditor {
  items = ["Intro", "Pricing"];

  constructor(ui) {
    ui.onSave(this.save);
  }

  save() {
    return "saved " + this.items.length + " items";
  }
}`;
  const ticketVariants = {
    bug: TICKET_BUG,
    arrow: TICKET_BUG.replace("save() {", "save = () => {"),
    bind: TICKET_BUG.replace("ui.onSave(this.save);", "this.save = this.save.bind(this);\n    ui.onSave(this.save);"),
    wrapper: TICKET_BUG.replace("ui.onSave(this.save);", "ui.onSave(() => this.save());"),
  };
  const FAKE_UI = "const ui = { handlers: [], onSave(fn) { this.handlers.push(fn); }, clickSave() { return this.handlers.map((fn) => fn()); } };";
  const ticketRun = (variant) => {
    const r = run(ticketVariants[variant] + "\n" + FAKE_UI + "\nnew DraftEditor(ui);", "ui.clickSave()", false);
    return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
  };
  /* What the same bug looks like when a DOM event sets this to the element (modelled with a plain object). */
  const ticketDom = () => shown(run(TICKET_BUG, "DraftEditor.prototype.save.call({})", false));
  const GREP = String.raw`grep -rnE '(\(|,|=\{)[[:space:]]*this\.[A-Za-z_]+[[:space:]]*(,|\)|\})' src`;
  const GREP_JS = /(\(|,|=\{)\s*this\.[A-Za-z_]+\s*(,|\)|\})/;

  /* ---------- I. Interview extras ---------- */
  const ctorReturn = () => ({
    obj: show(new Function('function A() { this.a = 1; return { b: 2 }; }\nreturn new A();')()),
    prim: show(new Function("function B() { this.a = 1; return 5; }\nreturn new B();")()),
  });
  const boundNew = () => new Function(["function P() { this.k = 1; }", "const B = P.bind({ z: 1 });", "const o = new B();", "return { inst: o instanceof P, lockedIgnored: o.z === undefined };"].join("\n"))();
  const arrowCtor = () => shown(run("const Arrow = () => {};", "new Arrow()", false));
  const eventTarget = () => {
    const et = new EventTarget();
    let same = null;
    et.addEventListener("x", function () { same = this === et; });
    et.dispatchEvent(new Event("x"));
    return same;
  };
  const MY_NEW = `function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype);   // 1. a new object that links to Ctor.prototype
  const result = Ctor.apply(obj, args);        // 2. run the constructor with this = obj
  return result !== null && (typeof result === "object" || typeof result === "function") ? result : obj; // 3.
}`;
  const myNewCheck = () => {
    const fns = new Function(MY_NEW + `
function Dog(name) { this.name = name; }
Dog.prototype.speak = function () { return this.name; };
function Odd() { this.a = 1; return { b: 2 }; }
function Prim() { this.a = 1; return 5; }
return { Dog, Odd, Prim, myNew };`)();
    const d = fns.myNew(fns.Dog, "Rex");
    return {
      speak: d.speak(), proto: Object.getPrototypeOf(d) === fns.Dog.prototype, inst: d instanceof fns.Dog,
      odd: show(fns.myNew(fns.Odd)), realOdd: show(new fns.Odd()), prim: show(fns.myNew(fns.Prim)), realPrim: show(new fns.Prim()),
    };
  };
  const PROTO_VS = (() => {
    const z = makeZoo(CLASS_SRC);
    return {
      viaProto: z.rex.__proto__ === z.Dog.prototype,
      viaGet: Object.getPrototypeOf(z.rex) === z.Dog.prototype,
      rexHasPrototypeProp: "prototype" in z.rex,
      dogHasPrototypeProp: "prototype" in z.Dog,
    };
  });
  const arrowMethod = () => labelOf(run('const o = { name: "A", f: () => this };', "o.f()", false).value);
  const arrowMethodIsO = () => run('const o = { name: "A", f: () => this };', "o.f() === o", false).value;
  /* The "safety rules" class adds on top of the old function code (checked live). */
  const classSafety = () => {
    const zc = makeZoo(CLASS_SRC);
    const zf = makeZoo(FUNC_SRC);
    return {
      noNew: shown(run(CLASS_SRC, "Dog('x')", false)),
      keysClass: Object.keys(zc.Dog.prototype),
      keysFunc: Object.keys(zf.Dog.prototype),
      privateSyntax: (() => { try { new Function("class A { #x = 1; static peek(o) { return o.#x; } }\nreturn new A().#x;"); return "no error"; } catch (e) { return e.name; } })(),
    };
  };
  /* A timer gives its callback its own this too (in Node a Timeout object; in a browser, window). Used by the test only. */
  const timerThis = () => new Promise((resolve) => { setTimeout(function () { resolve(typeof this); }, 0); });
  /* Object.hasOwn: the modern check, and it also works on objects with no prototype. */
  const hasOwnFacts = () => ({
    hasOwn: run(CLASS_SRC, 'Object.hasOwn(rex, "name")', false).value,
    hasOwnSpeak: run(CLASS_SRC, 'Object.hasOwn(rex, "speak")', false).value,
    bareHasOwn: run('const bare = Object.create(null); bare.a = 1;', 'Object.hasOwn(bare, "a")', false).value,
    bareMethod: run('const bare = Object.create(null); bare.a = 1;', 'typeof bare.hasOwnProperty', false).value,
    bareMethodCall: shown(run('const bare = Object.create(null); bare.a = 1;', 'bare.hasOwnProperty("a")', false)),
  });
  /* myNew only works for old constructor functions. A class needs Reflect.construct. */
  const myNewClass = () => {
    const src = MY_NEW + "\nclass Cat { constructor(name) { this.name = name; } }\n";
    return { myNew: shown(run(src, 'myNew(Cat, "Tom")', false)), reflect: shown(run(src, 'Reflect.construct(Cat, ["Tom"])', false)) };
  };

  const MODEL_SRC = `class Model {
  constructor(attributes = {}) {
    this.attributes = { ...attributes };
    this.listeners = {};
  }
  get(key) { return this.attributes[key]; }
  set(key, value) {
    if (this.attributes[key] === value) return;          // nothing changed: no event
    this.attributes[key] = value;
    this.trigger("change:" + key, this, value);
    this.trigger("change", this);
  }
  on(event, fn, context) {
    (this.listeners[event] ||= []).push({ fn, context });
  }
  off(event, fn) {
    this.listeners[event] = (this.listeners[event] || []).filter((l) => l.fn !== fn);
  }
  trigger(event, ...args) {
    (this.listeners[event] || []).forEach((l) => l.fn.apply(l.context, args));
  }
  toJSON() { return { ...this.attributes }; }
}`;
  const MODEL_USE = `const log = [];
const view = { prefix: "name is ", show(model, value) { log.push(this.prefix + value); } };
const m = new Model({ name: "Rex" });
m.on("change:name", view.show, view);   // the third argument is the this for the callback
m.set("name", "Max");
m.set("name", "Max");                    // same value: no event
m.set("age", 3);
log.push(JSON.stringify(m));`;
  const modelRun = () => new Function(MODEL_SRC + "\n" + MODEL_USE + "\nreturn log;")();

  return {
    run, show, shown, labelOf, cases, caseCode, runCase, ladder,
    lose, runTry, puzzles, runPuzzle, puzzleCode,
    FIELD_SRC, ARROW_SRC, arrowTries, arrowTry, fieldTry, fieldFacts,
    FUNC_SRC, CLASS_SRC, makeZoo, walkChain, lookup, lookups, lookupValue, myInstanceOf, checks, shadowDelete,
    bindImpl, mapImpl, frImpl, runnableCode, hints,
    MAKER_SRC, makerFacts,
    wrapTable, SMOOTHED_SRC, smoothedTry,
    TICKET_BUG, ticketDom, ticketVariants, FAKE_UI, ticketRun, GREP, GREP_JS,
    classSafety, timerThis, arrowMethodIsO, hasOwnFacts, myNewClass, sloppyLeak, boundNew, ctorReturn, arrowCtor, eventTarget, MY_NEW, myNewCheck, PROTO_VS, arrowMethod, MODEL_SRC, MODEL_USE, modelRun,
  };
});
