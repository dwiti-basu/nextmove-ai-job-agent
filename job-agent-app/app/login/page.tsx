'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../../lib/supabaseBrowser';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = getSupabaseBrowser();

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setError('Account created. Check your email to confirm, then sign in.');
      setMode('signin');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Next<span>Move</span></div>
        <div className="auth-sub">
          {mode === 'signin' ? 'Sign in to your job search.' : 'Create your account. Your profile and search stay private to you.'}
        </div>

        <form onSubmit={handleSubmit}>
          <label className="auth-field-label">Email</label>
          <input className="field" type="email" required value={email} onChange={e => setEmail(e.target.value)} />

          <label className="auth-field-label">Password</label>
          <input className="field" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-toggle">
          {mode === 'signin' ? (
            <>New here? <button onClick={() => { setMode('signup'); setError(''); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('signin'); setError(''); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
