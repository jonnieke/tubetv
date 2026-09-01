# Phase 2 deployment checklist

1. Keep the Supabase Phone provider disabled unless you need SMS for another flow.
2. Apply `supabase/migrations/20260729_phase2_market_readiness.sql`.
3. Set the Edge Function secrets from `supabase/functions/.env.example`.
4. Create a Daraja application and use sandbox credentials until callback and reconciliation tests pass.
5. Deploy `mpesa-stk-push` with JWT verification enabled.
6. Deploy `mpesa-callback` with JWT verification disabled; its unguessable callback secret is still required.
7. Admin access now uses the local phone + PIN gate in `lib/localAuth.ts`. Update `LOCAL_ADMIN_PIN` there if you need to change the shared code.
8. Keep `VITE_PAYWALL_ENABLED=false` until successful, cancelled, duplicate and delayed callbacks have been tested.
9. Switch Daraja and the paywall to production only after Safaricom go-live approval.

The callback URL registered with Daraja must exactly match `MPESA_CALLBACK_URL`. The function appends the callback secret as a query parameter. Rotate that secret if the URL is exposed.
