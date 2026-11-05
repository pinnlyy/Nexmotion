import { NextResponse } from 'next/server';
import { validateMediaFile, addMedia, listMedia, removeMedia, MAX_FILE_BYTES, safeFilename, formatBytes } from '@/lib/media/store';
import { ApiError } from '@/lib/scraper/api';

export const dynamic = 'force-dynamic';

// Simple in-process rate limit for uploads
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) { buckets.set(ip, { count: 1, resetAt: now + windowMs }); return true; }
  b.count++;
  return b.count <= limit;
}

export async function GET() {
  const items = listMedia();
  return NextResponse.json({ ok: true, items: items.map(({ dataUrl, ...rest }) => rest) });
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many uploads. Try again in a minute.' }, { status: 429 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file') as unknown as { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | null;
    if (!file) return NextResponse.json({ ok: false, error: 'Field "file" is required' }, { status: 400 });

    const validation = validateMediaFile({ name: file.name, type: file.type, size: file.size });
    if (!validation.valid) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    if (buf.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: `File exceeds max size of ${formatBytes(MAX_FILE_BYTES)}` }, { status: 413 });
    }

    // Build a data URL for storing/previewing (amounts capped at 50MB)
    const dataUrl = `data:${file.type};base64,${Buffer.from(buf).toString('base64')}`;
    const rec = addMedia({
      kind: validation.kind!,
      name: safeFilename(file.name),
      ext: validation.ext!,
      size: buf.byteLength,
      dataUrl,
    });

    return NextResponse.json({
      ok: true,
      item: { id: rec.id, kind: rec.kind, name: rec.name, ext: rec.ext, size: rec.size, dataUrl },
    }, { status: 201 });
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ ok: false, error: err?.message || 'Upload failed' }, { status });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'Parameter id is required' }, { status: 400 });
  const ok = removeMedia(id);
  return NextResponse.json({ ok, error: ok ? undefined : 'Media not found' }, { status: ok ? 200 : 404 });
}
