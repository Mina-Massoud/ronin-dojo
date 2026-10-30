/* film(): explainer motion made with code, like a video you can scrub.
   - Deterministic: every frame is computed from the time t alone (render(t)), so pause, rewind and
     scrubbing always show the correct state. Nothing accumulates between frames.
   - Plays straight through. Chapters are markers on the progress bar; drag or use ←/→ to jump.
   - Captions are cues on the same clock as the motion, so words and pictures always agree.
   - Two layouts: "wide" (desktop) and "tall" (phones), rebuilt when the width crosses 560px.
   Build API, given to build(svg, F, layout):
     F.actor(node, props, draw?)  → an animated thing; props are numbers (x, y, s, o, or any custom one)
     F.to(actor, props, at, dur, ease?) → tween those props to new values from time `at` (seconds)
     F.chapter(at, title)  F.say(at, text)  F.end(t) */
(function () {
  const B = window.Book;
  const { h, icon } = B;
  const NS = "http://www.w3.org/2000/svg";

  B.svg = (tag, attrs = {}, text) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    if (text != null) el.textContent = text;
    return el;
  };

  const EASE = {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  /* Default draw: x/y move, s scales, o fades. Custom actors pass their own draw(props, node). */
  const drawGroup = (p, node) => {
    node.setAttribute("transform", `translate(${p.x ?? 0} ${p.y ?? 0}) scale(${p.s ?? 1})`);
    node.setAttribute("opacity", Math.max(0, Math.min(1, p.o ?? 1)).toFixed(3));
  };

  function makeTimeline() {
    const actors = [];
    const tweens = [];
    const chapters = [];
    const cues = [];
    let end = 0;
    const F = {
      ease: EASE,
      actor(node, props = {}, draw = drawGroup) {
        const a = { node, base: { ...props }, build: { ...props }, cur: { ...props }, draw };
        actors.push(a);
        return a;
      },
      /* Tween from the value the prop has at build time (the previous tween's end) to the new value. */
      to(a, props, at, dur = 0.6, ease = EASE.inOut) {
        const from = {};
        for (const k of Object.keys(props)) from[k] = a.build[k] ?? (k === "o" || k === "s" ? 1 : 0);
        Object.assign(a.build, props);
        tweens.push({ a, from, to: { ...props }, at, dur: Math.max(0.0001, dur), ease });
        end = Math.max(end, at + dur);
        return at + dur;
      },
      set(a, props, at) { return F.to(a, props, at, 0.0001, EASE.linear); },
      chapter(at, title) { chapters.push({ at, title }); },
      say(at, text) { cues.push({ at, text }); },
      end(t) { end = Math.max(end, t); },
    };
    function render(t) {
      for (const a of actors) a.cur = { ...a.base };
      for (const tw of tweens) {
        if (t < tw.at) continue;
        const p = tw.ease(Math.min(1, (t - tw.at) / tw.dur));
        for (const k of Object.keys(tw.to)) tw.a.cur[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * p;
      }
      for (const a of actors) a.draw(a.cur, a.node);
    }
    return { F, render, chapters, cues, get end() { return end; }, tweens };
  }

  B.film = function ({ title, build, wide = [760, 420], tall = [400, 660] }) {
    const stage = h("div.film-stage");
    const caption = h("p.film-caption", { "aria-live": "polite" });
    const playBtn = h("button.film-play", { type: "button", "aria-label": "Play" }, icon("play", 15));
    const scrub = h("input.film-scrub", { type: "range", min: "0", max: "1000", value: "0", step: "1", "aria-label": "Film position" });
    const fill = h("i.film-fill");
    const ticks = h("div.film-ticks");
    const rail = h("div.film-rail", fill, ticks);
    const timeOut = h("span.film-time.tab", "0:00");
    const chapterOut = h("span.film-chapter");
    const slowBtn = h("button.chip", { type: "button", "aria-pressed": String(B.store.get("slow", false)), title: "Play slower" }, "Slow");
    const replayBtn = h("button.tool", { type: "button", "data-tip": "Replay from the start", "aria-label": "Replay from the start" }, icon("refresh", 15));
    const card = h("div.film",
      h("div.g-head", h("span.g-title", icon("play", 12), title), h("div.g-ctrl", slowBtn, replayBtn)),
      stage, caption,
      h("div.film-bar", playBtn, h("div.film-track", rail, scrub), timeOut),
      h("div.film-foot", chapterOut));

    let tl = null;
    let layout = null;
    let t = 0;
    let playing = false;
    let stopAt = null;
    let last = 0;
    let lastCue = null;

    function setup(nextLayout) {
      layout = nextLayout;
      const [w, hgt] = layout === "wide" ? wide : tall;
      const svg = B.svg("svg", { viewBox: `0 0 ${w} ${hgt}`, class: "film-svg " + layout, role: "img", "aria-label": title });
      stage.replaceChildren(svg);
      tl = makeTimeline();
      build(svg, tl.F, layout);
      tl.chapters.sort((a, b) => a.at - b.at);
      tl.cues.sort((a, b) => a.at - b.at);
      ticks.replaceChildren(...tl.chapters.slice(1).map((c) => h("i", { style: { left: `${(c.at / tl.end) * 100}%` } })));
      t = Math.min(t, tl.end);
      paint();
    }
    const chapterIndex = (time) => {
      let k = 0;
      tl.chapters.forEach((c, i) => { if (time >= c.at - 1e-6) k = i; });
      return k;
    };
    const chapterEnd = (k) => (tl.chapters[k + 1] ? tl.chapters[k + 1].at : tl.end);
    const EDGE = 0.02;
    /* The chapter that Play should play now: if we're parked at the end of one, it's the next one. */
    const playingChapter = () => {
      let k = chapterIndex(t);
      if (tl.chapters[k + 1] && t >= chapterEnd(k) - EDGE) k++;
      return k;
    };
    const stopFor = (k) => (tl.chapters[k + 1] ? chapterEnd(k) - 0.002 : tl.end);

    function paint() {
      tl.render(t);
      scrub.value = String(Math.round((t / tl.end) * 1000));
      fill.style.transform = `scaleX(${t / tl.end})`;
      timeOut.textContent = `${fmtTime(t)} / ${fmtTime(tl.end)}`;
      const k = chapterIndex(t);
      chapterOut.replaceChildren(h("b", `Chapter ${k + 1} of ${tl.chapters.length}`), " · " + tl.chapters[k].title);
      let cue = null;
      for (const c of tl.cues) if (t >= c.at - 1e-6) cue = c;
      if (cue !== lastCue) {
        lastCue = cue;
        // `code` in a caption is shown as code (an odd number of backticks leaves the text as it is).
        const parts = cue ? cue.text.split("`") : [];
        if (parts.length % 2) caption.replaceChildren(...parts.map((x, i) => (i % 2 ? h("code", x) : x)));
        else caption.textContent = cue ? cue.text : "";
        if (cue) B.animate(caption, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 300 });
      }
      const done = t >= tl.end - 1e-3;
      playBtn.replaceChildren(icon(playing ? "pause" : done ? "refresh" : "play", 15));
      playBtn.setAttribute("aria-label", playing ? "Pause" : done ? "Watch again" : "Play");
      playBtn.classList.toggle("pulse", !playing && !done);
    }

    function frame(now) {
      if (!playing) return;
      const speed = slowBtn.getAttribute("aria-pressed") === "true" ? 0.6 : 1;
      t = Math.min(stopAt, t + ((now - last) / 1000) * speed);
      last = now;
      if (t >= stopAt - 1e-6) { t = stopAt; playing = false; }
      paint();
      if (playing) requestAnimationFrame(frame);
    }
    function play() {
      if (t >= tl.end - 1e-3) t = 0;
      // Plays straight to the end. With reduced motion, it shows each chapter's last frame instead.
      if (B.reduced) { t = stopFor(playingChapter()); playing = false; return paint(); }
      stopAt = tl.end;
      playing = true;
      last = performance.now();
      paint();
      requestAnimationFrame(frame);
    }
    function pause() { playing = false; paint(); }

    playBtn.addEventListener("click", () => (playing ? pause() : play()));
    replayBtn.addEventListener("click", () => { playing = false; t = 0; paint(); play(); });
    slowBtn.addEventListener("click", () => {
      const on = slowBtn.getAttribute("aria-pressed") !== "true";
      slowBtn.setAttribute("aria-pressed", String(on));
      B.store.set("slow", on);
    });
    // Dragging moves the film; if it was playing, it keeps playing from the new spot.
    scrub.addEventListener("input", () => { t = (Number(scrub.value) / 1000) * tl.end; paint(); });
    card.tabIndex = 0;
    card.addEventListener("keydown", (e) => {
      if (e.target !== card) return;
      if (e.key === " ") { e.preventDefault(); playing ? pause() : play(); }
      if (e.key === "ArrowRight") { e.preventDefault(); const k = chapterIndex(t); t = tl.chapters[k + 1] ? tl.chapters[k + 1].at : tl.end; paint(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); t = tl.chapters[Math.max(0, chapterIndex(t - 1e-3) - (t - tl.chapters[chapterIndex(t)].at < 0.3 ? 1 : 0))].at; paint(); }
    });
    window.addEventListener("dojo:theme", () => tl && tl.render(t));

    const pick = () => (stage.clientWidth && stage.clientWidth < 560 ? "tall" : "wide");
    new ResizeObserver(() => { const next = pick(); if (next !== layout) setup(next); }).observe(stage);
    setup("wide");
    requestAnimationFrame(() => { const next = pick(); if (next !== layout) setup(next); });
    return card;
  };
})();
