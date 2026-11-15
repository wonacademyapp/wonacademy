// Won Academy — "notify" Edge Function.
// Called by a Database Webhook on the "docs" table (insert + update).
// Sends a push notification to teachers when:
//   • you share a schedule change / new lesson / cancelled or moved lesson
//   • you send a new lesson offer
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.80.0";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:info@wonacademy.cz",
  Deno.env.get("VAPID_PUBLIC")!,
  Deno.env.get("VAPID_PRIVATE")!,
);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dl = (d?: string) => { if (!d) return ""; const [y, m, dd] = d.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, dd)); return `${DAYS[x.getUTCDay()]} ${dd}.${m}.`; };
const OFF: Record<string, string> = { cancel: "cancelled", rescheduled: "rescheduled", makeup: "moved to a make-up lesson", nextmonth: "moved to next month", latecancel: "cancelled", changed: "given to another teacher" };

async function studentName(id?: string) {
  if (!id) return "";
  const { data } = await sb.from("docs").select("data").eq("collection", "students").eq("id", id).maybeSingle();
  return (data?.data?.name as string) || "";
}

async function send(tids: string[], msg: { title: string; body: string; tag: string }) {
  const ids = [...new Set(tids.filter(Boolean))];
  if (!ids.length) return 0;
  const { data: subs } = await sb.from("docs").select("id,data").eq("collection", "pushsubs").in("data->>teacherId", ids);
  let n = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(s.data.sub, JSON.stringify({ ...msg, url: "./" }));
      n++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("docs").delete().eq("collection", "pushsubs").eq("id", s.id);
    }
  }
  return n;
}

Deno.serve(async (req) => {
  let p: any = {};
  try { p = await req.json(); } catch { return new Response("bad", { status: 400 }); }
  const r = p.record, o = p.old_record;
  if (!r || !r.data) return new Response("skip");
  let sent = 0;

  // New lesson offer
  if (r.collection === "offers" && p.type === "INSERT" && r.data.status === "open") {
    const d = r.data;
    const who = d.studentName || (await studentName(d.studentId));
    sent = await send(d.teachers || [], {
      title: "📢 New lesson offer",
      body: `${dl(d.date)} ${d.time || ""}${who ? " · " + who : ""} — open the app to take it`,
      tag: "offer-" + r.id,
    });
  }

  // Shared schedule changes
  if (r.collection === "lessons") {
    const d = r.data, pub = d.pub, opub = o?.data?.pub;
    if (pub && pub.sharedAt && pub.sharedAt !== opub?.sharedAt) {
      const who = await studentName(pub.studentId || d.studentId);
      const pc = d.pubChange;
      if (pub.off && pub.off !== (opub?.off || "")) {
        sent = await send([pub.subTeacherId || pub.teacherId || d.teacherId], {
          title: "📅 Lesson " + (OFF[pub.off] || "changed"),
          body: `${who ? who + " · " : ""}${dl(pub.date)} ${pub.time || ""} — please disregard this lesson`,
          tag: "les-" + r.id,
        });
      } else if (pc && pc.at === pub.sharedAt) {
        const f = pc.from;
        sent = await send(pc.tids || [], {
          title: f ? "📅 Schedule changed" : "📅 New lesson",
          body: f ? `${who ? who + ": " : ""}${dl(f.date)} ${f.time || ""} → ${dl(pub.date)} ${pub.time || ""}` : `${who ? who + " · " : ""}${dl(pub.date)} ${pub.time || ""}`,
          tag: "les-" + r.id,
        });
      } else if (!opub?.sharedAt) {
        // first time this lesson is shared: one quiet "schedule ready" notice per teacher and week
        const mon = (() => { const [y, m, dd] = (pub.date || "").split("-").map(Number); const x = new Date(Date.UTC(y, m - 1, dd)); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); })();
        sent = await send([pub.subTeacherId || pub.teacherId || d.teacherId], {
          title: "📅 Your schedule is ready",
          body: `The week of ${dl(mon)} has been shared. Open the app to see your lessons.`,
          tag: "week-" + mon,
        });
      }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
