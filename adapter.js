/* Won Academy Desk — Supabase adapter.
   The app was built for Claude's artifact runtime (window.claude.use("db"|"user"|"assets"|"downloads")).
   This file provides the same functions on top of Supabase, so the app itself does not change.
   Needs: supabase-js (loaded before this file) and config.js. */
(function () {
  "use strict";
  const CFG = window.WA_CONFIG || {};
  const configured = CFG.SUPABASE_URL && !/YOUR-PROJECT-ID/.test(CFG.SUPABASE_URL) && CFG.SUPABASE_ANON_KEY && !/PASTE-YOUR/.test(CFG.SUPABASE_ANON_KEY);
  const sb = configured ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  window.__sb = sb;

  /* ---------------- login screen ---------------- */
  const css = `#wa-login{position:fixed;inset:0;z-index:9999;background:#F3F5F8;display:flex;align-items:center;justify-content:center;padding:16px;font:15px/1.5 "Public Sans",system-ui,sans-serif;color:#16181d}
  #wa-login .box{background:#fff;border:1px solid #D6DCE6;border-radius:14px;padding:26px 24px;max-width:380px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.06)}
  #wa-login h1{font:700 24px/1.2 "Bricolage Grotesque",system-ui,sans-serif;margin:0 0 4px}
  #wa-login p{margin:6px 0 14px;color:#5b6270}
  #wa-login input{width:100%;box-sizing:border-box;font:inherit;padding:11px 12px;border:1px solid #c9d0db;border-radius:9px;margin-bottom:10px}
  #wa-login button{width:100%;font:600 15px/1 inherit;padding:12px;border:0;border-radius:9px;background:#2f5bd3;color:#fff;cursor:pointer}
  #wa-login button[disabled]{opacity:.6}
  #wa-login .msg{font-size:14px;margin-top:12px}
  #wa-login .ok{color:#1f8a4c}#wa-login .err{color:#b4441f}
  #wa-who{position:fixed;right:10px;bottom:10px;z-index:80;font:12px system-ui,sans-serif;background:#fff;border:1px solid #D6DCE6;border-radius:8px;padding:4px 8px;color:#5b6270}
  #wa-who button{border:0;background:none;color:#2f5bd3;font:inherit;cursor:pointer;padding:0 0 0 6px}`;
  function addCss() { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }

  function showLogin(message) {
    addCss();
    const d = document.createElement("div"); d.id = "wa-login";
    d.innerHTML = `<form class="box"><h1>${(CFG.SCHOOL_NAME || "Won Academy")}</h1>
      <p>Sign in with your email. We'll send you a link — open it on this device and you're in.</p>
      <input type="email" required placeholder="you@example.com" autocomplete="email" aria-label="Email">
      <button type="submit">Send me a sign-in link</button><div class="msg" role="status">${message || ""}</div></form>`;
    const go = () => document.body.appendChild(d);
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
    const f = d.querySelector("form"), msg = d.querySelector(".msg"), btn = d.querySelector("button");
    f.onsubmit = async (e) => {
      e.preventDefault(); const email = f.querySelector("input").value.trim().toLowerCase(); if (!email) return;
      btn.disabled = true; msg.className = "msg"; msg.textContent = "Sending…";
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      if (error) { msg.className = "msg err"; msg.textContent = "Couldn't send the link: " + error.message; }
      else { msg.className = "msg ok"; msg.textContent = "✓ Check your inbox (and spam) for the sign-in link from " + (CFG.SCHOOL_NAME || "Won Academy") + "."; }
    };
  }
  function showWho(email) {
    const go = () => { addCss(); const w = document.createElement("div"); w.id = "wa-who"; w.innerHTML = `${email}<button type="button">Sign out</button>`;
      w.querySelector("button").onclick = async () => { await sb.auth.signOut(); location.reload(); }; document.body.appendChild(w); };
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  }

  /* wait until signed in; never resolves while the login screen is showing */
  const sessionReady = new Promise(async (resolve) => {
    if (!sb) { showLogin('<span class="err">This copy isn\'t set up yet: fill in config.js (README step 4).</span>'); return; }
    const { data } = await sb.auth.getSession();
    if (data && data.session) { resolve(data.session); return; }
    showLogin();
    sb.auth.onAuthStateChange((ev, session) => { if (session) { const l = document.getElementById("wa-login"); if (l) l.remove(); resolve(session); } });
  });

  /* ---------------- database ---------------- */
  const cache = {};          // collection -> Map(id -> data)
  const colSubs = {};        // collection -> Set(fn)
  const docSubs = {};        // "col/id" -> Set(fn)
  const loadedCols = {};     // collection -> Promise
  let channel = null;

  const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
  const rid = () => { const a = "abcdefghijklmnopqrstuvwxyz0123456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(20)); r.forEach((x) => (s += a[x % 36])); return s; };
  const colSnap = (c) => { const m = cache[c] || new Map(); const docs = [...m.entries()].map(([id, v]) => ({ id, data: () => clone(v) })); return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false } }; };
  const docSnap = (c, id) => { const m = cache[c]; const v = m && m.get(id); return { id, exists: v !== undefined, data: () => (v === undefined ? undefined : clone(v)) }; };
  function emit(c, id) {
    (colSubs[c] || new Set()).forEach((fn) => { try { fn(colSnap(c)); } catch (e) { console.error(e); } });
    (docSubs[c + "/" + id] || new Set()).forEach((fn) => { try { fn(docSnap(c, id)); } catch (e) { console.error(e); } });
  }
  function startRealtime() {
    if (channel) return;
    channel = sb.channel("docs-live").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => {
      const row = p.eventType === "DELETE" ? p.old : p.new; if (!row || !row.collection) return;
      const c = row.collection; cache[c] = cache[c] || new Map();
      if (p.eventType === "DELETE") cache[c].delete(row.id); else cache[c].set(row.id, row.data || {});
      emit(c, row.id);
    }).subscribe();
  }
  async function loadCol(c) {
    if (!loadedCols[c]) loadedCols[c] = (async () => {
      await sessionReady; startRealtime();
      const m = new Map(); const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await sb.from("docs").select("id,data").eq("collection", c).range(from, from + page - 1);
        if (error) throw error;
        data.forEach((r) => m.set(r.id, r.data || {}));
        if (data.length < page) break;
      }
      cache[c] = m;
    })();
    return loadedCols[c];
  }
  function err(e) { const x = new Error((e && e.message) || "Database error"); x.code = (e && e.code) || "db_error"; return x; }

  function docRef(c, id) {
    id = id || rid();
    return {
      id,
      onSnapshot(next, onErr) {
        const k = c + "/" + id; (docSubs[k] = docSubs[k] || new Set()).add(next);
        loadCol(c).then(() => next(docSnap(c, id))).catch((e) => onErr && onErr(err(e)));
        return () => docSubs[k].delete(next);
      },
      async get() { await loadCol(c); return docSnap(c, id); },
      async set(v) {
        await sessionReady; const val = clone(v) || {};
        const { error } = await sb.from("docs").upsert({ collection: c, id, data: val, updated_at: new Date().toISOString() });
        if (error) throw err(error);
        (cache[c] = cache[c] || new Map()).set(id, val); emit(c, id);
      },
      async update(v) {
        await sessionReady; const val = clone(v) || {};
        const { error } = await sb.rpc("wa_merge", { p_collection: c, p_id: id, p_patch: val });
        if (error) throw err(error);
        cache[c] = cache[c] || new Map(); cache[c].set(id, Object.assign({}, cache[c].get(id) || {}, val)); emit(c, id);
      },
      async delete() {
        await sessionReady;
        const { error } = await sb.from("docs").delete().eq("collection", c).eq("id", id);
        if (error) throw err(error);
        if (cache[c]) cache[c].delete(id); emit(c, id);
      },
    };
  }
  function colRef(c) {
    const q = {
      onSnapshot(next, onErr) {
        (colSubs[c] = colSubs[c] || new Set()).add(next);
        loadCol(c).then(() => next(colSnap(c))).catch((e) => onErr && onErr(err(e)));
        return () => colSubs[c].delete(next);
      },
      where() { return q; }, orderBy() { return q; }, limit() { return q; },
      doc(id) { return docRef(c, id); },
    };
    return q;
  }
  const db = { collection: colRef, doc(path) { const [c, ...rest] = String(path).split("/"); return docRef(c, rest.join("/")); } };

  /* ---------------- user ---------------- */
  let meCache = null;
  async function me() {
    if (meCache) return meCache;
    const s = await sessionReady; const u = s.user; let owner = false;
    try { const { data } = await sb.rpc("wa_is_owner"); owner = !!data; } catch (e) {}
    const email = (u.email || "").toLowerCase();
    meCache = { id: u.id, email, name: email.split("@")[0], isOwner: owner, canEdit: owner };
    showWho(email);
    return meCache;
  }
  const user = {
    me, id: async () => (await me()).id, isOwner: () => !!(meCache && meCache.isOwner), canEdit: () => !!(meCache && meCache.isOwner),
    can: async () => true, profiles: async (ids) => Object.fromEntries((ids || []).map((i) => [i, { id: i, name: "" }])), search: async () => [],
  };

  /* ---------------- homework files ---------------- */
  const assets = {
    async upload(blob) {
      await sessionReady;
      const type = blob.type || "application/octet-stream";
      const ext = ((blob.name || "").split(".").pop() || type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase() || "bin";
      const path = new Date().toISOString().slice(0, 7) + "/" + rid() + "." + ext;
      const { error } = await sb.storage.from("homework").upload(path, blob, { contentType: type, upsert: false });
      if (error) throw err(error);
      return { id: path, url: window.__assetUrl(path), sizeBytes: blob.size || 0, contentType: type };
    },
    async delete(id) { await sessionReady; const { error } = await sb.storage.from("homework").remove([id]); if (error) throw err(error); },
    async list() { return { assets: [], usage: {} }; },
  };
  window.__assetUrl = (id) => (sb ? sb.storage.from("homework").getPublicUrl(id).data.publicUrl : "#");

  /* ---------------- downloads ---------------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : /\.csv$/.test(filename) ? "text/csv" : "text/plain" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
  };

  /* ---------------- the window.claude shim the app expects ---------------- */
  const ns = { db, user, assets, downloads };
  window.claude = { use: async (name) => { if (!(name in ns)) return null; await sessionReady; if (name === "user") await me(); return ns[name]; } };
})();
