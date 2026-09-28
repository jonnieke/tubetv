import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isAdminUser } from '../lib/authorization';

interface Props { onSuccess: (user: User) => void; onCancel: () => void }

const AuthModal: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [code, setCode] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { emailRef.current?.focus(); }, []);
  const signIn = async () => {
    if (!isSupabaseConfigured) { setError('Admin sign-in is unavailable until Supabase is configured.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !data.user) { setError(authError?.message || 'Sign-in failed.'); return; }
      if (!isAdminUser(data.user)) {
        await supabase.auth.signOut();
        setError('This account has no TubeTV admin role.');
        return;
      }
      const { data: level, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (levelError) { setError('Unable to verify account security.'); return; }
      if (level.currentLevel === 'aal2') { onSuccess(data.user); return; }
      setPendingUser(data.user);
      if (level.nextLevel === 'aal2') {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        const existing = factors?.totp?.[0];
        if (factorError || !existing) { setError('Unable to find your authenticator. Contact the project owner.'); return; }
        setFactorId(existing.id);
      } else {
        const { data: factor, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TubeTV admin' });
        if (enrollError || !factor?.totp) { setError(enrollError?.message || 'Unable to set up an authenticator.'); return; }
        setFactorId(factor.id);
        setQr(factor.totp.qr_code);
        setSetupKey(factor.totp.secret);
      }
    } catch { setError('Unable to connect to the sign-in service.'); }
    finally { setLoading(false); }
  };
  const verifyFactor = async () => {
    if (!pendingUser || !factorId || !/^\d{6}$/.test(code)) { setError('Enter the six-digit code from your authenticator.'); return; }
    setLoading(true); setError('');
    try {
      const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({factorId,code});
      if (mfaError) { setError(mfaError.message); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!isAdminUser(user)) { setError('Admin role could not be verified.'); return; }
      onSuccess(user!);
    } catch { setError('Could not verify the authenticator code.'); }
    finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
      <button type="button" onClick={onCancel} aria-label="Close sign in" className="absolute right-4 top-4 p-2 text-zinc-500 hover:text-white"><X size={20} /></button>
      <form onSubmit={event => { event.preventDefault(); void (pendingUser ? verifyFactor() : signIn()); }}>
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-600/15 text-red-500"><ShieldCheck size={24} /></div>
        <h2 id="auth-title" className="text-2xl font-bold">Admin access</h2>
        <p className="mt-2 text-sm text-zinc-400">{pendingUser ? (qr ? 'Add TubeTV to your authenticator app by scanning the QR code or entering the setup key manually, then enter its code.' : 'Enter the code from your authenticator app.') : 'Sign in with your TubeTV administrator account.'}</p>
        {pendingUser ? <>
          {qr && <img alt="Authenticator setup QR code" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`} className="mx-auto mt-5 h-40 w-40 bg-white p-2" />}
          {setupKey && <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-medium">Can’t scan the QR code?</p>
            <p className="mt-1 text-xs text-zinc-400">Choose “Enter a setup key” in your authenticator app. Use TubeTV as the account name and a time-based code.</p>
            <div className="mt-3 flex items-center gap-2">
              <input aria-label="Authenticator setup key" readOnly type={showSetupKey ? 'text' : 'password'} value={setupKey} autoComplete="off" className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs tracking-wider" />
              <button type="button" onClick={() => setShowSetupKey(value => !value)} className="rounded border border-zinc-700 px-3 py-2 text-xs hover:border-zinc-500">{showSetupKey ? 'Hide key' : 'Show key'}</button>
            </div>
            <p className="mt-2 text-xs text-amber-300">Keep this key private. It is shown only during setup.</p>
          </div>}
          <label className="mt-5 block text-sm">Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g,'').slice(0,6))} className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 tracking-[.3em] focus:border-red-500 focus:outline-none" /></label>
        </> : <>
          <label className="mt-6 block text-sm">Email<input ref={emailRef} type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 focus:border-red-500 focus:outline-none" /></label>
          <label className="mt-5 block text-sm">Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 focus:border-red-500 focus:outline-none" /></label>
        </>}
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-bold disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}{pendingUser ? 'Verify and open admin' : 'Sign in'}</button>
      </form>
    </div>
  </div>;
};
export default AuthModal;
