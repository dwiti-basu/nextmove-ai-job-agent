'use client';

import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../lib/supabaseBrowser';

export default function AppShell({
  active,
  children
}: {
  active: 'dashboard' | 'hidden-market' | 'profile';
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="app-shell">
      <div className="rail">
        <div className="rail-brand">Next<span>Move</span></div>

        <nav className="rail-nav">
          <a href="/" className={`rail-link ${active === 'dashboard' ? 'active' : ''}`}>Job sweep</a>
          <a href="/#hidden-market" className={`rail-link ${active === 'hidden-market' ? 'active' : ''}`}>Hidden market</a>
          <a href="/profile" className={`rail-link ${active === 'profile' ? 'active' : ''}`}>Your profile</a>
        </nav>

        <div className="rail-foot">
          NextMove never applies or sends anything for you. It scans, scores, and drafts — you
          take the final step, every time.
          <div style={{ marginTop: 16 }}>
            <button onClick={signOut} style={{ background: 'none', border: 'none', color: '#B7C2D0', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="main">{children}</div>
    </div>
  );
}
