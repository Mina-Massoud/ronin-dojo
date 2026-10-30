/* The book shell: contents rail, home page, lesson pages. Routes are bare #tokens (lesson ids). */
(function () {
  const { h, store, animate, icon } = Book;
  const C = window.CURRICULUM;
  const M = window.MARKET;
  const rail = document.getElementById("rail");
  const main = document.getElementById("main");
  const menuBtn = document.getElementById("menu-btn");

  const WEIGHT = { H: "Asked often", M: "Asked sometimes", L: "Rarely asked" };
  const allLessons = C.weeks.flatMap((w) => w.lessons.map((l) => ({ ...l, week: w })));
  const isBuilt = (id) => Boolean(Book.lessons[id]);
  const doneSet = () => new Set(store.get("done", []));
  const toggleDone = (id) => {
    const d = doneSet();
    d.has(id) ? d.delete(id) : d.add(id);
    store.set("done", [...d]);
  };

  function renderRail(current) {
    const done = doneSet();
    const pct = done.size / allLessons.length;
    const themeBtn = h("button.item", { type: "button", "aria-haspopup": "menu" },
      icon("sun"), h("span.label", "Appearance"), h("span.side", Book.theme.label()));
    themeBtn.addEventListener("click", (e) => { e.stopPropagation(); Book.theme.open(themeBtn); });
    const senseiBtn = h("button.item", { type: "button", "data-ai": "" }, icon("sparkles"), h("span.label", "Ask Sensei"), h("span.side", "/"));
    senseiBtn.addEventListener("click", () => Book.sensei?.open());
    rail.replaceChildren(
      h("div.rail-top",
        h("a", { href: "#home" }, h("span.mark", icon("book", 14)), C.title),
        h("span.ver", C.version)),
      h("div.rail-progress",
        h("div.row", h("span", "Progress"), h("span.tab", `${done.size} / ${allLessons.length}`)),
        h("div.meter-line", { style: { "--p": String(pct) } }, h("i"))),
      h("nav", { "aria-label": "Contents" }, C.weeks.map((w, i) => [
        w.phase && w.phase !== C.weeks[i - 1]?.phase && h("div.sb-phase", w.phase),
        h("div.sb-label", h("span", w.label || `Week ${w.n}`), h("span", w.short)),
        w.lessons.map((l) => {
          const cls = done.has(l.id) ? "done" : isBuilt(l.id) ? "built" : "planned";
          return h("a.item." + cls, { href: "#" + l.id, "aria-current": l.id === current ? "page" : null, title: cls === "planned" ? "Planned" : null },
            h("span.state", cls === "done" ? icon("check", 13) : null), h("span.label", l.title));
        }),
      ])),
      h("div.rail-bottom", senseiBtn, themeBtn),
    );
  }
  window.addEventListener("dojo:theme", () => {
    const side = rail.querySelector(".rail-bottom .item:last-child .side");
    if (side) side.textContent = Book.theme.label();
  });

  function weekProgress(w, done) {
    const n = w.lessons.filter((l) => done.has(l.id)).length;
    return n / w.lessons.length;
  }

  function renderHome() {
    syncResetAll = () => {};
    const done = doneSet();
    const next = allLessons.find((l) => isBuilt(l.id) && !done.has(l.id)) || allLessons.find((l) => isBuilt(l.id));
    const cell = (v) => v == null
      ? h("td.muted", "—")
      : h("td", h("div.meter", h("b", { style: { width: Math.max(2, v * 0.7) + "px" } }), h("span.tab", v + "%")));
    main.replaceChildren(h("div.col",
      h("header.home-hero",
        h("span.label", C.subtitle),
        h("h1", "You built it.", h("br"), h("span", "Now prove you know how it works.")),
        h("p", C.pitch),
        h("div.row",
          next && h("a.btn", { href: "#" + next.id }, `Start: ${next.title}`),
          h("a.btn.ghost", { href: "#plan" }, "See the map"))),

      h("section.sec", { id: "market" },
        h("h2", "Who is hiring, and for what"),
        h("p.lede", M.lede),
        h("div.targets", M.roles.map((r) =>
          h("article.target",
            h("div.top", h("span.rank.tab", "#" + r.rank), h("span.chip", r.reach)),
            h("h3", r.title),
            h("p", r.why),
            h("ul", r.pay.map((p) => h("li", p)))))),
        h("div.skill-table-wrap",
          h("table.skill-table",
            h("thead", h("tr", h("th", "Skill"), M.columns.map((c) => h("th", c)), h("th", "In this book"))),
            h("tbody", M.skills.map((s) => h("tr",
              h("td", s.name),
              s.pct.map(cell),
              h("td.muted", s.week === "G" ? "Graphics track" : `Week ${s.week}`)))))),
        h("p.muted", { style: { fontSize: "13px" } }, M.note),
        h("div.egypt", h("span.label", "About your 40k EGP goal"), h("p", M.egypt))),

      h("section.sec", { id: "loop" },
        h("h2", "What the interview looks like in 2026"),
        h("div.weeks", M.loop.map(([name, what], i) =>
          h("div.week", h("span.wk", `Round ${i + 1}`), h("div", h("h3", name), h("p.goal", what))))),
        h("p.lede", M.ai)),

      h("section.sec", { id: "plan" },
        h("h2", "The map"),
        h("p.lede", "75 lessons, about 500 pages, in three phases. Frontend first (the most reachable role), then full-stack from zero, then your own work defended. Each lesson lists what to learn first."),
        h("div.weeks", C.weeks.map((w, i) => [
          w.phase && w.phase !== C.weeks[i - 1]?.phase && h("h3.map-phase", `Phase: ${w.phase}`),
          h("div.week",
            h("span.wk", w.label || `Week ${w.n}`),
            h("div", h("h3", w.title), h("p.goal", w.goal)),
            h("span.bar", h("i", { style: { "--p": String(weekProgress(w, done)) } }))),
        ]))),

      h("section.sec",
        h("h2", "How every lesson works"),
        h("div.weeks", C.rules.map((r, i) =>
          h("div.week", h("span.wk", `Rule ${i + 1}`), h("div", h("h3", r[0]), h("p.goal", r[1]))))))));
  }

  // The lesson footer's "Reset answers" button follows saved answers (visuals fire "dojo:answers").
  let syncResetAll = () => {};
  window.addEventListener("dojo:answers", () => syncResetAll());

  function renderLesson(lesson) {
    const w = lesson.week;
    const idx = allLessons.findIndex((l) => l.id === lesson.id);
    const prev = allLessons[idx - 1];
    const next = allLessons[idx + 1];
    const doneBtn = h("button.btn.ghost", { type: "button" });
    const paintDone = () => { doneBtn.replaceChildren(...(doneSet().has(lesson.id) ? [icon("check", 14), "Done"] : ["Mark as done"])); };
    doneBtn.addEventListener("click", () => { toggleDone(lesson.id); paintDone(); renderRail(lesson.id); });
    paintDone();

    const body = h("div.lesson-body");
    const head = h("header.lesson-head",
      h("div.crumbs", h("span.chip.solid", w.label || `Week ${w.n}`), h("span.chip", w.short), lesson.w && h("span.chip", WEIGHT[lesson.w]), lesson.time && h("span.chip", lesson.time)),
      h("h1", lesson.title),
      h("p", lesson.hook));

    if (isBuilt(lesson.id)) {
      Book.lessons[lesson.id].mount(body);
    } else {
      const byId = (id) => allLessons.find((l) => l.id === id);
      body.append(h("div.planned-card",
        h("span.label", "Planned · " + (w.label || "week " + w.n)),
        h("h2", { style: { fontSize: "1.3rem" } }, "What you will learn here"),
        h("ul", (lesson.points || []).map((p) => h("li", p))),
        lesson.needs?.length && h("div.pl-row", h("span.label", "Learn first"),
          h("div.pl-chips", lesson.needs.map((id) => byId(id) && h("a.chip", { href: "#" + id }, byId(id).title)))),
        lesson.from?.length && h("div.pl-row", h("span.label", "From your work"), h("ul", lesson.from.map((f) => h("li", f)))),
        lesson.q?.length && h("div.pl-row", h("span.label", "Real interview questions from"), h("div.pl-chips", lesson.q.map((t) => h("span.chip", t.replace(/-/g, " ")))))));
    }
    // Saved answers for this lesson: one button clears them all (each visual also has its own).
    const answerKeys = () => store.keys(`answers:${lesson.id}:`);
    const resetAll = h("button.btn.ghost", { type: "button", hidden: answerKeys().length === 0 }, icon("undo", 14), "Reset answers in this lesson");
    resetAll.addEventListener("click", () => {
      answerKeys().forEach((k) => store.remove(k));
      renderLesson(lesson);
      (Book.afterRender || []).forEach((fn) => fn());
    });
    main.replaceChildren(h("div.col", head, body,
      h("footer.lesson-foot",
        prev ? h("a.btn.ghost", { href: "#" + prev.id }, "← " + prev.title) : h("span"),
        h("div.foot-mid", isBuilt(lesson.id) ? doneBtn : null, isBuilt(lesson.id) ? resetAll : null),
        next ? h("a.btn", { href: "#" + next.id }, next.title + " →") : h("span"))));
    syncResetAll = () => { resetAll.hidden = answerKeys().length === 0; };
  }

  function route() {
    const id = location.hash.replace(/^#/, "");
    const lesson = allLessons.find((l) => l.id === id);
    renderRail(lesson ? lesson.id : null);
    rail.classList.remove("open");
    if (lesson) {
      renderLesson(lesson);
      window.scrollTo(0, 0);
    } else {
      renderHome();
      if (id && id !== "home") document.getElementById(id)?.scrollIntoView();
      else window.scrollTo(0, 0);
    }
    (Book.afterRender || []).forEach((fn) => fn());
    animate(main.firstElementChild, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 520 });
  }

  menuBtn.addEventListener("click", (e) => { e.stopPropagation(); rail.classList.toggle("open"); });
  document.addEventListener("click", (e) => { if (!rail.contains(e.target)) rail.classList.remove("open"); });
  window.addEventListener("hashchange", route);
  route();
})();
