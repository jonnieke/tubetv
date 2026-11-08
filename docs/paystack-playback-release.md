# TubeTV payment and playback rollout

Episodes 1 and 2 of each micro drama are public. Later episodes require a verified viewer with a permanent unlock or an active paid pass. Existing wallet balances remain in place. New accounts start with a zero balance. The old phone-derived email accounts require a verified recovery process before their balances can be used.

## Staging checks

1. Confirm the production migration history and make a staging copy of the schema. The order and unlock migrations expect `user_wallets`, `coin_ledger`, `episode_unlocks`, `subscriptions`, and `credit_user_coins`. Check the older creator payouts migration and any live trigger on `episode_unlocks` before applying pending migrations.
2. Set the staging Supabase site origin, SMS provider and allowed authentication redirects. Configure `BUNNY_LIBRARY_ID`, `BUNNY_ACCESS_KEY`, `BUNNY_PULL_ZONE` and the CDN's actual `BUNNY_TOKEN_KEY`. Keep API and signing keys in Edge Function secrets. Set `PAYSTACK_MODE=test`, `PAYSTACK_SECRET_KEY` to the matching test key and `PAYSTACK_SITE_URL` to the staging site. Add the exact staging origin to `ALLOWED_ORIGINS`. Set `PAYSTACK_WEBHOOK_SIGNING_SECRET` only if the test integration sends the timestamped signature.
3. Apply the migrations, deploy `playback-token`, `paystack-webhook` and `paystack-checkout`, then deploy the matching frontend. Keep `PAYSTACK_CHECKOUT_ENABLED` unset until media access is verified. Point the Paystack test webhook at the staging project.
4. Configure Bunny token protection for paid media paths. Test the actual HLS playlist and segments, MP4 or original file URLs if enabled, and the Bunny embed path. Every unsigned paid-media route should fail. Confirm thumbnails, free episodes, and unrelated catalogue playback still work. Enabling authentication across a Pull Zone can also affect public images and existing players. Verify the exact rules on staging before touching production.
5. Open Otis and the Talking Goat as a guest. Episodes 1 and 2 should play and episode 3 should show the paywall. Check that a guest still receives a lock response when the episode 3 request includes a forged episode number or format. Verify the SMS or email flow with the user entering the code. Verify the new account has no starter coins.
6. Set `PAYSTACK_CHECKOUT_ENABLED=true` in staging. Run a test purchase, confirm the return opens the original episode, and confirm the status stays pending until fulfillment. Check the wallet credit and episode unlock, a VIP purchase and expiration, a duplicate successful webhook, an altered signature, and a failed fulfillment followed by a retry. Confirm a zero-cost RPC request is rejected and repeated unlock requests spend one coin total.

## Production cutover

Pause new checkout starts before changing the live handlers. Reconcile existing successful charges and track old checkout references that might settle late. The new handler records legacy references in `paystack_legacy_receipts` for review and grants benefits only for its own verified orders. Match legacy charges to the payment provider, historical price and verified customer before issuing any credit. Inspect existing wallet credits before retrying a delivery.

Apply the reviewed migrations, deploy the Edge Functions with checkout disabled, and deploy the frontend. Apply the staged Bunny rules and verify actual media delivery. Set `PAYSTACK_MODE=live` with the live key and verify the live webhook URL and signature scheme. Enable checkout for a controlled purchase only after the authorization and CDN checks pass. The customer must approve the live payment. Confirm exactly one credit or pass and successful playback before reopening purchases.

If anything fails, disable new checkout starts and keep the verified webhook active for orders already started. Preserve the order and receipt tables for reconciliation.

- [Bunny Stream security](https://bunny.net/docs/stream/security)
- [Bunny CDN directory tokens](https://bunny.net/docs/cdn/security/token-authentication/advanced)
- [Paystack webhook signatures](https://paystack.com/docs/payments/webhooks/)
- [Paystack transaction verification](https://paystack.com/docs/payments/verify-payments/)
