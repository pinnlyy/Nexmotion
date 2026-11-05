/**
 * Search system — keyword search across public preset sources.
 *
 * Adapter design: searches are performed against a pluggable preset
 * registry (configured via NEX_PRESET_API_URL). If no registry is
 * configured, results are empty rather than fabricated.
 */
import { apiRequest, ApiError, parseJsonSafe } from './api';
import { detectInputKind, normalizeQuery, type DetectedInput, type InputKind } from './finder';

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  platform: string;
  creator: string;
  url: string;
  presetLinks: string[];
}

export interface SearchOptions {
  mode?: 'fast' | 'deep';
  page?: number;
  limit?: number;
  filter?: string;
}

export interface SearchResponse {
  ok: boolean;
  error?: string;
  mode: string;
  detectedKind: InputKind;
  page: number;
  results: SearchResult[];
  total: number;
  source: string;
}

/** Registry adapter interface — implement against any external service later. */
export interface PresetRegistryAdapter {
  name: string;
  search(query: string, opts: SearchOptions): Promise<SearchResult[]>;
  detail(target: string): Promise<any | null>;
  isConfigured(): boolean;
}

class HttpRegistryAdapter implements PresetRegistryAdapter {
  name = 'http-registry';

  isConfigured() {
    return !!process.env.NEX_PRESET_API_URL;
  }

  async search(query: string, opts: SearchOptions): Promise<SearchResult[]> {
    const base = process.env.NEX_PRESET_API_URL!;
    const data = await apiRequest<any>(base, {
      responseType: 'json',
      query: { q: query, mode: opts.mode || 'fast', page: opts.page || 1, limit: opts.limit || 20 },
      headers: process.env.NEX_PRESET_API_KEY ? { Authorization: `Bearer ${process.env.NEX_PRESET_API_KEY}` } : {},
    });
    const list = Array.isArray(data) ? data : (data?.results || data?.data || []);
    return (list as any[]).map(mapRegistryItem).filter(Boolean) as SearchResult[];
  }

  async detail(target: string): Promise<any | null> {
    const base = process.env.NEX_PRESET_API_URL!;
    try {
      const data = await apiRequest<any>(base, {
        responseType: 'json',
        query: { detail: target },
        headers: process.env.NEX_PRESET_API_KEY ? { Authorization: `Bearer ${process.env.NEX_PRESET_API_KEY}` } : {},
      });
      return data;
    } catch {
      return null;
    }
  }
}

class NullRegistryAdapter implements PresetRegistryAdapter {
  name = 'none';
  isConfigured() { return false; }
  async search(): Promise<SearchResult[]> { return []; }
  async detail(): Promise<any | null> { return null; }
}

export function getRegistry(): PresetRegistryAdapter {
  if (process.env.NEX_PRESET_API_URL) return new HttpRegistryAdapter();
  return new NullRegistryAdapter();
}

function mapRegistryItem(item: any): SearchResult | null {
  if (!item || typeof item !== 'object') return null;
  const title = item.title || item.name || item.videoTitle;
  const url = item.url || item.webURL || item.link || item.shareUrl;
  if (!title || !url) return null;
  return {
    id: String(item.id || url),
    title: String(title),
    description: String(item.description || item.desc || ''),
    platform: String(item.platform || 'unknown'),
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : (item.thumbnail?.url || null),
    creator: String(item.creator || item.uploader || item.author || 'unknown'),
    presetLinks: normalizePresets(item.presetLinks || item.presets),
    url: String(url),
  };
}

export function normalizePresets(raw: any): string[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') arr = raw.split(/[\s,\n]+/);
  else if (raw && typeof raw === 'object') arr = Object.values(raw);
  const out: string[] = [];
  for (const item of arr.flat()) {
    const s = typeof item === 'string' ? item.trim() : item?.url || item?.href || item?.link || '';
    if (typeof s === 'string' && /^https?:\/\//i.test(s)) {
      if (/\.xml(\?|$)/i.test(s) || /alight|preset|drive\.google/i.test(s)) out.push(s);
    }
  }
  return dedupe(out);
}

export function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const key = x.split('?')[0].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function dedupeResults(list: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const k = (r.url || '').split('?')[0].toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Extract thumbnail / og data from any public page (best-effort). */
async function scrapePageMeta(url: string): Promise<{ title?: string; thumbnail?: string; creator?: string; description?: string; html?: string }> {
  try {
    const html = await apiRequest<any>(url, { responseType: 'text', timeoutMs: 12000 });
    const pick = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1]
      || html.match(new RegExp(`["']${prop}["']\\s*:\\s*["']([^"']{5,})["']`, 'i'))?.[1];
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    return {
      title: pick('og:title') || titleTag || undefined,
      thumbnail: pick('og:image') || undefined,
      creator: pick('author') || pick('og:site_name') || undefined,
      description: pick('og:description') || pick('description') || undefined,
      html,
    };
  } catch {
    return {};
  }
}

/**
 * finder(input) — detect input type and return results.
 */
export async function finder(rawInput: string, opts: SearchOptions = {}): Promise<SearchResponse> {
  const detected = detectInputKind(rawInput);
  const mode = opts.mode || 'fast';

  const fail = (error: string) => ({ ok: false, error, mode, detectedKind: detected.kind, page: 1, results: [], total: 0, source: 'none' });
  const registry = getRegistry();

  try {
    // Direct preset link — fetch details directly
    if (detected.kind === 'direct-preset' || detected.kind === 'drive-xml') {
      let meta: any = {};
      try { meta = await scrapePageMeta(detected.originalInput); } catch { /* ignore, detail() will fetch */ }
      return {
        ok: true, mode, detectedKind: detected.kind, page: 1,
        results: [{
          id: detected.originalInput,
          title: meta.title || 'Direct preset link',
          description: meta.description || 'Loaded directly from provided link.',
          platform: detected.host || 'direct',
          thumbnail: null,
          creator: 'unknown',
          url: detected.originalInput,
          presetLinks: [detected.originalInput],
        }],
        total: 1,
        source: 'direct',
      };
    }

    // Video platform URL
    if (detected.kind === 'tiktok' || detected.kind === 'youtube' || detected.kind === 'instagram' || detected.kind === 'generic-url') {
      const meta = await scrapePageMeta(detected.originalInput);
      const presetLinks = normalizePresets([
        ...(meta.html ? [...meta.html.matchAll(/https?:\/\/[^\s"'<>]+\.xml[^\s"'<>]*/gi)].map((m) => m[0]) : []),
      ]);
      const desc = meta.description || '';
      for (const m of desc.matchAll(/https?:\/\/[^\s,;"]+/gi)) {
        if (/\.(xml|zip)(\?|$)/i.test(m[0]) || /drive\.google/i.test(m[0])) presetLinks.push(m[0]);
      }

      if (presetLinks.length === 0 && mode === 'deep' && registry.isConfigured()) {
        const regResults = await registry.search(detected.originalInput, { mode });
        return {
          ok: true, mode, detectedKind: detected.kind, page: 1,
          results: dedupeResults(regResults), total: regResults.length, source: registry.name,
        };
      }

      const result: SearchResult = {
        id: detected.originalInput,
        title: meta.title || `Preset search: ${detected.originalInput}`,
        description: desc.slice(0, 250),
        platform: detected.platform || detected.host || 'web',
        thumbnail: meta.thumbnail || null,
        creator: meta.creator || 'unknown',
        url: detected.originalInput,
        presetLinks: dedupe(presetLinks),
      };
      if (presetLinks.length === 0 && !meta.title) return fail('Could not read the provided link. It may be private or unsupported.');
      return { ok: true, mode, detectedKind: detected.kind, page: 1, results: [result], total: 1, source: 'direct-scrape' };
    }

    // Keyword search
    const query = normalizeQuery(rawInput);
    if (!query) return fail('Empty query');
    if (!registry.isConfigured()) {
      return {
        ok: true, mode, detectedKind: 'keyword', page: 1,
        results: [], total: 0,
        source: 'none',
      };
    }
    const results = await registry.search(query, { ...opts, mode });
    return {
      ok: true, mode, detectedKind: 'keyword', page: opts.page || 1,
      results: dedupeResults(results), total: results.length, source: registry.name,
    };
  } catch (err: any) {
    const msg = err instanceof ApiError ? `${err.message} (${err.code})` : err?.message || 'Search failed';
    return fail(msg);
  }
}

/**
 * search(query) — plain keyword search with pagination support.
 */
export async function search(query: string, opts: SearchOptions = {}): Promise<SearchResponse> {
  return finder(query, opts);
}
