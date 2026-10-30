/* Lesson: DOM and events (Wave 3, Part C).
   Order: which listeners run? → the road of a click (film) → target vs currentTarget → stopping it → delegation → write on() →
   hold-to-play keys (build, then break) → event types and their traps → your work → on the job → interview → one sentence.
   Every order, count and value comes from a real dispatch (dom-events.data.js, run live in the page), and
   dev/dom-events.test.js runs the same functions in jsdom. */
(function () {
  const { h, word, step, runnable, prereqs, svg: S } = Book;
  const V = Book.parts["dom-events"];
  const D = V.data;
  const SN = D.SNIPPETS;

  /* ---------- Go deeper links (every URL was fetched; see the report) ---------- */
  const MDN = "https://developer.mozilla.org/en-US/docs/";
  const L = {
    bubbling: { title: "Event bubbling", url: MDN + "Learn_web_development/Core/Scripting/Event_bubbling", type: "doc", by: "MDN" },
    addEL: { title: "EventTarget: addEventListener()", url: MDN + "Web/API/EventTarget/addEventListener", type: "doc", by: "MDN" },
    stopProp: { title: "Event: stopPropagation()", url: MDN + "Web/API/Event/stopPropagation", type: "doc", by: "MDN" },
    prevent: { title: "Event: preventDefault()", url: MDN + "Web/API/Event/preventDefault", type: "doc", by: "MDN" },
    current: { title: "Event: currentTarget", url: MDN + "Web/API/Event/currentTarget", type: "doc", by: "MDN" },
    closest: { title: "Element: closest()", url: MDN + "Web/API/Element/closest", type: "doc", by: "MDN" },
    pointer: { title: "Pointer events", url: MDN + "Web/API/Pointer_events", type: "doc", by: "MDN" },
    code: { title: "KeyboardEvent: code", url: MDN + "Web/API/KeyboardEvent/code", type: "doc", by: "MDN" },
    repeat: { title: "KeyboardEvent: repeat", url: MDN + "Web/API/KeyboardEvent/repeat", type: "doc", by: "MDN" },
    focusin: { title: "Element: focusin event", url: MDN + "Web/API/Element/focusin_event", type: "doc", by: "MDN" },
    mouseenter: { title: "Element: mouseenter event", url: MDN + "Web/API/Element/mouseenter_event", type: "doc", by: "MDN" },
    input: { title: "Element: input event", url: MDN + "Web/API/Element/input_event", type: "doc", by: "MDN" },
    change: { title: "HTMLElement: change event", url: MDN + "Web/API/HTMLElement/change_event", type: "doc", by: "MDN" },
    wheel: { title: "Element: wheel event", url: MDN + "Web/API/Element/wheel_event", type: "doc", by: "MDN" },
    composed: { title: "Event: composed", url: MDN + "Web/API/Event/composed", type: "doc", by: "MDN" },
    custom: { title: "CustomEvent", url: MDN + "Web/API/CustomEvent", type: "doc", by: "MDN" },
    editable: { title: "HTMLElement: isContentEditable", url: MDN + "Web/API/HTMLElement/isContentEditable", type: "doc", by: "MDN" },
    touchAction: { title: "touch-action", url: MDN + "Web/CSS/touch-action", type: "doc", by: "MDN" },
    autoplay: { title: "Autoplay policy in Chrome", url: "https://developer.chrome.com/blog/autoplay", type: "article", by: "Chrome for Developers" },
    focusGuide: { title: "Keyboard focus", url: "https://web.dev/learn/accessibility/focus", type: "doc", by: "web.dev" },
    jsinfo: { title: "javascript.info", url: "https://javascript.info/", type: "book", by: "javascript.info" },
    handbook: { title: "Front End Interview Handbook", url: "https://www.frontendinterviewhandbook.com/", type: "doc", by: "Front End Interview Handbook" },
    gfe: { title: "GreatFrontEnd study plans", url: "https://www.greatfrontend.com/interviews/study-plans", type: "doc", by: "GreatFrontEnd" },
  };

  /* ---------- live snippets: run in the reader's browser; the test checks the same code in jsdom ---------- */
  const live = {};
  for (const k of Object.keys(SN)) { const r = D.runSnippet(window, SN[k]); live[k] = !r.error && r.out.length ? r.out : SN[k].out; }
  const withOut = (id) => SN[id].code + "\n" + live[id].map((o) => `// → ${o}`).join("\n");
  const snippetCard = (id) => h("div.de-answer", Book.code(SN[id].code), h("p.de-text", h("b", "Output: "), live[id].join("  ·  ")));
  const note = (...kids) => h("p.de-text", ...kids);

  /* A small picture for the hub cards. */
  function pic(a, b, caption) {
    const svg = S("svg", { viewBox: "0 0 300 82", class: "de-pic", role: "img", "aria-label": `${a} to ${b}. ${caption}` });
    svg.append(
      S("rect", { x: 8, y: 8, width: 112, height: 34, rx: 9, class: "fl-ink" }), S("text", { x: 64, y: 29, "text-anchor": "middle", class: "fl-chip-inv", style: "font-size:12px" }, a),
      S("rect", { x: 180, y: 8, width: 112, height: 34, rx: 9, class: "fl-field" }), S("text", { x: 236, y: 29, "text-anchor": "middle", class: "fl-chip", style: "font-size:12px" }, b),
      S("path", { d: "M 122 25 H 172 m -6 -5 l 6 5 l -6 5", class: "de-arrow" }),
      S("text", { x: 150, y: 68, "text-anchor": "middle", class: "fl-small", style: "font-size:12px" }, caption));
    return svg;
  }

  /* ---------- 06. Runnable: write on() ---------- */
  const explainOn = (results) => {
    const r = results.on;
    if (!Array.isArray(r)) return h("p.result-say", "The test did not report. Press Reset to get the original code back.");
    const pass = r.filter((c) => c.ok).length;
    const bad = r.find((c) => !c.ok);
    return Book.resultCard({
      title: "What happened",
      rows: r.map((c) => ({ label: c.name, value: c.ok ? 1 : 0.05, text: `${c.ok ? "pass" : "not yet"} · ${c.got}` })),
      sentences: [pass === r.length ? `All ${r.length} checks pass.` : `${pass} of ${r.length} checks pass. Next: "${bad.name}" (your code gave: ${bad.got}). Fill in the TODO, then press Run again.`],
      note: "One listener on the parent serves old and new children. closest() walks up past your container, so the check that the match is inside root matters.",
    });
  };

  /* ---------- 09. Hub: event types and their traps ---------- */
  const HUB = [
    { id: "pointer", name: "Click and pointer", short: "pointerdown, click", w: "H", picture: () => pic("pointerdown", "press starts", "click comes after the release"),
      problem: "Know when a mouse, a finger or a pen presses something.", use: "Use click for a normal button press. Use pointerdown and pointerup for drag, hold and long-press.",
      avoid: "Don't use click for hold-to-play: it comes after the release. Don't write separate mouse and touch code when pointer events cover both.",
      note: "setPointerCapture(pointerId) sends all later events of that pointer to one element, even when the pointer leaves it (MDN).", lang: "js",
      example: '// a sketch (not run here)\nkey.addEventListener("pointerdown", (e) => {\n  key.setPointerCapture(e.pointerId); // pointerup now comes to key, even outside it\n  play();\n});\nkey.addEventListener("pointerup", stop);' },
    { id: "keyboard", name: "Keyboard", short: "key vs code, repeat", w: "H", picture: () => pic("KeyA", "any layout", "code is the key's place"),
      problem: "Know which key was pressed, and whether the user is holding it.", use: "Use code (like KeyA) for keys by place: games and piano keys. Use key for the character typed, like a shortcut with a letter.",
      avoid: "Don't use key for place-based controls: on another layout the same physical key gives another character. Don't forget e.repeat: a held key sends keydown again and again.",
      note: "MDN: code is the physical key and is not changed by the keyboard layout. So on an Arabic layout the A key still has code \"KeyA\".", lang: "js",
      example: '// a sketch (not run here)\nwindow.addEventListener("keydown", (e) => {\n  if (e.repeat) return;          // ignore auto-repeat\n  if (e.code === "KeyA") play("C");\n});' },
    { id: "focus", name: "Focus", short: "focus, focusin", w: "M", picture: () => pic("focus", "stops at input", "focusin goes up"),
      problem: "Know when something gets or loses focus, from a parent.", use: "Use focusin and focusout on a parent: they bubble. A capture listener on the parent also sees focus.",
      avoid: "Don't put a plain focus listener on a parent: focus does not bubble, so the parent never hears it. (mouseenter does not bubble either; mouseover does.)", lang: "js", example: withOut("focus") },
    { id: "input", name: "input and change", short: "every edit or commit", w: "M", picture: () => pic("input", "each edit", "change waits for commit"),
      problem: "Know when a field's value changes.", use: "input fires as the user edits: good for search-as-you-type and live checks. change fires when the value is committed: a text field usually when it loses focus (or on Enter), a checkbox on every check.",
      avoid: "Don't use change for a search-as-you-type box: it waits for blur. Don't read a new value from keydown: paste and drag-and-drop change the value without those keys.", lang: "js",
      example: '// a sketch (not run here)\nsearch.addEventListener("input", (e) => debouncedFind(e.target.value));\ncountry.addEventListener("change", (e) => save(e.target.value));' },
    { id: "scroll", name: "Scroll and wheel", short: "passive listeners", w: "M", picture: () => pic("wheel", "scroll waits?", "passive: browser need not wait"),
      problem: "React to the wheel and to touch without making scrolling slow.", use: "Mark wheel and touch listeners passive: true when you never call preventDefault. The browser can then scroll without waiting for your code.",
      avoid: "Don't call preventDefault in a passive listener: it is ignored. On window, document, html and body, wheel, touchstart and touchmove listeners are passive by default (MDN), so pass passive: false when you must cancel. Also: scroll on elements does not bubble (CSSOM View spec), so listen on the scrolling element itself, or use capture.", lang: "js", example: withOut("passive") },
    { id: "custom", name: "Custom events", short: "CustomEvent, bubbles", w: "M", picture: () => pic("dispatchEvent", "parent listens", "needs bubbles: true"),
      problem: "Tell other parts of the page that something happened, without importing them.", use: "dispatchEvent(new CustomEvent(name, { detail, bubbles: true })). A parent or document can then listen in one place.",
      avoid: "Without bubbles: true it does not bubble (a capture listener on a parent still hears it). To cross a shadow DOM boundary, add composed: true. Don't use it where a plain function call is clearer: detail has no type check.", lang: "js", example: withOut("custom") },
    { id: "options", name: "once and signal", short: "clean up listeners", w: "H", picture: () => pic("signal", "abort()", "all listeners go"),
      problem: "Remove listeners without keeping every function around.", use: "once: true for a listener that should run one time. signal for many listeners that should end together, like a component's cleanup.",
      avoid: "removeEventListener needs the same function and the same capture flag: a new arrow function removes nothing. Don't forget the signal on window and document listeners.", lang: "js", example: withOut("once") },
  ];

  /* ---------- 10. From your work: excerpts of the real files (the test checks every fragment against the file) ---------- */
  const EXCERPTS = {
    bus: { file: "touch-drag-bus.ts", dir: "src/components/schedule/_components/dnd/", from: 41, to: 60, label: "touch-drag-bus.ts, lines 41-60 (inside findTouchDropTargetAt)", text: `  if (typeof document === "undefined") return null;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!(hit instanceof Element)) return null;

  // Walk up from the hit element so the deepest registered target wins.
  // A nested event tile registered as a target should claim the drop
  // before its containing DropZone does.
  let cursor: Element | null = hit;
  while (cursor) {
    for (const target of targets) {
      if (target.el !== cursor) continue;
      if (target.accepts && !target.accepts(payload)) {
        // This target opted out — keep walking up to find an outer one.
        break;
      }
      return target;
    }
    cursor = cursor.parentElement;
  }
  return null;` },
    holdA: { file: "useSchedulerTouchDrag.ts", dir: "src/components/schedule/_components/dnd/", from: 35, to: 36, text: `const HOLD_MS = 250;
const SCROLL_TOLERANCE_PX = 6;` },
    holdB: { file: "useSchedulerTouchDrag.ts", dir: "src/components/schedule/_components/dnd/", from: 158, to: 175, text: `      const handleMove = (e: PointerEvent) => {
        const cur = stateRef.current;
        if (!cur || e.pointerId !== cur.pointerId) return;
        const dx = e.clientX - cur.startX;
        const dy = e.clientY - cur.startY;
        const dist = Math.hypot(dx, dy);

        if (!cur.armed) {
          if (dist > SCROLL_TOLERANCE_PX) {
            // Finger moved before the long-press completed → this is a
            // scroll. Bail out cleanly so the browser keeps scrolling.
            tile.removeEventListener("pointermove", handleMove);
            tile.removeEventListener("pointerup", handleUp);
            tile.removeEventListener("pointercancel", handleCancel);
            cleanup();
          }
          return;
        }` },
    raf: { file: "useDragGesture.ts", dir: "src/components/floor-plan/hooks/", from: 97, to: 102, label: "useDragGesture.ts, lines 97-102", text: `    const queue = (event: PointerEvent) => {
      pendingEventRef.current = event;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    };` },
  };
  V.excerpts = EXCERPTS; // so dev/dom-events.test.js can compare every excerpt with the real file
  const HOLD_CODE = EXCERPTS.holdA.text + "\n// ... (the hold timer is set in onPointerDown) ...\n" + EXCERPTS.holdB.text;

  /* ---------- 11. On the job ---------- */
  const SETUP = "// the row, with a Delete button inside it\n" + D.TICKET.bug;

  /* ---------- 12. Interview questions (only the sourced ones in research/interview-questions.md, dom-events) ---------- */
  const IQ = [
    {
      q: "Build six accessible hold-to-play piano keys in vanilla HTML, CSS and JavaScript. Mouse and keyboard must work together: simultaneous inputs, auto-repeat, release outside the key, editable targets, focus loss and cleanup.",
      type: "machine coding", level: "level not stated (the title hints senior)", source: { company: "Roblox", year: "Aug 2026", url: "https://prachub.com/interview-questions/build-six-hold-to-play-piano-keys-with-vanilla-web-apis" },
      testing: "Event-model edge cases and listener hygiene.",
      answer: () => [
        "Start by saying the six edge cases out loud (they are in the prompt), then build the simple version, then add one guard for each. This is the whole code of the lesson's piano:",
        Book.code(D.pianoSource([])),
        "State is a Map from note to a Set of inputs that hold it. Press adds an input and plays only for the first one. Release removes an input and stops the note only when the Set is empty. That one idea covers mouse plus keyboard, and two fingers.",
        "Release outside: listen for pointerup and pointercancel on window. Auto-repeat: skip keydown when e.repeat is true. Editable targets: skip keys typed in an input, a textarea, a select or a contenteditable element (isContentEditable). Focus loss: on window blur, release everything. Cleanup: pass one AbortSignal to every addEventListener and call abort() when the piano goes away.",
        "Follow-ups to expect: Touch? Each finger has its own pointerId, so two fingers hold two notes. Keys by place or by letter? e.code is the key's place, so the piano keeps its shape on any layout; the letters printed on your keys may differ. Tests? Send real events in a test (the lesson's test does it in jsdom), one test per edge case.",
        "More follow-ups: (1) touch-action: none on the keys, so the browser does not take a touch drag over as a scroll and send pointercancel (MDN). (2) setPointerCapture on pointerdown is the other way to get the release: the key then receives pointerup even outside it, and lostpointercapture when the capture ends. (3) In Chrome, an AudioContext made before a user gesture starts suspended, so call resume() inside the first pointerdown or keydown. (4) visibilitychange fires when the tab is hidden: release notes there too, next to blur.",
        "Honest gap: this version plays with the letters A S D F G H. Each key is a button with a label, and aria-pressed shows when it is held. What it does not do yet is a key that has focus and is used from the keyboard (Space or Enter). Say that you would handle keydown and keyup for those two keys too.",
      ],
    },
    {
      q: "Corresponding Node Across Pages: find the matching DOM node on another page that has the same structure.",
      type: "coding", level: "level not stated", source: { company: "Meta", year: "GFE guide, no year", url: "https://www.greatfrontend.com/interviews/company/meta/questions-guides" },
      testing: "Not stated in the report. It looks like tree walking and DOM API fluency (my guess). Only the title is in the guide, so the details below are one common way to solve it, not the exact task.",
      answer: () => [
        "Idea: write down the road from the node up to the root as a list of child positions, then follow the same road down in the other page.",
        snippetCard("corresponding"),
        "Say the choices: children counts only elements, so different spaces between tags do not matter (childNodes would count text nodes). Cost is the depth, plus the siblings you count at each level. If the other page may differ, return null when a step is missing, as here.",
        "Follow-up to expect: if both pages have ids on the nodes, use getElementById first and fall back to the path.",
      ],
    },
    {
      q: "Build an analog clock in vanilla JavaScript. (Candidates advise practicing addEventListener, setInterval and Date.)",
      type: "coding", level: "level not stated", source: { company: "Canva", year: "Glassdoor listing (year not stated; the specific review is unverified)", url: "https://www.glassdoor.co.uk/Interview/Canva-Interview-E1013251-RVW63637709.htm" },
      testing: "Not stated. The listing only advises practicing addEventListener, setInterval and Date, and the specific review could not be confirmed.",
      answer: () => [
        "Compute each hand's angle from the Date, never from a counter. The hour hand also moves with the minutes.",
        snippetCard("angles"),
        "Draw by setting transform: rotate(angle deg) on each hand. Use setInterval every second, and read the Date each time, so a late tick does not drift. Stop the timer when the clock is removed (clearInterval) and when the tab is hidden if you want to save work.",
        "Follow-up to expect: a smooth second hand. Use requestAnimationFrame and the milliseconds from Date.",
      ],
    },
  ];
  const resolveAnswer = (a) => (typeof a === "function" ? a() : a);
  const PRACTICE = [
    { q: "What is the difference between event.target and event.currentTarget?", a: ["target is the element the event was sent to (the deepest one, like a span inside a button). currentTarget is the element whose listener is running now. In the lesson's list, a click on the word gave target = span and currentTarget = the ul. After the click has finished, currentTarget is null."] },
    { q: "removeEventListener(\"click\", () => n++) does nothing. Why?", a: ["It needs the same function that was added, and a new arrow function is a new object. Keep a reference, use { once: true }, or add every listener with one AbortSignal and call abort().", snippetCard("removeSame")] },
    { q: "How can you remove many listeners at once?", a: ["Give them all the same signal in the options, then call controller.abort().", snippetCard("abort")] },
    { q: "Write a tiny event emitter.", a: ["The simplest is to use EventTarget with CustomEvent. It already supports once, signal and removal.", snippetCard("emitter"), "If the interviewer wants a hand-made one: keep a Map from event name to a Set of functions, on() adds and returns an off function, emit() calls a copy of the set. Say what happens when a listener removes itself while emit() runs (copy first)."] },
    { q: "My wheel handler calls preventDefault() but the page still scrolls. Why?", a: ["A passive listener ignores preventDefault. On window, document, html and body, wheel, touchstart and touchmove listeners are passive by default (MDN), so add { passive: false }.", snippetCard("passive")] },
    { q: "preventDefault() does nothing on my custom event. Why?", a: ["Events made with new Event() or new CustomEvent() are not cancelable unless you pass cancelable: true. preventDefault() then has no effect (MDN).", snippetCard("notCancelable")] },
    { q: "Why can stopPropagation() be a bad fix?", a: ["It hides the event from every listener later in the path: analytics, and outside-click code that listens in the bubble phase. In this lesson's ticket demo, the document listener saw 0 clicks with stopPropagation and 1 with a closest() check in the parent."] },
  ];

  Book.registerLesson("dom-events", {
    mount(root) {
      root.append(
        prereqs([
          ["Element", "A box in the page: a button, a li, a div. Elements sit inside other elements, like a tree."],
          ["Event", "A message the browser makes when something happens: a click, a key press, a focus."],
          ["Listener", "A function you give the browser with addEventListener. The browser calls it when that event happens."],
          ["Event loop", "The browser runs one listener at a time, on the call stack. A slow listener makes the next one wait."],
        ]),
        step({
          n: "01", title: "You click one button. Which listeners run?",
          lines: [
            "Three boxes sit inside each other. Each has a click listener.",
            ["Later on this page you will meet the option ", word("capture", "An addEventListener option. The listener runs on the way down, before the normal listeners. On the clicked element itself, capture listeners also run first (modern browsers)."), "."],
            "Guess first, then press the button under the picture.",
          ],
          demo: V.clickProblem(), links: [L.bubbling, L.addEL, L.jsinfo],
        }),
        step({
          n: "02", title: "The road of one click",
          lines: [
            "Press play. The dot is one real click, recorded in your browser just now with listeners on every stop.",
            ["Left: the way down (capture). Right: the way up (bubble). The panel shows ", word("target", "The element the event was sent to."), " and ", word("currentTarget", "The element whose listener is running right now."), "."],
            ["At the end, two methods try to change the trip: ", word("stopPropagation()", "Stops the event from going on to other elements."), " and ", word("preventDefault()", "Cancels what the browser would do by itself, like checking a box or following a link."), "."],
          ],
          demo: h("div.demo-stack", V.pathFilm(), note(h("b", "Honest note: "), "the click was sent to a small hidden list that is added to the page for a moment, so the picture has no other elements of this page in it. The order, the target and the currentTarget are what your browser really reported. At the clicked element, a capture listener added after a normal one still ran first. Your browser just ran it, and the order was: " + D.atTargetOrder(window).join(", then ") + ".")),
          links: [L.bubbling, L.stopProp, L.prevent],
        }),
        step({
          n: "03", title: "Where did the click land?",
          lines: [
            ["Two names are easy to mix up: ", word("target", "The element the event was sent to."), " and ", word("currentTarget", "The element whose listener is running right now.")],
            "Guess each value first, then click.",
            "The list has one listener, on the ul.",
          ],
          demo: h("div.demo-stack", V.targetDemo(), note(h("b", "Shadow DOM: "), "listeners outside a shadow root see the host as event.target, not the element inside. A custom event also needs composed: true to leave the shadow root. Checked by running it:"), snippetCard("shadow")),
          links: [L.current, L.closest, L.bubbling, L.composed],
        }),
        step({
          n: "04", title: "Stop it halfway",
          lines: [
            ["stopPropagation() and preventDefault() are not the same thing. Page 2 showed both once."],
            ["A third one, ", word("stopImmediatePropagation()", "A stronger kind of stop than stopPropagation(). The cases below show how."), ", comes up later on this page."],
            "Guess, then click. Every stop is a real listener.",
          ],
          demo: V.stopping(), links: [L.stopProp, L.prevent, L.addEL],
        }),
        step({
          n: "05", title: "One listener for a thousand rows",
          lines: [
            [word("Delegation", "One listener on a parent that handles events from many children."), " puts a single listener on the list, not one on every row."],
            ["It uses ", word("closest()", "element.closest(selector) returns the element or its nearest parent that matches the selector, or null."), " to find the row. Two traps come at the end."],
            "The counters are real counts of addEventListener calls.",
          ],
          demo: V.delegation(), links: [L.bubbling, L.closest, L.focusin, L.mouseenter],
        }),
        step({
          n: "06", title: "Write on(): delegation as a helper",
          lines: [
            "Wrap delegation in a small helper: on(root, type, selector, handler).",
            "It must handle clicks on inner parts, rows added later, and an li outside root.",
            "Fill in the TODO and press Run. A solution is under the editor.",
          ],
          demo: h("div.demo-stack", runnable({ title: "Write on()", code: D.onCode(false), rows: 30, explain: explainOn }),
            h("details.de-sol", h("summary", "Show one solution"), Book.code(D.ON_SOLUTION)),
            note(h("b", "Choices: "), "match !== root stops a selector from matching root itself. event.target.closest?.() guards a target that is not an element. For events that do not bubble, such as focus, listen with the capture option, or use focusin.")),
          links: [L.closest, L.addEL, L.handbook],
        }),
        step({
          n: "07", title: "Build a hold-to-play key",
          lines: [
            "A music page needs keys that sound while you hold them (Roblox interview task, Aug 2026). Six edge cases come one at a time.",
            ["The code uses ", word("pointer events", "One set of events for a mouse, a finger or a pen: pointerdown, pointerup and more."), " and an ", word("AbortSignal", "An object you pass to addEventListener. When its controller calls abort(), the listeners that got it are removed."), " for cleanup."],
            ["It keeps a ", word("Map", "A collection of key and value pairs."), " of ", word("Set", "A collection with no repeated values."), " values and reads ", word("e.code", "The key's place on the keyboard, like KeyA. It does not change with the layout."), ". Guess what breaks, press Try it, see the fix."],
          ],
          demo: V.pianoBuild(), links: [L.pointer, L.repeat, L.code],
        }),
        step({
          n: "08", title: "Play it, then break it",
          lines: [
            "Play the piano with the mouse and the keys A S D F G H. Then switch a guard off and break it.",
            "e.code is the key's place, so the piano keeps its shape on any layout. The letters printed on your keys may differ.",
            ["A key typed in a field, or in a ", word("contenteditable", "An HTML attribute that makes an element editable, like a text box. isContentEditable is true for it."), " element, does not play. The table shows what each guard breaks, measured by real runs."],
          ],
          demo: h("div.demo-stack", V.pianoPlay(), h("span.de-sub", "What each guard breaks (real runs, guard on and off)"), V.guardTable(),
            note(h("b", "Good to know: "), "once the Set is in, it also ignores a repeated key. Keep the e.repeat check anyway: it stops the work early. Touch screens often capture the pointer for you (MDN), so \"release outside\" is mostly a mouse bug.")),
          links: [L.pointer, L.code, L.editable, L.focusGuide],
        }),
        step({
          n: "09", title: "Event types and their traps",
          lines: ["Seven families of events come up often in interviews.", "Pick a card. Each one says when NOT to use it, or what goes wrong.", "The outputs shown were produced by running the code."],
          demo: Book.hubSpoke({ title: "Event types and their traps", items: HUB }), links: [L.pointer, L.addEL, L.input, L.wheel, L.custom],
        }),
        step({
          n: "10", title: "From your work: a finger that waits",
          lines: [
            ["Speako's code comment says ", word("HTML5 drag", "the browser's built-in drag-and-drop events"), " events never fire on iPad touch. So it builds its own drag from pointer events."],
            ["It finds the drop target with ", word("elementFromPoint", "document.elementFromPoint(x, y) returns the element on screen at that point."), ", then walks up the parents. That is like closest(), written by hand."],
            "Be ready to say which parts you wrote.",
          ],
          demo: h("div.demo-stack",
            h("div.de-excerpt", h("span.label", "Speako: " + EXCERPTS.bus.label), Book.code(EXCERPTS.bus.text),
              note("The tile registers itself as a drop target. On pointerup the code asks the browser what is under the finger, then walks up parent by parent until a registered target accepts the drop. On touch, the browser usually sends pointer events to the tile that was pressed (implicit capture, MDN). So event.target never tells you what is under the finger.")),
            h("div.de-excerpt", h("span.label", "Speako: useSchedulerTouchDrag.ts, lines 35-36 and 158-175"), Book.code(HOLD_CODE),
              note("The hold is 250 ms, and the finger may move 6 px. A move above that before the timer fires means a scroll: the drag is cancelled. The file's own comment says this is identical in spirit to dnd-kit's TouchSensor, so it is a known pattern.")),
            V.longPress(),
            h("div.de-excerpt", h("span.label", "Speako: " + EXCERPTS.raf.label + " (the mouse-and-pen drag on the floor plan)"), Book.code(EXCERPTS.raf.text),
              note("In useDragGesture.ts, pointermove only stores the latest event. A requestAnimationFrame callback then applies it once per frame. The same file calls setPointerCapture on pointerdown.")),
            h("div.de-excerpt", note(h("b", "Honest note: "), "This model is small and written for the lesson. It is not Speako's file."), note("Git blame shows one author name on all three files. A git name does not prove who wrote each line."), note("Be ready to say which parts you wrote."))),
          links: [L.pointer, L.addEL, L.closest],
        }),
        step({
          n: "11", title: "On the job",
          lines: ["A ticket arrives. Try the live row first, then compare with the steps."],
          demo: h("div.demo-stack", V.ticket(), Book.onTheJob({
            id: "PRACTICE-3", title: "Clicking a row's delete button also opens the row details",
            context: "A practice ticket (not from a real tracker). A bookings list opens a details panel when you click a row. Each row has a Delete button. Support writes: “I click Delete and the row goes, but the details panel pops open for a row that no longer exists.”",
            symptoms: ["Delete works.", "The details panel also opens, for the row that was just deleted.", "A teammate added event.stopPropagation() in a past fix and the click-tracking numbers dropped."],
            code: SETUP,
            tasks: ["Reproduce it and find which listener opens the panel.", "Fix it in a way you can explain, and say what you would not do.", "Add a test that fails before the fix."],
            steps: [
              "Reproduce: click Delete on the live row above with no fix. Both things happen: the row is deleted and the details open. Add a console.log to both listeners: the button's runs first, then the row's, because the click bubbles.",
              "Read the event: in the row's listener log event.target and event.currentTarget. currentTarget is the row. target is the Delete button, or the span inside it if the label is wrapped (page 3). So the row can tell where the click came from.",
              "Option A, stopPropagation() in the delete handler. It works for the panel, but the click never reaches document: in the live demo the tracking listener saw 0 clicks. Any outside-click code that listens in the bubble phase would miss it too. Listeners that run in the capture phase, before the stop, still see the click.",
              "Option B, a check in the parent: if (e.target.closest(\"button.delete\")) return; Nothing is stopped, so the tracking listener saw 1 click. Prefer B. Use closest, not a direct test of event.target, because the click may land on a span inside the button.",
              "Test it (in jsdom or a browser test): click the button, then expect deleteRow called once, openDetails not called, and a listener on document called once. Click the row text and expect openDetails called. Run the test on the old code first and watch it fail.",
              "Look for the same pattern: search the code for stopPropagation. Each hit is a candidate. For each, ask: who else needs to hear this click? In React, onClick handlers bubble in the same way, so the same parent check works there.",
            ],
          })),
          links: [L.stopProp, L.closest, L.bubbling],
        }),
        step({
          n: "12", title: "Real interview questions",
          lines: ["These were reported by real candidates (the Canva review is unverified). The company, date and link are on each card.", "Try each one out loud first, then open the answer.", "This topic has only three reported items, so the practice block below is longer."],
          demo: h("div.demo-stack",
            Book.interviewQuestions(IQ.map((it) => ({ ...it, answer: resolveAnswer(it.answer) }))),
            h("span.de-sub", "Practice questions (not from a report)"),
            Book.drill(PRACTICE)),
          links: [L.handbook, L.gfe, L.touchAction, L.autoplay, L.jsinfo],
        }),
        step({
          n: "13", title: "In one sentence",
          lines: ["A click goes down the tree, up the tree, and you choose where to listen."],
          demo: h("ol.de-rule",
            h("li", h("span", h("b", "Down, then up"), ": capture listeners run on the way down, normal listeners on the way up.")),
            h("li", h("span", h("b", "target is where it landed"), "; currentTarget is where the listener is.")),
            h("li", h("span", h("b", "Listen on the parent"), ", find the child with closest(), and check that it is inside the parent.")),
            h("li", h("span", h("b", "Prefer a check to stopPropagation()"), ", and give every listener on window one AbortSignal."))),
          links: [L.bubbling, L.addEL, L.jsinfo],
        }),
      );
    },
  });
})();
