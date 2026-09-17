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

  const { data: profile } = await supabase.from('user_profiles').select('fact_bank').eq('user_id', user.id).single();
  const factBank = profile?.fact_bank;
  if (!factBank) return NextResponse.json({ error: 'Fill in your profile first.' }, { status: 400 });

  const result = await suggestRoles(factBank);

  const rows = [
    ...(result.suggestedRoles || []).map((r: any) => ({
      user_id: user.id, suggestion_type: 'role', title: r.title, rationale: r.rationale
    })),
    ...(result.suggestedCompanies || []).map((c: any) => ({
      user_id: user.id, suggestion_type: 'company', title: c.name, rationale: c.rationale
    }))
  ];

  if (rows.length) {
    const { error } = await supabase.from('role_suggestions').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added: rows.length });
}
