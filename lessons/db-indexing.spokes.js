/* Database indexing: "The index family" (hub and spoke data).
   Book.dbIndexTypes() returns all 16 index types for Book.hubSpoke. Every picture is a small SVG built in code
   (Book.svg), and every sequence in a picture (sorting, merging, nearest points...) is computed, not typed by hand.
   Must load before db-indexing.js. Classes dbi-* live in db-indexing.css and use theme tokens only. */
(function () {
  const S = (tag, attrs, text) => Book.svg(tag, attrs, text);
  const rect = (x, y, w, h, cls = "dbi-box", rx = 4) => S("rect", { x, y, width: w, height: h, rx, class: cls });
  const text = (x, y, t, cls = "dbi-t", anchor = "middle") => S("text", { x, y, class: cls, "text-anchor": anchor }, String(t));
  const line = (x1, y1, x2, y2, cls = "dbi-line") => S("line", { x1, y1, x2, y2, class: cls });
  const dot = (cx, cy, r, cls) => S("circle", { cx, cy, r, class: cls });
  const pic = (label, kids, height = 150) => {
    const svg = S("svg", { viewBox: `0 0 300 ${height}`, role: "img", "aria-label": label });
    kids.flat().forEach((k) => svg.append(k));
    return svg;
  };
  /* A labelled box. state: "" | "hot" | "dim" */
  const cell = (x, y, w, h, label, state = "") => [
    rect(x, y, w, h, "dbi-box" + (state === "hot" ? " dbi-hot" : state === "dim" ? " dbi-dim" : "")),
    text(x + w / 2, y + h / 2 + 4, label, state === "hot" ? "dbi-t-inv" : "dbi-t" + (state === "dim" ? " dbi-dim" : "")),
  ];
  const nums = (a, b) => a - b;

  /* 1. B-tree: a 3-level tree built from sorted keys, with one search path lit. */
  function btreePic() {
    const keys = Array.from({ length: 12 }, (_, i) => 2 + i * 3);
    const leaves = [];
    for (let i = 0; i < keys.length; i += 3) leaves.push({ keys: keys.slice(i, i + 3), min: keys[i], kids: [] });
    const up = (nodes) => {
      const out = [];
      for (let i = 0; i < nodes.length; i += 2) {
        const kids = nodes.slice(i, i + 2);
        out.push({ keys: kids.slice(1).map((k) => k.min), min: kids[0].min, kids });
      }
      return out;
    };
    const branches = up(leaves);
    const root = up(branches)[0];
    const levels = [[root], branches, leaves];
    const target = 20;
    const path = new Set();
    for (let n = root; n; n = n.kids.length ? n.kids[n.keys.filter((k) => target >= k).length] : null) path.add(n);
    const Y = [10, 56, 102];
    const NH = 24;
    const width = (n) => n.keys.length * 20 + 8;
    leaves.forEach((n, i) => { n.cx = (300 * (i + 0.5)) / leaves.length; });
    [branches, [root]].forEach((lv) => lv.forEach((n) => { n.cx = (n.kids[0].cx + n.kids[n.kids.length - 1].cx) / 2; }));
    const out = [];
    levels.slice(0, 2).forEach((lv, l) => lv.forEach((n) => n.kids.forEach((k) => {
      out.push(line(n.cx, Y[l] + NH, k.cx, Y[l + 1], path.has(n) && path.has(k) ? "dbi-ink-line" : "dbi-line"));
    })));
    levels.forEach((lv, l) => lv.forEach((n) => {
      const x0 = n.cx - width(n) / 2;
      out.push(rect(x0, Y[l], width(n), NH, "dbi-box" + (path.has(n) ? " dbi-sel" : "")));
      n.keys.forEach((k, j) => {
        const kx = x0 + 14 + j * 20;
        const hit = l === 2 && k === target;
        if (hit) out.push(rect(kx - 9, Y[l] + 3, 18, NH - 6, "dbi-hot", 3));
        out.push(text(kx, Y[l] + 16, k, hit ? "dbi-t-inv" : "dbi-t"));
      });
    }));
    out.push(text(150, 142, `Find ${target}: read ${levels.length} pages (root, branch, leaf)`, "fl-pos"));
    return pic("A B-tree with three levels: one root, two branch pages and four leaf pages. A search for 20 follows one path.", out);
  }

  /* 2. Composite: rows sorted by (customer, date); the matching rows sit side by side. */
  function compositePic() {
    const rows = [["Ben", "03"], ["Ana", "02"], ["Cy", "01"], ["Ben", "01"], ["Ana", "04"], ["Cy", "03"], ["Ben", "04"], ["Ana", "01"]]
      .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const hit = (r) => r[0] === "Ben" && r[1] >= "03";
    const out = [text(48, 11, "customer", "fl-pos"), text(114, 11, "date", "fl-pos")];
    rows.forEach((r, i) => out.push(...cell(10, 16 + i * 16, 76, 14, r[0], hit(r) ? "hot" : ""), ...cell(88, 16 + i * 16, 52, 14, r[1], hit(r) ? "hot" : "")));
    [[48, "Sorted by customer,"], [62, "then by date."], [98, "Ben with date 03+"], [112, "sit side by side."]].forEach(([y, t]) => out.push(text(160, y, t, "fl-small", "start")));
    return pic("Rows sorted by customer, then by date. The rows for Ben from date 03 on sit next to each other.", out);
  }

  /* 3. Covering / INCLUDE: the answer is inside the index, so the table is never read. */
  function coveringPic() {
    const data = [[1, 20], [2, 35], [3, 12]];
    const want = 2;
    const out = [text(72, 11, "index on customer_id", "fl-pos")];
    data.forEach(([id, total], i) => out.push(...cell(8, 18 + i * 28, 50, 24, `id ${id}`, id === want ? "hot" : ""), ...cell(60, 18 + i * 28, 78, 24, `total ${total}`, id === want ? "hot" : "")));
    out.push(rect(176, 18, 116, 80, "dbi-box dbi-dim dbi-dashed", 6), text(234, 54, "table", "dbi-t dbi-dim"), text(234, 70, "not read", "dbi-t-m dbi-dim"));
    out.push(text(72, 112, "INCLUDE (total) carries", "fl-pos"), text(72, 126, "the extra column", "fl-pos"));
    out.push(text(234, 126, "WHERE customer_id = 2", "fl-pos"));
    return pic("An index that also holds the total column. A query for customer 2 is answered from the index, and the table is not read.", out);
  }

  /* 4. Partial: only the pending rows are in the index. */
  function partialPic() {
    const status = "dddpdddddpdddpdd".split("");
    const pending = status.map((s, i) => (s === "p" ? i : -1)).filter((i) => i >= 0);
    const out = [text(150, 11, "table rows (dark = status pending)", "fl-pos")];
    status.forEach((s, i) => out.push(rect(6 + i * 18.5, 18, 14, 14, "dbi-box" + (s === "p" ? " dbi-hot" : ""), 3)));
    const iw = pending.length * 20 + 16;
    const ix = (300 - iw) / 2;
    out.push(rect(ix, 78, iw, 44, "dbi-box", 6));
    pending.forEach((rowIndex, j) => {
      out.push(line(13 + rowIndex * 18.5, 32, ix + 15 + j * 20, 86), rect(ix + 8 + j * 20, 86, 14, 14, "dbi-hot", 3));
    });
    out.push(text(150, 115, "partial index", "fl-pos"), text(150, 144, `The index holds ${pending.length} of ${status.length} rows`, "fl-small"));
    return pic("A row of sixteen table rows. Only the three pending rows are copied into a small partial index.", out);
  }

  /* 5. Expression: the index stores lower(email). */
  function expressionPic() {
    const vals = ["Mina@Speako.ai", "SARA@Mail.com", "Lina@Mail.com"];
    const out = [text(70, 11, "email (as typed)", "fl-pos"), text(232, 11, "stored in the index", "fl-pos")];
    vals.forEach((v, i) => {
      const y = 20 + i * 32;
      out.push(...cell(8, y, 108, 24, v), line(116, y + 14, 184, y + 14, "dbi-ink-line"), text(150, y + 9, "lower()", "dbi-t-m"), ...cell(184, y, 108, 24, v.toLowerCase(), "hot"));
    });
    out.push(text(150, 128, "WHERE lower(email) = 'sara@mail.com'", "fl-pos"), text(150, 144, "The query must use the same expression.", "fl-pos"));
    return pic("Three emails are changed to lower case with lower(), and the index stores the lower-case values.", out);
  }

  /* 6. Unique: a second row with the same value is rejected. */
  function uniquePic() {
    const have = ["ana@x", "ben@x", "cy@x"];
    const attempt = "ben@x";
    const dup = new Set(have).has(attempt);
    const iy = 22 + have.indexOf(attempt) * 32 + 12;
    const out = [text(75, 11, "unique index", "fl-pos")];
    have.forEach((k, i) => out.push(...cell(20, 22 + i * 32, 110, 24, k, k === attempt && dup ? "hot" : "")));
    out.push(text(230, iy - 14, `INSERT ${attempt}`, "dbi-t"), line(190, iy, 134, iy, "dbi-ink-line"));
    if (dup) {
      out.push(line(156, iy - 8, 168, iy + 8, "dbi-bad"), line(168, iy - 8, 156, iy + 8, "dbi-bad"),
        text(230, iy + 16, "already exists,", "fl-small"), text(230, iy + 31, "so it is rejected", "fl-small"));
    } else {
      out.push(text(230, iy + 16, "new value: accepted", "fl-small"));
    }
    return pic("A unique index holds three emails. Inserting ben@x again is rejected because it already exists.", out);
  }

  /* 7. Hash: a key goes through a hash function into a bucket. Equality only. */
  function hashPic() {
    const keys = ["ana", "ben", "cy", "dan"];
    const B = 4;
    const hash = (k) => [...k].reduce((a, c) => a + c.charCodeAt(0), 0) % B;
    const buckets = Array.from({ length: B }, () => []);
    keys.forEach((k) => buckets[hash(k)].push(k));
    const out = [text(140, 11, `hash(key) mod ${B}`, "fl-pos")];
    keys.forEach((k, i) => out.push(...cell(10, 18 + i * 28, 60, 22, k), line(70, 29 + i * 28, 206, 29 + hash(k) * 28 + 0, "dbi-line")));
    buckets.forEach((b, i) => out.push(...cell(206, 18 + i * 28, 86, 22, `${i}: ${b.join(", ") || "-"}`, b.length ? "hot" : "dim")));
    out.push(text(150, 142, "Exact match only. No order.", "fl-pos"));
    return pic("Four keys go through a hash function. Each lands in one of four buckets.", out);
  }

  /* 8. GIN: each element (tag) points to the rows that contain it. */
  function ginPic() {
    const rows = [["db", "sql"], ["web", "db"], ["sql", "web"]];
    const map = {};
    rows.forEach((tags, i) => tags.forEach((t) => { (map[t] = map[t] || []).push(i + 1); }));
    const want = "db";
    const out = [text(60, 11, "rows (tags)", "fl-pos"), text(220, 11, "GIN: tag -> rows", "fl-pos")];
    rows.forEach((tags, i) => out.push(...cell(8, 18 + i * 30, 104, 24, `${i + 1}: ${tags.join(", ")}`, tags.includes(want) ? "hot" : "")));
    Object.keys(map).sort().forEach((k, j) => out.push(...cell(150, 18 + j * 30, 142, 24, `${k}  ->  rows ${map[k].join(", ")}`, k === want ? "hot" : "")));
    out.push(text(150, 126, `Tags containing "${want}": rows ${map[want].join(" and ")}`, "fl-pos"));
    return pic("Three rows each hold a list of tags. The GIN index lists each tag with the rows that contain it.", out, 135);
  }

  /* 9. GiST: ranges that overlap a query range (half-open: touching does not count). */
  function gistPic() {
    const ranges = [[1, 4], [3, 6], [7, 9], [5, 8]];
    const q = [5, 7];
    const X = (v) => 15 + v * 30;
    const overlap = (a, b) => a[0] < b[1] && a[1] > b[0];
    const out = [rect(X(q[0]), 16, X(q[1]) - X(q[0]), 90, "dbi-soft", 0), text(X((q[0] + q[1]) / 2), 11, "query", "fl-pos")];
    ranges.forEach((r, i) => out.push(rect(X(r[0]), 24 + i * 20, X(r[1]) - X(r[0]), 12, "dbi-box" + (overlap(r, q) ? " dbi-hot" : " dbi-dim"), 3)));
    out.push(line(15, 114, 285, 114));
    for (let v = 0; v <= 9; v++) out.push(text(X(v), 128, v, "dbi-t-m"));
    out.push(text(150, 146, `&& finds the ranges that overlap [${q[0]}, ${q[1]})`, "fl-pos"));
    return pic("Four ranges on a number line and one query range. Two of them overlap the query. One only touches it, so it does not count.", out);
  }

  /* 10. SP-GiST: space is cut into smaller and smaller parts (computed median cuts). */
  function spgistPic() {
    const pts = [[0.12, 0.2], [0.2, 0.75], [0.33, 0.4], [0.45, 0.85], [0.5, 0.15], [0.62, 0.55], [0.74, 0.25], [0.82, 0.8], [0.9, 0.45]];
    const B = { x: 20, y: 12, w: 140, h: 126 };
    const out = [rect(B.x, B.y, B.w, B.h, "dbi-box", 6)];
    const split = (ps, x0, y0, x1, y1, axis, depth) => {
      if (ps.length < 3 || depth > 3) return;
      const m = [...ps].sort((a, b) => a[axis] - b[axis])[Math.floor(ps.length / 2)][axis];
      const left = ps.filter((p) => p[axis] < m);
      const right = ps.filter((p) => p[axis] >= m);
      if (!left.length || !right.length) return;
      if (axis === 0) {
        const x = B.x + m * B.w;
        out.push(line(x, y0, x, y1));
        split(left, x0, y0, x, y1, 1, depth + 1);
        split(right, x, y0, x1, y1, 1, depth + 1);
      } else {
        const y = B.y + m * B.h;
        out.push(line(x0, y, x1, y));
        split(left, x0, y0, x1, y, 0, depth + 1);
        split(right, x0, y, x1, y1, 0, depth + 1);
      }
    };
    split(pts, B.x, B.y, B.x + B.w, B.y + B.h, 0, 0);
    pts.forEach(([px, py]) => out.push(dot(B.x + px * B.w, B.y + py * B.h, 3.5, "dbi-pt")));
    [[52, "Space is cut"], [68, "into parts,"], [84, "again and again."], [112, "Good for points"], [128, "and prefixes."]].forEach(([y, t]) => out.push(text(178, y, t, "fl-small", "start")));
    return pic("A square with nine points. Lines cut the square into smaller and smaller parts.", out);
  }

  /* 11. BRIN: min and max per range of table pages; ranges that cannot hold the value are skipped. */
  function brinPic() {
    const vals = Array.from({ length: 24 }, (_, i) => i * 4 + ((i * 7) % 5));
    const blocks = [];
    for (let i = 0; i < vals.length; i += 4) {
      const b = vals.slice(i, i + 4);
      blocks.push({ min: Math.min(...b), max: Math.max(...b) });
    }
    const want = vals[13];
    const hit = (b) => b.min <= want && want <= b.max;
    const out = [text(150, 11, `find the value ${want} (each box = a page range)`, "fl-pos")];
    blocks.forEach((b, i) => {
      const x = 8 + i * 48.5;
      const st = hit(b) ? "hot" : "dim";
      out.push(text(x + 22, 34, `range ${i + 1}`, "dbi-t-m"), ...cell(x, 40, 44, 44, "", st),
        text(x + 22, 58, `min ${b.min}`, st === "hot" ? "dbi-t-inv" : "dbi-t dbi-dim"), text(x + 22, 74, `max ${b.max}`, st === "hot" ? "dbi-t-inv" : "dbi-t dbi-dim"));
    });
    out.push(text(150, 108, `Read ${blocks.filter(hit).length} of ${blocks.length} page ranges. Skip the rest.`, "fl-small"));
    return pic("Six page ranges of a table, each labelled with its smallest and largest value. Only one range can hold the value, so the others are skipped.", out, 120);
  }

  /* 12. Clustered (InnoDB) vs heap (Postgres). */
  function clusteredPic() {
    const out = [text(72, 11, "InnoDB (MySQL)", "dbi-t"), text(228, 11, "Postgres", "dbi-t")];
    out.push(...cell(44, 22, 56, 22, "PK tree"), line(60, 44, 38, 68), line(84, 44, 108, 68),
      ...cell(8, 68, 60, 44, "", "hot"), ...cell(78, 68, 60, 44, "", "hot"));
    [[38, "id 1-9"], [108, "id 10-19"]].forEach(([x, t]) => out.push(text(x, 86, t, "dbi-t-inv"), text(x, 102, "rows", "dbi-t-inv")));
    out.push(...cell(198, 22, 60, 22, "index"));
    [["row 7", 160], ["row 2", 206], ["row 9", 252]].forEach(([t, x]) => out.push(line(228, 44, x + 20, 74), ...cell(x, 74, 40, 30, t)));
    out.push(text(72, 130, "the table IS the tree", "dbi-t-m"), text(228, 130, "index points to rows", "dbi-t-m"));
    return pic("Left: in InnoDB the rows sit inside the primary key tree. Right: in Postgres the index points into a heap of rows in no special order.", out, 138);
  }

  /* 13. Bitmap scans: combine index hits into a bitmap, then read the pages in order. */
  function bitmapPic() {
    const N = 12;
    const A = [1, 4, 5];
    const Bset = [5, 9];
    const union = [...new Set([...A, ...Bset])].sort(nums);
    const row = (y, label, set) => {
      const o = [text(30, y - 4, label, "dbi-t-m", "start")];
      for (let p = 1; p <= N; p++) {
        const on = set.includes(p);
        o.push(rect(30 + (p - 1) * 20, y, 18, 16, "dbi-box" + (on ? " dbi-hot" : ""), 3), text(39 + (p - 1) * 20, y + 12, p, on ? "dbi-t-inv dbi-tiny" : "dbi-t-m dbi-tiny"));
      }
      return o;
    };
    const out = [row(22, "pages hit by index on a", A), row(58, "pages hit by index on b", Bset), row(94, "a = 1 OR b = 2: one bitmap", union)];
    out.push(text(150, 134, `Read pages ${union.join(", ")} once, in order`, "fl-small"));
    return pic("Two indexes each mark some table pages. The marks are joined in a bitmap, and the pages are read once, in order.", out, 142);
  }

  /* 14. LSM: writes land in memory, flush as sorted files, and merge (newer value wins). */
  function lsmPic() {
    const mem = [9, 3].sort(nums);
    const older = [2, 7, 11];
    const newer = [4, 7, 15];
    const merged = [...new Set([...older, ...newer])].sort(nums);
    const run = (x, y, vals, st = "") => vals.flatMap((v, i) => cell(x + i * 26, y, 24, 16, v, st));
    const out = [text(150, 9, "1. Writes go to memory first", "fl-pos"), ...run(124, 14, mem, "hot")];
    out.push(line(150, 30, 150, 46, "dbi-ink-line"), text(150, 58, "2. Flushed as sorted files on disk", "fl-pos"));
    out.push(...run(20, 64, older), ...run(190, 64, newer));
    out.push(line(58, 80, 58, 86), line(228, 80, 228, 86), line(58, 86, 228, 86), line(150, 86, 150, 92, "dbi-ink-line"));
    out.push(text(150, 104, "3. Merged later (compaction)", "fl-pos"), ...run(85, 108, merged, "hot"));
    out.push(text(150, 142, "B-tree: changes pages where they are", "dbi-t-m"));
    return pic("Writes go to memory, then to sorted files. Files are merged into one bigger sorted file. A B-tree changes pages in place instead.", out);
  }

  /* 15. Inverted index: word -> documents, and AND is the overlap of two lists. */
  function invertedPic() {
    const docs = ["red fish", "blue fish", "red bird"];
    const map = {};
    docs.forEach((d, i) => d.split(" ").forEach((w) => { (map[w] = map[w] || []).push(i + 1); }));
    const query = ["red", "fish"];
    const result = query.map((w) => map[w]).reduce((a, b) => a.filter((x) => b.includes(x)));
    const out = [text(80, 11, "word -> documents", "fl-pos"), text(232, 11, "documents", "fl-pos")];
    Object.keys(map).sort().forEach((w, j) => out.push(...cell(8, 18 + j * 24, 144, 20, `${w}  ->  ${map[w].join(", ")}`, query.includes(w) ? "hot" : "")));
    docs.forEach((d, i) => out.push(...cell(176, 18 + i * 24, 112, 20, `${i + 1}: ${d}`, result.includes(i + 1) ? "hot" : "")));
    out.push(text(150, 126, `${query.join(" AND ")}: lists overlap at document ${result.join(", ")}`, "fl-small"));
    return pic("A list of words, each with the documents that contain it. Searching red AND fish finds the document that is in both lists.", out, 135);
  }

  /* 16. Vector: points in space; the query's nearest neighbours (computed). */
  function vectorPic() {
    let seed = 7;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const pts = Array.from({ length: 22 }, () => ({ x: 14 + rnd() * 272, y: 14 + rnd() * 100 }));
    const q = { x: 150, y: 62 };
    const K = 3;
    const dist = (p) => Math.hypot(p.x - q.x, p.y - q.y);
    const near = [...pts].sort((a, b) => dist(a) - dist(b)).slice(0, K);
    const radius = dist(near[K - 1]) + 4;
    const out = [dot(q.x, q.y, radius, "dbi-circle")];
    pts.forEach((p) => out.push(dot(p.x, p.y, near.includes(p) ? 4.5 : 3, near.includes(p) ? "dbi-pt" : "dbi-pt-mute")));
    out.push(S("path", { d: `M ${q.x - 5} ${q.y - 5} l 10 10 M ${q.x + 5} ${q.y - 5} l -10 10`, class: "dbi-bad" }), text(q.x + 14, q.y - 8, "query", "fl-pos", "start"));
    out.push(text(150, 132, `The ${K} nearest points are the answer`, "fl-small"));
    return pic("Points in space. A circle around the query point holds its three nearest neighbours.", out, 140);
  }

  Book.dbIndexTypes = () => [
    { id: "btree", name: "B-tree", short: "The default sorted tree", w: "H",
      problem: "Find one row, or a range of rows, without reading the whole table.",
      use: "Exact match (=), ranges (<, >, BETWEEN), ORDER BY. Text that starts with a known word (LIKE 'abc%', where % means any text) needs the text_pattern_ops version.",
      avoid: "LIKE '%abc', or a column where most rows share one value. Every write must also update it.",
      example: "CREATE INDEX ON users (created_at);", lang: "sql", picture: btreePic },
    { id: "composite", name: "Composite", short: "One index, several columns", w: "H",
      problem: "Your query filters on two columns at once, like customer and date.",
      use: "The query uses the first column. Put columns tested with = first, then the range column.",
      avoid: "The query skips the first column. The index is sorted by that column first.",
      note: "Postgres 18 added a limited skip scan that can sometimes skip the first column. It is limited, so check your version.",
      example: "CREATE INDEX ON orders (customer_id, created_at);", lang: "sql", picture: compositePic },
    { id: "covering", name: "Covering (INCLUDE)", short: "Index holds extra columns", w: "H",
      problem: "The index finds the row fast, but reading the table row is still the slow part.",
      use: "A hot query that needs only a few columns. The database answers from the index alone (an index-only scan).",
      avoid: "Wide indexes, or tables that change all the time. Index-only scans also need regular vacuum.",
      example: "CREATE INDEX ON orders (customer_id) INCLUDE (total);", lang: "sql", picture: coveringPic },
    { id: "partial", name: "Partial", short: "Index only some rows", w: "H",
      problem: "Most rows never match your query, but a normal index stores all of them.",
      use: "Small hot groups of rows: pending jobs, unpaid orders, rows that are not soft-deleted.",
      avoid: "The query's WHERE does not include the index condition. Then the database cannot use the index.",
      example: "CREATE INDEX ON jobs (run_at) WHERE status = 'pending';", lang: "sql", picture: partialPic },
    { id: "expression", name: "Expression", short: "Index a computed value", w: "M",
      problem: "The query wraps the column in a function, so a normal index is ignored.",
      use: "Case-insensitive search, or cutting a date down to the day.",
      avoid: "The query writes the expression in a different way. It must match the index.",
      example: "CREATE INDEX ON users (lower(email));", lang: "sql", picture: expressionPic },
    { id: "unique", name: "Unique", short: "An index that blocks duplicates", w: "H",
      problem: "You need a rule: no two rows with the same value. The index checks it fast.",
      use: "Business keys like email, and the target for an upsert (ON CONFLICT).",
      avoid: "Nullable columns. By default, NULLs count as different, so many NULLs are allowed.",
      example: "CREATE UNIQUE INDEX ON users (email);", lang: "sql", picture: uniquePic },
    { id: "hash", name: "Hash", short: "Exact-match lookups only", w: "L",
      problem: "Find a row by an exact value, like a session token.",
      use: "Only = lookups on a value.",
      avoid: "Ranges or sorting: a hash has no order. A B-tree is usually just as good.",
      example: "CREATE INDEX ON sessions USING HASH (token);", lang: "sql", picture: hashPic },
    { id: "gin", name: "GIN", short: "Many values in one cell", w: "M",
      problem: "One cell holds many things: words, array items, JSON keys. You want the rows that contain one of them.",
      use: "Full-text search, jsonb, arrays, and LIKE '%x%' (with the pg_trgm extension).",
      avoid: "Tables with many writes. GIN is slow to update and large on disk.",
      example: "CREATE INDEX ON docs USING GIN (to_tsvector('english', body));", lang: "sql", picture: ginPic },
    { id: "gist", name: "GiST", short: "Overlap and nearness", w: "L",
      problem: "Find shapes or ranges that overlap, or points that are near each other.",
      use: "Maps (PostGIS), ranges, nearest neighbour, and exclusion constraints (no overlap allowed).",
      avoid: "Plain equality. A B-tree is better for that.",
      note: "Speako's no-double-booking rule uses GiST. See page 11.",
      example: "CREATE INDEX ON places USING GIST (location);", lang: "sql", picture: gistPic },
    { id: "spgist", name: "SP-GiST", short: "Cut space into parts", w: "L",
      problem: "The data is not even: clusters of points, IP prefixes, text prefixes.",
      use: "Points, IP address prefixes, and text prefixes.",
      avoid: "General work. Pick it only when you know your data fits.",
      example: "CREATE INDEX ON hosts USING SPGIST (addr inet_ops);", lang: "sql", picture: spgistPic },
    { id: "brin", name: "BRIN", short: "Min and max per page range", w: "M",
      problem: "The table is huge, and a normal index would be huge too. BRIN keeps only a min and max for each range of table pages (128 pages by default).",
      use: "Very large tables where new rows are added in order, like timestamps in a log.",
      avoid: "Randomly ordered data. Every page range then has a wide min and max, so BRIN skips nothing.",
      example: "CREATE INDEX ON events USING BRIN (created_at);", lang: "sql", picture: brinPic },
    { id: "clustered", name: "Clustered vs heap", short: "Where the rows really live", w: "H",
      problem: "Where is the table data stored, and how do the indexes find it?",
      use: "InnoDB: range scans on the primary key are fast. Postgres: CLUSTER reorders a table once.",
      avoid: "InnoDB: random UUID keys make the tree rewrite many pages, and other indexes need two lookups. Postgres: CLUSTER does not stay ordered.",
      note: "MySQL InnoDB stores the table as the primary key tree. Postgres stores a heap, and every index points into it.",
      example: "CLUSTER orders USING orders_created_idx;", lang: "sql", picture: clusteredPic },
    { id: "bitmap", name: "Bitmap scans", short: "A way of reading", w: "M",
      problem: "Many rows match, or you want to combine two indexes with AND or OR.",
      use: "A medium number of matches, or a = 1 OR b = 2 using two indexes.",
      avoid: "As a fix for a missing index. It still needs an index to find the rows.",
      note: "Not an index type. It is a way of reading: the planner marks pages in a bitmap, then reads them in order.",
      example: "EXPLAIN SELECT * FROM t WHERE a = 1 OR b = 2; -- look for Bitmap Heap Scan", lang: "sql", picture: bitmapPic },
    { id: "lsm", name: "LSM-tree vs B-tree", short: "Write fast, merge later", w: "H",
      problem: "A B-tree changes pages in place, which means many random writes.",
      use: "LSM (RocksDB, Cassandra): heavy writes. B-tree (Postgres, InnoDB): heavy reads and ranges.",
      avoid: "LSM: extra reads and writes while merging, and sometimes pauses. B-tree: slower for random writes.",
      note: "Read more in Designing Data-Intensive Applications, 2nd edition, chapter 4. This is not SQL, so there is no example line.",
      picture: lsmPic },
    { id: "inverted", name: "Inverted index", short: "Word to list of documents", w: "M",
      problem: "Find all documents that contain a word, fast.",
      use: "Search engines (Lucene, Elasticsearch). In Postgres, GIN is the inverted index.",
      avoid: "Reading in exact order (ranges), and fields that change all the time.",
      example: "CREATE INDEX ON docs USING GIN (tsv);", lang: "sql", picture: invertedPic },
    { id: "vector", name: "Vector (HNSW, IVFFlat)", short: "Find the nearest meaning", w: "M",
      problem: "Find the items most similar to a query, like in AI search over embeddings.",
      use: "Semantic search and RAG. HNSW gives faster searches that find more of the true nearest matches (this is called recall).",
      avoid: "You need exact results, or your query has no ORDER BY ... LIMIT. The answers are approximate.",
      note: "HNSW is a layered graph: slower to build and uses more memory. IVFFlat groups vectors into lists: builds faster, and you build it after loading the data.",
      example: "CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops);", lang: "sql", picture: vectorPic },
  ];
})();
