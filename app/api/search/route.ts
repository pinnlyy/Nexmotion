import { NextResponse } from 'next/server';
import { search } from '@/lib/scraper/search';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';
  const mode = (url.searchParams.get('mode') || 'fast') as 'fast' | 'deep';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.min(50, Number(url.searchParams.get('limit') || 20));

  if (!q.trim()) return NextResponse.json({ ok: false, error: 'Query parameter q is required' }, { status: 400 });

  const res = await search(q, { mode, page, limit });
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
