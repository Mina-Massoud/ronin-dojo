/* Data and small models for "Generics and utility types" (the single source of truth for this lesson).
   Every TypeScript snippet the page shows is in SNIPS. dev/ts-generics.test.js compiles ALL of them with the real tsc
   (TypeScript 7) and checks the exact errors listed here, every inferred type claim (`types`), the film, the mapped-type
   and infer models, and the runtime output of every snippet that has a `js` version (types removed).
   Works in the browser (Book.parts["ts-generics"].data) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["ts-generics"] = root.Book.parts["ts-generics"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TSC_VERSION = "7.0.2";
  /* A type test: true only when A and B are exactly the same type. Used by the tests (and shown once on the page). */
  const EQUALS = "type Equals<A, B> =\n  (<X>() => X extends A ? 1 : 2) extends\n  (<X>() => X extends B ? 1 : 2) ? true : false;";
  const E = (line, code, msg, hidden) => ({ line, code, msg, hidden: Boolean(hidden) }); // hidden: from a test-only line, not shown on the page
  /* S(code, extra): code is what the reader sees. js = the same code with the types removed (the test compares it to Node's own type stripper).
     errors = the exact errors tsc reports (first line of each message). types = claims checked with Equals. tail = hidden, test-only lines. */
  const S = (code, o = {}) => ({ code: code.replace(/^\n/, "").replace(/\s+$/, ""), errors: [], types: [], ...o });
  const U3 = "type User = { id: string; name: string; age: number };";
  const FIRST = "function first<T>(xs: T[]): T | undefined {\n  return xs[0];\n}\n\n";

  /* ---------- 1. Snippets: compiled by the real tsc in the test ---------- */
  const SNIPS = {
    anyBad: S(`function firstAny(xs: any[]): any {
  return xs[0];
}

const n = firstAny([1, 2, 3]);
n.toUpperCase();`, {
      js: "function firstAny(xs) {\n  return xs[0];\n}\n\nconst n = firstAny([1, 2, 3]);\nn.toUpperCase();",
      error: { name: "TypeError", text: /toUpperCase is not a function/ },
    }),
    genericBad: S(FIRST + `const n = first([1, 2, 3]);
n.toUpperCase();`, {
      js: "function first(xs) {\n  return xs[0];\n}\n\nconst n = first([1, 2, 3]);\nn.toUpperCase();",
      errors: [E(6, "TS18048", "'n' is possibly 'undefined'."), E(6, "TS2339", "Property 'toUpperCase' does not exist on type 'number'.")],
      types: [{ of: "n", is: "number | undefined" }],
      error: { name: "TypeError", text: /toUpperCase is not a function/ },
    }),
    infer: S(FIRST + `const a = first([1, 2]);
const b = first(["x", "y"]);
const c = first([1, "x"]);
const d = first([]);
const e = first<string>([42]);`, {
      errors: [E(9, "TS2322", "Type 'number' is not assignable to type 'string'.")],
      types: [{ of: "a", is: "number | undefined" }, { of: "b", is: "string | undefined" }, { of: "c", is: "string | number | undefined" }, { of: "d", is: "undefined" }, { of: "e", is: "string | undefined" }],
      /* hidden claims: with an empty list, T has nothing to be, so it is never; a literal array has the type we say */
      tail: "declare function tOf<T>(xs: T[]): { t: T };\nconst __t = tOf([]);\nconst __arr = [1, 2];\nconst __arr2 = [\"a\", \"b\"];",
      tailTypes: [{ of: "__t", is: "{ t: never }" }, { of: "__arr", is: "number[]" }, { of: "__arr2", is: "string[]" }],
    }),
    noRule: S(`function byId<T>(items: T[], id: string): T | undefined {
  return items.find((i) => i.id === id);
}`, { errors: [E(2, "TS2339", "Property 'id' does not exist on type 'T'.")] }),
    rule: S(`type User = { id: string; name: string };

function byId<T extends { id: string }>(
  items: T[],
  id: string,
): T | undefined {
  return items.find((i) => i.id === id);
}

declare const users: User[];
declare const nums: number[];

const u = byId(users, "u1");
byId(nums, "u1");
byId([{ id: "1", extra: 5 }], "1");`, {
      errors: [E(14, "TS2345", "Argument of type 'number[]' is not assignable to parameter of type '{ id: string; }[]'.")],
      types: [{ of: "u", is: "User | undefined" }],
      tail: "const __e = byId([{ id: \"1\", extra: 5 }], \"1\");",
      tailTypes: [{ of: "__e", is: "{ id: string; extra: number } | undefined" }],
    }),
    loose: S(`type User = { id: string; name: string };

function byIdLoose(
  items: { id: string }[],
  id: string,
): { id: string } | undefined {
  return items.find((i) => i.id === id);
}

declare const users: User[];

const u = byIdLoose(users, "u1");
u?.name;`, {
      errors: [E(13, "TS2339", "Property 'name' does not exist on type '{ id: string; }'.")],
      types: [{ of: "u", is: "{ id: string } | undefined" }],
    }),
    keyofLab: S(`type User = { id: string; name: string; age: number };

type Keys = keyof User;
type NameType = User["name"];

function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

declare const user: User;
const age = getProp(user, "age");
getProp(user, "nme");`, {
      errors: [E(12, "TS2345", "Argument of type '\"nme\"' is not assignable to parameter of type 'keyof User'.")],
      types: [{ type: "Keys", is: "\"id\" | \"name\" | \"age\"" }, { type: "NameType", is: "string" }, { of: "age", is: "number" }],
    }),
    pair: S(`function pair<T>(a: T, b: T): T[] {
  return [a, b];
}

const p = pair(1, "x");`, { errors: [E(5, "TS2345", "Argument of type 'string' is not assignable to parameter of type 'number'.")] }),
    busLimits: S(`declare class EventBus<Events extends Record<string, unknown>> {
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
}

interface WithInterface { login: { userId: string } }
type WithType = { login: { userId: string }; ping: void };

declare const a: EventBus<WithInterface>;
declare const b: EventBus<WithType>;
b.emit("ping");`, { errors: [E(8, "TS2344", "Type 'WithInterface' does not satisfy the constraint 'Record<string, unknown>'."), E(10, "TS2554", "Expected 2 arguments, but got 1.")] }),
    isString: S(`type IsString<T> = T extends string ? "yes" : "no";

type A = IsString<"hi">;
type B = IsString<42>;`, { types: [{ type: "A", is: "\"yes\"" }, { type: "B", is: "\"no\"" }] }),
    myReturn: S(`type MyReturnType<F> =
  F extends (...args: any[]) => infer R ? R : never;

type Fn = (id: string) => Promise<User>;
type R = MyReturnType<Fn>;
type Unwrapped = Awaited<R>;`, {
      tail: "type User = { id: string; name: string };",
      types: [{ type: "R", is: "Promise<User>" }, { type: "Unwrapped", is: "User" }],
    }),
    returnBuiltin: S(`type Oops = ReturnType<string>;`, { errors: [E(1, "TS2344", "Type 'string' does not satisfy the constraint '(...args: any) => any'.")] }),
    partialWrong: S(`type NotPartial<T> = { [K in keyof T]: T[K] | undefined };`, {
      tail: `${U3}\nconst __q: Equals<NotPartial<User>, Partial<User>> = false;\nconst __r: Equals<NotPartial<User>, { id: string | undefined; name: string | undefined; age: number | undefined }> = true;`,
    }),
    /* puzzles */
    puz1: S("type Keys = keyof { [k: string]: 1 };", { types: [{ type: "Keys", is: "string | number" }] }),
    puz2: S(`type User = { id: string; name: string; age: number };

type A = Omit<User, "id">;
type B = Pick<User, "id">;`, { types: [{ type: "A", is: "{ name: string; age: number }" }, { type: "B", is: "{ id: string }" }] }),
    puz3: S(`type ToArray<T> = T extends unknown ? T[] : never;
type A = ToArray<string | number>;

type Wrapped<T> = [T] extends [unknown] ? T[] : never;
type B = Wrapped<string | number>;`, { types: [{ type: "A", is: "string[] | number[]" }, { type: "B", is: "(string | number)[]" }] }),
    puz4: S(`type Dog = { kind: "dog"; bark: true; id: string };
type Cat = { kind: "cat"; meow: true; id: string };

type NoId = Omit<Dog | Cat, "id">;

type DistOmit<T, K extends PropertyKey> =
  T extends unknown ? Omit<T, K> : never;
type Better = DistOmit<Dog | Cat, "id">;`, {
      types: [{ type: "NoId", is: "{ kind: \"dog\" | \"cat\" }" }, { type: "Better", is: "Omit<Dog, \"id\"> | Omit<Cat, \"id\">" }],
    }),
    /* groupBy */
    groupBy: S(`type User = { id: string; name: string; role: "admin" | "member" };

function groupBy<T, K extends PropertyKey>(
  items: T[],
  getKey: (item: T) => K,
): Partial<Record<K, T[]>> {
  const groups: Partial<Record<K, T[]>> = {};
  for (const item of items) {
    const key = getKey(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}

declare const users: User[];

const byRole = groupBy(users, (u) => u.role);
const byLength = groupBy(users, (u) => u.name.length);
groupBy(users, (u) => ({ x: u }));`, {
      errors: [E(19, "TS2322", "Type '{ x: User; }' is not assignable to type 'PropertyKey'.")],
      types: [{ of: "byRole", is: "Partial<Record<\"admin\" | \"member\", User[]>>" }, { of: "byLength", is: "Partial<Record<number, User[]>>" }],
      tail: "const __m = byRole.member;\ndeclare function groupByLie<T, K extends PropertyKey>(items: T[], getKey: (item: T) => K): Record<K, T[]>;\nconst __lie = groupByLie(users, (u) => u.role).member;",
      tailTypes: [{ of: "__m", is: "User[] | undefined" }, { of: "__lie", is: "User[]" }],
    }),
    /* From your work / on the job */
    trustMe: S(`type User = { id: string; fullName: string };

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json();
}

async function main() {
  const user = await get<User>("/api/users/1");
  console.log(user.fullName.toUpperCase());
}
main().catch((error) => console.log(String(error)));`, {
      js: "async function get(url) {\n  const res = await fetch(url);\n  return res.json();\n}\n\nasync function main() {\n  const user = await get(\"/api/users/1\");\n  console.log(user.fullName.toUpperCase());\n}\nmain().catch((error) => console.log(String(error)));",
      out: ["TypeError: Cannot read properties of undefined (reading 'toUpperCase')"],
    }),
    parsed: S(`type User = { id: string; fullName: string };

function parseUser(data: unknown): User {
  if (typeof data !== "object" || data === null) {
    throw new Error("User: expected an object");
  }
  const { id, fullName } = data as Record<string, unknown>;
  if (typeof id !== "string") throw new Error("User.id: expected a string");
  if (typeof fullName !== "string") {
    throw new Error("User.fullName: expected a string");
  }
  return { id, fullName };
}

async function get<T>(
  url: string,
  parse: (data: unknown) => T,
): Promise<T> {
  const res = await fetch(url);
  return parse(await res.json());
}

async function main() {
  const user = await get("/api/users/1", parseUser);
  console.log(user.fullName.toUpperCase());
}
main().catch((error) => console.log(String(error)));`, {
      js: "function parseUser(data) {\n  if (typeof data !== \"object\" || data === null) {\n    throw new Error(\"User: expected an object\");\n  }\n  const { id, fullName } = data;\n  if (typeof id !== \"string\") throw new Error(\"User.id: expected a string\");\n  if (typeof fullName !== \"string\") {\n    throw new Error(\"User.fullName: expected a string\");\n  }\n  return { id, fullName };\n}\n\nasync function get(url, parse) {\n  const res = await fetch(url);\n  return parse(await res.json());\n}\n\nasync function main() {\n  const user = await get(\"/api/users/1\", parseUser);\n  console.log(user.fullName.toUpperCase());\n}\nmain().catch((error) => console.log(String(error)));",
      out: ["Error: User.fullName: expected a string"],
      types: [{ of: "__g", is: "Promise<User>" }],
      tail: "const __g = get(\"/api/users/1\", parseUser);",
    }),
    renamed: S(`type User = { id: string; name: string }; // the new API shape

async function show(user: User) {
  return user.fullName.toUpperCase();
}`, { errors: [E(4, "TS2339", "Property 'fullName' does not exist on type 'User'.")] }),
    typeTest: S(`type User = { id: string; fullName: string };
declare function parseUser(data: unknown): User;
declare function get<T>(
  url: string,
  parse: (data: unknown) => T,
): Promise<T>;

type Expect<T extends true> = T;
type Equals<A, B> =
  (<X>() => X extends A ? 1 : 2) extends
  (<X>() => X extends B ? 1 : 2) ? true : false;

const getUser = (id: string) => get("/api/users/" + id, parseUser);

type Test1 = Expect<Equals<Awaited<ReturnType<typeof getUser>>, User>>;
type Test2 = Expect<Equals<Awaited<ReturnType<typeof getUser>>, { id: string }>>;`, {
      errors: [E(16, "TS2344", "Type 'false' does not satisfy the constraint 'true'.")],
      /* this snippet declares Equals itself, so the test must not add a second one */
      ownEquals: true,
    }),
    /* Hub-spoke examples (each card). `User` is defined once above the hub (HUB_PRE) and is added to the test only. */
    hubPartial: S("type Patch = Partial<User>;", { types: [{ type: "Patch", is: "{ id?: string; name?: string; email?: string }" }], tail: "type __N = Equals<Partial<{ a: { b: 1 } }>, { a?: { b: 1 } }>;\nconst __n: __N = true;\ntype __P = Partial<Omit<User, \"id\">>;" }),
    hubRequired: S("type Full = Required<User>;", { types: [{ type: "Full", is: "{ id: string; name: string; email: string }" }], tail: "const __k: Equals<Required<{ a: string | undefined }>, { a: string | undefined }> = true;" }),
    hubReadonly: S(`const user: Readonly<User> = { id: "1", name: "Ana" };
user.name = "Ben";
console.log(user.name);`, { js: "const user = { id: \"1\", name: \"Ana\" };\nuser.name = \"Ben\";\nconsole.log(user.name);", out: ["Ben"], tail: "const __ro: Readonly<{ a: { b: number } }> = { a: { b: 1 } };\n__ro.a.b = 2;", errors: [E(2, "TS2540", "Cannot assign to 'name' because it is a read-only property.")] }),
    hubPick: S(`type Card = Pick<User, "id" | "name">;
type Oops = Pick<User, "nme">;`, { types: [{ type: "Card", is: "{ id: string; name: string }" }], errors: [E(2, "TS2344", "Type '\"nme\"' does not satisfy the constraint 'keyof User'.")] }),
    hubOmit: S(`type NoId = Omit<User, "id">;
type Same = Omit<User, "nme">;`, { types: [{ type: "NoId", is: "{ name: string; email?: string }" }, { type: "Same", is: "User" }] }),
    hubRecord: S("type Prices = Record<\"small\" | \"large\", number>;", { types: [{ type: "Prices", is: "{ small: number; large: number }" }], tail: "declare const __r: Record<string, number>;\nconst __v = __r[\"x\"];\nconst __rec: Record<\"small\" | \"large\", number> = { small: 1 };", tailTypes: [{ of: "__v", is: "number" }], errors: [E(5, "TS2741", "Property 'large' is missing in type '{ small: number; }' but required in type 'Record<\"large\" | \"small\", number>'.", true)] }),
    hubReturn: S(`function getUser() {
  return { id: "1", name: "Ana" };
}
type Loaded = ReturnType<typeof getUser>;
type Bad = ReturnType<getUser>;`, { types: [{ type: "Loaded", is: "{ id: string; name: string }" }], errors: [E(5, "TS2749", "'getUser' refers to a value, but is being used as a type here. Did you mean 'typeof getUser'?")] }),
    hubParams: S(`function send(to: string, retries: number) {}
type Args = Parameters<typeof send>;
type First = Args[0];`, { types: [{ type: "Args", is: "[to: string, retries: number]" }, { type: "First", is: "string" }] }),
    hubAwaited: S(`declare function fetchUser(): Promise<User>;
type Loaded = Awaited<ReturnType<typeof fetchUser>>;
type Deep = Awaited<Promise<Promise<string>>>;`, { types: [{ type: "Loaded", is: "User" }, { type: "Deep", is: "string" }] }),
    hubNonNull: S("type Name = NonNullable<string | null | undefined>;", { types: [{ type: "Name", is: "string" }] }),
    hubExtract: S(`type Status = "idle" | "loading" | "error";
type Busy = Exclude<Status, "idle">;
type Quiet = Extract<Status, "idle" | "other">;`, { types: [{ type: "Busy", is: "\"loading\" | \"error\"" }, { type: "Quiet", is: "\"idle\"" }] }),
    /* Interview answers */
    eventBus: S(`type Handler<P> = (payload: P) => void;

class EventBus<Events extends Record<string, unknown>> {
  #handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  on<K extends keyof Events>(
    type: K,
    handler: Handler<Events[K]>,
  ): () => void {
    const list = (this.#handlers[type] ??= []);
    list.push(handler);
    return () => {
      this.#handlers[type] = this.#handlers[type]?.filter((h) => h !== handler);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    for (const handler of this.#handlers[type] ?? []) handler(payload);
  }
}

type AppEvents = {
  login: { userId: string };
  cartChanged: { count: number };
};

const bus = new EventBus<AppEvents>();
const off = bus.on("login", (e) => console.log("hello", e.userId));
bus.emit("login", { userId: "u1" });
off();
bus.emit("login", { userId: "u2" });
bus.emit("login", { userid: "u1" });
bus.emit("logn", { userId: "u1" });
bus.on("cartChanged", (e) => e.userId);`, {
      js: "class EventBus {\n  #handlers = {};\n\n  on(type, handler) {\n    const list = (this.#handlers[type] ??= []);\n    list.push(handler);\n    return () => {\n      this.#handlers[type] = this.#handlers[type]?.filter((h) => h !== handler);\n    };\n  }\n\n  emit(type, payload) {\n    for (const handler of this.#handlers[type] ?? []) handler(payload);\n  }\n}\n\nconst bus = new EventBus();\nconst off = bus.on(\"login\", (e) => console.log(\"hello\", e.userId));\nbus.emit(\"login\", { userId: \"u1\" });\noff();\nbus.emit(\"login\", { userId: \"u2\" });\nbus.emit(\"login\", { userid: \"u1\" });\nbus.emit(\"logn\", { userId: \"u1\" });\nbus.on(\"cartChanged\", (e) => e.userId);",
      out: ["hello u1"],
      errors: [
        E(32, "TS2561","Object literal may only specify known properties, but 'userid' does not exist in type '{ userId: string; }'. Did you mean to write 'userId'?"),
        E(33, "TS2345", "Argument of type '\"logn\"' is not assignable to parameter of type 'keyof AppEvents'."),
        E(34, "TS2339","Property 'userId' does not exist on type '{ count: number; }'."),
      ],
    }),
    fluentOk: S(`class Rect {
  x = 0;
  y = 0;
  width = 0;
  height = 0;

  move(dx: number, dy: number): this {
    this.x += dx;
    this.y += dy;
    return this;
  }
  resize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }
}

class Square extends Rect {
  side(n: number): this {
    return this.resize(n, n);
  }
}

const s = new Square().move(1, 2).side(5);
console.log(JSON.stringify(s));`, {
      js: "class Rect {\n  x = 0;\n  y = 0;\n  width = 0;\n  height = 0;\n\n  move(dx, dy) {\n    this.x += dx;\n    this.y += dy;\n    return this;\n  }\n  resize(width, height) {\n    this.width = width;\n    this.height = height;\n    return this;\n  }\n}\n\nclass Square extends Rect {\n  side(n) {\n    return this.resize(n, n);\n  }\n}\n\nconst s = new Square().move(1, 2).side(5);\nconsole.log(JSON.stringify(s));",
      out: ["{\"x\":1,\"y\":2,\"width\":5,\"height\":5}"],
      types: [{ of: "s", is: "Square" }],
    }),
    fluentLoose: S(`class Rect {
  x = 0;
  move(dx: number): Rect {
    this.x += dx;
    return this;
  }
}

class Square extends Rect {
  side(n: number): Square {
    return this;
  }
}

new Square().move(1).side(2);`, { errors: [E(15, "TS2339", "Property 'side' does not exist on type 'Rect'.")] }),
    pickFn: S(`function pick<T, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = obj[key];
  return out;
}

type User = { id: string; name: string };
declare const user: User;

const small = pick(user, ["id"]);
pick(user, ["nme"]);`, { errors: [E(14, "TS2820", "Type '\"nme\"' is not assignable to type 'keyof User'. Did you mean '\"name\"'?")], types: [{ of: "small", is: "Pick<User, \"id\">" }] }),
    unwrap: S(`type Unwrap<T> = T extends Promise<infer U> ? U : T;

type A = Unwrap<Promise<string>>;
type B = Unwrap<Promise<Promise<string>>>;
type C = Awaited<Promise<Promise<string>>>;`, { types: [{ type: "A", is: "string" }, { type: "B", is: "Promise<string>" }, { type: "C", is: "string" }] }),
    newT: S(`function makeBad<T>(): T {
  return new T();
}

function make<T>(ctor: new () => T): T {
  return new ctor();
}

class Dog {}
const dog = make(Dog);`, { errors: [E(2, "TS2693", "'T' only refers to a type, but is being used as a value here.")], types: [{ of: "dog", is: "Dog" }] }),
    ticketAny: S(`async function get(url: string): Promise<any> {
  const res = await fetch(url);
  return res.json();
}

async function showName() {
  const user = await get("/api/users/1");
  return user.fullName.toUpperCase();
}
showName().catch((error) => console.log(String(error)));`, {
      js: "async function get(url) {\n  const res = await fetch(url);\n  return res.json();\n}\n\nasync function showName() {\n  const user = await get(\"/api/users/1\");\n  return user.fullName.toUpperCase();\n}\nshowName().catch((error) => console.log(String(error)));",
      out: ["TypeError: Cannot read properties of undefined (reading 'toUpperCase')"],
    }),
    patch: S(`type User = { id: string; name: string; email?: string };
type UserPatch = Partial<Omit<User, "id">>;`, { types: [{ type: "UserPatch", is: "{ name?: string; email?: string }" }] }),
  };
  /* Excerpts of Speako (read-only). The test compares every line with the real file when the project is found. */
  const SPEAKO = {
    root: "C:/Projects/JOBS/Speako/speako-web/",
    http: {
      file: "src/lib/api/http.ts", ranges: [[52, 69], [71, 74]],
      text: [
        "async function request<T>(\n  method: \"get\" | \"post\" | \"put\" | \"patch\" | \"delete\",\n  url: string,\n  config: HttpRequestConfig & { data?: unknown } = {}\n): Promise<T> {\n  assertDefinedPath(url);\n  const { data, params, ...rest } = config;\n  scrubParams(params as Record<string, unknown> | undefined);\n\n  const response = await apiAxios.request<T>({\n    method,\n    url,\n    data,\n    params,\n    ...rest,\n  });\n  return response.data;\n}",
        "export const http = {\n  get<T>(url: string, config: HttpRequestConfig = {}): Promise<T> {\n    return request<T>(\"get\", url, config);\n  },",
      ],
    },
    ctrl: {
      file: "src/hooks/use-controlled-state.tsx", ranges: [[3, 13]],
      text: ["interface CommonControlledStateProps<T> {\n  value?: T;\n  defaultValue?: T;\n}\n\n// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport function useControlledState<T, Rest extends any[] = []>(\n  props: CommonControlledStateProps<T> & {\n    onChange?: (value: T, ...args: Rest) => void;\n  },\n): readonly [T, (next: T, ...args: Rest) => void] {"],
    },
  };
  /* Shared first lines used by the hub cards in the test only. */
  const HUB_PRE = "type User = { id: string; name: string; email?: string };";
  const HUB_IDS = ["hubPartial", "hubRequired", "hubReadonly", "hubPick", "hubOmit", "hubRecord", "hubReturn", "hubParams", "hubAwaited", "hubNonNull", "hubExtract"];
  /* A second tsc run uses this flag, to check the Record note on the hub page. */
  const FLAG_SNIP = { code: "declare const prices: Record<string, number>;\nconst p = prices[\"x\"];", types: [{ of: "p", is: "number | undefined" }], flag: "--noUncheckedIndexedAccess" };

  /* ---------- 2. The film: a type flows through a generic ---------- */
  const FN = {
    first: { code: FIRST.trim(), param: "T[]", ret: "T | undefined" },
    identity: { code: "function identity<T>(x: T): T {\n  return x;\n}", param: "T", ret: "T" },
    byId: { code: "function byId<T extends { id: string }>(\n  items: T[],\n  id: string,\n): T | undefined {\n  return items.find((i) => i.id === id);\n}", param: "T[]", ret: "T | undefined", need: { id: "string" } },
  };
  const FILM_DECLS = "type User = { id: string; name: string };\ndeclare const users: User[];\ndeclare const nums: number[];\nconst age: number = 30;";
  const SHAPES = { User: { id: "string", name: "string" }, number: {} };
  /* Scenes are chapters or steps of the film. chapter = a new chapter starts here. */
  const SCENES = [
    { fn: "first", chapter: "T is a blank" },
    { fn: "first", chapter: "T becomes number", call: "first([1, 2])", arg: "number[]" },
    { fn: "first", chapter: "The same function, a new type", call: "first([\"a\", \"b\"])", arg: "string[]" },
    { fn: "identity", chapter: "The result follows the input", call: "identity(age)", arg: "number" },
    { fn: "byId", chapter: "A rule for T", call: "byId(users, \"u1\")", arg: "User[]" },
    { fn: "byId", call: "byId(nums, \"u1\")", arg: "number[]", errorCode: "TS2345", error: "Argument of type 'number[]' is not assignable to parameter of type '{ id: string; }[]'." },
  ];
  /* The mini matcher: T[] against number[] gives T = number. */
  function unify(pattern, arg) {
    if (pattern === "T") return arg;
    if (pattern === "T[]" && arg.endsWith("[]")) { const t = arg.slice(0, -2); return t.startsWith("(") && t.endsWith(")") ? t.slice(1, -1) : t; }
    return null;
  }
  const subst = (pattern, T) => pattern.replace(/\bT\b/g, T);
  const fits = (T, need) => !need || Object.entries(need).every(([k, v]) => (SHAPES[T] || {})[k] === v);
  /* Everything a scene shows is computed here; the test checks T, the result and the rule against tsc. */
  const scenes = SCENES.map((s) => {
    const fn = FN[s.fn];
    if (!s.call) return { ...s, fn: s.fn, code: fn.code, T: null };
    const T = unify(fn.param, s.arg);
    const ok = fits(T, fn.need);
    return { ...s, code: fn.code, T, ok, result: ok ? subst(fn.ret, T) : null, need: fn.need ? "id: string" : null };
  });
  const CUES = [
    ["`T` is a blank for a type. Each call fills it in."],
    ["You call `first([1, 2])`. The argument has type `number[]`.", "`T[]` must match `number[]`, so `T` is `number`.", "Now every `T` means `number`. The result is `number | undefined`."],
    ["A new call: `first([\"a\", \"b\"])`. The argument is a `string[]`.", "Same function, but now `T` is `string`.", "So the result is `string | undefined`."],
    ["`identity(age)` gives back what it gets. `age` is a `number`.", "`T` is `number`, and the result is `T`, so it is `number`."],
    ["`byId` has a rule: `T` must have `id: string`. `users` is a `User[]`.", "`User` has `id: string`, so the rule passes. The result is `User | undefined`."],
    ["Now `nums`, a `number[]`. `number` has no `id`, so it breaks the rule.", "TypeScript then checks `number[]` against `{ id: string }[]`. This is its real message."],
  ];

  /* ---------- 3. Mapped types: a tiny model of what the loop builds ---------- */
  const USER_ROWS = [["id", "string"], ["name", "string"], ["age", "number"]];
  function mapRows(rows, o = {}) {
    return rows.filter(([k]) => !o.keep || o.keep.includes(k)).map(([k, t]) => ({ key: k, type: t, text: `${o.readonly ? "readonly " : ""}${k}${o.optional ? "?" : ""}: ${t}` }));
  }
  const rowsText = (rs) => `{ ${rs.map((r) => r.text).join("; ")} }`;
  const MAPPED = {
    copy: { name: "Copy", builtin: null, o: {}, src: "type Copy<T> = {\n  [K in keyof T]: T[K];\n};" },
    partial: { name: "MyPartial", builtin: "Partial", o: { optional: true }, src: "type MyPartial<T> = {\n  [K in keyof T]?: T[K];\n};" },
    readonly: { name: "MyReadonly", builtin: "Readonly", o: { readonly: true }, src: "type MyReadonly<T> = {\n  readonly [K in keyof T]: T[K];\n};" },
    pick: { name: "MyPick", builtin: "Pick", o: {}, src: "type MyPick<T, K extends keyof T> = {\n  [P in K]: T[P];\n};" },
  };
  const subsets = (keys) => keys.reduce((acc, k) => acc.concat(acc.map((s) => [...s, k])), [[]]).filter((s) => s.length);

  /* ---------- 4. infer: a tiny model of what ReturnType catches ---------- */
  const FN_TYPES = ["(id: string) => Promise<User>", "() => void", "(a: number, b: number) => number", "() => string[]", "string"];
  function inferReturn(t) {
    if (t[0] !== "(") return null;
    let depth = 0;
    let i = 0;
    for (; i < t.length; i++) { if (t[i] === "(") depth++; else if (t[i] === ")" && --depth === 0) break; }
    const rest = t.slice(i + 1);
    return rest.startsWith(" => ") ? { params: t.slice(0, i + 1), arrow: " => ", ret: rest.slice(4) } : null;
  }

  /* ---------- 5. The groupBy runnable (types removed so a browser can run it) ---------- */
  const GROUP_TS = SNIPS.groupBy.code.split("\n\ndeclare")[0].split("\n").slice(2).join("\n"); // the function only
  const GROUP_JS = "function groupBy(items, getKey) {\n  const groups = {};\n  for (const item of items) {\n    const key = getKey(item);\n    (groups[key] ??= []).push(item);\n  }\n  return groups;\n}";
  const GROUP_STARTER = "function groupBy(items, getKey) {\n  const groups = {};\n  for (const item of items) {\n    // TODO: ask getKey for this item's key.\n    // If groups has no list for that key yet, make one.\n    // Then push the item into the list.\n  }\n  return groups;\n}";
  const GROUP_HARNESS = `// --- the test (don't edit below)
const users = [
  { id: "1", name: "Ana", role: "admin" },
  { id: "2", name: "Ben", role: "member" },
  { id: "3", name: "Cy", role: "admin" },
];
const byRole = groupBy(users, (u) => u.role);
const byLength = groupBy(users, (u) => u.name.length);
const attempt = (f) => { try { return f(); } catch (e) { return "error"; } };
report("groupBy", {
  roles: Object.keys(byRole),
  admins: (byRole.admin || []).map((u) => u.name),
  members: (byRole.member || []).map((u) => u.name),
  lengths: Object.keys(byLength),
  three: (byLength[3] || []).map((u) => u.name),
  empty: attempt(() => Object.keys(groupBy([], (x) => x)).length),
  noAdmins: attempt(() => "admin" in groupBy([users[1]], (u) => u.role)),
});`;
  const GROUP_CHECKS = (r) => [
    { label: "one list per role", ok: JSON.stringify(r.roles) === JSON.stringify(["admin", "member"]), got: JSON.stringify(r.roles) },
    { label: "the order inside a list is kept", ok: JSON.stringify(r.admins) === JSON.stringify(["Ana", "Cy"]) && JSON.stringify(r.members) === JSON.stringify(["Ben"]), got: JSON.stringify({ admin: r.admins, member: r.members }) },
    { label: "numbers work as keys too", ok: JSON.stringify(r.lengths) === JSON.stringify(["2", "3"]) && JSON.stringify(r.three) === JSON.stringify(["Ana", "Ben"]), got: JSON.stringify(r.lengths) },
    { label: "an empty list gives an empty object", ok: r.empty === 0, got: String(r.empty) + " keys" },
    { label: "a role nobody has is missing (not an empty list)", ok: r.noAdmins === false, got: String(r.noAdmins) },
  ];
  const groupCode = (solved) => `${solved ? GROUP_JS : GROUP_STARTER}\n\n${GROUP_HARNESS}\n`;

  /* ---------- 6. Running JS (types removed): the same in the page and in Node ---------- */
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  /* The fake server for the API client demos: the API renamed fullName to name. */
  const fakeFetch = () => Promise.resolve({ json: () => Promise.resolve({ id: "1", name: "Ana" }) });
  const fmtArg = (a) => (typeof a === "string" ? a : JSON.stringify(a));
  async function runJs(code, wait = 30) {
    const logs = [];
    let error = null;
    try { await new AsyncFn("console", "fetch", code)({ log: (...a) => logs.push(a.map(fmtArg).join(" ")) }, fakeFetch); } catch (e) { error = { name: e.name, message: e.message }; }
    await new Promise((r) => setTimeout(r, wait));
    return { logs, error };
  }
  async function runRunnable(code) {
    const results = {};
    const logs = [];
    await new AsyncFn("console", "report", code)({ log: (...a) => logs.push(a.map(fmtArg).join(" ")) }, (name, data) => { results[name] = data; });
    return { results, logs };
  }

  /* ---------- 7. Source assembly for the compiler (used by the test) ---------- */
  function probes(list, prefix) {
    return (list || []).map((t, i) => `const ${prefix}${i}: Equals<${t.of ? "typeof " + t.of : t.type}, ${t.is}> = true;`).join("\n");
  }
  function fullSource(id) {
    const s = SNIPS[id];
    const post = HUB_IDS.includes(id) ? HUB_PRE + "\n" : "";
    return `${s.code}\n${post}${s.tail ? s.tail + "\n" : ""}${probes(s.types, "__p")}\n${probes(s.tailTypes, "__q")}\n${s.ownEquals ? "" : EQUALS + "\n"}export {};\n`;
  }
  /* The first claim about the film: every scene's T and result, as code. */
  function filmSource() {
    const used = [...new Set(scenes.map((s) => s.fn))];
    const lines = [FILM_DECLS, ...used.map((f) => FN[f].code)];
    const checks = [];
    scenes.forEach((s, i) => {
      if (!s.call) return;
      if (s.ok) { lines.push(`const r${i} = ${s.call};`); checks.push(`const c${i}: Equals<typeof r${i}, ${s.result}> = true;`); } else lines.push(`${s.call};`);
    });
    lines.push("const argA = [1, 2];\nconst argB = [\"a\", \"b\"];\nconst c_argA: Equals<typeof argA, number[]> = true;\nconst c_argB: Equals<typeof argB, string[]> = true;");
    return [...lines, ...checks, EQUALS, "export {};"].join("\n") + "\n";
  }
  function mappedSource() {
    const out = [U3, EQUALS];
    const lines = [];
    const M = (id) => MAPPED[id];
    lines.push(M("copy").src, `const k0: Equals<Copy<User>, User> = true;`, `const k1: Equals<Copy<User>, ${rowsText(mapRows(USER_ROWS, M("copy").o))}> = true;`);
    for (const id of ["partial", "readonly"]) lines.push(M(id).src, `const ${id}A: Equals<${M(id).name}<User>, ${M(id).builtin}<User>> = true;`, `const ${id}B: Equals<${M(id).name}<User>, ${rowsText(mapRows(USER_ROWS, M(id).o))}> = true;`);
    lines.push(M("pick").src);
    subsets(USER_ROWS.map((r) => r[0])).forEach((ks, i) => {
      const u = ks.map((k) => `"${k}"`).join(" | ");
      lines.push(`const pickA${i}: Equals<MyPick<User, ${u}>, Pick<User, ${u}>> = true;`, `const pickB${i}: Equals<MyPick<User, ${u}>, ${rowsText(mapRows(USER_ROWS, { keep: ks }))}> = true;`);
    });
    return [...out, ...lines, "export {};"].join("\n") + "\n";
  }
  function inferSource() {
    const lines = ["type User = { id: string; name: string };", EQUALS, SNIPS.myReturn.code.split("\n\n")[0]];
    FN_TYPES.forEach((t, i) => {
      const r = inferReturn(t);
      lines.push(`type F${i} = ${t};`, `const i${i}: Equals<MyReturnType<F${i}>, ${r ? r.ret : "never"}> = true;`);
      if (r) lines.push(`const j${i}: Equals<MyReturnType<F${i}>, ReturnType<F${i}>> = true;`);
    });
    return [...lines, "export {};"].join("\n") + "\n";
  }

  return { TSC_VERSION, EQUALS, SNIPS, SPEAKO, HUB_PRE, HUB_IDS, FLAG_SNIP, FN, FILM_DECLS, scenes, CUES, unify, subst, fits, USER_ROWS, mapRows, rowsText, MAPPED, subsets, FN_TYPES, inferReturn,
    GROUP_TS, GROUP_JS, GROUP_STARTER, GROUP_CHECKS, groupCode, runJs, runRunnable, fakeFetch, fullSource, filmSource, mappedSource, inferSource, probes };
});
