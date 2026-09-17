import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { draftOutreach } from '../../../lib/gemini';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { targetCompanyId, recipientRole } = await req.json();
  if (!targetCompanyId) return NextResponse.json({ error: 'targetCompanyId required' }, { status: 400 });

  const { data: profile } = await supabase.from('user_profiles').select('fact_bank').eq('user_id', user.id).single();
  const factBank = profile?.fact_bank;
  if (!factBank) return NextResponse.json({ error: 'No fact bank saved — fill in your profile first.' }, { status: 400 });

  const { data: target, error } = await supabase
    .from('target_companies')
    .select('*')
    .eq('id', targetCompanyId)
    .eq('user_id', user.id)
    .single();
  if (error || !target) return NextResponse.json({ error: 'Target company not found' }, { status: 404 });

  const draft = await draftOutreach(
    factBank,
    target.company_name,
    target.why_targeted || '',
    target.likely_signal || '',
    recipientRole || 'Hiring Manager / HR Leader'
  );

  const { data: saved, error: saveError } = await supabase
    .from('outreach_drafts')
    .insert({
      user_id: user.id,
      target_company_id: targetCompanyId,
      recipient_role: recipientRole || 'Hiring Manager / HR Leader',
      subject: draft.subject,
      message_body: draft.messageBody
    })
    .select()
    .single();

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  await supabase.from('target_companies').update({ status: 'Draft Ready' }).eq('id', targetCompanyId);

  return NextResponse.json({ draft: saved });
}
