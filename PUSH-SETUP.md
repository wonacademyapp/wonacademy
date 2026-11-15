# Turning on notifications — Won Academy

About 30 minutes, once. Do the steps in order.

## Step 1 — Upload the new app files to GitHub (5 min)

From the folder **upload-to-github**, upload **all 6 files** to GitHub (Add file → Upload files → Commit changes):

- index.html
- adapter.js
- sw.js  *(new — the part that receives notifications)*
- manifest.webmanifest
- icon-192.png
- icon-512.png

Check no file has "(1)" in its name.

## Step 2 — Save the notification keys in Supabase (5 min)

Supabase → **Edge Functions** (left menu) → **Secrets** (sometimes under *Manage secrets*) → add these three, one by one. Copy each value exactly, with no spaces:

| Name | Value |
|---|---|
| `VAPID_PUBLIC` | `BFlA1wn6C7cC9MrYxvFOKHYY-6Z4CXZMy9U-SyUH8JfC1e0yEmcUwaalHLvCJhttORetNFaCPQ0KgrEwFzw0jdc` |
| `VAPID_PRIVATE` | `YuZlvc6XbAYEcb1hG4PuRX2JIdd7aR-PuNTx-qkDeHs` |
| `VAPID_SUBJECT` | `mailto:info@wonacademy.cz` |

Click **Save**. Keep VAPID_PRIVATE secret — don't put it on GitHub or send it to anyone.

## Step 3 — Add the sending program (10 min)

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly: `notify`
3. Delete the example code in the editor. Open **for-supabase/notify-function.ts** with Notepad, copy everything (Ctrl+A, Ctrl+C), and paste it into the editor.
4. Click **Deploy function**. Wait until it says it's deployed.

## Step 4 — Tell the database to call it (5 min)

1. Supabase → **Database** → **Webhooks** (or **Integrations → Database Webhooks**) → **Enable webhooks** if asked → **Create a new hook**.
2. Fill in:
   - **Name:** `notify-teachers`
   - **Table:** `docs`
   - **Events:** tick **Insert** and **Update** (not Delete)
   - **Type of webhook:** **Supabase Edge Functions**
   - **Edge Function:** `notify`, method **POST**, timeout **5000**
   - Under **HTTP Headers**, click **Add auth header with service key** (if offered).
3. Click **Create webhook**.

## Step 5 — Try it

1. On your phone, open **app.wonacademy.cz** as a teacher (or ask one teacher to help).
   - **iPhone:** it must be opened from the **Home Screen icon** (Share → Add to Home Screen first).
2. At the top of **My week** there's **🔔 Turn on notifications** → tap **Turn on** → **Allow**.
3. On your computer, send a test **lesson offer** to that teacher, or change one of their lessons and press **Yes, share**.
4. Within a few seconds the phone should show the notification, and the app icon a number (iPhone / computer) or a dot (Android).

## What sends a notification

| Push message + icon number | Icon number only |
|---|---|
| A shared schedule change (new time, day, room, teacher) | New note from the office |
| A shared cancelled / moved lesson | Replies to the teacher's notes |
| A new lesson for them in a shared week | |
| A new lesson offer | |
| "Your schedule is ready" when you share a new week | |

The number on the icon is the count of things waiting for the teacher in **My week**; it updates every time they open the app.

## If it doesn't work

- Supabase → Edge Functions → **notify** → **Logs**: send me a screenshot of any red lines.
- Supabase → Database → Webhooks → **notify-teachers**: check it's enabled.
