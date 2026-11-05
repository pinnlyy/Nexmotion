/**
 * Media management — validation and upload handling for the /media page
 * and Player media replacement workflow.
 */

export const ALLOWED_MIME: Record<string, { kind: 'image' | 'video' | 'audio'; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: '.jpg' },
  'image/png': { kind: 'image', ext: '.png' },
  'image/webp': { kind: 'image', ext: '.webp' },
  'image/gif': { kind: 'image', ext: '.gif' },
  'video/mp4': { kind: 'video', ext: '.mp4' },
  'video/quicktime': { kind: 'video', ext: '.mov' },
  'video/webm': { kind: 'video', ext: '.webm' },
  'video/x-matroska': { kind: 'video', ext: '.mkv' },
  'audio/mpeg': { kind: 'audio', ext: '.mp3' },
  'audio/wav': { kind: 'audio', ext: '.wav' },
  'audio/x-wav': { kind: 'audio', ext: '.wav' },
  'audio/aac': { kind: 'audio', ext: '.aac' },
  'audio/mp4': { kind: 'audio', ext: '.m4a' },
  'video/ogg': { kind: 'video', ext: '.ogv' },
  'audio/ogg': { kind: 'audio', ext: '.ogg' },
};

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface MediaRecord {
  id: string;
  kind: 'image' | 'video' | 'audio';
  name: string;
  ext: string;
  size: number;
  uploadedAt: number;
  dataUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  kind?: 'image' | 'video' | 'audio';
  ext?: string;
}

export function safeFilename(name: string): string {
  const base = (name || 'file').split(/[\\/]/).pop() || 'file';
  return base.replace(/[^\w.\- ]/g, '_').slice(0, 120) || 'file';
}

export function validateMediaFile(file: { name: string; type: string; size: number }): ValidationResult {
  if (!file || typeof file.name !== 'string') return { valid: false, error: 'Invalid file payload' };
  const clean = safeFilename(file.name);
  const ext = ('.' + (clean.split('.').pop() || '')).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.webm', '.mkv', '.mp3', '.wav', '.aac', '.m4a', '.ogg'];
  if (!allowedExts.includes(ext)) {
    return { valid: false, error: `Unsupported file extension: ${ext}` };
  }
  const kindYaw = ALLOWED_MIME[file.type];
  if (!kindYaw) return { valid: false, error: `Unsupported MIME type: ${file.type || 'unknown'}` };
  if (file.size > MAX_FILE_BYTES) {
    return { valid: false, error: `File exceeds max size of ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB` };
  }
  if (file.size < 8) return { valid: false, error: 'File is empty or corrupted' };
  const kind = kindYaw.kind;
  const kindFromExt = ext.match(/^\.(jpe?g|png|webp|gif)$/) ? 'image' : ext.match(/^\.(mp4|mov|webm|mkv|ogv)$/) ? 'video' : 'audio';
  if (kind !== kindFromExt) {
    return { valid: false, error: `MIME type (${file.type}) doesn't match extension ${ext}` };
  }
  return { valid: true, kind, ext };
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/* ----- Media store (in-memory server-side; swap for DB later) ----- */

const mediaStore = new Map<string, MediaRecord>();

export function addMedia(rec: Omit<MediaRecord, 'id' | 'uploadedAt'>): MediaRecord {
  const item: MediaRecord = { ...rec, id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, uploadedAt: Date.now() };
  mediaStore.set(item.id, item);
  return item;
}

export function getMedia(id: string): MediaRecord | undefined {
  return mediaStore.get(id);
}

export function listMedia(): MediaRecord[] {
  return [...mediaStore.values()].sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export function removeMedia(id: string): boolean {
  return mediaStore.delete(id);
}
