// GlobeMDs — NPI verification edge function.
// Called by mobile/web during signup verification. Validates the NPI against
// the public CMS NPPES registry server-side (so the client cannot fake a
// match), then records the validation on the caller's profile.
//
// Deploy: supabase functions deploy npi-verify
// Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const NPPES_URL = "https://npiregistry.cms.hhs.gov/api/?version=2.1";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { npi, lastName } = await req.json();
  if (!/^\d{10}$/.test(npi ?? "")) {
    return new Response(JSON.stringify({ error: "NPI must be 10 digits" }), { status: 400 });
  }

  const registryRes = await fetch(`${NPPES_URL}&number=${npi}`);
  if (!registryRes.ok) {
    return new Response(JSON.stringify({ error: "NPI Registry unavailable" }), { status: 502 });
  }
  const registry = await registryRes.json();
  const record = registry.results?.[0];
  if (!record) {
    return new Response(JSON.stringify({ error: "NPI not found in registry" }), { status: 404 });
  }
  if (record.enumeration_type !== "NPI-1") {
    return new Response(JSON.stringify({ error: "NPI is not an individual provider (NPI-1)" }), { status: 422 });
  }

  const basic = record.basic ?? {};
  if (
    lastName &&
    basic.last_name &&
    basic.last_name.toLowerCase() !== String(lastName).toLowerCase()
  ) {
    return new Response(
      JSON.stringify({ error: "Registry last name does not match", registryLastName: basic.last_name }),
      { status: 422 },
    );
  }

  const primaryTaxonomy = (record.taxonomies ?? []).find((t: { primary: boolean }) => t.primary);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      npi_number: npi,
      npi_verified_at: new Date().toISOString(),
      specialty: primaryTaxonomy?.desc ?? undefined,
      verification_status: "pending_review",
    })
    .eq("id", userData.user.id)
    .eq("verification_status", "unverified");

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      registry: {
        name: `${basic.first_name ?? ""} ${basic.last_name ?? ""}`.trim(),
        credential: basic.credential ?? null,
        taxonomy: primaryTaxonomy?.desc ?? null,
        state: primaryTaxonomy?.state ?? null,
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
