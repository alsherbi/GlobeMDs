# App Store & Google Play submission checklist

## Assets

- [ ] App icon 1024×1024 (no alpha for iOS) — replace placeholder `assets/images/icon.png` with GlobeMDs branding
- [ ] Android adaptive icon fore/background + monochrome (placeholders in `assets/images/`)
- [ ] Splash screen image (`assets/images/splash-icon.png`) on brand navy `#0B4F6C`
- [ ] Screenshots: 6.7" + 5.5" iPhone, 12.9" iPad (or opt out of iPad), Android phone + 7"/10" tablet
- [ ] App preview text/subtitle: "The professional network for physicians"

## Configuration

- [ ] `eas init` → real project ID replaces `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in EAS env for all profiles
- [ ] `ascAppId` in `eas.json` submit profile
- [ ] Apple: Associated Domains entitlement live; host `apple-app-site-association` on globemds.com
- [ ] Android: `assetlinks.json` hosted on globemds.com for App Links auto-verification
- [ ] Push: APNs key uploaded to EAS; FCM server key configured
- [ ] Sentry (or Expo error reporting) DSN wired before production submit
- [ ] RevenueCat: app configured, products created in both stores, `Purchases.logIn(supabaseUserId)` added with the dev-client build, webhook → `revenuecat-webhook` function with auth header secret

## Privacy & compliance declarations

- [ ] Privacy policy URL (must mention: physician credential verification incl. NPI lookup against the public NPPES registry; license document storage; no patient data/PHI permitted on the platform)
- [ ] iOS App Privacy ("nutrition label"): contact info, user content (posts/messages/photos), identifiers; **no** health data collection declared — the app prohibits PHI
- [ ] Google Play Data safety form: same scope; data encrypted in transit; deletion available via web account page
- [ ] Account deletion: both stores REQUIRE in-app discoverability — Settings screen points to the web account page; keep that page live
- [ ] Age rating: 17+/Adults recommended (unmoderated user-generated medical content)
- [ ] Export compliance: standard HTTPS only → `ITSAppUsesNonExemptEncryption=false` (already set)

## Policy risks to clear BEFORE submission (health-adjacent app)

1. **User-generated medical content moderation** — both stores expect: a report
   mechanism on posts, a block-user capability, and responsive moderation.
   The admin review queue covers verification; add report/block before
   production submit (small table + RLS, mirror web tooling).
2. **Medical misinformation scrutiny** — position the app clearly as a
   professional network for verified physicians (store description +
   review notes). Emphasize the verification gate: unverified users cannot post.
3. **Not a medical device** — the ICD-10 tool is a reference lookup, no
   diagnosis/treatment output; say so in review notes to avoid FDA/medical-device
   classification questions.
4. **Apple 4.8 / Sign in with Apple** — required only if a third-party social
   login is offered. Email/password-only avoids it; if Google Sign-In is added,
   Apple Sign-In must ship simultaneously.
5. **IAP rules** — Premium is digital content ⇒ must use in-app purchase on
   both stores (RevenueCat). Do not link to the web Stripe checkout from
   inside the iOS app.
6. **NPI/licensure claims** — "verified" badge language should say credentials
   were checked against public registries and reviewed, not that GlobeMDs
   guarantees licensure status.

## Rollout

- [ ] TestFlight internal → external beta with at least the docs/TEST_PLAN.md pass
- [ ] Play internal testing track → closed track → production staged rollout (10% → 50% → 100%)
- [ ] Store review notes: test credentials for a pre-verified physician account
      (reviewers cannot pass NPI verification) + note explaining the verification gate
