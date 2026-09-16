'use client';

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';

interface JobRow {
  assessment_id: string | null;
  job_id: string;
  job_title: string;
  company: string;
  jd_link: string;
  source: string;
  fit_score: string | null;
  match_notes: string | null;
  status: string | null;
}

interface OutreachDraft { id: string; subject: string; message_body: string; }
interface Target { id: string; company_name: string; why_targeted: string; status: string; outreach_drafts: OutreachDraft[]; }

interface Suggestion { id: string; suggestion_type: 'role' | 'company'; title: string; rationale: string; status: string; }

export default function Dashboard() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [newCompany, setNewCompany] = useState('');
  const [newWhy, setNewWhy] = useState('');
  const [newSignal, setNewSignal] = useState('');

  async function loadAll() {
    setLoading(true);
    await fetch('/api/assess', { method: 'POST' }); // score any newly-scanned jobs against this user's own profile
    const [jobsRes, targetsRes, suggestionsRes] = await Promise.all([
      fetch('/api/jobs'), fetch('/api/targets'), fetch('/api/suggestions')
    ]);
    setJobs((await jobsRes.json()).jobs || []);
    setTargets((await targetsRes.json()).targets || []);
    setSuggestions(((await suggestionsRes.json()).suggestions || []).filter((s: Suggestion) => s.status === 'Suggested'));
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function runPipeline() {
    setLoading(true);
    await fetch('/api/scan', { method: 'POST' });
    await fetch('/api/assess', { method: 'POST' });
    await loadAll();
  }

  async function generateCV(jobId: string) {
    setGenerating(jobId);
    const res = await fetch('/api/generate-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CV.docx';
    a.click();
    setGenerating(null);
    await loadAll();
  }

  async function addTarget() {
    if (!newCompany) return;
    await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: newCompany, whyTargeted: newWhy, likelySignal: newSignal })
    });
    setNewCompany(''); setNewWhy(''); setNewSignal('');
    await loadAll();
  }

  async function generateOutreach(targetId: string) {
    setGenerating(targetId);
    await fetch('/api/generate-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCompanyId: targetId, recipientRole: 'Hiring Manager / HR Leader' })
    });
    setGenerating(null);
    await loadAll();
  }

  async function generateSuggestions() {
    setSuggesting(true);
    await fetch('/api/suggestions', { method: 'POST' });
    setSuggesting(false);
    await loadAll();
  }

  async function actOnSuggestion(id: string, action: 'accept' | 'dismiss') {
    await fetch(`/api/suggestions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    await loadAll();
  }

  return (
    <AppShell active="dashboard">
      <h1 className="page-title">Job sweep</h1>
      <p className="page-sub">
        Searches broadly across LinkedIn, Naukri, Indeed, and company career pages, then scores
        each posting against your own profile. Nothing here applies for you — open a posting and
        apply yourself when you're ready.
      </p>

      <h2 className="section-title" style={{ marginTop: 0 }}>Suggested for you</h2>
      <p className="section-sub">
        Reads your profile and proactively suggests roles and companies worth targeting — including
        titles that don't share obvious keywords with your resume but describe the same real work.
        Accept a role to add it to what gets searched for; accept a company to add it to your hidden
        market list.
      </p>
      <button className="btn btn-quiet" onClick={generateSuggestions} disabled={suggesting} style={{ marginBottom: 16 }}>
        {suggesting ? 'Thinking…' : 'Suggest roles and companies for me'}
      </button>

      {suggestions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {suggestions.map(s => (
            <div key={s.id} className="target-card">
              <span className="target-name">{s.suggestion_type === 'role' ? s.title : s.title}</span>
              <span className="target-status">{s.suggestion_type === 'role' ? 'Role' : 'Company'}</span>
              <div className="target-signal">{s.rationale}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => actOnSuggestion(s.id, 'accept')}>
                  {s.suggestion_type === 'role' ? 'Add to search' : 'Add to hidden market'}
                </button>
                <button className="btn btn-quiet" onClick={() => actOnSuggestion(s.id, 'dismiss')}>Not for me</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-primary" onClick={runPipeline} disabled={loading}>
        {loading ? 'Working…' : 'Scan and score now'}
      </button>

      <div style={{ marginTop: 28 }}>
        {jobs.length === 0 && !loading && (
          <div className="empty-state">Nothing scanned yet. Run a scan above, or wait for tomorrow's automatic run at 9am IST.</div>
        )}
        {jobs.map(job => (
          <div key={job.job_id} className={`job-row fit-${job.fit_score || ''}`}>
            <div className="job-main">
              <div className="job-title">{job.job_title}</div>
              <div className="job-company">{job.company} · {job.source === 'web_search' ? 'web search' : 'job board'}</div>
              {job.match_notes && <div className="job-notes">{job.match_notes}</div>}
            </div>
            <div className="job-actions">
              {job.fit_score && <span className="fit-badge">{job.fit_score}</span>}
              <a className="link" href={job.jd_link} target="_blank" rel="noreferrer">View posting</a>
              <button className="btn btn-quiet" onClick={() => generateCV(job.job_id)} disabled={generating === job.job_id}>
                {generating === job.job_id ? 'Generating…' : 'Generate CV'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title" id="hidden-market">Hidden job market</h2>
      <p className="section-sub">
        Add a company you want to reach out to, even without a live posting — the agent drafts a
        message grounded in your profile. It never sends anything; copy the draft and send it
        yourself once you're happy with it.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="field" placeholder="Company name" value={newCompany} onChange={e => setNewCompany(e.target.value)} style={{ width: 180 }} />
        <input className="field" placeholder="Why targeted" value={newWhy} onChange={e => setNewWhy(e.target.value)} style={{ width: 220 }} />
        <input className="field" placeholder="Likely signal" value={newSignal} onChange={e => setNewSignal(e.target.value)} style={{ width: 220 }} />
        <button className="btn btn-primary" onClick={addTarget}>Add target</button>
      </div>

      {targets.length === 0 && <div className="empty-state">No target companies yet — add one above to start drafting outreach.</div>}

      {targets.map(target => (
        <div key={target.id} className="target-card">
          <span className="target-name">{target.company_name}</span>
          <span className="target-status">{target.status}</span>
          <div className="target-signal">{target.why_targeted}</div>
          <button className="btn btn-quiet" onClick={() => generateOutreach(target.id)} disabled={generating === target.id}>
            {generating === target.id ? 'Drafting…' : 'Draft outreach message'}
          </button>
          {target.outreach_drafts?.map(d => (
            <div key={d.id} className="draft-box">
              <div className="draft-subject">{d.subject}</div>
              <div className="draft-body">{d.message_body}</div>
            </div>
          ))}
        </div>
      ))}
    </AppShell>
  );
}
