/* bsearch(): binary search you step through, one check per press.
   Correctness rule: the real algorithm runs ONCE (trace) and everything on screen — highlights, the
   three reasoning lines, the counters and the summary — is drawn from that trace. Nothing is hand-written. */
(function () {
  const B = window.Book;
  const { h, icon } = B;

  /* One comparison used for sorting AND searching, so the two can never disagree. */
  B.cmpText = (a, b) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  };

  /* The real algorithm. Each check: the range still possible (lo..hi), the middle, and the result. */
  B.bsTrace = (labels, target) => {
    const checks = [];
    let lo = 0;
    let hi = labels.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const cmp = B.cmpText(target, labels[mid]);
      const next = cmp === 0 ? null : cmp < 0 ? [lo, mid - 1] : [mid + 1, hi];
      checks.push({ lo, hi, mid, cmp, next });
      if (cmp === 0) break;
      [lo, hi] = next;
    }
    return checks;
  };

  /* Why A is before/after B, in words: the first letter that differs decides. */
  B.letterReason = (target, other) => {
    let i = 0;
    while (i < target.length && i < other.length && target[i].toLowerCase() === other[i].toLowerCase()) i++;
    if (i >= target.length || i >= other.length) return `“${target}” is shorter, so it comes first.`;
    const later = target[i].toLowerCase() > other[i].toLowerCase();
    const same = i > 0 ? `Both start with “${target.slice(0, i)}”. Then ` : "";
    return `${same}“${target[i]}” comes ${later ? "after" : "before"} “${other[i]}” in the alphabet.`;
  };

  const span = (a, b) => (a === b ? `entry ${a + 1}` : `entries ${a + 1}–${b + 1}`);
  const count = (a, b) => b - a + 1;

  /* items: already sorted with cmpText. label(item) is the text compared; side(item) is shown on the right. */
  B.bsearch = ({ items, target, label, side, title }) => {
    const labels = items.map(label);
    const checks = B.bsTrace(labels, target);
    const rows = items.map((it, i) => h("div.bs-row",
      h("span.bs-pos.tab", String(i + 1)),
      h("span.bs-label", labels[i]),
      h("span.bs-tag"),
      h("span.bs-side.tab", side(it))));
    const bar = h("div.bs-range", h("span.bs-range-label"));
    const listBox = h("div.bs-listbox", bar, h("div.bs-list", rows));
    const head = h("div.bs-head", h("b"), h("span", `Looking for “${target}”`));
    const lines = ["Middle", "Compare", "Keep"].map((name, k) => h("li.bs-line", h("span.bs-num", String(k + 1)), h("div", h("span.bs-name", name), h("p"))));
    const checksOut = h("b.tab", "0");
    const leftOut = h("b.tab", String(items.length));
    const counts = h("div.bs-counts", h("div", h("span", "Checks"), checksOut), h("div", h("span", "Still possible"), leftOut));
    const explain = h("div.bs-explain", head, h("ol.bs-lines", lines), counts);
    const el = h("div.bs", h("div.bs-col", h("div.bs-title", icon("layers", 13), title), listBox), explain);

    let k = 0;
    let extra = 0;
    const setLine = (n, text) => {
      lines[n].classList.toggle("on", Boolean(text));
      lines[n].querySelector("p").textContent = text || "";
    };
    const setHead = (text) => { head.firstChild.textContent = text; };
    const tag = (i, text, cls) => {
      rows[i].querySelector(".bs-tag").textContent = text || "";
      if (cls) rows[i].classList.add(cls);
    };
    let range = [0, items.length - 1];
    /* The bar on the left marks the entries that are still possible. */
    function placeBar(lo, hi) {
      range = [lo, hi];
      const top = rows[lo].offsetTop;
      const bottom = rows[hi].offsetTop + rows[hi].offsetHeight;
      bar.style.transform = `translateY(${top}px)`;
      bar.style.height = `${bottom - top}px`;
      bar.firstChild.textContent = `${count(lo, hi)} possible`;
      bar.classList.toggle("thin", bottom - top < 40);
    }
    new ResizeObserver(() => placeBar(range[0], range[1])).observe(listBox);

    function reset() {
      k = 0;
      extra = 0;
      rows.forEach((r) => { r.classList.remove("out", "mid", "hit", "peek", "pre"); r.querySelector(".bs-tag").textContent = ""; });
      setHead("Ready");
      [0, 1, 2].forEach((n) => setLine(n, ""));
      setLine(0, `All ${items.length} entries are possible. Press the button to check the middle one.`);
      lines[0].classList.remove("on");
      checksOut.textContent = "0";
      leftOut.textContent = String(items.length);
      requestAnimationFrame(() => placeBar(0, items.length - 1));
    }

    function middleText(c) {
      const n = count(c.lo, c.hi);
      const where = `${n === items.length ? "All" : "Still possible:"} ${span(c.lo, c.hi)} (${n} ${n === 1 ? "entry" : "entries"}).`;
      if (n === 1) return `${where} Only one is left, so check it: “${labels[c.mid]}”.`;
      if (n % 2 === 0) return `${where} Two are in the middle, ${c.mid + 1} and ${c.mid + 2}. Take the first: entry ${c.mid + 1}, “${labels[c.mid]}”.`;
      return `${where} The middle one is entry ${c.mid + 1}: “${labels[c.mid]}”.`;
    }
    function compareText(c) {
      if (c.cmp === 0) return `“${target}” and “${labels[c.mid]}” are the same. Found it!`;
      return B.letterReason(target, labels[c.mid]);
    }
    function keepText(c) {
      if (c.cmp === 0) return `It's entry ${c.mid + 1}, and it says ${side(items[c.mid])}.`;
      const [a, b] = c.next;
      const gone = c.cmp > 0 ? [c.lo, c.mid] : [c.mid, c.hi];
      return `So “${target}” must be ${c.cmp > 0 ? "after" : "before"} “${labels[c.mid]}”. Cross out ${span(gone[0], gone[1])}. Left: ${span(a, b)} (${count(a, b)}).`;
    }

    /* Play the next check, one reasoning line at a time. Returns { found } once the target is hit. */
    async function next(ctx) {
      const c = checks[k];
      if (!c) return { found: true };
      rows.forEach((r) => r.classList.remove("mid"));
      [0, 1, 2].forEach((n) => setLine(n, ""));
      setHead(`Check ${k + 1}`);
      checksOut.textContent = String(k + 1 + extra);
      placeBar(c.lo, c.hi);
      setLine(0, middleText(c));
      tag(c.mid, "middle", "mid");
      ctx.animate(rows[c.mid], [{ transform: "scale(0.97)" }, { transform: "scale(1.02)", offset: 0.6 }, { transform: "none" }], { duration: 420 });
      await ctx.wait(1100);
      if (!ctx.alive()) return {};
      setLine(1, compareText(c));
      await ctx.wait(1100);
      if (!ctx.alive()) return {};
      setLine(2, keepText(c));
      if (c.cmp === 0) {
        rows[c.mid].classList.remove("mid");
        tag(c.mid, "found", "hit");
        leftOut.textContent = "1";
        placeBar(c.mid, c.mid);
        k++;
        return { found: true, row: rows[c.mid], item: items[c.mid] };
      }
      await ctx.wait(500);
      if (!ctx.alive()) return {};
      const gone = c.cmp > 0 ? [c.lo, c.mid] : [c.mid, c.hi];
      for (let i = gone[0]; i <= gone[1]; i++) {
        rows[i].classList.remove("mid");
        rows[i].querySelector(".bs-tag").textContent = "";
        rows[i].classList.add("out");
      }
      placeBar(c.next[0], c.next[1]);
      leftOut.textContent = String(count(c.next[0], c.next[1]));
      k++;
      return { found: false };
    }

    /* Jump straight to the end state (used by a later step's enter()). */
    function finish() {
      reset();
      for (const c of checks) {
        if (c.cmp === 0) { tag(c.mid, "found", "hit"); placeBar(c.mid, c.mid); break; }
        const gone = c.cmp > 0 ? [c.lo, c.mid] : [c.mid, c.hi];
        for (let i = gone[0]; i <= gone[1]; i++) rows[i].classList.add("out");
      }
      k = checks.length;
      setHead("Done");
      setLine(0, `${checks.length} checks: ${summary()}.`);
      checksOut.textContent = String(checks.length);
      leftOut.textContent = "1";
    }

    /* Show a custom check (e.g. "look at the next entry") with the same three lines. */
    async function custom(ctx, i, tagText, texts) {
      extra++;
      checksOut.textContent = String(k + extra);
      setHead(`Check ${k + extra}`);
      [0, 1, 2].forEach((n) => setLine(n, ""));
      tag(i, tagText, "peek");
      for (let n = 0; n < texts.length; n++) {
        setLine(n, texts[n]);
        await ctx.wait(1000);
        if (!ctx.alive()) return;
      }
    }

    /* "12 → 6 → 3 → 1 → found": entries still possible before each check, straight from the trace. */
    function summary() {
      return checks.map((c) => String(count(c.lo, c.hi))).join(" → ") + " → found";
    }

    reset();
    return {
      el, rows, checks, next, finish, reset, custom, summary,
      done: () => k >= checks.length,
      hitIndex: () => checks[checks.length - 1].mid,
      setBuilt(on) { rows.forEach((r) => r.classList.toggle("pre", !on)); explain.classList.toggle("away", !on); },
    };
  };
})();
