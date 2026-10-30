/* guided(): every teaching visual is a short tour you step through (see LESSON-SPEC, Teaching direction).
   A step can: set the scene (enter), ask a guess, offer ONE action, then explain what happened.
   enter() must put the scene in that step's starting state without animation, so Back and Replay always work. */
(function () {
  const B = window.Book;
  const { h, icon } = B;

  /* A label that points at something inside a visual. Cleared on every step change. */
  B.callout = (view, target, text, side = "top") => {
    const el = h("div.g-callout." + side, text);
    view.append(el);
    const place = () => {
      const v = view.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const w = el.offsetWidth;
      const hgt = el.offsetHeight;
      let x = t.left - v.left + t.width / 2 - w / 2;
      let y = side === "bottom" ? t.bottom - v.top + 10 : t.top - v.top - hgt - 10;
      x = Math.max(4, Math.min(x, v.width - w - 4));
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      el.style.setProperty("--tip-x", `${Math.round(t.left - v.left + t.width / 2 - x)}px`);
    };
    requestAnimationFrame(place);
    setTimeout(place, 400); // again after the step's enter animation settles the layout
    const ro = new ResizeObserver(place);
    ro.observe(view);
    ro.observe(target);
    return el;
  };

  /* A curved line from one element to another inside a visual. Cleared on every step change. */
  B.connect = (view, from, to, ms = 500) => {
    const svg = view.querySelector(".g-links");
    const v = view.getBoundingClientRect();
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const fromLeft = a.left > b.right;
    const x1 = (fromLeft ? a.left : a.right) - v.left;
    const y1 = a.top + a.height / 2 - v.top;
    const x2 = (fromLeft ? b.right : b.left) - v.left;
    const y2 = b.top + b.height / 2 - v.top;
    const bend = Math.max(40, Math.abs(x2 - x1) / 2);
    const dir = fromLeft ? -1 : 1;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const vertical = Math.abs(x2 - x1) < 30;
    const d = vertical
      ? `M ${a.left + a.width / 2 - v.left} ${a.bottom - v.top} C ${a.left + a.width / 2 - v.left} ${a.bottom - v.top + 40}, ${b.left + b.width / 2 - v.left} ${b.top - v.top - 40}, ${b.left + b.width / 2 - v.left} ${b.top - v.top}`
      : `M ${x1} ${y1} C ${x1 + bend * dir} ${y1}, ${x2 - bend * dir} ${y2}, ${x2} ${y2}`;
    path.setAttribute("d", d);
    svg.append(path);
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    return B.animate(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: ms });
  };

  B.guided = function ({ title, build, steps, takeaway, check, minHeight = "auto" }) {
    const links = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    links.setAttribute("class", "g-links");
    links.setAttribute("aria-hidden", "true");
    const view = h("div.g-view", { style: { minHeight } });
    const scene = build(view);
    view.append(links);

    let i = 0;
    let token = 0;
    let seen = 0;
    let picked = null;
    let slow = B.store.get("slow", false);

    /* Saved answers (this browser only): guesses per step and the quick check, per lesson and visual. */
    const ansKey = `answers:${location.hash.replace(/^#/, "") || "home"}:${title}`;
    let answers = B.store.get(ansKey, { steps: {}, check: null });
    const hasAnswers = () => Object.keys(answers.steps).length > 0 || answers.check != null || Boolean(answers.done);
    const resetAnsBtn = h("button.tool", { type: "button", "data-tip": "Reset my answers", "aria-label": "Reset my answers in this visual", hidden: true }, icon("undo", 15));
    const paintReset = () => { resetAnsBtn.hidden = !hasAnswers(); };
    const saveAnswers = () => { B.store.set(ansKey, answers); paintReset(); window.dispatchEvent(new Event("dojo:answers")); };

    const dots = h("div.g-dots", { role: "tablist", "aria-label": "Steps" });
    const count = h("span.g-count.tab");
    const speedBtn = h("button.chip", { type: "button", "aria-pressed": String(slow), title: "Play animations slower" }, "Slow");
    const replayBtn = h("button.tool", { type: "button", "data-tip": "Replay this step", "aria-label": "Replay this step" }, icon("refresh", 15));
    const say = h("p.g-say", { "aria-live": "polite" });
    const guessBox = h("div.g-guess");
    const result = h("div.g-result", { "aria-live": "polite", hidden: true });
    const backBtn = h("button.tool", { type: "button", "data-tip": "Back", "aria-label": "Back" }, icon("chevronLeft"));
    const actBtn = h("button.btn.g-act", { type: "button", hidden: true });
    const nextBtn = h("button.btn.ghost.g-next", { type: "button" }, "Next", icon("chevronRight", 14));
    const end = h("div.g-end", { hidden: true });
    const foot = h("div.g-foot", say, guessBox, result, h("div.g-nav", h("div.g-nav-left", backBtn, count), h("div.g-nav-right", actBtn, nextBtn)), end);

    const makeCtx = (t) => ({
      scene, view,
      alive: () => t === token,
      speed: () => (slow ? 1.8 : 1),
      wait: (ms) => B.sleep(ms * (slow ? 1.8 : 1)),
      tween: (o) => B.tween({ ...o, ms: (o.ms ?? 600) * (slow ? 1.8 : 1) }),
      animate: (el, kf, o = {}) => B.animate(el, kf, { ...o, duration: (o.duration ?? 500) * (slow ? 1.8 : 1) }),
      callout: (target, text, side) => B.callout(view, target, text, side),
      setAction: (label, ico) => actBtn.replaceChildren(ico ? icon(ico, 14) : "", label),
      connect: (from, to, ms = 500) => B.connect(view, from, to, ms * (slow ? 1.8 : 1)),
    });

    function paintDots() {
      dots.replaceChildren(...steps.map((_, k) => {
        const d = h("button.g-dot", { type: "button", role: "tab", "aria-label": `Step ${k + 1}`, "aria-selected": String(k === i), disabled: k > seen });
        d.classList.toggle("done", k < i || (k <= seen && k !== i));
        d.addEventListener("click", () => goTo(k));
        return d;
      }));
      count.textContent = end.hidden ? `${i + 1} of ${steps.length}` : "Done";
    }
    function setNext(on) {
      nextBtn.disabled = !on;
      nextBtn.classList.toggle("pulse", on && !actBtn.classList.contains("pulse"));
    }
    function clearOverlays() {
      view.querySelectorAll(".g-callout").forEach((el) => el.remove());
      links.replaceChildren();
    }

    function goTo(n) {
      token++;
      i = n;
      seen = Math.max(seen, i);
      picked = null;
      end.hidden = true;
      clearOverlays();
      const s = steps[i];
      const ctx = makeCtx(token);
      s.enter?.(scene, ctx);
      say.textContent = typeof s.say === "function" ? s.say(scene) : s.say;
      result.hidden = true;
      guessBox.replaceChildren();
      actBtn.hidden = !s.action;
      actBtn.classList.remove("pulse");
      actBtn.disabled = false;
      nextBtn.hidden = false;
      backBtn.disabled = i === 0;
      if (s.action) actBtn.replaceChildren(s.action.icon ? icon(s.action.icon, 14) : "", s.action.label);
      if (s.guess) {
        actBtn.hidden = true;
        guessBox.append(h("span.g-guess-q", s.guess.q),
          h("div.g-options", s.guess.options.map((o, k) => {
            const b = h("button.g-opt", { type: "button" }, o);
            b.addEventListener("click", () => pick(k));
            return b;
          })));
      } else if (s.action) {
        actBtn.classList.add("pulse");
      }
      // Finished this visual before? Then every step can be skipped with Next.
      setNext((!s.action && !s.guess) || Boolean(answers.done));
      s.show?.(scene, ctx);
      // Answered before: show the saved answer and its explanation; no need to answer again.
      const saved = s.guess ? answers.steps[i] : null;
      if (saved != null && saved < s.guess.options.length) {
        picked = saved;
        guessBox.querySelectorAll(".g-opt").forEach((b, j) => { b.disabled = true; b.classList.toggle("picked", j === saved); });
        if (s.action) {
          actBtn.hidden = false;
          actBtn.classList.add("pulse");
        }
        reveal(true);
      }
      paintDots();
    }

    function pick(k) {
      const s = steps[i];
      picked = k;
      answers.steps[i] = k;
      saveAnswers();
      guessBox.querySelectorAll(".g-opt").forEach((b, j) => { b.disabled = true; b.classList.toggle("picked", j === k); });
      if (s.action) {
        actBtn.hidden = false;
        actBtn.classList.add("pulse");
        say.textContent = `You guessed “${s.guess.options[k]}”. ` + (s.action.prompt || "Now press the button and see.");
      } else {
        reveal();
      }
    }

    function reveal(restored = false) {
      const s = steps[i];
      const lines = [];
      // A restored answer on an action step: the action hasn't run in this visit, so its "after" text would describe nothing.
      const after = restored && s.action ? null : typeof s.after === "function" ? s.after(scene) : s.after;
      if (restored) lines.push(h("span.g-saved", "Your saved answer"));
      if (s.guess && picked != null) {
        const right = picked === s.guess.answer;
        guessBox.querySelectorAll(".g-opt").forEach((b, j) => {
          b.classList.toggle("right", j === s.guess.answer);
          b.classList.toggle("wrong", j === picked && !right);
        });
        lines.push(h("b", right ? "You got it. " : `Not quite: it's “${s.guess.options[s.guess.answer]}”. `), s.guess.why);
      } else if (after) {
        lines.push(after);
      }
      if (s.guess && after) lines.push(h("br"), after);
      if (lines.length) {
        result.replaceChildren(...lines);
        result.hidden = false;
      }
      setNext(true);
      s.onReveal?.(scene, makeCtx(token));
    }

    async function runAction() {
      const s = steps[i];
      if (!s.action || actBtn.disabled) return;
      const t = token;
      actBtn.disabled = true;
      actBtn.classList.remove("pulse");
      const result = await s.action.run(scene, makeCtx(t));
      if (t !== token) return;
      // "more": the action has further presses (e.g. one search check per press); keep it ready.
      if (result === "more") {
        actBtn.disabled = false;
        actBtn.classList.add("pulse");
        return;
      }
      actBtn.disabled = !s.action.again;
      // The "now press the button" line is done; say what the reader guessed, then show what really happened.
      if (s.guess && picked != null) say.textContent = `You guessed “${s.guess.options[picked]}”. Here's what really happened:`;
      reveal();
    }

    function showEnd() {
      token++;
      if (!answers.done) { answers.done = true; saveAnswers(); }
      end.hidden = false;
      actBtn.hidden = true;
      nextBtn.hidden = true;
      say.textContent = "";
      guessBox.replaceChildren();
      result.hidden = true;
      const why = h("p.g-why", { hidden: true });
      const answerCheck = (k, restored) => {
        opts.forEach((x, j) => { x.disabled = true; x.classList.toggle("right", j === check.answer); x.classList.toggle("wrong", j === k && k !== check.answer); });
        why.replaceChildren(restored ? h("span.g-saved", "Your saved answer") : "", h("b", k === check.answer ? "Right. " : "Not quite. "), check.why[k] || check.why[check.answer]);
        why.hidden = false;
      };
      const opts = check ? check.options.map((o, k) => {
        const b = h("button.g-opt", { type: "button" }, o);
        b.addEventListener("click", () => {
          answerCheck(k, false);
          answers.check = k;
          saveAnswers();
        });
        return b;
      }) : [];
      if (check && answers.check != null && answers.check < check.options.length) answerCheck(answers.check, true);
      const again = h("button.btn.ghost.sm", { type: "button" }, icon("refresh", 13), "Start again");
      again.addEventListener("click", () => goTo(0));
      end.replaceChildren(
        h("div.g-take", h("span.label", "In one sentence"), h("p", takeaway)),
        check && h("div.g-check", h("span.label", "Quick check"), h("p.g-check-q", check.q), h("div.g-options", opts), why),
        h("div", again));
      paintDots();
    }

    actBtn.addEventListener("click", runAction);
    nextBtn.addEventListener("click", () => (i < steps.length - 1 ? goTo(i + 1) : showEnd()));
    backBtn.addEventListener("click", () => (!end.hidden ? goTo(i) : goTo(Math.max(0, i - 1))));
    replayBtn.addEventListener("click", () => goTo(i));
    resetAnsBtn.addEventListener("click", () => {
      answers = { steps: {}, check: null, done: false };
      B.store.remove(ansKey);
      paintReset();
      window.dispatchEvent(new Event("dojo:answers"));
      seen = 0;
      goTo(0);
    });
    paintReset();
    speedBtn.addEventListener("click", () => {
      slow = !slow;
      B.store.set("slow", slow);
      speedBtn.setAttribute("aria-pressed", String(slow));
    });

    const card = h("div.guided",
      h("div.g-head", h("span.g-title", title), dots, h("div.g-ctrl", resetAnsBtn, speedBtn, replayBtn)),
      view, foot);
    goTo(0);
    return card;
  };

  /* "Before you start": a steady row of chips and ONE shared panel below them.
     Tap a chip to open its meaning; tap another to switch; tap the same one to close. Read chips get a check. */
  B.prereqs = (items) => {
    const term = h("b");
    const text = h("span");
    const body = h("p.pq-text", term, text);
    const panel = h("div.pq-panel", { role: "region", "aria-live": "polite" }, h("div.pq-inner", body));
    let current = -1;
    const chips = items.map(([name, meaning], k) => {
      const chip = h("button.pq-chip", { type: "button", "aria-expanded": "false" },
        h("span.pq-mark", icon("check", 11)), name, h("span.pq-chev", icon("chevron", 12)));
      chip.addEventListener("click", () => {
        if (current === k) {
          current = -1;
          panel.classList.remove("open");
          chip.setAttribute("aria-expanded", "false");
          return;
        }
        const switching = current !== -1;
        current = k;
        chips.forEach((c, j) => c.setAttribute("aria-expanded", String(j === k)));
        chip.classList.add("seen");
        const fill = () => { term.textContent = name + ". "; text.textContent = meaning; };
        if (switching) {
          B.animate(body, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-3px)" }], { duration: 120 })
            .then(() => { fill(); return B.animate(body, [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 220 }); });
        } else {
          fill();
          panel.classList.add("open");
        }
      });
      return chip;
    });
    return h("div.prereqs",
      h("div.pq-head", h("span.pq-label", icon("book", 13), "Before you start"), h("div.pq-chips", chips)),
      panel);
  };
})();
