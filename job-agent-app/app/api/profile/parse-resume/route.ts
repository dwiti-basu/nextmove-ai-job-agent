import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabaseServer';
import { structureResume } from '../../../../lib/gemini';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let rawText = '';

  try {
    if (file.name.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      rawText = result.text;
    } else {
      return NextResponse.json({ error: 'Please upload a .pdf or .docx file.' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Could not read that file. Try saving it again and re-uploading.' }, { status: 500 });
  }

  if (!rawText || rawText.trim().length < 50) {
    return NextResponse.json({ error: 'Could not find readable text in that file — it may be a scanned image rather than real text.' }, { status: 400 });
  }

  try {
    const structured = await structureResume(rawText.slice(0, 15000));
    return NextResponse.json({ factBank: structured.factBank });
  } catch (e) {
    return NextResponse.json({ error: 'Resume text was extracted, but structuring it failed. Try again.' }, { status: 500 });
  }
}
