# Ronin Dojo: rules for writing and fixing lessons

Ronin Dojo is a static interview book (open `index.html`, no build step). `curriculum.js` is the book map.
Each built lesson is `lessons/<id>.js` (pages), `lessons/<id>.visuals.js` (guided visuals and films),
`lessons/<id>.data.js` (programs, snippets, runnable exercises) and `lessons/<id>.css`.

These rules came from the review of lesson 1 (`js-scope-closures`). Apply them to every page.

## 1. Language: plain, full sentences

- Write in full, plain sentences, the way a person would explain it out loud. Avoid clipped two-word
  fragments such as "Kinds:", "Limit:", "Keep this:", "Traps:" or "var: function scope, hoisted".
  Prefer a label that is a short phrase ("There is more than one kind:", "A limit to mention:").
- Use easy, common words. Explain a term the first time it appears, with `word(term, meaning)`.
- Spell out an abbreviation the first time it is used: "temporal dead zone (TDZ)",
  "immediately invoked function expression (IIFE)". After that the short form is fine.
- Hub card `short` lines are short sentences ("A handler remembers data between clicks."), not keyword tags.

## 2. Programming examples, not real-life ones

- Explain with code and programming situations, not with rooms, houses, desks, pens, teachers,
  name cards or other real-life analogies.
- Use the real term. Say "scope", not "box". Say "a { } block", "a function call", "the global scope".
- Point at the code on screen: "inner() is written inside outer(), so its scope sits inside the outer() scope."

## 3. Be technically exact (do not simplify into something false)

- Prefer a precise statement over a catchy one. If a common shortcut is wrong, say what is really true
  and show it with a live run.
- Example from lesson 1: "let is not hoisted" is false. All declarations are hoisted (var, let, const,
  class, function). They differ in their starting value: var is undefined, a function declaration is the
  whole function, let/const/class are not initialized (in the TDZ) until their line runs.
- The TDZ is about time, not position: a function written above `let x` may read x if it is called after
  the `let x` line has run. Teach the "when", not the "where".
- Every printed output on a page must come from a real run (a snippet in `.data.js`, run live in the
  browser) or from the mini-interpreter, never typed by hand.
- Do not claim a test checks something it does not check.

## 4. Simple code in exercises and snippets

- Runnable test code ("harness") must be readable by a beginner: plain calls in order, with a short
  comment on each step. Example (debounce):
  `search("h"); search("he"); ... await pause(200); search("hello");`
  Avoid `performance.now()`, arrays of tuples, generated schedules or clever one-liners in the visible code.
- The starter and the solution should show the simplest correct version. Put extras (keeping `this`
  with `fn.apply(this, args)`, `cancel()`, `flush()`) in a follow-up note or in the interview answer.
- Keep snippets short and free of `try { } catch { }` one-liners. If a snippet throws, let the error show
  (the snippet then uses `error: "ReferenceError"` in `.data.js`). To compare two cases, show two short
  programs side by side instead of one long one.
- Keep code lines short enough to fit the code box (about 45 characters in a guided panel).

## 5. Before committing a lesson change

1. `node --check` every changed `lessons/<id>*.js` file.
2. In Node, run every snippet in `.data.js` and compare it with its `out` / `error`, run every program in
   `EXPECT` through both the interpreter and a real run, and run the runnable exercise solutions against
   their `checks` (the starter must fail them).
3. Serve the folder (`python3 -m http.server`), open `index.html#<lesson-id>` in Playwright, step through
   the changed guided visuals, and look at screenshots: no cut-off code, no JS errors in the console.
4. Show the preview to Mina before committing.
