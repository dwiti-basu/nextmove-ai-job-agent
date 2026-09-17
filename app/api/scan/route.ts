import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseServer';
import { fetchGreenhouseJobs, fetchLeverJobs, fetchWebSearchJobs } from '../../../lib/jobSources';

export const maxDuration = 60;

// Writes to the SHARED jobs pool — one scan benefits every signed-in user,
// since the same posting is the same posting no matter who's looking at it.
// Uses the admin (service role) client because this is a trusted, unscoped
// write, not a per-user action.
export async function POST() {
  const supabase = getSupabaseAdmin();

  // Pull the shared, growing list of role terms — built from suggestions
  // people have accepted — instead of a fixed list baked into code.
  const { data: termRows } = await supabase.from('search_terms').select('term');
  const roleTerms = (termRows || []).map(t => t.term);

  const [webResult, ghJobs, leverJobs] = await Promise.all([
    fetchWebSearchJobs(roleTerms),
    fetchGreenhouseJobs(),
    fetchLeverJobs()
  ]);
  const webJobs = webResult.jobs;
  const allJobs = [...webJobs, ...ghJobs, ...leverJobs];

  let inserted = 0;
  for (const job of allJobs) {
    const { error } = await supabase
      .from('jobs')
      .insert({ job_title: job.title, company: job.company, location: job.location, jd_link: job.link, source: job.source })
      .select();
    if (!error) inserted++; // duplicates silently fail on the unique jd_link constraint — expected
  }

  return NextResponse.json({
    scanned: allJobs.length,
    inserted,
    breakdown: { webSearch: webJobs.length, greenhouse: ghJobs.length, lever: leverJobs.length },
    webSearchErrors: webResult.errors // if this is non-empty, that's the real reason webSearch is 0
  });
}
