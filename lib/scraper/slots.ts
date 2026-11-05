/**
 * Media slot system — identifies replaceable media references inside
 * Alight Motion preset XML.
 *
 * Strategy: locate every element that carries a media source attribute,
 * plus plain URL-shaped values, then classify by media type. Slots are
 * keyed so the Player / Media Manager can perform deterministic replacement.
 */
import { parseProjectMeta } from './detail';

export type SlotKind = 'image' | 'video' | 'audio';

export interface MediaSlot {
  id: string;
  kind: SlotKind;
  slotName: string;
  src: string;
  originalName: string;
  element: 'img' | 'video' | 'audio' | 'asset' | 'unknown';
  index: number;
}

const IMG_RE = /\.(jpe?g|png|webp|gif|bmp)(\?|#|["'\s>]|$)/i;
const VID_RE = /\.(mp4|mov|webm|mkv|avi)(\?|#|["'\s>]|$)/i;
const AUD_RE = /\.(mp3|wav|aac|ogg|m4a|flac)(\?|#|["'\s>]|$)/i;

function classify(src: string): SlotKind | null {
  if (IMG_RE.test(src)) return 'image';
  if (VID_RE.test(src)) return 'video';
  if (AUD_RE.test(src)) return 'audio';
  return null;
}

function tagName(node: string): string {
  return (node.match(/<([\w:-]+)/)?.[1] || 'unknown').toLowerCase();
}

function attrOf(node: string, name: string): string | null {
  const m = node.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
}

function baseName(src: string): string {
  try {
    const u = new URL(src, 'https://x.invalid');
    return decodeURIComponent(u.pathname.split('/').pop() || 'media');
  } catch {
    return src.split('/').pop() || 'media';
  }
}

/**
 * getSlots(presetTarget) — extract replaceable media slots from XML.
 */
export function getSlots(xml: string, projectTarget?: string): MediaSlot[] {
  if (!xml || xml.length < 20) return [];

  // Identify elements that carry references
  const tagPattern =
    /<(?:img|image|video|audio|sound|asset|clip|media|resource|photo|file|src)\b[^>]*\/?>/gi;
  const nodes = xml.match(tagPattern) || [];

  const slots: MediaSlot[] = [];
  const seen = new Map<string, number>();

  for (const node of nodes) {
    const tag = tagName(node);
    const sources = [
      attrOf(node, 'src') || attrOf(node, ':src') || attrOf(node, 'source') ||
      attrOf(node, 'ref') || attrOf(node, 'asset') || attrOf(node, 'file'),
    ].filter((s): s is string => typeof s === 'string' && s.length > 3);

    for (const src of sources) {
      let kind: SlotKind | null = /img|image|photo|resource/i.test(tag) ? 'image'
        : /video|clip/i.test(tag) ? 'video'
        : /audio|sound/i.test(tag) ? 'audio'
        : classify(src);
      if (!kind) continue;

      const name = attrOf(node, 'name') || attrOf(node, ':name') || '';
      const id = `${kind}-${src}`;
      const idx = seen.get(id) || 0;
      seen.set(id, idx + 1);

      slots.push({
        id: `${id}#${idx}`,
        kind,
        slotName: name || baseName(src).replace(/\.[^.]+$/, '') || `${kind}-slot`,
        src,
        originalName: baseName(src),
        element: (tag.includes('img') || tag.includes('image') || tag.includes('photo') ? 'img'
          : tag.includes('video') || tag.includes('clip') ? 'video'
          : tag.includes('audio') || tag.includes('sound') ? 'audio'
          : 'asset'),
        index: idx,
      });
    }
  }

  // Fallback: find bare URLs in text nodes if slots are sparse
  if (slots.length < 1) {
    const urlRe = /https?:\/\/[^\s"'<>&]+\.(?:jpe?g|png|webp|gif|mp4|mov|mp3|wav|aac|m4a)(\?[^\s"'<>&]*)?/gi;
    let m: RegExpExecArray | null;
    const seen2 = new Set<string>();
    let i = 0;
    while ((m = urlRe.exec(xml)) !== null && i < 60) {
      const src = m[0];
      const key = src.toLowerCase();
      if (seen2.has(key)) continue;
      seen2.add(key);
      const kind = classify(src)!;
      slots.push({
        id: `${kind}-bare-${i}`,
        kind,
        slotName: baseName(src).replace(/\.[^.]+$/, ''),
        src,
        originalName: baseName(src),
        element: 'unknown',
        index: i++,
      });
    }
  }

  // Deduplicate identical (kind + src) pairs, keeping index variants
  const finalMap = new Map<string, MediaSlot>();
  for (const s of slots) {
    const key = `${s.kind}|${s.src}`;
    if (finalMap.has(key)) continue;
    finalMap.set(key, s);
  }
  return Array.from(finalMap.values());
}

/** Project-safe slot/storage keys used by the media manager. */
export function slotStorageKey(projectId: string, slotId: string) {
  return `${projectId}__${slotId}`.replace(/[^\w.-]/g, '_');
}
