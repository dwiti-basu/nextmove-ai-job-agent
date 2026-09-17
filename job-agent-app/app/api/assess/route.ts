import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { fetchJobDescriptionText } from '../../../lib/jobSources';
import { assessRelevance } from '../../../lib/gemini';

export const maxDuration = 60;

export async function POST() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('fact_bank').eq('user_id', user.id).single();
  const factBank = profile?.fact_bank;
  if (!factBank) {
    return NextResponse.json({ error: 'No fact bank saved yet — fill in your profile first.' }, { status: 400 });
  }

  // Jobs this user hasn't been scored against yet.
  const { data: allJobs } = await supabase.from('jobs').select('id, job_title, company, jd_link').limit(200);
  const { data: existing } = await supabase.from('job_assessments').select('job_id').eq('user_id', user.id);
  const alreadyScored = new Set((existing || []).map(e => e.job_id));
  const toScore = (allJobs || []).filter(j => !alreadyScored.has(j.id)).slice(0, 20);

  let assessed = 0;
  for (const job of toScore) {
    try {
      const jdText = await fetchJobDescriptionText(job.jd_link);
      const result = await assessRelevance(factBank, jdText, job.job_title, job.company);
      await supabase.from('job_assessments').insert({
        user_id: user.id,
        job_id: job.id,
        fit_score: result.fitScore,
        match_notes: result.notes,
        status: 'Assessed'
      });
      assessed++;
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error('Assessment failed for job', job.id, e);
    }
  }

  return NextResponse.json({ assessed });
}
