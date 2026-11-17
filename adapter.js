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

  /* sign-in screen in English, Korean or Czech (remembers the choice made in the app) */
  const TX = {
    en: { intro: "Sign in with your email. We'll email you a sign-in code (and a link).", send: "Send me a sign-in code", typeCode: "Type the code from the email here:", signIn: "Sign in",
      bad: "Please check your email address — it looks incomplete (for example, …@gmail.com).", sending: "Sending…", noSend: "Couldn't send the email: ", sent: (n) => "✓ Email sent from " + n + " (check spam too).", again: "Send a new code",
      whole: "Please type the whole code.", checking: "Checking…", wrong: "That code didn't work. Check it, or send a new code. ", email: "Email", code: "Sign-in code" },
    ko: { intro: "이메일로 로그인하세요. 로그인 코드(와 링크)를 이메일로 보내 드려요.", send: "로그인 코드 받기", typeCode: "이메일로 받은 코드를 여기에 입력하세요:", signIn: "로그인",
      bad: "이메일 주소를 확인해 주세요 — 완전하지 않은 것 같아요 (예: …@gmail.com).", sending: "보내는 중…", noSend: "이메일을 보내지 못했어요: ", sent: (n) => "✓ " + n + "에서 이메일을 보냈어요 (스팸함도 확인하세요).", again: "새 코드 받기",
      whole: "코드를 모두 입력해 주세요.", checking: "확인 중…", wrong: "코드가 맞지 않아요. 다시 확인하거나 새 코드를 받으세요. ", email: "이메일", code: "로그인 코드" },
    cs: { intro: "Přihlaste se e-mailem. Pošleme vám přihlašovací kód (a odkaz).", send: "Poslat přihlašovací kód", typeCode: "Sem napište kód z e-mailu:", signIn: "Přihlásit se",
      bad: "Zkontrolujte prosím e-mailovou adresu — zdá se neúplná (například …@gmail.com).", sending: "Odesílám…", noSend: "E-mail se nepodařilo odeslat: ", sent: (n) => "✓ E-mail od " + n + " odeslán (zkontrolujte i spam).", again: "Poslat nový kód",
      whole: "Napište prosím celý kód.", checking: "Ověřuji…", wrong: "Kód nefunguje. Zkontrolujte ho, nebo si pošlete nový. ", email: "E-mail", code: "Přihlašovací kód" },
  };
  const LNG = (() => { try { const v = localStorage.getItem("wa_lang"); if (v && TX[v]) return v; } catch (e) {} const n = (navigator.language || "").slice(0, 2).toLowerCase(); return TX[n] ? n : "en"; })();
  const LT = TX[LNG];
  function showLogin(message) {
    addCss();
    const d = document.createElement("div"); d.id = "wa-login";
    const name = CFG.SCHOOL_NAME || "Won Academy";
    d.innerHTML = `<form class="box"><h1>${name}</h1>
      <p>${LT.intro}</p>
      <input type="email" required placeholder="you@example.com" autocomplete="email" aria-label="${LT.email}">
      <button type="submit">${LT.send}</button><div class="msg" role="status">${message || ""}</div>
      <div class="code" hidden><p style="margin-top:16px">${LT.typeCode}</p>
      <input type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" aria-label="${LT.code}" maxlength="10">
      <button type="button" class="vbtn">${LT.signIn}</button><div class="msg vmsg" role="status"></div></div>
      <p class="langs" style="margin:18px 0 0;font-size:13px;color:#5b6270">${[["en", "English"], ["ko", "한국어"], ["cs", "Čeština"]].map(([k, l]) => k === LNG ? `<b>${l}</b>` : `<a href="#" data-l="${k}" style="color:#2f5bd3">${l}</a>`).join(" · ")}</p></form>`;
    const go = () => document.body.appendChild(d);
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
    d.querySelectorAll("[data-l]").forEach((a) => a.onclick = (e) => { e.preventDefault(); try { localStorage.setItem("wa_lang", a.dataset.l); } catch (x) {} location.reload(); });
    const f = d.querySelector("form"), msg = d.querySelector(".msg"), btn = d.querySelector("button[type=submit]");
    const codeBox = d.querySelector(".code"), codeIn = codeBox.querySelector("input"), vbtn = d.querySelector(".vbtn"), vmsg = d.querySelector(".vmsg");
    let sentTo = "";
    f.onsubmit = async (e) => {
      e.preventDefault(); const email = f.querySelector("input[type=email]").value.trim().toLowerCase(); if (!email) return;
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { msg.className = "msg err"; msg.textContent = LT.bad; return; }
      btn.disabled = true; msg.className = "msg"; msg.textContent = LT.sending;
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      btn.disabled = false;
      if (error) { msg.className = "msg err"; msg.textContent = LT.noSend + error.message; }
      else { sentTo = email; msg.className = "msg ok"; msg.textContent = LT.sent(name); codeBox.hidden = false; btn.textContent = LT.again; codeIn.focus(); }
    };
    const verify = async () => {
      const token = codeIn.value.replace(/\D/g, ""); if (!sentTo || token.length < 6) { vmsg.className = "msg vmsg err"; vmsg.textContent = LT.whole; return; }
      vbtn.disabled = true; vmsg.className = "msg vmsg"; vmsg.textContent = LT.checking;
      const { error } = await sb.auth.verifyOtp({ email: sentTo, token, type: "email" });
      vbtn.disabled = false;
      if (error) { vmsg.className = "msg vmsg err"; vmsg.textContent = LT.wrong + "(" + error.message + ")"; }
    };
    vbtn.onclick = verify;
    codeIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); verify(); } });
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

  /* ---------------- push notifications + icon number ---------------- */
  const VAPID_PUBLIC = "BOwEUrNDXBdf6WdP-Ft3TFbkGXYOxwKNCOJqhnAFr8Wopikw0WcrB8r3nj7vaedVkTKd8U8CvbrdbYzZyIjTSPs";
  let swReg = null;
  if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").then((r) => { swReg = r; }).catch(() => {}); }
  const b64ToBytes = (b) => { const p = "=".repeat((4 - (b.length % 4)) % 4); const raw = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  window.WA_PUSH = {
    /* "ok" | "needs-home-screen" | "unsupported" */
    support() { if (isIOS && !isStandalone()) return "needs-home-screen"; return ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) ? "ok" : "unsupported"; },
    permission() { return "Notification" in window ? Notification.permission : "denied"; },
    async isOn() { try { const r = swReg || (await navigator.serviceWorker.ready); const s = await r.pushManager.getSubscription(); return !!s && Notification.permission === "granted"; } catch (e) { return false; } },
    async enable(teacherId) {
      const perm = await Notification.requestPermission(); if (perm !== "granted") return false;
      const r = swReg || (await navigator.serviceWorker.ready);
      let s = await r.pushManager.getSubscription();
      if (!s) s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
      const j = s.toJSON(); const id = "p" + Array.from(new TextEncoder().encode(j.endpoint)).reduce((h, c) => ((h * 31 + c) >>> 0), 7).toString(36) + j.endpoint.length;
      await db.collection("pushsubs").doc(id).set({ teacherId: teacherId || "", email: (meCache && meCache.email) || "", sub: j, ua: navigator.userAgent.slice(0, 120), at: new Date().toISOString() });
      return true;
    },
    badge(n) {
      try { if ("setAppBadge" in navigator) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {}
      try { navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ badge: n | 0 }); } catch (e) {}
    },
  };

  /* ---------------- the window.claude shim the app expects ---------------- */
  const ns = { db, user, assets, downloads };
  window.claude = { use: async (name) => { if (!(name in ns)) return null; await sessionReady; if (name === "user") await me(); return ns[name]; } };
})();
