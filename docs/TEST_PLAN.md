# GlobeMDs Mobile — Test plan

Covers the four risk areas the product brief prioritizes: auth, verification
gating, realtime sync, offline behavior — plus store-readiness smoke tests.
Run against the **staging** Supabase project with at least three test
accounts: `unverified@`, `verified-a@`, `verified-b@` (and one `admin@` with
`profiles.is_admin = true`, one `recruiter@` with `is_recruiter = true`).

## 1. Auth (shared account with web)

| # | Test | Expected |
|---|------|----------|
| 1.1 | Sign up on mobile, then sign in on web with same credentials | Same profile row; name set from signup |
| 1.2 | Sign in on mobile with an account created on web | Profile, connections, posts all present |
| 1.3 | Kill and relaunch app | Session persists (AsyncStorage), lands on Home |
| 1.4 | Sign out | Returns to sign-in; query cache cleared; no stale personal data on next account |
| 1.5 | Wrong password | Clear error, no crash |
| 1.6 | Token refresh: leave app foregrounded > 1h | Requests keep working (auto-refresh) |

## 2. Verification gating

| # | Test | Expected |
|---|------|----------|
| 2.1 | Unverified user: feed, profiles, jobs browse | Allowed (read-only experience) |
| 2.2 | Unverified user: compose | Blocked at UI ("Verification required") AND by RLS if forced |
| 2.3 | Unverified user: connect / follow / message / comment / react / apply | All blocked by RLS (verify via direct API call, not just UI) |
| 2.4 | Enter invalid NPI (bad checksum/9 digits) | Client-side rejection |
| 2.5 | Enter valid NPI with mismatched last name | Edge function 422, status unchanged |
| 2.6 | Valid NPI + matching name | `npi_verified_at` set, status → `pending_review`, banner text updates |
| 2.7 | Upload license PDF | Row in `verification_documents` (status `submitted`); file NOT readable by another signed-in user (signed URL / RLS check) |
| 2.8 | Admin approves document (web queue or RPC) | Status → `verified` on BOTH web and mobile without reinstall; posting unlocks |
| 2.9 | Admin rejects | Status → `rejected`; banner offers re-submission |
| 2.10 | Case post without attestation via direct insert | Rejected by DB CHECK constraint |
| 2.11 | Case post containing "MRN 123456" / a DOB / phone number | PHI screen flags it in the attestation modal |

## 3. Realtime sync (web ↔ mobile)

| # | Test | Expected |
|---|------|----------|
| 3.1 | B sends DM from web while A has thread open on mobile | Message appears < 2s, no refresh |
| 3.2 | Typing on mobile | "…is typing" on the other device (and vice versa) |
| 3.3 | Read receipt: B opens thread | A sees "Seen" |
| 3.4 | B reacts/comments on A's post from web | A's Alerts tab badge + list update live |
| 3.5 | B publishes a post from web | A's feed refreshes (realtime invalidation) |
| 3.6 | Connection request web→mobile and mobile→web | Appears in Network invitations both directions; accept once, both sides show Connected |
| 3.7 | Message request: non-connection B messages A | Lands in A's Requests inbox; A cannot be spammed (B can't send again until accepted — RLS) |

## 4. Offline behavior

| # | Test | Expected |
|---|------|----------|
| 4.1 | Load feed, enable airplane mode, kill + relaunch | Last-loaded feed renders from persisted cache |
| 4.2 | Offline: open previously-viewed profile & thread | Cached content renders |
| 4.3 | Offline: send message / reaction | Mutation queues (networkMode online); fires on reconnect |
| 4.4 | Reconnect | Queries refetch automatically; queued mutations deliver exactly once |
| 4.5 | Post with image upload offline | Fails gracefully with retry option (upload is not silently dropped) |

## 5. Push notifications (dev-client/production build only)

| # | Test | Expected |
|---|------|----------|
| 5.1 | Grant permission on first sign-in | Token row in `push_tokens` |
| 5.2 | DM received while app backgrounded | Push arrives; tapping opens the exact thread |
| 5.3 | Reaction notification with `reactions` pref off | No push (edge function honors prefs); in-app alert still listed |
| 5.4 | `push` master pref off | No push at all |
| 5.5 | Sign out → notification sent | No push delivered to that device (token removed/dead-token pruning) |

## 6. Store-readiness smoke

- Dynamic type at largest accessibility size: all screens readable, no clipped controls
- VoiceOver/TalkBack: tab bar, feed cards, compose, verification flow all labeled
- Dark mode: contrast AA on both themes
- Deep links: `globemds://profile/<id>`, `globemds://post/<id>`, and
  `https://globemds.com/post/<id>` (App/Universal Links) open the right screen
  signed-in, and land on sign-in when signed out
- Account deletion path documented in-app (Settings) — required by both stores
