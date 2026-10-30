/* Code that looks like a real IDE: a small JavaScript highlighter, a colored editor, and run results
   explained in plain words (LESSON-SPEC §13). Replaces the plain runnable from kit.js. */
(function () {
  const B = window.Book;
  const { h, icon } = B;

  const KEYWORDS = new Set(["const", "let", "var", "for", "while", "if", "else", "return", "function", "new", "of", "in", "break", "continue", "async", "await", "true", "false", "null", "undefined", "class", "import", "export", "from", "typeof", "this",
    "throw", "try", "catch", "finally", "switch", "case", "default", "delete", "instanceof", "void", "yield", "extends", "super", "static",
    // TypeScript
    "type", "interface", "keyof", "infer", "readonly", "declare", "satisfies", "implements", "enum", "as", "is", "asserts", "never", "unknown"]);
  const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([\s\S])/g;

  /* Split code into [{type, text}] tokens. Types: com, str, num, kw, fn, prop, plain. */
  B.tokens = (code) => {
    const out = [];
    let m;
    let prevNonSpace = "";
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code))) {
      const [text, com, str, num, word, space] = m;
      let type = "plain";
      if (com) type = "com";
      else if (str) type = "str";
      else if (num) type = "num";
      else if (word) {
        const after = code.slice(TOKEN.lastIndex).match(/^\s*\(/);
        if (prevNonSpace === ".") type = after ? "fn" : "prop"; // event.type is a property, not the keyword
        else if (KEYWORDS.has(word)) type = "kw";
        else if (after) type = "fn";
      } else if (space) type = "space";
      out.push({ type, text });
      if (!space) prevNonSpace = text;
    }
    return out;
  };

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  B.highlight = (code) => B.tokens(code).map((t) => (t.type === "plain" || t.type === "space" ? esc(t.text) : `<span class="syn-${t.type}">${esc(t.text)}</span>`)).join("");

  /* A read-only, colored code block. */
  B.code = (code) => h("pre.code-block", { html: B.highlight(code.replace(/^\n+|\s+$/g, "")) });

  /* Editable code that really runs.
     Inside the code, report(name, data) sends results to explain(results), which returns a DOM node.
     console.log output is kept, folded under "Raw output". */
  B.runnable = ({ title = "Run it yourself", code, rows = 14, explain }) => {
    const start = code.replace(/^\n+/, "").replace(/\s+$/, "") + "\n";
    const ta = h("textarea.code-input", { spellcheck: "false", autocapitalize: "off", autocomplete: "off", wrap: "off", "aria-label": "Code editor", rows });
    const hl = h("pre.code-hl", { "aria-hidden": "true" });
    const edit = h("div.code-edit", hl, ta);
    ta.value = start;
    const paint = () => { hl.innerHTML = B.highlight(ta.value) + "\n"; };
    const sync = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; };
    ta.addEventListener("input", paint);
    ta.addEventListener("scroll", sync);
    paint();

    const result = h("div.run-result", { "aria-live": "polite" });
    const raw = h("pre.run-out");
    const rawBox = h("details.run-raw", h("summary", "Raw output"), raw);
    const hint = h("p.run-hint", "Press Run to see what happens.");
    const runBtn = h("button.btn.sm", { type: "button", title: "Run (Ctrl+Enter)" }, icon("play", 13), "Run");
    const reset = h("button.tool", { type: "button", "data-tip": "Reset the code", "aria-label": "Reset the code" }, icon("undo"));

    const run = async () => {
      raw.textContent = "";
      result.replaceChildren();
      hint.hidden = true;
      runBtn.disabled = true;
      runBtn.replaceChildren(icon("refresh", 13), "Running…");
      await new Promise((r) => setTimeout(r, 40));
      const results = {};
      const print = (...args) => raw.append(document.createTextNode(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n"));
      try {
        const fn = new Function("console", "report", `return (async () => {\n${ta.value}\n})()`);
        await fn({ log: print, info: print, warn: print, error: print }, (name, data) => { results[name] = data; });
        if (explain && Object.keys(results).length) result.append(explain(results));
        else if (!raw.textContent) print("(no output)");
        rawBox.open = !explain || !Object.keys(results).length;
      } catch (err) {
        result.append(h("div.run-error", h("b", "The code stopped with an error. "), err.message, h("p", "Check the line you changed last, or press Reset.")));
      } finally {
        runBtn.disabled = false;
        runBtn.replaceChildren(icon("play", 13), "Run again");
      }
    };
    runBtn.addEventListener("click", run);
    reset.addEventListener("click", () => { ta.value = start; paint(); raw.textContent = ""; result.replaceChildren(); hint.hidden = false; runBtn.replaceChildren(icon("play", 13), "Run"); });
    ta.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
      if (e.key === "Tab") {
        e.preventDefault();
        ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
        paint();
      }
    });
    return h("div.run",
      h("div.run-bar", h("span.run-title", icon("code"), title), h("div.run-actions", h("span.hint", "Ctrl+Enter"), reset, runBtn)),
      edit,
      h("div.run-below", hint, result, rawBox));
  };

  /* A result card: horizontal bars + plain sentences. rows: [{ label, value, text }] */
  B.resultCard = ({ title, rows, sentences = [], note }) => {
    const max = Math.max(...rows.map((r) => r.value), 1);
    return h("div.result-card",
      title && h("span.label", title),
      h("div.result-bars", rows.map((r, i) => {
        const fill = h("i");
        B.animate(fill, [{ transform: "scaleX(0)" }, { transform: `scaleX(${Math.max(r.value / max, 0.004)})` }], { duration: 800, delay: 120 + i * 220 });
        return h("div.result-row", h("span.result-name", r.label), h("div.track", fill), h("b.result-num", r.text));
      })),
      sentences.map((s) => h("p.result-say", s)),
      note && h("p.result-note", note));
  };
})();
