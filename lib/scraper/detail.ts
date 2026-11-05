import JSZip from 'jszip';
import { apiRequest, ApiError } from './api';
import { detectInputKind } from './finder';

export interface ProjectLayer {
  id: string;
  name: string;
  type: string;
}

export interface ProjectMeta {
  title: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  layers: ProjectLayer[];
}

export interface PresetDetail extends ProjectMeta {
  ok: boolean;
  target: string;
  sourceKind: string;
  description: string;
  thumbnail: string | null;
  platform: string | null;
  xml: string;
  bytes: number;
  media: unknown[];
  error?: string;
}

function readTag(xml: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`,
      'i'
    );
    const match = xml.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function readAttribute(xml: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i');
    const match = xml.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function numericValue(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseProjectMeta(xml: string): ProjectMeta {
  const title =
    readTag(xml, ['title', 'name', 'projectName', 'compositionName']) ||
    readAttribute(xml, ['title', 'name']) ||
    'Untitled project';

  const width = numericValue(
    readTag(xml, ['width', 'canvasWidth', 'frameWidth']) ||
      readAttribute(xml, ['width']),
    1280
  );

  const height = numericValue(
    readTag(xml, ['height', 'canvasHeight', 'frameHeight']) ||
      readAttribute(xml, ['height']),
    720
  );

  const fps = numericValue(
    readTag(xml, ['fps', 'frameRate', 'framerate']) ||
      readAttribute(xml, ['fps', 'frameRate']),
    30
  );

  const durationRaw =
    readTag(xml, ['duration', 'durationSec', 'length']) ||
    readAttribute(xml, ['duration']);

  let durationSec = numericValue(durationRaw, 10);

  // Some project formats store duration as frame count.
  if (durationSec > 300 && fps > 0) {
    durationSec = durationSec / fps;
  }

  const layers: ProjectLayer[] = [];
  const layerRegex = /<(layer|shape|image|video|audio)\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = layerRegex.exec(xml)) !== null) {
    const attrs = match[2] || '';
    const name =
      readAttribute(attrs, ['name', 'title', 'label']) ||
      `${match[1]} ${index + 1}`;

    layers.push({
      id: readAttribute(attrs, ['id', 'uuid']) || `layer-${index + 1}`,
      name,
      type: match[1].toLowerCase(),
    });

    index++;
  }

  return { title, width, height, fps, durationSec, layers };
}

export function driveDirectUrl(input: string): string {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();

    if (!host.includes('drive.google.com')) return input;

    let id = url.searchParams.get('id');

    if (!id) {
      id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || null;
    }

    if (!id) return input;

    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  } catch {
    return input;
  }
}

export function isSupportedPresetUrl(input: string): boolean {
  const detected = detectInputKind(input);

  return (
    detected.kind === 'direct-preset' ||
    detected.kind === 'drive-xml'
  );
}

function isXmlContent(value: string): boolean {
  return (
    /^\s*(<\?xml[\s\S]*?\?>\s*)?</i.test(value) &&
    /<(project|composition|alight|template)\b/i.test(value)
  );
}

async function fetchPresetXml(url: string): Promise<string> {
  const cleanUrl = driveDirectUrl(url);
  const isZip = /\.zip(?:[?#]|$)/i.test(cleanUrl);

  if (isZip) {
    const buffer = await apiRequest<ArrayBuffer>(cleanUrl, {
      responseType: 'buffer',
      timeoutMs: 30000,
      retries: 1,
    });

    const zip = await JSZip.loadAsync(buffer);
    const xmlFile = Object.values(zip.files).find(
      (file) => !file.dir && /\.xml$/i.test(file.name)
    );

    if (!xmlFile) {
      throw new ApiError('ZIP tidak berisi file XML proyek', 422, 'XML_NOT_FOUND');
    }

    return await xmlFile.async('string');
  }

  return await apiRequest<string>(cleanUrl, {
    responseType: 'text',
    timeoutMs: 30000,
    retries: 2,
  });
}

export async function detail(target: string): Promise<PresetDetail> {
  const input = (target || '').trim();

  if (!input) {
    throw new ApiError('Target preset tidak boleh kosong', 400, 'EMPTY_TARGET');
  }

  const detected = detectInputKind(input);
  let xml = '';
  let title = 'Untitled project';
  let description = '';
  let thumbnail: string | null = null;

  if (input.startsWith('<')) {
    xml = input;
  } else {
    if (!/^https?:\/\//i.test(input) && detected.kind === 'keyword') {
      throw new ApiError('Target harus berupa URL atau XML', 400, 'INVALID_TARGET');
    }

    if (
      detected.kind === 'tiktok' ||
      detected.kind === 'youtube' ||
      detected.kind === 'instagram'
    ) {
      throw new ApiError(
        'URL video terdeteksi, tetapi belum menyediakan XML preset secara langsung',
        422,
        'PRESET_XML_REQUIRED'
      );
    }

    xml = await fetchPresetXml(input);
  }

  if (!isXmlContent(xml)) {
    throw new ApiError(
      'Konten yang diterima bukan XML proyek Alight Motion yang dikenali',
      422,
      'INVALID_PROJECT_XML'
    );
  }

  const meta = parseProjectMeta(xml);
  title = meta.title;

  const bytes = new TextEncoder().encode(xml).byteLength;

  return {
    ok: true,
    target: input,
    sourceKind: detected.kind === 'keyword' ? 'inline-xml' : detected.kind,
    title,
    description,
    thumbnail,
    platform: detected.platform || null,
    xml,
    bytes,
    media: [],
    ...meta,
  };
}
