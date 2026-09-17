import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, BorderStyle, HeadingLevel } from 'docx';
import { getSupabaseServer } from '../../../lib/supabaseServer';
import { fetchJobDescriptionText } from '../../../lib/jobSources';
import { tailorCV } from '../../../lib/gemini';

export const maxDuration = 60;

const NAVY = '16283D';
const GOLD = 'A9863F';
const DARK = '222222';

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24, color: NAVY, font: 'Calibri' })]
  });
}
function bodyPara(text: string) {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, size: 21, color: DARK, font: 'Calibri' })] });
}
function bullet(text: string) {
  return new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text, size: 21, color: DARK, font: 'Calibri' })] });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  const { data: profile } = await supabase.from('user_profiles').select('fact_bank, display_name').eq('user_id', user.id).single();
  const factBank = profile?.fact_bank;
  if (!factBank) return NextResponse.json({ error: 'No fact bank saved — fill in your profile first.' }, { status: 400 });

  const { data: job, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const jdText = await fetchJobDescriptionText(job.jd_link);
  const tailored = await tailorCV(factBank, jdText, job.job_title, job.company);
  const name = (profile?.display_name || 'Your Name').toUpperCase();

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: name, bold: true, size: 44, color: NAVY, font: 'Calibri' })] }),
        sectionHeading('Profile Summary'),
        bodyPara(tailored.profileSummary || ''),
        sectionHeading('Core Competencies'),
        bodyPara((tailored.coreCompetencies || []).join('   •   ')),
        sectionHeading('Relevant Experience Highlights'),
        ...(tailored.experienceBullets || []).map((b: string) => bullet(b)),
        ...(tailored.gaps && tailored.gaps.length
          ? [sectionHeading('Honest Gaps To Be Ready For (not phrased into the CV)'), ...tailored.gaps.map((g: string) => bullet(g))]
          : [])
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);

  await supabase
    .from('job_assessments')
    .upsert({ user_id: user.id, job_id: jobId, status: 'CV generated — review, then apply yourself', match_notes: tailored.matchNotes }, { onConflict: 'user_id,job_id' });

  const filename = `CV_${job.company.replace(/[^a-zA-Z0-9]/g, '')}_${job.job_title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}.docx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
