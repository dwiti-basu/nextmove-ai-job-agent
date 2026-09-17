import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabaseServer';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { action } = await req.json(); // 'accept' | 'dismiss'

  const { data: suggestion, error } = await supabase
    .from('role_suggestions')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (error || !suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });

  if (action === 'dismiss') {
    await supabase.from('role_suggestions').update({ status: 'Dismissed' }).eq('id', params.id);
    return NextResponse.json({ ok: true });
  }

  // Accept: role suggestions feed the shared scanner's search terms;
  // company suggestions become a private target for this user's hidden
  // market outreach.
  if (suggestion.suggestion_type === 'role') {
    await supabase.from('search_terms').insert({ term: suggestion.title, added_by_user_id: user.id }).select();
    // Duplicate terms fail silently on the unique constraint — expected.
  } else {
    await supabase.from('target_companies').insert({
      user_id: user.id,
      company_name: suggestion.title,
      why_targeted: suggestion.rationale
    });
  }

  await supabase.from('role_suggestions').update({ status: 'Accepted' }).eq('id', params.id);
  return NextResponse.json({ ok: true });
}
