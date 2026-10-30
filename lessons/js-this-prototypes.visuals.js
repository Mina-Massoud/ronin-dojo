/* this, prototypes and classes: the guided visuals and the two films.
   Every result, label and chain below comes from running the snippets in js-this-prototypes.data.js,
   which dev/js-this-prototypes.test.js checks in Node. Nothing here is a typed-in output. */
(function () {
  const { h, guided, svg: S } = Book;
  const V = (Book.parts["js-this-prototypes"] = Book.parts["js-this-prototypes"] || {});
  const D = V.data;

  const narrow = () => window.matchMedia("(max-width: 560px)").matches;
  const modeChip = (mode) => h("span.chip.th-mode", mode === "strict" ? "strict mode" : "sloppy mode");
  /* A small result box: the value, in a console look. kind: ok | bad | ask */
  const outBox = (label = "Result") => {
    const body = h("code.th-out-body");
    return { el: h("div.th-out", h("span.label", label), body), set(text, kind = "ok") { body.textContent = text; body.dataset.kind = kind; } };
  };
  const looksBad = (t) => /^[A-Z][A-Za-z]*Error:/.test(t);
  const kindOf = (t) => (looksBad(t) ? "bad" : "ok");

  /* ---------- 01. Same function, a different this (and how it gets lost) ---------- */
  V.lose = () => {
    const T = D.lose.tries;
    return guided({
      title: "Same function, a different this",
      build(view) {
        const card = (id, name) => h("div.th-card", h("b", id), h("span", `name: "${name}"`));
        const rex = card("rex", "Rex");
        const tom = card("tom", "Tom");
        const fn = h("div.th-fnchip", h("b", "speak()"), h("span", "one function, shared"));
        const call = h("code.th-callchip");
        const out = outBox("What it printed");
        const strip = h("div.th-strip", call, out.el);
        const chips = h("div.th-chips", { hidden: true }, h("span.label", "Try a call"),
          ["lost", "arrow", "bind", "wrong"].map((k) => {
            const b = h("button.chip", { type: "button" }, T[k].label);
            b.addEventListener("click", () => s.run(k));
            return b;
          }));
        view.append(h("div.th-lose", Book.code(D.lose.src), h("div.th-cast", rex, fn, tom), strip, chips));
        const s = {
          rex, tom, fn, strip, chips, call, out,
          mode(n) { strip.hidden = n < 2; chips.hidden = n < 8; },
          focus(who) { rex.classList.toggle("th-on", who === "rex"); tom.classList.toggle("th-on", who === "tom"); rex.classList.toggle("th-dim", who === "tom"); tom.classList.toggle("th-dim", who === "rex"); },
          clear() { call.textContent = ""; out.set("—", "ask"); s.focus(null); },
          run(key) {
            const text = D.runTry(key);
            call.textContent = T[key].label;
            out.set(text, kindOf(text));
            s.focus(/^"Rex/.test(text) ? "rex" : /^"Tom/.test(text) ? "tom" : null);
            return text;
          },
        };
        return s;
      },
      steps: [
        { say: "Think of the word “my”. “My name is…” gives a different name for each person who says it. In JavaScript, this works like “my”.",
          enter: (s) => { s.mode(1); s.clear(); }, show: (s, ctx) => ctx.callout(s.fn, "One function. Two objects use it.", "top") },
        { say: "Call rex.speak(). The object before the dot is rex, so this is rex.",
          enter: (s) => { s.mode(2); s.clear(); },
          action: { label: "Run rex.speak()", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.run("rex"); } },
          after: "this was rex, so this.name is “Rex”." },
        { say: "Same function, but the dot now points at tom.",
          enter: (s) => { s.mode(2); s.clear(); },
          guess: { q: "What will tom.speak() print?", options: ["Rex says woof", "Tom says woof", "An error"], answer: 1, why: "The caller decides this. Before the dot is tom, so this is tom. One function, two results." },
          action: { label: "Run tom.speak()", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.run("tom"); } } },
        { say: "Now runLater(fn) gets only the function. It does not get rex. It calls it as fn().",
          enter: (s) => { s.mode(2); s.clear(); },
          guess: { q: "What will runLater(rex.speak) do?", options: ["Print “Rex says woof”", "Print “Tom says woof”", "Throw an error"], answer: 2, why: "rex.speak is just the function. The link to rex is only made at the call, and the call is fn()." },
          action: { label: "Run runLater(rex.speak)", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.run("lost"); } },
          after: "This is the real error from your browser. The words differ a little between browsers: all mean “this is undefined”." },
        { say: "Why? Inside runLater the call is fn(). There is no dot, so no object is chosen.",
          enter: (s) => { s.mode(2); s.run("lost"); s.focus(null); },
          show: (s, ctx) => ctx.callout(s.call, "No dot, so this is undefined", "top"),
          after: "A class always runs in strict mode, so this stays undefined. In sloppy code it would become globalThis (the next page shows this)." },
        { say: "Fix one: wrap it in an arrow. The arrow calls rex.speak() with a dot.",
          enter: (s) => { s.mode(2); s.clear(); },
          action: { label: "Run runLater(() => rex.speak())", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.run("arrow"); } },
          after: "The dot is back, so this is rex again." },
        { say: "Fix two: bind. It makes a new function with this locked to rex.",
          enter: (s) => { s.mode(2); s.clear(); },
          action: { label: "Run runLater(rex.speak.bind(rex))", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.run("bind"); } },
          after: "bind(rex) locks this. Even a plain call fn() now uses rex." },
        { say: "Your turn. Press a call below and watch who answers. The last one binds the wrong object on purpose.",
          enter: (s) => { s.mode(8); s.clear(); } },
      ],
      takeaway: "this is decided by how a function is called, not by where it is written. A method you pass around loses its object. setTimeout and addEventListener pick their own this, so the error looks different.",
      check: {
        q: "You write setTimeout(counter.tick, 100) and tick uses this.count. What is the safest fix?",
        options: ["setTimeout(counter.tick(), 100)", "setTimeout(() => counter.tick(), 100)", "Add this inside tick"], answer: 1,
        why: ["That calls tick now, and gives its result to setTimeout. It is not what you want.", "Yes. The arrow calls counter.tick() with a dot, so this is counter. (bind also works.)", "this is not something you can add. The caller decides it."],
      },
    });
  };

  /* ---------- 03. Your turn: who is this? ---------- */
  V.predict = () => {
    const ps = D.puzzles;
    return guided({
      title: "Your turn: who is this?",
      build(view) {
        const code = h("div.th-codebox");
        const answer = h("div.th-answer", h("span.label", "this is"), h("b.th-big", "?"));
        const mode = h("div.th-modeline");
        view.append(h("div.th-predict", code, h("div.th-side", mode, answer)));
        return {
          load(p) { code.replaceChildren(Book.code(D.puzzleCode(p))); mode.replaceChildren(modeChip(p.mode), h("span.th-hint", "Look at the last line only.")); answer.querySelector("b").textContent = "?"; answer.classList.remove("th-done"); },
          reveal(label) { answer.querySelector("b").textContent = label; answer.classList.add("th-done"); },
        };
      },
      steps: [
        { say: "Five short puzzles. Each one has a last line that calls a function. Say who this is, then see the real answer.", enter: (s) => s.load(ps[0]) },
        ...ps.map((p) => {
          const real = D.runPuzzle(p);
          return {
            say: `Puzzle: what is this inside speak, in the last line?`,
            enter: (s) => s.load(p),
            guess: { q: "Who is this?", options: p.options, answer: p.options.indexOf(real), why: p.why },
            onReveal: (s) => s.reveal(real),
          };
        }),
      ],
      takeaway: "Look at the call, not at the function. A dot before the call gives the object. call and bind choose it. No dot gives undefined (strict) or globalThis (sloppy).",
      check: {
        q: "f is a function made with bind(rex). You run f.call(tom). Who is this?",
        options: ["tom, because call comes last", "rex, because bind already locked it", "undefined"], answer: 1,
        why: ["call cannot change a bound function. The bind came first and it wins.", "Yes. A bound function ignores call, apply and a second bind.", "this is locked, so it is not undefined."],
      },
    });
  };

  /* ---------- 04. Arrow functions and class fields ---------- */
  V.arrows = () => {
    const F = D.fieldFacts();
    const plain = D.arrowTry("plain");
    const arrow = D.arrowTry("arrow");
    return guided({
      title: "Arrow functions and class fields",
      build(view) {
        const code = h("div.th-codebox");
        const cast = h("div.th-fields", { hidden: true });
        const out = outBox("Result");
        const row = h("div.th-chips", { hidden: true }, h("span.label", "Try"),
          ["a.show()", "a.onClick()", "(0, a.show)()", "(0, a.onClick)()", "a.onClick.call(b)"].map((e) => {
            const b = h("button.chip", { type: "button" }, e);
            b.addEventListener("click", () => { const t = D.fieldTry(e); s.out(e + "  →  " + t, kindOf(t)); });
            return b;
          }));
        view.append(h("div.th-arrows", code, cast, out.el, row));
        const box = (title, keys, note) => h("div.th-card.th-small", h("b", title), h("span", keys.length ? keys.join(", ") : "—"), note && h("em", note));
        const s = {
          cast, row,
          src(which) { code.replaceChildren(Book.code(which === "field" ? D.FIELD_SRC : D.ARROW_SRC)); cast.hidden = which !== "field"; row.hidden = true; },
          out(t, k) { out.set(t, k || kindOf(t)); },
          boxes() {
            cast.replaceChildren(box("a", F.ownA, "own"), box("b", F.ownA, "own"), box("Button.prototype", F.protoKeys, "shared"));
          },
          hl(names) { [...cast.children].forEach((c) => c.classList.toggle("th-on", names.includes(c.firstChild.textContent))); },
        };
        s.boxes();
        s.out("—", "ask");
        return s;
      },
      steps: [
        { say: "A normal function gets this from its call. Here plainFn() returns a function, and the code calls it with no dot. Strict mode is on.",
          enter: (s) => { s.src("arrow"); s.out("—", "ask"); },
          guess: { q: "What is this inside the returned function: rex.plainFn()()?", options: ["Rex", "undefined", "Tom"], answer: 1, why: "The inner call has no dot. It is a plain call, and strict mode keeps this undefined." },
          onReveal: (s) => s.out(plain, kindOf(plain)) },
        { say: "An arrow function has no this of its own. It uses the this of the place where it was written.",
          enter: (s) => { s.src("arrow"); s.out("—", "ask"); },
          guess: { q: "Now rex.arrowFn()(). The arrow was written inside arrowFn. What is this?", options: ["Rex", "undefined", "Tom"], answer: 0, why: "arrowFn was called as rex.arrowFn(), so its this was rex. The arrow keeps that this, wherever it is called later." },
          onReveal: (s) => s.out(arrow, kindOf(arrow)) },
        { say: "Can call change an arrow's this? Press the button. It runs call(tom) on both functions.",
          enter: (s) => { s.src("arrow"); s.out("—", "ask"); },
          action: { label: "Run both with call(tom)", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.out(`normal function: ${D.arrowTry("plainCall")}    arrow: ${D.arrowTry("arrowCall")}`, "ok"); } },
          after: "The normal function followed call(tom). The arrow ignored it. An arrow's this cannot be changed by call, apply or bind." },
        { say: `Now a class. show() is a method: one copy, on Button.prototype. onClick is a class field with an arrow: a new function in every button. Fields are set before the constructor body runs (a constructor that reads this.x saw ${D.show(F.beforeCtor)} here).`,
          enter: (s) => { s.src("field"); s.hl([]); s.out("—", "ask"); },
          show: (s, ctx) => { ctx.callout(s.cast.children[2], "one show() for all", "top"); } },
        { say: "Press the button to compare the two buttons a and b.",
          enter: (s) => { s.src("field"); s.hl(["a", "b"]); s.out("—", "ask"); },
          action: { label: "Compare a and b", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.out(`a.show === b.show  →  ${D.fieldTry("a.show === b.show")}     a.onClick === b.onClick  →  ${D.fieldTry("a.onClick === b.onClick")}`, "ok"); } },
          after: `The method is shared (one copy). The arrow field is different in each button. Button.prototype has only: ${F.protoKeys.join(", ")}.` },
        { say: "Why do people use an arrow field? Look at a detached call.",
          enter: (s) => { s.src("field"); s.hl([]); s.out("—", "ask"); },
          guess: { q: "You write const g = a.show; g(). What happens? And with a.onClick?", options: ["show works, onClick fails", "show fails, onClick works", "Both work"], answer: 1, why: "show uses this from the call, and g() has no dot. onClick is an arrow, so its this is the button where it was written." },
          action: { label: "Run const g = a.show; g()", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.out(`const g = a.show; g()  →  ${D.fieldTry("g()", "const g = a.show;")}     const h = a.onClick; h()  →  ${D.fieldTry("h()", "const h = a.onClick;")}`, "ok"); } } },
        { say: `The price: each button gets its own onClick function, and onClick is not on the prototype. A subclass method named onClick does not override it: the field on the instance wins (new Sub().onClick() gave ${D.show(F.subOverride)} here). Use a field for handlers you pass around, a method for the rest.`,
          enter: (s) => { s.src("field"); s.hl(["a", "b"]); s.row.hidden = false; s.out("Press a call above.", "ask"); } },
      ],
      takeaway: "An arrow function takes this from where it was written. A method takes this from how it is called.",
      check: {
        q: "A class has save() as a normal method. You pass this.save to a button. What is the least change that works?",
        options: ["Change save to an arrow field: save = () => {…}", "Add return this to save", "Nothing: classes bind methods for you"], answer: 0,
        why: ["Yes. (Or bind it in the constructor, or pass () => this.save().)", "That changes what save returns. It does not change this.", "Classes do not bind methods. That is the whole problem."],
      },
    });
  };

  /* ---------- 06. A class is the same chain ---------- */
  V.classChain = () => {
    const make = (src) => D.makeZoo(src);
    const labels = (zoo) => D.walkChain(zoo.rex, "rex").map((n) => n.label);
    const zoos = { function: make(D.FUNC_SRC), class: make(D.CLASS_SRC) };
    const SAFE = D.classSafety();
    const evalOn = (style, expr) => D.shown({ ok: true, value: new Function("rex", "Dog", "Animal", "return " + expr + ";")(zoos[style].rex, zoos[style].Dog, zoos[style].Animal) });
    return guided({
      title: "A class is the same chain",
      build(view) {
        const code = h("div.th-codebox");
        const chain = h("div.th-chain");
        const out = outBox("Result");
        const row = h("div.th-chips", { hidden: true }, h("span.label", "Try"),
          ['rex instanceof Animal', 'rex.hasOwnProperty("speak")', "rex.speak()", "Object.getPrototypeOf(Dog) === Animal"].map((e) => {
            const b = h("button.chip", { type: "button" }, e);
            b.addEventListener("click", () => s.out(`${e}  →  ${evalOn(s.style, e)}`));
            return b;
          }));
        const tabs = ["function", "class"].map((k) => {
          const b = h("button.chip", { type: "button", "aria-pressed": "false" }, k === "function" ? "Old way: functions" : "New way: class");
          b.addEventListener("click", () => s.set(k));
          return b;
        });
        const tabRow = h("div.th-chips", { hidden: true }, tabs);
        view.append(h("div.th-classchain", tabRow, code, chain, out.el, row));
        const s = {
          style: "function", row, tabRow,
          set(k) {
            s.style = k;
            code.replaceChildren(Book.code(k === "class" ? D.CLASS_SRC : D.FUNC_SRC));
            chain.replaceChildren(...labels(zoos[k]).flatMap((t, i) => [...(i ? [h("span.th-arrow", "→")] : []), h("span", { class: "th-link" + (t === "null" ? " th-end" : "") }, t)]));
            tabs.forEach((b, i) => b.setAttribute("aria-pressed", String(["function", "class"][i] === k)));
          },
          out(t, k) { out.set(t, k || "ok"); },
          chain,
        };
        return s;
      },
      steps: [
        { say: "Here is Animal and Dog the old way, with functions. Object.create(Animal.prototype) makes a new empty object that links to Animal.prototype. Dog.prototype becomes that object. This line builds the chain.",
          enter: (s) => { s.set("function"); s.tabRow.hidden = true; s.row.hidden = true; s.out("—", "ask"); },
          show: (s, ctx) => ctx.callout(s.chain, "the chain, found by walking getPrototypeOf", "top") },
        { say: "Two more old lines. Animal.call(this, name) runs Animal's setup on the new dog. This is the old super(name). The line Dog.prototype.constructor = Dog puts back the link from Dog.prototype to Dog.",
          enter: (s) => { s.set("function"); s.tabRow.hidden = true; s.row.hidden = true; s.out("—", "ask"); } },
        { say: "Now the same two types with class and extends.",
          enter: (s) => { s.set("class"); s.tabRow.hidden = true; s.row.hidden = true; s.out("—", "ask"); },
          after: () => `The chain is the same: ${labels(zoos.class).join(" → ") === labels(zoos.function).join(" → ")}. class writes it for you, and adds a few safety rules: calling it without new throws (${SAFE.noNew}); its code is always strict; methods are not enumerable (Object.keys(Dog.prototype) is ${JSON.stringify(SAFE.keysClass)} with class and ${JSON.stringify(SAFE.keysFunc)} the old way); and #private fields cannot be read from outside (a SyntaxError: ${SAFE.privateSyntax}).` },
        { say: "Where does the speak method live? Think about the chain.",
          enter: (s) => { s.set("class"); s.out("—", "ask"); },
          guess: { q: "Does rex hold its own copy of speak?", options: ["Yes, each dog has one", "No, it is found up the chain"], answer: 1, why: "speak is on Dog.prototype. rex finds it by walking up. One copy serves every dog." },
          onReveal: (s) => s.out(`rex.hasOwnProperty("speak")  →  ${evalOn("class", 'rex.hasOwnProperty("speak")')}`) },
        { say: "super.speak() means: call the version one step up the chain, but keep this. The old way writes it by hand.",
          enter: (s) => { s.set("function"); s.out("—", "ask"); },
          action: { label: "Run rex.speak() in both", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.out(`old way: ${evalOn("function", "rex.speak()")}    class: ${evalOn("class", "rex.speak()")}`); } },
          after: "Animal.prototype.speak.call(this) is what super.speak() does." },
        { say: "One more difference: class also links Dog itself to Animal, so static methods are inherited. The old way does not.",
          enter: (s) => { s.set("class"); s.out("—", "ask"); },
          action: { label: "Check Object.getPrototypeOf(Dog) === Animal", icon: "play", run: async (s, ctx) => { await ctx.wait(250); s.out(`old way: ${evalOn("function", "Object.getPrototypeOf(Dog) === Animal")}    class: ${evalOn("class", "Object.getPrototypeOf(Dog) === Animal")}`); } } },
        { say: "Your turn. Switch the style, then press a check. The answers come from running the code.",
          enter: (s) => { s.set("class"); s.tabRow.hidden = false; s.row.hidden = false; s.out("Press a check above.", "ask"); } },
      ],
      takeaway: "class and extends build the same prototype chain as the old function code. Methods live on the prototype, and objects find them by walking up.",
      check: {
        q: "You write class Dog extends Animal. Where does the speak method of Dog end up?",
        options: ["On every dog object", "On Dog.prototype", "On Animal.prototype"], answer: 1,
        why: ["Methods are not copied into each object. Only fields are.", "Yes. Every dog finds it there by walking up the chain.", "That is where Animal's own speak lives. Dog has its own, one step nearer."],
      },
    });
  };

  /* ---------- 02. The "who is this?" ladder (film, generated from the cases) ---------- */
  V.ladder = () => {
    const cases = D.cases;
    const results = cases.map((c) => D.runCase(c));
    const codes = cases.map((c) => D.caseCode(c).split("\n"));
    const maxLines = Math.max(...codes.map((l) => l.length));
    const thisText = (r, c) => (r === "globalThis" || r === "undefined" ? r : c.id === "new" ? `Dog { name: "${r}" }` : `{ name: "${r}", … }`);
    const geo = (layout) => {
      const wide = layout === "wide";
      const lh = wide ? 19 : 16;
      const ch = maxLines * lh + 26;
      if (wide) return { W: 780, H: 372, lh, fs: 12, code: { x: 12, y: 34, w: 360, h: ch }, rows: { x: 396, y: 34, w: 372, h: 54, gap: 8 }, res: { x: 12, y: 34 + ch + 16, w: 360, h: 336 - (34 + ch + 16) } };
      const ry = 34 + ch + 28;
      return { W: 400, H: ry + 274 + 14 + 70 + 12, lh, fs: 10.5, code: { x: 12, y: 34, w: 376, h: ch }, rows: { x: 12, y: ry, w: 376, h: 50, gap: 6 }, res: { x: 12, y: ry + 274 + 14, w: 376, h: 70 } };
    };
    const gw = geo("wide");
    const gt = geo("tall");
    return Book.film({
      title: "Who is this? Seven calls, one ladder", wide: [gw.W, gw.H], tall: [gt.W, gt.H],
      build(svg, Fm, layout) {
        const g = layout === "wide" ? gw : gt;
        svg.append(S("text", { x: g.code.x + 2, y: g.code.y - 10, class: "fl-small" }, "The code"),
          S("text", { x: g.rows.x + 2, y: g.rows.y - 10, class: "fl-small" }, "Ask these questions, from the top. The first yes wins."),
          S("rect", { x: g.res.x, y: g.res.y, width: g.res.w, height: g.res.h, rx: 12, class: "fl-field" }),
          S("text", { x: g.res.x + 14, y: g.res.y + 22, class: "fl-small" }, "At the last line, this is"));
        const rowY = (i) => g.rows.y + i * (g.rows.h + g.rows.gap);
        const rowA = D.ladder.map((r, i) => {
          const y = rowY(i);
          const grp = S("g");
          const t = (cls, dy, txt) => S("text", { x: g.rows.x + 14, y: y + dy, class: cls }, txt);
          const parts = [
            S("rect", { x: g.rows.x, y, width: g.rows.w, height: g.rows.h, rx: 12, class: "fl-field" }),
            S("rect", { x: g.rows.x, y, width: g.rows.w, height: g.rows.h, rx: 12, class: "fl-ink" }),
            t("th-t1", g.rows.h / 2 - 3, r.name), t("th-t2", g.rows.h / 2 + 14, r.sub),
            t("th-t1 th-inv", g.rows.h / 2 - 3, r.name), t("th-t2 th-inv", g.rows.h / 2 + 14, r.sub),
            S("text", { x: g.rows.x + g.rows.w - 14, y: y + g.rows.h / 2 + 4, "text-anchor": "end", class: "th-tag" }, "no"),
          ];
          grp.append(...parts);
          svg.append(grp);
          return Fm.actor(grp, { no: 0, yes: 0 }, (p) => {
            parts[1].setAttribute("opacity", p.yes);
            [parts[2], parts[3]].forEach((e) => e.setAttribute("opacity", (1 - p.yes) * (1 - 0.5 * p.no)));
            [parts[4], parts[5]].forEach((e) => e.setAttribute("opacity", p.yes));
            parts[6].setAttribute("opacity", p.no * (1 - p.yes));
          });
        });
        const ring = S("rect", { x: g.rows.x - 3, width: g.rows.w + 6, height: g.rows.h + 6, rx: 14, class: "th-ring" });
        svg.append(ring);
        const ringA = Fm.actor(ring, { r: 0, o: 0 }, (p, n) => { n.setAttribute("y", rowY(0) - 3 + p.r * (g.rows.h + g.rows.gap)); n.setAttribute("opacity", p.o); });

        let T = 0.3;
        cases.forEach((c, k) => {
          const cg = S("g");
          cg.append(S("rect", { x: g.code.x, y: g.code.y, width: g.code.w, height: g.code.h, rx: 12, class: "fl-code-bg" }));
          const top = g.code.y + 14;
          cg.append(S("rect", { x: g.code.x + 4, y: top + (codes[k].length - 1) * g.lh, width: g.code.w - 8, height: g.lh, rx: 5, class: "fl-line-bar" }));
          codes[k].forEach((text, i) => {
            const tx = S("text", { x: g.code.x + 12, y: top + i * g.lh + g.lh * 0.78, class: "fl-code", style: `font-size:${g.fs}px`, "xml:space": "preserve" });
            for (const tk of Book.tokens(text)) tx.append(S("tspan", { class: tk.type === "plain" || tk.type === "space" ? "syn-plain" : `syn-${tk.type}` }, tk.text));
            cg.append(tx);
          });
          cg.append(S("text", { x: g.code.x + g.code.w - 10, y: g.code.y + g.code.h - 8, "text-anchor": "end", class: "th-modelbl" }, c.mode === "strict" ? "strict mode" : "sloppy mode"));
          svg.append(cg);
          const codeA = Fm.actor(cg, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));
          const rt = S("text", { x: g.res.x + 14, y: g.res.y + g.res.h - 22, class: "th-resbig" }, "this = " + thisText(results[k], c));
          svg.append(rt);
          const resA = Fm.actor(rt, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));

          const fires = D.ladder.findIndex((r) => r.id === c.rule);
          Fm.chapter(T, `Case ${k + 1}: ${c.title}`);
          rowA.forEach((a) => Fm.to(a, { no: 0, yes: 0 }, T, 0.3));
          Fm.to(codeA, { o: 1 }, T, 0.5);
          Fm.say(T, `Case ${k + 1} of ${cases.length}: ${c.title}. This code runs in ${c.mode} mode${c.mode === "sloppy" ? " (the normal mode of a plain script)" : ""}. Who is this at the last line?`);
          T += 3;
          Fm.set(ringA, { r: 0 }, T - 0.4);
          Fm.to(ringA, { o: 1 }, T - 0.4, 0.3);
          for (let r = 0; r <= fires; r++) {
            Fm.to(ringA, { r }, T, 0.45);
            if (r < fires) {
              Fm.say(T, `${D.ladder[r].name} ${D.ladder[r].no}`);
              Fm.to(rowA[r], { no: 1 }, T + 0.35, 0.3);
              T += 1.3;
            } else {
              Fm.say(T, `Yes. ${c.yes}`);
              Fm.to(rowA[r], { yes: 1 }, T + 0.35, 0.3);
              Fm.to(resA, { o: 1 }, T + 1, 0.4);
              T += 4;
            }
          }
          Fm.to(codeA, { o: 0 }, T, 0.4);
          Fm.to(resA, { o: 0 }, T, 0.4);
          Fm.to(ringA, { o: 0 }, T, 0.3);
          T += 0.6;
        });
        Fm.chapter(T, "The ladder");
        rowA.forEach((a) => Fm.to(a, { no: 0, yes: 0 }, T, 0.3));
        Fm.say(T, "Check from the top: arrow, new, call or bind, a dot, then a plain call. The first yes decides this. Only the plain call depends on strict or sloppy mode.");
        Fm.end(T + 6);
      },
    });
  };

  /* ---------- 05. The prototype chain (film: the chain is walked for real with Object.getPrototypeOf) ---------- */
  V.chain = () => {
    const zoo = D.makeZoo(D.CLASS_SRC);
    const chain = D.walkChain(zoo.rex, "rex");
    const chk = D.checks(zoo);
    const real = chain.length - 1;
    const BW = 132; const BH = 124;
    const TW = 292; const TH = 96;
    const getProbe = (l) => {
      const L = D.lookup(chain, l.key);
      const lastI = L.foundAt === -1 ? real - 1 : L.foundAt;
      const visit = [];
      for (let i = 0; i <= lastI; i++) {
        const hit = L.steps[i];
        const ask = i === 0 ? `Does rex have its own "${l.key}"?` : `Go up to ${chain[i].label}. Does it have "${l.key}"?`;
        visit.push({ i, word: hit ? "found" : "no", say: `${ask} ${hit ? "Yes. Stop here." : "No."}` });
      }
      if (L.foundAt === -1) visit.push({ i: real, word: "end", say: "The next step is null. That is the end of the chain." });
      const shadow = L.shadowed.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
      const outro = L.foundAt === -1
        ? `No object has "${l.key}", so the answer is undefined. JavaScript does not throw for a missing property.`
        : `Found "${l.key}" on ${chain[L.foundAt].label}.` + (shadow.length ? ` ${shadow.map((i) => chain[i].label).join(" and ")} also has "${l.key}", but the walk stopped sooner, so it is hidden. This is shadowing.` : "");
      return { expr: l.expr, result: "→ " + D.lookupValue(zoo, l), visit, hit: L.foundAt, shadow, intro: `${l.expr}: JavaScript starts at rex and walks up the chain.`, outro };
    };
    const instProbe = ([name, C, value]) => {
      const match = chain.findIndex((n, i) => i > 0 && !n.end && n.obj === C.prototype);
      const lastI = match > 0 ? match : real - 1;
      const visit = [];
      for (let i = 1; i <= lastI; i++) {
        const hit = i === match;
        visit.push({ i, word: hit ? "match" : "not it", say: `Is ${chain[i].label} the same object as ${name}.prototype? ${hit ? "Yes." : "No."}` });
      }
      if (match < 0) visit.push({ i: real, word: "end", say: "The next step is null." });
      return { expr: `rex instanceof ${name}`, result: "→ " + value, visit, hit: match, shadow: [], intro: `instanceof walks up the chain and looks for ${name}.prototype. It starts at the prototype of rex.`, outro: value ? "Found. So the answer is true." : `${name}.prototype is not in the chain. So the answer is false.` };
    };
    const ownProbe = (key, value) => ({
      expr: `rex.hasOwnProperty("${key}")`, result: "→ " + value, visit: [{ i: 0, word: value ? "yes" : "no", say: `Is "${key}" stored on rex itself? ${value ? "Yes." : "No."}` }], hit: value ? 0 : -1, shadow: [],
      intro: "hasOwnProperty looks only at the object itself.", outro: (value ? `Yes: ${key} is stored on rex.` : `No: ${key} is not on rex. It was found up the chain, but hasOwnProperty never walks up.`) + ` Modern code writes Object.hasOwn(rex, "${key}"). It also works on Object.create(null), where rex.hasOwnProperty does not exist.`,
    });
    const groups = [
      ...D.lookups.map((l) => [getProbe(l)]),
      [["Dog", zoo.Dog, chk.instDog], ["Array", Array, chk.instArray]].map(instProbe),
      [ownProbe("name", chk.ownName), ownProbe("speak", chk.ownSpeak)],
    ];
    const titles = [...D.lookups.map((l) => `Read rex.${l.key}`), "instanceof", "hasOwnProperty"];
    const geo = (layout) => {
      const wide = layout === "wide";
      const pos = (i) => (wide ? { x: 12 + i * (BW + 24), y: 92 } : { x: 12, y: 84 + i * (TH + 22) });
      return { wide, w: wide ? BW : TW, h: wide ? BH : TH, pos, W: wide ? 780 : 400, H: wide ? 270 : 84 + 5 * TH + 4 * 22 + 14 };
    };
    const gw = geo("wide"); const gt = geo("tall");
    return Book.film({
      title: "A property lookup walks the prototype chain", wide: [gw.W, gw.H], tall: [gt.W, gt.H],
      build(svg, Fm, layout) {
        const g = layout === "wide" ? gw : gt;
        const mid = (i) => ({ x: g.pos(i).x + g.w / 2, y: g.pos(i).y + g.h / 2 });
        const boxes = chain.map((n, i) => {
          const { x, y } = g.pos(i);
          const grp = S("g");
          grp.append(S("rect", { x, y, width: g.w, height: g.h, rx: 12, class: n.end ? "th-box th-end" : "th-box" }), S("text", { x: x + 12, y: y + 21, class: "th-t1" }, n.label));
          n.keys.forEach((k, j) => grp.append(S("text", { x: x + 12, y: y + 42 + j * 17, class: "th-key" }, k)));
          if (n.more) grp.append(S("text", { x: x + 12, y: y + 42 + n.keys.length * 17, class: "th-key th-mute" }, `+${n.more} more`));
          svg.append(grp);
          return Fm.actor(grp, { o: 0 }, (p, node) => node.setAttribute("opacity", p.o));
        });
        const arrows = chain.slice(1).map((_, i) => {
          const a = g.pos(i); const b = g.pos(i + 1);
          const d = g.wide ? `M ${a.x + g.w + 2} ${a.y + g.h / 2} H ${b.x - 4} m -6 -5 l 6 5 l -6 5` : `M ${a.x + g.w / 2} ${a.y + g.h + 2} V ${b.y - 4} m -5 -6 l 5 6 l 5 -6`;
          const p = S("path", { d, class: "th-arr" });
          svg.append(p);
          return Fm.actor(p, { o: 0 }, (q, node) => node.setAttribute("opacity", q.o));
        });
        const place = (cls) => {
          const r = S("rect", { width: g.w + 8, height: g.h + 8, rx: 15, class: cls });
          svg.append(r);
          return Fm.actor(r, { i: 0, o: 0 }, (p, n) => {
            const i0 = Math.max(0, Math.min(real, Math.floor(p.i)));
            const i1 = Math.min(real, i0 + 1);
            const f = p.i - i0;
            const a = g.pos(i0); const b = g.pos(i1);
            n.setAttribute("x", a.x + (b.x - a.x) * f - 4); n.setAttribute("y", a.y + (b.y - a.y) * f - 4); n.setAttribute("opacity", p.o);
          });
        };
        const fade = (node) => Fm.actor(node, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));
        let T = 0.3;
        Fm.chapter(T, "The chain");
        Fm.to(boxes[0], { o: 1 }, T, 0.5);
        Fm.say(T, `rex is an object made with new Dog("Rex"). It has its own key: ${chain[0].keys.join(", ")}.`);
        T += 3;
        for (let i = 1; i <= real; i++) {
          Fm.to(arrows[i - 1], { o: 1 }, T, 0.4);
          Fm.to(boxes[i], { o: 1 }, T + 0.2, 0.5);
          Fm.say(T, chain[i].end ? "The chain ends at null. Every chain ends there." : `Object.getPrototypeOf(${chain[i - 1].label}) is ${chain[i].label}. The page found this by really walking.`);
          T += 2.6;
        }
        const ring = place("th-ring"); const found = place("th-found");
        groups.forEach((probes, gi) => {
          Fm.chapter(T, titles[gi]);
          probes.forEach((p) => {
            const e = S("text", { x: 14, y: 30, class: "th-expr" }, p.expr);
            const r = S("text", { x: 14, y: 56, class: "th-resline" }, p.result);
            svg.append(e, r);
            const eA = fade(e); const rA = fade(r);
            const stat = (i, word, plain) => {
              const m = mid(i);
              const cls = "th-stat" + (plain ? "" : " th-hit");
              const t = g.wide ? S("text", { x: m.x, y: g.pos(i).y + g.h + 20, "text-anchor": "middle", class: cls }, word) : S("text", { x: g.pos(i).x + g.w + 10, y: m.y + 4, class: cls }, word);
              svg.append(t);
              return fade(t);
            };
            const stats = [];
            Fm.to(eA, { o: 1 }, T, 0.4);
            Fm.say(T, p.intro);
            Fm.set(ring, { i: p.visit[0].i }, T + 0.25);
            Fm.to(ring, { o: 1 }, T + 0.3, 0.4);
            T += 2.4;
            p.visit.forEach((v) => {
              Fm.to(ring, { i: v.i }, T, 0.5);
              const good = v.word === "found" || v.word === "match" || v.word === "yes";
              const s = stat(v.i, v.word, !good);
              stats.push(s);
              Fm.to(s, { o: 1 }, T + 0.4, 0.3);
              Fm.say(T, v.say);
              T += 1.3;
            });
            p.shadow.forEach((i) => { const s = stat(i, "hidden", true); stats.push(s); Fm.to(s, { o: 1 }, T, 0.3); });
            if (p.hit >= 0) { Fm.set(found, { i: p.hit }, T); Fm.to(found, { o: 1 }, T, 0.3); }
            Fm.to(rA, { o: 1 }, T + 0.2, 0.4);
            Fm.say(T, p.outro);
            T += 3.4;
            [eA, rA, ...stats].forEach((a) => Fm.to(a, { o: 0 }, T, 0.35));
            Fm.to(ring, { o: 0 }, T, 0.3);
            Fm.to(found, { o: 0 }, T, 0.3);
            T += 0.5;
          });
        });
        Fm.chapter(T, "The rule");
        Fm.say(T, "To read a property: look at the object, then its prototype, then its prototype, until you find it or reach null. hasOwnProperty looks at the object only.");
        Fm.end(T + 6);
      },
    });
  };
})();
