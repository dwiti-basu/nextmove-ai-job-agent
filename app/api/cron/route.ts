import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// Vercel Cron calls this daily (9am IST, set in vercel.json). It only runs
// the scanner, since scanning writes to the shared job pool and isn't tied
// to any one person. Relevance scoring is per-user (it depends on each
// person's own fact bank), so it runs automatically the next time each
// person opens their dashboard, not from this shared background job.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const scanRes = await fetch(`${base}/api/scan`, { method: 'POST' });
  const scanResult = await scanRes.json();

  return NextResponse.json({ ranAt: new Date().toISOString(), scan: scanResult });
}
