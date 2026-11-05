import { NextResponse } from 'next/server';
import { finder } from '@/lib/scraper/search';
import { ApiError } from '@/lib/scraper/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const input = url.searchParams.get('input') || url.searchParams.get('q') || '';
  const mode = (url.searchParams.get('mode') || 'fast') as 'fast' | 'deep';

  if (!input.trim()) return NextResponse.json({ ok: false, error: 'Parameter input is required' }, { status: 400 });

  try {
    const res = await finder(input, { mode });
    return NextResponse.json(res, { status: res.ok ? 200 : 502 });
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status || 502 : 500;
    return NextResponse.json({ ok: false, error: err.message || 'Finder failed' }, { status });
  }
}
