import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = env("SCHEDULE_PUSH_CRON_SECRET");
const publicKey = env("VAPID_PUBLIC_KEY");
const privateKey = env("VAPID_PRIVATE_KEY");
const subject = env("VAPID_SUBJECT") || "mailto:admin@example.com";

function parts(date: Date, zone: string) {
  const values = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(values.map((p) => [p.type, p.value]));
}
function matchesOccurrence(anchor: Date, candidate: Date, rule: string, zone: string) {
  const a = parts(anchor, zone); const c = parts(candidate, zone);
  if (candidate.getTime() < anchor.getTime()) return false;
  if (a.hour !== c.hour || a.minute !== c.minute) return false;
  if (rule === "daily") return true;
  if (rule === "weekly") return a.weekday === c.weekday;
  if (rule === "monthly") return a.day === c.day;
  return Math.floor(anchor.getTime() / 60000) === Math.floor(candidate.getTime() / 60000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase environment is not configured" }, 500);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const db = createClient(supabaseUrl, serviceKey);
  if (req.method === "GET") {
    if (!token) return json({ error: "Authentication required" }, 401);
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid or expired session" }, 401);
    return publicKey ? json({ publicKey }) : json({ error: "VAPID public key is not configured" }, 503);
  }
  if (req.method !== "POST" || !cronSecret || token !== cronSecret) return json({ error: "Forbidden" }, 403);
  if (!publicKey || !privateKey) return json({ error: "VAPID keys are not configured" }, 500);
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const now = new Date(); const minute = new Date(Math.floor(now.getTime() / 60000) * 60000);
  const { data: schedules, error: scheduleError } = await db.from("schedules").select("id,user_id,title,starts_at,timezone,repeat_rule,reminder_minutes,is_completed,deleted_at").eq("is_completed", false).is("deleted_at", null);
  if (scheduleError) return json({ error: scheduleError.message }, 500);
  let checked = 0; let sent = 0; let failed = 0;
  for (const item of schedules || []) {
    const anchor = new Date(item.starts_at); const zone = item.timezone || "Asia/Seoul";
    const rule = item.repeat_rule || "none";
    const leads = Array.isArray(item.reminder_minutes) && item.reminder_minutes.length ? item.reminder_minutes : [0];
    for (const leadValue of leads) {
      const lead = Math.max(0, Math.min(1440, Number(leadValue) || 0));
      const occurrence = new Date(minute.getTime() + lead * 60000);
      if (!matchesOccurrence(anchor, occurrence, rule, zone)) continue;
      checked++;
      const { error: insertError } = await db.from("schedule_push_deliveries").upsert({ schedule_id: item.id, user_id: item.user_id, occurrence_at: occurrence.toISOString(), reminder_minutes: lead, status: "queued" }, { onConflict: "schedule_id,occurrence_at,reminder_minutes", ignoreDuplicates: true });
      if (insertError) { failed++; continue; }
      const { data: delivery, error: lookupError } = await db.from("schedule_push_deliveries").select("id,status").eq("schedule_id", item.id).eq("occurrence_at", occurrence.toISOString()).eq("reminder_minutes", lead).maybeSingle();
      if (lookupError || !delivery) { failed++; continue; }
      if (["sent", "partial", "sending"].includes(delivery.status)) continue;
      const { data: claim, error: claimError } = await db.from("schedule_push_deliveries").update({ status: "sending" }).eq("id", delivery.id).in("status", ["queued", "failed", "no_subscription"]).select("id").maybeSingle();
      if (claimError || !claim) { if (claimError) failed++; continue; }
      const { data: subscriptions, error: subError } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", item.user_id);
      if (subError) { await db.from("schedule_push_deliveries").update({ status: "failed" }).eq("id", delivery.id); failed++; continue; }
      if (!subscriptions?.length) { await db.from("schedule_push_deliveries").update({ status: "no_subscription" }).eq("id", delivery.id); continue; }
      let ok = 0;
      const payload = JSON.stringify({ title: "규림's Schedule", body: item.title || "예정된 일정이 있습니다.", url: "./", tag: item.id + "-" + occurrence.toISOString() });
      for (const sub of subscriptions) {
        try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload); ok++; }
        catch (err) { const statusCode = Number((err as { statusCode?: number }).statusCode || 0); if (statusCode === 404 || statusCode === 410) await db.from("push_subscriptions").delete().eq("id", sub.id); }
      }
      const status = ok === subscriptions.length ? "sent" : ok > 0 ? "partial" : "failed";
      await db.from("schedule_push_deliveries").update({ status, sent_at: ok ? new Date().toISOString() : null }).eq("id", delivery.id);
      if (ok) sent++; else failed++;
    }
  }
  return json({ ok: true, checked, sent, failed, at: now.toISOString() });
});
