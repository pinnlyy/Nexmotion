import { NextResponse } from 'next/server';
import { detail } from '@/lib/scraper/detail';
import { getSlots } from '@/lib/scraper/slots';
import { ApiError } from '@/lib/scraper/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get('target');

  if (!target) {
    return NextResponse.json(
      { ok: false, error: 'Parameter target is required' },
      { status: 400 }
    );
  }

  try {
    const res = await detail(target);
    const slots = getSlots(res.xml, target);

    return NextResponse.json({
      ok: true,
      target,
      slots,
      project: {
        title: res.title,
        fps: res.fps,
        resolution: `${res.width}x${res.height}`,
        durationSec: res.durationSec,
      },
    });
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status || 502 : 500;

    return NextResponse.json(
      { ok: false, error: err.message || 'Slot extraction failed' },
      { status }
    );
  }
}
