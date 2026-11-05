/**
 * Input type detection for the Finder system.
 * Recognizes: direct preset links, TikTok, YouTube, Instagram URLs, keywords.
 */
export type InputKind =
  | 'direct-preset'
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'drive-xml'
  | 'generic-url'
  | 'keyword';

export interface DetectedInput {
  kind: InputKind;
  originalInput: string;
  host?: string;
  videoId?: string;
  platform?: string;
}

const PRESET_FILE_HINT = /\.(xml|zip)(\?|$)/i;

export function detectInputKind(raw: string): DetectedInput {
  const input = (raw || '').trim();
  if (!input) return { kind: 'keyword', originalInput: input };

  let url: URL | null = null;
  try {
    url = new URL(input.match(/^https?:\/\//i) ? input : `https://${input}`);
  } catch {
    /* not a URL */
  }

  if (!url) return { kind: 'keyword', originalInput: input };

  const host = (url.hostname.replace(/^www\./i, '') || '').toLowerCase();
  const path = url.pathname;

  // Direct XML / ZIP preset
  if (PRESET_FILE_HINT.test(input)) return { kind: 'direct-preset', originalInput: input, host };

  // Google Drive XML
  if (host.includes('drive.google.com')) return { kind: 'drive-xml', originalInput: input, host };

  // TikTok
  if (host.includes('tiktok.com')) return { kind: 'tiktok', originalInput: input, host, platform: 'tiktok' };

  // Instagram
  if (host.includes('instagram.com')) return { kind: 'instagram', originalInput: input, host, platform: 'instagram' };

  // YouTube
  if (host === 'youtu.be' || host.includes('youtube.com')) {
    let videoId = '';
    if (host === 'youtu.be') videoId = path.slice(1);
    else videoId = url.searchParams.get('v') || path.match(/\/(shorts|embed)\/([\w-]{6,})/)?.[2] || '';
    return { kind: 'youtube', originalInput: input, host, videoId, platform: 'youtube' };
  }

  return { kind: 'generic-url', originalInput: input, host };
}

export function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, ' ').slice(0, 200);
}
