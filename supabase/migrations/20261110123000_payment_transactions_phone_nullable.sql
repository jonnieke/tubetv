-- Allow card, Apple Pay, and guest checkouts where Kenyan phone number is not supplied upfront
ALTER TABLE public.payment_transactions ALTER COLUMN phone_e164 DROP NOT NULL;
