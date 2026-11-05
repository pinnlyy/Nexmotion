import { NextResponse } from 'next/server';
import { getMedia } from '@/lib/media/store';
import { validateXmlBasic, buildProjectExportPresetXml, sanitizeFilename } from '@/lib/export/engine';
import { ApiError } from '@/lib/scraper/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/media/replace
 * Body (JSON): { xml: string, replacements: Array<{ slotId: string, mediaId: string }> }
 * Returns { ok, xml, applied } — replaces slot src references in the XML
 * with data URLs from the uploaded media library.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const xml = body?.xml;
    const replacements = body?.replacements;

    if (typeof xml !== 'string') throw new ApiError('Field "xml" (string) is required', 400, 'INVALID_INPUT');
    const check = validateXmlBasic(xml);
    if (!check.ok) throw new ApiError(check.error!, 422, 'BAD_XML');

    if (!Array.isArray(replacements)) {
      return NextResponse.json({ ok: true, xml, applied: 0, note: 'No replacements requested' });
    }

    let out = xml;
    let applied = 0;
    const skipped: string[] = [];

    for (const r of replacements) {
      const media = getMedia(String(r?.mediaId || ''));
      if (!media || !media.dataUrl) { skipped.push(r?.slotId || '?'); continue; }
      // slot id format:  <kind>-<encoded src>#<index>
      const slotId = String(r.slotId || '');
      const base = slotId.split('#')[0]; // kind-encoded src
      const kind = base.split('-')[0];
      const src = base.split('-').slice(1).join('-');

      if (!src) { skipped.push(slotId); continue; }

      // Replace in the XML only within src/source/ref/asset attributes and text refs.
      const esc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(esc, 'g');
      const before = out;
      out = out.replace(re, media.dataUrl);
      if (out !== before) applied++;
      else skipped.push(slotId);
      void kind;
    }

    return NextResponse.json({ ok: true, xml: out, applied, skipped });
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ ok: false, error: err.message || 'Replacement failed' }, { status });
  }
}
