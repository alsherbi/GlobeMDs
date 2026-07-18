# Schema reconciliation with the live GlobeMDs Supabase project

The migrations in `supabase/migrations/` are **provisional**: the build
environment's network policy blocked `*.supabase.co`, so the live project
(`ophgnlxuusrupquxinpd`) could not be introspected. The live web app's schema
is the source of truth — these files encode the mobile app's expectations and
must be reconciled before anything is applied.

## Step-by-step

1. **Pull the live schema** (from a machine with access):
   ```bash
   supabase link --project-ref ophgnlxuusrupquxinpd
   supabase db pull          # writes the real schema into supabase/migrations
   ```
2. **Diff** the pulled schema against the provisional files. For each table the
   mobile app expects, one of three cases applies:
   - **Exists with the same shape** → delete the provisional definition; use the live one.
   - **Exists with different names/shape** (e.g. web uses `users_profiles`, or
     `verified boolean` instead of `verification_status enum`) → keep the live
     definition and update the mobile code. Table/column names appear in exactly
     two places: `src/types/database.ts` and the `src/api/*` modules.
   - **Missing entirely** → the provisional definition becomes a real migration;
     review it with the web team first (it may overlap a planned web feature).
3. **RLS audit** (non-negotiable): for every existing table, compare live
   policies with the provisional ones. Never weaken a live policy to make a
   mobile query work — change the mobile query instead. Pay attention to:
   - write-gating on `verification_status = 'verified'` (posts, comments,
     reactions, connections, messages, groups)
   - messaging: participant-only reads, request-conversation write rules
   - `verification-docs` storage bucket: private, owner + admin only
   - `entitlements`: no client write path (service-role webhook only)
4. **RPCs**: the app calls `send_connection_request`,
   `respond_connection_request`, `suggest_connections`,
   `mutual_connection_count`, `get_feed`, `start_direct_conversation`,
   `start_group_conversation`, `accept_message_request`, `record_profile_view`,
   `get_profile_viewers`, `global_search`, `search_referral_directory`,
   `record_npi_validation`, `review_verification_document`. If the web app
   already encapsulates the same business logic in different functions, call
   those instead and delete the provisional ones — do not run two state
   machines.
5. **Storage buckets**: web may already have buckets with different names
   (check `avatars`, `post-media`, `verification-docs`,
   `message-attachments` against the live `storage.buckets`). The bucket names
   are referenced in `src/api/storage.ts`, `src/lib/supabase.ts` helpers and
   the RLS policies in `0001_core_identity.sql`.
6. **Realtime publication**: confirm `messages`, `conversations`,
   `notifications` (and optionally `posts`) are in `supabase_realtime` on the
   live project.
7. **Regenerate types** once reconciled:
   ```bash
   supabase gen types typescript --project-id ophgnlxuusrupquxinpd > src/types/database.ts
   ```
   (then re-add the app-level helper types from the current file's RPC/enum
   section as needed).

## New tables this app needs (flag to the web team)

If the web app predates these features, the following provisional tables are
net-new and need review: `cme_entries`, `profile_views`, `push_tokens`,
`poll_votes`, `group_events`, `entitlements` (if web billing uses Stripe
customer tables instead, map `has_premium()` onto those),
`verification_documents` (if web has its own admin-review table, reuse it).

## Auth trigger caution

`0001` adds an `on_auth_user_created` trigger creating a `profiles` row. If the
live project already has an equivalent trigger (very likely), skip this one —
two triggers means duplicate-key failures on signup.
