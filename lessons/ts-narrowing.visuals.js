/* Types, unions and narrowing: the film and the guided pages. Every type, error code and message shown here comes from
   ts-narrowing.data.js: the compiler's answers are stored there (FACTS) and dev/ts-narrowing.test.js runs tsc again to check them.
   Everything that "runs" runs live in the reader's browser, as JavaScript with the types removed. */
(function () {
  const { h, guided, svg: S } = Book;
  const V = Book.parts["ts-narrowing"];
  const D = V.data;
  const phone = () => window.matchMedia("(max-width: 560px)").matches;

  /* ---------- TypeScript highlighting (the shared highlighter knows JavaScript only, so a few words are added here) ---------- */
  const TS_KW = new Set(["type", "interface", "is", "as", "asserts", "satisfies", "instanceof", "declare", "extends", "keyof", "readonly", "private", "throw", "try", "catch", "switch", "case", "default", "void"]);
  const TS_TY = new Set(["string", "number", "boolean", "unknown", "any", "never", "object", "symbol", "bigint"]);
  const tsTokens = (code) => {
    const toks = Book.tokens(code);
    return toks.map((t, i) => {
      const w = t.text;
      if (TS_KW.has(w) && t.type !== "prop" && t.type !== "str") {
        const next = toks.slice(i + 1).find((x) => x.type !== "space");
        if (w === "default" || !(next && next.text === ":")) return { type: "kw", text: w };
      }
      if (TS_TY.has(w) && t.type !== "prop") return { type: "ty", text: w };
      if (t.type === "plain" && /^[A-Z][\w$]*$/.test(w)) return { type: "ty", text: w };
      return t;
    });
  };
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tsHtml = (code) => tsTokens(code).map((t) => (t.type === "plain" || t.type === "space" ? esc(t.text) : `<span class="${t.type === "ty" ? "tn-ty" : "syn-" + t.type}">${esc(t.text)}</span>`)).join("");

  /* ---------- small text helpers ---------- */
  const fmtVal = (v) => (v === undefined ? "undefined" : typeof v === "string" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(fmtVal).join(", ")}]` : v && typeof v === "object" ? `{ ${Object.entries(v).map(([k, x]) => `${k}: ${fmtVal(x)}`).join(", ")} }` : String(v));
  const resultLines = (res) => [...res.logs.map((t) => ({ t })), ...(res.error ? [{ t: `${res.error.name}: ${res.error.message}`, err: true }] : res.value != null ? [{ t: fmtVal(res.value) }] : [])];
  const code = (text) => h("code", text);
  const typeText = (members) => members.join(" | ");

  /* ---------- the code box: TypeScript with line numbers, lit lines, tsc messages under the lines, and a "JavaScript that runs" switch ---------- */
  function codeBox() {
    const name = h("span.tn-file");
    const foldBtn = h("button.chip.tn-sm", { type: "button", "aria-pressed": "false" });
    const jsBtn = h("button.chip.tn-sm", { type: "button", "aria-pressed": "false" }, "Show the JavaScript that runs");
    const body = h("pre.code-block.tn-code", { "aria-label": "Code" });
    const el = h("div.tn-codebox", h("div.tn-codebar", name, h("div.tn-barbtns", foldBtn, jsBtn)), body);
    let cur = null, unfold = false, js = false;
    function paint() {
      if (!cur) return;
      const { id, o } = cur;
      const sn = D.SN[id];
      body.replaceChildren();
      jsBtn.setAttribute("aria-pressed", String(js));
      jsBtn.textContent = js ? "Back to TypeScript" : "Show the JavaScript that runs";
      jsBtn.hidden = !D.jsOf(id);
      if (js) {
        name.textContent = "JavaScript · the types are removed";
        foldBtn.hidden = true;
        D.jsOf(id).split("\n").forEach((l) => body.append(h("span.tn-ln.plain", { html: Book.highlight(l) || " " })));
        return;
      }
      name.textContent = "TypeScript · example.ts";
      const first = unfold ? 0 : sn.fold;
      foldBtn.hidden = !sn.fold;
      foldBtn.textContent = unfold ? "Hide the helper code" : `Show ${sn.fold} hidden lines`;
      foldBtn.setAttribute("aria-pressed", String(unfold));
      const errs = o.errors ? D.errorsOf(id) : [];
      sn.ts.split("\n").forEach((text, i) => {
        if (i < first) return;
        const n = i + 1;
        const cls = [(o.lit || []).includes(n) && "lit", (o.added || []).includes(n) && "added", errs.some((e) => e.line === n) && "err"].filter(Boolean).join(".");
        body.append(h("span.tn-ln" + (cls ? "." + cls : ""), { "data-n": n, html: tsHtml(text) || " " }));
        errs.filter((e) => e.line === n).forEach((e) => body.append(h("span.tn-diag", h("b", `error ${e.code}`), " ", e.msg, (e.more || []).map((m) => h("span.tn-more", m)))));
      });
      body.classList.toggle("has-lit", Boolean((o.lit || []).length));
    }
    foldBtn.addEventListener("click", () => { unfold = !unfold; paint(); });
    jsBtn.addEventListener("click", () => { js = !js; paint(); });
    return { el, show(id, o = {}) { if (!cur || cur.id !== id) unfold = false; js = false; cur = { id, o }; paint(); } };
  }

  /* The compiler's box: shows what tsc said (stored facts), never invented. */
  function tscBox() {
    const body = h("div.tn-tsc-body", { "aria-live": "polite" });
    const el = h("div.tn-side", h("span.label", `Compiler · tsc ${D.TSC_VERSION} --strict`), body);
    const set = (nodes) => body.replaceChildren(...nodes);
    const idle = () => set([h("span.tn-dim", "Not run yet.")]);
    idle();
    return {
      el, idle,
      run(id) {
        const errs = D.errorsOf(id);
        set(errs.length
          ? [...errs.map((e) => h("div.tn-tsc-err", h("b", `line ${e.line} · error ${e.code}`), h("span", e.msg))), h("div.tn-tsc-sum.bad", `${errs.length} error${errs.length === 1 ? "" : "s"}`)]
          : [h("div.tn-tsc-sum.good", "0 errors")]);
      },
      say(text) { set([h("div.tn-tsc-sum.good", text)]); },
    };
  }

  /* The run box: lines that a live run printed or threw. */
  function outBox(title = "Run in this browser") {
    const body = h("div.tn-out-body", { "aria-live": "polite" });
    const el = h("div.tn-side", h("span.label", title), body);
    const set = (lines) => body.replaceChildren(...(lines.length ? lines : [{ t: "Not run yet.", dim: true }]).map((l) => h("div.tn-out-line" + (l.err ? ".err" : "") + (l.dim ? ".dim" : ""), l.t)));
    set([]);
    return { el, set, clear: () => set([]), show: (res) => set(resultLines(res)) };
  }

  /* A panel of type chips (HTML). The chips are the members of a union; they can be lit, dimmed or crossed out. */
  function typeChips(members) {
    const chips = members.map((m) => h("span.tn-tchip", { html: tsHtml(m) }));
    const el = h("div.tn-tchips", { role: "list", "aria-label": "The types v can still be" }, chips.map((c) => { c.setAttribute("role", "listitem"); return c; }));
    return {
      el,
      set({ hot = [], gone = [], dim = [] } = {}) {
        chips.forEach((c, i) => {
          const m = members[i];
          c.classList.toggle("hot", hot.includes(m));
          c.classList.toggle("gone", gone.includes(m));
          c.classList.toggle("dim", dim.includes(m));
        });
      },
    };
  }

  /* ---------- 01. Will TypeScript accept this function? ---------- */
  V.start = () => guided({
    title: "Will TypeScript accept this function?",
    build(view) {
      const cb = codeBox(), tsc = tscBox(), out = outBox();
      const mk = (key, list) => list.map(([text, v]) => { const b = h("button.chip", { type: "button", "aria-pressed": "false" }, text); b.addEventListener("click", () => { s[key] = v; sync(); }); b.dataset.v = v; return b; });
      const vers = mk("ver", [["no check", "shoutBad"], ["with typeof", "shoutGood"]]);
      const args = mk("arg", [["\"hello\"", "str"], ["42", "num"]]);
      const picker = h("div.tn-chips", { hidden: true }, h("span.label", "Version"), vers, h("span.label", "Value"), args);
      view.append(h("div.tn-pair", h("div.tn-col", cb.el), h("div.tn-col", tsc.el, out.el)), picker);
      const s = { cb, tsc, out, picker, ver: "shoutBad", arg: "num" };
      const sync = () => { vers.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === s.ver))); args.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === s.arg))); cb.show(s.ver, { lit: [] }); };
      s.sync = sync;
      s.run = async (ver, arg) => D.runCase(ver, arg);
      return s;
    },
    steps: [
      {
        say: "A parameter can accept two kinds of value. string | number means: a string OR a number.",
        enter: (s) => { s.cb.show("shoutBad", { lit: [1] }); s.tsc.idle(); s.out.clear(); s.picker.hidden = true; },
      },
      {
        say: "The function calls x.toUpperCase() on line 2. Think about what TypeScript does before any code runs.",
        enter: (s) => { s.cb.show("shoutBad", { lit: [2] }); s.tsc.idle(); s.out.clear(); s.picker.hidden = true; },
        guess: { q: "Will the compiler accept line 2?", options: ["Yes: strings have toUpperCase", "No: it reports an error", "Yes, and it only fails at run time"], answer: 1, why: "A number has no toUpperCase. The compiler checks every kind of value that x can be, and one of them fails." },
        action: { label: "Ask the compiler", icon: "play", prompt: "Press the button to see the compiler's answer.", run: async (s, ctx) => { await ctx.wait(300); s.cb.show("shoutBad", { lit: [2], errors: true }); s.tsc.run("shoutBad"); } },
        after: () => `The message says it plainly: ${D.errorsOf("shoutBad")[0].more[0]}`,
      },
      {
        say: "Add a check. Inside the if, x is a string; after it, a number.",
        enter: (s) => { s.cb.show("shoutGood", { lit: [2, 3] }); s.tsc.idle(); s.out.clear(); s.picker.hidden = true; },
        action: { label: "Ask the compiler again", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.cb.show("shoutGood", { lit: [3, 5], errors: true }); s.tsc.run("shoutGood"); } },
        after: () => "No errors. This is called narrowing: the check made the type smaller in this part of the code. The compiler confirmed x is string on line 3 and number on line 5.",
      },
      {
        say: "Now the code runs. The browser never sees the types: they are removed first.",
        enter: (s) => { s.cb.show("shoutBad", { lit: [2] }); s.tsc.idle(); s.out.clear(); s.picker.hidden = true; },
        guess: { q: "What happens when the version with no check runs shout(42)?", options: ["It returns \"42\"", "It throws a TypeError", "It returns an empty string"], answer: 1, why: "Types are gone at run time. 42 is a number, and numbers have no toUpperCase method." },
        action: { label: "Run shout(42) with no check", icon: "play", run: async (s) => { s.out.show(await s.run("shoutBad", "num")); } },
        after: () => "TypeScript warned you about this before the code ran. The run shows what would have happened to a user.",
      },
      {
        say: "Free play: pick a version and a value, then run it.",
        enter: (s) => { s.picker.hidden = false; s.sync(); s.tsc.idle(); s.out.clear(); },
        action: { label: "Run it", icon: "play", again: true, run: async (s) => { s.out.show(await s.run(s.ver, s.arg)); } },
        after: (s) => `The ${s.ver === "shoutBad" ? "version with no check" : "version with typeof"} ran with ${s.arg === "str" ? "\"hello\"" : "42"}.`,
      },
    ],
    takeaway: "TypeScript checks every way a value could be used before the code runs, and a check like typeof tells it which way is safe.",
    check: {
      q: "Why did the compiler reject x.toUpperCase() in the first version?",
      options: ["x might be a number, and numbers have no toUpperCase", "toUpperCase does not exist in JavaScript", "string | number is not a real type"],
      answer: 0,
      why: ["Right. One of the two possible types fails, so the whole line fails.", "It exists, but only on strings.", "It is a real type: a string or a number."],
    },
  });

  /* ---------- 02. The film: the type narrows as the code runs ---------- */
  const P = (t) => t.replace(/`/g, ""); // guided pages show plain text, so code quotes are dropped
  const words = (t) => t.replace(/`/g, "").split(/\s+/).filter(Boolean).length;
  const secs = (t) => Math.max(2.5, 1 + words(t) / 2.6);

  V.film = () => {
    const sn = D.SN.film;
    const shown = sn.ts.split("\n").slice(sn.fold);
    const members = D.VALUE;
    const G = (layout) => {
      const wide = layout === "wide";
      const W = wide ? 780 : 330;
      const fs = wide ? 12.5 : 12;
      const lh = wide ? 20 : 17.5;
      const codeH = shown.length * lh + 20;
      const g = { wide, W, fs, lh, code: { x: 8, y: 30, w: wide ? 340 : W - 16, h: codeH } };
      if (wide) { g.chip = { x: 384, y: 30, w: 388, h: 34, gap: 9, cols: 1 }; g.H = Math.max(codeH + 44, 30 + members.length * 43 + 44); }
      else { g.chip = { x: 8, y: 30 + codeH + 34, w: (W - 24) / 2, h: 32, gap: 8, cols: 2 }; g.H = g.chip.y + Math.ceil(members.length / 2) * 40 + 12; }
      return g;
    };
    const dims = (l) => { const g = G(l); return [g.W, g.H]; };
    return Book.film({
      title: "The type of v, line by line", wide: dims("wide"), tall: dims("tall"),
      build(svg, Fm, layout) {
        const g = G(layout);
        svg.append(S("rect", { x: g.code.x, y: g.code.y, width: g.code.w, height: g.code.h, rx: 12, class: "fl-code-bg" }), S("text", { x: g.code.x + 2, y: g.code.y - 10, class: "fl-small" }, "The code"));
        const bar = S("rect", { x: g.code.x + 4, width: g.code.w - 8, height: g.lh, rx: 5, class: "fl-line-bar" });
        svg.append(bar);
        shown.forEach((text, i) => {
          const tx = S("text", { x: g.code.x + 12, y: g.code.y + 10 + i * g.lh + g.lh * 0.74, class: "fl-code", style: `font-size:${g.fs}px`, "xml:space": "preserve" });
          for (const t of tsTokens(text)) tx.append(S("tspan", { class: t.type === "plain" || t.type === "space" ? "syn-plain" : t.type === "ty" ? "tn-fty" : `syn-${t.type}` }, t.text));
          svg.append(tx);
        });
        const barA = Fm.actor(bar, { line: 0, o: 0 }, (p, n) => { n.setAttribute("y", g.code.y + 10 + p.line * g.lh); n.setAttribute("opacity", Math.max(0, p.o).toFixed(3)); });
        svg.append(S("text", { x: g.chip.x + 2, y: g.chip.y - 10, class: "fl-small" }, "What v can be at the lit line"));

        const chips = members.map((m, i) => {
          const col = i % g.chip.cols, row = Math.floor(i / g.chip.cols);
          const x = g.chip.x + col * (g.chip.w + 8), y = g.chip.y + row * (g.chip.h + g.chip.gap);
          const node = S("g");
          const rect = S("rect", { x, y, width: g.chip.w, height: g.chip.h, rx: 9, class: "tn-fchip" });
          const label = S("text", { x: x + 12, y: y + g.chip.h / 2 + 4.5, class: "tn-fchip-t", style: `font-size:${g.wide ? 13 : 12}px`, "xml:space": "preserve" }, m);
          const strike = S("line", { x1: x + 8, x2: x + 8, y1: y + g.chip.h / 2, y2: y + g.chip.h / 2, class: "tn-fstrike", opacity: 0 });
          node.append(rect, label, strike);
          svg.append(node);
          return Fm.actor(node, { hot: 0, dim: 0, gone: 0 }, (p) => {
            node.setAttribute("opacity", (1 - 0.62 * Math.max(p.dim, p.gone)).toFixed(3));
            rect.setAttribute("class", "tn-fchip" + (p.hot > 0.5 ? " hot" : ""));
            strike.setAttribute("x2", (x + 8 + (g.chip.w - 16) * p.gone).toFixed(1));
            strike.setAttribute("opacity", p.gone > 0.02 ? 1 : 0);
          });
        });

        let T = 0.3;
        let base = members; // what is still possible for the rest of the function
        D.FILM_STOPS.forEach((st, k) => {
          if (st.ch) Fm.chapter(k === 0 ? 0 : T, st.ch);
          Fm.say(k === 0 ? 0 : T, st.say);
          Fm.to(barA, { line: st.line - 1 - sn.fold, o: 1 }, T, 0.35);
          const inside = st.role === "in";
          if (!inside) base = st.members;
          members.forEach((m, i) => {
            const gone = !base.includes(m);
            const hot = inside && st.members.includes(m);
            const dim = inside && !hot && !gone;
            Fm.to(chips[i], { hot: hot ? 1 : 0, dim: dim ? 1 : 0, gone: gone ? 1 : 0 }, T + 0.15, 0.5);
          });
          T += secs(st.say);
        });
        Fm.end(T + 0.8);
      },
    });
  };

  /* ---------- 02b. Narrow it yourself: guess what v is at a lit line, then see the compiler's answer ---------- */
  V.predict = () => {
    const stops = D.FILM_STOPS;
    const before = (q) => { const k = stops.findIndex((st) => st.line === q.line && st.role !== "end"); for (let j = k - 1; j >= 0; j--) if (stops[j].role !== "in") return stops[j].members; return D.VALUE; };
    const answerOf = (q) => stops.find((st) => st.line === q.line && st.role !== "end").members;
    const placed = [1, 0, 2]; // where the right answer sits in each question's options
    const qs = D.PREDICT.map((q, i) => {
      const opts = q.wrong.map(typeText);
      opts.splice(placed[i], 0, typeText(answerOf(q)));
      return { ...q, opts, right: placed[i], base: before(q), answer: answerOf(q) };
    });
    return guided({
      title: "Narrow it yourself",
      build(view) {
        const cb = codeBox();
        const chips = typeChips(D.VALUE);
        view.append(h("div.tn-pair", h("div.tn-col", cb.el), h("div.tn-col", h("span.label", "The types v can still be"), chips.el)));
        return { cb, chips };
      },
      steps: [
        { say: "Now you try. Guess what v can be at the lit line.", enter: (s) => { s.cb.show("film", { lit: [] }); s.chips.set({}); } },
        ...qs.map((q) => ({
          say: P(q.ask),
          enter: (s) => { s.cb.show("film", { lit: [q.line] }); s.chips.set({ gone: D.VALUE.filter((m) => !q.base.includes(m)) }); },
          guess: { q: "What is the type of v?", options: q.opts, answer: q.right, why: P(`${q.why} The compiler agrees: v is ${typeText(q.answer)} here.`) },
          onReveal: (s) => {
            const inside = stops.find((st) => st.line === q.line).role === "in";
            s.chips.set(inside
              ? { hot: q.answer, dim: q.base.filter((m) => !q.answer.includes(m)), gone: D.VALUE.filter((m) => !q.base.includes(m)) }
              : { gone: D.VALUE.filter((m) => !q.answer.includes(m)) });
          },
        })),
      ],
      takeaway: "Each check removes the types it matched from what is left, and after a block that returns, those types stay gone for the rest of the function.",
      check: {
        q: "After if (typeof v === \"string\") { return v; }, can v still be a string?",
        options: ["Yes, typeof does not change v", "No: the block returned, so a string never gets past it"],
        answer: 1,
        why: ["The check does change what the compiler knows.", "Right. Below the block, string is no longer possible. The film showed it crossed out."],
      },
    });
  };

  /* ---------- 03. The same server answer, two ways ---------- */
  const BODY = Object.fromEntries(D.BODIES.map((b) => [b.id, b]));
  const WAYS = [["any", "anyList"], ["unknown and a guard", "guardList"]];
  const GL = D.SN.guardList.fold; // lines of helper code folded away above listNames
  const verdict = (way, body, res) => (res.error ? "It crashed. The compiler could not warn you, because any turns the checks off."
    : way === "anyList" && body === "wrong" ? "It did not crash, but the list is [undefined]. Bad data went through silently."
      : way === "guardList" && body !== "good" ? "The guard turned the bad answer into an empty list. Safe, but it does not say why it failed."
        : "It worked, because the answer was exactly what the code expected.");

  V.anyUnknown = () => guided({
    title: "The same server answer, two ways",
    build(view) {
      const cb = codeBox(), tsc = tscBox(), out = outBox();
      const bodyLine = h("p.tn-bodyline", { hidden: true });
      const chipSet = (list, key) => list.map(([text, v]) => { const b = h("button.chip", { type: "button", "aria-pressed": "false" }, text); b.dataset.v = v; b.addEventListener("click", () => { s[key] = v; sync(); }); return b; });
      const bodyBtns = chipSet(D.BODIES.map((b) => [b.label, b.id]), "body");
      const wayBtns = chipSet(WAYS, "way");
      const picker = h("div.tn-chips", { hidden: true }, h("span.label", "Server answer"), bodyBtns, h("span.label", "Code"), wayBtns);
      view.append(h("div.tn-pair", h("div.tn-col", cb.el), h("div.tn-col", bodyLine, tsc.el, out.el)), picker);
      const s = { cb, tsc, out, bodyLine, picker, body: "error", way: "anyList" };
      const showBody = (id) => { bodyLine.hidden = false; bodyLine.replaceChildren("The server sent: ", code(BODY[id].text)); };
      const sync = () => {
        bodyBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === s.body)));
        wayBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === s.way)));
        showBody(s.body);
        cb.show(s.way, { lit: s.way === "guardList" ? [GL + 3, GL + 4, GL + 5, GL + 6] : [5] });
      };
      Object.assign(s, { showBody, sync });
      return s;
    },
    steps: [
      {
        say: "JSON.parse gives back a value of the type any.",
        enter: (s) => { s.cb.show("anyList", { lit: [4] }); s.tsc.idle(); s.out.clear(); s.bodyLine.hidden = true; s.picker.hidden = true; },
      },
      {
        say: "The server fails and sends an error answer instead of the users. Line 5 reads data.users.",
        enter: (s) => { s.cb.show("anyList", { lit: [5] }); s.tsc.idle(); s.out.clear(); s.showBody("error"); s.picker.hidden = true; },
        guess: { q: "When do you find out that something is wrong?", options: ["The compiler warns me before I run it", "At run time, as a crash", "Never: the code just works"], answer: 1, why: "any switched the checks off for data, so the compiler had nothing to say. The crash happens on the user's screen." },
        action: { label: "Compile, then run", icon: "play", prompt: "Press the button to compile and run.", run: async (s, ctx) => { await ctx.wait(300); s.tsc.run("anyList"); await ctx.wait(450); s.out.show(await D.runCase("anyList", "error")); } },
        after: () => "The compiler found 0 errors. The browser threw a TypeError.",
      },
      {
        say: "Change one word: any becomes unknown.",
        enter: (s) => { s.cb.show("unkList", { lit: [4] }); s.tsc.idle(); s.out.clear(); s.showBody("error"); s.picker.hidden = true; },
        guess: { q: "Does the compiler accept data.users on line 5 now?", options: ["Yes, nothing changed", "No: it stops me before I run", "Yes, with a warning"], answer: 1, why: "Every use of an unknown value is an error until you check what it is." },
        action: { label: "Ask the compiler", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.cb.show("unkList", { lit: [5], errors: true }); s.tsc.run("unkList"); } },
        after: () => "unknown means: I do not know the shape yet, so check before use. Same bug, but now the compiler finds it, not the user.",
      },
      {
        say: "Check the shape first. A function that does this is a type guard.",
        enter: (s) => { s.cb.show("guardList", { lit: [GL + 3, GL + 4, GL + 5, GL + 6] }); s.tsc.idle(); s.out.clear(); s.showBody("error"); s.picker.hidden = true; },
        action: { label: "Compile, then run the error answer", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.tsc.run("guardList"); await ctx.wait(450); s.out.show(await D.runCase("guardList", "error")); } },
        after: () => "No errors and no crash. The guard said this is not a users answer, so the code returns an empty list. It does not tell us why: the next pages fix that.",
      },
      {
        say: "Free play: pick an answer and a code version, then run it.",
        enter: (s) => { s.picker.hidden = false; s.sync(); s.tsc.idle(); s.out.clear(); },
        action: { label: "Compile, then run", icon: "play", again: true, run: async (s, ctx) => { s.tsc.run(s.way); await ctx.wait(300); s.last = await D.runCase(s.way, s.body); s.out.show(s.last); } },
        after: (s) => (s.last ? verdict(s.way, s.body, s.last) : ""),
      },
    ],
    takeaway: "any turns the checker off, so mistakes show up at run time; unknown keeps it on until you check the shape.",
    check: {
      q: "Which one gets a compile error for data.users?",
      options: ["const data = JSON.parse(text)  (any)", "const data: unknown = JSON.parse(text)", "Both of them"],
      answer: 1,
      why: ["With any, the compiler said 0 errors. The crash came at run time.", "Right. unknown makes the compiler ask for a check first.", "Only unknown. any let it through."],
    },
  });

  /* ---------- 05. Three fields, eight states ---------- */
  function flagTable() {
    const rows = D.flagRows();
    const hdr = h("div.tn-row.head", { role: "row" }, ["isLoading", "error", "data", "render(s) gives"].map((t) => h("span", { role: "columnheader" }, t)));
    const parts = rows.map((r, i) => {
      const t = D.flagText(r);
      const res = h("span.tn-res"), tag = h("span.tn-tag", { hidden: true });
      return { res, tag, el: h("div.tn-row", { role: "row", hidden: true, "data-i": i }, h("span", t.loading), h("span", t.error), h("span", t.data), h("span", res, tag)) };
    });
    const el = h("div.tn-table", { role: "table", "aria-label": "All eight combinations of the three fields" }, hdr, parts.map((p) => p.el));
    const state = { n: 0, res: null, tags: false };
    const paint = () => parts.forEach((p, i) => {
      const r = state.res && state.res[i];
      p.el.hidden = i >= state.n;
      p.res.textContent = r ? (r.error ? `crash: ${r.error.message}` : fmtVal(r.value)) : "…";
      p.res.append(p.tag);
      p.el.classList.toggle("crash", Boolean(r && r.error));
      p.tag.hidden = !state.tags;
      p.tag.textContent = rows[i].meant ? "planned" : "not planned";
      p.el.classList.toggle("planned", state.tags && rows[i].meant);
      p.el.classList.toggle("odd", state.tags && !rows[i].meant);
    });
    return {
      el, rows, state, paint,
      set(o) { Object.assign(state, o); paint(); },
      async load() { if (!state.all) state.all = await Promise.all(rows.map((_, i) => D.runCase("flagsBang", "r" + i))); return state.all; },
    };
  }

  V.flags = () => guided({
    title: "Three fields, eight states",
    build(view) {
      const cb = codeBox(), tsc = tscBox(), table = flagTable();
      view.append(h("div.tn-pair", h("div.tn-col", cb.el, tsc.el), h("div.tn-col", table.el)));
      return { cb, tsc, table };
    },
    steps: [
      {
        say: "A screen often keeps three fields: loading, error and data.",
        enter: (s) => { s.cb.show("flagsPlain", { lit: [3, 4, 5] }); s.tsc.idle(); s.table.set({ n: 0, res: null, tags: false }); },
      },
      {
        say: "Line 11 reads s.data, but data can be null there. Ask the compiler about it.",
        enter: (s) => { s.cb.show("flagsPlain", { lit: [11] }); s.tsc.idle(); s.table.set({ n: 0, res: null, tags: false }); },
        action: { label: "Ask the compiler", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.cb.show("flagsPlain", { lit: [11], errors: true }); s.tsc.run("flagsPlain"); } },
        after: () => "Good: the compiler warns about it. A quick way to make the warning go away is to write s.data!",
      },
      {
        say: "A teammate adds ! after s.data to silence the warning. The ! is called a non-null assertion.",
        enter: (s) => { s.cb.show("flagsPlain", { lit: [11], errors: true }); s.tsc.run("flagsPlain"); s.table.set({ n: 0, res: null, tags: false }); },
        guess: { q: "What does the ! do when the code runs?", options: ["It checks that data is not null", "Nothing: it only tells the compiler to stop warning", "It changes null into an empty list"], answer: 1, why: "The ! is for the compiler only. It is removed before the code runs." },
        action: { label: "Apply the quick fix", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.cb.show("flagsBang", { lit: [11] }); s.tsc.run("flagsBang"); } },
        after: () => "The warning is gone and so is the only protection. Press \"Show the JavaScript that runs\" to see that the ! is not there.",
      },
      {
        say: "Count the states. Each field is independent.",
        enter: (s) => { s.cb.show("flagsBang", { lit: [3, 4, 5] }); s.tsc.idle(); s.table.set({ n: 0, res: null, tags: false }); },
        guess: { q: "How many different combinations can the three fields have?", options: ["3", "6", "8"], answer: 2, why: "isLoading has 2 values, error is null or an Error (2), data is null or an array (2). 2 × 2 × 2 = 8, and every combination can exist." },
        action: { label: "List all combinations", icon: "play", run: async (s, ctx) => { for (let n = 1; n <= 8; n++) { s.table.set({ n, res: null }); await ctx.wait(160); } } },
        after: () => "Eight rows. Your code was written for the story of loading, error and data.",
      },
      {
        say: "The ! stopped the warning. Run render() on every row, for real, in this browser.",
        enter: (s) => { s.cb.show("flagsBang", { lit: [8, 9, 10, 11] }); s.tsc.idle(); s.table.set({ n: 8, res: null, tags: false }); },
        guess: { q: "How many of the 8 rows make render() crash?", options: ["None", "One", "Four"], answer: 1, why: "Only one row reaches s.data!.map with data still null." },
        action: { label: "Run render() on each row", icon: "play", run: async (s, ctx) => { const all = await s.table.load(); for (let k = 1; k <= 8; k++) { s.table.set({ res: all.map((r, i) => (i < k ? r : null)) }); await ctx.wait(220); } } },
        after: () => "The crash row is: not loading, no error, no data. A request that ended without setting error or data lands here.",
      },
      {
        say: "Which rows did you plan for? Mark them.",
        enter: (s) => { s.cb.show("flagsBang", { lit: [] }); s.tsc.idle(); s.table.set({ n: 8, tags: false }); s.table.load().then((all) => s.table.set({ res: all })); },
        action: { label: "Mark the states we planned", icon: "play", run: async (s) => { s.table.set({ tags: true, res: await s.table.load() }); } },
        after: () => "Only three rows are planned: loading, error and data. Five are not, and nothing in the types says they cannot happen.",
      },
    ],
    takeaway: "Three separate fields allow eight states, you planned for three, and the types do not stop the other five.",
    check: {
      q: "A fourth field isRefreshing: boolean is added. How many combinations can the fields have now?",
      options: ["9", "12", "16"],
      answer: 2,
      why: ["Adding is not how it grows: every new field multiplies.", "Not 12. Each boolean field doubles the count.", "Right: 2 × 2 × 2 × 2 = 16. Every new field doubles the number of states."],
    },
  });

  /* ---------- 06. One status field, one shape per state ---------- */
  const CARDS = [["loading", []], ["error", ["error: Error"]], ["success", ["data: User[]"]], ["empty", []]];
  const probeType = (k) => D.SN.exh0.probes[k][2][0];
  const EX_FREE = [["loading", "loading"], ["empty", "empty"], ["error", "error"], ["success", "success"], ["a status nobody planned", "paused"]];

  V.union = () => guided({
    title: "One status field, one shape per state",
    build(view) {
      const cb = codeBox(), tsc = tscBox(), out = outBox();
      const strip = h("p.tn-typestrip", { "aria-live": "polite" });
      const cards = CARDS.map(([n, f]) => h("div.tn-card", { hidden: n === "empty" }, h("b", `status: "${n}"`), f.map((x) => h("span", x))));
      const picker = h("div.tn-chips", { hidden: true }, h("span.label", "Send this state to render()"), EX_FREE.map(([text, v]) => { const b = h("button.chip", { type: "button", "aria-pressed": "false" }, text); b.dataset.v = v; b.addEventListener("click", () => { s.pick = v; s.sync(); }); return b; }));
      view.append(h("div.tn-pair", h("div.tn-col", cb.el), h("div.tn-col", h("div.tn-cards", cards), strip, tsc.el, out.el)), picker);
      const s = { cb, tsc, out, strip, cards, picker, k: 0, pick: "paused" };
      s.hot = (n) => cards.forEach((c, i) => c.classList.toggle("hot", CARDS[i][0] === n));
      s.showEmpty = (on) => { cards[3].hidden = !on; };
      s.sync = () => picker.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === s.pick)));
      s.reset = () => { s.k = 0; s.tsc.idle(); s.out.clear(); s.strip.textContent = ""; s.showEmpty(false); s.hot(null); s.picker.hidden = true; };
      return s;
    },
    steps: [
      {
        say: "Give each state its own shape. A field called status says which shape it is.",
        enter: (s) => { s.reset(); s.cb.show("exh0", { lit: [2, 3, 4, 5] }); },
      },
      {
        say: "Now try to build states that should not exist. Lines 7 to 9 each break one rule.",
        enter: (s) => { s.reset(); s.cb.show("unionCheat", { lit: [7, 8, 9] }); },
        guess: { q: "Can you write { status: \"success\" } with no data (line 7)?", options: ["Yes: status is enough", "No: the compiler asks for data", "Yes, but it crashes later"], answer: 1, why: "The success shape requires data. A success with no data cannot be built at all." },
        action: { label: "Ask the compiler", icon: "play", run: async (s, ctx) => { await ctx.wait(300); s.cb.show("unionCheat", { lit: [7, 8, 9], errors: true }); s.tsc.run("unionCheat"); } },
        after: () => "Three impossible states, three compile errors. The last message even suggests the right word.",
      },
      {
        say: "Use the union. Press the button to step through the cases.",
        enter: (s) => { s.reset(); s.cb.show("exh0", { lit: [] }); },
        guess: { q: "In the default branch, after every case is handled, what is s?", options: ["Nothing is left: the type never", "The whole State again", "undefined"], answer: 0, why: "Every shape was handled, so no value can reach default. The type of a value that cannot exist is never." },
        action: {
          label: "Show the next case", icon: "play", prompt: "Press the button to step through the cases.",
          run: async (s) => {
            const k = s.k++;
            s.cb.show("exh0", { lit: [[13, 15, 17, 19][k]] });
            s.hot(["loading", "error", "success", null][k]);
            s.strip.replaceChildren(k < 3 ? `In case "${["loading", "error", "success"][k]}", s is ` : "In default, s is ", h("code", probeType(k)), " (the compiler confirmed it).");
            return k < 3 ? "more" : undefined;
          },
        },
        after: () => "Inside each case, s is exactly one shape, so s.data only works in success. assertNever is a small function that accepts only never and throws. Handling every case like this is called an exhaustive check.",
      },
      {
        say: "A teammate adds a fourth status, \"empty\", to the type. Nobody touches render().",
        enter: (s) => { s.reset(); s.cb.show("exh0", { lit: [] }); },
        guess: { q: "What happens to render()?", options: ["Nothing until a user hits the new state", "The compiler points at the switch", "The new status is ignored safely"], answer: 1, why: "The default branch passes s to a function that accepts only never. The new shape is not never, so the call is an error." },
        action: {
          label: "Add \"empty\" to the type", icon: "play",
          run: async (s, ctx) => {
            await ctx.wait(250);
            if (s.k++ === 0) {
              s.showEmpty(true); s.hot("empty");
              s.cb.show("exh1", { added: [4], lit: [21], errors: true }); s.tsc.run("exh1");
              ctx.setAction("Handle the new case");
              return "more";
            }
            s.cb.show("exh2", { added: [4, 16, 17] }); s.tsc.run("exh2"); s.hot(null);
            return undefined;
          },
        },
        after: () => `The error points at the default branch of the switch. Add case "empty" and it goes away. (If you leave out assertNever and only declare the return type, the compiler reports ${D.errorsOf("exh3")[0].code} instead.)`,
      },
      {
        say: "Types are gone at run time. Pick any state and run it.",
        enter: (s) => { s.reset(); s.cb.show("exh2", { lit: [22, 23] }); s.showEmpty(true); s.picker.hidden = false; s.sync(); },
        action: { label: "Run render()", icon: "play", again: true, run: async (s) => { s.last = await D.runCase("exh2", s.pick); s.out.show(s.last); } },
        after: (s) => (s.last && s.last.error ? "assertNever throws a clear error for a state nobody handled: better than showing nothing." : "Handled: render() returned a text for this state."),
      },
    ],
    takeaway: "A union with a status field gives each state only its own data, and a never check makes the compiler tell you when a case is missing.",
    check: {
      q: "In case \"error\": which field can you read on s?",
      options: ["s.error", "s.data", "Both"],
      answer: 0,
      why: ["Right: in that case s is the error shape.", `Not data. The compiler reports ${D.errorsOf("readWrong")[0].code}: ${D.errorsOf("readWrong")[0].msg}`, "The error shape has no data field."],
    },
  });

  Object.assign(V, { BODY, tsHtml, tsTokens, codeBox, tscBox, outBox, typeChips, fmtVal, resultLines, typeText, secs, words });
})();
