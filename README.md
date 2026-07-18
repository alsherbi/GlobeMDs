# GlobeMDs Mobile

React Native (Expo) iOS/Android client for **GlobeMDs.com** — the professional
network for physicians. One platform, two clients: this app shares the same
Supabase backend, auth, storage and realtime channels as the web app, so
profiles, connections, posts and messages are identical and instantly in sync
across web and mobile.

## Stack

- **Expo SDK 57** (managed workflow) + TypeScript + **Expo Router** (file-based navigation, deep links)
- **Supabase** — Postgres + Auth + Storage + Realtime + Edge Functions (project `ophgnlxuusrupquxinpd`, same as web)
- **TanStack React Query** with AsyncStorage persistence (offline cache) and NetInfo-driven online manager
- **Expo Notifications** for push, delivered by the `send-push` edge function via a DB webhook
- **EAS Build / Submit** for store delivery; **RevenueCat** for the Premium subscription

## Repo layout

```
src/
  app/                 Expo Router routes
    (auth)/            sign-in, sign-up
    (app)/(tabs)/      Home feed, Network, Jobs, Alerts, Me
    (app)/…            profile, post, compose, messages, groups, institutions,
                       jobs, search, verification, settings, premium, tools
  api/                 Typed Supabase queries + React Query hooks (one module per domain)
  components/          UI primitives + PostCard/PersonRow/VerificationBanner
  lib/                 supabase client, query client, push registration
  providers/           SessionProvider (auth state + my profile)
  theme/               design tokens (light/dark)
  types/database.ts    ⚠️ single mapping point to the Postgres schema
  utils/               PHI screening, PubMed citations, ICD-10, time
supabase/
  migrations/          ⚠️ PROVISIONAL schema + RLS (see below)
  functions/           npi-verify, send-push, revenuecat-webhook
docs/                  schema reconciliation, test plan, store checklist
```

## Run locally

```bash
npm install
cp .env.example .env        # fill in the Supabase anon key
npx expo start              # scan QR with Expo Go, or press i / a
npm run typecheck           # tsc --noEmit
```

Everything except push notifications, purchases and document upload works in
Expo Go. For the full native feature set build a dev client:
`eas build --profile development --platform ios|android`.

## ⚠️ Schema status — read before touching the database

The build environment could not reach the live Supabase project, so
`supabase/migrations/*.sql` is a **provisional** schema authored to the spec.
**Do not apply it blindly.** The live GlobeMDs.com project is the source of
truth. Follow `docs/SCHEMA_RECONCILIATION.md`: pull the live schema, diff
against these migrations, keep the live names, and update
`src/types/database.ts` + the `src/api/*` modules (the only two places table
names appear).

## How auth/data relate to the web app

- Same Supabase Auth: a user's email/password works identically on web and
  mobile; separate device sessions, same `auth.users` row and `profiles` row.
- Every read/write targets the shared Postgres tables through RLS. There is no
  mobile-only storage of user data beyond the local React Query cache.
- Verification: `npi-verify` edge function validates against the NPPES
  registry server-side and sets `pending_review`; admin document review (web
  admin queue or `review_verification_document` RPC) flips
  `profiles.verification_status = 'verified'`, which both clients read.
  Unverified users can browse and edit their profile; RLS blocks posting,
  commenting, reacting, connecting and messaging until verified.
- No PHI: `case` posts are structurally impossible without a consent
  timestamp (DB CHECK constraint); the composer screens text for common
  identifiers (names/MRN/DOB/dates/phones) and shows the attestation modal.
- Realtime: messages, conversations and notifications are in the
  `supabase_realtime` publication; both clients subscribe, so web actions
  appear on mobile instantly and vice versa.
- Premium: `entitlements` table written only by the `revenuecat-webhook`
  edge function (or the web app's Stripe webhook — same table, either source
  unlocks both clients).

## Deploying a new build

```bash
# one-time: eas init (links REPLACE_WITH_EAS_PROJECT_ID in app.json), set env vars
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>

eas build --profile preview --platform all      # internal distribution build
eas build --profile production --platform all   # store build
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Edge functions deploy separately: `supabase functions deploy npi-verify send-push revenuecat-webhook`
(then wire `send-push` as a Database Webhook on INSERT into `notifications`).

See `docs/STORE_CHECKLIST.md` for the full App Store / Play Store submission
checklist and policy-risk notes, and `docs/TEST_PLAN.md` for the acceptance
test plan (auth, verification gating, realtime sync, offline).
