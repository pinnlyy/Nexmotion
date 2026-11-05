import { NextResponse } from 'next/server';
import { getExportStatus } from '@/lib/export/engine';

export const dynamic = 'force-dynamic';

/** GET /api/export/status?id=<jobId> */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'Parameter id is required' }, { status: 400 });
  const s = getExportStatus(id);
  if (!s) return NextResponse.json({ ok: false, error: 'Export job not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id, ...s });
}
