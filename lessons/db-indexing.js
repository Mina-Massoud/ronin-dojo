/* Lesson: Database indexing — the golden beginner lesson, upgraded to the full chapter template (Wave 1).
   Order: story → small readable table → add an index → a million rows → why it stays fast → code →
   the index family (hub and spoke) → indexes aren't free → traps → Speako → on the job → real questions → one sentence.
   Visuals: db-indexing.visuals.js. The 16 index types: db-indexing.spokes.js (must load before this file). */
(function () {
  const { h, word, step, runnable, prereqs, guided } = Book;
  const V = Book.parts["db-indexing"];

  /* ---------- Go deeper links (every URL comes from research/backend-syllabus.md §3) ---------- */
  const L = {
    util: { title: "Use The Index, Luke: anatomy of an index", url: "https://use-the-index-luke.com/sql/anatomy", type: "book", by: "Markus Winand" },
    pgIndexes: { title: "PostgreSQL docs: Indexes", url: "https://www.postgresql.org/docs/current/indexes.html", type: "doc", by: "PostgreSQL" },
    pgTypes: { title: "PostgreSQL docs: Index types", url: "https://www.postgresql.org/docs/current/indexes-types.html", type: "doc", by: "PostgreSQL" },
    pgExplain: { title: "PostgreSQL docs: Using EXPLAIN", url: "https://www.postgresql.org/docs/current/using-explain.html", type: "doc", by: "PostgreSQL" },
    pgvector: { title: "pgvector: HNSW and IVFFlat", url: "https://github.com/pgvector/pgvector", type: "doc", by: "pgvector project" },
    cmu: { title: "CMU 15-445 Database Systems (course page)", url: "https://15445.courses.cs.cmu.edu/fall2025/", type: "course", by: "Andy Pavlo" },
    ddia: { title: "Designing Data-Intensive Applications, 2nd edition (announcement)", url: "https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html", type: "book", by: "Kleppmann and Riccomini" },
  };

  const CODE = `
// A sorted list of 1,000,000 emails (like an index).
const N = 1_000_000;
const emails = [];
for (let i = 0; i < N; i++) emails.push("user" + String(i).padStart(7, "0") + "@mail.com");
const target = "user0742931@mail.com";

// 1) Check every email, one by one.
let checks = 0;
let start = performance.now();
for (let i = 0; i < emails.length; i++) {
  checks++;
  if (emails[i] === target) { /* found it, but keep going */ }
}
report("Check every email", { checks, ms: performance.now() - start });

// 2) Sorted search: look in the middle, drop the half that can't have it.
checks = 0;
start = performance.now();
let lo = 0, hi = emails.length - 1, found = -1;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  checks++;
  if (emails[mid] === target) { found = mid; break; }
  if (emails[mid] < target) lo = mid + 1;
  else hi = mid - 1;
}
report("Sorted search", { checks, ms: performance.now() - start, found });

// Try: change N to 4_000_000 and press Run again.
`;

  /* Turn the two reports into plain sentences and bars (never leave raw output alone). */
  function explainRun(r) {
    const a = r["Check every email"];
    const b = r["Sorted search"];
    if (!a || !b) return h("p.result-say", "One of the two searches didn't report. Press Reset to get the original code back.");
    const time = (x) => (x.ms < 0.001 ? "less than 0.001 ms" : `${x.ms < 1 ? x.ms.toFixed(3) : x.ms.toFixed(1)} ms`);
    return Book.resultCard({
      title: "What happened",
      rows: [
        { label: "Check every email", value: a.checks, text: `${Book.fmt(a.checks)} checks` },
        { label: "Sorted search", value: b.checks, text: `${Book.fmt(b.checks)} checks` },
      ],
      sentences: [
        `Checking every email looked at all ${Book.fmt(a.checks)} of them. It took ${time(a)}.`,
        b.found >= 0
          ? `The sorted search looked at only ${b.checks} emails, and found the target at position ${Book.fmt(b.found)} in the list (the list starts at 0). It took ${time(b)}.`
          : `The sorted search looked at ${b.checks} emails and didn't find the target. Did you change the target?`,
        `That's ${Book.fmt(Math.round(a.checks / Math.max(1, b.checks)))}× fewer checks.`,
      ],
      note: "Both times look small because the list lives in your computer's memory, which is very fast. A database reads from disk, where each check costs much more. That's why the number of checks is what really matters.",
    });
  }

  /* ---------- Page 11: Speako. The real code (an excerpt) and a timeline that runs the same test ---------- */
  const EXCERPT = [
    "// speako-web/src/lib/booking-conflicts.ts (lines 29-52; comments shortened)",
    "",
    "// Statuses that occupy a resource — mirrors the DB EXCLUDE constraints.",
    "export const OCCUPYING_BOOKING_STATUSES = [",
    "  \"confirmed\",",
    "  \"pending_guarantee\",",
    "] as const;",
    "",
    "// SQL predicate for the above: a constant string, no interpolation.",
    "export const OCCUPYING_STATUS_SQL = `status IN ('confirmed', 'pending_guarantee')`;",
    "",
    "// Half-open overlap test: [start, end) intersects [existing_start, existing_end).",
    "// Back-to-back bookings (one ends exactly when the next begins) do NOT overlap,",
    "// matching the `tsrange` semantics the EXCLUDE constraints use.",
    "export function bookingOverlapSql(startParam: string, endParam: string): string {",
    "  return `(start_time < ${endParam}::timestamp AND end_time > ${startParam}::timestamp)`;",
    "}",
  ].join("\n");

  const EXCLUDE_SQL = [
    "CREATE EXTENSION IF NOT EXISTS btree_gist;  -- lets GiST also handle plain = on staff_id",
    "",
    "ALTER TABLE bookings ADD CONSTRAINT no_double_booking_staff",
    "  EXCLUDE USING gist (staff_id WITH =, tsrange(start_time, end_time) WITH &&)",
    "  WHERE (status IN ('confirmed', 'pending_guarantee'));",
  ].join("\n");

  const SPAN = 180; // the timeline shows 12:00 to 15:00, in minutes
  const clock = (m) => `${12 + Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  const range = (r) => `[${clock(r.start)}, ${clock(r.end)})`;
  /* The same test as bookingOverlapSql: existing.start < new.end AND existing.end > new.start */
  const overlapCheck = (a, b) => {
    const first = a.start < b.end;
    const second = a.end > b.start;
    return { first, second, overlap: first && second };
  };

  function bookingTimeline() {
    const A = { start: 0, end: 60 };
    return guided({
      title: "Do two bookings overlap?",
      build(view) {
        const bar = (cls) => h("div.tl-bar" + cls, h("span.tl-end.l"), h("span.tl-end.r"));
        const barA = bar("");
        const barB = bar(".b");
        const nameA = h("div.tl-name", "Booking A (already there)", h("span", range(A)));
        const nameB = h("div.tl-name");
        const rowB = h("div.tl-row", nameB, h("div.tl-lane", barB));
        const ticks = h("div.tl-ticks", [0, 60, 120, 180].map((m) => h("span", { style: { left: `${(m / SPAN) * 100}%` } }, clock(m))));
        const check = h("div.tl-check", { "aria-live": "polite" });
        const startIn = h("input", { type: "range", min: "0", max: String(SPAN - 30), step: "30", value: "60", "aria-label": "When booking B starts" });
        const lenIn = h("input", { type: "range", min: "30", max: "120", step: "30", value: "60", "aria-label": "How long booking B lasts" });
        const sliders = h("div.tl-sliders", h("label", h("span", "B starts"), startIn), h("label", h("span", "B lasts"), lenIn));
        const root = h("div.tl", h("div.tl-row", nameA, h("div.tl-lane", barA)), rowB, ticks, check, sliders);
        view.append(root);

        let B = { start: 60, end: 120 };
        const place = (el, r) => { el.style.left = `${(r.start / SPAN) * 100}%`; el.style.width = `${((r.end - r.start) / SPAN) * 100}%`; };
        place(barA, A);
        const scene = {
          barA, rowB, check, sliders, root, startIn, lenIn,
          setB(r) {
            B = r;
            place(barB, r);
            nameB.replaceChildren("New booking B", h("span", range(r)));
          },
          /* Both comparisons come from overlapCheck(), the same test as the real SQL. */
          paintCheck() {
            const c = overlapCheck(A, B);
            const yn = (v) => h("span", { class: v ? "yes" : "no" }, v ? "yes" : "no");
            check.replaceChildren(
              h("div", h("code", "A.start < B.end"), `  ${clock(A.start)} < ${clock(B.end)}  → `, yn(c.first)),
              h("div", h("code", "A.end > B.start"), `  ${clock(A.end)} > ${clock(B.start)}  → `, yn(c.second)),
              h("div.verdict", c.overlap ? "Both are yes, so they overlap. This is a conflict." : "One is no, so they do not overlap. The slot is free."));
            check.hidden = false;
          },
          reset({ b = null, marks = false, free = false } = {}) {
            root.classList.toggle("marks", marks);
            rowB.hidden = !b;
            check.hidden = true;
            sliders.hidden = !free;
            if (b) scene.setB(b);
          },
        };
        const fromSliders = () => {
          const start = Number(startIn.value);
          const end = Math.min(SPAN, start + Number(lenIn.value));
          scene.setB({ start, end });
          scene.paintCheck();
        };
        startIn.addEventListener("input", fromSliders);
        lenIn.addEventListener("input", fromSliders);
        scene.fromSliders = fromSliders;
        return scene;
      },
      steps: [
        {
          say: "A staff member has one booking, A, from 12:00 to 13:00. Time is a line, and a booking is a piece of it.",
          enter: (s) => s.reset(),
          show: (s, ctx) => ctx.callout(s.barA, "Booking A", "top"),
        },
        {
          say: "We write it as [12:00, 13:00). The square bracket means 12:00 is included. The round bracket means 13:00 is not included.",
          enter: (s) => s.reset({ marks: true }),
          show: (s, ctx) => {
            ctx.callout(s.barA.querySelector(".tl-end.l"), "Included", "top");
            ctx.callout(s.barA.querySelector(".tl-end.r"), "Not included", "bottom");
          },
        },
        {
          say: "A new booking, B, wants 13:00 to 14:00. It starts exactly when A ends.",
          enter: (s) => s.reset({ marks: true, b: { start: 60, end: 120 } }),
          guess: { q: "Do A and B overlap?", options: ["Yes, they touch at 13:00", "No, they do not overlap"], answer: 1, why: "A uses the time up to, but not including, 13:00. B starts at 13:00. They share no moment." },
          action: { label: "Run the overlap check", icon: "search", run: async (s, ctx) => { await ctx.wait(200); s.paintCheck(); } },
          after: "This is the test in Speako's code. Two bookings overlap only if both comparisons are yes.",
        },
        {
          say: "Now B moves to 12:30 until 13:30. It starts while A is still there.",
          enter: (s) => s.reset({ marks: true, b: { start: 30, end: 90 } }),
          guess: { q: "Do A and B overlap now?", options: ["Yes, they share 30 minutes", "No, B starts after A"], answer: 0, why: "A is there until 13:00. B starts at 12:30. From 12:30 to 13:00, both want the same staff member." },
          action: { label: "Run the overlap check", icon: "search", run: async (s, ctx) => { await ctx.wait(200); s.paintCheck(); } },
        },
        {
          say: "Your turn. Move the sliders and watch the two comparisons.",
          enter: (s) => { s.reset({ marks: true, b: { start: 60, end: 120 }, free: true }); s.startIn.value = "60"; s.lenIn.value = "60"; s.paintCheck(); },
        },
      ],
      takeaway: "Two bookings overlap only when each one starts before the other ends. Bookings that touch at the edge are fine.",
      check: {
        q: "A booking is [14:00, 15:00). Which new booking conflicts with it?",
        options: ["[13:00, 14:00)", "[14:30, 15:30)", "[15:00, 16:00)"],
        answer: 1,
        why: ["It ends at 14:00, exactly when the other starts. Back-to-back is not a conflict.", "It starts at 14:30, while the first booking is still going. They share 30 minutes.", "It starts at 15:00, exactly when the other ends. Back-to-back is not a conflict."],
      },
    });
  }

  /* ---------- Page 12: On the job ---------- */
  const PLAN = [
    "EXPLAIN ANALYZE",
    "SELECT * FROM bookings",
    "WHERE business_id = 42",
    "  AND starts_at >= '2026-10-01' AND starts_at < '2026-11-01'",
    "  AND status IN ('confirmed', 'pending_guarantee');",
    "",
    "Seq Scan on bookings  (cost=0.00..98234.00 rows=1250 width=96)",
    "                      (actual time=0.041..1187.320 rows=1312 loops=1)",
    "  Rows Removed by Filter: 3998688",
    "Execution Time: 1187.9 ms",
    "// Example output, made up for this lesson. 1,312 + 3,998,688 = 4,000,000 rows.",
  ].join("\n");

  const TICKET = {
    id: "SPK-412",
    title: "Booking search takes 1.2 s for big restaurants",
    context: "The bookings table has 4 million rows. The dashboard shows one business's bookings for a date range, filtered by status. For the biggest restaurants, the page takes 1.2 seconds to load.",
    symptoms: [
      "The slow query filters by business_id, a date range on starts_at, and status.",
      "EXPLAIN ANALYZE shows a Seq Scan: the database read all 4 million rows to return 1,312.",
      "“Rows Removed by Filter” is almost the whole table.",
    ],
    code: PLAN,
    tasks: [
      "What do you check first, before you change anything?",
      "Which index would you add, and in which column order?",
      "How do you create it safely on a live table, and how do you prove it worked?",
    ],
    steps: [
      [h("b", "Measure. "), "Run EXPLAIN ANALYZE on the real query. Seq Scan and almost 4 million removed rows usually mean there is no useful index (or the planner chose not to use one; stale statistics can cause this too). Save the time (1,188 ms) to compare later."],
      [h("b", "Add an index on two columns: "), h("code", "(business_id, starts_at)"), ". Put the = column first and the range column second. One business's rows then sit together, in date order, so the date range is one small slice."],
      [h("b", "Maybe make it partial. "), "If the dashboard only shows live bookings, add ", h("code", "WHERE status IN ('confirmed', 'pending_guarantee')"), ". The index is smaller, but it only helps queries with that same condition."],
      [h("b", "Create it without blocking. "), h("code", "CREATE INDEX CONCURRENTLY"), " lets the app keep saving bookings while the index builds. It is slower, and it can't run inside a transaction. If this fails, it leaves a broken index marked INVALID. Drop it and try again."],
      [h("b", "Measure again. "), "EXPLAIN ANALYZE should now show an Index Scan or Bitmap Heap Scan and a time of a few milliseconds. Show the before and after in the ticket."],
      [h("b", "Watch the write cost. "), "Every new index makes each booking insert do one more write (page 09). Check insert speed and index size, and drop indexes that nothing uses (look at idx_scan in pg_stat_user_indexes)."],
    ],
  };

  /* ---------- Page 13: interview questions ---------- */
  const UBER_URL = "https://prachub.com/interview-questions/design-a-scalable-calendar-service";
  const OKTA_URL = "https://prachub.com/interview-questions/design-high-throughput-messaging-infrastructure";
  const PURECODE_URL = "https://www.glassdoor.at/Vorstellungsgespräch/PureCode-Software-Vorstellungsgespräch-E8122561-RVW88596228.htm";

  const REAL_QUESTIONS = [
    { q: "Build a normalized schema from requirements. Write SQL for customers with more than three purchases in the last month. Explain INNER vs LEFT JOIN. Talk about indexing.",
      type: "coding", level: "mid full-stack",
      source: { company: "PureCode Software (Austin)", year: "mid-2024", url: PURECODE_URL },
      testing: "Can you model data, write a join with a count, and say which columns you would index and why? (This report is known only from a search summary.)",
      answer: [
        "1. Schema: customers(id, name) and purchases(id, customer_id, created_at, total). purchases.customer_id is a foreign key to customers.id. Each fact lives in one place.",
        "2. Query: SELECT c.id, c.name FROM customers c JOIN purchases p ON p.customer_id = c.id WHERE p.created_at >= now() - interval '1 month' GROUP BY c.id, c.name HAVING count(*) > 3; (Ask what “last month” means: the last 30 days, or the calendar month?)",
        "Read it as: join the two tables, keep last month, count per customer, keep counts above 3.",
        "3. INNER JOIN keeps only customers who have purchases. LEFT JOIN keeps all customers, and shows NULL when there is no purchase.",
        "4. Index: purchases (customer_id, created_at). The join uses customer_id, and the date is a range, so equality first and range second. Postgres does not index foreign keys for you, so say that out loud.",
      ] },
    { q: "Design high-throughput messaging infrastructure. Cover database optimization, queues and brokers when many users write at the same time.",
      type: "system",
      source: { company: "Okta (technical screen)", year: "May 2026", url: OKTA_URL },
      testing: "Do you know that indexes help reads but cost writes? Can you explain where a queue smooths the load? (The source is a summary only.)",
      answer: [
        "Start with numbers: messages per second, and how many reads per write.",
        "Read path: one composite index that matches the main query, like (conversation_id, created_at) for “latest messages in a chat”.",
        "Write path: every extra index slows every insert (page 09), so keep indexes few and insert in batches.",
        "Put a queue in front of the database. It absorbs spikes, and workers write at a steady speed.",
        "For very large tables, partition by time. Old data is cheap to drop, and each index stays small.",
      ] },
    { q: "Design a scalable calendar service. Explain the indexes for range queries, how you would partition the data, and how you would precompute free and busy time.",
      type: "system",
      source: { company: "Uber", year: "May 2026", url: UBER_URL },
      testing: "Range thinking: events overlap a time window, they don't equal a value. And can you connect indexes to partitioning and precomputing?",
      answer: [
        "The main query: all events for one calendar in a time window. An event is in the window if starts_at < window_end AND ends_at > window_start (the same half-open test as page 11).",
        "A composite B-tree index on (calendar_id, starts_at) helps narrow to one calendar and a time window. Overlap searches on ranges are a good fit for a GiST index on a time range.",
        "Partition by calendar or user, so one query touches one partition. Time-based partitions make old data cheap to archive.",
        "Free and busy: keep merged busy blocks per user, and update them when an event changes. A read becomes one small lookup.",
        "Trade-off: precomputing makes writes more complex, and it can be briefly out of date.",
      ] },
    { q: "Notification history with live updates: design the history API with stable cursor pagination, and avoid gaps between the history and the live stream.",
      type: "system",
      source: { company: "Roblox", year: "Sep 2026" },
      testing: "Do you know why OFFSET pagination breaks on a list that keeps changing, and how keyset pagination uses an index?",
      answer: [
        "OFFSET gets slower on deep pages, and items shift when new ones arrive. Users then see duplicates or miss items.",
        "Use a cursor (keyset pagination). Send back the last item's (created_at, id). The next page is: WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20.",
        "Back it with a composite index like (user_id, created_at, id), so each page is one short index range.",
        "To avoid gaps: open the live stream first, then fetch the history, then remove duplicates by id.",
      ] },
  ];

  const PRACTICE_QUESTIONS = [
    { q: "“Our user search takes 1.2 seconds. What do you do?”", type: "scenario",
      testing: "A method: measure first, find the cause, fix it, and prove it. Not a guess.",
      answer: [
        "1. Measure first: run EXPLAIN ANALYZE on the slow query. Don't guess.",
        "2. Look for “Seq Scan” on a big table: that means it read every page.",
        "3. Check the WHERE: does it match few rows? Does it wrap the column in a function like lower()?",
        "4. Add the right index with CREATE INDEX CONCURRENTLY, so the app can keep saving data while it builds.",
        "5. Run EXPLAIN ANALYZE again and show the before and after numbers.",
      ] },
    { q: "Why CONCURRENTLY?", type: "concept",
      testing: "Do you know that a normal index build blocks writes on a live table?",
      answer: "A normal CREATE INDEX blocks inserts, updates and deletes on the table until it finishes (reads still work). On a big table, that can take minutes, and the app can't save changes. CONCURRENTLY builds more slowly, but the app keeps working." },
    { q: "Why not index every column?", type: "concept",
      testing: "Do you see the cost side of indexes, not only the speed side?",
      answer: ["Every INSERT writes to every index, so more indexes mean slower saves and more disk (page 09). An UPDATE that changes no indexed column can skip the index writes in Postgres (a “HOT update”).", "Add indexes for real slow queries you measured."] },
    { q: "The index exists, but the database still reads every page. Why?", type: "debugging",
      testing: "Can you list the usual reasons an index is not used?",
      answer: "Three reasons from page 10: a function on the column (lower(email)), a % at the start of LIKE, or a query that matches most of the table. A fourth: the index is on a different column than the WHERE uses (see Composite on page 08)." },
    { q: "Where have you seen this in your own work?", type: "behavioral",
      testing: "Can you connect the idea to real work, and be honest about what you did yourself?",
      answer: "Speako's booking search and dashboards filter by business, date and status. Those columns need indexes, in the right order, or every page load reads the whole bookings table. Be ready to say which parts you wrote yourself, and which came from the team or from AI." },
  ].map((it) => ({ ...it, source: { label: "Practice question" } }));

  Book.registerLesson("db-indexing", {
    mount(root) {
      root.append(
        prereqs([
          ["Table", "A grid of data, like a spreadsheet. Each row is one item (a user), each column is one detail (name, email)."],
          ["Query", "A question you ask the database, like “find the user with this email”."],
          ["Disk", "Where the data is stored. Reading from disk is slow, so reading less means answering faster."],
          ["SQL", "The language you use to ask a database for data. You'll see a few short examples here."],
          ["Postgres", "A popular database (PostgreSQL). This lesson uses it as the example."],
        ]),
        step({ n: "01", title: "Finding something in a book", lines: [
          "Before databases, think about a book.",
          "Read each step. When a button glows, press it. Then press Next.",
        ], demo: V.book() }),
        step({ n: "02", title: "Watch it slowly: how the index finds “Promise”", lines: [
          "You just used the index with a button. Now watch the same search, one check at a time.",
          "Press play. Pause any time, or drag the bar to go back.",
        ], demo: V.searchFilm() }),
        step({ n: "03", title: "A table is stored in pages", lines: [
          "A database table works like that book.",
          ["The database keeps rows in small boxes called ", word("pages", "Small blocks of rows on disk (8 KB in Postgres). The database always reads a whole page, never one row."), ". To see a row, it must read the whole page."],
        ], demo: V.table() }),
        step({ n: "04", title: "Add an index", lines: [
          ["A database ", word("index", "A shortcut, usually a sorted list of one column's values. Each value points to the page its row is stored on."), " works like the index at the back of a book."],
          "Add one, then search again. Watch “Table pages read”.",
        ], demo: V.addIndex() }),
        step({ n: "05", title: "At a million rows, it really matters", lines: [
          "With 12 rows, any search is fast.",
          "Real tables have millions of rows. That's where an index saves you.",
        ], demo: V.million() }),
        step({ n: "06", title: "Why it stays fast as tables grow", lines: [
          ["A real index is a ", word("B-tree", "The shape Postgres uses for indexes: a few levels of sorted pages (root, branch, leaf)."), ": a few levels of sorted pages."],
          "Each new level lets the index find roughly 300 times more rows (it depends on key size).",
        ], demo: V.levels(), links: [L.util, L.pgIndexes] }),
        step({ n: "07", title: "See it as code", lines: [
          "Watch the two searches run as real code, side by side. The lit line is the one running.",
          "Then try it yourself on 1,000,000 emails. Press Run, and read what happened.",
        ], demo: h("div.demo-stack",
          Book.searchRace({ list: [3, 8, 12, 15, 21, 27, 31, 36, 42, 47, 53, 58, 64, 70, 77, 85], target: 64, title: "Two programs race: check every item vs sorted search" }),
          runnable({ code: CODE, rows: 22, explain: explainRun })), links: [L.cmu] }),
        step({ n: "08", title: "The index family", lines: [
          "A toolbox has many tools, and each tool fits one job. Indexes are the same.",
          "Tap any type. Each card says when NOT to use it.",
        ], demo: Book.dbIndexTypes
          ? h("div.demo-stack", h("p.dbi-note", "You don't need all 16. The badge shows how often interviews ask about it. Start with the “Asked often” cards."), Book.hubSpoke({ title: "The index family: 16 cards", items: Book.dbIndexTypes() }))
          : h("p.dbi-note", "The index family needs lessons/db-indexing.spokes.js to be loaded before this lesson."),
        links: [L.pgTypes, L.pgvector, L.ddia, L.util] }),
        step({ n: "09", title: "Indexes aren't free", lines: [
          "An index is an extra structure the database keeps up to date. Every write must update it.",
          ["So one ", word("INSERT", "The SQL command that adds a new row to a table."), " writes the table page, and one entry in every index."],
        ], demo: V.cost(), links: [L.pgIndexes, L.util] }),
        step({ n: "10", title: "When the index can't help", lines: [
          "Having an index doesn't mean the database can use it.",
          ["Guess for each query. In real work, you check with ", h("code", "EXPLAIN ANALYZE"), ": it shows what the database really did."],
        ], demo: V.traps(), links: [L.pgExplain, L.util] }),
        step({ n: "11", title: "From your work: double bookings at Speako", lines: [
          "Speako must never book one staff member or table twice at the same time.",
          ["The code checks if two bookings ", word("overlap", "Two bookings overlap when they share some moment in time."), ". It uses a ", word("half-open", "The start time counts. The end time does not. So 12:00 to 13:00 and 13:00 to 14:00 don't overlap."), " test."],
          ["The database enforces the same rule with an ", word("EXCLUDE constraint", "A rule the database checks on every write. EXCLUDE can say: no two rows may overlap."), " and a GiST index."],
        ], demo: h("div.demo-stack",
          h("span.label", "The real code"),
          Book.code(EXCERPT),
          h("span.label", "Run the same test yourself"),
          bookingTimeline(),
          h("span.label", "The database enforces it too, with a GiST index (see the GiST card on page 08)"),
          Book.sql(EXCLUDE_SQL),
          h("p.dbi-note", h("code", "WITH ="), " means the same staff member. ", h("code", "WITH &&"), " means the time ranges overlap. Together: no two active bookings may share a staff member at overlapping times."),
          h("p.dbi-note", h("b", "Honest note. "), "In the Speako repo, this file mirrors the database constraint. Be ready to say which parts you wrote."),
          h("p.dbi-note", h("b", "Check before you say it. "), "The TypeScript code lists two statuses. One SQL file in the repo lists only ", h("code", "'confirmed'"), ". Ask your team which one is live. The SQL above follows the TypeScript.")),
        links: [L.pgTypes] }),
        step({ n: "12", title: "On the job", lines: [
          "A ticket lands in your queue. Read it and make a plan.",
          "Then open the solution and compare it with yours.",
        ], demo: Book.onTheJob(TICKET), links: [L.pgExplain, L.pgIndexes] }),
        step({ n: "13", title: "Real interview questions", lines: [
          "These come from real interview reports. Each shows its company and date. Most also show a link.",
          "Few public reports ask about indexes directly. Here are four. Answer out loud first, then open the answer.",
        ], demo: h("div.demo-stack",
          Book.interviewQuestions(REAL_QUESTIONS),
          h("h3.dbi-group", "Practice questions (not from a report)", h("span", "Common questions for this topic. We wrote them; no company reported them.")),
          Book.interviewQuestions(PRACTICE_QUESTIONS)) }),
        step({ n: "14", title: "In one sentence", lines: [
          "If you remember one thing from this lesson, remember this.",
        ], demo: h("div.dbi-one",
          h("span.label", "In one sentence"),
          h("p", "An index is a shortcut that lets the database skip most of the table. Most are sorted lists (B-tree); others are built for words (GIN), ranges (GiST), huge time-ordered tables (BRIN) or similar vectors. Every index makes writes a little slower, so add only the ones your slow queries need.")),
        links: [L.cmu, L.ddia, L.util] }),
      );
    },
  });
})();
