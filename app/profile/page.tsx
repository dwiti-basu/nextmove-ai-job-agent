'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';

const TEMPLATE = `YOUR NAME — VERIFIED FACT BANK
(Only facts written here will ever be used to score jobs or tailor your CV.
Nothing is invented beyond what you write below — be as specific as you can.)

=== IDENTITY ===
Name:
Location:
Email:
Phone:
LinkedIn:

=== HEADLINE FACTS ===
- Years of experience, industries, current role in one or two lines

=== [COMPANY NAME] — [TITLE] (dates) ===
- Bullet-point achievements, as specific and quantified as possible

=== TECHNICAL SKILLS / TOOLS ===
-

=== EDUCATION ===
-

=== EXPLICITLY NOT TRUE — NEVER CLAIM THESE ===
- List anything you want the AI to actively avoid claiming for you —
  degrees you don't have, tools you haven't used, industries you haven't
  worked in. This section is what keeps your CVs honest.
`;

export default function ProfilePage() {
  const [factBank, setFactBank] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setFactBank(d.profile?.fact_bank || TEMPLATE);
        setDisplayName(d.profile?.display_name || '');
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factBank, displayName })
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <AppShell active="profile">
      <h1 className="page-title">Your profile</h1>
      <p className="page-sub">
        This fact bank is private to you and is the only source of truth NextMove uses when
        scoring jobs or tailoring a CV for you. Nothing is invented beyond what you write here —
        the more specific you are, the more honest and useful the output will be.
      </p>

      <label className="auth-field-label">Display name</label>
      <input className="field" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ maxWidth: 320, marginBottom: 20 }} />

      <label className="auth-field-label">Fact bank</label>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <textarea className="field" value={factBank} onChange={e => setFactBank(e.target.value)} />
      )}

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {saved && <span style={{ color: '#1F6B54', fontSize: 13.5 }}>Saved.</span>}
      </div>
    </AppShell>
  );
}
