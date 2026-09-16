import { NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabaseServer';

export async function GET() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Shared job pool, left-joined with this user's own assessment of each —
  // so the same posting can show a different fit score for a different person.
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .order('date_found', { ascending: false })
    .limit(200);
  if (jobsError) return NextResponse.json({ error: jobsError.message }, { status: 500 });

  const { data: assessments } = await supabase
    .from('job_assessments')
    .select('*')
    .eq('user_id', user.id);

  const byJobId = new Map((assessments || []).map(a => [a.job_id, a]));

  const merged = (jobs || []).map(j => {
    const a = byJobId.get(j.id);
    return {
      job_id: j.id,
      assessment_id: a?.id || null,
      job_title: j.job_title,
      company: j.company,
      jd_link: j.jd_link,
      source: j.source,
      fit_score: a?.fit_score || null,
      match_notes: a?.match_notes || null,
      status: a?.status || 'Not yet scored'
    };
  });

  return NextResponse.json({ jobs: merged });
}
