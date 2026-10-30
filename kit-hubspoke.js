/* hubSpoke(): breadth without drowning (LESSON-SPEC §14). A "you are here" map of every variant,
   then ONE card at a time: the problem it solves, a small picture, when to use it, when NOT to,
   an example, and how often interviews ask about it.
   items: [{ id, name, short, w: "H"|"M"|"L", problem, use, avoid, example?, lang?: "sql"|"js", picture?: () => Node, note? }] */
(function () {
  const B = window.Book;
  const { h, icon } = B;
  const WEIGHT = { H: "Asked often", M: "Asked sometimes", L: "Rarely asked" };

  B.hubSpoke = ({ title, items, start = 0 }) => {
    let k = start;
    const tabs = items.map((it, i) => {
      const b = h("button.hs-tab", { type: "button", role: "tab", "aria-selected": "false" }, h("span.hs-name", it.name), h("span.hs-short", it.short));
      b.addEventListener("click", () => show(i));
      return b;
    });
    const card = h("div.hs-card", { role: "tabpanel", "aria-live": "polite" });
    const prev = h("button.tool", { type: "button", "data-tip": "Previous", "aria-label": "Previous" }, icon("chevronLeft"));
    const next = h("button.tool", { type: "button", "data-tip": "Next", "aria-label": "Next" }, icon("chevronRight"));
    const count = h("span.g-count.tab");
    prev.addEventListener("click", () => show((k - 1 + items.length) % items.length));
    next.addEventListener("click", () => show((k + 1) % items.length));

    function row(label, text) {
      return text ? h("div.hs-row", h("span.label", label), h("p", text)) : null;
    }
    function show(i) {
      k = i;
      tabs.forEach((t, j) => t.setAttribute("aria-selected", String(j === k)));
      // On phones the tabs are one swipeable row: slide the chosen one into view (row only, never the page).
      const map = tabs[k].parentElement;
      if (map && map.scrollWidth > map.clientWidth) map.scrollTo({ left: tabs[k].offsetLeft - map.offsetLeft - 12, behavior: "smooth" });
      const it = items[k];
      card.replaceChildren(
        h("div.hs-card-head", h("h3", it.name), it.w && h("span.chip", WEIGHT[it.w])),
        h("div.hs-body",
          it.picture && h("div.hs-pic", it.picture()),
          h("div.hs-text",
            row("The problem it solves", it.problem),
            row("Use it when", it.use),
            row("Don't use it when", it.avoid),
            it.note && row("Good to know", it.note))),
        it.example && (it.lang === "sql" ? B.sql(it.example) : B.code(it.example)));
      count.textContent = `${k + 1} of ${items.length}`;
      B.animate(card, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
    }
    show(k);
    return h("div.hs",
      h("div.g-head", h("span.g-title", icon("layers", 12), title), h("div.g-ctrl", count, prev, next)),
      h("div.hs-map", { role: "tablist", "aria-label": title }, tabs),
      card);
  };
})();
