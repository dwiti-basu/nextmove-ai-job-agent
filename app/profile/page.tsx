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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [hasExistingFacts, setHasExistingFacts] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        const existing = d.profile?.fact_bank;
        setFactBank(existing || TEMPLATE);
        setHasExistingFacts(!!existing);
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
    setHasExistingFacts(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (hasExistingFacts && factBank.trim() && factBank !== TEMPLATE) {
      const confirmed = window.confirm(
        'This will replace your current fact bank below with a version generated from the uploaded file. ' +
        'Your existing text will be overwritten (though not saved until you click "Save profile"). Continue?'
      );
      if (!confirmed) {
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/profile/parse-resume', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Something went wrong reading that file.');
      } else {
        setFactBank(data.factBank);
      }
    } catch {
      setUploadError('Upload failed — this can happen if Google\'s AI service was briefly overloaded and the request ran long. Please try uploading again.');
    }
    setUploading(false);
    e.target.value = '';
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

      <div style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>Already have a resume?</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          Upload a PDF or Word file and it'll be converted into the fact bank format below automatically.
          Always review the result before saving — the conversion stays strictly grounded in what your
          resume actually says, but you're the final check on accuracy.
        </div>
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={handleUpload}
          disabled={uploading}
          style={{ fontSize: 13.5 }}
        />
        {uploading && <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8 }}>Reading and structuring your resume…</div>}
        {uploadError && <div className="auth-error" style={{ marginTop: 10 }}>{uploadError}</div>}
      </div>

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
