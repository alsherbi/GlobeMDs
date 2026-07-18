// GlobeMDs — RevenueCat webhook → entitlements table.
// Configure in RevenueCat dashboard: Webhooks → this function's URL, with an
// Authorization header matching the REVENUECAT_WEBHOOK_AUTH secret.
//
// Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secrets: supabase secrets set REVENUECAT_WEBHOOK_AUTH=<random shared secret>
//
// RevenueCat app_user_id must be set to the Supabase user id on the client
// (Purchases.logIn(session.user.id)) so events map to profiles.

import { createClient } from "npm:@supabase/supabase-js@2";

const ACTIVE_EVENTS = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"]);
const INACTIVE_EVENTS = new Set(["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"]);

Deno.serve(async (req) => {
  const expected = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!expected || req.headers.get("Authorization") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { event } = await req.json();
  const userId = event?.app_user_id;
  const productId = event?.product_id ?? "globemds_premium";
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return new Response(JSON.stringify({ skipped: "no supabase user id" }), { status: 200 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let status: "active" | "expired" | "cancelled" | null = null;
  if (ACTIVE_EVENTS.has(event.type)) status = "active";
  else if (event.type === "CANCELLATION") status = "cancelled";
  else if (INACTIVE_EVENTS.has(event.type)) status = "expired";
  if (!status) {
    return new Response(JSON.stringify({ skipped: event.type }), { status: 200 });
  }

  const { error } = await admin.from("entitlements").upsert(
    {
      profile_id: userId,
      product_id: productId,
      status,
      source: "revenuecat",
      expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    },
    { onConflict: "profile_id,product_id" },
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
