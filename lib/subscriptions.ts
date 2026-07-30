import { supabase } from './supabase';

export const SUBSCRIPTION_PLANS = {
  daily: { code: 'daily', label: 'Daily Pass', amountKes: 10, description: '24 hours of premium access' },
  weekly: { code: 'weekly', label: 'Weekly Pass', amountKes: 50, description: '7 days of premium access' },
  monthly: { code: 'monthly', label: 'Monthly Pass', amountKes: 249, description: '30 days of premium access' },
} as const;

export type SubscriptionPlanCode = keyof typeof SUBSCRIPTION_PLANS;

export interface ActiveSubscription {
  id: string;
  tier: string;
  end_date: string | null;
  is_active: boolean;
}

export async function fetchActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, tier, end_date, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function startMpesaPayment(planCode: SubscriptionPlanCode) {
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
    body: { planCode },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.transaction as {
    id: string;
    status: string;
    checkoutRequestId?: string;
    message?: string;
  };
}

export async function fetchPaymentStatus(transactionId: string) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('id, status, result_description')
    .eq('id', transactionId)
    .single();
  if (error) throw error;
  return data as { id: string; status: string; result_description: string | null };
}
