/* How Sensei reaches Claude. Book.connectClaude() resolves an `ask(input, opts)` function, or null.
   - Opened through the local app (server.mjs): asks Claude Code on this PC, on your subscription.
   - Opened as a plain file, or Claude Code isn't signed in: null, and the book hides every AI control.
   The function matches what ai.js expects: opts { onText({text}), signal, modelTier, images: Blob[] },
   resolves { text, truncated }, and rejects { code, message }. */
(function () {
  const STATUS_TIMEOUT_MS = 6000;
  const fail = (code, message) => Object.assign(new Error(message), { code });

  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(fail("image_rejected", "Couldn't read the screenshot."));
    r.readAsDataURL(blob);
  });

  async function localAsk(input, opts = {}) {
    const images = await Promise.all((opts.images || []).map(async (b) => ({ mediaType: b.type || "image/png", data: await toBase64(b) })));
    let res;
    try {
      res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, modelTier: opts.modelTier, images }),
        signal: opts.signal,
      });
    } catch (e) {
      throw opts.signal?.aborted ? fail("cancelled", "Stopped.") : fail("unavailable", "The Ronin Dojo app isn't running.");
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw fail(body.error?.code || "failed", body.error?.message || "Sensei couldn't answer.");
    }
    // The answer streams as one JSON object per line: {text} … then {done, text} or {error}.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.error) throw Object.assign(fail(msg.error.code, msg.error.message), { text });
          if (typeof msg.text === "string") { text = msg.text; opts.onText?.({ text, delta: "" }); }
          if (msg.done) return { text, truncated: false };
        }
      }
    } catch (e) {
      if (opts.signal?.aborted) throw Object.assign(fail("cancelled", "Stopped."), { text });
      throw e.code ? e : fail("failed", e.message);
    }
    throw Object.assign(fail(opts.signal?.aborted ? "cancelled" : "failed", "The answer stopped early."), { text });
  }
  localAsk.limits = async () => ({ images: { maxCount: 2, mediaTypes: ["image/png", "image/jpeg", "image/webp"] } });

  Book.connectClaude = async () => {
    if (window.claude?.use) return window.claude.use("sample"); // the dev mock (dev/mock.html) plugs in here
    if (!/^https?:$/.test(location.protocol)) return null; // a plain file: no app, no Sensei
    try {
      const res = await fetch("/api/ai/status", { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) });
      const s = res.ok ? await res.json() : null;
      return s?.ok ? localAsk : null;
    } catch {
      return null;
    }
  };
})();
