/* Won Academy — notifications helper (service worker).
   Shows push notifications and keeps the number on the app icon. */
const BADGE_KEY = "/__wa_badge";
async function getBadge() { try { const c = await caches.open("wa"); const r = await c.match(BADGE_KEY); return r ? Number(await r.text()) || 0 : 0; } catch (e) { return 0; } }
async function setBadge(n) {
  n = Math.max(0, n | 0);
  try { const c = await caches.open("wa"); await c.put(BADGE_KEY, new Response(String(n))); } catch (e) {}
  try { if (self.navigator && "setAppBadge" in self.navigator) { if (n) await self.navigator.setAppBadge(n); else await self.navigator.clearAppBadge(); } } catch (e) {}
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: "Won Academy", body: event.data ? event.data.text() : "" }; }
  event.waitUntil((async () => {
    let dup = false; try { if (d.tag) dup = (await self.registration.getNotifications({ tag: d.tag })).length > 0; } catch (e) {}
    if (!dup) await setBadge((await getBadge()) + 1);
    await self.registration.showNotification(d.title || "Won Academy", {
      body: d.body || "",
      tag: d.tag || undefined,
      renotify: !!d.renotify,
      icon: "icon-192.png",
      badge: "favicon-64.png",
      data: { url: d.url || "./" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { c.focus(); return; } }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

/* the app tells us the real number of unread items whenever it is open */
self.addEventListener("message", (event) => {
  const m = event.data || {};
  if (typeof m.badge === "number") event.waitUntil(setBadge(m.badge));
});
