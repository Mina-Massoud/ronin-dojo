/* bsFilm(): a film that explains binary search, generated from the real trace (Book.bsTrace).
   Every middle, comparison, crossed-out range and count on screen comes from that trace. */
(function () {
  const B = window.Book;
  const { svg: S } = B;
  const ABC = "abcdefghijklmnopqrstuvwxyz";

  const LAYOUT = {
    wide: { list: { x: 44, y: 70, w: 250, rowH: 27 }, pointer: { x: 302 }, target: { x: 360, y: 40 }, cmp: { x: 360, y: 150 }, alpha: { x: 360, y: 238, w: 370 }, verdict: { x: 360, y: 318 }, counts: { x: 360, y: 356 }, summary: { x: 360, y: 150 }, labelSize: 14, bigSize: 30 },
    tall: { list: { x: 34, y: 92, w: 230, rowH: 25 }, pointer: { x: 272 }, target: { x: 34, y: 34 }, cmp: { x: 34, y: 436 }, alpha: { x: 30, y: 526, w: 340 }, verdict: { x: 34, y: 566 }, counts: { x: 34, y: 588 }, summary: { x: 34, y: 430 }, labelSize: 13, bigSize: 24 },
  };

  B.bsFilm = ({ items, label, side, target, title }) => {
    const labels = items.map(label);
    const checks = B.bsTrace(labels, target);
    const n0 = labels.length;
    const count = (a, b) => b - a + 1;

    return B.film({
      title,
      build(svg, F, layoutName) {
        const L = LAYOUT[layoutName];
        const rowY = (i) => L.list.y + i * L.list.rowH;
        const ln = (t, cls) => S("text", { class: cls }, t);

        /* ---------- static header ---------- */
        const head = S("g", { class: "fl-target" });
        head.append(S("text", { x: 0, y: 0, class: "fl-small" }, "Looking for"), S("text", { x: 0, y: L.bigSize + 6, class: "fl-big", "font-size": L.bigSize }, `“${target}”`));
        svg.append(head);
        const headA = F.actor(head, { x: L.target.x, y: L.target.y + 14, o: 0 });

        /* ---------- the sorted list ---------- */
        const listTitle = S("text", { x: L.list.x, y: L.list.y - 14, class: "fl-small" }, "The index, sorted A → Z");
        svg.append(listTitle);
        const titleA = F.actor(listTitle, { o: 0 }, (p, n) => n.setAttribute("opacity", p.o));

        const bar = S("rect", { x: L.list.x - 14, width: 4, rx: 2, class: "fl-ink" });
        svg.append(bar);
        const barA = F.actor(bar, { top: 0, bottom: n0 - 1, o: 0 }, (p, n) => {
          n.setAttribute("y", rowY(p.top) + 2);
          n.setAttribute("height", Math.max(4, (p.bottom - p.top + 1) * L.list.rowH - 4));
          n.setAttribute("opacity", p.o);
        });

        const rows = labels.map((text, i) => {
          const g = S("g");
          const w = L.list.w;
          const hgt = L.list.rowH - 4;
          const bg = S("rect", { width: w, height: hgt, rx: 6, class: "fl-field" });
          const ink = S("rect", { width: w, height: hgt, rx: 6, class: "fl-ink" });
          const ring = S("rect", { x: -1, y: -1, width: w + 2, height: hgt + 2, rx: 7, class: "fl-ring" });
          const pos = S("text", { x: 10, y: hgt / 2 + 4, class: "fl-pos" }, String(i + 1));
          const t1 = S("text", { x: 34, y: hgt / 2 + 5, class: "fl-label", "font-size": L.labelSize }, text);
          const t2 = S("text", { x: 34, y: hgt / 2 + 5, class: "fl-label-inv", "font-size": L.labelSize }, text);
          const sd = S("text", { x: w - 10, y: hgt / 2 + 4, class: "fl-side", "text-anchor": "end" }, side(items[i]));
          const strike = S("line", { x1: 30, x2: w - 10, y1: hgt / 2, y2: hgt / 2, class: "fl-strike" });
          g.append(bg, ink, ring, pos, t1, t2, sd, strike);
          svg.append(g);
          return F.actor(g, { x: L.list.x, y: rowY(i) + 8, o: 0, hl: 0, fill: 0, strike: 0, dim: 0 }, (p, node) => {
            node.setAttribute("transform", `translate(${p.x} ${p.y})`);
            node.setAttribute("opacity", (p.o * (1 - 0.68 * p.dim)).toFixed(3));
            ring.setAttribute("opacity", p.hl);
            ink.setAttribute("opacity", p.fill);
            t2.setAttribute("opacity", p.fill);
            t1.setAttribute("opacity", 1 - p.fill);
            strike.setAttribute("transform", `translate(30 0) scale(${p.strike} 1) translate(-30 0)`);
            strike.setAttribute("opacity", p.strike > 0.01 ? 1 : 0);
          });
        });

        /* ---------- the "middle" pointer ---------- */
        const ptr = S("g");
        ptr.append(S("path", { d: "M0 0 L10 -7 L10 7 Z", class: "fl-ink" }), S("rect", { x: 12, y: -11, width: 62, height: 22, rx: 11, class: "fl-ink" }), S("text", { x: 43, y: 4, class: "fl-pill", "text-anchor": "middle" }, "middle"));
        svg.append(ptr);
        const ptrA = F.actor(ptr, { x: L.pointer.x, y: rowY(0) + L.list.rowH / 2 + 6, o: 0 });

        /* ---------- counters ---------- */
        const counts = S("g");
        const leftN = S("text", { x: 0, y: 30, class: "fl-num" }, String(n0));
        const checkN = S("text", { x: 150, y: 30, class: "fl-num" }, "0");
        counts.append(S("text", { x: 0, y: 0, class: "fl-small" }, "Still possible"), leftN, S("text", { x: 150, y: 0, class: "fl-small" }, "Checks"), checkN);
        svg.append(counts);
        const countsA = F.actor(counts, { x: L.counts.x, y: L.counts.y, o: 0, left: n0, chk: 0 }, (p, node) => {
          node.setAttribute("transform", `translate(${p.x} ${p.y})`);
          node.setAttribute("opacity", p.o);
          leftN.textContent = String(Math.round(p.left));
          checkN.textContent = String(Math.round(p.chk));
        });

        /* ---------- A–Z strip ---------- */
        const step = L.alpha.w / 26;
        const alpha = S("g");
        ABC.split("").forEach((c, i) => alpha.append(S("text", { x: i * step + step / 2, y: 0, class: "fl-abc", "text-anchor": "middle" }, c.toUpperCase())));
        svg.append(alpha);
        const alphaA = F.actor(alpha, { x: L.alpha.x, y: L.alpha.y, o: 0 });

        /* ---------- chapter 1: the list ---------- */
        let T = 0;
        F.chapter(T, "A sorted list");
        F.say(T, `This is the book's index: ${n0} topics, sorted A to Z. We want “${target}”.`);
        F.to(titleA, { o: 1 }, 0.1, 0.4);
        rows.forEach((r, i) => F.to(r, { o: 1, y: rowY(i) }, 0.2 + i * 0.06, 0.5, F.ease.out));
        F.to(headA, { o: 1, y: L.target.y }, 1.0, 0.5, F.ease.out);
        F.say(2.2, `The dark bar on the left marks the entries that could still be “${target}”. Right now, that's all ${n0}.`);
        F.to(barA, { o: 1 }, 2.2, 0.5);
        F.to(countsA, { o: 1 }, 2.4, 0.5);
        T = 5;

        /* ---------- one chapter per check ---------- */
        let prevCmp = null;
        checks.forEach((c, k) => {
          const n = count(c.lo, c.hi);
          const found = c.cmp === 0;
          F.chapter(T, `Check ${k + 1}: “${labels[c.mid]}”`);
          if (prevCmp) F.to(prevCmp, { o: 0 }, T, 0.3);
          F.to(countsA, { chk: k + 1 }, T, 0.3);

          // 1) Find the middle.
          if (n === 1) {
            F.say(T, `Only 1 entry is still possible: entry ${c.mid + 1}. Check it.`);
          } else if (n % 2 === 0) {
            F.say(T, `${n} entries are possible (${c.lo + 1} to ${c.hi + 1}). An even number has two middles: ${c.mid + 1} and ${c.mid + 2}. We always take the first one.`);
            F.to(rows[c.mid], { hl: 1 }, T + 0.4, 0.3);
            F.to(rows[c.mid + 1], { hl: 1 }, T + 0.4, 0.3);
            F.to(rows[c.mid + 1], { hl: 0 }, T + 2.0, 0.3);
          } else {
            F.say(T, `${n} entries are possible (${c.lo + 1} to ${c.hi + 1}). The middle one is entry ${c.mid + 1}.`);
            F.to(rows[c.mid], { hl: 1 }, T + 0.4, 0.3);
          }
          const ptrY = rowY(c.mid) + 8 + (L.list.rowH - 4) / 2;
          F.to(ptrA, { o: 1, y: ptrY }, T + (n % 2 === 0 && n > 1 ? 2.0 : 0.6), 0.6);
          if (n === 1) F.to(rows[c.mid], { hl: 1 }, T + 0.4, 0.3);

          // 2) Compare the deciding letters.
          const t2 = T + 2.8;
          const cmpG = S("g");
          const w1 = target;
          const w2 = labels[c.mid];
          let d = 0;
          while (d < w1.length && d < w2.length && w1[d].toLowerCase() === w2[d].toLowerCase()) d++;
          const word = (w, x) => {
            const tx = S("text", { x, y: 6, class: "fl-word", "font-size": L.bigSize * 0.8 });
            if (found) { tx.append(S("tspan", { class: "fl-strong" }, w)); return tx; }
            tx.append(S("tspan", { class: "fl-mute" }, w.slice(0, d)), S("tspan", { class: "fl-strong fl-key" }, w[d] ?? ""), S("tspan", { class: "fl-mute" }, w.slice(d + 1)));
            return tx;
          };
          const cmpLabel = found ? "Compare the words" : d === 0 ? "Compare the first letters" : `The first ${d} letter${d > 1 ? "s" : ""} match. Compare letter ${d + 1}`;
          cmpG.append(S("text", { x: 0, y: -24, class: "fl-small" }, cmpLabel), word(w1, 0), S("text", { x: 140, y: 4, class: "fl-small", "text-anchor": "middle" }, "vs"), word(w2, 170));
          cmpG.setAttribute("opacity", 0);
          svg.append(cmpG);
          const cmpA = F.actor(cmpG, { x: L.cmp.x + 12, y: L.cmp.y, o: 0 });
          F.to(cmpA, { o: 1, x: L.cmp.x }, t2, 0.5, F.ease.out);
          F.say(t2, found ? `“${w1}” and “${w2}” are the same word. Found it!` : B.letterReason(w1, w2));
          prevCmp = cmpA;

          // Letters on the A–Z strip: where does each one sit?
          const a1 = w1[d] ? ABC.indexOf(w1[d].toLowerCase()) : -1;
          const a2 = w2[d] ? ABC.indexOf(w2[d].toLowerCase()) : -1;
          if (!found && a1 >= 0 && a2 >= 0) {
            F.to(alphaA, { o: 1 }, t2 + 0.6, 0.4);
            const mk = S("g");
            const xT = a1 * step + step / 2;
            const xM = a2 * step + step / 2;
            const later = a1 > a2;
            const arc = S("path", { d: `M ${xM} -18 C ${xM} -42, ${xT} -42, ${xT} -18`, class: "fl-arc" });
            mk.append(
              S("circle", { cx: xM, cy: -4, r: step * 0.55, class: "fl-ring-c" }),
              S("circle", { cx: xT, cy: -4, r: step * 0.55, class: "fl-ink" }),
              S("text", { x: xT, y: 0, class: "fl-abc-inv", "text-anchor": "middle" }, w1[d].toUpperCase()),
              arc,
              S("text", { x: (xT + xM) / 2, y: -42, class: "fl-small", "text-anchor": "middle" }, later ? "after →" : "← before"));
            alpha.after(mk);
            const mkA = F.actor(mk, { x: L.alpha.x, y: L.alpha.y, o: 0 });
            F.to(mkA, { o: 1 }, t2 + 1.0, 0.5);
            const nextAt = T + (found ? 5.5 : 8);
            F.to(mkA, { o: 0 }, nextAt, 0.3);
          }

          // 3) Keep one half, cross out the other.
          const t3 = T + 4.6;
          if (found) {
            F.to(rows[c.mid], { hl: 0, fill: 1 }, t3 - 1.2, 0.5);
            F.to(ptrA, { o: 0 }, t3 - 1.2, 0.4);
            F.to(barA, { top: c.mid, bottom: c.mid }, t3 - 1.2, 0.5);
            F.to(countsA, { left: 1 }, t3 - 1.2, 0.5);
            F.say(t3, `It's entry ${c.mid + 1}, and the index says ${side(items[c.mid])}. Found in ${k + 1} checks.`);
            T += 6.5;
          } else {
            const gone = c.cmp > 0 ? [c.lo, c.mid] : [c.mid, c.hi];
            const [a, b] = c.next;
            F.say(t3, `So “${target}” comes ${c.cmp > 0 ? "after" : "before"} “${w2}”. It can't be in entries ${gone[0] + 1}–${gone[1] + 1}. Cross them out.`);
            for (let i = gone[0]; i <= gone[1]; i++) {
              const at = t3 + 0.5 + (c.cmp > 0 ? i - gone[0] : gone[1] - i) * 0.08;
              F.to(rows[i], { hl: 0, strike: 1 }, at, 0.35);
              F.to(rows[i], { dim: 1 }, at + 0.35, 0.4);
            }
            F.to(ptrA, { o: 0.25 }, t3 + 0.5, 0.3);
            F.to(barA, { top: a, bottom: b }, t3 + 1.4, 0.7);
            F.to(countsA, { left: count(a, b) }, t3 + 1.4, 0.7);
            F.say(t3 + 2.0, `${count(a, b)} ${count(a, b) === 1 ? "entry is" : "entries are"} still possible: ${a === b ? `entry ${a + 1}` : `${a + 1} to ${b + 1}`}.`);
            T += 8;
          }
        });

        /* ---------- final chapter: why it's fast ---------- */
        F.chapter(T, "Why it's fast");
        if (prevCmp) F.to(prevCmp, { o: 0 }, T, 0.3);
        F.to(alphaA, { o: 0 }, T, 0.3);
        F.to(countsA, { o: 0 }, T, 0.3);
        const sizes = checks.map((c) => count(c.lo, c.hi));
        const sum = S("g");
        sum.append(S("text", { x: 0, y: -24, class: "fl-small" }, "Entries still possible before each check"));
        const chipW = 52;
        const chipAs = [];
        sizes.forEach((v, i) => {
          const chip = S("g");
          chip.append(S("rect", { width: chipW - 8, height: 36, rx: 10, class: i === sizes.length - 1 ? "fl-ink" : "fl-field" }),
            S("text", { x: (chipW - 8) / 2, y: 24, class: i === sizes.length - 1 ? "fl-chip-inv" : "fl-chip", "text-anchor": "middle" }, String(v)));
          sum.append(chip);
          chipAs.push(F.actor(chip, { x: i * chipW, y: 0, o: 0 }));
        });
        svg.append(sum);
        const sumA = F.actor(sum, { x: L.summary.x, y: L.summary.y, o: 0 });
        F.to(sumA, { o: 1 }, T + 0.3, 0.4);
        chipAs.forEach((a, i) => F.to(a, { o: 1 }, T + 0.6 + i * 0.45, 0.4, F.ease.out));
        F.say(T + 0.3, `Each check throws away about half of what's left: ${sizes.join(" → ")}.`);
        const scale = S("g");
        const lines = [["1,000 sorted entries", "about 10 checks"], ["1,000,000 sorted entries", "about 20 checks"]];
        lines.forEach(([l, r], i) => scale.append(S("text", { x: 0, y: i * 30, class: "fl-label", "font-size": 14 }, l), S("text", { x: 260, y: i * 30, class: "fl-strong-s", "text-anchor": "end" }, r)));
        svg.append(scale);
        const scaleA = F.actor(scale, { x: L.summary.x, y: L.summary.y + 92, o: 0 });
        F.to(scaleA, { o: 1 }, T + 3.4, 0.6);
        F.say(T + 3.4, "That's why it's fast. Double the entries, and you need just one more check.");
        F.end(T + 7);
      },
    });
  };
})();
