/* Practice parts every lesson ends with (LESSON-SPEC: chapter template).
   - interviewQuestions(): REAL reported questions, each with its source, what it tests, and a model answer.
   - onTheJob(): a realistic work ticket you solve, then compare with how a strong engineer would do it. */
(function () {
  const B = window.Book;
  const { h, icon } = B;

  /* items: [{ q, type, level, source: { company, year, url, label }, testing, answer: string | string[] }] */
  B.interviewQuestions = (items) =>
    h("div.iq", items.map((it, k) => {
      const src = it.source || {};
      const where = [src.company, src.year].filter(Boolean).join(" · ") || src.label || "Reported question";
      const answer = h("div.iq-answer", { hidden: true },
        h("span.label", "A strong answer"),
        (Array.isArray(it.answer) ? it.answer : [it.answer]).map((p) => (typeof p === "string" ? h("p", p) : p)));
      const show = h("button.chip", { type: "button", "aria-expanded": "false" }, "Show a strong answer");
      show.addEventListener("click", () => {
        answer.hidden = !answer.hidden;
        show.setAttribute("aria-expanded", String(!answer.hidden));
        show.textContent = answer.hidden ? "Show a strong answer" : "Hide the answer";
      });
      const practice = h("button.chip", { type: "button", "data-ai": "" }, icon("sparkles", 12), "Answer it with Sensei");
      practice.addEventListener("click", () => {
        if (!B.sensei) return;
        B.sensei.practice?.(it.q, it.testing);
      });
      return h("article.iq-card",
        h("div.iq-top",
          h("span.iq-num.tab", String(k + 1).padStart(2, "0")),
          h("span.chip", it.type || "concept"),
          it.level && h("span.chip", it.level),
          src.url
            ? h("a.iq-src", { href: src.url, target: "_blank", rel: "noopener noreferrer" }, where, icon("chevronRight", 11))
            : h("span.iq-src", where)),
        h("p.iq-q", it.q),
        it.testing && h("p.iq-test", h("b", "What they're really testing: "), it.testing),
        h("div.iq-actions", show, practice),
        answer);
    }));

  /* A work ticket: { id, title, context, symptoms: [], code?, tasks: [], steps: [], lesson? } */
  B.onTheJob = (t) => {
    const steps = h("ol.otj-steps", { hidden: true }, t.steps.map((s) => h("li", s)));
    const reveal = h("button.btn.ghost.sm", { type: "button" }, "Show how a strong engineer solves it");
    reveal.addEventListener("click", () => {
      steps.hidden = !steps.hidden;
      reveal.textContent = steps.hidden ? "Show how a strong engineer solves it" : "Hide the solution";
      if (!steps.hidden) B.animate(steps, [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 300 });
    });
    return h("article.otj",
      h("div.otj-head", h("span.otj-id", t.id || "TICKET"), h("span.chip", "On the job")),
      h("h3.otj-title", t.title),
      h("p.otj-context", t.context),
      t.symptoms && h("div.otj-block", h("span.label", "What you see"), h("ul", t.symptoms.map((s) => h("li", s)))),
      t.code && B.code(t.code),
      t.tasks && h("div.otj-block", h("span.label", "Your task"), h("ul", t.tasks.map((s) => h("li", s)))),
      h("div", reveal),
      steps);
  };
})();
