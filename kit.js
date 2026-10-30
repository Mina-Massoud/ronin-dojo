/* Shared building blocks for every lesson. Lessons call Book.registerLesson(id, { mount(root) }). */
(function () {
  const B = (window.Book = window.Book || {});
  B.lessons = B.lessons || {};
  B.registerLesson = (id, def) => { B.lessons[id] = def; };

  B.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  B.ease = { sheet: "cubic-bezier(0.32, 0.72, 0, 1)", pop: "cubic-bezier(0.34, 1.56, 0.64, 1)", linear: "linear" };

  /* h("div.cls", { onclick, style }, ...children) */
  B.h = function h(sel, attrs, ...kids) {
    const [tag, ...classes] = sel.split(".");
    const el = document.createElement(tag || "div");
    if (classes.length) el.className = classes.join(" ");
    if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) {
      kids.unshift(attrs);
      attrs = null;
    }
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  B.sleep = (ms) => new Promise((r) => setTimeout(r, B.reduced ? 0 : ms));

  /* Web Animations API wrapper: always resolves, jumps to the end state when motion is reduced. */
  B.animate = (el, keyframes, opts = {}) => {
    const o = { duration: 500, easing: B.ease.sheet, fill: "both", ...opts };
    if (B.reduced) o.duration = 0;
    const anim = el.animate(keyframes, o);
    // A hidden tab pauses animation timelines; the timer makes sure a guided step never stalls.
    const timer = new Promise((r) => setTimeout(() => { anim.finish(); r(); }, (o.duration || 0) + (o.delay || 0) + 80));
    return Promise.race([anim.finished, timer]).catch(() => {});
  };

  /* Tween a number with rAF (a timer takes over when the tab is hidden); onUpdate gets the eased value. */
  B.tween = ({ from = 0, to = 1, ms = 600, ease = (t) => 1 - Math.pow(1 - t, 3), onUpdate }) =>
    new Promise((resolve) => {
      if (B.reduced || ms <= 0) { onUpdate(to); return resolve(); }
      const t0 = performance.now();
      let done = false;
      const tick = () => {
        if (done) return;
        const t = Math.min(1, (performance.now() - t0) / ms);
        onUpdate(from + (to - from) * ease(t));
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          done = true;
          resolve();
        }
      };
      requestAnimationFrame(tick);
      setTimeout(() => { if (!done) { done = true; onUpdate(to); resolve(); } }, ms + 120);
    });

  B.fmt = (n, digits = 0) => Number(n).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  B.ms = (n) => (n >= 100 ? B.fmt(n) : n >= 10 ? B.fmt(n, 1) : B.fmt(n, 2)) + " ms";

  /* Light SQL highlighting for display blocks. */
  const KW = /\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|LIMIT|DESC|ASC|CREATE|INDEX|CONCURRENTLY|ON|USING|LIKE|INSERT|INTO|VALUES|EXPLAIN|ANALYZE|INCLUDE|interval|now|lower|gin|gin_trgm_ops|true|false)\b/g;
  B.sql = (text) => {
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = esc
      .replace(/(--[^\n]*)/g, "<span class=\"cm\">$1</span>")
      .replace(/('[^']*')/g, "<span class=\"str\">$1</span>")
      .replace(KW, "<span class=\"kw\">$1</span>");
    return B.h("pre.sql", { html });
  };

  /* A word note: dotted underline, tap or hover shows a plain-English meaning. */
  B.word = (term, meaning) => {
    const tip = B.h("span.word-tip", { role: "tooltip" }, meaning);
    const w = B.h("button.word", { type: "button", "aria-label": `${term}: ${meaning}` }, term, tip);
    // Keep the note inside the screen: centered on the word, nudged in near the edges (phones).
    const fit = () => {
      tip.style.setProperty("--tip-dx", "0px");
      const r = tip.getBoundingClientRect();
      const pad = 8;
      const dx = r.left < pad ? pad - r.left : r.right > innerWidth - pad ? innerWidth - pad - r.right : 0;
      tip.style.setProperty("--tip-dx", `${Math.round(dx)}px`);
    };
    w.addEventListener("pointerenter", fit);
    w.addEventListener("focus", fit);
    w.addEventListener("click", (e) => { e.stopPropagation(); fit(); w.classList.toggle("open"); });
    document.addEventListener("click", () => w.classList.remove("open"));
    return w;
  };

  /* "Go deeper": a few external resources for one page. links: [{ title, url, type, by?, mins? }]
     type is video | article | book | doc | course. They open in a new tab. */
  const LINK_ICON = { video: "play", article: "feather", book: "book", doc: "code", course: "layers" };
  B.goDeeper = (links) =>
    B.h("div.go-deeper",
      B.h("span.label", "Go deeper"),
      B.h("ul", links.map((l) => B.h("li",
        B.h("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" },
          B.h("span.gd-type", B.icon(LINK_ICON[l.type] || "feather", 13), l.type),
          B.h("span.gd-title", l.title),
          (l.by || l.mins) && B.h("span.gd-meta", [l.by, l.mins && `${l.mins} min`].filter(Boolean).join(" · ")))))));

  /* One idea = one step: a title, up to three short lines, a demo, and optional "Go deeper" links. */
  B.step = ({ n, title, lines = [], demo, links }) =>
    B.h("section.step",
      B.h("div.step-head",
        B.h("span.n", n),
        B.h("h2", title),
        B.h("div.step-lines", lines.slice(0, 3).map((l) => B.h("p", l)))),
      demo && B.h("div.step-demo", demo),
      links && links.length && B.goDeeper(links));

  /* A stage: toolbar on top, live area below. */
  B.stage = ({ left = [], right = [], body }) =>
    B.h("div.stage",
      B.h("div.stage-bar", B.h("div.left", left), B.h("div.right", right)),
      B.h("div.stage-body", body));

  /* B.runnable lives in kit-code.js (IDE colors, explained results). */

  /* Interview drill: questions you tap to reveal. */
  B.drill = (items) =>
    B.h("div.drill", items.map(({ q, a }) =>
      B.h("details", B.h("summary", B.h("span", q)), B.h("div.ans", (Array.isArray(a) ? a : [a]).map((p) => B.h("p", p))))));

  /* Stroke icons, Lucide-style geometry (same set as Quiet). Static markup only, never user data. */
  const ICONS = {
    sparkles: '<path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4Z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z"/><path d="M5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6Z"/>',
    message: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    wand: '<path d="m15 4 5 5L9 20H4v-5Z"/><path d="m13 6 5 5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
    lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
    feather: '<path d="M20 4c-6 0-12 4-12 12v4"/><path d="M8 16c4 0 8-2 10-6"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5M8 7h7"/>',
    play: '<path d="M7 4.5v15l12-7.5Z" fill="currentColor"/>',
    pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  };
  B.icon = (name, size = 16) => {
    const span = document.createElement("span");
    span.className = "ico";
    span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
    return span;
  };

  /* Per-viewer progress, best effort only. */
  B.store = {
    get(key, fallback) { try { const v = localStorage.getItem("dojo:" + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem("dojo:" + key, JSON.stringify(value)); } catch { /* storage blocked: progress just isn't kept */ } },
    remove(key) { try { localStorage.removeItem("dojo:" + key); } catch { /* nothing to remove */ } },
    keys(prefix) {
      try { return Object.keys(localStorage).filter((k) => k.startsWith("dojo:" + prefix)).map((k) => k.slice(5)); } catch { return []; }
    },
  };
})();
