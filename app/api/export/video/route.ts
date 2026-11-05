import { NextResponse } from 'next/server';
import { renderPresetVideo } from '@/lib/scraper/renderer';
import { getHeadlessRenderer } from '@/lib/renderer/core';
import { ApiError } from '@/lib/scraper/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/export/video
 * Body: { presetTarget: string (url or xml), width, height, fps, quality, format, includeAudio }
 * Returns { ok, spec, nextStep } — the browser Player executes the actual render
 * (WebCodecs / MediaRecorder). If a headless Chromium+FFmpeg worker is provisioned,
 * this route initiates server-side rendering instead.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const presetTarget = body?.presetTarget;
    if (!presetTarget) throw new ApiError('Field "presetTarget" is required', 400, 'INVALID_INPUT');

    const res = await renderPresetVideo(presetTarget, {
      width: body?.width,
      height: body?.height,
      fps: body?.fps,
      quality: body?.quality,
      format: body?.format,
      includeAudio: body?.includeAudio,
      slotReplacements: body?.slotReplacements,
    });

    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 502 });

    return NextResponse.json({
      ok: true,
      spec: res.spec,
      nextStep: res.nextStep,
      serverResult: res.result ? { ok: res.result.ok, error: res.result.error, bytes: res.result.bytes, format: res.result.format } : undefined,
    });
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ ok: false, error: err.message || 'Video export failed' }, { status });
  }
}

export async function GET() {
  const avail = getHeadlessRenderer().available();
  return NextResponse.json({
    ok: true,
    serverRenderer: { available: avail, name: getHeadlessRenderer().name },
    clientRenderer: { available: true, name: 'webcodecs-mediacomponent' },
  });
}
