import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '../../../../lib/supabaseServer';
import { structureResume } from '../../../../lib/gemini';

export const maxDuration = 60;

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
      // Import the internal module path, not the package root — pdf-parse's
      // main entry file has leftover debug code that tries to open a test
      // fixture file that doesn't exist once deployed, crashing on every
      // real upload in serverless environments like Vercel. This path
      // skips that broken code entirely.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const result = await pdfParse(buffer);
      rawText = result.text;
    } else {
      return NextResponse.json({ error: 'Please upload a .pdf or .docx file.' }, { status: 400 });
    }
  } catch (e) {
    console.error('Resume text extraction failed:', e);
    return NextResponse.json({ error: 'Could not read that file. Try saving it again and re-uploading. (' + String(e).slice(0, 150) + ')' }, { status: 500 });
  }

  if (!rawText || rawText.trim().length < 50) {
    return NextResponse.json({ error: 'Could not find readable text in that file — it may be a scanned image rather than real text.' }, { status: 400 });
  }

  try {
    const factBank = await structureResume(rawText.slice(0, 15000));
    return NextResponse.json({ factBank });
  } catch (e) {
    console.error('Resume structuring failed:', e);
    const errStr = String(e);
    const friendlyMessage = errStr.includes('503') || errStr.includes('high demand')
      ? 'Google\'s AI service is temporarily overloaded. This usually clears up within a minute or two — please try uploading again shortly.'
      : 'Resume text was extracted, but structuring it failed. (' + errStr.slice(0, 150) + ')';
    return NextResponse.json({ error: friendlyMessage }, { status: 500 });
  }
}
