/* Appearance: System / Light / Dark, like Quiet. Switching reveals the new theme in a circle from the click
   (View Transitions); where that isn't supported it just switches. Fires "dojo:theme" so canvases can redraw. */
(function () {
  const { h, icon, store } = Book;
  const root = document.documentElement;
  const OPTIONS = [
    { key: "system", label: "System", hint: "Follow your device", icon: "monitor" },
    { key: "light", label: "Light", hint: "Light everything", icon: "sun" },
    { key: "dark", label: "Dark", hint: "Dark everything", icon: "moon" },
  ];
  let current = store.get("theme", null);

  function apply(key) {
    if (key === "light" || key === "dark") root.dataset.theme = key;
    else if (key === "system") delete root.dataset.theme;
    window.dispatchEvent(new Event("dojo:theme"));
  }
  if (current) apply(current);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => window.dispatchEvent(new Event("dojo:theme")));

  function choose(key, origin) {
    current = key;
    store.set("theme", key);
    if (!document.startViewTransition || Book.reduced || !origin) return apply(key);
    const t = document.startViewTransition(() => apply(key));
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    t.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 560, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pseudoElement: "::view-transition-new(root)" });
    }).catch(() => {});
  }

  let openMenu = null;
  function close() { openMenu?.remove(); openMenu = null; }
  document.addEventListener("click", (e) => { if (openMenu && !openMenu.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  /* Opens upward from a button near the bottom of the rail. */
  function open(anchor) {
    close();
    const key = current || "system";
    const menu = h("div.menu.up", { role: "menu" },
      h("div.menu-title", "Appearance"),
      OPTIONS.map((o) => {
        const b = h("button", { type: "button", role: "menuitemradio", "aria-checked": String(o.key === key) },
          icon(o.icon),
          h("span.opt-text", h("span.opt-name", o.label), h("span.opt-hint", o.hint)),
          o.key === key && h("span.check", icon("check", 14)));
        b.addEventListener("click", (e) => { close(); choose(o.key, { x: e.clientX, y: e.clientY }); });
        return b;
      }));
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, r.left)}px`;
    menu.style.bottom = `${innerHeight - r.top + 6}px`;
    openMenu = menu;
    menu.querySelector("button[aria-checked='true']")?.focus();
  }

  Book.theme = {
    open,
    label: () => (OPTIONS.find((o) => o.key === (current || "system")) || OPTIONS[0]).label,
  };
})();
