/* Generics and utility types: the film and the guided pages. Every type, error and result shown comes from
   ts-generics.data.js, which dev/ts-generics.test.js checks against the real TypeScript compiler (tsc 7).
   A browser cannot run tsc, so the pages show the saved tsc answers; code that can run (types removed) runs live. */
(function () {
  const { h, guided, svg: S, icon } = Book;
  const V = (Book.parts["ts-generics"] = Book.parts["ts-generics"] || {});
  const D = V.data;
  const SN = D.SNIPS;

  /* ---------- TypeScript colors: the kit's highlighter knows JavaScript, so add the TypeScript words ---------- */
  const TS_KW = new Set(["type", "interface", "extends", "keyof", "infer", "readonly", "declare", "as", "satisfies", "unknown", "never", "void", "any", "string", "number", "boolean", "object", "symbol"]);
  function tsTokens(code) {
    const toks = Book.tokens(code);
    return toks.map((t, i) => {
      if (t.type !== "plain" || !TS_KW.has(t.text)) return t;
      if (t.text === "type") { // "type X = ..." is the keyword; "type: K" is a name
        const next = toks.slice(i + 1).find((x) => x.type !== "space");
        const prev = toks.slice(0, i).reverse().find((x) => x.type !== "space");
        if (!next || !/^[A-Za-z_$]/.test(next.text) || (prev && prev.text === ".")) return t;
      }
      return { type: "kw", text: t.text };
    });
  }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tsHtml = (code) => tsTokens(code).map((t) => (t.type === "plain" || t.type === "space" ? esc(t.text) : `<span class="syn-${t.type}">${esc(t.text)}</span>`)).join("");
  const tgCode = (code) => h("pre.code-block.tg-block", { html: tsHtml(code.replace(/^\n+|\s+$/g, "")) });

  /* ---------- a code view with numbered lines, hints and error marks ---------- */
  const lineOf = (code, t) => code.split("\n").findIndex((l) => new RegExp(`^(const|let|type)\\s+${t.of || t.type}\\b`).test(l));
  function codeView(code, onLine) {
    const els = code.split("\n").map((t, i) => h("span.tg-ln", { "data-n": String(i + 1), html: tsHtml(t) || " ", onclick: onLine ? () => onLine(i) : null, onkeydown: onLine ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLine(i); } } : null, tabindex: onLine ? "0" : null, role: onLine ? "button" : null }));
    const el = h("pre.code-block.tg-code", { "aria-label": "The code" }, els);
    return {
      el, els,
      lit(a, b) { els.forEach((e, i) => e.classList.toggle("dim", a != null && !(i + 1 >= a && i + 1 <= b))); },
      hint(i, text) { if (!els[i].querySelector(".tg-hint")) els[i].append(h("span.tg-hint", text)); },
      bad(i) { els[i].classList.add("bad"); },
    };
  }
  function panel() {
    const tsBody = h("div.tg-pbody"), runBody = h("div.tg-pbody");
    const tsBox = h("div.tg-pane", { hidden: true }, h("span.label", `Real tsc ${D.TSC_VERSION} says`), tsBody);
    const runBox = h("div.tg-pane", { hidden: true }, h("span.label", "When it runs (types removed)"), runBody);
    return {
      el: h("div.tg-side", tsBox, runBox),
      clear() { tsBox.hidden = true; runBox.hidden = true; tsBody.replaceChildren(); runBody.replaceChildren(); },
      ts(errs, extra) {
        tsBox.hidden = false;
        const rows = errs.map((e) => h("p.tg-msg.bad", h("b", `line ${e.line} · ${e.code}`), " ", e.msg));
        tsBody.replaceChildren(...(rows.length ? rows : [h("p.tg-msg.good", extra || "No errors.")]));
      },
      run(r) {
        runBox.hidden = false;
        const lines = [...r.logs, ...(r.error ? [`${r.error.name}: ${r.error.message}`] : [])];
        runBody.replaceChildren(h("pre.tg-out" + (r.error ? ".bad" : ""), lines.join("\n") || "(nothing printed)"));
      },
    };
  }

  /* ---------- lab: one tour over saved tsc answers and live runs ---------- */
  function lab({ title, steps, takeaway, check }) {
    return guided({
      title,
      build(view) {
        const code = h("div.tg-codebox");
        const pn = panel();
        const note = h("p.tg-note", "The red and green answers are saved from the real compiler (a test re-checks them). Runs happen live in your browser.");
        const tools = h("div.tg-tools", { hidden: true });
        const s = { id: null, cv: null, pn, tools, ran: {}, free: false };
        view.append(h("div.tg-pair", code, h("div.tg-side", pn.el, note)), tools);
        s.load = (id, lit) => {
          s.id = id; s.ran = {}; pn.clear();
          s.cv = codeView(SN[id].code, s.free ? (i) => s.revealLine(i) : null);
          s.cv.lit(...(lit || []));
          code.replaceChildren(s.cv.el);
        };
        /* reveal what tsc said about lines [a, b] (1-based); no range = every line */
        s.reveal = async (ctx, range) => {
          const sn = SN[s.id], inR = (i) => !range || (i + 1 >= range[0] && i + 1 <= range[1]);
          const hints = sn.types.map((t) => [lineOf(sn.code, t), t.is]).filter(([i]) => i >= 0 && inR(i));
          const errs = sn.errors.filter((e) => !e.hidden && inR(e.line - 1));
          const lines = [...new Set([...hints.map((x) => x[0]), ...errs.map((e) => e.line - 1)])].sort((a, b) => a - b);
          for (const i of lines) {
            hints.filter((x) => x[0] === i).forEach(([, text]) => s.cv.hint(i, text));
            if (errs.some((e) => e.line - 1 === i)) s.cv.bad(i);
            if (ctx) await ctx.wait(300);
          }
          s.pn.ts(errs, hints.length ? "No errors. The grey notes are the types TypeScript worked out." : "No errors.");
        };
        s.revealLine = (i) => s.reveal(null, [i + 1, i + 1]);
        s.live = async () => { const r = await D.runJs(SN[s.id].js); s.ran[s.id] = r; s.pn.run(r); return r; };
        return s;
      },
      steps: steps.map((st) => ({
        say: st.say,
        enter: (s) => { s.free = Boolean(st.free); s.tools.hidden = !st.free; s.load(st.snip, st.lit); if (st.free) st.free(s); },
        guess: st.guess,
        action: st.act && { label: st.act.label, icon: st.act.kind === "run" ? "play" : "check", again: Boolean(st.free), prompt: st.act.prompt || "Now press the button and see.",
          run: async (s, ctx) => { if (st.act.kind === "run") await s.live(); else await s.reveal(ctx, st.act.range); } },
        after: st.after && ((s) => (typeof st.after === "function" ? st.after(s) : st.after)),
      })),
      takeaway, check,
    });
  }
  /* A free-play step: click any line to ask about it, or use the buttons. */
  const freePlay = (snips, kinds = ["tsc"]) => (s) => {
    const mk = (label, fn) => { const b = h("button.chip", { type: "button" }, label); b.addEventListener("click", fn); return b; };
    const btns = [];
    if (kinds.includes("tsc")) btns.push(mk("Ask the compiler about every line", () => s.reveal(null)));
    if (kinds.includes("run")) btns.push(mk("Run it (types removed)", () => { if (SN[s.id].js) s.live(); else s.pn.run({ logs: ["(this snippet is only type-checked)"], error: null }); }));
    const picks = snips.length > 1 ? snips.map(([id, name]) => { const b = mk(name, () => { s.load(id); picks.forEach((p) => p.setAttribute("aria-pressed", String(p === b))); }); b.setAttribute("aria-pressed", String(id === s.id)); return b; }) : [];
    s.tools.replaceChildren(h("span.label", "Free play"), ...picks, ...btns);
    if (snips.length) { s.load(snips.find(([id]) => id === s.id) ? s.id : snips[0][0]); picks.forEach((p, k) => p.setAttribute("aria-pressed", String(snips[k][0] === s.id))); }
  };

  /* ---------- 01. Why not any? ---------- */
  V.anyProblem = () => lab({
    title: "Why not just use any?",
    steps: [
      { say: "This function returns the first item of any list. Its type says any.", snip: "anyBad", lit: [1, 3] },
      { say: "Look at the last two lines. n is a number, and a number has no toUpperCase.", snip: "anyBad", lit: [5, 6],
        guess: { q: "Does TypeScript stop `n.toUpperCase()`?", options: ["Yes, it shows an error", "No, it says nothing", "It shows a warning but still builds"], answer: 1, why: "With any, TypeScript no longer knows that n is a number. It trusts you." },
        act: { label: "Ask the compiler", kind: "tsc" }, after: "The compiler is quiet. No red line." },
      { say: "It built. Now run the same code, with the types removed.", snip: "anyBad", lit: [5, 6],
        act: { kind: "run", label: "Run it in this browser", prompt: "Press the button to run the real code." },
        after: (s) => `Your browser printed: ${s.ran.anyBad.error ? s.ran.anyBad.error.name + ": " + s.ran.anyBad.error.message : "(no error)"}. A mistake the compiler could have caught reached the user.` },
      { say: "Now the generic version. T is the type of the items, so TypeScript can remember it.", snip: "genericBad", lit: [1, 3] },
      { say: "Same bad line, new function. Press the button.", snip: "genericBad", lit: [5, 6], act: { label: "Ask the compiler", kind: "tsc" },
        after: "Two errors. The second one is our bug: toUpperCase does not exist on a number. The first is a bonus: first() can return undefined, and T | undefined says so." },
      { say: "Free play. Switch versions, click a line to ask the compiler, or run the code.", snip: "anyBad", free: freePlay([["anyBad", "any version"], ["genericBad", "generic version"]], ["tsc", "run"]) },
    ],
    takeaway: "any switches checking off, so a wrong call builds and fails later. A generic keeps the real type, so the compiler stops the wrong call.",
    check: { q: "What is the type of n in first([1, 2, 3])?", options: ["any", "number | undefined", "unknown"], answer: 1,
      why: ["That is what firstAny gives. The generic version remembers T = number.", "Yes. T is number, and the function may find no item, so it can also give undefined.", "unknown would also force a check, but the generic knows more: it is number."] },
  });

  /* ---------- 03. TypeScript guesses T ---------- */
  V.inferLab = () => lab({
    title: "How TypeScript guesses T",
    steps: [
      { say: "TypeScript looks at the argument and works out T. This is called inference.", snip: "infer", lit: [5, 6], act: { label: "Ask the compiler", kind: "tsc", range: [5, 6] },
        after: "Numbers in, number out. Strings in, string out. The same function, two different answers." },
      { say: "A list with two kinds of item.", snip: "infer", lit: [7, 7],
        guess: { q: "What is T for first([1, \"x\"])?", options: ["number", "string | number", "It is an error"], answer: 1, why: "The list [1, \"x\"] has the type (string | number)[], so T is that union. A union is a type that allows several types." },
        act: { label: "Ask the compiler", kind: "tsc", range: [7, 7] } },
      { say: "Now two arguments that must share one T.", snip: "pair", lit: [5, 5],
        guess: { q: "Does `pair(1, \"x\")` build?", options: ["Yes, T becomes string | number", "No, T is already number"], answer: 1, why: "TypeScript takes T from the first argument, 1, so T is number. Then \"x\" does not fit. A list literal is different: its own type already holds both kinds of item." },
        act: { label: "Ask the compiler", kind: "tsc" } },
      { say: "An empty list gives TypeScript nothing to learn from.", snip: "infer", lit: [8, 8],
        guess: { q: "What is the type of d?", options: ["undefined", "unknown", "any"], answer: 0, why: "With no items, T has nothing to be, so it is never (the empty type). never | undefined is just undefined." },
        act: { label: "Ask the compiler", kind: "tsc", range: [8, 8] } },
      { say: "You can also say T yourself, with angle brackets. Then TypeScript checks your argument against it.", snip: "infer", lit: [9, 9], act: { label: "Ask the compiler", kind: "tsc", range: [9, 9] },
        after: "You said T is string, but 42 is a number. Writing T yourself is rarely needed; let TypeScript guess." },
      { say: "Free play. Click any line to ask the compiler about it.", snip: "infer", free: freePlay([], ["tsc"]) },
    ],
    takeaway: "TypeScript works out T from the arguments you pass. T can be a union, can be never for an empty list, and you can say it yourself.",
    check: { q: "Which call has an error?", options: ["first([1, 2])", "first<string>([42])", "first([1, \"x\"])"], answer: 1,
      why: ["T is number here. No error.", "Yes. You said T is string and passed a number.", "T becomes string | number. No error."] },
  });

  /* ---------- 04. A rule for T ---------- */
  V.constraint = () => lab({
    title: "A rule for T",
    steps: [
      { say: "byId searches a list for an item with a given id. Look at i.id inside the function.", snip: "noRule", act: { label: "Ask the compiler", kind: "tsc" },
        guess: { q: "Can TypeScript allow `i.id` here?", options: ["Yes, most objects have an id", "No, T could be a number or a string"], answer: 1, why: "T could be anything, even a number. TypeScript only allows what is true for every possible T." },
        after: "Property 'id' does not exist on type 'T'. The compiler stops us before the code runs." },
      { say: "Add extends: T may be any type that has id: string. This rule is called a constraint.", snip: "rule", lit: [3, 8], act: { label: "Ask the compiler", kind: "tsc", range: [3, 8] },
        after: "No errors inside the function. Inside, T now has an id." },
      { say: "Call it with a list of User. User has an id, so the rule passes.", snip: "rule", lit: [10, 13], act: { label: "Ask the compiler", kind: "tsc", range: [10, 13] },
        after: "T is the type you pass in. The rule is only a check, so User stays User, and the result is User | undefined." },
      { say: "Call it with a list of numbers.", snip: "rule", lit: [11, 14], act: { label: "Ask the compiler", kind: "tsc", range: [11, 14] },
        after: "A number has no id, so it breaks the rule. TypeScript compares number[] with { id: string }[]." },
      { say: "Now a list of objects that have an id and one more key.", snip: "rule", lit: [15, 15],
        guess: { q: "Is `byId([{ id: \"1\", extra: 5 }], \"1\")` allowed?", options: ["Yes, the extra key is fine", "No, the object has a key the rule does not list"], answer: 0, why: "The rule is a minimum, not an exact shape. T becomes { id: string; extra: number }, which has an id." },
        act: { label: "Ask the compiler", kind: "tsc", range: [15, 15] } },
      { say: "Why not write the type directly, as { id: string }[]? Compare.", snip: "loose", lit: [3, 13], act: { label: "Ask the compiler", kind: "tsc" },
        after: "The loose version forgets name. It gives back { id: string }, so u?.name is an error. The generic keeps User." },
      { say: "Free play. Switch between the versions and ask the compiler about every line.", snip: "noRule", free: freePlay([["noRule", "no rule"], ["rule", "with a rule"], ["loose", "only { id: string }"]], ["tsc"]) },
    ],
    takeaway: "A constraint (T extends something) says what every T must have. Inside the function you can use it, and outside T keeps its full type.",
    check: { q: "What does `T extends { id: string }` allow?", options: ["Only the exact type { id: string }", "Any type that has an id string, and more", "Any type at all"], answer: 1,
      why: ["Extra properties are fine. User has name too.", "Yes. Think of it as a minimum, not an exact shape.", "That is T with no rule. Then i.id is an error."] },
  });

  /* ---------- 05. keyof and indexed access ---------- */
  V.keyof = () => lab({
    title: "keyof: the list of keys",
    steps: [
      { say: "Types can be asked questions. keyof User asks TypeScript for the keys of User.", snip: "keyofLab", lit: [1, 3],
        guess: { q: "What is `keyof User`?", options: ["\"id\" | \"name\" | \"age\"", "string[]", "string"], answer: 0, why: "Each key becomes its own exact text type. \"id\" as a type allows only the text id." },
        act: { label: "Ask the compiler", kind: "tsc", range: [3, 3] } },
      { say: "User[\"name\"] asks: what type is the name property? This is called an indexed access type.", snip: "keyofLab", lit: [4, 4], act: { label: "Ask the compiler", kind: "tsc", range: [4, 4] },
        after: "It is the type string. The brackets work like obj[\"name\"], but in the world of types." },
      { say: "Put both together. K must be one of T's keys, and the result is T[K].", snip: "keyofLab", lit: [6, 11], act: { label: "Ask the compiler", kind: "tsc", range: [6, 11] },
        after: "getProp(user, \"age\") gives number: K is \"age\", so T[K] is User[\"age\"]." },
      { say: "Now a typo.", snip: "keyofLab", lit: [12, 12],
        guess: { q: "Does `getProp(user, \"nme\")` build?", options: ["Yes", "No, \"nme\" is not a key of User"], answer: 1, why: "K extends keyof T is a rule. \"nme\" is not in the list." },
        act: { label: "Ask the compiler", kind: "tsc", range: [12, 12] } },
      { say: "Free play. Click any line to ask the compiler about it.", snip: "keyofLab", free: freePlay([], ["tsc"]) },
    ],
    takeaway: "keyof T is the union of T's keys. T[K] is the type of the property K. Together they let a function accept only real keys, and return the right type.",
    check: { q: "For user: User, what is the type of getProp(user, \"name\")?", options: ["string", "\"name\"", "keyof User"], answer: 0,
      why: ["Yes. K is \"name\", and T[K] is User[\"name\"], which is string.", "That is K, the key. The result is T[K], the value type.", "That is the list of all keys."] },
  });

  /* ---------- 10. Puzzles ---------- */
  V.puzzles = () => lab({
    title: "Four quick type puzzles",
    steps: [
      { say: "Puzzle 1. A type that allows any text as a key.", snip: "puz1",
        guess: { q: "What is `keyof { [k: string]: 1 }`?", options: ["string", "string | number", "1"], answer: 1, why: "An object key can also be a number, because JavaScript turns it into text: obj[1] reads obj[\"1\"]. So the keys are string | number." },
        act: { label: "Ask the compiler", kind: "tsc" } },
      { say: "Puzzle 2. Omit takes keys away; Pick keeps only the keys you name.", snip: "puz2", lit: [3, 3],
        guess: { q: "What is `Omit<User, \"id\">`?", options: ["{ id: string }", "{ name: string; age: number }", "{}"], answer: 1, why: "Omit removes id and keeps the rest. Pick<User, \"id\"> is the opposite." },
        act: { label: "Ask the compiler", kind: "tsc" }, after: "Omit<User, \"id\"> and Pick<User, \"id\"> split User into two parts that do not overlap." },
      { say: "Puzzle 3. The condition T extends unknown is true for every type, so only the union matters.", snip: "puz3", lit: [1, 2],
        guess: { q: "What is `ToArray<string | number>`?", options: ["(string | number)[]", "string[] | number[]", "never"], answer: 1, why: "TypeScript splits the union, applies the rule to string and to number, and joins the results. This is called distribution." },
        act: { label: "Ask the compiler", kind: "tsc", range: [1, 2] } },
      { say: "The same rule in square brackets, [T] extends [unknown], is checked once, on the whole union.", snip: "puz3", lit: [4, 5], act: { label: "Ask the compiler", kind: "tsc", range: [4, 5] },
        after: "One array of the union: (string | number)[]. The brackets switch distribution off." },
      { say: "Puzzle 4. Dog and Cat share kind and id; only Dog has bark, only Cat has meow.", snip: "puz4", lit: [1, 4],
        guess: { q: "What is `Omit<Dog | Cat, \"id\">`?", options: ["Omit<Dog, \"id\"> | Omit<Cat, \"id\">", "{ kind: \"dog\" | \"cat\" }", "never"], answer: 1, why: "Omit does not distribute. It keeps only keys that every member has, so bark and meow are lost." },
        act: { label: "Ask the compiler", kind: "tsc", range: [1, 4] } },
      { say: "To keep the union, apply Omit to each member. A conditional type does that for us.", snip: "puz4", lit: [6, 8], act: { label: "Ask the compiler", kind: "tsc", range: [6, 8] },
        after: "Now Better is Omit<Dog, \"id\"> | Omit<Cat, \"id\">: bark and meow are back." },
      { say: "Free play. Pick a puzzle and ask the compiler.", snip: "puz1", free: freePlay([["puz1", "keyof"], ["puz2", "Omit and Pick"], ["puz3", "a union"], ["puz4", "Omit on a union"]], ["tsc"]) },
    ],
    takeaway: "keyof gives keys, and Omit and Pick split a type. A conditional type on a bare T works per union member; [T] extends [...] checks the whole union once. Omit alone keeps only the shared keys.",
    check: { q: "Which tool keeps both Dog and Cat shapes when you remove id?", options: ["Omit<Dog | Cat, \"id\">", "A conditional type that applies Omit to each member", "Pick<Dog | Cat, \"id\">"], answer: 1,
      why: ["Plain Omit keeps only the shared keys.", "Yes. T extends unknown ? Omit<T, K> : never runs once per member.", "Pick keeps only id, which is the opposite."] },
  });

  /* ---------- 11. From your work: T that nobody checks ---------- */
  V.trust = () => lab({
    title: "Does anything check T?",
    steps: [
      { say: "Here is the shape of http.get<T>: T comes from you, and the function returns whatever the server sent.", snip: "trustMe", lit: [3, 6] },
      { say: "The API was changed: it now sends name, not fullName. The fake server below does the same.", snip: "trustMe", lit: [8, 12],
        guess: { q: "Does TypeScript notice that the server sends a different shape?", options: ["Yes, get<User> checks it", "No, T is only a promise from you"], answer: 1, why: "res.json() gives any, and any fits every T. TypeScript cannot see the network." },
        act: { label: "Ask the compiler", kind: "tsc", range: [8, 12] }, after: "No errors. The compiler believes what the type says." },
      { say: "Run it against the fake server (with types removed).", snip: "trustMe", lit: [8, 12], act: { label: "Run it in this browser", kind: "run", prompt: "Press the button to run the real code." },
        after: (s) => `Your browser printed: ${(s.ran.trustMe.logs[0] || "(nothing)")}. The type said fullName was a string; the server did not send it.` },
      { say: "Check the data where it comes in. parseUser looks at each field, and get learns T from it.", snip: "parsed", lit: [3, 21], act: { label: "Ask the compiler", kind: "tsc", range: [3, 27] },
        after: "T is now User because parseUser returns a User, not because we promised it. No <User> is needed." },
      { say: "Run it against the same fake server.", snip: "parsed", lit: [23, 27], act: { label: "Run it in this browser", kind: "run", prompt: "Press the button to run the real code." },
        after: (s) => `Your browser printed: ${(s.ran.parsed.logs[0] || "(nothing)")}. The error now names the missing field, at the edge of the app.` },
      { say: "Free play. Switch versions, then check them or run them.", snip: "trustMe", free: freePlay([["trustMe", "get<User>"], ["parsed", "with parseUser"]], ["tsc", "run"]) },
    ],
    takeaway: "A generic T is a promise to the compiler. For data from outside, make the function check the data, and let T come from the check.",
    check: { q: "Why did http.get<User> not notice the renamed field?", options: ["TypeScript has a bug", "T is erased and the data is never checked", "The field was optional"], answer: 1,
      why: ["It works as designed: types are not data.", "Yes. Types are removed before the code runs, so only a runtime check can see the real data.", "Nothing in the code says it was optional."] },
  });

  /* ---------- 02. The film: a type flows through a generic ---------- */
  const secs = (t) => Math.max(2.5, 1 + t.replace(/`/g, "").split(/\s+/).length / 2.6);
  /* which parts show up at each caption of each scene (the test checks the counts match the captions) */
  const REV = [[["tok"]], [["call", "arg"], ["T"], ["result"]], [["call", "arg"], ["T"], ["result"]], [["call", "arg"], ["T", "result"]], [["call", "arg"], ["T", "rule", "result"]], [["call", "arg", "T"], ["rule", "err"]]];
  const wrap = (text, n) => { const out = []; let cur = ""; for (const w of text.split(" ")) { if ((cur + " " + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) out.push(cur); return out; };
  const G = (layout) => {
    const wide = layout === "wide";
    const lh = wide ? 18 : 17;
    const g = wide
      ? { W: 760, code: { x: 12, y: 34, w: 350, h: 6 * lh + 20 }, call: { x: 12, y: 204, w: 350, h: 36 }, st: { x: 392, w: 356 }, y: { arg: 34, T: 112, rule: 186, res: 240 }, lbl: 100, wrapAt: 44 }
      : { W: 344, code: { x: 4, y: 26, w: 336, h: 6 * lh + 18 }, call: { x: 4, y: 176, w: 336, h: 34 }, st: { x: 4, w: 336 }, y: { arg: 232, T: 290, rule: 346, res: 382 }, lbl: 94, wrapAt: 42 };
    g.lh = lh; g.wide = wide; g.H = wide ? 372 : 496; g.chipH = 38;
    return g;
  };
  V.film = () => Book.film({
    title: "A type flows through a generic",
    wide: [G("wide").W, G("wide").H], tall: [G("tall").W, G("tall").H],
    build(svg, F, layout) {
      const g = G(layout);
      const sc = D.scenes;
      const part = (node) => F.actor(node, { o: 0, y: 6 }, (p, n) => { n.setAttribute("transform", `translate(0 ${p.y.toFixed(2)})`); n.setAttribute("opacity", Math.max(0, p.o).toFixed(3)); });
      const mono = (parent, text, x, y, cls = "") => {
        const tx = S("text", { x, y, class: "fl-code " + cls, style: "font-size:12px", "xml:space": "preserve" });
        for (const t of tsTokens(text)) tx.append(S("tspan", { class: t.text === "T" ? "tg-t" : t.type === "plain" || t.type === "space" ? "syn-plain" : `syn-${t.type}` }, t.text));
        parent.append(tx);
      };
      /* the two fixed cards */
      svg.append(
        S("text", { x: g.code.x + 2, y: g.code.y - 8, class: "fl-small" }, "The function"),
        S("rect", { x: g.code.x, y: g.code.y, width: g.code.w, height: g.code.h, rx: 12, class: "fl-code-bg" }),
        S("text", { x: g.call.x + 2, y: g.call.y - 8, class: "fl-small" }, "The call"),
        S("rect", { x: g.call.x, y: g.call.y, width: g.call.w, height: g.call.h, rx: 12, class: "fl-code-bg" }));
      /* one code group per function, shown while its scenes play */
      const codeA = {};
      for (const fn of [...new Set(sc.map((s) => s.fn))]) {
        const grp = S("g");
        D.FN[fn].code.split("\n").forEach((line, i) => mono(grp, line, g.code.x + 10, g.code.y + 22 + i * g.lh));
        svg.append(grp);
        codeA[fn] = F.actor(grp, { o: 0 }, (p, n) => n.setAttribute("opacity", Math.max(0, p.o).toFixed(3)));
      }
      const chip = (parent, key, label, value, cls = "") => {
        const y = g.y[key], n = S("g");
        n.append(S("rect", { x: g.st.x, y, width: g.st.w, height: g.chipH, rx: 10, class: "tg-chip " + cls }), S("text", { x: g.st.x + 10, y: y + g.chipH / 2 + 4, class: "tg-chip-label " + cls }, label));
        const v = S("text", { x: g.st.x + g.lbl, y: y + g.chipH / 2 + 4.5, class: "tg-chip-value " + cls, "xml:space": "preserve" }, value);
        n.append(v);
        return n;
      };
      const arrow = (parent, fromY, toY) => parent.append(S("path", { d: `M ${g.st.x + 22} ${fromY} V ${toY - 4}`, class: "tg-arrow" }), S("path", { d: `M ${g.st.x + 17} ${toY - 9} L ${g.st.x + 22} ${toY - 3} L ${g.st.x + 27} ${toY - 9}`, class: "tg-arrow" }));
      let T = 0.3, codeOn = null;
      sc.forEach((s, i) => {
        if (s.chapter) F.chapter(T, s.chapter);
        if (codeOn !== s.fn) { if (codeOn) F.to(codeA[codeOn], { o: 0 }, T, 0.4); F.to(codeA[s.fn], { o: 1 }, T + 0.1, 0.4); codeOn = s.fn; }
        const P = {};
        if (s.call) {
          const grp = S("g");
          svg.append(grp);
          const add = (name, build) => { const n = S("g"); build(n); grp.append(n); P[name] = part(n); };
          add("call", (n) => mono(n, s.call, g.call.x + 12, g.call.y + 22));
          add("arg", (n) => n.append(chip(n, "arg", "argument type", s.arg)));
          add("T", (n) => { arrow(n, g.y.arg + g.chipH, g.y.T); n.append(chip(n, "T", "so T is", s.T, "t")); });
          if (s.need) add("rule", (n) => {
            const y = g.y.rule;
            arrow(n, g.y.T + g.chipH, y);
            n.append(S("text", { x: g.st.x + 34, y: y + 17, class: "tg-ruletext " + (s.ok ? "ok" : "no") }, `${s.ok ? "✓" : "✗"} ${s.T} ${s.ok ? "has" : "does not have"} ${s.need}`));
          });
          if (s.ok) add("result", (n) => { arrow(n, (s.need ? g.y.rule + 26 : g.y.T + g.chipH), g.y.res); n.append(chip(n, "result", "result type", s.result)); });
          else add("err", (n) => {
            const lines = wrap(s.error, g.wrapAt), y = g.y.res, hgt = 30 + lines.length * 16;
            arrow(n, g.y.rule + 26, y);
            n.append(S("rect", { x: g.st.x, y, width: g.st.w, height: hgt, rx: 10, class: "tg-errbox" }), S("text", { x: g.st.x + 10, y: y + 18, class: "tg-errlabel" }, `TypeScript says (${s.errorCode})`));
            lines.forEach((l, k) => n.append(S("text", { x: g.st.x + 10, y: y + 36 + k * 16, class: "tg-errtext" }, l)));
          });
        }
        D.CUES[i].forEach((cue, k) => {
          F.say(T, cue);
          (REV[i][k] || []).forEach((name) => { if (P[name]) F.to(P[name], { o: 1, y: 0 }, T + 0.15, 0.5, F.ease.out); });
          T += secs(cue);
        });
        T += 0.4;
        if (i < sc.length - 1) Object.values(P).forEach((a) => F.to(a, { o: 0 }, T, 0.35));
        T += 0.4;
      });
      F.end(T + 1);
    },
  });

  /* ---------- 06. Build Partial, Readonly and Pick ---------- */
  V.mapped = () => {
    const KEYS = D.USER_ROWS.map((r) => r[0]);
    return guided({
      title: "Build Partial, Readonly and Pick",
      build(view) {
        const src = h("div.tg-mapsrc");
        const left = h("div.tg-card", h("span.tg-card-title", "T = User"), D.USER_ROWS.map(([k, t]) => h("div.tg-row", { "data-k": k }, h("b", k), ": ", t)));
        const rightTitle = h("span.tg-card-title");
        const right = h("div.tg-card.out", rightTitle);
        const proof = h("p.tg-proof", { hidden: true });
        const tools = h("div.tg-tools", { hidden: true });
        const s = { id: "copy", keep: [...KEYS], busy: false, tools, proof };
        const kidRows = () => [...left.querySelectorAll(".tg-row")];
        /* hideSrc: before a guess about the answer, show the plain copy loop instead of the finished code */
        s.load = (id, keep, hideSrc) => {
          s.id = id; s.keep = keep || (id === "pick" ? ["id", "name"] : [...KEYS]);
          src.replaceChildren(tgCode(D.MAPPED[hideSrc ? "copy" : id].src));
          right.replaceChildren(rightTitle); rightTitle.textContent = "Result";
          proof.hidden = true;
          kidRows().forEach((r) => r.classList.remove("on", "skip"));
        };
        s.callName = () => { const m = D.MAPPED[s.id]; return s.id === "pick" ? `${m.name}<User, ${s.keep.map((k) => `"${k}"`).join(" | ")}>` : `${m.name}<User>`; };
        s.build = async (ctx) => {
          if (s.id === "pick" && !s.keep.length) { rightTitle.textContent = "Pick at least one key."; return "more"; }
          s.load(s.id, s.keep);
          const m = D.MAPPED[s.id];
          const rows = D.mapRows(D.USER_ROWS, s.id === "pick" ? { ...m.o, keep: s.keep } : m.o);
          rightTitle.textContent = s.callName();
          for (const r of kidRows()) {
            const k = r.getAttribute("data-k");
            r.classList.add("on");
            if (s.id === "pick" && !s.keep.includes(k)) { r.classList.add("skip"); await ctx.wait(350); r.classList.remove("on"); continue; }
            await ctx.wait(350);
            const row = rows.find((x) => x.key === k);
            const el = h("div.tg-row", row.text);
            right.append(el);
            ctx.animate(el, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 300 });
            await ctx.wait(350);
            r.classList.remove("on");
          }
          const same = m.builtin ? `${m.builtin}${s.id === "pick" ? `<User, ${s.keep.map((k) => `"${k}"`).join(" | ")}>` : "<User>"}` : "User";
          proof.textContent = `Checked with tsc ${D.TSC_VERSION}: ${s.callName()} is exactly the same type as ${same}. Its shape is ${D.rowsText(rows)}.`;
          proof.hidden = false;
        };
        view.append(src, h("div.tg-cols", left, h("div.tg-mid", "for each key K →"), right), proof, tools);
        return s;
      },
      steps: [
        { say: "A mapped type loops over the keys of a type. Here it copies User.", enter: (s) => { s.tools.hidden = true; s.load("copy"); },
          action: { label: "Loop over the keys", icon: "play", prompt: "Press the button.", run: (s, ctx) => s.build(ctx) },
          after: "K is each key in turn: id, then name, then age. T[K] is the type of that key. The result is a copy of User." },
        { say: "Now change the loop by one symbol, so every key becomes optional.", enter: (s) => { s.tools.hidden = true; s.load("partial", null, true); },
          guess: { q: "Which small change makes every field optional?", options: ["A ? after the brackets: [K in keyof T]?", "| undefined after T[K]", "A ! in front of the key"], answer: 0, why: "The ? marks the key as optional. Writing | undefined is not the same: the key would still be required, and tsc says the result is a different type." },
          action: { label: "Loop over the keys", icon: "play", run: (s, ctx) => s.build(ctx) } },
        { say: "Another small change: readonly in front of the key makes it read-only.", enter: (s) => { s.tools.hidden = true; s.load("readonly"); },
          action: { label: "Loop over the keys", icon: "play", run: (s, ctx) => s.build(ctx) },
          after: "Every key now says readonly. It is a rule for the compiler only: nothing stops a write when the code runs." },
        { say: "Pick keeps only some keys. You give it a list of keys, called K.", enter: (s) => { s.tools.hidden = true; s.load("pick", ["id", "name"], true); },
          guess: { q: "In MyPick, what does the loop visit?", options: ["Only the keys in K", "All keys of T, then delete some", "The values of T"], answer: 0, why: "[P in K] visits just the keys you listed. K extends keyof T makes sure each one is a real key." },
          action: { label: "Pick id and name", icon: "play", run: (s, ctx) => s.build(ctx) } },
        { say: "Free play. Choose a tool, choose keys for Pick, and press the button.", enter: (s) => {
            s.tools.hidden = false; s.load("copy");
            const mk = (label, fn) => { const b = h("button.chip", { type: "button", "aria-pressed": "false" }, label); b.addEventListener("click", () => fn(b)); return b; };
            const setKeep = (ks) => { s.keep = ks; keys.forEach((k) => k.setAttribute("aria-pressed", String(ks.includes(k.textContent)))); };
            const utils = ["copy", "partial", "readonly", "pick"].map((id) => mk(D.MAPPED[id].name.replace(/^My/, ""), (b) => { s.load(id, id === "pick" ? ["id", "name"] : null); setKeep(id === "pick" ? ["id", "name"] : []); if (id !== "pick") s.keep = [...KEYS]; utils.forEach((u) => u.setAttribute("aria-pressed", String(u === b))); keys.forEach((k) => { k.disabled = id !== "pick"; }); }));
            const keys = KEYS.map((k) => mk(k, () => setKeep(s.keep.includes(k) ? s.keep.filter((x) => x !== k) : [...s.keep, k])));
            keys.forEach((k) => { k.disabled = true; k.setAttribute("aria-pressed", "false"); });
            utils[0].setAttribute("aria-pressed", "true");
            s.tools.replaceChildren(h("span.label", "Tool"), ...utils, h("span.label", "Keys for Pick"), ...keys);
          },
          action: { label: "Loop over the keys", icon: "play", again: true, run: (s, ctx) => s.build(ctx) } },
      ],
      takeaway: "A mapped type loops over keys and builds a new type: ? makes keys optional, readonly makes them read-only, and looping over K instead of keyof T picks some keys.",
      check: { q: "Which one makes every key optional?", options: ["{ [K in keyof T]?: T[K] }", "{ [K in keyof T]: T[K] | undefined }", "{ [K in K]: T[K] }"], answer: 0,
        why: ["Yes. The ? after the brackets is Partial.", "The keys stay required here; tsc says this is a different type from Partial.", "That is not even valid. Pick uses [P in K] with K a list of keys."] },
    });
  };

  /* ---------- 07. Build ReturnType with infer ---------- */
  V.infer = () => {
    return guided({
      title: "Build ReturnType with infer",
      build(view) {
        const code = h("div.tg-codebox");
        const anat = h("div.tg-anat");
        const catchEl = h("p.tg-catch", { "aria-live": "polite" });
        const tools = h("div.tg-tools", { hidden: true });
        const box = h("div.tg-anatbox", h("p.tg-lead", "A function type has three parts:"), anat);
        const s = { cur: 0, tools, anat, box, catchEl };
        s.show = (k) => { s.cur = k; const t = D.FN_TYPES[k], r = D.inferReturn(t); anat.replaceChildren(...(r ? [h("span.tg-seg.p", r.params), h("span.tg-seg.a", r.arrow.trim()), h("span.tg-seg.tg-ret", r.ret)] : [h("span.tg-seg.none.tg-ret", t)])); catchEl.textContent = ""; };
        s.catch = async (ctx) => {
          const r = D.inferReturn(D.FN_TYPES[s.cur]);
          anat.querySelector(".tg-ret").classList.add("lit");
          await ctx.wait(500);
          catchEl.textContent = r ? `R is ${r.ret}. The conditional type answers: ${r.ret}.` : `${D.FN_TYPES[s.cur]} is not a function, so the check fails. The answer is the else part: never.`;
        };
        view.append(code, box, catchEl, tools);
        s.code = (id, lit) => { code.replaceChildren(tgCode(SN[id].code)); };
        return s;
      },
      steps: [
        { say: "A conditional type is an if for types: T extends string ? \"yes\" : \"no\".", enter: (s) => { s.tools.hidden = true; s.code("isString"); s.show(0); s.box.hidden = true; },
          guess: { q: "What is `IsString<42>`?", options: ["\"yes\"", "\"no\"", "never"], answer: 1, why: "42 is a number, not a string, so the else part wins." },
          action: { label: "Ask the compiler", icon: "check", run: async (s, ctx) => { await ctx.wait(300); s.catchEl.textContent = "tsc: IsString<\"hi\"> is \"yes\" and IsString<42> is \"no\"."; } } },
        { say: "Is F a function? If so, infer gives its return type the name R.", enter: (s) => { s.tools.hidden = true; s.code("myReturn"); s.box.hidden = true; s.show(0); },
          guess: { q: "For F = (id: string) => Promise<User>, what is R?", options: ["User", "Promise<User>", "string"], answer: 1, why: "R is whatever sits after the arrow. The function returns a promise, so R is Promise<User>." },
          action: { label: "Catch R", icon: "play", run: (s, ctx) => { s.box.hidden = false; return s.catch(ctx); } },
          after: "tsc agrees: MyReturnType<Fn> is Promise<User>, and it is exactly the same type as the built-in ReturnType<Fn>." },
        { say: "Promise<User> is still a promise. Awaited removes the promise and gives User.", enter: (s) => { s.tools.hidden = true; s.code("myReturn"); s.box.hidden = false; s.show(0); },
          action: { label: "Ask the compiler", icon: "check", run: async (s, ctx) => { await ctx.wait(300); s.catchEl.textContent = "tsc: Awaited<R> is User."; } } },
        { say: "What if F is not a function?", enter: (s) => { s.tools.hidden = true; s.code("myReturn"); s.box.hidden = true; s.show(4); },
          guess: { q: "What is `MyReturnType<string>`?", options: ["string", "never", "an error"], answer: 1, why: "string is not a function type, so we get the else part: never. The built-in ReturnType is stricter: it refuses a non-function with an error." },
          action: { label: "Catch R", icon: "play", run: (s, ctx) => { s.box.hidden = false; return s.catch(ctx); } }, after: "The built-in version says: Type 'string' does not satisfy the constraint '(...args: any) => any'. (TS2344, checked with tsc.)" },
        { say: "Free play. Pick a function type and catch R.", enter: (s) => {
            s.tools.hidden = false; s.code("myReturn"); s.box.hidden = false; s.show(0);
            const bs = D.FN_TYPES.map((t, k) => { const b = h("button.chip", { type: "button", "aria-pressed": String(k === 0) }, t); b.addEventListener("click", () => { s.show(k); bs.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }); return b; });
            s.tools.replaceChildren(h("span.label", "F is"), ...bs);
          },
          action: { label: "Catch R", icon: "play", again: true, run: (s, ctx) => s.catch(ctx) } },
      ],
      takeaway: "A conditional type asks a yes-or-no question about a type. infer R names a piece of the matching type, so ReturnType is a one-line way to read the return type.",
      check: { q: "What does `infer R` do in `F extends (...args: any[]) => infer R ? R : never`?", options: ["It catches the return type of F as R", "It makes F return R", "It checks that R is a string"], answer: 0,
        why: ["Yes. If F is a function type, R is the type after the arrow.", "It reads a type; it does not change one.", "R can be any type. infer just names it."] },
    });
  };

  Object.assign(V, { tgCode, tsTokens, codeView, REV });
})();
