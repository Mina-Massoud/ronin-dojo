/* Data for "Types, unions and narrowing": the single source of truth for this lesson (the page and dev/ts-narrowing.test.js both load it).
   Every snippet is TypeScript source. What the page claims about it comes from two real tools, and the test runs both again:
     - tsc (TypeScript 7.0.2, --strict): the errors, and "the type of v at this line" (probes, see below);
     - Node: the same code with the types removed (the types-only parts are blanked out by node:module stripTypeScriptTypes).
   The browser cannot run tsc, so the compiler's answers are stored in FACTS (a block that a script fills in) and the test
   checks FACTS against a fresh run. The JavaScript runs live in the page.
   Probe = [line, expr, [members]]: the test adds `const p: Eq<typeof expr, A | B> = true;` to the END of that line
   (so line numbers never move), which compiles only if the compiler says expr has exactly that type there.
   Works in the browser (Book.parts["ts-narrowing"].data) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["ts-narrowing"] = root.Book.parts["ts-narrowing"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const J = (...lines) => lines.join("\n");
  const TSC_VERSION = "7.0.2";
  const EQ_TYPE = "type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;";

  /* ---------- the members of the film's union (one chip each) ---------- */
  const VALUE = ["string", "number", "null", "Date", "string[]", "{ name: string }", "{ id: number }"];
  const without = (list, ...gone) => list.filter((m) => !gone.includes(m));
  const AFTER_NULL = without(VALUE, "null");
  const AFTER_PRIM = without(AFTER_NULL, "string", "number");
  const AFTER_DATE = without(AFTER_PRIM, "Date");
  const AFTER_ARR = without(AFTER_DATE, "string[]");
  const AFTER_NAME = without(AFTER_ARR, "{ name: string }");

  const AFTER_STR = without(AFTER_NULL, "string");
  const T = (line, members, role, say, ch) => ({ line, members, role, say, ch });
  /* The film's stops. Every stop is a probe: tsc must agree that v has exactly these members at that line. */
  const FILM_STOPS = [
    T(3, VALUE, "start", "`v` could be any of seven types. Each check below removes some of them.", "Equality"),
    T(4, ["null"], "in", "`v === null` is an equality check. Inside the block, `v` can only be `null`."),
    T(6, AFTER_NULL, "after", "The block ends with `return`, so below it `null` is gone."),
    T(7, ["string"], "in", "`typeof` asks what kind of value this is. Inside, `v` is a `string`.", "typeof"),
    T(9, AFTER_STR, "after", "`string` returned, so it is gone for the rest of the function."),
    T(10, ["number"], "in", "Same idea for numbers. `string` is already gone, so this block is just `number`."),
    T(12, AFTER_PRIM, "after", "Now four types are left. All four are objects."),
    T(13, ["Date"], "in", "`instanceof` asks if a class made the value. Inside, `v` is a `Date`.", "Classes and arrays"),
    T(15, AFTER_DATE, "after", "`Date` is removed for the rest of the function."),
    T(16, ["string[]"], "in", "`Array.isArray` is a built-in check. Inside, `v` is `string[]`."),
    T(18, AFTER_ARR, "after", "Arrays are removed too. Two object types are left."),
    T(19, ["{ name: string }"], "in", "`\"name\" in v` asks: does the object have a `name`? Only one type does.", "The in check"),
    T(21, AFTER_NAME, "after", "That type is removed. One type is left."),
    T(22, AFTER_NAME, "end", "Only one type is left, so `v.id` is safe. Every type here was confirmed by `tsc`.", "What is left"),
  ];
  /* The predict game: a question at a line, the right members come from FILM_STOPS, and the wrong ones are checked by tsc. */
  const PREDICT = [
    { line: 10, ask: "The `typeof v === \"number\"` line is lit. Inside its block, what is `v`?", wrong: [["string", "number"], ["string"], ["number", "Date"]], why: "`string` was removed above, when the string block returned. So only `number` is left to match." },
    { line: 18, ask: "The array block just ended (lit). Below it, what can `v` be?", wrong: [["string[]", "{ name: string }", "{ id: number }"], ["{ id: number }"], ["Date", "{ name: string }", "{ id: number }"]], why: "The array block returned, so `string[]` is gone. `Date` was removed earlier. Two object types remain." },
    { line: 19, ask: "Now the `\"name\" in v` line is lit. Inside its block, what is `v`?", wrong: [["{ name: string }", "{ id: number }"], ["{ id: number }"], ["string[]", "{ name: string }"]], why: "Only one type has a `name` property, so the check keeps just that type." },
  ];

  const GUARDS = J(
    "type User = { id: number; name: string };",
    "",
    "function isUser(x: unknown): x is User {",
    "  if (typeof x !== \"object\" || x === null) return false;",
    "  const o = x as Record<string, unknown>;",
    "  return typeof o.id === \"number\" && typeof o.name === \"string\";",
    "}",
    "",
    "function isUsersReply(x: unknown): x is { users: User[] } {",
    "  return (",
    "    typeof x === \"object\" &&",
    "    x !== null &&",
    "    \"users\" in x &&",
    "    Array.isArray(x.users) &&",
    "    x.users.every(isUser)",
    "  );",
    "}",
    "",
    "",
  );
  const GUARDS_LINES = GUARDS.split("\n").length - 1; // the guard lines plus one blank line

  const STATE_TYPE = [
    "type State =",
    "  | { status: \"loading\" }",
    "  | { status: \"error\"; error: Error }",
    "  | { status: \"success\"; data: User[] };",
  ];
  /* The exhaustive-switch program, with or without a new "empty" status and its case. */
  function exhaustive(withEmpty, withCase) {
    const lines = [
      "type User = { id: number; name: string };",
      ...STATE_TYPE.slice(0, 2), ...(withEmpty ? ["  | { status: \"empty\" }"] : []), ...STATE_TYPE.slice(2),
      "",
      "function assertNever(x: never): never {",
      "  throw new Error(\"Unexpected state: \" + JSON.stringify(x));",
      "}",
      "",
      "function render(s: State): string {",
      "  switch (s.status) {",
      "    case \"loading\":",
      "      return \"Loading...\";",
      ...(withCase ? ["    case \"empty\":", "      return \"No users yet\";"] : []),
      "    case \"error\":",
      "      return \"Error: \" + s.error.message;",
      "    case \"success\":",
      "      return s.data.map((u) => u.name).join(\", \");",
      "    default:",
      "      return assertNever(s);",
      "  }",
      "}",
    ];
    return lines.join("\n");
  }
  const EX_CALLS = {
    loading: "render({ status: \"loading\" })",
    empty: "render({ status: \"empty\" })",
    error: "render({ status: \"error\", error: new Error(\"HTTP 429\") })",
    success: "render({ status: \"success\", data: [{ id: 1, name: \"Amal\" }] })",
    paused: "render({ status: \"paused\" })",
  };
  const exCases = (ids) => ids.map((id) => ({ id, call: EX_CALLS[id] }));
  const EX_BASE = exCases(["loading", "error", "success", "paused"]);
  const EX_ALL = exCases(["loading", "empty", "error", "success", "paused"]);

  /* ---------- the snippets ---------- */
  const SN = {
    /* page 01 */
    shoutBad: { ts: J("function shout(x: string | number) {", "  return x.toUpperCase();", "}"), expect: ["TS2339"], run: true,
      cases: [{ id: "str", call: "shout(\"hello\")" }, { id: "num", call: "shout(42)" }] },
    shoutGood: { ts: J("function shout(x: string | number) {", "  if (typeof x === \"string\") {", "    return x.toUpperCase();", "  }", "  return x.toFixed(0);", "}"), expect: [], run: true,
      probes: [[2, "x", ["string"]], [4, "x", ["number"]]],
      cases: [{ id: "str", call: "shout(\"hello\")" }, { id: "num", call: "shout(41.6)" }] },

    /* page 02: the film (and the predict game) */
    film: { ts: J(
      "type Value = string | number | null | Date | string[] | { name: string } | { id: number };",
      "",
      "function show(v: Value): string {",
      "  if (v === null) {",
      "    return \"nothing\";",
      "  }",
      "  if (typeof v === \"string\") {",
      "    return v;",
      "  }",
      "  if (typeof v === \"number\") {",
      "    return v.toFixed(1);",
      "  }",
      "  if (v instanceof Date) {",
      "    return v.toISOString();",
      "  }",
      "  if (Array.isArray(v)) {",
      "    return v.join(\", \");",
      "  }",
      "  if (\"name\" in v) {",
      "    return v.name;",
      "  }",
      "  return String(v.id);",
      "}"), expect: [], run: true, fold: 2, members: VALUE,
      stops: FILM_STOPS,
      probes: FILM_STOPS.filter((st) => st.role !== "end").map((st) => [st.line, "v", st.members]),
      wrong: PREDICT.flatMap((q) => q.wrong.map((m) => [q.line, "v", m])),
      cases: [
        { id: "null", call: "show(null)" }, { id: "str", call: "show(\"hi\")" }, { id: "num", call: "show(2)" },
        { id: "arr", call: "show([\"a\", \"b\"])" }, { id: "name", call: "show({ name: \"Amal\" })" }, { id: "id", call: "show({ id: 7 })" },
      ] },

    /* page 03: any and unknown */
    anyList: { ts: J(
      "type User = { id: number; name: string };",
      "",
      "function listNames(text: string) {",
      "  const data = JSON.parse(text);",
      "  return data.users.map((u: User) => u.name);",
      "}"), expect: [], run: true, probes: [[4, "data", ["any"]]] },
    unkList: { ts: J(
      "type User = { id: number; name: string };",
      "",
      "function listNames(text: string) {",
      "  const data: unknown = JSON.parse(text);",
      "  return data.users.map((u: User) => u.name);",
      "}"), expect: ["TS18046"], run: true },
    guardList: { ts: GUARDS + J(
      "function listNames(text: string): string[] {",
      "  const data: unknown = JSON.parse(text);",
      "  if (!isUsersReply(data)) {",
      "    return [];",
      "  }",
      "  return data.users.map((u) => u.name);",
      "}"), expect: [], run: true, fold: GUARDS_LINES,
      probes: [[GUARDS_LINES + 2, "data", ["unknown"]], [GUARDS_LINES + 5, "data", ["{ users: User[] }"]]] },

    /* page 04: write a type guard */
    isUserFn: { ts: J(
      "type User = { id: number; name: string };",
      "",
      "function isUser(x: unknown): x is User {",
      "  if (typeof x !== \"object\" || x === null) return false;",
      "  const o = x as Record<string, unknown>;",
      "  return typeof o.id === \"number\" && typeof o.name === \"string\";",
      "}"), expect: [], run: true, fold: 2 },
    liar: { ts: J(
      "type User = { id: number; name: string };",
      "",
      "function isUser(x: unknown): x is User {",
      "  return true;",
      "}",
      "",
      "const data: unknown = JSON.parse(\"{\\\"id\\\":4}\");",
      "if (isUser(data)) {",
      "  console.log(data.name.toUpperCase());",
      "}"), expect: [], run: true, probes: [[8, "data", ["User"]]] },

    /* page 05: three flags */
    flagsPlain: { ts: J(
      "type User = { id: number; name: string };",
      "type State = {",
      "  isLoading: boolean;",
      "  error: Error | null;",
      "  data: User[] | null;",
      "};",
      "",
      "function render(s: State): string {",
      "  if (s.isLoading) return \"Loading...\";",
      "  if (s.error) return \"Error: \" + s.error.message;",
      "  return s.data.map((u) => u.name).join(\", \");",
      "}"), expect: ["TS18047"] },
    flagsBang: { ts: J(
      "type User = { id: number; name: string };",
      "type State = {",
      "  isLoading: boolean;",
      "  error: Error | null;",
      "  data: User[] | null;",
      "};",
      "",
      "function render(s: State): string {",
      "  if (s.isLoading) return \"Loading...\";",
      "  if (s.error) return \"Error: \" + s.error.message;",
      "  return s.data!.map((u) => u.name).join(\", \");",
      "}"), expect: [], run: true },

    /* page 06: the tagged union */
    unionCheat: { ts: J(
      "type User = { id: number; name: string };",
      ...STATE_TYPE,
      "",
      "const a: State = { status: \"success\" };",
      "const b: State = { status: \"loading\", data: [] };",
      "const c: State = { status: \"sucess\", data: [] };"), expect: ["TS2322", "TS2353", "TS2820"] },
    exh0: { ts: exhaustive(false, false), expect: [], run: true, fold: 0,
      probes: [[13, "s", ["{ status: \"loading\" }"]], [15, "s", ["{ status: \"error\"; error: Error }"]], [17, "s", ["{ status: \"success\"; data: User[] }"]], [19, "s", ["never"]]], cases: EX_BASE },
    exh1: { ts: exhaustive(true, false), expect: ["TS2345"], run: true },
    exh2: { ts: exhaustive(true, true), expect: [], run: true, cases: EX_ALL },
    exh3: { ts: J(
      "type User = { id: number; name: string };",
      ...STATE_TYPE.slice(0, 2), "  | { status: \"empty\" }", ...STATE_TYPE.slice(2),
      "",
      "function render(s: State): string {",
      "  switch (s.status) {",
      "    case \"loading\":",
      "      return \"Loading...\";",
      "    case \"error\":",
      "      return \"Error: \" + s.error.message;",
      "    case \"success\":",
      "      return s.data.map((u) => u.name).join(\", \");",
      "  }",
      "}"), expect: ["TS2366"] },
    readWrong: { ts: J(
      "type User = { id: number; name: string };",
      ...STATE_TYPE,
      "",
      "function f(s: State) {",
      "  if (s.status === \"error\") {",
      "    return s.data;",
      "  }",
      "  return null;",
      "}"), expect: ["TS2339"] },
    flatTrial: { ts: J(
      "type TrialState = {",
      "  status: \"loading\" | \"success\" | \"error\" | null;",
      "  errorMessage?: string;",
      "};",
      "",
      "const a: TrialState = {",
      "  status: \"success\",",
      "  errorMessage: \"oops\",",
      "};",
      "const b: TrialState = { status: \"error\" };"), expect: [] },

    /* page 07: the ways to narrow (one main example per card; some have a trap) */
    hubTypeof: { ts: J("function pad(x: string | number) {", "  if (typeof x === \"string\") {", "    return x.padStart(4);", "  }", "  return x.toFixed(0).padStart(4);", "}"), expect: [], probes: [[2, "x", ["string"]], [4, "x", ["number"]]] },
    typeofTraps: { ts: J("console.log(typeof null);", "console.log(typeof [1]);", "console.log(typeof undefined);", "console.log(typeof (() => 1));"), expect: [], run: true },
    hubTruthy: { ts: J(
      "function greet(name: string | null) {",
      "  if (name) {",
      "    return \"Hi \" + name;",
      "  }",
      "  return \"Hi there\";",
      "}"), expect: [], run: true, probes: [[2, "name", ["string"]], [4, "name", ["string", "null"]]],
      cases: [{ id: "name", call: "greet(\"Amal\")" }, { id: "empty", call: "greet(\"\")" }, { id: "null", call: "greet(null)" }] },
    hubEqual: { ts: J(
      "function len(s: string | null | undefined) {",
      "  if (s == null) {",
      "    return 0;",
      "  }",
      "  return s.length;",
      "}",
      "",
      "function same(a: string | number, b: string | boolean) {",
      "  if (a === b) {",
      "    return a.toUpperCase();",
      "  }",
      "  return null;",
      "}"), expect: [], run: true, probes: [[2, "s", ["null", "undefined"]], [4, "s", ["string"]], [9, "a", ["string"]]],
      cases: [{ id: "null", call: "len(null)" }, { id: "undef", call: "len(undefined)" }, { id: "str", call: "len(\"abc\")" }, { id: "same", label: "same(\"a\", \"a\")", call: "same(\"a\", \"a\")" }] },
    hubIn: { ts: J(
      "type Fish = { swim: () => void };",
      "type Bird = { fly: () => void };",
      "",
      "function move(pet: Fish | Bird) {",
      "  if (\"swim\" in pet) {",
      "    return pet.swim();",
      "  }",
      "  return pet.fly();",
      "}"), expect: [], probes: [[5, "pet", ["Fish"]], [7, "pet", ["Bird"]]] },
    inTrap: { ts: J(
      "type A = { kind: \"a\"; note?: string };",
      "type B = { kind: \"b\"; note?: number };",
      "",
      "function f(x: A | B) {",
      "  if (\"note\" in x) {",
      "    return x;",
      "  }",
      "  return null;",
      "}"), expect: [], probes: [[5, "x", ["A", "B"]]] },
    hubInstanceof: { ts: J(
      "function message(e: unknown): string {",
      "  if (e instanceof Error) {",
      "    return e.message;",
      "  }",
      "  return String(e);",
      "}"), expect: [], run: true, probes: [[2, "e", ["Error"]], [4, "e", ["unknown"]]],
      cases: [{ id: "real", call: "message(new Error(\"boom\"))" }, { id: "json", call: "message(JSON.parse('{\"message\":\"boom\"}'))" }] },
    hubDisc: { ts: J(
      "type Shape =",
      "  | { kind: \"circle\"; r: number }",
      "  | { kind: \"square\"; side: number };",
      "",
      "function area(s: Shape) {",
      "  if (s.kind === \"circle\") {",
      "    return 3 * s.r * s.r;",
      "  }",
      "  return s.side * s.side;",
      "}"), expect: [], probes: [[6, "s", ["{ kind: \"circle\"; r: number }"]], [8, "s", ["{ kind: \"square\"; side: number }"]]] },
    discTrap: { ts: J(
      "type A = { type: string; x: number };",
      "type B = { type: string; y: string };",
      "",
      "function f(s: A | B) {",
      "  if (s.type === \"a\") {",
      "    return s.x;",
      "  }",
      "  return 0;",
      "}"), expect: ["TS2339"] },
    hubGuard: { ts: J(
      "function isStringList(x: unknown): x is string[] {",
      "  return (",
      "    Array.isArray(x) &&",
      "    x.every((i) => typeof i === \"string\")",
      "  );",
      "}",
      "",
      "function count(x: unknown) {",
      "  if (isStringList(x)) {",
      "    return x.length;",
      "  }",
      "  return 0;",
      "}"), expect: [], probes: [[9, "x", ["string[]"]]] },
    hubAsserts: { ts: J(
      "function assertString(x: unknown): asserts x is string {",
      "  if (typeof x !== \"string\") {",
      "    throw new TypeError(\"not a string\");",
      "  }",
      "}",
      "",
      "function upper(v: unknown) {",
      "  assertString(v);",
      "  return v.toUpperCase();",
      "}"), expect: [], run: true, probes: [[8, "v", ["string"]]],
      cases: [{ id: "ok", call: "upper(\"hi\")" }, { id: "bad", call: "upper(5)" }] },
    assertsTrap: { ts: J(
      "const assertNumber = (x: unknown): asserts x is number => {",
      "  if (typeof x !== \"number\") throw new TypeError(\"no\");",
      "};",
      "",
      "function f(v: unknown) {",
      "  assertNumber(v);",
      "}"), expect: ["TS2775"] },
    hubSatisfies: { ts: J(
      "const a: Record<string, string> = { home: \"/\" };",
      "a.hone.toUpperCase();",
      "",
      "const b = { home: \"/\" } satisfies Record<string, string>;",
      "b.hone.toUpperCase();"), expect: ["TS2339"] },
    hubAs: { ts: J(
      "type User = { id: number; name: string };",
      "",
      "const text = \"{\\\"id\\\":4}\";",
      "const user = JSON.parse(text) as User;",
      "console.log(user.name.toUpperCase());"), expect: [], run: true },
    resJson: { ts: J("async function f(res: Response) {", "  const body = await res.json();", "  return body;", "}"), expect: [], probes: [[2, "body", ["any"]]] },
    anyAssign: { ts: J("const a: any = 1;", "const u: unknown = 1;", "const x: string = a;", "const y: string = u;", "const k: unknown = a;", "const m: any = u;"), expect: ["TS2322"] },
    catchUnknown: { ts: J("try {", "  JSON.parse(\"{\");", "} catch (e) {", "  console.log(e.message);", "}"), expect: ["TS18046"] },
    filterInfer: { ts: J(
      "const nums: (number | undefined)[] = [1, undefined, 2];",
      "const a = nums.filter((x) => x !== undefined);",
      "const b = nums.filter((x) => !!x);",
      "const c = nums.filter((x): x is number => !!x);"), expect: [],
      probes: [[2, "a", ["number[]"]], [3, "b", ["(number | undefined)[]"]], [4, "c", ["number[]"]]] },
    ticketBug: { ts: J(
      "type User = { id: number; name: string };",
      "type State = {",
      "  isLoading: boolean;",
      "  error: Error | null;",
      "  data: User[] | undefined;",
      "};",
      "",
      "async function load(url: string, state: State) {",
      "  state.isLoading = true;",
      "  try {",
      "    const res = await fetch(url);",
      "    const body = await res.json();",
      "    state.data = body.users;",
      "  } catch (e) {",
      "    state.error = e as Error;",
      "  }",
      "  state.isLoading = false;",
      "}",
      "",
      "function render(s: State): string {",
      "  if (s.isLoading) return \"Loading...\";",
      "  if (s.error) return \"Error: \" + s.error.message;",
      "  return s.data!.map((u) => u.name).join(\", \");",
      "}"), expect: [], run: true, fetch: true,
      cases: ["ok", "429", "shape", "offline"].map((u) => ({ id: u, label: `load("${u}"), then render`, call: `(async () => { const s = { isLoading: false, error: null, data: undefined }; await load("${u}", s); return render(s); })()` })) },
    asTrap: { ts: J("const n = 5;", "const s = n as string;"), expect: ["TS2352"] },

    /* page 08: from your work (stand-ins that follow the shapes in Speako, simplified) */
    speakoFilter: { ts: J(
      "type TableShape = { kind: \"table\"; capacity: number };",
      "type WallShape = { kind: \"wall\"; thickness: number };",
      "type FixtureShape = { kind: \"fixture\"; fixtureType: string };",
      "type Shape = TableShape | WallShape | FixtureShape;",
      "declare const shapes: Shape[];",
      "",
      "const a = shapes.filter(",
      "  (x): x is TableShape => x.kind === \"table\",",
      ");",
      "const b = shapes.filter((x) => x.kind === \"table\");"), expect: [],
      probes: [[9, "a", ["TableShape[]"]], [10, "b", ["TableShape[]"]]] },

    /* page 09: on the job */
    loadUsers: { ts: GUARDS + J(
      "type State =",
      "  | { status: \"loading\" }",
      "  | { status: \"error\"; error: Error }",
      "  | { status: \"success\"; data: User[] };",
      "",
      "async function loadUsers(url: string): Promise<State> {",
      "  try {",
      "    const res = await fetch(url);",
      "    if (!res.ok) {",
      "      return { status: \"error\", error: new Error(\"HTTP \" + res.status) };",
      "    }",
      "    const body: unknown = await res.json();",
      "    if (!isUsersReply(body)) {",
      "      return { status: \"error\", error: new Error(\"Unexpected response\") };",
      "    }",
      "    return { status: \"success\", data: body.users };",
      "  } catch (e: unknown) {",
      "    const error = e instanceof Error ? e : new Error(String(e));",
      "    return { status: \"error\", error };",
      "  }",
      "}"), expect: [], run: true, fold: GUARDS_LINES, fetch: true,
      cases: [
        ...["ok", "429", "shape", "offline"].map((u) => ({ id: u, label: `loadUsers("${u}")`, call: `loadUsers("${u}").then((s) => (s.status === "error" ? { status: s.status, message: s.error.message } : s))` })),
      ] },

    /* page 10: interview answers */
    bus: { ts: J(
      "type AppEvent =",
      "  | { type: \"login\"; userId: string }",
      "  | { type: \"logout\" };",
      "",
      "type Handler = (event: AppEvent) => void;",
      "",
      "class EventBus {",
      "  private handlers = new Map<AppEvent[\"type\"], Set<Handler>>();",
      "",
      "  subscribe(type: AppEvent[\"type\"], fn: Handler): () => void {",
      "    const set = this.handlers.get(type) ?? new Set<Handler>();",
      "    set.add(fn);",
      "    this.handlers.set(type, set);",
      "    return () => {",
      "      set.delete(fn);",
      "    };",
      "  }",
      "",
      "  publish(event: AppEvent): void {",
      "    const handlers = this.handlers.get(event.type) ?? [];",
      "    for (const fn of [...handlers]) {",
      "      fn(event);",
      "    }",
      "  }",
      "}"), expect: [], run: true,
      cases: [
        { id: "order", label: "two handlers, in order", call: "(() => { const out = []; const bus = new EventBus(); bus.subscribe(\"login\", (e) => out.push(\"a:\" + e.userId)); bus.subscribe(\"login\", (e) => out.push(\"b:\" + e.userId)); bus.publish({ type: \"login\", userId: \"u1\" }); bus.publish({ type: \"logout\" }); return out; })()" },
        { id: "selfRemove", label: "a handler unsubscribes itself", call: "(() => { const out = []; const bus = new EventBus(); const off = bus.subscribe(\"logout\", () => { out.push(\"a\"); off(); }); bus.subscribe(\"logout\", () => out.push(\"b\")); bus.publish({ type: \"logout\" }); bus.publish({ type: \"logout\" }); return out; })()" },
      ] },
    busUse: { ts: J(
      "type AppEvent =",
      "  | { type: \"login\"; userId: string }",
      "  | { type: \"logout\" };",
      "declare const bus: {",
      "  subscribe(",
      "    type: AppEvent[\"type\"],",
      "    fn: (e: AppEvent) => void,",
      "  ): () => void;",
      "};",
      "",
      "bus.subscribe(\"login\", (e) => e.userId);",
      "bus.subscribe(\"login\", (e) => {",
      "  if (e.type === \"login\") console.log(e.userId);",
      "});"), expect: ["TS2339"] },
    busMap: { ts: J(
      "type Events = {",
      "  login: { userId: string };",
      "  logout: { reason: string };",
      "};",
      "",
      "declare function on<K extends keyof Events>(",
      "  type: K,",
      "  fn: (payload: Events[K]) => void,",
      "): void;",
      "",
      "on(\"login\", (p) => p.userId);",
      "on(\"logout\", (p) => p.userId);"), expect: ["TS2339"] },
    emitter: { ts: J(
      "type Events = {", "  login: { userId: string };", "  logout: { reason: string };",
      "};", "type Handler = ((payload: never) => void) & { original?: unknown };", "",
      "class Emitter<E extends Record<string, unknown>> {", "  private handlers = new Map<keyof E, Set<Handler>>();", "",
      "  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {", "    const set = this.handlers.get(type) ?? new Set<Handler>();", "    set.add(fn as Handler);",
      "    this.handlers.set(type, set);", "    return () => this.off(type, fn);", "  }",
      "", "  once<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {", "    const wrapper = Object.assign(",
      "      (payload: E[K]) => {", "        this.off(type, fn);", "        fn(payload);",
      "      },", "      { original: fn },", "    );",
      "    return this.on(type, wrapper);", "  }", "",
      "  off<K extends keyof E>(type: K, fn: (payload: E[K]) => void): void {", "    const set = this.handlers.get(type);", "    if (!set) return;",
      "    for (const h of set) {", "      if (h === fn || h.original === fn) set.delete(h);", "    }",
      "    if (set.size === 0) this.handlers.delete(type);", "  }", "",
      "  emit<K extends keyof E>(type: K, payload: E[K]): void {", "    for (const h of [...(this.handlers.get(type) ?? [])]) {", "      try {",
      "        (h as (payload: E[K]) => void)(payload);", "      } catch (error) {", "        console.error(String(error));",
      "      }", "    }", "  }",
      "}", "", "const bus = new Emitter<Events>();",
      "bus.on(\"login\", (p) => p.userId);", "bus.emit(\"login\", { userId: \"u1\" });",
      "bus.emit(\"login\", 5);"), expect: ["TS2345"], run: true, fold: 0,
      cases: [
        { id: "twice", label: "the same function twice", call: "(() => { const e = new Emitter(); const out = []; const f = () => out.push(\"f\"); e.on(\"a\", f); e.on(\"a\", f); e.emit(\"a\", 1); const first = out.length; e.off(\"a\", f); e.emit(\"a\", 1); return [first, out.length]; })()" },
        { id: "throws", label: "a handler throws", call: "(() => { const e = new Emitter(); const out = []; e.on(\"a\", () => { throw new Error(\"boom\"); }); e.on(\"a\", () => out.push(\"b\")); e.emit(\"a\", 1); return out; })()" },
        { id: "once", label: "once, then off(original)", call: "(() => { const e = new Emitter(); const out = []; const f = () => out.push(\"f\"); const g = () => out.push(\"g\"); e.once(\"a\", f); e.off(\"a\", f); e.once(\"a\", g); e.emit(\"a\", 1); e.emit(\"a\", 1); return out; })()" },
        { id: "empty", label: "empty Sets are removed", call: "(() => { const e = new Emitter(); const off = e.on(\"a\", () => {}); const before = e.handlers.size; off(); return [before, e.handlers.size]; })()" },
      ] },
    mergeIface: { ts: J("interface A { x: number }", "interface A { y: number }", "type B = { x: number };", "type B = { y: number };"), expect: ["TS2300", "TS2300"] },
  };
  /* each snippet knows its own id */
  for (const [id, sn] of Object.entries(SN)) { sn.id = id; sn.fold = sn.fold || 0; }

  /* cases that come from shared lists (declared below as functions or consts, so they are attached after) */
  const attachCases = () => {
    const bodyCases = BODIES.map((b) => ({ id: b.id, call: `listNames(${JSON.stringify(b.text)})` }));
    for (const id of ["anyList", "unkList", "guardList"]) SN[id].cases = bodyCases;
    SN.flagsBang.cases = flagRows().map((r, i) => ({ id: "r" + i, call: flagCall(r) }));
  };

  /* ---------- the compiler's and Node's answers, filled in by a script and checked again by the test ---------- */
  /*FACTS-BEGIN*/
  const FACTS = {
    "shoutBad": {"errors":[{"line":2,"col":12,"code":"TS2339","msg":"Property 'toUpperCase' does not exist on type 'string | number'.","more":["Property 'toUpperCase' does not exist on type 'number'."]}],"js":"function shout(x) {\n  return x.toUpperCase();\n}","main":{"logs":[],"value":null},"cases":{"str":{"logs":[],"value":"HELLO"},"num":{"logs":[],"error":{"name":"TypeError","message":"x.toUpperCase is not a function"}}}},
    "shoutGood": {"errors":[],"js":"function shout(x) {\n  if (typeof x === \"string\") {\n    return x.toUpperCase();\n  }\n  return x.toFixed(0);\n}","main":{"logs":[],"value":null},"cases":{"str":{"logs":[],"value":"HELLO"},"num":{"logs":[],"value":"42"}}},
    "film": {"errors":[],"js":"function show(v) {\n  if (v === null) {\n    return \"nothing\";\n  }\n  if (typeof v === \"string\") {\n    return v;\n  }\n  if (typeof v === \"number\") {\n    return v.toFixed(1);\n  }\n  if (v instanceof Date) {\n    return v.toISOString();\n  }\n  if (Array.isArray(v)) {\n    return v.join(\", \");\n  }\n  if (\"name\" in v) {\n    return v.name;\n  }\n  return String(v.id);\n}","main":{"logs":[],"value":null},"cases":{"null":{"logs":[],"value":"nothing"},"str":{"logs":[],"value":"hi"},"num":{"logs":[],"value":"2.0"},"arr":{"logs":[],"value":"a, b"},"name":{"logs":[],"value":"Amal"},"id":{"logs":[],"value":"7"}}},
    "anyList": {"errors":[],"js":"function listNames(text) {\n  const data = JSON.parse(text);\n  return data.users.map((u) => u.name);\n}","main":{"logs":[],"value":null},"cases":{"good":{"logs":[],"value":["Amal","Omar"]},"error":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of undefined (reading 'map')"}},"null":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of null (reading 'map')"}},"wrong":{"logs":[],"value":[null]}}},
    "unkList": {"errors":[{"line":5,"col":10,"code":"TS18046","msg":"'data' is of type 'unknown'."}],"js":"function listNames(text) {\n  const data = JSON.parse(text);\n  return data.users.map((u) => u.name);\n}","main":{"logs":[],"value":null},"cases":{"good":{"logs":[],"value":["Amal","Omar"]},"error":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of undefined (reading 'map')"}},"null":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of null (reading 'map')"}},"wrong":{"logs":[],"value":[null]}}},
    "guardList": {"errors":[],"js":"function isUser(x) {\n  if (typeof x !== \"object\" || x === null) return false;\n  const o = x;\n  return typeof o.id === \"number\" && typeof o.name === \"string\";\n}\n\nfunction isUsersReply(x) {\n  return (\n    typeof x === \"object\" &&\n    x !== null &&\n    \"users\" in x &&\n    Array.isArray(x.users) &&\n    x.users.every(isUser)\n  );\n}\n\nfunction listNames(text) {\n  const data = JSON.parse(text);\n  if (!isUsersReply(data)) {\n    return [];\n  }\n  return data.users.map((u) => u.name);\n}","main":{"logs":[],"value":null},"cases":{"good":{"logs":[],"value":["Amal","Omar"]},"error":{"logs":[],"value":[]},"null":{"logs":[],"value":[]},"wrong":{"logs":[],"value":[]}}},
    "isUserFn": {"errors":[],"js":"function isUser(x) {\n  if (typeof x !== \"object\" || x === null) return false;\n  const o = x;\n  return typeof o.id === \"number\" && typeof o.name === \"string\";\n}","main":{"logs":[],"value":null}},
    "liar": {"errors":[],"js":"function isUser(x) {\n  return true;\n}\n\nconst data = JSON.parse(\"{\\\"id\\\":4}\");\nif (isUser(data)) {\n  console.log(data.name.toUpperCase());\n}","main":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of undefined (reading 'toUpperCase')"}}},
    "flagsPlain": {"errors":[{"line":11,"col":10,"code":"TS18047","msg":"'s.data' is possibly 'null'."}]},
    "flagsBang": {"errors":[],"js":"function render(s) {\n  if (s.isLoading) return \"Loading...\";\n  if (s.error) return \"Error: \" + s.error.message;\n  return s.data.map((u) => u.name).join(\", \");\n}","main":{"logs":[],"value":null},"cases":{"r0":{"logs":[],"value":"Loading..."},"r1":{"logs":[],"value":"Loading..."},"r2":{"logs":[],"value":"Loading..."},"r3":{"logs":[],"value":"Loading..."},"r4":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of null (reading 'map')"}},"r5":{"logs":[],"value":"Amal"},"r6":{"logs":[],"value":"Error: HTTP 429"},"r7":{"logs":[],"value":"Error: HTTP 429"}}},
    "unionCheat": {"errors":[{"line":7,"col":7,"code":"TS2322","msg":"Type '{ status: \"success\"; }' is not assignable to type 'State'.","more":["Property 'data' is missing in type '{ status: \"success\"; }' but required in type '{ status: \"success\"; data: User[]; }'."]},{"line":8,"col":39,"code":"TS2353","msg":"Object literal may only specify known properties, and 'data' does not exist in type '{ status: \"loading\"; }'."},{"line":9,"col":20,"code":"TS2820","msg":"Type '\"sucess\"' is not assignable to type '\"error\" | \"loading\" | \"success\"'. Did you mean '\"success\"'?"}]},
    "exh0": {"errors":[],"js":"function assertNever(x) {\n  throw new Error(\"Unexpected state: \" + JSON.stringify(x));\n}\n\nfunction render(s) {\n  switch (s.status) {\n    case \"loading\":\n      return \"Loading...\";\n    case \"error\":\n      return \"Error: \" + s.error.message;\n    case \"success\":\n      return s.data.map((u) => u.name).join(\", \");\n    default:\n      return assertNever(s);\n  }\n}","main":{"logs":[],"value":null},"cases":{"loading":{"logs":[],"value":"Loading..."},"error":{"logs":[],"value":"Error: HTTP 429"},"success":{"logs":[],"value":"Amal"},"paused":{"logs":[],"error":{"name":"Error","message":"Unexpected state: {\"status\":\"paused\"}"}}}},
    "exh1": {"errors":[{"line":21,"col":26,"code":"TS2345","msg":"Argument of type '{ status: \"empty\"; }' is not assignable to parameter of type 'never'."}],"js":"function assertNever(x) {\n  throw new Error(\"Unexpected state: \" + JSON.stringify(x));\n}\n\nfunction render(s) {\n  switch (s.status) {\n    case \"loading\":\n      return \"Loading...\";\n    case \"error\":\n      return \"Error: \" + s.error.message;\n    case \"success\":\n      return s.data.map((u) => u.name).join(\", \");\n    default:\n      return assertNever(s);\n  }\n}","main":{"logs":[],"value":null}},
    "exh2": {"errors":[],"js":"function assertNever(x) {\n  throw new Error(\"Unexpected state: \" + JSON.stringify(x));\n}\n\nfunction render(s) {\n  switch (s.status) {\n    case \"loading\":\n      return \"Loading...\";\n    case \"empty\":\n      return \"No users yet\";\n    case \"error\":\n      return \"Error: \" + s.error.message;\n    case \"success\":\n      return s.data.map((u) => u.name).join(\", \");\n    default:\n      return assertNever(s);\n  }\n}","main":{"logs":[],"value":null},"cases":{"loading":{"logs":[],"value":"Loading..."},"empty":{"logs":[],"value":"No users yet"},"error":{"logs":[],"value":"Error: HTTP 429"},"success":{"logs":[],"value":"Amal"},"paused":{"logs":[],"error":{"name":"Error","message":"Unexpected state: {\"status\":\"paused\"}"}}}},
    "exh3": {"errors":[{"line":8,"col":28,"code":"TS2366","msg":"Function lacks ending return statement and return type does not include 'undefined'."}]},
    "readWrong": {"errors":[{"line":9,"col":14,"code":"TS2339","msg":"Property 'data' does not exist on type '{ status: \"error\"; error: Error; }'."}]},
    "flatTrial": {"errors":[]},
    "hubTypeof": {"errors":[]},
    "typeofTraps": {"errors":[],"js":"console.log(typeof null);\nconsole.log(typeof [1]);\nconsole.log(typeof undefined);\nconsole.log(typeof (() => 1));","main":{"logs":["object","object","undefined","function"],"value":null}},
    "hubTruthy": {"errors":[],"js":"function greet(name) {\n  if (name) {\n    return \"Hi \" + name;\n  }\n  return \"Hi there\";\n}","main":{"logs":[],"value":null},"cases":{"name":{"logs":[],"value":"Hi Amal"},"empty":{"logs":[],"value":"Hi there"},"null":{"logs":[],"value":"Hi there"}}},
    "hubEqual": {"errors":[],"js":"function len(s) {\n  if (s == null) {\n    return 0;\n  }\n  return s.length;\n}\n\nfunction same(a, b) {\n  if (a === b) {\n    return a.toUpperCase();\n  }\n  return null;\n}","main":{"logs":[],"value":null},"cases":{"null":{"logs":[],"value":0},"undef":{"logs":[],"value":0},"str":{"logs":[],"value":3},"same":{"logs":[],"value":"A"}}},
    "hubIn": {"errors":[]},
    "inTrap": {"errors":[]},
    "hubInstanceof": {"errors":[],"js":"function message(e) {\n  if (e instanceof Error) {\n    return e.message;\n  }\n  return String(e);\n}","main":{"logs":[],"value":null},"cases":{"real":{"logs":[],"value":"boom"},"json":{"logs":[],"value":"[object Object]"}}},
    "hubDisc": {"errors":[]},
    "discTrap": {"errors":[{"line":6,"col":14,"code":"TS2339","msg":"Property 'x' does not exist on type 'A | B'.","more":["Property 'x' does not exist on type 'B'."]}]},
    "hubGuard": {"errors":[]},
    "hubAsserts": {"errors":[],"js":"function assertString(x) {\n  if (typeof x !== \"string\") {\n    throw new TypeError(\"not a string\");\n  }\n}\n\nfunction upper(v) {\n  assertString(v);\n  return v.toUpperCase();\n}","main":{"logs":[],"value":null},"cases":{"ok":{"logs":[],"value":"HI"},"bad":{"logs":[],"error":{"name":"TypeError","message":"not a string"}}}},
    "assertsTrap": {"errors":[{"line":6,"col":3,"code":"TS2775","msg":"Assertions require every name in the call target to be declared with an explicit type annotation."}]},
    "hubSatisfies": {"errors":[{"line":5,"col":3,"code":"TS2339","msg":"Property 'hone' does not exist on type '{ home: string; }'."}]},
    "hubAs": {"errors":[],"js":"const text = \"{\\\"id\\\":4}\";\nconst user = JSON.parse(text);\nconsole.log(user.name.toUpperCase());","main":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of undefined (reading 'toUpperCase')"}}},
    "resJson": {"errors":[]},
    "anyAssign": {"errors":[{"line":4,"col":7,"code":"TS2322","msg":"Type 'unknown' is not assignable to type 'string'."}]},
    "catchUnknown": {"errors":[{"line":4,"col":15,"code":"TS18046","msg":"'e' is of type 'unknown'."}]},
    "filterInfer": {"errors":[]},
    "ticketBug": {"errors":[],"js":"async function load(url, state) {\n  state.isLoading = true;\n  try {\n    const res = await fetch(url);\n    const body = await res.json();\n    state.data = body.users;\n  } catch (e) {\n    state.error = e;\n  }\n  state.isLoading = false;\n}\n\nfunction render(s) {\n  if (s.isLoading) return \"Loading...\";\n  if (s.error) return \"Error: \" + s.error.message;\n  return s.data.map((u) => u.name).join(\", \");\n}","main":{"logs":[],"value":null},"cases":{"429":{"logs":[],"error":{"name":"TypeError","message":"Cannot read properties of undefined (reading 'map')"}},"ok":{"logs":[],"value":"Amal, Omar"},"shape":{"logs":[],"value":""},"offline":{"logs":[],"value":"Error: Failed to fetch"}}},
    "asTrap": {"errors":[{"line":2,"col":11,"code":"TS2352","msg":"Conversion of type 'number' to type 'string' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first."}]},
    "speakoFilter": {"errors":[]},
    "loadUsers": {"errors":[],"js":"function isUser(x) {\n  if (typeof x !== \"object\" || x === null) return false;\n  const o = x;\n  return typeof o.id === \"number\" && typeof o.name === \"string\";\n}\n\nfunction isUsersReply(x) {\n  return (\n    typeof x === \"object\" &&\n    x !== null &&\n    \"users\" in x &&\n    Array.isArray(x.users) &&\n    x.users.every(isUser)\n  );\n}\n\nasync function loadUsers(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) {\n      return { status: \"error\", error: new Error(\"HTTP \" + res.status) };\n    }\n    const body = await res.json();\n    if (!isUsersReply(body)) {\n      return { status: \"error\", error: new Error(\"Unexpected response\") };\n    }\n    return { status: \"success\", data: body.users };\n  } catch (e) {\n    const error = e instanceof Error ? e : new Error(String(e));\n    return { status: \"error\", error };\n  }\n}","main":{"logs":[],"value":null},"cases":{"429":{"logs":[],"value":{"status":"error","message":"HTTP 429"}},"ok":{"logs":[],"value":{"status":"success","data":[{"id":1,"name":"Amal"},{"id":2,"name":"Omar"}]}},"shape":{"logs":[],"value":{"status":"error","message":"Unexpected response"}},"offline":{"logs":[],"value":{"status":"error","message":"Failed to fetch"}}}},
    "bus": {"errors":[],"js":"class EventBus {\n  handlers = new Map();\n\n  subscribe(type, fn) {\n    const set = this.handlers.get(type) ?? new Set();\n    set.add(fn);\n    this.handlers.set(type, set);\n    return () => {\n      set.delete(fn);\n    };\n  }\n\n  publish(event) {\n    const handlers = this.handlers.get(event.type) ?? [];\n    for (const fn of [...handlers]) {\n      fn(event);\n    }\n  }\n}","main":{"logs":[],"value":null},"cases":{"order":{"logs":[],"value":["a:u1","b:u1"]},"selfRemove":{"logs":[],"value":["a","b","b"]}}},
    "busUse": {"errors":[{"line":11,"col":33,"code":"TS2339","msg":"Property 'userId' does not exist on type 'AppEvent'.","more":["Property 'userId' does not exist on type '{ type: \"logout\"; }'."]}]},
    "busMap": {"errors":[{"line":12,"col":23,"code":"TS2339","msg":"Property 'userId' does not exist on type '{ reason: string; }'."}]},
    "emitter": {"errors":[{"line":51,"col":19,"code":"TS2345","msg":"Argument of type 'number' is not assignable to parameter of type '{ userId: string; }'."}],"js":"class Emitter {\n  handlers = new Map();\n\n  on(type, fn) {\n    const set = this.handlers.get(type) ?? new Set();\n    set.add(fn);\n    this.handlers.set(type, set);\n    return () => this.off(type, fn);\n  }\n\n  once(type, fn) {\n    const wrapper = Object.assign(\n      (payload) => {\n        this.off(type, fn);\n        fn(payload);\n      },\n      { original: fn },\n    );\n    return this.on(type, wrapper);\n  }\n\n  off(type, fn) {\n    const set = this.handlers.get(type);\n    if (!set) return;\n    for (const h of set) {\n      if (h === fn || h.original === fn) set.delete(h);\n    }\n    if (set.size === 0) this.handlers.delete(type);\n  }\n\n  emit(type, payload) {\n    for (const h of [...(this.handlers.get(type) ?? [])]) {\n      try {\n        (h)(payload);\n      } catch (error) {\n        console.error(String(error));\n      }\n    }\n  }\n}\n\nconst bus = new Emitter();\nbus.on(\"login\", (p) => p.userId);\nbus.emit(\"login\", { userId: \"u1\" });\nbus.emit(\"login\", 5);","main":{"logs":[],"value":null},"cases":{"twice":{"logs":[],"value":[1,1]},"throws":{"logs":["error: Error: boom"],"value":["b"]},"once":{"logs":[],"value":["g"]},"empty":{"logs":[],"value":[1,0]}}},
    "mergeIface": {"errors":[{"line":3,"col":6,"code":"TS2300","msg":"Duplicate identifier 'B'."},{"line":4,"col":6,"code":"TS2300","msg":"Duplicate identifier 'B'."}]},
  };
  /*FACTS-END*/

  /* ---------- helpers shared by the page and the test ---------- */
  const probeText = (members) => members.join(" | ");
  /* The text that goes to tsc: the shown code, probes added at line ends, then an export and the Eq helper. Lines never move. */
  function compiled(id, extra = {}) {
    const sn = SN[id];
    const lines = sn.ts.split("\n");
    const add = (list, want, tag) => (list || []).forEach(([line, expr, members], k) => {
      lines[line - 1] += ` const ${tag}${k}: Eq<typeof ${expr}, ${probeText(members)}> = ${want};`;
    });
    add(extra.probes || sn.probes, "true", "__p");
    add(extra.wrong, "false", "__w");
    return lines.join("\n") + `\nexport {};\n${EQ_TYPE}\n`;
  }
  const hasProbeLine = (sn) => (sn.probes || []).concat(sn.wrong || []).every(([line]) => !/\/\//.test(sn.ts.split("\n")[line - 1]));
  /* Node's stripper replaces every type with spaces, so each character stays where it was. unblank() removes those blanked
     characters again, so the JavaScript reads normally. The page never strips; it uses FACTS[id].js, and the test checks it. */
  function unblank(orig, stripped) {
    const sl = stripped.split("\n");
    return orig.split("\n").map((ol, k) => {
      const blank = Array.from(ol, (c, i) => sl[k][i] !== c && sl[k][i] === " ");
      let t = "";
      for (let i = 0; i < ol.length; i++) {
        let inside = false; // a real space between two removed pieces, like the one in Map<A, B>
        if (ol[i] === " " && !blank[i]) {
          let a = i - 1, b = i + 1;
          while (a >= 0 && ol[a] === " " && !blank[a]) a--;
          while (b < ol.length && ol[b] === " " && !blank[b]) b++;
          inside = a >= 0 && blank[a] && b < ol.length && blank[b];
        }
        if (!blank[i] && !inside) t += ol[i];
      }
      if (!t.trim()) return "";
      return ol.match(/^ */)[0] + t.trimStart().replace(/(\S) {2,}/g, "$1 ").replace(/(\S) +([);,])/g, "$1$2").replace(/\s+$/, "");
    }).join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
  }

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fmt = (v) => (typeof v === "string" ? v : JSON.stringify(v));
  /* A fake fetch for the loadUsers snippet: ok, a rate limit, a wrong shape, and no network. */
  const FETCH_BODIES = {
    ok: { ok: true, status: 200, body: { users: [{ id: 1, name: "Amal" }, { id: 2, name: "Omar" }] } },
    429: { ok: false, status: 429, body: { error: "rate limited" } },
    shape: { ok: true, status: 200, body: { users: [{ id: 1 }] } },
  };
  const fakeFetch = async (url) => {
    if (url === "offline") throw new TypeError("Failed to fetch");
    const r = FETCH_BODIES[url];
    return { ok: r.ok, status: r.status, json: async () => JSON.parse(JSON.stringify(r.body)) };
  };
  /* Run JavaScript text and capture console.log, the returned value or the error. `call` is an expression run after the code. */
  async function runJs(js, call, opts = {}) {
    const logs = [];
    const cons = { log: (...a) => logs.push(a.map(fmt).join(" ")), error: (...a) => logs.push("error: " + a.map(fmt).join(" ")) };
    try {
      const fn = new AsyncFunction("console", "fetch", `${js}\n${call ? `return (${call});` : ""}`);
      const value = await fn(cons, opts.fetch ? fakeFetch : undefined);
      return { logs, value: value === undefined ? null : value };
    } catch (e) {
      return { logs, error: { name: e && e.name, message: e && e.message } };
    }
  }
  const jsOf = (id) => (FACTS[id] || {}).js || "";
  const runCase = (id, caseId) => {
    const sn = SN[id];
    const c = sn.cases.find((x) => x.id === caseId);
    return runJs(jsOf(id), c.call, { fetch: sn.fetch });
  };
  const runSnippetJs = (id) => runJs(jsOf(id), "", { fetch: SN[id].fetch });
  const errorsOf = (id) => (FACTS[id] || {}).errors || [];
  const tscLine = (e) => `error ${e.code}: ${e.msg}`;

  /* The shown TypeScript, split into the folded helper part and the visible part. */
  const foldOf = (id) => ({ hidden: SN[id].ts.split("\n").slice(0, SN[id].fold).join("\n"), shown: SN[id].ts.split("\n").slice(SN[id].fold).join("\n"), fold: SN[id].fold });

  /* ---------- page 03: the same four server answers, run with the "any" way and the guarded way ---------- */
  const BODIES = [
    { id: "good", label: "A normal answer", text: "{\"users\":[{\"id\":1,\"name\":\"Amal\"},{\"id\":2,\"name\":\"Omar\"}]}" },
    { id: "error", label: "An error answer", text: "{\"error\":\"rate limited\"}" },
    { id: "null", label: "users is null", text: "{\"users\":null}" },
    { id: "wrong", label: "A user with no name", text: "{\"users\":[{\"id\":1}]}" },
  ];

  /* ---------- page 05: the eight combinations of three fields ---------- */
  const SAMPLE_USERS = [{ id: 1, name: "Amal" }];
  function flagRows() {
    const rows = [];
    for (const isLoading of [true, false]) for (const error of [null, { message: "HTTP 429" }]) for (const data of [null, SAMPLE_USERS]) {
      rows.push({ isLoading, error, data, meant: (isLoading && !error && !data) || (!isLoading && !!error && !data) || (!isLoading && !error && !!data) });
    }
    return rows;
  }
  const flagCall = (r) => `render(${JSON.stringify({ isLoading: r.isLoading, error: r.error, data: r.data })})`;
  const flagText = (r) => ({ loading: String(r.isLoading), error: r.error ? "Error(\"HTTP 429\")" : "null", data: r.data ? "[Amal]" : "null" });

  /* ---------- page 04: the runnable. The solution is the TypeScript snippet with its types removed. ---------- */
  const IS_USER_JS = () => jsOf("isUserFn");
  const isUserParts = () => {
    const lines = IS_USER_JS().split("\n");
    return { head: lines[0] + "\n", body: lines.slice(1, -1).join("\n") + "\n", tail: lines[lines.length - 1] + "\n" };
  };
  const SAMPLES = [
    ["a normal user", "{ id: 1, name: \"Amal\" }", true],
    ["an extra field is fine", "{ id: 2, name: \"Omar\", email: \"o@x.com\" }", true],
    ["id is a string", "{ id: \"3\", name: \"Lina\" }", false],
    ["name is missing", "{ id: 4 }", false],
    ["null", "null", false],
    ["an array", "[1, 2]", false],
    ["a string", "\"hello\"", false],
  ];
  const IS_USER_HARNESS = J(
    "// --- the test (don't edit below)",
    "const samples = [",
    ...SAMPLES.map(([label, value, want]) => `  [${JSON.stringify(label)}, ${value}, ${want}],`),
    "];",
    "const rows = samples.map(([label, input, want]) => {",
    "  let got;",
    "  try { got = isUser(input) === true; } catch (e) { got = \"threw \" + e.name; }",
    "  return { label, want, got };",
    "});",
    "// A guard that always says yes, and what the next line then does:",
    "const liar = () => true;",
    "let crash = \"no crash\";",
    "try { const u = JSON.parse('{\"id\":4}'); if (liar(u)) u.name.toUpperCase(); } catch (e) { crash = e.name + \": \" + e.message; }",
    "report(\"isUser\", { rows, crash });", "");
  const isUserCode = (solved) => {
    const p = isUserParts();
    const todo = "  // TODO: return true only for an object (not null) with a number id\n  // and a string name. This starter says yes to everything, so it lies.\n  return true;\n";
    return (solved ? p.head + p.body : p.head + todo) + p.tail + "\n" + IS_USER_HARNESS;
  };
  const isUserChecks = (r) => r.rows.map((x) => ({ label: `${x.label}: ${x.want ? "yes" : "no"}`, ok: x.got === x.want, got: x.got === true ? "your guard said yes" : x.got === false ? "your guard said no" : x.got }));
  async function runRunnable(code) {
    const results = {};
    const logs = [];
    await new AsyncFunction("console", "report", code)({ log: (...a) => logs.push(a.map(fmt).join(" ")) }, (name, data) => { results[name] = data; });
    return { results, logs };
  }

  attachCases();

  /* Excerpts of Mina's Speako code (read only). The test checks every shown line against the file when the file is there. */
  const SPEAKO = { "coerce": { "file": "src/components/floor-plan/adapters/v3Coerce.ts", "parts": [ { "from": 51, "to": 56, "text": "export function coerceV3Shape(raw: unknown): Shape | null {\n  if (!isRecord(raw)) return null;\n  const position = readPoint(raw.position);\n  const size = readSize(raw.size);\n  if (!position || !size) return null;\n  const rotation = asNumber(raw.rotation) ?? 0;" }, { "gap": "  // ... id and zoneId are read the same way" }, { "from": 60, "to": 63, "text": "  switch (raw.kind) {\n    case \"table\": {\n      const shape = normalizeTableShapeKind(raw.shape);\n      if (!shape) return null;" }, { "gap": "      // ... builds a TableShape from raw.capacity, raw.label, ..." }, { "from": 77, "to": 78, "text": "      return table;\n    }" }, { "from": 111, "to": 114, "text": "    default:\n      return null;\n  }\n}" } ] }, "isRecord": { "file": "src/components/floor-plan/adapters/v3Coerce.ts", "parts": [ { "from": 169, "to": 171, "text": "function isRecord(v: unknown): v is Record<string, unknown> {\n  return typeof v === \"object\" && v !== null && !Array.isArray(v);\n}" } ] }, "shape": { "file": "src/components/floor-plan/core/types.ts", "parts": [ { "from": 82, "to": 84, "text": "export interface TableShape extends ShapeBase {\n  kind: \"table\";\n  shape: TableShapeKind;" }, { "gap": "  // ..." }, { "from": 99, "to": 101, "text": "export interface WallShape extends ShapeBase {\n  kind: \"wall\";\n  wallType: WallKind;" }, { "gap": "  // ..." }, { "from": 107, "to": 109, "text": "export interface FixtureShape extends ShapeBase {\n  kind: \"fixture\";\n  fixtureType: FixtureKind;" }, { "gap": "  // ..." }, { "from": 114, "to": 114, "text": "export type Shape = TableShape | WallShape | FixtureShape;" } ] }, "selector": { "file": "src/components/floor-plan/store/selectors.ts", "parts": [ { "from": 18, "to": 22, "text": "export function selectTables(s: FloorPlanState): TableShape[] {\n  return selectShapes(s).filter(\n    (x): x is TableShape => x.kind === \"table\",\n  );\n}" } ] }, "billing": { "file": "src/app/(app)/(dashboard-layout)/dashboard/billing/_components/billing-content.tsx", "parts": [ { "from": 56, "to": 59, "text": "  const [trialModalState, setTrialModalState] = useState<{\n    status: \"loading\" | \"success\" | \"error\" | null;\n    errorMessage?: string;\n  }>({ status: null });" }, { "gap": "  // ... later, in handleActivateTrial:" }, { "from": 230, "to": 233, "text": "      setTrialModalState({\n        status: \"error\",\n        errorMessage: message,\n      });" } ] } };

  /* zod is not in this folder, so the test compiles and runs this one only if it finds zod (Speako's copy). */
  const ZOD = J(
    "import { z } from \"zod\";",
    "",
    "const UserSchema = z.object({ id: z.number(), name: z.string() });",
    "const ReplySchema = z.object({ users: z.array(UserSchema) });",
    "type Reply = z.infer<typeof ReplySchema>;",
    "",
    "function parseReply(text: string): Reply | null {",
    "  try {",
    "    const result = ReplySchema.safeParse(JSON.parse(text));",
    "    return result.success ? result.data : null;",
    "  } catch {",
    "    return null; // JSON.parse throws on text that is not JSON",
    "  }",
    "}");

  return {
    SPEAKO, TSC_VERSION, EQ_TYPE, SN, FACTS, VALUE, FILM_STOPS, PREDICT, ZOD, BODIES, EX_CALLS, FETCH_BODIES, SAMPLES,
    compiled, hasProbeLine, unblank, runJs, runCase, runSnippetJs, jsOf, errorsOf, tscLine, foldOf, fakeFetch, probeText, exhaustive,
    flagRows, flagCall, flagText, isUserCode, isUserChecks, runRunnable, isUserParts, J,
  };
});
