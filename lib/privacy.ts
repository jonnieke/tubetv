import { supabase } from './supabase';

export async function exportAccountData() {
  const { data, error } = await supabase.functions.invoke('account-data', {
    body: { action: 'export' },
  });
  if (error) throw error;
  return data;
}

export async function deleteAccount(confirmation: string) {
  const { data, error } = await supabase.functions.invoke('account-data', {
    body: { action: 'delete', confirmation },
  });
  if (error) throw error;
  return data;
}
