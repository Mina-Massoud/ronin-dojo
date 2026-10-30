/* Database indexing: the guided visuals. Each one teaches ONE idea, small before big (LESSON-SPEC, Teaching direction).
   Times come from one stated model: 0.1 ms to read the next page in order, 0.4 ms to jump to a random page. */
(function () {
  const { h, icon, guided, fmt, ms, animate } = Book;
  const V = (Book.parts = Book.parts || {})["db-indexing"] = {};

  const readout = (label, value = "0") => {
    const v = h("b.tab", value);
    return { el: h("div.readout", h("span.label", label), v), set: (t) => { v.textContent = t; } };
  };
  const pop = (ctx, el) => ctx.animate(el, [{ transform: "scale(0.9)", opacity: 0.4 }, { transform: "scale(1.04)", opacity: 1, offset: 0.6 }, { transform: "none", opacity: 1 }], { duration: 380 });

  /* ---------- 1. A book and its index (the story) ---------- */
  const TOPICS = ["Variables", "Functions", "Arrays", "Objects", "Event loop", "Closures", "Classes", "Modules", "Promise", "Fetch", "Errors", "Testing"];
  const PROMISE = 8;

  V.book = () => guided({
    title: "Finding a topic in a book",
    build(view) {
      const pages = TOPICS.map((t, k) => h("div.bk-page", h("span.bk-num", String(k + 1)), h("span.bk-topic", t)));
      const sorted = TOPICS.map((t, k) => ({ t, k })).sort((a, b) => Book.cmpText(a.t, b.t));
      const bs = Book.bsearch({ items: sorted, target: "Promise", label: (x) => x.t, side: (x) => `page ${x.k + 1}`, title: "The book's index, sorted A → Z" });
      const opened = readout("Pages opened");
      const cmp = h("div.cmp");
      view.append(h("div.bk-pages", pages), bs.el, h("div.g-row", opened.el), cmp);
      return {
        pages, bs, opened, cmp,
        reset({ showIndex = false, showCount = true } = {}) {
          pages.forEach((p) => p.classList.remove("open", "found"));
          bs.reset();
          bs.el.hidden = !showIndex;
          opened.el.classList.toggle("away", !showCount);
          opened.set("0");
          cmp.replaceChildren();
        },
      };
    },
    steps: [
      {
        say: "This book has 12 pages. You want the page about “Promise”. You only see a page's topic when you open it.",
        enter: (s) => s.reset({ showCount: false }),
        show: (s, ctx) => ctx.callout(s.pages[0], "A closed page", "top"),
      },
      {
        say: "First, look for it with no index.",
        enter: (s) => s.reset(),
        guess: { q: "How many pages might you open?", options: ["1 page", "About 3", "Anywhere from 1 to 12"], answer: 2, why: "You don't know where it is, so you open pages in order. Here it was page 9. It could be anywhere from 1 to 12." },
        action: {
          label: "Open pages one by one", icon: "search",
          run: async (s, ctx) => {
            for (let k = 0; k <= PROMISE; k++) {
              if (!ctx.alive()) return;
              s.pages[k].classList.add("open");
              pop(ctx, s.pages[k]);
              s.opened.set(String(k + 1));
              await ctx.wait(330);
            }
            s.pages[PROMISE].classList.add("found");
          },
        },
      },
      {
        say: "Now use the index at the back. It's sorted A to Z, so you don't read it from the top. The trick: check the middle entry, then cross out the half that can't have “Promise”. Press the button once for each check.",
        enter: (s) => s.reset({ showIndex: true }),
        action: {
          label: "Check the middle", icon: "search",
          run: async (s, ctx) => {
            if (s.bs.done()) {
              const row = s.bs.rows[s.bs.hitIndex()];
              await ctx.connect(row, s.pages[PROMISE], 600);
              if (!ctx.alive()) return;
              s.pages[PROMISE].classList.add("open", "found");
              pop(ctx, s.pages[PROMISE]);
              s.opened.set("1");
              return "done";
            }
            const r = await s.bs.next(ctx);
            if (!ctx.alive()) return;
            if (r.found) ctx.setAction(`Open ${r.item ? `page ${r.item.k + 1}` : "the page"}`, "book");
            return "more";
          },
        },
        after: (s) => `${s.bs.checks.length} checks in the index. Entries still possible before each check: ${s.bs.summary()}. Then you opened just 1 page.`,
      },
      {
        say: "Same book, same question. Look at the difference.",
        enter: (s) => {
          s.reset({ showIndex: true });
          s.bs.finish();
          s.pages[PROMISE].classList.add("open", "found");
          s.opened.set("1");
        },
        show: (s, ctx) => compareBars(s.cmp, ctx, [["Page by page", 9, "9 pages"], ["With the index", 1, `1 page (after ${s.bs.checks.length} checks)`]], 12),
      },
    ],
    takeaway: "An index is a sorted list. Because it's sorted, you can check the middle and cross out half each time, so you find things in a few checks.",
    check: {
      q: "You check the middle entry and it's “Fetch”. You want “Promise”. What do you cross out?",
      options: ["Everything after Fetch", "Fetch and everything before it", "Nothing, check the next entry"],
      answer: 1,
      why: ["P comes after F, so Promise can't be before Fetch. The half before Fetch is the one to cross out.", "P comes after F, so Promise can't be Fetch or anything before it.", "Checking one by one is the slow way. The sorted order lets you throw away a whole half at once."],
    },
  });

  /* The binary-search film: the same search as the book, slowed down and explained. */
  V.searchFilm = () => {
    const sorted = TOPICS.map((t, k) => ({ t, k })).sort((a, b) => Book.cmpText(a.t, b.t));
    return Book.bsFilm({ items: sorted, label: (x) => x.t, side: (x) => `page ${x.k + 1}`, target: "Promise", title: "How the sorted index finds “Promise”" });
  };

  /* Shared: horizontal bars that grow in. rows = [[label, value, text]] */
  function compareBars(box, ctx, rows, max) {
    box.replaceChildren(...rows.map(([label, v, text], k) => {
      const fill = h("i");
      ctx.animate(fill, [{ transform: "scaleX(0)" }, { transform: `scaleX(${Math.max(v / max, 0.006)})` }], { duration: 700, delay: k * 250 });
      return h("div.bar-row", h("span.mono", label), h("div.track", fill), h("b", text));
    }));
  }

  /* ---------- 2. A table is stored in pages; no index = read them all ---------- */
  const USERS = [["Omar", "omar@mail.com"], ["Sara", "sara@mail.com"], ["Youssef", "youssef@mail.com"], ["Lina", "lina@mail.com"], ["Karim", "karim@mail.com"], ["Nour", "nour@mail.com"], ["Hana", "hana@mail.com"], ["Mina", "mina@speako.ai"], ["Adam", "adam@mail.com"], ["Mariam", "mariam@mail.com"], ["Ziad", "ziad@mail.com"], ["Laila", "laila@mail.com"]];
  const MINA = 7;
  const PER_PAGE = 3;

  function tableScene(view, { compact = false } = {}) {
    const rows = USERS.map(([name, email], k) => h("div.tb-row" + (k === MINA ? ".is-mina" : ""), compact ? null : h("span.tb-name", name), h("span.tb-email", email)));
    const pageEls = [0, 1, 2, 3].map((p) => h("div.tb-page", h("div.tb-plabel", `Page ${p + 1}`), rows.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE)));
    const head = h("div.tb-head", compact ? null : h("span", "name"), h("span", "email"));
    const table = h("div.tb" + (compact ? ".compact" : ""), head, pageEls);
    return { rows, pageEls, table, head };
  }
  /* Animate rows from one layout to the other (FLIP: transform only). */
  async function flip(ctx, t, paged) {
    const before = t.rows.map((r) => r.getBoundingClientRect());
    t.table.classList.toggle("paged", paged);
    const after = t.rows.map((r) => r.getBoundingClientRect());
    await Promise.all(t.rows.map((r, k) => ctx.animate(r,
      [{ transform: `translate(${before[k].left - after[k].left}px, ${before[k].top - after[k].top}px)` }, { transform: "none" }],
      { duration: 700, delay: k * 25, easing: "cubic-bezier(0.32, 0.72, 0, 1)" })));
  }

  V.table = () => guided({
    title: "How a table really sits on disk",
    build(view) {
      const t = tableScene(view);
      const pages = readout("Pages read");
      const checked = readout("Rows checked");
      view.append(t.table, h("div.g-row", pages.el, checked.el));
      return {
        ...t, pages, checked,
        reset(paged) {
          t.table.classList.toggle("paged", paged);
          t.pageEls.forEach((p) => p.classList.remove("reading", "read"));
          t.rows.forEach((r) => r.classList.remove("check", "found"));
          pages.set("0"); checked.set("0");
          pages.el.classList.toggle("away", !paged);
          checked.el.classList.toggle("away", !paged);
        },
      };
    },
    steps: [
      {
        say: "This is a users table. Each row is one person: a name and an email.",
        enter: (s) => s.reset(false),
        show: (s, ctx) => ctx.callout(s.rows[0], "One row", "top"),
      },
      {
        say: "The database does not store rows in one long list. It puts a few rows in each box. Each box is a page.",
        enter: (s) => s.reset(false),
        action: {
          label: "Show how it's stored", icon: "layers",
          run: async (s, ctx) => {
            await flip(ctx, s, true);
            if (!ctx.alive()) return;
            ctx.callout(s.pageEls[0].firstChild, "1 page = 3 rows here. In Postgres, about 100.", "top");
          },
        },
        after: "You can see every row. The database can't: to see a row, it must read the whole page it's in.",
      },
      {
        say: "Find mina@speako.ai. There is no index. The database doesn't know each email is used only once, so it can't stop at the first match. Watch “Pages read”: that's the cost.",
        enter: (s) => s.reset(true),
        guess: { q: "Which pages will it read?", options: ["Only page 3", "Pages 1 to 3", "All 4 pages"], answer: 2, why: "It found Mina on page 3, but it still read page 4, in case there was a second Mina. Reading every page in order is called a Seq Scan (“sequential” means in order)." },
        action: {
          label: "Find Mina (no index)", icon: "search",
          run: async (s, ctx) => {
            let n = 0;
            for (let p = 0; p < s.pageEls.length; p++) {
              if (!ctx.alive()) return;
              s.pageEls[p].classList.add("reading");
              s.pages.set(String(p + 1));
              for (const r of s.rows.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE)) {
                r.classList.add("check");
                s.checked.set(String(++n));
                if (r.classList.contains("is-mina")) { r.classList.add("found"); pop(ctx, r); }
                await ctx.wait(190);
                r.classList.remove("check");
              }
              s.pageEls[p].classList.replace("reading", "read");
            }
          },
        },
      },
    ],
    takeaway: "Without an index, the database reads every page, even after it finds the row.",
    check: {
      q: "The table grows from 4 pages to 4,000. With no index, how many pages does it read to find Mina?",
      options: ["Still about 3", "About half", "All 4,000"],
      answer: 2,
      why: ["It must check every page, because Mina could be anywhere, and there could be two.", "Even if Mina is early, it keeps reading to be sure there's no second match.", "Every page, every time. That's why big tables need indexes."],
    },
  });

  /* ---------- 3. Add an index on email ---------- */
  V.addIndex = () => guided({
    title: "Giving the table an index",
    build(view) {
      const t = tableScene(view, { compact: true });
      t.table.classList.add("paged");
      const sorted = USERS.map(([, email], k) => ({ email, k })).sort((a, b) => Book.cmpText(a.email, b.email));
      const pageOf = (x) => Math.floor(x.k / PER_PAGE) + 1;
      const bs = Book.bsearch({ items: sorted, target: "mina@speako.ai", label: (x) => x.email, side: (x) => `page ${pageOf(x)}`, title: "Index on email, sorted A → Z" });
      const empty = h("div.ix-empty", "No index yet");
      const pages = readout("Table pages read");
      view.append(t.table, h("div.ix-gap"), empty, bs.el, h("div.g-row", pages.el));
      const scene = {
        ...t, bs, empty, pages, sorted, pageOf, phase: null,
        reset(built) {
          scene.phase = null;
          bs.reset();
          bs.setBuilt(built);
          bs.el.hidden = !built;
          empty.hidden = built;
          t.rows.forEach((r) => r.classList.remove("check", "found"));
          t.pageEls.forEach((p) => p.classList.remove("reading", "read"));
          pages.set("0");
          pages.el.classList.toggle("away", !built);
        },
      };
      return scene;
    },
    steps: [
      {
        say: "An index on email is a sorted list of every email, with the page its row is stored on. Press the button and watch the list fill in.",
        enter: (s) => s.reset(false),
        action: {
          label: "Add an index", icon: "plus",
          run: async (s, ctx) => {
            s.empty.hidden = true;
            s.bs.el.hidden = false;
            s.bs.setBuilt(false);
            for (const [i, item] of s.sorted.entries()) {
              if (!ctx.alive()) return;
              const row = s.rows[item.k];
              row.classList.add("check");
              s.bs.rows[i].classList.remove("pre");
              pop(ctx, s.bs.rows[i]);
              await ctx.wait(170);
              row.classList.remove("check");
            }
            s.bs.setBuilt(true);
            s.pages.el.classList.remove("away");
          },
        },
        after: "Each email was copied into the list, sorted A to Z, with its page number. In SQL, CREATE INDEX ON users (email); means “make an index on the email column of the users table”.",
      },
      {
        say: "Find mina@speako.ai using the index. Same trick as the book: check the middle, cross out half. Press the button once for each check.",
        enter: (s) => s.reset(true),
        guess: { q: "How many table pages will it read?", options: ["1 page", "2 pages", "All 4 pages"], answer: 0, why: "The index said “page 3”, so it read only page 3." },
        action: {
          label: "Check the middle", icon: "search", prompt: "Now press the button, one check at a time.",
          run: async (s, ctx) => {
            const hit = s.bs.hitIndex();
            if (s.phase === "open") {
              const item = s.sorted[hit];
              const row = s.rows[item.k];
              await ctx.connect(s.bs.rows[hit], row.parentElement, 600);
              if (!ctx.alive()) return;
              row.parentElement.classList.add("reading");
              row.classList.add("found");
              pop(ctx, row);
              s.pages.set("1");
              s.phase = null;
              return "done";
            }
            if (s.phase === "peek") {
              const nxt = hit + 1;
              await s.bs.custom(ctx, nxt, "next", [
                "In a sorted list, a second “mina@speako.ai” would sit right after the first one.",
                `The next entry is “${s.sorted[nxt].email}”. It's a different email.`,
                "So there is no second Mina. The search can stop.",
              ]);
              if (!ctx.alive()) return;
              s.phase = "open";
              ctx.setAction(`Open page ${s.pageOf(s.sorted[hit])}`, "book");
              return "more";
            }
            const r = await s.bs.next(ctx);
            if (!ctx.alive()) return;
            if (r.found) {
              s.phase = "peek";
              ctx.setAction("Check the next entry", "search");
            }
            return "more";
          },
        },
      },
      {
        say: (s) => `Entries still possible before each check: ${s.bs.summary()}. Then one extra look for a second Mina, then 1 table page. With only 12 rows the win is small. Next page: a million rows.`,
        enter: (s) => {
          s.reset(true);
          s.bs.finish();
          const item = s.sorted[s.bs.hitIndex()];
          s.rows[item.k].classList.add("found");
          s.rows[item.k].parentElement.classList.add("reading");
          s.pages.set("1");
        },
      },
    ],
    takeaway: "With an index, the database finds the email in a sorted list. Then it reads only that one page.",
    check: {
      q: "What does the index store for each email?",
      options: ["The whole row", "Which page the row is on", "A copy of the table"],
      answer: 1,
      why: ["Only the email and where to find the row. The row itself stays in the table.", "The email, plus a pointer to its page.", "It's a small sorted list, not a copy of the table."],
    },
  });

  /* ---------- 4. Now a million rows ---------- */
  const COLS = 125;
  const GRID = 10_000;
  const HIT = 7342;

  function pageGrid() {
    const canvas = h("canvas.pages", { role: "img", "aria-label": "The users table: 10,000 pages, one square each" });
    const ctx2 = canvas.getContext("2d");
    const state = new Uint8Array(GRID);
    let shown = GRID;
    let cell = 4;
    let dpr = 1;
    function draw() {
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue("--ink").trim();
      const idle = cs.getPropertyValue("--hatch").trim();
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      const gap = cell > 3.5 ? 0.8 : 0.4;
      for (let i = 0; i < shown; i++) {
        const s = state[i];
        ctx2.globalAlpha = s === 1 ? 0.35 : 1;
        ctx2.fillStyle = s === 0 ? idle : ink;
        ctx2.fillRect((i % COLS) * cell, Math.floor(i / COLS) * cell, cell - gap, cell - gap);
      }
      ctx2.globalAlpha = 1;
      if (state[HIT] === 2) {
        ctx2.strokeStyle = ink;
        ctx2.lineWidth = 2;
        ctx2.strokeRect((HIT % COLS) * cell - 4, Math.floor(HIT / COLS) * cell - 4, cell + 7, cell + 7);
      }
    }
    function layout() {
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : 600;
      cell = w / COLS;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(cell * (GRID / COLS) * dpr);
      canvas.style.height = cell * (GRID / COLS) + "px";
      draw();
    }
    const wrap = h("div.grid-host", canvas);
    const markFirst = h("span.px-mark");
    const markHit = h("span.px-mark");
    wrap.append(markFirst, markHit);
    const placeMarks = () => {
      Object.assign(markFirst.style, { left: "-3px", top: "-3px", width: cell + 6 + "px", height: cell + 6 + "px" });
      Object.assign(markHit.style, { left: (HIT % COLS) * cell + "px", top: Math.floor(HIT / COLS) * cell + "px", width: cell + "px", height: cell + "px" });
    };
    new ResizeObserver(() => { layout(); placeMarks(); }).observe(wrap);
    window.addEventListener("dojo:theme", () => requestAnimationFrame(draw));
    return { wrap, state, draw, markFirst, markHit, setShown: (n) => { shown = n; draw(); } };
  }

  V.million = () => guided({
    title: "The same search on a real-size table",
    build(view) {
      const grid = pageGrid();
      const levels = ["root", "branch", "leaf"].map((name) => h("div.ld-step", h("span.ld-dot"), name));
      const target = h("div.ld-step.table", h("span.ld-dot"), "table page");
      const ladder = h("div.ladder-v", h("span.label", "The index"), levels, target);
      const pages = readout("Pages read");
      const time = readout("Time (estimate)", "0 ms");
      const cmp = h("div.cmp");
      const model = h("p.model.muted", "Estimate: about 0.1 ms per page. Real numbers are different, but the gap is just as big.");
      view.append(h("div.mil-wrap", grid.wrap, ladder), h("div.g-row", pages.el, time.el), cmp, model);
      return {
        grid, levels, target, ladder, pages, time, cmp, model,
        reset({ shown = true, ladderOn = false, nums = true } = {}) {
          grid.state.fill(0);
          grid.markFirst.classList.remove("ring");
          grid.setShown(shown ? GRID : 0);
          [...levels, target].forEach((l) => l.classList.remove("hot"));
          ladder.classList.toggle("away", !ladderOn);
          pages.set("0"); time.set("0 ms");
          pages.el.classList.toggle("away", !nums);
          time.el.classList.toggle("away", !nums);
          cmp.replaceChildren();
          model.classList.toggle("away", !nums);
        },
      };
    },
    steps: [
      {
        say: "Real tables are big. Let's zoom out from 12 rows to 1,000,000 users.",
        enter: (s) => s.reset({ shown: false, nums: false }),
        action: {
          label: "Zoom out to 1 million rows", icon: "zoomOut",
          run: async (s, ctx) => {
            await ctx.tween({ from: 0, to: GRID, ms: 1100, onUpdate: (v) => ctx.alive() && s.grid.setShown(Math.floor(v)) });
            if (!ctx.alive()) return;
            s.grid.setShown(GRID);
            s.grid.markFirst.classList.add("ring");
            ctx.callout(s.grid.markFirst, "Each tiny square is 1 page (100 rows)", "top");
          },
        },
        after: "That's 10,000 pages: far too many to read on every search.",
      },
      {
        say: "Search for Mina with no index.",
        enter: (s) => s.reset(),
        guess: { q: "Reading one page takes about 0.1 ms. There are 10,000 pages. About how long?", options: ["About 2 ms", "About 100 ms", "About 1 second"], answer: 2, why: "10,000 pages × 0.1 ms = 1,000 ms, which is 1 second. And that's on every search." },
        action: {
          label: "Search with no index", icon: "search",
          run: async (s, ctx) => {
            let last = 0;
            await ctx.tween({
              from: 0, to: GRID, ms: 1000, ease: (x) => x,
              onUpdate: (v) => {
                if (!ctx.alive()) return;
                const k = Math.floor(v);
                for (let i = last; i < k; i++) s.grid.state[i] = i === HIT ? 2 : 1;
                last = k;
                s.grid.draw();
                s.pages.set(fmt(k));
                s.time.set(ms(k * 0.1));
              },
            });
            if (!ctx.alive()) return;
            for (let i = last; i < GRID; i++) s.grid.state[i] = i === HIT ? 2 : 1;
            s.grid.draw();
            s.pages.set(fmt(GRID));
            s.time.set(ms(GRID * 0.1));
          },
        },
      },
      {
        say: "Now with an index. A big index has 3 small levels: root, branch and leaf. Each level is a sorted list that points to the next one. Then 1 table page.",
        enter: (s) => s.reset({ ladderOn: true }),
        guess: { q: "With the index, it reads 4 pages. About how long?", options: ["About 0.4 ms", "About 100 ms", "About half a second"], answer: 0, why: "4 pages × 0.1 ms = 0.4 ms. 4 pages instead of 10,000." },
        action: {
          label: "Search with the index", icon: "search",
          run: async (s, ctx) => {
            const steps = [...s.levels, s.target];
            for (let k = 0; k < steps.length; k++) {
              if (!ctx.alive()) return;
              steps[k].classList.add("hot");
              pop(ctx, steps[k]);
              s.pages.set(String(k + 1));
              s.time.set(ms((k + 1) * 0.1));
              await ctx.wait(560);
            }
            if (!ctx.alive()) return;
            await ctx.connect(s.target, s.grid.markHit, 600);
            s.grid.state[HIT] = 2;
            s.grid.draw();
          },
        },
      },
      {
        say: "Same question, same table. Your users wait 1 second, or almost nothing.",
        enter: (s) => {
          s.reset({ ladderOn: true });
          s.grid.state[HIT] = 2; s.grid.draw();
          s.pages.el.classList.add("away"); s.time.el.classList.add("away");
        },
        show: (s, ctx) => compareBars(s.cmp, ctx, [["No index", 1000, "1,000 ms"], ["With index", 0.4, "0.4 ms"]], 1000),
      },
    ],
    takeaway: "On a big table, an index turns thousands of page reads into about four.",
    check: {
      q: "Why is the index search so much faster?",
      options: ["The computer works harder", "It reads 4 pages instead of 10,000", "The data gets smaller"],
      answer: 1,
      why: ["It isn't working harder. It does far less work.", "Reading less is the whole trick.", "The table is the same size. It just reads much less of it."],
    },
  });

  /* ---------- 5. Why the index stays short ---------- */
  const LEVELS = [
    { name: "root", pages: 1, reach: 300 },
    { name: "branch", pages: 300, reach: 90_000 },
    { name: "leaf", pages: 90_000, reach: 27_000_000 },
    { name: "4th level", pages: 27_000_000, reach: 8_100_000_000 },
  ];
  V.levels = () => guided({
    title: "Why the index needs so few steps",
    build(view) {
      const rows = LEVELS.map((L) => h("div.lv-row",
        h("span.lv-name", L.name),
        h("div.lv-boxes", Array.from({ length: Math.min(L.pages, 14) }, (_, k) => h("i" + (k === 0 ? ".read" : "")))),
        h("span.lv-count.tab", L.pages === 1 ? "1 page" : `${fmt(L.pages)} pages`, h("small", "reads 1"))));
      const reach = readout("Rows the index can find", "300");
      const need = readout("Rows in your table", "1,000,000");
      view.append(h("div.lv", rows), h("div.g-row", reach.el, need.el));
      return {
        rows, reach, need,
        show(n) { rows.forEach((r, k) => r.classList.toggle("away", k >= n)); reach.set(fmt(LEVELS[n - 1].reach)); },
      };
    },
    steps: [
      {
        say: "On page 04 you saw one sorted list. A real index splits that list into pages too. One index page holds roughly 300 entries (it depends on how big each key is).",
        enter: (s) => { s.show(1); s.need.el.classList.add("away"); },
        show: (s, ctx) => ctx.callout(s.rows[0].querySelector("i"), "1 index page ≈ 300 entries (roughly)", "top"),
      },
      {
        say: "Each of those roughly 300 entries can point to another index page. Add a level, and watch “Rows the index can find”.",
        enter: (s) => { s.show(1); s.need.el.classList.add("away"); },
        action: {
          label: "Add a level", icon: "plus",
          run: async (s, ctx) => {
            s.rows[1].classList.remove("away");
            s.rows[1].querySelectorAll("i").forEach((b, k) => ctx.animate(b, [{ transform: "scale(0)" }, { transform: "none" }], { duration: 300, delay: k * 30 }));
            await ctx.tween({ from: 300, to: 90_000, ms: 900, onUpdate: (v) => ctx.alive() && s.reach.set(fmt(v)) });
          },
        },
        after: "2 levels: 300 × 300 = 90,000 rows. The search still reads only 1 page on each level (the dark box).",
      },
      {
        say: "Add one more level, then compare the two numbers below.",
        enter: (s) => { s.show(2); s.need.el.classList.add("away"); },
        action: {
          label: "Add another level", icon: "plus",
          run: async (s, ctx) => {
            s.rows[2].classList.remove("away");
            s.rows[2].querySelectorAll("i").forEach((b, k) => ctx.animate(b, [{ transform: "scale(0)" }, { transform: "none" }], { duration: 300, delay: k * 30 }));
            await ctx.tween({ from: 90_000, to: 27_000_000, ms: 900, onUpdate: (v) => ctx.alive() && s.reach.set(fmt(v)) });
            if (ctx.alive()) s.need.el.classList.remove("away");
          },
        },
        after: "3 levels can find 27 million rows. Your table has 1 million, so a search reads 3 index pages + 1 table page = 4 pages. That's the 4 you saw on page 05.",
      },
      {
        say: "Now your table grows 1,000 times: from 1 million to 1 billion rows.",
        enter: (s) => { s.show(3); s.need.set("1,000,000"); },
        guess: { q: "How many more levels does the index need?", options: ["1,000 more levels", "About 10 more levels", "Just 1 more level"], answer: 2, why: "A 4th level can find 300 × 27 million = 8.1 billion rows. So 1 billion rows needs 4 index pages + 1 table page = 5 pages." },
        action: {
          label: "Grow to 1 billion rows", icon: "plus",
          run: async (s, ctx) => {
            await ctx.tween({ from: 1e6, to: 1e9, ms: 800, onUpdate: (v) => ctx.alive() && s.need.set(fmt(v)) });
            if (!ctx.alive()) return;
            s.rows[3].classList.remove("away");
            s.rows[3].querySelectorAll("i").forEach((b, k) => ctx.animate(b, [{ transform: "scale(0)" }, { transform: "none" }], { duration: 300, delay: k * 30 }));
            await ctx.tween({ from: 27_000_000, to: 8_100_000_000, ms: 900, onUpdate: (v) => ctx.alive() && s.reach.set(fmt(v)) });
          },
        },
      },
    ],
    takeaway: "Each new level lets the index find roughly 300 times more rows (it depends on key size). So even billions of rows need only 4 or 5 page reads.",
    check: {
      q: "Why does an index stay fast when a table grows a lot?",
      options: ["Each new level lets it find 300× more rows", "The database reads many pages at once", "It stops checking old rows"],
      answer: 0,
      why: ["Growth adds levels very slowly: ×300, then ×300 again.", "It still reads 1 page per level. It just needs very few levels.", "It never skips rows it needs. It finds them in fewer steps."],
    },
  });

  /* ---------- 6. When the index can't help (a quiz you step through) ---------- */
  const TRAPS = [
    { index: "users (email)", plain: "Find a user by email, ignoring capital letters.", sql: "SELECT * FROM users\nWHERE lower(email) = 'mina@speako.ai';", helps: false,
      why: "The index lists the emails as they were typed. lower(email) makes a new value, so the database must change every row before it can compare.",
      fix: "The fix: make the index on the changed value: CREATE INDEX ON users (lower(email));" },
    { index: "users (email)", plain: "Find all Gmail users.", sql: "SELECT * FROM users\nWHERE email LIKE '%@gmail.com';", helps: false,
      why: "The list is sorted by the first letters. % means “anything here”, so the start is unknown and there's no place to jump to. Book version: find every topic that ends in “-ing”.",
      fix: "Use a GIN index with pg_trgm (see the GIN card on page 08)." },
    { index: "users (email)", plain: "Find emails that start with “mina”.", sql: "SELECT * FROM users\nWHERE email LIKE 'mina%';", helps: true,
      why: "A known start works like a range in the sorted list: everything from “mina” up to “minb”. One catch in Postgres: the index must be built for this, with text_pattern_ops (or the database must use the “C” sort order). Then it can jump.",
      fix: "CREATE INDEX ON users (email text_pattern_ops);" },
    { index: "users (is_active)", plain: "Find all active users. 95% of users are active.", sql: "SELECT * FROM users\nWHERE is_active = true;", helps: false,
      options: ["Yes, it uses the index", "No, it reads the whole table"],
      why: "The index would point to almost every row. Jumping between pages costs more than reading them in order. So the database skips the index on purpose and reads the whole table (a Seq Scan).",
      fix: "Nothing to fix. Reading the whole table is the right choice here." },
  ];
  V.traps = () => guided({
    title: "Will the index help?",
    build(view) {
      const plain = h("p.tr-plain");
      const code = h("div");
      const idx = h("span.chip");
      const cells = Array.from({ length: 40 }, () => h("i"));
      const strip = h("div.strip", cells);
      const fix = h("p.tr-fix");
      const stripBox = h("div.tr-strip", h("span.label", "Table pages read"), strip);
      view.append(h("div.tr", h("div.tr-top", plain, idx), code, stripBox, fix));
      return { plain, code, idx, cells, fix, stripBox };
    },
    steps: [
      {
        say: "First, 2 SQL words. SELECT * FROM users means “get rows from the users table”. WHERE means “keep only rows where this is true”.",
        enter: (s) => {
          s.plain.textContent = "Find the user whose email is mina@speako.ai.";
          s.idx.textContent = "Index: users (email)";
          s.code.replaceChildren(Book.sql("SELECT * FROM users\nWHERE email = 'mina@speako.ai';"));
          s.cells.forEach((c) => c.classList.remove("on", "hit"));
          s.stripBox.classList.add("away");
          s.fix.textContent = "This is the search you already know: an exact match, so the index can jump.";
        },
      },
      ...TRAPS.map((t, k) => ({
        say: `Query ${k + 1} of ${TRAPS.length}. Guess, then watch the pages.`,
        enter: (s) => {
          s.plain.textContent = t.plain;
          s.idx.textContent = "Index: " + t.index;
          s.code.replaceChildren(Book.sql(t.sql));
          s.cells.forEach((c) => c.classList.remove("on", "hit"));
          s.stripBox.classList.remove("away");
          s.fix.textContent = "";
        },
        guess: { q: "Can the index help?", options: t.options || ["Yes, it can jump", "No, it reads every page"], answer: t.helps ? 0 : 1, why: t.why },
        onReveal: async (s, ctx) => {
          if (t.helps) {
            await ctx.wait(150);
            for (const i of [27, 28, 29]) { s.cells[i].classList.add("hit"); pop(ctx, s.cells[i]); }
          } else {
            for (let i = 0; i < s.cells.length; i++) {
              if (!ctx.alive()) return;
              s.cells[i].classList.add("on");
              if (i % 4 === 3) await ctx.wait(18);
            }
          }
          if (t.fix && ctx.alive()) s.fix.textContent = t.fix;
        },
      })),
    ],
    takeaway: "An index helps when the database can use the sorted order: an exact match, or a known start of the text (with the right kind of index). And it must match only a few rows.",
    check: {
      q: "Which one CAN use a normal index on email?",
      options: ["lower(email) = 'a@b.com'", "email LIKE '%@b.com'", "email = 'a@b.com'"],
      answer: 2,
      why: ["lower() makes a new value, so the sorted list doesn't match it.", "A % at the start leaves no place to jump to.", "An exact match is exactly what a sorted list is for."],
    },
  });

  /* ---------- 7. Indexes are not free (a tiny model, labelled as one) ---------- */
  const IDX_COLS = ["email", "name", "country", "plan", "created_at"];
  const COMMON_QUERIES = 5;
  const INDEX_SIZE_PCT = 30;
  /* The model: one INSERT writes the table page + one entry per index. Each index makes one common query fast. */
  const costModel = (n) => ({ places: 1 + n, fast: n, disk: 100 + INDEX_SIZE_PCT * n });

  V.cost = () => guided({
    title: "What every index costs",
    build(view) {
      let n = 0;
      const table = h("div.cost-box", h("b", "users table"), h("small", "the row"));
      const idxs = IDX_COLS.map((c) => h("div.cost-box", h("b", c), h("small", "index")));
      const places = readout("Places written by 1 INSERT");
      const barRow = (label) => {
        const fill = h("i");
        const val = h("b");
        return { fill, val, el: h("div.bar-row", h("span.mono", label), h("div.track", fill), val) };
      };
      const bars = { reads: barRow("Common queries made fast"), writes: barRow("Places written per INSERT"), disk: barRow("Disk size (table alone = 100%)") };
      const barsBox = h("div.cmp.cost-bars", bars.reads.el, bars.writes.el, bars.disk.el);
      const count = h("b", "0");
      const slider = h("input.cost-range", { type: "range", min: "0", max: String(IDX_COLS.length), step: "1", value: "0", "aria-label": "Number of indexes on users" });
      const sliderBox = h("label.cost-slider", h("span", "Indexes on users: ", count), slider);
      const note = h("p.model.muted", `A small model, not a measurement. One INSERT writes the table page plus one entry per index. Each index makes one of ${COMMON_QUERIES} common queries fast, and adds ${INDEX_SIZE_PCT}% of the table's size.`);
      view.append(h("div.cost-grid", table, idxs), h("div.g-row", places.el), sliderBox, barsBox, note);

      const scene = {
        table, idxs, places, slider,
        setN(k) {
          n = k;
          idxs.forEach((b, i) => b.classList.toggle("off", i >= k));
          slider.value = String(k);
          count.textContent = String(k);
        },
        boxes: () => [table, ...idxs.slice(0, n)],
        clearLit() { [table, ...idxs].forEach((b) => b.classList.remove("lit")); places.set("0"); },
        litAll() { scene.boxes().forEach((b) => b.classList.add("lit")); places.set(String(costModel(n).places)); },
        paintBars() {
          const m = costModel(n);
          const set = (r, v, text) => { r.fill.style.transform = `scaleX(${Math.max(v, 0.006)})`; r.val.textContent = text; };
          set(bars.reads, m.fast / COMMON_QUERIES, `${m.fast} of ${COMMON_QUERIES}`);
          set(bars.writes, m.places / (1 + IDX_COLS.length), String(m.places));
          set(bars.disk, m.disk / (100 + INDEX_SIZE_PCT * IDX_COLS.length), `${m.disk}%`);
        },
        /* One INSERT: light the table page, then each index, counting as it goes. */
        async insert(ctx) {
          scene.clearLit();
          let c = 0;
          for (const b of scene.boxes()) {
            if (!ctx.alive()) return;
            b.classList.add("lit");
            pop(ctx, b);
            places.set(String(++c));
            await ctx.wait(280);
          }
        },
        reset({ k = 0, free = false } = {}) {
          scene.setN(k);
          scene.clearLit();
          sliderBox.hidden = !free;
          barsBox.hidden = !free;
          note.hidden = !free;
          if (free) { scene.litAll(); scene.paintBars(); }
        },
      };
      slider.addEventListener("input", () => {
        scene.setN(Number(slider.value));
        scene.clearLit();
        scene.litAll();
        scene.paintBars();
      });
      return scene;
    },
    steps: [
      {
        say: "This users table has no index. A new user means one write: the row goes into a table page.",
        enter: (s) => s.reset({ k: 0 }),
        action: { label: "Insert one user", icon: "plus", run: (s, ctx) => s.insert(ctx) },
        after: "1 place written: only the table page.",
      },
      {
        say: "Now add an index on email, and insert one more user.",
        enter: (s) => s.reset({ k: 1 }),
        show: (s, ctx) => ctx.callout(s.idxs[0], "New: an index on email", "top"),
        action: { label: "Insert one user", icon: "plus", run: (s, ctx) => s.insert(ctx) },
        after: "2 places: the table page, and one entry in the email index. The index is sorted, so the new email must go in the right spot.",
      },
      {
        say: "Now imagine one index on each of the 5 columns.",
        enter: (s) => s.reset({ k: 1 }),
        guess: { q: "With 5 indexes, how many places does one INSERT write?", options: ["5 places", "6 places", "10 places"], answer: 1, why: "1 table page + 5 index entries = 6 places. The table page is always one more." },
        action: {
          label: "Add 4 indexes and insert", icon: "plus",
          run: async (s, ctx) => {
            for (let k = 2; k <= IDX_COLS.length; k++) {
              if (!ctx.alive()) return;
              s.setN(k);
              pop(ctx, s.idxs[k - 1]);
              await ctx.wait(220);
            }
            await s.insert(ctx);
          },
        },
        after: "Every index is one more job for every INSERT. An UPDATE that changes no indexed column can often skip the index writes in Postgres (a “HOT update”).",
      },
      {
        say: "Your turn. Move the slider. Lit boxes are the places one INSERT must write.",
        enter: (s) => s.reset({ k: 2, free: true }),
      },
    ],
    takeaway: "Every index makes some reads faster, but every write must also update it, and it uses disk space.",
    check: {
      q: "A table gets 10,000 new rows a second and very few searches. What is the best choice?",
      options: ["Add more indexes so inserts get faster", "Keep only the indexes your slow queries need", "Index every column, just in case"],
      answer: 1,
      why: ["Indexes never make inserts faster. Each one adds work to every insert.", "Right: each index must earn its place with a slow query you measured.", "That makes every insert write to many places, and uses a lot of disk."],
    },
  });
})();
