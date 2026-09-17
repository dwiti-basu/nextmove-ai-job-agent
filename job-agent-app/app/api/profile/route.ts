import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabaseServer';

export async function GET() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
  return NextResponse.json({ profile: data || { fact_bank: '', display_name: '' } });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { factBank, displayName } = await req.json();

  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: user.id, fact_bank: factBank, display_name: displayName, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
