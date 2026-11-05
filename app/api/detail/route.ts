import { NextResponse } from 'next/server';
import { detail } from '@/lib/scraper/detail';
import { ApiError } from '@/lib/scraper/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get('target');

  if (!target) return NextResponse.json({ ok: false, error: 'Parameter target is required' }, { status: 400 });

  try {
    const res = await detail(target);
    // Do not return full XML by default; include it only when requested
    const includeXml = url.searchParams.get('xml') === '1';
    const payload = { ...res, xml: includeXml ? res.xml : undefined, xmlBytes: res.bytes };
    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status || 502 : 500;
    return NextResponse.json({ ok: false, error: err.message || 'Detail fetch failed', code: (err as any)?.code }, { status });
  }
}
