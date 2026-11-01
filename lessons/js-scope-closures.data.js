/* Data and the mini-interpreter for "Scope, hoisting and closures" (the single source of truth for this lesson).
   A program is DATA (a small tree of statements). From that data we make:
     1. real JavaScript source code (what the reader sees AND what dev/js-scope-closures.test.js runs in Node),
     2. a trace: frames with the boxes (scopes), their variables, which function points to which box, the call stack,
        the timer list, the console and a plain-English caption. The films and guided pages are drawn from the trace.
   Model (the spec's idea, simplified): every call, block and loop turn gets a scope (an environment). A scope has a parent:
   the scope where the code was WRITTEN. A function remembers the scope it was created in. A scope is freed when nothing can reach it.
   Hoisting: when a scope starts, every name declared in it is created. var starts as undefined, a function declaration as the
   whole function, and let/const/class start uninitialized (the TDZ) until their line runs.
   Works in the browser (Book.parts["js-scope-closures"].data) and in Node (module.exports). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.Book) {
    root.Book.parts = root.Book.parts || {};
    (root.Book.parts["js-scope-closures"] = root.Book.parts["js-scope-closures"] || {}).data = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /* ---------- 1. Builders: expressions and statements ---------- */
  const N = (v) => ({ t: "num", v });
  const S = (v) => ({ t: "str", v });
  const U = () => ({ t: "undef" });
  const I = (name) => ({ t: "id", name });
  const B = (op, l, r) => ({ t: "bin", op, l, r });
  const F = (params, body, o = {}) => ({ t: "fn", params, body, name: o.name || null, arrow: !!o.arrow, concise: !!o.concise });
  const C = (callee, args = []) => ({ t: "call", callee, args });
  const dk = (kind) => (name, init) => ({ s: "decl", kind, name, init });
  const Var = dk("var"), Let = dk("let"), Const = dk("const");
  const FD = (name, params, body) => ({ s: "fdecl", name, params, body });
  const As = (name, expr) => ({ s: "assign", name, expr });
  const Ret = (expr) => ({ s: "ret", expr });
  const Log = (...args) => ({ s: "log", args });
  const Ex = (expr) => ({ s: "expr", expr });
  const If = (cond, ...body) => ({ s: "if", cond, body });
  const For = (kind, name, init, limit, ...body) => ({ s: "for", kind, name, init, limit, body });
  const Timeout = (cb, ms, ...args) => ({ s: "timeout", cb, ms: ms || 0, args });
  const ops = { N, S, U, I, B, F, C, Var, Let, Const, FD, As, Ret, Log, Ex, If, For, Timeout };

  /* ---------- 2. The printer: program data -> real source code, with a line number for every statement ---------- */
  const IND = "  ";
  const L = (t, ns) => ({ t, ns: ns || [] });
  /* cat(): join strings and line lists; only the first line of a list is glued to the text before it. */
  const cat = (...parts) => {
    const out = [L("")];
    for (const p of parts) {
      if (typeof p === "string") { out[out.length - 1].t += p; continue; }
      p.forEach((ln, k) => {
        if (k === 0) { const last = out[out.length - 1]; last.t += ln.t; last.ns.push(...ln.ns); } else out.push(L(ln.t, [...ln.ns]));
      });
    }
    return out;
  };
  const joinL = (list, sep) => cat(...list.flatMap((x, k) => (k ? [sep, x] : [x])));
  const logL = (args, ind) => cat("console.log(", joinL(args.map((a) => exprL(a, ind)), ", "), ")");
  const inline = (e) => exprL(e, "").map((l) => l.t).join("\n");
  function exprL(e, ind) {
    switch (e.t) {
      case "num": return [L(String(e.v))];
      case "str": return [L(JSON.stringify(e.v))];
      case "undef": return [L("undefined")];
      case "id": return [L(e.name)];
      case "bin": { const w = (x) => (x.t === "bin" && x.op !== e.op ? cat("(", exprL(x, ind), ")") : exprL(x, ind)); return cat(w(e.l), ` ${e.op} `, w(e.r)); }
      case "call": return cat(e.callee.t === "fn" ? cat("(", exprL(e.callee, ind), ")") : exprL(e.callee, ind), "(", joinL(e.args.map((a) => exprL(a, ind)), ", "), ")");
      default: return fnL(e, ind);
    }
  }
  function fnL(e, ind) {
    const ps = e.params.join(", ");
    if (e.concise) {
      const inner = e.body[0];
      const r = cat(`(${ps}) => `, inner.s === "ret" ? exprL(inner.expr, ind) : logL(inner.args, ind));
      r[0].ns.push(inner);
      return r;
    }
    const head = e.arrow ? `(${ps}) => {` : `function${e.name ? " " + e.name : " "}(${ps}) {`;
    return [L(head, [e]), ...e.body.flatMap((s) => stmtL(s, ind + IND)), L(ind + "}")];
  }
  function stmtL(s, ind) {
    const body = (list) => list.flatMap((x) => stmtL(x, ind + IND));
    let r;
    switch (s.s) {
      case "decl": r = cat(ind, `${s.kind} ${s.name}`, s.init ? cat(" = ", exprL(s.init, ind)) : "", ";"); break;
      case "fdecl": r = [L(`${ind}function ${s.name}(${s.params.join(", ")}) {`), ...body(s.body), L(ind + "}")]; break;
      case "assign": r = cat(ind, `${s.name} = `, exprL(s.expr, ind), ";"); break;
      case "ret": r = s.expr ? cat(ind, "return ", exprL(s.expr, ind), ";") : [L(ind + "return;")]; break;
      case "log": r = cat(ind, logL(s.args, ind), ";"); break;
      case "expr": r = cat(ind, exprL(s.expr, ind), ";"); break;
      case "if": r = [L(`${ind}if (${inline(s.cond)}) {`), ...body(s.body), L(ind + "}")]; break;
      case "timeout": r = cat(ind, "setTimeout(", exprL(s.cb, ind), `, ${s.ms}`, ...s.args.flatMap((a) => [", ", exprL(a, ind)]), ");"); break;
      case "for": {
        const head = `for (${s.kind} ${s.name} = ${inline(s.init)}; ${s.name} < ${inline(s.limit)}; ${s.name}++)`;
        r = [L(`${ind}${head} {`), ...body(s.body), L(ind + "}")];
        break;
      }
      default: throw new Error("unknown statement " + s.s);
    }
    r[0].ns.push(s);
    return r;
  }
  function generate(p) {
    const lines = p.ops.flatMap((s) => stmtL(s, ""));
    lines.forEach((ln, k) => ln.ns.forEach((n) => { n.line = k; }));
    return { lines: lines.map((l) => l.t), code: lines.map((l) => l.t).join("\n") };
  }

  /* ---------- 3. The interpreter: runs the program data and records the trace ---------- */
  class JSError extends Error { constructor(name, message) { super(message); this.jsName = name; } }
  const isFn = (v) => v !== null && typeof v === "object" && "node" in v;
  const shown = (v) => (isFn(v) ? "ƒ" + (v.name ? " " + v.name : "") : typeof v === "string" ? JSON.stringify(v) : String(v));
  const plain = (v) => (isFn(v) ? "ƒ" : String(v));
  const q = (n) => "`" + n + "`";

  function declsOf(body, top, out = []) {
    for (const s of body) {
      if (s.s === "decl") { if (s.kind === "var" || top) out.push(s); }
      else if (s.s === "fdecl") { if (top) out.push(s); }
      else if (s.s === "if") declsOf(s.body, false, out);
      else if (s.s === "for") { if (s.kind === "var") out.push({ s: "decl", kind: "var", name: s.name }); declsOf(s.body, false, out); }
    }
    return out;
  }

  function runOnce(p, totals) {
    const gen = generate(p);
    const st = { envs: [], frames: [], out: [], timers: [], stack: [], scopes: [], hold: [], seq: 0, calls: {}, fns: 0, group: { id: 0, title: "Get ready" }, lk: [], made: [], said: {}, line: null, time: 0 };
    const vis = (e) => e.vars.size > 0;
    const visUp = (e) => { while (e && !vis(e)) e = e.parent; return e || null; };
    const vlabel = (e) => (visUp(e) || st.envs[0]).label;
    const tdzErr = (n) => new JSError("ReferenceError", `Cannot access '${n}' before initialization`);

    function newEnv(kind, base, parent) {
      const k = (st.calls[base] = (st.calls[base] || 0) + 1);
      const env = { id: st.envs.length, kind, parent, vars: new Map(), dead: false, hoisted: null, born: st.frames.length };
      env.label = kind === "loop" ? `${base} ${k}` : totals && totals[base] > 1 ? `${base} #${k}` : base;
      st.envs.push(env);
      return env;
    }
    const mkFn = (node, env, name) => { const f = { node, env, name: node.name || name || "", id: ++st.fns }; st.made.push(f); return f; };

    function hoist(env, body, fnLevel) {
      const info = { fns: [], vars: [], dead: [] };
      for (const d of declsOf(body, true)) {
        if (d.s === "fdecl") { if (fnLevel) { env.vars.set(d.name, { kind: "function", tdz: false, value: { node: d, env, name: d.name, id: ++st.fns } }); info.fns.push(d.name); } }
        else if (d.kind === "var") { if (fnLevel && !env.vars.has(d.name)) { env.vars.set(d.name, { kind: "var", tdz: false, value: undefined }); info.vars.push(d.name); } }
        else { env.vars.set(d.name, { kind: d.kind, tdz: true, value: undefined }); info.dead.push(d.name); }
      }
      env.hoisted = info;
    }
    function hoistText(env, what, when = "Before any line runs") {
      const h = env.hoisted;
      if (!h || p.terse) return "";
      const names = (a) => a.map(q).join(", ");
      const parts = [];
      if (h.fns.length) parts.push(`the function ${names(h.fns)} ${h.fns.length > 1 ? "are" : "is"} created with ${h.fns.length > 1 ? "their" : "its"} whole body, ready to call`);
      if (h.vars.length) parts.push(`${names(h.vars)} (a var) ${h.vars.length > 1 ? "are" : "is"} created with the value undefined`);
      if (h.dead.length) parts.push(`${names(h.dead)} ${h.dead.length > 1 ? "are" : "is"} ${parts.length ? "also created" : "created"}, but not initialized yet`);
      if (!parts.length) return "";
      let t = `${when}, JavaScript creates every name declared in ${what}: ${parts.join("; ")}.`;
      if (h.dead.length && !st.said.dead) { t += " Until its line runs, a let or const variable is in the temporal dead zone (TDZ), and reading it throws an error."; st.said.dead = true; }
      return t;
    }

    /* ---- reachability: what can still be reached from the call stack, the scopes in use, held values and timers ---- */
    function reach() {
      const seen = new Set();
      const work = [];
      const mEnv = (e) => { for (; e && !seen.has(e); e = e.parent) { seen.add(e); work.push(e); } };
      const mVal = (v) => { if (isFn(v)) mEnv(v.env); };
      st.stack.forEach(mEnv);
      st.scopes.forEach(mEnv);
      st.hold.forEach(mVal);
      st.timers.forEach((t) => { mVal(t.fn); t.args.forEach(mVal); });
      while (work.length) for (const b of work.pop().vars.values()) mVal(b.value);
      return seen;
    }
    function keeperPhrase(env) {
      const R = reach();
      const names = [];
      const consider = (v, who) => { if (isFn(v)) for (let e = v.env; e; e = e.parent) if (e === env) { names.push(who); break; } };
      st.hold.forEach((v) => consider(v, "the returned function"));
      for (const e of R) if (e !== env) for (const [n, b] of e.vars) consider(b.value, q(n));
      st.timers.forEach((t) => consider(t.fn, "a function in the timer list"));
      return [...new Set(names)].slice(0, 2).join(" and ");
    }
    const freeNote = (list) => {
      const first = !st.said.gc;
      st.said.gc = true;
      return `Nothing points to ${list.map((e) => `the ${e.label} scope`).join(" and ")} any more, so ${list.length > 1 ? "they" : "it"} can be freed${first ? " (the engine does this later; this is called garbage collection)" : ""}.`;
    };

    /* ---- lookups: which boxes were searched for a name ---- */
    function lookup(env, name, write) {
      const path = [];
      for (let e = env; e; e = e.parent) {
        path.push(e.id);
        const b = e.vars.get(name);
        if (b) { st.lk.push({ name, path, found: e.id, write: !!write }); return { b, e }; }
      }
      throw new JSError("ReferenceError", `${name} is not defined`);
    }
    function lookNote() {
      const notes = [];
      const byName = new Map();
      for (const k of st.lk) if (!byName.has(k.name) || k.write) byName.set(k.name, k);
      for (const k of byName.values()) {
        if (k.path.length < 2) continue;
        const chain = k.path.map((id) => st.envs[id]).filter((e, i) => vis(e) || i === 0).map((e) => (vis(e) ? e.label : "empty scope"));
        notes.push(`${k.write ? "Changing" : "Reading"} ${q(k.name)} looks outward: ${chain.join(" → ")} (found).${k.write ? " It changes the real variable." : ""}`);
      }
      return notes.slice(0, 2).join(" ");
    }

    /* ---- snapshots ---- */
    function snap(caption, line, o = {}) {
      const R = reach();
      const freed = [];
      for (const e of st.envs) if (!e.dead && !R.has(e)) { e.dead = true; if (vis(e)) freed.push(e); }
      const look = o.err ? "" : lookNote();
      const looks = st.lk.map((k) => ({ ...k }));
      st.lk = [];
      if (o.optional && !freed.length) return freed;
      const text = [caption.trim(), freed.length ? "" : look, freed.length ? freeNote(freed) : ""].filter(Boolean).join(" ");
      const tgt = (e) => (visUp(e) ? visUp(e).id : null);
      st.frames.push({
        i: st.frames.length, group: st.group, line: line == null ? null : line, caption: text,
        stack: st.stack.map((e) => e.label), out: st.out.length, carry: o.carry || null, looks, freed: freed.map((e) => e.id),
        timers: st.timers.map((t) => ({ name: t.fn.name, to: tgt(t.fn.env), ms: t.ms, args: t.args.map(shown) })),
        envs: st.envs.map((e) => ({ id: e.id, dead: e.dead, vars: [...e.vars].map(([n, b]) => ({ n, k: b.kind, tdz: b.tdz, v: b.tdz ? "not initialized (TDZ)" : shown(b.value), f: isFn(b.value) ? { to: tgt(b.value.env) } : null })) })),
      });
      return freed;
    }

    /* ---- expressions ---- */
    const exprText = (e) => (e.t === "id" ? e.name : inline(e));
    function ev(e, env) {
      switch (e.t) {
        case "num": case "str": return e.v;
        case "undef": return undefined;
        case "id": {
          const { b } = lookup(env, e.name, false);
          if (b.tdz) throw tdzErr(e.name);
          return b.value;
        }
        case "bin": {
          const l = ev(e.l, env), r = ev(e.r, env);
          switch (e.op) { case "+": return l + r; case "-": return l - r; case "*": return l * r; case "<": return l < r; default: return l === r; }
        }
        case "fn": return mkFn(e, env);
        default: { // call
          const f = e.callee.t === "fn" ? mkFn(e.callee, env) : ev(e.callee, env);
          const base = st.hold.length;
          st.hold.push(f);
          const args = e.args.map((a) => { const v = ev(a, env); st.hold.push(v); return v; });
          const name = e.callee.t === "fn" ? "IIFE" : exprText(e.callee);
          if (!isFn(f)) throw new JSError("TypeError", `${name} is not a function`);
          const r = callFn(f, args, name + "()");
          st.hold.length = base;
          return r;
        }
      }
    }

    function callFn(f, args, base, o = {}) {
      const env = newEnv("call", base, f.env);
      f.node.params.forEach((pn, k) => env.vars.set(pn, { kind: "param", tdz: false, value: args[k] }));
      hoist(env, f.node.body, true);
      st.stack.push(env);
      const born = vlabel(f.env);
      let cap = o.fire ? `Timer ${o.fire} calls its function.` : `Calling ${base}.`;
      if (vis(env)) cap += " A new scope is made for this call.";
      cap += ` Its parent scope is the one where the function was written: ${born}.`;
      if (vis(env)) cap += " " + hoistText(env, "this scope", "Before its first line runs");
      snap(cap, f.node.line != null ? f.node.line : st.line);
      let result, retLine = null;
      for (const s of f.node.body) {
        const r = exec(s, env);
        if (r) { result = r.ret; retLine = r.line; break; }
      }
      st.stack.pop();
      st.hold.push(result);
      if (vis(env) || result !== undefined) {
        let end = result === undefined ? `${base} ends.` : `${base} returns ${shown(result)}.`;
        if (vis(env)) {
          const who = reach().has(env) ? keeperPhrase(env) : "";
          if (who) end += ` Its scope stays alive, because ${who} still points to it.`;
        }
        snap(end, retLine != null ? retLine : st.line, { carry: isFn(result) && visUp(result.env) ? { name: result.name, to: visUp(result.env).id } : null });
      } else snap("", st.line, { optional: true });
      st.hold.pop();
      return result;
    }

    /* ---- statements ---- */
    function execBlock(body, parent, intro) {
      const e = newEnv("block", "block", parent);
      hoist(e, body, false);
      st.scopes.push(e);
      if (intro && vis(e)) snap(`This block { } gets its own scope for its let and const variables. ${hoistText(e, "this scope")}`, st.line);
      let r;
      for (const s of body) { r = exec(s, e); if (r) break; }
      st.scopes.pop();
      snap("", r ? r.line : st.line, { optional: true });
      return r;
    }
    function doDecl(s, env) {
      if (!s.init) {
        if (s.kind === "var") return;
        env.vars.get(s.name).tdz = false;
        snap(`This line runs, so ${q(s.name)} is now initialized. It has no value, so it is undefined.`, s.line);
        return;
      }
      st.made = [];
      const v = ev(s.init, env);
      if (isFn(v) && !v.name && s.init.t === "fn") v.name = s.name;
      const b = s.kind === "var" ? lookup(env, s.name, true).b : env.vars.get(s.name);
      b.tdz = false;
      b.value = v;
      const cap = isFn(v)
        ? (s.init.t === "call" ? `${q(s.name)} now holds ${shown(v)}. It still points to the scope where it was created: ${vlabel(v.env)}.` : `${q(s.name)} now holds a new function. It points to the scope where it was created: ${vlabel(v.env)}.`)
        : `${q(s.name)} ${s.kind === "var" ? "(a var) " : ""}gets the value ${shown(v)}.`;
      snap(cap, s.line);
    }
    function exec(s, env) {
      st.line = s.line;
      switch (s.s) {
        case "fdecl": return undefined;
        case "decl": doDecl(s, env); return undefined;
        case "assign": {
          const v = ev(s.expr, env);
          const { b } = lookup(env, s.name, true);
          if (b.tdz) throw tdzErr(s.name);
          if (b.kind === "const") throw new JSError("TypeError", "Assignment to constant variable.");
          b.value = v;
          snap(`${q(s.name)} changes to ${shown(v)}.`, s.line);
          return undefined;
        }
        case "ret": return { ret: s.expr ? ev(s.expr, env) : undefined, line: s.line };
        case "log": {
          const n = st.hold.length;
          const vals = s.args.map((a) => { const v = ev(a, env); st.hold.push(v); return v; });
          st.hold.length = n;
          const text = vals.map(plain).join(" ");
          st.out.push(text);
          snap(`console.log prints ${text}.`, s.line);
          return undefined;
        }
        case "expr": ev(s.expr, env); return undefined;
        case "if": { const c = ev(s.cond, env); st.lk = []; return c ? execBlock(s.body, env, false) : undefined; }
        case "timeout": {
          st.made = [];
          const f = ev(s.cb, env);
          const args = s.args.map((a) => ev(a, env));
          st.timers.push({ fn: f, args, due: st.time + s.ms, seq: ++st.seq, ms: s.ms });
          const again = st.said.timer;
          st.said.timer = true;
          snap((again ? `setTimeout saves one more function. It also points to the scope where it was created: ${vlabel(f.env)}.` : `setTimeout saves ${shown(f)} to run later. The function points to the scope where it was created: ${vlabel(f.env)}.`) + (args.length ? ` It also keeps the value ${args.map(shown).join(", ")}.` : ""), s.line);
          return undefined;
        }
        default: return execFor(s, env);
      }
    }
    function execFor(s, env) {
      const per = s.kind !== "var";
      let turn = 0;
      const mk = (val) => { const e = newEnv("loop", "loop turn", env); e.vars.set(s.name, { kind: s.kind, tdz: false, value: val }); return e; };
      const startVal = ev(s.init, env);
      let cur = env;
      let slot = -1;
      if (per) { cur = mk(startVal); turn = 1; slot = st.scopes.push(cur) - 1; } else lookup(env, s.name, true).b.value = startVal;
      snap(per ? `The loop starts. ${q(s.kind + " " + s.name)} gets its own scope for this turn. ${s.name} is ${startVal}.` : `${q("var " + s.name)} ignores the loop's { } and is one variable for the whole ${env.label === "global" ? "script (the global scope)" : "function " + env.label}. ${s.name} is ${startVal}.`, s.line);
      for (;;) {
        const b = per ? cur.vars.get(s.name) : lookup(env, s.name, false).b;
        const lim = ev(s.limit, env);
        if (!(b.value < lim)) break;
        const r = execBlock(s.body, per ? cur : env, false);
        if (r) return r;
        const next = b.value + 1;
        if (per) {
          cur = mk(b.value);
          cur.vars.get(s.name).value = next;
          st.scopes[slot] = cur;
          snap(`Next turn: JavaScript makes a NEW scope for this turn, copies ${s.name} into it, and adds 1. ${s.name} is now ${next}.`, s.line);
        } else {
          b.value = next;
          snap(`${s.name}++ changes the one variable ${q(s.name)}: it is now ${next}.`, s.line);
        }
      }
      if (per) st.scopes.splice(slot, 1);
      const last = per ? cur.vars.get(s.name).value : lookup(env, s.name, false).b.value;
      snap(per ? "The loop ends." : `${s.name} is ${last}, so ${s.name} < ${inline(s.limit)} is false. The loop ends.`, s.line);
      return undefined;
    }

    /* ---- the run ---- */
    const global = newEnv("global", "global", null);
    hoist(global, p.ops, true);
    st.stack.push(global);
    let error = null;
    const errorText = (e) => {
      const m = e.message;
      const why = /before initialization/.test(m) ? "The variable is still in the TDZ: it exists, but its let or const line has not run yet."
        : /is not defined/.test(m) ? "No scope on the way outward has a variable with this name."
        : /is not a function/.test(m) ? "The name exists, but its value is not a function (here it is undefined)." : "";
      return `${e.jsName}: ${m}. ${why} The script stops here.`.replace("  ", " ");
    };
    try {
      snap(("The script starts. " + (vis(global) ? hoistText(global, "the global scope") : "")).trim(), null);
      p.ops.forEach((s, k) => {
        st.group = { id: k + 1, title: (gen.lines[s.line] || "").trim().slice(0, 46) };
        exec(s, global);
      });
      st.group = { id: 999, title: "The script ends" };
      snap("The script has ended." + (st.timers.length ? " Now the timers run, one after the other." : ""), null);
      let n = 0;
      while (st.timers.length) {
        st.timers.sort((a, b) => a.due - b.due || a.seq - b.seq);
        const t = st.timers.shift();
        st.time = t.due;
        st.group = { id: 1000 + ++n, title: `Timer ${n}: its function runs` };
        st.hold.push(t.fn, ...t.args);
        callFn(t.fn, t.args, "callback", { fire: n });
        st.hold.length = 0;
        snap("", st.line, { optional: true });
      }
    } catch (err) {
      if (!(err instanceof JSError)) throw err;
      error = { name: err.jsName, message: err.message };
      st.group = { id: 998, title: err.jsName };
      snap(errorText(err), st.line, { err: true });
    }
    return {
      id: p.id, title: p.title, lines: gen.lines, code: gen.code, frames: st.frames, console: st.out, error, calls: st.calls,
      envs: st.envs.map((e) => ({ id: e.id, kind: e.kind, label: e.label, parent: e.parent && visUp(e.parent) ? visUp(e.parent).id : null, vis: vis(e), names: [...e.vars.keys()], born: e.born })),
    };
  }
  /* Two passes: the first counts the calls, so the second can name repeated boxes "next() #1", "next() #2". */
  function run(p) { return runOnce(p, runOnce(p, null).calls); }

  /* ---------- 4. Real execution (browser and Node): run source code for real and capture the console ---------- */
  const fmtArg = (v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  async function runCode(code, wait = 30) {
    const logs = [];
    let error = null;
    const fake = { log: (...a) => { logs.push(a.map(fmtArg).join(" ")); } };
    try { new Function("console", code)(fake); } catch (e) { error = { name: e.name, message: e.message }; }
    if (!error && wait) await new Promise((r) => setTimeout(r, wait));
    return { logs, error };
  }
  const timerMs = (p) => { let m = 0; (function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if (x.s === "timeout") m = Math.max(m, x.ms); Object.values(x).forEach(walk); } })(p.ops); return m; };
  const runForReal = (p) => runCode(generate(p).code, 25 + timerMs(p));

  /* ---------- 5. The programs ---------- */
  const makeCounter = (inner) => FD("makeCounter", [], inner || [Let("count", N(0)), Ret(F([], [As("count", B("+", I("count"), N(1))), Ret(I("count"))]))]);
  const arrowLog = (name) => F([], [Log(I(name))], { arrow: true, concise: true });
  const programs = {
    counter: { id: "counter", title: "A counter", terse: true, ops: [makeCounter(), Const("next", C(I("makeCounter"))), Log(C(I("next"))), Log(C(I("next")))],
      chapters: [[(f) => f.i === 0, "makeCounter() runs"], [(f) => /^makeCounter\(\) returns/.test(f.caption), "The scope stays alive"], [(f) => f.group.id === 3, "next() twice"]],
      moral: "A closure is a function plus the scope it was created in. The scope stays alive as long as the function can be reached." },
    twoCounters: { id: "twoCounters", title: "Two counters", ops: [makeCounter(), Const("a", C(I("makeCounter"))), Const("b", C(I("makeCounter"))), Log(C(I("a"))), Log(C(I("a"))), Log(C(I("b")))] },
    sharedCounters: { id: "sharedCounters", title: "Two names, one counter", ops: [makeCounter(), Const("a", C(I("makeCounter"))), Const("b", I("a")), Log(C(I("a"))), Log(C(I("a"))), Log(C(I("b")))] },
    freshCounters: { id: "freshCounters", title: "A counter with no memory", ops: [FD("makeCounter", [], [Ret(F([], [Let("count", N(0)), As("count", B("+", I("count"), N(1))), Ret(I("count"))]))]), Const("a", C(I("makeCounter"))), Const("b", C(I("makeCounter"))), Log(C(I("a"))), Log(C(I("a"))), Log(C(I("b")))] },
    chain: { id: "chain", title: "Scopes inside scopes", ops: [Const("a", S("global")), FD("outer", [], [Const("b", S("outer")), FD("inner", [], [Const("c", S("inner")), Log(I("a"), I("b"), I("c"))]), Ex(C(I("inner")))]), Ex(C(I("outer")))] },
    shadow: { id: "shadow", title: "Same name in two scopes", ops: [Const("x", S("global")), FD("show", [], [Const("x", S("local")), Log(I("x"))]), Ex(C(I("show"))), Log(I("x"))] },
    hoistVar: { id: "hoistVar", title: "Read a var before its line", ops: [Log(I("a")), Var("a", N(5))] },
    hoistLet: { id: "hoistLet", title: "Read a let before its line", ops: [Log(I("a")), Let("a", N(5))] },
    fnDecl: { id: "fnDecl", title: "Call a function declaration early", ops: [Ex(C(I("sayHi"))), FD("sayHi", [], [Log(S("hi"))])] },
    fnExpr: { id: "fnExpr", title: "Call a function stored in a var early", ops: [Ex(C(I("sayHi"))), Var("sayHi", F([], [Log(S("hi"))]))] },
    loopVar: { id: "loopVar", title: "A loop with var", terse: true, ops: [For("var", "i", N(0), N(3), Timeout(arrowLog("i"), 0))],
      chapters: [[(f) => f.i === 0, "var: the loop runs"], [(f) => f.group.id >= 999, "var: the callbacks run"]],
      moral: "With var there is ONE i for the whole loop. All three callbacks point to the same scope, and by the time they run, i is 3." },
    loopLet: { id: "loopLet", title: "A loop with let", terse: true, ops: [For("let", "i", N(0), N(3), Timeout(arrowLog("i"), 0))],
      chapters: [[(f) => f.i === 0, "let: the loop runs"], [(f) => f.group.id >= 999, "let: the callbacks run"]],
      moral: "With let, every turn of the loop gets its own scope. Each callback points to its own scope, so each one remembers its own i." },
    wrongFix: { id: "wrongFix", title: "A fix that does not work", ops: [For("var", "i", N(0), N(3), Var("j", I("i")), Timeout(arrowLog("j"), 0))] },
    fixIife: { id: "fixIife", title: "Fix: a function call for each turn", ops: [For("var", "i", N(0), N(3), Ex(C(F(["j"], [Timeout(arrowLog("j"), 0)]), [I("i")])))] },
    fixArg: { id: "fixArg", title: "Fix: hand i to setTimeout", ops: [For("var", "i", N(0), N(3), Timeout(F(["n"], [Log(I("n"))]), 0, I("i")))] },
    stale: { id: "stale", title: "A stale closure", terse: true, chapters: [[(f) => f.i === 0, "Three renders"], [(f) => f.group.id === 6, "The old handler runs"]], ops: [Let("handler"), FD("render", ["count"], [If(B("===", I("handler"), U()), As("handler", F([], [Log(I("count"))])))]), Ex(C(I("render"), [N(0)])), Ex(C(I("render"), [N(1)])), Ex(C(I("render"), [N(2)])), Ex(C(I("handler")))],
      moral: "The saved function still reads count from the first render's scope. Newer renders made newer scopes, but this old function never looks there." },
    staleFixed: { id: "staleFixed", title: "A fresh closure each render", terse: true, chapters: [[(f) => f.i === 0, "The fix: a new handler each render"], [(f) => f.group.id === 6, "The new handler runs"]], ops: [Let("handler"), FD("render", ["count"], [As("handler", F([], [Log(I("count"))]))]), Ex(C(I("render"), [N(0)])), Ex(C(I("render"), [N(1)])), Ex(C(I("render"), [N(2)])), Ex(C(I("handler")))],
      moral: "Make a new function on every render, and it points to the newest scope. (In React, you do this by putting count in the dependency array.)" },
  };
  /* The questions in the lesson come from these variants: what a wrong mental model would print. */
  const EXPECT = { counter: ["1", "2"], twoCounters: ["1", "2", "1"], sharedCounters: ["1", "2", "3"], freshCounters: ["1", "1", "1"], chain: ["global outer inner"], shadow: ["local", "global"], hoistVar: ["undefined"], fnDecl: ["hi"], loopVar: ["3", "3", "3"], loopLet: ["0", "1", "2"], wrongFix: ["2", "2", "2"], fixIife: ["0", "1", "2"], fixArg: ["0", "1", "2"], stale: ["0"], staleFixed: ["2"] };

  /* ---------- 6. Closures in practice: once, memoize, debounce, curry (reference solutions + harnesses) ---------- */
    /* The typing on the debounce timeline (real timers, small times). */
  const TYPING = { wait: 100, keys: [["h", 0], ["he", 30], ["hel", 60], ["hell", 90], ["hello", 330]], settle: 560 };
  const LIB = {
    once: {
      head: "function once(fn) {\n  let called = false;\n  let result;\n  return function (...args) {\n",
      todo: "    // TODO: call fn only on the FIRST call. Keep its answer for the next calls.\n",
      body: "    if (!called) {\n      called = true;\n      result = fn.apply(this, args);\n    }\n    return result;\n",
      tail: "  };\n}\n",
      harness: `// --- the test (don't edit below)
let calls = 0;
const init = once(() => { calls++; return "ready"; });
const results = [init(), init(), init()];
report("once", { calls, results });`,
      checks: (r) => [
        { label: "fn runs only one time", ok: r.calls === 1, got: `${r.calls} time${r.calls === 1 ? "" : "s"}` },
        { label: "every call returns the first answer", ok: JSON.stringify(r.results) === JSON.stringify(["ready", "ready", "ready"]), got: "[" + r.results.map(String).join(", ") + "]" },
      ],
    },
    memoize: {
      head: "function memoize(fn) {\n  const cache = new Map();\n  return function (arg) {\n",
      todo: "    // TODO: if the cache has arg, return the saved answer.\n    // Otherwise call fn, save the answer, and return it.\n",
      body: "    if (cache.has(arg)) return cache.get(arg);\n    const value = fn(arg);\n    cache.set(arg, value);\n    return value;\n",
      tail: "  };\n}\n",
      harness: `// --- the test (don't edit below)
let calls = 0;
const square = memoize((n) => { calls++; return n * n; });
const out = [square(4), square(5), square(4), square(4), square(5)];
let zeroCalls = 0;
const zero = memoize(() => { zeroCalls++; return 0; });
zero(1); zero(1);
report("memoize", { calls, out, zeroCalls });`,
      checks: (r) => [
        { label: "5 calls cost only 2 real calls", ok: r.calls === 2, got: `${r.calls} real call${r.calls === 1 ? "" : "s"}` },
        { label: "the answers are right", ok: JSON.stringify(r.out) === JSON.stringify([16, 25, 16, 16, 25]), got: JSON.stringify(r.out) },
        { label: "an answer of 0 is saved too", ok: r.zeroCalls === 1, got: `${r.zeroCalls} real call${r.zeroCalls === 1 ? "" : "s"}` },
      ],
    },
    debounce: {
      head: "function debounce(fn, wait) {\n  let timer;\n  return function (...args) {\n",
      todo: "    // TODO: cancel the old timer with clearTimeout(timer).\n    // Then start a new timer that calls fn(...args) after wait ms.\n",
      body: "    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n",
      tail: "  };\n}\n",
      harness: `// --- The test. You don't need to change anything below this line.
const pause = (ms) => new Promise((done) => setTimeout(done, ms)); // waits ms milliseconds
const sent = []; // every search that really runs is saved here
const search = debounce((text) => sent.push(text), 100);

search("h");     // The user types four letters quickly.
search("he");    // Each call comes before the 100 ms are over,
search("hel");   // so it should cancel the call before it.
search("hell");
await pause(200); // The user stops typing for 200 ms.
search("hello");
await pause(200);

report("debounce", { sent });`,
      checks: (r) => [
        { label: "only 2 searches are sent", ok: r.sent.length === 2, got: `${r.sent.length} sent` },
        { label: "the searches are \"hell\" and \"hello\"", ok: JSON.stringify(r.sent) === JSON.stringify(["hell", "hello"]), got: JSON.stringify(r.sent) },
      ],
    },
    curry: {
      head: "function curry(fn) {\n  return function curried(...args) {\n",
      todo: "    // TODO: if we already have enough arguments (fn.length), call fn.\n    // Otherwise return a function that waits for more arguments.\n",
      body: "    if (args.length >= fn.length) return fn(...args);\n    return (...more) => curried(...args, ...more);\n",
      tail: "  };\n}\n",
      harness: `// --- the test (don't edit below)
const add3 = (a, b, c) => a + b + c;
const add = curry(add3);
const attempt = (f) => { try { return f(); } catch { return "error"; } }; // so a half-written curry still reports
report("curry", { all: attempt(() => add(1, 2, 3)), one: attempt(() => add(1)(2)(3)), mixed: attempt(() => add(1, 2)(3)), partial: attempt(() => typeof add(1)) });`,
      checks: (r) => [
        { label: "add(1, 2, 3) gives 6", ok: r.all === 6, got: String(r.all) },
        { label: "add(1)(2)(3) gives 6", ok: r.one === 6, got: String(r.one) },
        { label: "add(1, 2)(3) gives 6", ok: r.mixed === 6, got: String(r.mixed) },
        { label: "add(1) is a function that waits", ok: r.partial === "function", got: String(r.partial) },
      ],
    },
  };
  for (const lib of Object.values(LIB)) {
    lib.solution = lib.head + lib.body + lib.tail;
    lib.starter = lib.head + lib.todo + lib.tail;
    lib.fn = (name) => new Function(`${lib.solution}\nreturn ${name};`)();
  }
  /* The runnable code the reader sees: the function (starter or solution) plus the test harness. */
  const runnableCode = (id, solved) => `${solved ? LIB[id].solution : LIB[id].starter}\n${LIB[id].harness}\n`;
  /* Execute a runnable's code like the page does: report() collects results. */
  async function runRunnable(code) {
    const results = {};
    const logs = [];
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFn("console", "report", code)({ log: (...a) => logs.push(a.map(fmtArg).join(" ")) }, (name, data) => { results[name] = data; });
    return { results, logs };
  }
  /* The typing timeline for the debounce page: the same keystrokes, with and without debounce, on REAL timers. */
  async function runTyping(debounceFn, onSend) {
    const sent = [];
    const t0 = performance.now();
    const search = debounceFn((text) => { const m = { text, at: Math.round(performance.now() - t0) }; sent.push(m); if (onSend) onSend(m, sent.length - 1); }, TYPING.wait);
    for (const [text, at] of TYPING.keys) setTimeout(() => search(text), at);
    await new Promise((r) => setTimeout(r, TYPING.settle));
    return sent;
  }

  /* ---------- 7. Small real snippets (the page runs them live; the test runs them in Node and checks `out` / `error`) ---------- */
  const SNIPPETS = {
    blockScope: { code: "if (true) {\n  var a = 1;\n  let b = 2;\n}\nconsole.log(typeof a, typeof b);", out: ["number undefined"] },
    outsideInner: { code: "function outer() {\n  const c = 1;\n}\nouter();\nconsole.log(c);", error: "ReferenceError", text: /c is not defined/ },
    constAssign: { code: "const k = 1;\ntry { k = 2; } catch (e) { console.log(e.name); }\nconst o = { n: 1 };\no.n = 2;\nconsole.log(o.n);", out: ["TypeError", "2"] },
    liveVar: { code: "let x = 1;\nconst show = () => x;\nx = 2;\nconsole.log(show());", out: ["2"] },
    predict: { code: "console.log(a);\nvar a = 1;\nif (true) {\n  var b = 2;\n  let c = 3;\n}\nconsole.log(b);\nconsole.log(typeof c);", out: ["undefined", "2", "undefined"] },
    redeclareVar: { code: "var x = 1;\nvar x = 2;\nconsole.log(x);", out: ["2"] },
    redeclareLet: { code: "let y = 1;\nlet y = 2;", error: "SyntaxError", text: /already been declared/ },
    trackLogs: { code: "function trackLogs() {\n  const history = [];\n  const original = console.log;\n  console.log = (...args) => {\n    history.push(args.join(\" \"));\n    original(...args);\n  };\n  return () => history.slice();\n}\nconst getHistory = trackLogs();\nconsole.log(\"a\");\nconsole.log(\"b\", \"c\");\nconsole.log(getHistory().length);", out: ["a", "b c", "2"] },
    debounce2: { code: "function debounce(fn, wait) {\n  let timer;\n  let lastArgs;\n  let lastThis;\n  function debounced(...args) {\n    lastArgs = args;\n    lastThis = this;\n    clearTimeout(timer);\n    timer = setTimeout(() => { timer = undefined; fn.apply(this, args); }, wait);\n  }\n  debounced.cancel = () => { clearTimeout(timer); timer = undefined; };\n  debounced.flush = () => {\n    if (timer === undefined) return;\n    clearTimeout(timer);\n    timer = undefined;\n    fn.apply(lastThis, lastArgs);\n  };\n  return debounced;\n}\nconst send = debounce((x) => console.log(\"sent\", x), 50);\nsend(\"a\");\nsend(\"b\");\nsend.flush();\nsend(\"c\");\nsend.cancel();", out: ["sent b"], wait: 150 },
    fnLength: { code: "console.log(((a, b) => 0).length);\nconsole.log(((a, b = 1) => 0).length);\nconsole.log(((...rest) => 0).length);", out: ["2", "1", "0"] },
    tdzTypeof: { code: "console.log(typeof x);\nlet x = 1;", error: "ReferenceError", text: /before initialization/ },
    tdzClass: { code: "new Car();\nclass Car {}", error: "ReferenceError", text: /before initialization/ },
    tdzBlock: { code: "let x = \"outer\";\n{\n  console.log(x); // which x is this?\n  let x = \"inner\";\n}", error: "ReferenceError", text: /before initialization/ },
    tdzTimeEarly: { code: "function show() {\n  return x;\n}\nshow(); // called BEFORE let x runs\nlet x = 1;", error: "ReferenceError", text: /before initialization/ },
    tdzTimeLate: { code: "function show() {\n  return x;\n}\nlet x = 1;\nconsole.log(show()); // AFTER let x ran", out: ["1"] },
    thisDebounce: { code: "function debounce(fn, wait) {\n  let timer;\n  return function debounced(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), wait);\n  };\n}\nconst search = {\n  prefix: \"q=\",\n  send: debounce(function (text) { console.log(this.prefix + text); }, 20),\n};\nsearch.send(\"hi\");", out: ["q=hi"], wait: 80 },
    moduleBank: { code: "const bank = (() => {\n  let balance = 0;\n  return {\n    deposit(n) { balance += n; return balance; },\n    get balance() { return balance; },\n  };\n})();\nconsole.log(bank.deposit(50));\nconsole.log(bank.balance);\nconsole.log(typeof balance);", out: ["50", "50", "undefined"] },
    iterator: { code: "function range(n) {\n  let i = 0;\n  return {\n    next() { return i < n ? { value: i++, done: false } : { done: true }; },\n  };\n}\nconst it = range(2);\nconsole.log(it.next().value, it.next().value, it.next().done);", out: ["0 1 true"] },
    generator: { code: "function* range(n) {\n  for (let i = 0; i < n; i++) yield i;\n}\nconsole.log(Array.from(range(3)).join(\",\"));", out: ["0,1,2"] },
    later: { code: "function later(message, ms) {\n  setTimeout(() => console.log(message), ms);\n}\nlater(\"second\", 40);\nlater(\"first\", 10);", out: ["first", "second"], wait: 90 },
    refPlain: { code: "const sent = [];\nfunction render() {\n  let timer; // a NEW variable on every render\n  return (text) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => sent.push(text), 60);\n  };\n}\nfor (const text of [\"h\", \"he\", \"hel\"]) {\n  const handleSearch = render(); // each key press renders again\n  handleSearch(text);\n  await new Promise((r) => setTimeout(r, 15));\n}\nawait new Promise((r) => setTimeout(r, 120));\nconsole.log(sent.join(\", \"));", out: ["h, he, hel"], async: true },
    refShared: { code: "const sent = [];\nconst ref = { current: undefined }; // one object shared by every render (like useRef)\nfunction render() {\n  return (text) => {\n    clearTimeout(ref.current);\n    ref.current = setTimeout(() => sent.push(text), 60);\n  };\n}\nfor (const text of [\"h\", \"he\", \"hel\"]) {\n  const handleSearch = render(); // each key press renders again\n  handleSearch(text);\n  await new Promise((r) => setTimeout(r, 15));\n}\nawait new Promise((r) => setTimeout(r, 120));\nconsole.log(sent.join(\", \"));", out: ["hel"], async: true },
  };
  async function runSnippet(sn) {
    if (sn.async) {
      const logs = [];
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      try { await new AsyncFn("console", sn.code)({ log: (...a) => logs.push(a.map(fmtArg).join(" ")) }); return { logs, error: null }; } catch (e) { return { logs, error: { name: e.name, message: e.message } }; }
    }
    return runCode(sn.code, sn.wait || 20);
  }

  return { ops, programs, EXPECT, generate, run, runCode, runForReal, LIB, TYPING, runnableCode, runRunnable, runTyping, SNIPPETS, runSnippet, isFn };
});
