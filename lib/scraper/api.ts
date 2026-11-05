/**
 * Core API request handler.
 * Server-side only usage (API routes). Centralizes fetch with timeout,
 * headers, pagination, and response validation.
 */

export type ApiResponseType = 'json' | 'text' | 'buffer';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  responseType?: ApiResponseType;
  /** Append these as URL query params */
  query?: Record<string, string | number | undefined>;
  /** Retries on transient network failures */
  retries?: number;
  rateLimitPerMs?: number;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': process.env.NEX_USER_AGENT || 'Nexmotion/1.0(+https://nexmotion.app)',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 0, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const lastCallAt = new Map<string, number>();

let lastRateLimitAt = 0;

/**
 * Enforce a global cooldown between outbound requests to remote hosts
 * (simple in-process rate limiting).
 */
function applyCooldown(key: string, rateLimitPerMs?: number) {
  const now = Date.now();
  const last = lastCallAt.get(key) || 0;
  const gap = rateLimitPerMs ?? 350;
  const wait = last + gap - now;
  if (wait > 0) return new Promise<void>((r) => setTimeout(r, wait));
  lastCallAt.set(key, now);
}

export function buildUrl(base: string, query?: Record<string, string | number | undefined>) {
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  }
  const qs = params.toString();
  if (!qs) return base;
  return base + (base.includes('?') ? '&' : '?') + qs;
}

export async function apiRequest<T = any>(
  url: string,
  opts: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 15000,
    responseType = 'text',
    query,
    retries = 1,
  } = opts;

  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw new ApiError('Only http/https URLs are permitted', 400, 'INVALID_URL');
  }

  const parsed = new URL(url);
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname)) {
    throw new ApiError('Blocking request to loopback address (SSRF protection)', 400, 'SSRF_BLOCKED');
  }

  const fullUrl = buildUrl(url, query);
  await applyCooldown(parsed.hostname);

  let attempt = 0;
  let lastErr: any;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(fullUrl, {
        method,
        headers: { ...DEFAULT_HEADERS, ...headers },
        body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (res.status === 429) throw new ApiError('Rate limited by upstream', 429, 'RATE_LIMITED');
      if (!res.ok) throw new ApiError(`Upstream responded ${res.status}`, res.status, 'UPSTREAM_ERROR');

      if (responseType === 'json') {
        const text = await res.text();
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new ApiError('Response was not valid JSON', 502, 'BAD_JSON');
        }
      } else if (responseType === 'buffer') {
        return Buffer.from(await res.arrayBuffer()) as unknown as T;
      } else {
        return (await res.text()) as unknown as T;
      }
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof ApiError && (err.code === 'INVALID_URL' || err.code === 'SSRF_BLOCKED')) throw err;
      attempt++;
      if (attempt <= retries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
    } finally {
      // ensure timer cleared even on abort path exceptions
    }
  }

  if (lastErr?.name === 'AbortError') throw new ApiError('Request timed out', 504, 'TIMEOUT');
  if (lastErr instanceof ApiError) throw lastErr;
  throw new ApiError(lastErr?.message || 'Network request failed', 502, 'REQUEST_FAILED');
}

export function parseJsonSafe<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function extractFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

/** Generic paginator over page-offset style fetchers */
export async function paginate<T>(
  fetchPage: (page: number) => Promise<T[]>,
  { maxPages = 3, untilEmpty = true }: { maxPages?: number; untilEmpty?: boolean } = {}
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchPage(page);
    all.push(...items);
    if (untilEmpty && items.length === 0) break;
  }
  return all;
}
