// GlobeMDs — Push notification fan-out.
// Wire this as a Database Webhook on INSERT into public.notifications
// (Dashboard → Database → Webhooks), or call it from pg_net. It looks up the
// recipient's Expo push tokens and notification preferences, then delivers
// via the Expo Push API.
//
// Deploy: supabase functions deploy send-push --no-verify-jwt
// (webhook calls carry the service key in the Authorization header instead)

import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const KIND_COPY: Record<string, { title: string; prefKey: string }> = {
  connection_request: { title: "New connection request", prefKey: "connections" },
  connection_accepted: { title: "Connection accepted", prefKey: "connections" },
  new_follower: { title: "New follower", prefKey: "connections" },
  post_reaction: { title: "Someone reacted to your post", prefKey: "reactions" },
  post_comment: { title: "New comment on your post", prefKey: "comments" },
  comment_reply: { title: "New reply to your comment", prefKey: "comments" },
  post_reshare: { title: "Your post was reshared", prefKey: "reactions" },
  message: { title: "New message", prefKey: "messages" },
  group_invite: { title: "Group invitation", prefKey: "groups" },
  group_join_approved: { title: "Group membership approved", prefKey: "groups" },
  job_match: { title: "New job match", prefKey: "jobs" },
  system: { title: "GlobeMDs", prefKey: "push" },
};

Deno.serve(async (req) => {
  const payload = await req.json();
  const row = payload.record; // Database Webhook shape
  if (!row?.recipient_id || !row?.kind) {
    return new Response(JSON.stringify({ skipped: "no notification row" }), { status: 200 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [{ data: profile }, { data: tokens }, { data: actor }] = await Promise.all([
    admin.from("profiles").select("notification_prefs").eq("id", row.recipient_id).single(),
    admin.from("push_tokens").select("expo_token").eq("profile_id", row.recipient_id),
    row.actor_id
      ? admin.from("profiles").select("full_name").eq("id", row.actor_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const prefs = profile?.notification_prefs ?? {};
  const copy = KIND_COPY[row.kind] ?? KIND_COPY.system;
  if (prefs.push === false || prefs[copy.prefKey] === false) {
    return new Response(JSON.stringify({ skipped: "prefs" }), { status: 200 });
  }
  if (!tokens?.length) {
    return new Response(JSON.stringify({ skipped: "no tokens" }), { status: 200 });
  }

  const messages = tokens.map((t: { expo_token: string }) => ({
    to: t.expo_token,
    title: copy.title,
    body: actor?.full_name ? `${actor.full_name}` : undefined,
    data: { kind: row.kind, entity: row.entity, notificationId: row.id },
    sound: "default",
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  const result = await res.json();

  // Prune tokens Expo reports as dead.
  const dead: string[] = [];
  (result.data ?? []).forEach((ticket: { status: string; details?: { error?: string } }, i: number) => {
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      dead.push(messages[i].to);
    }
  });
  if (dead.length) {
    await admin.from("push_tokens").delete().in("expo_token", dead);
  }

  return new Response(JSON.stringify({ delivered: messages.length - dead.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
