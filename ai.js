/* Sensei: AI inside the book, on your own Claude Code login (no API key). ai-bridge.js finds Claude.
   - Select text → Explain / Simpler / Example / Visualize / Ask.
   - Hover any step → its id plus Ask / Explain / Visualize / Screenshot.
   - The sidebar is a chat that knows the current lesson, and can attach a section and a screenshot. */
(function () {
  const { h, icon } = Book;
  const TIERS = [
    { key: "Fast", tier: "quick", hint: "Quick answers, no deep thinking" },
    { key: "Smart", tier: "default", hint: "The everyday choice" },
    { key: "Deep", tier: "complex", hint: "Hard questions, thinks longer" },
  ];
  const MAX_TURNS = 16;
  const HTML2CANVAS = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  const STYLE_EN = "Write in easy English for a reader whose first language is Arabic: short sentences, common words, no idioms. Explain every technical term the first time. Use small concrete examples. Use simple Markdown only (paragraphs, **bold**, `code`, ```code blocks```, - lists).";

  let sample = null;
  let canImages = false;
  /* Masri: how Egyptian developers really talk. Arabic script, Cairo dialect, tech words stay in English. */
  const STYLE_MASRI = "Answer in Egyptian Arabic (Masri, the everyday Cairo dialect), written in Arabic script, the way Egyptian developers talk at work. Keep EVERY technical term in English, exactly as developers say it (closure, promise, event loop, render, state, hook, index, query, callback), and keep all code, names and error messages in English. Do NOT write Modern Standard Arabic (فصحى) and do NOT translate word by word. Example tone: \"الـ closure ده ببساطة function فاكرة الـ variables اللي اتعملت حواليها، حتى بعد ما الـ outer function تخلص.\" Short, friendly sentences. Do not guess the reader's gender: avoid masculine or feminine \"you\" forms; say \"we\" (لو عملنا، بنكتب) or speak about the code itself. Use small concrete examples. Use simple Markdown only (paragraphs, **bold**, `code`, ```code blocks```, - lists).";
  const LANGS = [
    { key: "English", short: "EN", hint: "Easy English" },
    { key: "Masri", short: "مصري", hint: "Egyptian Arabic, tech words in English" },
  ];
  let tierKey = Book.store.get("ai-tier", "Smart");
  let langKey = Book.store.get("ai-lang", "English");
  const masri = () => langKey === "Masri";
  const style = () => (masri() ? STYLE_MASRI : STYLE_EN);
  let turns = [];
  let ctl = null;
  let attach = { section: null, image: null };
  const tierOf = (key) => (TIERS.find((t) => t.key === key) || TIERS[1]).tier;

  /* ---------- tiny, safe Markdown (escape first, then a few patterns) ---------- */
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function md(src) {
    const blocks = [];
    // Code blocks get IDE colors (Book.highlight escapes them itself); the rest is escaped here.
    let text = src.replace(/```[a-z]*\n?([\s\S]*?)(```|$)/g, (_, code) => {
      blocks.push(`<pre class="code-block">${Book.highlight(code.replace(/\n$/, ""))}</pre>`);
      return `\u0000${blocks.length - 1}\u0000`;
    });
    text = esc(text).replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    const out = [];
    let list = null;
    for (const line of text.split("\n")) {
      const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
      if (li) {
        if (!list) { list = /^\s*\d/.test(line) ? "ol" : "ul"; out.push(`<${list}>`); }
        out.push(`<li>${li[1]}</li>`);
        continue;
      }
      if (list) { out.push(`</${list}>`); list = null; }
      if (/^#{1,4}\s/.test(line)) out.push(`<h4>${line.replace(/^#+\s/, "")}</h4>`);
      else if (line.trim()) out.push(`<p>${line}</p>`);
    }
    if (list) out.push(`</${list}>`);
    return out.join("").replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
  }

  /* ---------- page context ---------- */
  const lessonId = () => location.hash.replace(/^#/, "") || "home";
  function lessonContext() {
    const main = document.getElementById("main");
    const title = main.querySelector("h1")?.textContent || "Home";
    const body = (main.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 6000);
    return { title, body };
  }
  function around(range) {
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    const block = el?.closest(".step, .stage, .drill, section, header") || el;
    return (block?.innerText || "").slice(0, 1500);
  }
  function sectionInfo(stepEl) {
    const text = [...stepEl.children].filter((c) => !c.classList.contains("sec-tools")).map((c) => c.innerText).join("\n");
    return {
      id: stepEl.id,
      title: stepEl.querySelector(".step-head h2")?.textContent || stepEl.id,
      text: text.slice(0, 3000),
    };
  }

  /* ---------- screenshots (html2canvas, loaded on first use) ---------- */
  let h2cPromise = null;
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    h2cPromise ??= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = HTML2CANVAS;
      s.onload = () => resolve(window.html2canvas);
      s.onerror = () => { h2cPromise = null; reject(new Error("Could not load the screenshot tool.")); };
      document.head.append(s);
    });
    return h2cPromise;
  }
  /* el = one element, or null for "what I see now". Hides Sensei's own UI while capturing. */
  async function screenshot(el) {
    const h2c = await loadH2C();
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--panel").trim();
    document.body.classList.add("ai-capturing");
    try {
      const opts = { backgroundColor: bg, scale: Math.min(2, window.devicePixelRatio || 1), logging: false };
      const canvas = el
        ? await h2c(el, opts)
        : await h2c(document.body, { ...opts, x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight, windowWidth: document.documentElement.clientWidth });
      return await new Promise((r) => canvas.toBlob(r, "image/png"));
    } finally {
      document.body.classList.remove("ai-capturing");
    }
  }

  /* ---------- small menu (same look as the Appearance menu) ---------- */
  let menuEl = null;
  function closeMenu() { menuEl?.remove(); menuEl = null; }
  document.addEventListener("click", (e) => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); });

  /* ---------- sidebar ---------- */
  const log = h("div.ai-log", { "aria-live": "polite" });
  const emptyState = () => h("div.ai-empty",
    h("span.mark", icon("sparkles", 17)),
    h("h3", "Ask Sensei anything"),
    h("p", "Sensei reads the lesson you have open, and answers in simple English."),
    h("ul",
      h("li", icon("lightbulb", 14), "Select any text on the page"),
      h("li", icon("hash", 14), "Hover a step for quick actions"),
      h("li", icon("camera", 14), "Send a screenshot of a demo")),
    h("p.hint", "Runs on your own Claude account. The first time, Claude asks you to allow it."));
  log.append(emptyState());

  const input = h("textarea", { id: "ai-input", rows: "1", dir: "auto", placeholder: "Ask about this lesson…", "aria-label": "Ask Sensei" });
  const sendBtn = h("button.ai-send", { type: "button", "aria-label": "Send" }, icon("arrowUp", 16));
  const shotBtn = h("button.tool", { type: "button", hidden: true, "data-tip": "Attach a screenshot", "aria-label": "Attach a screenshot of what you see" }, icon("camera"));
  const where = h("span.ai-where", "");
  const attRow = h("div.ai-attach");
  const modelBtn = h("button.ai-model", { type: "button", "aria-haspopup": "menu" }, tierKey, icon("chevron", 11));
  const langLabel = () => LANGS.find((l) => l.key === langKey)?.short || "EN";
  const langBtn = h("button.ai-model", { type: "button", "aria-haspopup": "menu", "aria-label": "Answer language", "data-tip": "Answer language" }, langLabel(), icon("chevron", 11));
  const QUICK = [
    ["Quiz me", "Quiz me on this lesson. Ask me ONE interview question at a time. Wait for my answer, then grade it from 1 to 5 and show a better answer."],
    ["What will they ask?", "List the 5 interview questions about this lesson that I am most likely to get, from most to least common. One line each."],
    ["Explain like I'm new", "Explain the main idea of this lesson in 5 short sentences, with one everyday analogy."],
    ["Grade my answer", null],
  ];
  const quick = h("div.ai-quick", QUICK.map(([label, prompt]) => {
    const b = h("button.chip", { type: "button" }, label);
    b.addEventListener("click", () => {
      if (prompt) return ask(prompt, { show: label });
      input.value = "Grade my answer. The question: \nMy answer: ";
      autosize();
      input.focus();
    });
    return b;
  }));
  const wideBtn = h("button.tool", { type: "button", "data-tip": "Wider", "aria-label": "Make the panel wider" }, icon("expand", 15));
  const closeBtn = h("button.tool", { type: "button", "data-tip": "Close", "aria-label": "Close Sensei" }, icon("close", 15));
  const panel = h("aside.ai-panel", { id: "ai-panel", "aria-label": "Sensei", "aria-hidden": "true" },
    h("div.ai-head",
      h("div.ai-title", icon("sparkles", 15), "Sensei", modelBtn, langBtn),
      h("div.ai-head-tools", wideBtn, closeBtn)),
    log,
    h("div.ai-compose", quick, attRow,
      h("div.ai-box", input, h("div.ai-box-bar", h("div", { style: { display: "flex", alignItems: "center", gap: "4px", minWidth: "0" } }, shotBtn, where), sendBtn))));
  const fab = h("button.ai-fab", { type: "button", "aria-controls": "ai-panel" }, icon("sparkles", 15), "Ask Sensei", h("kbd", "/"));

  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 160) + "px"; }
  input.addEventListener("input", autosize);

  function open() {
    if (document.body.classList.contains("ai-off")) return; // no Claude here: the book reads fine without it
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    where.textContent = "Reading: " + lessonContext().title;
    setTimeout(() => input.focus({ preventScroll: true }), 250);
  }
  function close() { panel.classList.remove("open", "wide"); panel.setAttribute("aria-hidden", "true"); }
  fab.addEventListener("click", () => (panel.classList.contains("open") ? close() : open()));
  closeBtn.addEventListener("click", close);
  wideBtn.addEventListener("click", () => panel.classList.toggle("wide"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); hideBar(); closeMenu(); }
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) { e.preventDefault(); open(); }
  });
  /* A small pick-one menu under a header pill (model, language). */
  function pillMenu(btn, title, items, current, pick) {
    closeMenu();
    const m = h("div.menu", { role: "menu" }, h("div.menu-title", title), items.map((t) => {
      const b = h("button", { type: "button", role: "menuitemradio", "aria-checked": String(t.key === current) },
        h("span.opt-text", h("span.opt-name", t.name || t.key), h("span.opt-hint", t.hint)),
        t.key === current && h("span.check", icon("check", 14)));
      b.addEventListener("click", () => { pick(t); closeMenu(); });
      return b;
    }));
    document.body.append(m);
    const r = btn.getBoundingClientRect();
    m.style.top = `${r.bottom + 6}px`;
    m.style.left = `${Math.min(r.left, innerWidth - 230)}px`;
    menuEl = m;
  }
  modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pillMenu(modelBtn, "Model", TIERS, tierKey, (t) => {
      tierKey = t.key;
      Book.store.set("ai-tier", t.key);
      modelBtn.replaceChildren(t.key, icon("chevron", 11));
    });
  });
  langBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pillMenu(langBtn, "Answer language", LANGS.map((l) => ({ ...l, name: l.key === "Masri" ? "مصري · Masri" : l.key })), langKey, (l) => {
      langKey = l.key;
      Book.store.set("ai-lang", l.key);
      langBtn.replaceChildren(langLabel(), icon("chevron", 11));
    });
  });

  /* Attachments shown above the input; they ride along with the next question. */
  function renderAttach() {
    const chips = [];
    if (attach.section) {
      const x = h("button", { type: "button", "aria-label": "Remove section" }, icon("close", 12));
      x.addEventListener("click", () => { attach.section = null; renderAttach(); });
      chips.push(h("span.ai-att", h("span.id", attach.section.id), attach.section.title, x));
    }
    if (attach.image) {
      const url = URL.createObjectURL(attach.image);
      const img = h("img", { src: url, alt: "Screenshot to send" });
      img.addEventListener("load", () => URL.revokeObjectURL(url));
      const x = h("button", { type: "button", "aria-label": "Remove screenshot" }, icon("close", 12));
      x.addEventListener("click", () => { attach.image = null; renderAttach(); });
      chips.push(h("span.ai-att", img, "Screenshot", x));
    }
    attRow.replaceChildren(...chips);
  }
  async function attachShot(el) {
    shotBtn.disabled = true;
    try {
      attach.image = await screenshot(el);
      renderAttach();
    } catch (err) {
      bubble("assistant", "").append(h("p.ai-err", err.message || "Screenshot failed."));
    } finally {
      shotBtn.disabled = false;
    }
  }
  shotBtn.addEventListener("click", async () => {
    close();
    await new Promise((r) => setTimeout(r, 480)); // let the panel slide away first
    await attachShot(null);
    open();
  });

  const ERR = {
    not_granted: "Sensei isn't allowed on this page.",
    unavailable: "The Ronin Dojo app isn't running. Start it again, then reload this page.",
    not_subscription: "Stopped: Claude Code isn't using your subscription login, so this could cost money. Run `claude` and sign in with your Claude account.",
    timeout: "Claude took too long. Try again, or pick Fast.",
    sampling_disabled: "Claude isn't available for this account.",
    rate_limited: "Too many questions at once, or your usage limit is reached. Try again in a bit.",
    session_expired: "Please sign in to Claude Code again (run `claude` in a terminal).",
    refused: "Claude declined that one. Try asking it a different way.",
    prompt_too_large: "That was too much text. Select less and try again.",
    image_rejected: "Claude couldn't read that screenshot. Try a smaller section.",
    images_unavailable: "Screenshots can't be sent from this view. Ask without one.",
  };
  const errText = (e) => ERR[e?.code] || "Something went wrong talking to Claude. Try again.";

  function bubble(role, content, { image, ref } = {}) {
    log.querySelector(".ai-empty")?.remove();
    const b = h("div.ai-msg." + role);
    if (role === "user") {
      b.dir = "auto"; // a question typed in Arabic reads right to left
      if (ref) b.append(h("span.ref", ref));
      b.append(content);
    } else if (content) b.innerHTML = md(content);
    if (image) b.append(h("img.ai-thumb", { src: URL.createObjectURL(image), alt: "Screenshot sent" }));
    log.append(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }
  const thinking = (text = "Thinking") => h("div.ai-thinking", h("i"), h("i"), h("i"), h("span", text));
  function busy(on) {
    fab.classList.toggle("thinking", on);
    sendBtn.classList.toggle("stop", on);
    sendBtn.setAttribute("aria-label", on ? "Stop" : "Send");
    sendBtn.replaceChildren(icon(on ? "stop" : "arrowUp", on ? 14 : 16));
  }
  function handleFail(e, out) {
    if (e?.text) out.innerHTML = md(e.text);
    else out.replaceChildren();
    if (e?.code !== "cancelled") out.append(h("p.ai-err", errText(e)));
    else out.append(h("p.hint", "Stopped."));
    if (e?.code === "not_granted" || e?.code === "sampling_disabled") disable();
  }

  /* Chat turn. `show` replaces a long prompt in the log with a short label. Attachments are used once. */
  async function ask(prompt, { show, extra = "" } = {}) {
    if (!sample) return;
    open();
    const ctx = lessonContext();
    const sec = attach.section;
    const image = canImages ? attach.image : null;
    attach = { section: null, image: null };
    renderAttach();
    const secText = sec ? `\n\nThe reader is asking about step ${sec.id} ("${sec.title}"):\n"""\n${sec.text}\n"""` : "";
    const imgText = image ? "\n\nA screenshot of what the reader sees is attached. Use it: refer to what is on screen (numbers, positions, states)." : "";
    const rules = `You are Sensei, a patient senior engineer inside an interactive interview-prep book. The reader is Mina, a frontend developer with 2 years of experience, preparing for mid/senior frontend, mid-level full-stack, and Three.js interviews. Mina knows almost no backend yet. ${style()} Keep answers under 200 words unless asked for more. When useful, end with one short question that checks understanding.\n\nThe page open now is "${ctx.title}". Its text:\n"""\n${ctx.body}\n"""${secText}${extra}${imgText}`;
    turns.push({ role: "user", content: prompt });
    turns = turns.slice(-MAX_TURNS);
    bubble("user", show || prompt, { image, ref: sec ? `${sec.id} · ${sec.title}` : null });
    const out = bubble("assistant", "");
    if (masri()) out.dir = "rtl";
    out.append(thinking());
    ctl?.abort();
    const myCtl = (ctl = new AbortController());
    busy(true);
    try {
      const { text, truncated } = await sample([{ role: "user", content: rules }, ...turns], {
        cache: false, signal: myCtl.signal, modelTier: tierOf(tierKey), ...(image ? { images: [image] } : {}),
        onText: ({ text: t }) => { out.innerHTML = md(t); log.scrollTop = log.scrollHeight; },
      });
      turns.push({ role: "assistant", content: text });
      if (truncated) out.append(h("p.hint", "Cut short. Ask for the rest."));
    } catch (e) {
      handleFail(e, out);
    } finally {
      if (ctl === myCtl) busy(false);
    }
  }
  function send() {
    if (sendBtn.classList.contains("stop")) return ctl?.abort();
    const q = input.value.trim();
    if (!q && !attach.image && !attach.section) return;
    input.value = "";
    autosize();
    ask(q || "Explain what I'm looking at, and what I should notice.");
  }
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });

  /* ---------- Visualize: Claude writes a small interactive demo, run in a sealed frame ---------- */
  function themeVars() {
    const cs = getComputedStyle(document.documentElement);
    return ["--panel", "--field", "--ink", "--ink-soft", "--ink-muted", "--line"].map((t) => `${t}: ${cs.getPropertyValue(t).trim()}`).join("; ");
  }
  const SIZE_PROBE = "<script>(function(){var s=function(){parent.postMessage({dojoVizHeight:document.documentElement.scrollHeight},'*')};new ResizeObserver(s).observe(document.documentElement);addEventListener('load',s)})()<\/script>";
  function extractHtml(text) {
    const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    const raw = (fence ? fence[1] : text).trim();
    const start = raw.search(/<!doctype|<html|<style|<div|<canvas|<svg/i);
    return start >= 0 ? raw.slice(start) : raw;
  }
  async function visualize(idea, context) {
    if (!sample) return;
    open();
    bubble("user", `“${idea.slice(0, 160)}${idea.length > 160 ? "…" : ""}”`, { ref: "Visualize" });
    const card = h("div.ai-msg.assistant", thinking("Designing the visual"));
    log.append(card);
    log.scrollTop = log.scrollHeight;
    const prompt = `Make ONE small interactive visual that teaches this idea to a developer preparing for interviews.

IDEA: """${idea.slice(0, 1500)}"""
WHERE IT APPEARS (lesson "${lessonContext().title}"): """${context}"""

Rules:
- Reply with ONLY one complete HTML document in a \`\`\`html code block. No other text.
- Everything inline (CSS and JS). No external scripts, fonts, images or network: they are blocked.
- Clean, calm design like a modern macOS app: soft greys, rounded corners (10–14px), subtle shadows, no harsh borders. Use exactly these CSS variables on :root: ${themeVars()}. Body background var(--panel), text var(--ink). font-family: Inter, "Segoe UI", system-ui; code: ui-monospace.
- Width 100% of the frame, height at most 440px. Body margin 0, padding 16px.
- The reader must DO something: at least one button or slider that changes what they see. Show the difference the idea makes (before/after, slow/fast, wrong/right).
- Motion: requestAnimationFrame or element.animate(); animate transform and opacity. Respect prefers-reduced-motion.
- At most 3 short lines of text, ${masri() ? "in Egyptian Arabic (Masri) with every technical term in English; put dir=\"rtl\" on those text elements" : "in easy English"}. Label the parts.
- Under 200 lines.`;
    ctl?.abort();
    const myCtl = (ctl = new AbortController());
    busy(true);
    try {
      let lines = 0;
      const status = card.querySelector(".ai-thinking span");
      const { text } = await sample(prompt, {
        signal: myCtl.signal, modelTier: tierKey === "Fast" ? "default" : tierOf(tierKey), cache: false,
        onText: ({ text: t }) => {
          const n = t.split("\n").length;
          if (n !== lines && status) { lines = n; status.textContent = `Writing the visual · ${n} lines`; }
        },
      });
      const html = extractHtml(text);
      const doc = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, SIZE_PROBE + "</body>") : html + SIZE_PROBE;
      const frame = h("iframe.ai-viz", { sandbox: "allow-scripts", title: "Visual made by Sensei", srcdoc: doc });
      const big = h("button.tool", { type: "button", "data-tip": "Wider", "aria-label": "Make the panel wider" }, icon("expand", 15));
      big.addEventListener("click", () => panel.classList.toggle("wide"));
      const again = h("button.tool", { type: "button", "data-tip": "Try another", "aria-label": "Make another visual" }, icon("refresh", 15));
      again.addEventListener("click", () => visualize(idea, context));
      card.classList.add("viz");
      card.replaceChildren(frame, h("div.ai-viz-bar", h("span.hint", "Made by Claude · runs sealed"), h("div.ai-btns", again, big)));
      log.scrollTop = log.scrollHeight;
    } catch (e) {
      handleFail(e, card);
    } finally {
      if (ctl === myCtl) busy(false);
    }
  }
  window.addEventListener("message", (e) => {
    const height = e.data && e.data.dojoVizHeight;
    if (typeof height !== "number") return;
    for (const f of document.querySelectorAll("iframe.ai-viz")) {
      if (f.contentWindow === e.source) f.style.height = Math.min(Math.max(height, 160), 900) + "px";
    }
  });

  /* ---------- hover tools on every step ---------- */
  function decorate() {
    const id = lessonId();
    document.querySelectorAll("#main .step").forEach((step) => {
      if (step.querySelector(".sec-tools")) return;
      const n = step.querySelector(".step-head .n")?.textContent?.trim() || "";
      step.id = `${id}-${n}`;
      const btn = (name, tip, fn) => {
        const b = h("button.tool", { type: "button", "data-tip": tip, "aria-label": tip }, icon(name, 15));
        b.addEventListener("click", (e) => { e.stopPropagation(); fn(sectionInfo(step)); });
        return b;
      };
      const tools = h("div.sec-tools", { role: "toolbar", "aria-label": `Ask Sensei about step ${n}` },
        h("span.sec-id", icon("hash", 12), step.id),
        btn("message", "Ask about this", (s) => { attach.section = s; renderAttach(); open(); }),
        btn("lightbulb", "Explain", (s) => { attach.section = s; ask("Explain this step in simple words. What is the key idea, and what should I notice in the demo?", { show: "Explain this step" }); }),
        btn("wand", "Visualize", (s) => visualize(`${s.title}. ${s.text.slice(0, 600)}`, s.text)),
        canImages && btn("camera", "Screenshot & ask", async (s) => {
          attach.section = s;
          await attachShot(step);
          renderAttach();
          open();
        }));
      step.prepend(tools);
    });
  }
  Book.afterRender = Book.afterRender || [];
  Book.afterRender.push(() => { decorate(); if (panel.classList.contains("open")) where.textContent = "Reading: " + lessonContext().title; });

  /* ---------- selection bar ---------- */
  const ACTIONS = [
    ["lightbulb", "Explain", (s, c) => ask(`Explain this part in simple words, with one small example:\n"""${s}"""`, { show: `Explain: “${s.slice(0, 140)}”`, extra: `\n\nThe selected part sits here:\n"""${c}"""` })],
    ["feather", "Simpler", (s, c) => ask(`Say this again much more simply, like to a beginner. Max 4 short sentences:\n"""${s}"""`, { show: `Simpler: “${s.slice(0, 140)}”`, extra: `\n\nContext:\n"""${c}"""` })],
    ["code", "Example", (s, c) => ask(`Give me one real-world example of this from a production web app (like a booking SaaS), with a short code snippet if it helps:\n"""${s}"""`, { show: `Example: “${s.slice(0, 140)}”`, extra: `\n\nContext:\n"""${c}"""` })],
    null,
    ["wand", "Visualize", (s, c) => visualize(s, c)],
    ["message", "Ask", (s) => { open(); input.value = `About “${s.slice(0, 300)}”: `; autosize(); input.focus(); }],
  ];
  const bar = h("div.ai-bar", { role: "toolbar", "aria-label": "Ask Sensei about the selection", hidden: true });
  let current = null;
  ACTIONS.forEach((a) => {
    if (!a) return bar.append(h("span.sep"));
    const [ico, label, run] = a;
    const b = h("button", { type: "button" }, icon(ico, 14), label);
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => { if (!current) return; const { text, ctx } = current; hideBar(); window.getSelection()?.removeAllRanges(); run(text, ctx); });
    bar.append(b);
  });
  function hideBar() { bar.hidden = true; current = null; }
  let selTimer = 0;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() || "";
      if (!sample || !sel || sel.rangeCount === 0 || text.length < 2 || text.length > 4000) return hideBar();
      const range = sel.getRangeAt(0);
      const host = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      if (!host?.closest("#main") || host.closest("textarea, input, .sec-tools")) return hideBar();
      current = { text, ctx: around(range) };
      const r = range.getBoundingClientRect();
      bar.hidden = false;
      const bw = bar.offsetWidth;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - bw / 2), window.innerWidth - bw - 8);
      const top = r.top > 60 ? r.top - 48 : r.bottom + 10;
      bar.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }, 220);
  });
  window.addEventListener("scroll", () => { if (!bar.hidden) hideBar(); }, { passive: true });

  function disable() {
    fab.classList.add("off");
    log.append(h("p.hint", "Sensei is off. Check that Claude Code is signed in, then reload."));
  }

  document.body.append(bar, panel, fab);
  document.body.classList.add("ai-off"); // until the page proves it can reach Claude
  /* Interview practice: Sensei plays the interviewer for one real question, then grades the answer. */
  function practice(question, testing) {
    open();
    ask(`Act as the interviewer for a mid/senior frontend role. Ask me exactly this question, then stop and wait for my answer:
"${question}"

When I answer, grade it from 1 to 5 for correctness, depth and clear communication. Say what was missing, then give a short model answer.${masri() ? " Real interviews are in English, so ask the question in English and write the model answer in English (so I can practice saying it). Write your grading and feedback in Masri, as the style says." : ""}${testing ? ` The interviewer is really testing: ${testing}.` : ""}`, { show: `Interview me: “${question.slice(0, 120)}”` });
  }
  Book.sensei = { open, practice };

  /* Light up only where the book can reach Claude (the local app with Claude Code signed in). */
  Book.connectClaude().then(async (s) => {
    sample = s;
    // No Claude (a local copy, a public view, or no account): keep reading; every AI control stays hidden.
    if (!s) return;
    document.body.classList.remove("ai-off");
    const limits = await s.limits().catch(() => null);
    canImages = Boolean(limits?.images);
    shotBtn.hidden = !canImages;
    document.querySelectorAll("#main .sec-tools").forEach((t) => t.remove());
    decorate();
  }).catch(() => {});
})();
