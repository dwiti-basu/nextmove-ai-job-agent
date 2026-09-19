import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { suggestRoles } from '../../../lib/gemini';

export const maxDuration = 60;

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

  const result = await suggestRoles(String(factBank));
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
