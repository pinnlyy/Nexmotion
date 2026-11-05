import { NextResponse } from 'next/server';
import { validateXmlBasic, buildProjectExportPresetXml, buildZip, sanitizeFilename, bytesFromDataUrl } from '@/lib/export/engine';
import { getMedia } from '@/lib/media/store';
import { ApiError } from '@/lib/scraper/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/export/preset
 * Body: { xml: string, filename?: string, includeMedia?: boolean, replacements?: Array<{ slotId, mediaId }> }
 * Returns XML file (application/octet-stream) or ZIP archive.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const xml = body?.xml;
    if (typeof xml !== 'string') throw new ApiError('Field "xml" (string) is required', 400, 'INVALID_INPUT');
    const v = validateXmlBasic(xml);
    if (!v.ok) throw new ApiError(v.error!, 422, 'BAD_XML');

    const filename = sanitizeFilename(body.filename || 'nexmotion-project', 'nexmotion-project');
    const includeMedia = !!body.includeMedia;
    const replacements: { slotId: string; mediaId: string }[] = Array.isArray(body.replacements) ? body.replacements : [];

    let outXml = xml;
    const mediaEntries: { name: string; data: Uint8Array }[] = [];

    if (replacements.length) {
      const applied: { original: string; dataUrl: string }[] = [];
      for (const r of replacements) {
        const media = getMedia(String(r?.mediaId || ''));
        if (!media?.dataUrl) continue;
        const slotBase = String(r.slotId || '').split('#')[0];
        const src = slotBase.split('-').slice(1).join('-');
        if (!src) continue;
        applied.push({ original: src, dataUrl: media.dataUrl });
      }
      // Replace src refs with data URLs inside XML
      for (const a of applied) {
        const esc = a.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        outXml = outXml.replace(new RegExp(esc, 'g'), a.dataUrl);
      }
      if (includeMedia) {
        for (const a of applied) {
          mediaEntries.push({ name: `media/${sanitizeFilename(a.original)}`, data: bytesFromDataUrl(a.dataUrl) });
        }
      }
    }

    if (includeMedia && mediaEntries.length === 0 && /\"media\"/i.test(outXml) === false) {
      // no media requested/found — skip ZIP
    }

    if (includeMedia && mediaEntries.length > 0) {
      const zipData = buildZip([...mediaEntries, { name: `${filename}.xml`, data: Buffer.from(outXml, 'utf8') }]);
      return new NextResponse(Buffer.from(zipData), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}.zip"`,
          'X-Nexmotion-Xml-Bytes': String(Buffer.byteLength(outXml)),
        },
      });
    }

    return new NextResponse(Buffer.from(outXml, 'utf8'), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}.xml"`,
      },
    });
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ ok: false, error: err.message || 'Export failed' }, { status });
  }
}
