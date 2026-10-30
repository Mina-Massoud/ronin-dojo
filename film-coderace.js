/* searchRace(): a film of two programs racing on the same sorted list, one check per tick.
   Both sides are generated from really running the two searches (no hand-written steps):
   left = check every item, right = sorted (binary) search. */
(function () {
  const B = window.Book;
  const { svg: S } = B;

  const LEFT_CODE = `let checks = 0;
for (let i = 0; i < list.length; i++) {
  checks++;
  if (list[i] === target) found = i;
}`;
  const RIGHT_CODE = `let lo = 0, hi = list.length - 1;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  checks++;
  if (list[mid] === target) return mid;
  if (list[mid] < target) lo = mid + 1;
  else hi = mid - 1;
}`;

  /* Run both searches for real and record what each check did. */
  function traceLinear(list, target) {
    return list.map((v, i) => ({ i, value: v, match: v === target }));
  }
  function traceBinary(list, target) {
    const out = [];
    let lo = 0;
    let hi = list.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const v = list[mid];
      const step = { lo, hi, mid, value: v, found: v === target };
      if (v < target) lo = mid + 1;
      else if (v > target) hi = mid - 1;
      step.next = [lo, hi];
      out.push(step);
      if (step.found) break;
    }
    return out;
  }

  const LAYOUT = {
    wide: { cols: [{ x: 20, y: 20 }, { x: 395, y: 20 }], w: 345, codeY: 52, lineH: 19, stripY: 250, varsY: 316, statusY: 344, score: { x: 20, y: 400 } },
    tall: { cols: [{ x: 20, y: 18 }, { x: 20, y: 420 }], w: 360, codeY: 52, lineH: 19, stripY: 250, varsY: 316, statusY: 344, score: { x: 20, y: 820 } },
  };

  B.searchRace = ({ list, target, title }) => {
    const lin = traceLinear(list, target);
    const bin = traceBinary(list, target);
    const n = list.length;

    return B.film({
      title,
      wide: [760, 470],
      tall: [400, 900],
      build(svg, F, layoutName) {
        const L = LAYOUT[layoutName];
        const U = 0.9; // seconds per check, the same for both sides
        const T0 = 4;

        function column(c, name, code) {
          const g = S("g");
          const lines = code.split("\n");
          g.append(S("text", { x: 0, y: 0, class: "fl-col-title" }, name));
          const counter = S("text", { x: L.w, y: 2, class: "fl-num", "text-anchor": "end" }, "0");
          g.append(counter, S("text", { x: L.w - 46, y: -2, class: "fl-small", "text-anchor": "end" }, "checks"));
          const panelH = lines.length * L.lineH + 20;
          g.append(S("rect", { x: 0, y: L.codeY - 16, width: L.w, height: panelH, rx: 10, class: "fl-code-bg" }));
          const lineBar = S("rect", { x: 4, width: L.w - 8, height: L.lineH, rx: 5, class: "fl-line-bar" });
          g.append(lineBar);
          lines.forEach((text, i) => {
            const tx = S("text", { x: 14, y: L.codeY + i * L.lineH + 4, class: "fl-code", "xml:space": "preserve" });
            for (const t of B.tokens(text)) tx.append(S("tspan", { class: t.type === "plain" || t.type === "space" ? "syn-plain" : `syn-${t.type}` }, t.text));
            g.append(tx);
          });
          // the list
          const cw = L.w / n;
          const cells = list.map((v, i) => {
            const cg = S("g");
            const bg = S("rect", { x: i * cw + 1, y: L.stripY, width: cw - 2, height: 30, rx: 5, class: "fl-field" });
            const ink = S("rect", { x: i * cw + 1, y: L.stripY, width: cw - 2, height: 30, rx: 5, class: "fl-ink" });
            const ring = S("rect", { x: i * cw, y: L.stripY - 1, width: cw, height: 32, rx: 6, class: "fl-ring" });
            const t1 = S("text", { x: i * cw + cw / 2, y: L.stripY + 19, class: "fl-cell", "text-anchor": "middle" }, String(v));
            const t2 = S("text", { x: i * cw + cw / 2, y: L.stripY + 19, class: "fl-cell-inv", "text-anchor": "middle" }, String(v));
            cg.append(bg, ink, ring, t1, t2);
            g.append(cg);
            return F.actor(cg, { dim: 0, fill: 0, ring: 0 }, (p) => {
              cg.setAttribute("opacity", (1 - 0.7 * p.dim).toFixed(3));
              ink.setAttribute("opacity", p.fill);
              t2.setAttribute("opacity", p.fill);
              t1.setAttribute("opacity", 1 - p.fill);
              ring.setAttribute("opacity", p.ring);
            });
          });
          g.append(S("text", { x: 0, y: L.stripY - 18, class: "fl-small" }, `Sorted list of ${n} numbers · looking for ${target}`));
          const ptr = S("path", { d: "M0 0 L-6 -9 L6 -9 Z", class: "fl-ink" });
          g.append(ptr);
          const ptrA = F.actor(ptr, { i: 0, o: 0 }, (p) => {
            ptr.setAttribute("transform", `translate(${p.i * cw + cw / 2} ${L.stripY - 2})`);
            ptr.setAttribute("opacity", p.o);
          });
          const range = S("rect", { y: L.stripY + 36, height: 4, rx: 2, class: "fl-ink" });
          g.append(range);
          const rangeA = F.actor(range, { lo: 0, hi: n - 1, o: 0 }, (p) => {
            range.setAttribute("x", p.lo * cw + 2);
            range.setAttribute("width", Math.max(4, (p.hi - p.lo + 1) * cw - 4));
            range.setAttribute("opacity", p.o);
          });
          const vars = S("text", { x: 0, y: L.varsY, class: "fl-vars", "xml:space": "preserve" });
          const status = S("text", { x: 0, y: L.statusY, class: "fl-status" });
          g.append(vars, status);
          svg.append(g);
          const colA = F.actor(g, { x: c.x, y: c.y + 10, o: 0 });
          const counterA = F.actor(counter, { n: 0 }, (p) => { counter.textContent = String(Math.round(p.n)); });
          const barA = F.actor(lineBar, { line: 0, o: 0 }, (p) => {
            lineBar.setAttribute("y", L.codeY + p.line * L.lineH - 14);
            lineBar.setAttribute("opacity", p.o);
          });
          return { colA, cells, ptrA, rangeA, counterA, barA, vars, status, varsLine: (at, text) => varsCues.push({ at, el: vars, text }), statusLine: (at, text) => varsCues.push({ at, el: status, text }) };
        }

        // Text that changes at moments (variables, status) is drawn from cues on the same clock.
        const varsCues = [];
        const textA = F.actor(svg, { t: 0 }, (p) => {
          const latest = new Map();
          for (const c of varsCues) if (p.t >= c.at - 1e-6) latest.set(c.el, c.text);
          for (const c of varsCues) c.el.textContent = latest.get(c.el) ?? "";
        });

        const left = column(L.cols[0], "Check every item", LEFT_CODE);
        const right = column(L.cols[1], "Sorted search", RIGHT_CODE);

        // ---------- chapter 1: meet the two programs ----------
        F.chapter(0, "Two programs, one list");
        F.say(0, `Two programs look for ${target} in the same sorted list of ${n} numbers.`);
        F.to(left.colA, { o: 1, y: L.cols[0].y }, 0.2, 0.6, F.ease.out);
        F.to(right.colA, { o: 1, y: L.cols[1].y }, 0.5, 0.6, F.ease.out);
        F.say(1.8, "Left checks every number in order. Right uses the sorted order to skip. The lit line is the line running right now.");
        left.varsLine(0, "i = 0");
        right.varsLine(0, `lo = 0    hi = ${n - 1}`);
        left.statusLine(0, "Ready");
        right.statusLine(0, "Ready");
        F.to(right.rangeA, { o: 1 }, 2.2, 0.4);

        // ---------- chapter 2: the race ----------
        F.chapter(T0, "The race");
        F.say(T0, "Go! Each tick is one check, on both sides at the same time.");
        F.to(left.barA, { o: 1, line: 3 }, T0, 0.2);
        F.to(left.ptrA, { o: 1 }, T0, 0.2);
        F.to(right.barA, { o: 1, line: 2 }, T0, 0.2);
        F.to(right.ptrA, { o: 1 }, T0, 0.2);

        lin.forEach((c, k) => {
          const at = T0 + k * U;
          F.to(left.ptrA, { i: c.i }, at, 0.25);
          F.to(left.counterA, { n: k + 1 }, at, 0.15);
          left.varsLine(at, `i = ${c.i}    list[i] = ${c.value}`);
          F.to(left.cells[c.i], { ring: 1 }, at, 0.15);
          if (c.match) {
            F.to(left.cells[c.i], { ring: 0, fill: 1 }, at + 0.45, 0.3);
            left.statusLine(at + 0.45, `Found ${target}, but it keeps going: there could be another one.`);
          } else {
            F.to(left.cells[c.i], { ring: 0, dim: 1 }, at + 0.55, 0.25);
            if (k === 0 || !lin[k - 1].match) left.statusLine(at, `${c.value} is not ${target}. Next…`);
          }
        });
        const leftDone = T0 + n * U;
        left.statusLine(leftDone, `Done: ${n} checks, every number.`);
        F.to(left.barA, { o: 0 }, leftDone, 0.3);
        F.to(left.ptrA, { o: 0 }, leftDone, 0.3);

        bin.forEach((c, k) => {
          const at = T0 + k * U;
          F.to(right.barA, { line: 2 }, at, 0.15);
          right.varsLine(at, `lo = ${c.lo}    hi = ${c.hi}    mid = ${c.mid}`);
          F.to(right.ptrA, { i: c.mid }, at, 0.3);
          F.to(right.counterA, { n: k + 1 }, at + 0.2, 0.15);
          F.to(right.cells[c.mid], { ring: 1 }, at + 0.2, 0.15);
          F.to(right.barA, { line: 4 }, at + 0.3, 0.15);
          if (c.found) {
            F.to(right.cells[c.mid], { ring: 0, fill: 1 }, at + 0.5, 0.3);
            right.statusLine(at + 0.3, `list[mid] is ${c.value}. Found it! Stop.`);
            F.say(at + 0.3, `Right: the middle is ${c.value}. That's ${target}. Found after ${k + 1} checks, so it stops.`);
            F.to(right.barA, { o: 0 }, at + 0.9, 0.3);
            F.to(right.rangeA, { lo: c.mid, hi: c.mid }, at + 0.5, 0.3);
            right.statusLine(at + 1.2, `Done: ${k + 1} checks. Waiting for the left side…`);
          } else {
            const bigger = target > c.value;
            F.to(right.barA, { line: bigger ? 5 : 6 }, at + 0.55, 0.15);
            right.statusLine(at + 0.3, `${c.value} is ${bigger ? "smaller" : "bigger"} than ${target} → drop the ${bigger ? "left" : "right"} part.`);
            F.say(at + 0.3, `Right: the middle is ${c.value}. ${target} is ${bigger ? "bigger" : "smaller"}, so it throws away everything ${bigger ? "left of" : "right of"} it.`);
            const [lo2, hi2] = c.next;
            for (let i = c.lo; i <= c.hi; i++) if (i < lo2 || i > hi2) F.to(right.cells[i], { ring: 0, dim: 1 }, at + 0.6, 0.25);
            F.to(right.rangeA, { lo: lo2, hi: hi2 }, at + 0.6, 0.3);
          }
        });
        const binDone = T0 + bin.length * U;
        F.say(binDone + 0.4, `Right finished after ${bin.length} checks. Left is still going, one number at a time…`);
        F.say(leftDone, `Left needed all ${n} checks. Even after finding ${target}, it can't stop: there could be another ${target} later.`);

        // ---------- chapter 3: the score ----------
        const T2 = leftDone + 2.5;
        F.chapter(T2, "The score");
        const score = S("g");
        const rows = [["Check every item", n], ["Sorted search", bin.length]];
        const barW = layoutName === "wide" ? 480 : 220;
        const scoreBars = rows.map(([name, v], i) => {
          const y = i * 34;
          score.append(S("text", { x: 0, y: y + 15, class: "fl-label", "font-size": 13 }, name));
          const track = S("rect", { x: 150, y, width: barW, height: 20, rx: 6, class: "fl-field" });
          const fill = S("rect", { x: 150, y, width: 0, height: 20, rx: 6, class: "fl-ink" });
          const num = S("text", { x: 160 + barW, y: y + 15, class: "fl-strong-s" }, `${v} checks`);
          score.append(track, fill, num);
          return F.actor(fill, { w: 0 }, (p) => fill.setAttribute("width", Math.max(0, p.w)));
        });
        svg.append(score);
        const scoreA = F.actor(score, { x: L.score.x, y: L.score.y, o: 0 });
        F.to(scoreA, { o: 1 }, T2, 0.4);
        F.to(scoreBars[0], { w: barW }, T2 + 0.3, 0.8, F.ease.out);
        F.to(scoreBars[1], { w: (barW * bin.length) / n }, T2 + 0.6, 0.8, F.ease.out);
        F.say(T2, `Same list, same answer: ${n} checks against ${bin.length}.`);
        F.say(T2 + 2.6, "With 1,000,000 numbers it's 1,000,000 checks against about 20. That's what an index does for a database.");
        F.to(textA, { t: T2 + 6 }, 0, T2 + 6, F.ease.linear);
        F.end(T2 + 6);
      },
    });
  };
})();
