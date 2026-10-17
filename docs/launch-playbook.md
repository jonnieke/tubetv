# TubeTV Launch Playbook: Microdrama-First Platform

This playbook outlines the exact verification and operational steps required to take TubeTV live with the Kenyan M-Pesa STK push, diaspora multi-currency checkout, and vertical microdrama engine.

---

## 1. Secrets & Environment Variables

### A. Vercel Frontend Environment Variables
Set these in **Vercel Dashboard > Project Settings > Environment Variables**:

| Variable | Value / Description | Exposed to Browser |
|---|---|:---:|
| `VITE_SITE_URL` | `https://www.tube.co.ke` | Yes |
| `VITE_SUPABASE_URL` | `https://{project-ref}.supabase.co` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for browser) | Yes |
| `VITE_BUNNY_PULL_ZONE` | `vz-0fe79b1a-8ad.b-cdn.net` (or your custom pull zone) | Yes |
| `VITE_CONTENT_RATING_ENFORCED` | `false` during onboarding; `true` after KFCB review | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret (used only by `/api/*` functions) | **No (Server Only)** |

> [!CAUTION]
> Ensure `BUNNY_ACCESS_KEY` and `PAYSTACK_SECRET_KEY` are **never** prefixed with `VITE_` and never included in frontend client bundles.

---

### B. Supabase Edge Function Secrets
Set these in **Supabase Dashboard > Project Settings > Edge Functions > Secrets** (or via `supabase secrets set`):

```bash
supabase secrets set PAYSTACK_SECRET_KEY="sk_live_..." \
                     BUNNY_ACCESS_KEY="your-bunny-api-key" \
                     BUNNY_TOKEN_KEY="your-token-signing-key" \
                     BUNNY_LIBRARY_ID="your-library-id" \
                     BUNNY_PULL_ZONE="vz-0fe79b1a-8ad.b-cdn.net" \
                     ALLOWED_ORIGINS="https://www.tube.co.ke,https://tube.co.ke"
```

---

## 2. Supabase Migrations Deployment Order

Apply the SQL migrations sequentially in the **Supabase SQL Editor**:

1. `supabase/migrations/001_create_videos.sql` (Base videos table)
2. `supabase/migrations/20260729_phase2_market_readiness.sql` (Profiles, auth triggers, initial transactions)
3. `supabase/migrations/20260925145915_market_launch_events.sql` (Audit logging & rate-limited AI RPCs)
4. `supabase/migrations/20261016150000_microdrama_monetization.sql` (Wallets, episode unlocks, coin ledger, and atomic unlock RPC)
5. `supabase/migrations/20261016160000_normalized_series_schema.sql` (Series, seasons, episodes, and `get_series_details` RPC)
6. `supabase/migrations/20261016170000_creator_payouts.sql` (Creator profiles, 65% rev-share ledger, M-Pesa B2C payouts)
7. `supabase/migrations/20261016180000_content_moderation.sql` (Staging queue, KFCB ratings, and atomic publish RPC)

---

## 3. Paystack Webhook & Transfer Configuration

1. In the **Paystack Dashboard > Settings > API Keys & Webhooks**:
   * Set **Live Webhook URL** to:
     `https://{project-ref}.supabase.co/functions/v1/paystack-webhook`
   * Confirm that Webhooks receive `charge.success` and `transfer.success` events.
2. In the **Paystack Dashboard > Preferences > Payment Channels**:
   * Ensure **Mobile Money (M-Pesa)** is enabled for Kenya.
   * Ensure **Card** and **Apple Pay** are enabled for international diaspora customers.
3. In the **Paystack Dashboard > Transfers**:
   * Enable Transfers on your Kenya business account to allow M-Pesa B2C payouts to creators from your TubeTV balance.

---

## 4. Pre-Launch Verification Checklist

### Test A: Frictionless Free-Hook Viewing (Ep 1–3)
- [ ] Open incognito browser at `https://www.tube.co.ke/?view=MICRO_DRAMAS`.
- [ ] Click Episode 1 of *Nairobi Secrets*.
- [ ] Verify that playback starts immediately without demanding login or payment.
- [ ] Swipe up: Episode 2 starts seamlessly.
- [ ] Swipe up: Episode 3 starts seamlessly.

### Test B: Paywall & 1-Tap Unlock (Ep 4+)
- [ ] Navigate to Episode 4.
- [ ] Verify the paywall bottom sheet appears and pauses the video.
- [ ] If logged out, verify the "Sign in to claim 30 free welcome coins" prompt.
- [ ] Sign in: verify 30 coins appear in wallet.
- [ ] Tap "Unlock Episode (10 Coins)": verify coins deduct to 20 and playback starts immediately.

### Test C: M-Pesa STK Push (Domestic Kenya)
- [ ] On the paywall, select **Starter Pack (100 Coins - KES 100)**.
- [ ] Select **M-Pesa STK** and enter a valid Safaricom test phone number.
- [ ] Verify the phone receives the instant M-Pesa PIN prompt.
- [ ] Verify that upon entering PIN, the Paystack webhook credits 100 coins to `user_wallets`.

### Test D: Diaspora Card & Apple Pay
- [ ] On an iOS device (Safari) or desktop, select **Binge Pack ($2.99)** with **Card / Apple Pay**.
- [ ] Verify the Apple Pay sheet pops up directly on mobile.
- [ ] Verify instant balance top-up upon biometric confirmation.

### Test E: WhatsApp Social Previews
- [ ] Copy the link: `https://www.tube.co.ke/watch/micro-ns-1`.
- [ ] Paste into a WhatsApp chat.
- [ ] Verify that WhatsApp renders the **9:16 portrait poster, title "The Stolen Ledger · Nairobi Secrets", and episode synopsis** within 2 seconds.

---

## 5. Operations & Creator Economics

- **Coin Cost Standard:** 10 Coins per episode (~KES 10 / ~$0.10).
- **Creator Revenue Share:** Pay out 50%–70% of net coins consumed on their episodes via direct M-Pesa B2C disbursements.
- **Monitoring:** Monitor failed unlocks or STK timeouts in `payment_transactions` (`status = 'failed'`).
