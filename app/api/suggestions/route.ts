import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabaseServer';

export const maxDuration = 15;

// Deterministic fallback: works even when Gemini's free quota is exhausted.
// Suggestions are target roles/employers, not verified live vacancies.
function localSuggestions(facts: string) {
  const f = facts.toLowerCase();
  const hasSupply = /supply chain|procurement|manufactur|logistics|operations/.test(f);
  const roles = [
    { title: 'Director / Head of AI & Machine Learning', rationale: 'Targets enterprise AI leadership, model delivery, and team leadership supported by your profile.' },
    { title: 'Director / Head of Data Science', rationale: 'Aligns with applied data science leadership and delivering analytics or ML solutions.' },
    { title: 'Director / Head of Data & Analytics', rationale: 'Relevant where the remit combines analytics strategy, delivery, governance, and stakeholder leadership.' },
    { title: 'Head of Generative AI / AI Transformation', rationale: 'Targets organizations scaling GenAI use cases, governance, and production deployment.' },
    { title: 'AI & Data Strategy / Transformation Director', rationale: 'Targets roles connecting business strategy with enterprise AI and data execution.' },
    ...(hasSupply ? [{ title: 'Director / Head of Supply Chain AI & Digital Transformation', rationale: 'Connects AI and analytics leadership with supply-chain, procurement, or operations experience.' }] : []),
    { title: 'AI / Data Science Consulting Director', rationale: 'Relevant for consulting roles leading AI/data programs, client delivery, and multidisciplinary teams.' },
  ];
  const companies = [
    { name: 'Accenture', rationale: 'Target for AI, data, supply-chain transformation, and consulting leadership opportunities in India.' },
    { name: 'Deloitte India', rationale: 'Target for enterprise AI, analytics, and transformation consulting roles.' },
    { name: 'Tata Consultancy Services (TCS)', rationale: 'Target for AI, data science, and enterprise transformation leadership roles.' },
    { name: 'Wipro', rationale: 'Target for AI, analytics, and digital transformation leadership roles.' },
    { name: 'Infosys / Infosys Consulting', rationale: 'Target for AI, data, and business transformation leadership opportunities.' },
    { name: 'Capgemini India', rationale: 'Target for AI, data, and supply-chain transformation leadership roles.' },
    { name: 'Large Indian enterprises in manufacturing, FMCG, and logistics', rationale: 'Target industry employers where AI/data leadership can support operations and supply-chain outcomes.' },
  ];
  return { suggestedRoles: roles, suggestedCompanies: companies };
}

// GET: list this user's current suggestions.
export async function GET() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data, error } = await supabase
    .from('role_suggestions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suggestions: data });
}

// POST: generate fresh suggestions from this user's fact bank.
export async function POST() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
  const { data: profile, error: profileError } = await supabase.from('user_profiles').select('fact_bank').eq('user_id', user.id).single();
  if (profileError) return NextResponse.json({ error: `Could not load your profile: ${profileError.message}` }, { status: 500 });
  const factBank = profile?.fact_bank;
  if (!factBank || !String(factBank).trim()) return NextResponse.json({ error: 'Please complete and save your profile first.' }, { status: 400 });

  // No Gemini call: deterministic suggestions avoid quota failures.
  const result = localSuggestions(String(factBank));
  if (!result || (!Array.isArray(result.suggestedRoles) && !Array.isArray(result.suggestedCompanies))) {
    return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 });
  }

  const rows = [
    ...(result.suggestedRoles || []).filter((r: any) => typeof r?.title === 'string' && r.title.trim()).map((r: any) => ({
      user_id: user.id, suggestion_type: 'role', title: r.title.trim(), rationale: String(r.rationale || '').slice(0, 500)
    })),
    ...(result.suggestedCompanies || []).filter((c: any) => typeof c?.name === 'string' && c.name.trim()).map((c: any) => ({
      user_id: user.id, suggestion_type: 'company', title: c.name.trim(), rationale: String(c.rationale || '').slice(0, 500)
    }))
  ];
  if (!rows.length) return NextResponse.json({ error: 'No usable suggestions were returned. Please try again.' }, { status: 502 });

  if (rows.length) {
    const { error } = await supabase.from('role_suggestions').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added: rows.length });
  } catch (e) {
    console.error('Suggestion generation failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Suggestion generation failed. Please try again.' }, { status: 500 });
  }
}
