/* The book map: the single source of truth for the contents rail, the home page and lesson planning.
   Order comes from the Oct 2026 research (research/*.md): frontend first (most reachable role),
   then full-stack from zero, then your own work, defended.
   Lesson fields: id, title, w (interview weight H/M/L), needs (lesson ids), from (moments from Mina's own
   projects, see research/project-moments.md), q (topic ids in research/interview-questions.md), points.
   A lesson is "built" when lessons/<id>.js registers it. */
window.CURRICULUM = {
  title: "Ronin Dojo",
  version: "v0.3",
  subtitle: "An interview book for Mina · about 500 pages",
  pitch: "You shipped Speako, Anemone and an Awwwards portfolio. Interviews test something else: can you explain why it works, and what you'd do when it breaks? Every lesson teaches with films and visuals, shows the idea inside your own code, gives you a real work ticket, and ends with real interview questions.",
  rules: [
    ["A real problem first", "Every lesson starts from something that breaks or is slow. You guess, then you see why."],
    ["Watch it, then do it", "A film shows how it works. Then you step through it, run the code, and see the result explained."],
    ["Your own code", "Where your projects use the idea, you see the real code from Anemone, your portfolio or Speako."],
    ["Practice like the job", "An “On the job” ticket, then real interview questions with their source. Answer out loud, or let Sensei grade you."],
  ],
  weeks: [
    /* ======================= Phase 1: mid/senior frontend ======================= */
    { n: 1, phase: "Frontend", label: "A · Week 1", short: "JavaScript", title: "JavaScript core", goal: "Closures, this, the event loop and async. The base of every “predict the output” question.", lessons: [
      { id: "js-scope-closures", title: "Scope, hoisting and closures", w: "H", q: ["closures-scope"], points: ["Which variables a function keeps alive, as a film", "The var-in-a-loop timer bug, and three fixes", "Closures inside debounce, memoize and curry"] },
      { id: "js-this-prototypes", title: "this, prototypes and classes", w: "H", needs: ["js-scope-closures"], q: ["this-prototypes"], points: ["Where `this` points in six call styles", "The prototype chain behind class and extends", "Write bind and Array.prototype.map yourself"] },
      { id: "event-loop", title: "The event loop", w: "H", hook: "Why your page freezes, and the exact order JavaScript runs things in. The #1 “predict the output” topic.", needs: ["js-scope-closures"], from: ["Anemone: one rAF loop drives the whole film (main.js)", "Anemone: audio scheduler that looks ahead of a throttled timer"], q: ["event-loop"], points: ["Call stack, microtasks and tasks, as a film", "Predict the output, then run it", "Why a long task freezes the page"] },
      { id: "js-async", title: "Promises, async/await and concurrency", w: "H", needs: ["event-loop"], from: ["Speako: optimistic seat booking with rollback"], q: ["async-promises"], points: ["Write Promise.all and retry with backoff", "Latest result wins: cancel stale requests"] },
      { id: "js-values-modules", title: "Values, equality and modules", w: "M", q: ["closures-scope"], points: ["== vs ===, coercion, shallow vs deep copy", "ES modules vs CommonJS, and why tree-shaking needs ESM"] },
    ] },
    { n: 2, phase: "Frontend", label: "B · Week 1", short: "TypeScript", title: "TypeScript", goal: "Types that catch bugs: narrowing, generics, and typing React.", lessons: [
      { id: "ts-narrowing", title: "Types, unions and narrowing", w: "H", needs: ["js-values-modules"], q: ["ts-types"], points: ["unknown vs any, and type guards", "Discriminated unions for loading, error and data states"] },
      { id: "ts-generics", title: "Generics and utility types", w: "H", needs: ["ts-narrowing"], q: ["ts-types"], points: ["Watch a type flow through a generic function", "Build Pick, Partial and ReturnType yourself"] },
    ] },
    { n: 3, phase: "Frontend", label: "C · Week 2", short: "Browser", title: "How the browser works", goal: "DOM, rendering, HTTP, real-time and security: what every performance and system-design answer stands on.", lessons: [
      { id: "dom-events", title: "DOM and events", w: "H", needs: ["event-loop"], from: ["Speako: iPad has no HTML5 drag, so a touch bus finds the drop target"], q: ["dom-events"], points: ["Capture, target and bubble, as a film", "Event delegation, and building hold-to-play keys"] },
      { id: "render-pipeline", title: "Style, layout, paint, composite", w: "H", needs: ["dom-events"], from: ["Portfolio: a CSS variable written every frame restyled 15 nodes"], q: ["browser-rendering"], points: ["Animate top vs transform and watch which stages re-run", "Layout thrashing in a loop"] },
      { id: "http-caching", title: "HTTP and caching", w: "H", q: ["http-caching-cors"], points: ["What happens when you type a URL, as a film", "Cache-Control, ETag, and CDN hits and misses"] },
      { id: "network-realtime", title: "fetch, cancel, SSE, WebSockets and storage", w: "M", needs: ["js-async", "http-caching"], q: ["http-caching-cors"], points: ["The “lap” vs “laptop” bug and AbortController", "Polling vs SSE vs WebSocket on one timeline", "Cookies, localStorage, IndexedDB: which one when"] },
      { id: "web-security", title: "Web security: CORS, XSS, CSRF, CSP", w: "H", needs: ["http-caching"], q: ["web-security"], points: ["The CORS preflight as a conversation", "Inject a script, then block it"] },
    ] },
    { n: 4, phase: "Frontend", label: "D · Week 3", short: "CSS", title: "CSS that behaves", goal: "Cascade, stacking, Flexbox, Grid and responsive layout.", lessons: [
      { id: "css-cascade", title: "Cascade, box model and stacking", w: "H", q: ["css-layout"], points: ["Specificity as a film: why your style doesn't apply", "Stacking contexts: why z-index: 9999 fails"] },
      { id: "css-layout", title: "Flexbox and Grid", w: "H", needs: ["css-cascade"], q: ["css-layout"], points: ["Flex axes and grow/shrink you can drag", "Grid areas, and when to choose each"] },
      { id: "css-responsive-motion", title: "Responsive design and CSS motion", w: "M", needs: ["css-layout", "render-pipeline"], from: ["Anemone: 100lvh to stop the mobile address-bar jump"], q: ["css-layout"], points: ["Container queries vs media queries", "Transitions that stay on the compositor"] },
    ] },
    { n: 5, phase: "Frontend", label: "E · Week 3", short: "Accessibility", title: "Accessibility", goal: "Semantics first, then ARIA, then keyboard patterns: exactly what machine-coding rounds check.", lessons: [
      { id: "a11y-semantics", title: "Semantics, names, roles and ARIA", w: "H", q: ["accessibility"], points: ["What a screen reader really hears", "The first rule of ARIA: don't use it if HTML can"] },
      { id: "a11y-keyboard", title: "Keyboard, focus and accessible patterns", w: "H", needs: ["a11y-semantics", "dom-events"], from: ["Anemone: handwritten glyphs with the real text in aria-label; reduced motion"], q: ["accessibility"], points: ["Focus trap, roving tabindex, Escape", "Dialog, tabs and combobox, done right"] },
    ] },
    { n: 6, phase: "Frontend", label: "F · Week 4", short: "React", title: "React under the hood", goal: "State as a snapshot, reconciliation, effects and state architecture.", lessons: [
      { id: "react-state", title: "Components and state as a snapshot", w: "H", needs: ["js-scope-closures"], q: ["react-state"], points: ["Why setCount(count + 1) three times adds 1", "Immutable updates you can see"] },
      { id: "react-render", title: "Render, commit and reconciliation", w: "H", needs: ["react-state"], from: ["Mina Rich Editor: structural sharing, so only the edited block re-renders"], q: ["react-rendering"], points: ["A live tree that flashes what re-renders", "Keys: break a list on purpose"] },
      { id: "react-effects", title: "Effects, and when you don't need one", w: "H", needs: ["react-render", "js-async"], from: ["Portfolio: IntersectionObserver parks offscreen render loops"], q: ["react-hooks"], points: ["Stale closures and dependency arrays", "Cleanup: timers, subscriptions, races"] },
      { id: "react-architecture", title: "Custom hooks, context and where state lives", w: "H", needs: ["react-effects"], from: ["Speako floor plan: a zustand store with undo (zundo) and one-gesture history"], q: ["react-state"], points: ["Server vs client vs URL state", "Undo/redo: snapshots vs patches"] },
      { id: "react-performance", title: "Re-render control: memo, transitions, Compiler", w: "M", needs: ["react-architecture"], from: ["Speako: narrow selectors + useShallow + memo per shape"], q: ["react-rendering"], points: ["When memo helps and when it hurts", "useTransition and Suspense, as a timeline"] },
      { id: "ts-react", title: "TypeScript with React, and data at the edges", w: "M", needs: ["ts-generics", "react-performance"], from: ["Speako: cva button variants over design tokens"], q: ["ts-types"], points: ["Typing props, events, hooks and polymorphic components", "Zod: one schema for the type and the runtime check"] },
    ] },
    { n: 7, phase: "Frontend", label: "G · Week 5", short: "Next.js", title: "Next.js and Server Components", goal: "The client boundary, caching layers and rendering strategies.", lessons: [
      { id: "rsc-boundary", title: "Server and Client Components", w: "H", needs: ["react-architecture", "http-caching"], q: ["nextjs-rsc"], points: ["Split one page and count the JS you ship", "What can cross the 'use client' line"] },
      { id: "next-data", title: "Data fetching, caching and Server Actions", w: "H", needs: ["rsc-boundary"], from: ["Speako: React Query optimistic seat booking"], q: ["nextjs-rsc", "react-state"], points: ["The cache layers, as a film", "Mutations, revalidation and optimistic UI"] },
      { id: "next-rendering", title: "SSR, SSG, ISR, streaming and hydration", w: "H", needs: ["next-data", "render-pipeline"], from: ["Speako: 301 vs 410 redirects, sitemap and JSON-LD"], q: ["nextjs-rsc", "browser-rendering"], points: ["Pick a strategy per page", "Make a hydration error, then fix it"] },
    ] },
    { n: 8, phase: "Frontend", label: "H · Week 5", short: "Testing", title: "Testing and tooling", goal: "Tests you can defend, and the build tools under your app.", lessons: [
      { id: "testing-strategy", title: "What to test, and Testing Library", w: "H", needs: ["react-effects", "a11y-semantics"], q: ["testing"], points: ["The testing trophy you can rearrange", "Query by role, like a user"] },
      { id: "testing-network-e2e", title: "Mock the network, and E2E with Playwright", w: "M", needs: ["testing-strategy", "network-realtime"], from: ["Speako: Playwright scripts that validate the landing page"], q: ["testing"], points: ["MSW, fake timers, out-of-order responses", "Why tests flake, and how to stop it"] },
      { id: "build-tools", title: "Bundlers, code splitting and tree-shaking", w: "M", needs: ["js-values-modules"], from: ["Anemone: a Vite plugin inlines the loader so it paints at 0 ms"], q: ["build-tooling"], points: ["A bundle treemap you can split", "How one import pulls in a whole library"] },
    ] },
    { n: 9, phase: "Frontend", label: "I · Week 6", short: "Performance", title: "Web performance", goal: "Core Web Vitals by feel, and fixing LCP, INP and CLS.", lessons: [
      { id: "web-vitals", title: "Core Web Vitals: LCP, INP, CLS", w: "H", needs: ["render-pipeline"], q: ["web-performance"], points: ["A page you make worse with toggles, live vitals", "Lab vs field data"] },
      { id: "loading-perf", title: "Critical path, images and fonts", w: "H", needs: ["web-vitals", "http-caching"], from: ["Speako landing: videos load only near the viewport"], q: ["web-performance", "browser-rendering"], points: ["The waterfall, as a film", "Preload, lazy load, priorities"] },
      { id: "js-cost-inp", title: "Long tasks, INP and workers", w: "H", needs: ["web-vitals", "event-loop"], from: ["Portfolio: the shader compile stall hidden under the preloader"], q: ["web-performance"], points: ["Break up a long task and watch INP drop", "Move work to a worker"] },
      { id: "list-perf", title: "Huge lists and virtualization", w: "H", needs: ["react-performance", "js-cost-inp"], q: ["web-performance", "react-rendering"], points: ["10,000 rows: a DOM counter, then windowing", "Apple's “ten million records” question"] },
    ] },
    { n: 10, phase: "Frontend", label: "J · Week 7", short: "Machine coding", title: "The machine-coding round", goal: "Build working, accessible components in 45–60 minutes.", lessons: [
      { id: "mc-playbook", title: "The 45-minute playbook and JS utilities", w: "H", needs: ["js-async", "react-effects"], q: ["machine-coding", "closures-scope"], points: ["Clarify, scaffold, accessibility pass, edge cases, on a timer", "Debounce, throttle, Promise.all and an event emitter"] },
      { id: "mc-components", title: "Build: autocomplete, dropdown, modal", w: "H", needs: ["mc-playbook", "a11y-keyboard"], q: ["machine-coding", "accessibility"], points: ["Waymo's autocomplete with a hand-written debounce", "Coinbase's reusable dropdown"] },
      { id: "mc-data-ui", title: "Build: infinite scroll, table, kanban", w: "H", needs: ["mc-components", "list-perf"], from: ["Speako scheduler: drag and drop with optimistic moves"], q: ["machine-coding", "react-state"], points: ["Select-all on an infinite list", "A kanban board with keyboard moves"] },
    ] },
    { n: 11, phase: "Frontend", label: "K · Week 8", short: "FE design", title: "Frontend system design and behavioral", goal: "RADIO, real design prompts, and defending your work.", lessons: [
      { id: "fe-sd-method", title: "The RADIO method", w: "H", needs: ["next-rendering", "loading-perf"], q: ["fe-system-design"], points: ["Requirements, architecture, data, interface, optimizations, on a clock"] },
      { id: "fe-sd-search", title: "Design: a fast search page", w: "H", needs: ["fe-sd-method", "network-realtime"], q: ["fe-system-design", "web-performance"], points: ["Atlassian's unbounded catalog search, Oct 2026", "Stale results, URL state, real-user metrics"] },
      { id: "fe-sd-realtime", title: "Design: streaming chat, comments and notifications", w: "H", needs: ["fe-sd-method"], q: ["fe-system-design"], points: ["Waymo's streaming AI chat", "Cohere's optimistic comments, Roblox's notifications"] },
      { id: "behavioral", title: "Behavioral: stories that win offers", w: "H", q: ["behavioral-frontend"], points: ["STAR stories from Speako, Anemone and ZVNDEV", "What you built vs what was AI-assisted, said with confidence"] },
    ] },
    { n: 12, phase: "Frontend", label: "L · Weekends", short: "Motion & WebGL", title: "Motion and WebGL (your edge)", goal: "Explain your Awwwards work like an engineer.", lessons: [
      { id: "motion-raf", title: "rAF, compositing and FLIP", w: "M", needs: ["render-pipeline"], from: ["Anemone: scroll mapped to per-section progress in one loop"], q: ["animation-webgl", "browser-rendering"], points: ["Scroll-driven animation without a library", "FLIP: animate layout changes cheaply"] },
      { id: "motion-gsap", title: "GSAP timelines, ScrollTrigger and Lenis", w: "M", needs: ["motion-raf", "react-effects"], from: ["Portfolio: Lenis driven by gsap.ticker", "Portfolio: the sword chases scroll with quickTo"], q: ["animation-webgl"], points: ["One clock for scroll and animation", "Cleanup with gsap.context / useGSAP"] },
      { id: "webgl-shaders", title: "The GPU pipeline and shaders from zero", w: "M", needs: ["motion-raf"], from: ["Portfolio: baked tileable noise texture", "Anemone: scene transitions in one full-screen shader"], q: ["animation-webgl"], points: ["Vertices to pixels, one stage at a time", "Write a fragment shader by hand"] },
      { id: "webgl-perf", title: "Three.js and GPU performance", w: "M", needs: ["webgl-shaders"], from: ["Anemone: frame-time ladder that lowers resolution", "Anemone: depth pre-pass that skips hidden pixels"], q: ["animation-webgl", "web-performance"], points: ["Draw calls, overdraw, DPR and device tiers", "Dispose what you create"] },
    ] },

    /* ======================= Phase 2: full-stack from zero ======================= */
    { n: 13, phase: "Full-stack", label: "S · Week 9", short: "Server", title: "Backend from zero", goal: "No backend knowledge assumed: what a server is, Node, and a real API.", lessons: [
      { id: "what-is-a-server", title: "What a server really is", w: "M", points: ["A process, a port and localhost, as a picture", "Follow one request to the database and back"] },
      { id: "node-runtime", title: "Node's runtime and your first API", w: "H", needs: ["what-is-a-server", "event-loop"], q: ["api-design"], points: ["One thread, many requests: watch a CPU task block everyone", "From raw http to Express"] },
      { id: "api-design", title: "Designing a REST API", w: "H", needs: ["node-runtime", "http-caching"], q: ["api-design"], points: ["Cursor vs offset pagination on a changing list", "Idempotency keys: press Pay twice"] },
    ] },
    { n: 14, phase: "Full-stack", label: "Q · Week 9", short: "SQL", title: "SQL and data modeling", goal: "From your first SELECT to a schema you can defend.", lessons: [
      { id: "sql-basics", title: "SQL from zero", w: "H", needs: ["what-is-a-server"], q: ["databases-indexing"], points: ["SELECT, WHERE, ORDER BY with a table you can see", "NULL logic and constraints"] },
      { id: "sql-modeling", title: "Modeling and joins", w: "H", needs: ["sql-basics"], from: ["Speako: customers, tables, slots and bookings"], q: ["databases-indexing"], points: ["1:N and N:M as diagrams", "JOIN types as overlapping sets you drag"] },
      { id: "sql-aggregates", title: "Aggregates and window functions", w: "M", needs: ["sql-modeling"], q: ["databases-indexing"], points: ["GROUP BY, HAVING", "Window functions for “top 3 per group”"] },
    ] },
    { n: 15, phase: "Full-stack", label: "P · Week 10", short: "Query speed", title: "Query performance", goal: "Every index type, reading query plans, and the N+1 trap.", lessons: [
      { id: "db-indexing", title: "Database indexing", w: "H", needs: ["sql-basics"], q: ["databases-indexing"], hook: "How one line of SQL makes a search thousands of times faster. And every index type you'll be asked about.", points: ["Spine: one query from full scan to B-tree", "Map of every type: B-tree, hash, composite, covering, partial, expression, unique, GIN, GiST, BRIN, vector", "B-tree vs LSM tree (DDIA ch. 4)"] },
      { id: "query-plans", title: "EXPLAIN, N+1 and pagination", w: "H", needs: ["db-indexing", "sql-modeling"], q: ["databases-indexing", "api-design"], points: ["Read a query plan like a map", "101 queries for one page, then one", "Keyset vs offset pagination"] },
    ] },
    { n: 16, phase: "Full-stack", label: "T · Week 10", short: "Transactions", title: "Transactions and change", goal: "Correct data under concurrency, and safe schema changes.", lessons: [
      { id: "transactions", title: "Transactions and isolation", w: "H", needs: ["sql-modeling"], from: ["Speako: booking conflicts mirror a database EXCLUDE constraint"], q: ["databases-indexing", "system-design-fullstack"], points: ["Two people book the last table at once", "Isolation levels and anomalies, replayed (DDIA ch. 8)"] },
      { id: "concurrency-migrations", title: "Locks, idempotency and safe migrations", w: "H", needs: ["transactions", "api-design"], q: ["api-design"], points: ["Row locks vs unique constraints vs optimistic locking", "Expand and contract: zero-downtime migrations"] },
    ] },
    { n: 17, phase: "Full-stack", label: "U · Week 11", short: "Auth", title: "Auth and backend security", goal: "Sessions vs JWT, OAuth, and the OWASP basics.", lessons: [
      { id: "auth", title: "Sessions, JWT and OAuth", w: "H", needs: ["api-design", "web-security"], q: ["web-security"], points: ["Follow a login through sessions vs JWT", "OAuth code flow with PKCE, step by step"] },
      { id: "backend-security", title: "OWASP and rate limiting", w: "H", needs: ["auth"], q: ["web-security"], points: ["SQL injection, then the fix", "A token bucket you can spam"] },
    ] },
    { n: 18, phase: "Full-stack", label: "R · Week 11", short: "Cache & queues", title: "Caching and async work", goal: "Redis, invalidation and background jobs.", lessons: [
      { id: "caching-redis", title: "Caching with Redis", w: "H", needs: ["api-design"], q: ["system-design-fullstack"], points: ["Cache-aside, TTL, and the stampede", "Invalidation: the hard part"] },
      { id: "queues", title: "Queues and background jobs", w: "H", needs: ["caching-redis", "concurrency-migrations"], q: ["system-design-fullstack"], points: ["Move slow work out of the request", "Retries, dead-letter queues, idempotent consumers"] },
    ] },
    { n: 19, phase: "Full-stack", label: "X · Week 11", short: "Distributed data", title: "Data-intensive systems (DDIA)", goal: "Storage engines, replication, sharding and consistency, from Designing Data-Intensive Applications.", lessons: [
      { id: "storage-engines", title: "Storage engines: B-tree vs LSM", w: "M", needs: ["db-indexing"], q: ["databases-indexing"], points: ["Write-ahead log, SSTables and compaction (DDIA ch. 4)"] },
      { id: "replication", title: "Replication and lag", w: "H", needs: ["transactions"], q: ["system-design-fullstack"], points: ["Leader and followers, read-your-writes (DDIA ch. 6)"] },
      { id: "sharding", title: "Sharding and consistent hashing", w: "H", needs: ["replication"], q: ["system-design-fullstack"], points: ["Range vs hash, hot keys, rebalancing (DDIA ch. 7)"] },
      { id: "consistency", title: "Consistency, CAP and consensus", w: "M", needs: ["sharding"], q: ["system-design-fullstack"], points: ["Linearizability vs eventual consistency, Raft in one picture (DDIA ch. 9–10)"] },
    ] },
    { n: 20, phase: "Full-stack", label: "O · Week 12", short: "Ship it", title: "Ship and operate", goal: "Containers, pipelines, the cloud, and seeing what's wrong in production.", lessons: [
      { id: "docker", title: "Docker and Compose", w: "H", needs: ["node-runtime"], points: ["Image vs container, layers and the cache", "App + Postgres + Redis with one command"] },
      { id: "ci-cd-cloud", title: "CI/CD and deploying to the cloud", w: "H", needs: ["docker", "testing-strategy"], points: ["A GitHub Actions pipeline, block by block", "Blue/green and canary as traffic you shift"] },
      { id: "k8s-observability", title: "Kubernetes basics and observability", w: "M", needs: ["ci-cd-cloud"], points: ["Kill a pod, watch it come back", "Logs, metrics, traces; p50 vs p99"] },
    ] },
    { n: 21, phase: "Full-stack", label: "Y · Week 12", short: "System design", title: "System design", goal: "A method, the building blocks, the classics, and your own product.", lessons: [
      { id: "sd-method", title: "The method and back-of-envelope math", w: "H", needs: ["caching-redis", "replication"], q: ["system-design-fullstack"], points: ["Requirements, numbers, API, data, scale, on a timer"] },
      { id: "sd-building-blocks", title: "Load balancers, CDNs, caches and queues", w: "H", needs: ["sd-method", "queues"], q: ["system-design-fullstack"], points: ["Add servers and watch traffic spread"] },
      { id: "sd-classics", title: "Design: URL shortener and rate limiter", w: "H", needs: ["sd-building-blocks", "sharding"], q: ["system-design-fullstack"], points: ["The two most common warm-ups, fully interactive"] },
      { id: "sd-booking", title: "Design: a booking system", w: "H", needs: ["sd-classics", "transactions"], from: ["Speako: availability, holds, double booking, time zones"], q: ["system-design-fullstack"], points: ["Uber's calendar service prompt, May 2026", "Your own product, defended"] },
    ] },

    /* ======================= Phase 3: your work, defended ======================= */
    { n: 22, phase: "Your work", label: "Z · Final", short: "Defend it", title: "Your work, defended", goal: "Each project explained from its real source code, then full mock interviews.", lessons: [
      { id: "case-anemone", title: "Anemone, explained from its source", w: "H", needs: ["motion-raf", "webgl-perf"], from: ["Scroll-to-progress loop, scene-transition shader, adaptive resolution, replay ring buffer"], q: ["animation-webgl", "behavioral-frontend"], points: ["Every system as a film over the real code", "What you built, what was generated, what you'd change"] },
      { id: "case-portfolio", title: "mina-massoud.com, explained", w: "H", needs: ["motion-gsap", "webgl-shaders"], from: ["Baked noise, device tiers, compile-stall hiding, Lenis + ScrollTrigger sync"], q: ["animation-webgl", "web-performance"], points: ["The Awwwards site as an engineering story", "Measured vs estimated numbers"] },
      { id: "case-speako", title: "Speako's floor plan and scheduler", w: "H", needs: ["react-architecture", "transactions"], from: ["Zoom-to-cursor math, rotated resize, one-gesture undo, optimistic bookings"], q: ["react-state", "fe-system-design"], points: ["SVG geometry you can explain on a whiteboard", "Which parts you own, said clearly"] },
      { id: "case-collab", title: "Real-time collaboration (Wiscord)", w: "M", needs: ["network-realtime"], from: ["Wiscord: Yjs + Hocuspocus notes (confirm authorship first)"], q: ["fe-system-design"], points: ["Two editors typing at once: how a CRDT merges"] },
      { id: "mock-frontend", title: "Mock interview: mid/senior frontend", w: "H", needs: ["fe-sd-search", "mc-data-ui"], q: ["machine-coding", "fe-system-design", "behavioral-frontend"], points: ["Timed rounds; Sensei plays the interviewer and grades you"] },
      { id: "mock-fullstack", title: "Mock interview: full-stack", w: "H", needs: ["sd-booking"], q: ["system-design-fullstack", "api-design"], points: ["API, database and system design rounds, timed"] },
    ] },
  ],
};
