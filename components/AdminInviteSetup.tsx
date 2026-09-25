import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SetupState = 'checking' | 'ready' | 'saving' | 'complete' | 'invalid';

export default function AdminInviteSetup() {
  const [state, setState] = useState<SetupState>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!active) return;
      if (userError || !data.user?.email) {
        setState('invalid');
        return;
      }
      setEmail(data.user.email);
      setState('ready');
    }).catch(() => { if (active) setState('invalid'); });
    return () => { active = false; };
  }, []);

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 12) { setError('Use at least 12 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setState('saving');
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setState('ready');
      return;
    }
    setPassword('');
    setConfirmation('');
    await supabase.auth.signOut();
    setState('complete');
  };

  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
    <section className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl" aria-labelledby="setup-title">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-600/15 text-red-500"><ShieldCheck size={24} /></div>
      <h1 id="setup-title" className="text-2xl font-bold">Set up TubeTV admin</h1>
      {state === 'checking' && <p className="mt-4 text-zinc-300">Checking your invitation…</p>}
      {state === 'invalid' && <p role="alert" className="mt-4 text-zinc-300">This invitation is invalid or has expired. Ask the project owner to send a new one.</p>}
      {state === 'complete' && <>
        <p className="mt-4 text-zinc-300">Your password is set. Sign in to TubeTV, then scan the authenticator QR code to finish securing your admin account.</p>
        <a href="/" className="mt-6 inline-flex rounded-lg bg-red-600 px-5 py-3 font-semibold">Go to TubeTV</a>
      </>}
      {(state === 'ready' || state === 'saving') && <form onSubmit={event => { void savePassword(event); }}>
        <p className="mt-4 text-sm text-zinc-300">Invitation for {email}. Choose a unique password; it stays between you and Supabase.</p>
        <label className="mt-6 block text-sm">New password
          <input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 focus:border-red-500 focus:outline-none" />
        </label>
        <label className="mt-4 block text-sm">Confirm new password
          <input type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 focus:border-red-500 focus:outline-none" />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={state === 'saving'} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-bold disabled:opacity-50">{state === 'saving' && <Loader2 className="animate-spin" size={18} />}Set password</button>
      </form>}
    </section>
  </main>;
}
