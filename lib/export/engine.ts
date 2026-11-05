/**
 * Export system — XML export, ZIP export (JSZip), and video render
 * orchestration on the server.
 */
import { parseProjectMeta } from '../scraper/detail';
import { getSlots, type MediaSlot } from '../scraper/slots';

export interface ExportPresetOptions {
  xml: string;
  filename?: string;
  includeMedia?: boolean;
  mediaFiles?: Record<string, Blob | Uint8Array>; // slotId -> file bytes
}

export function sanitizeFilename(name: string, fallback = 'nexmotion-project'): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  const cleaned = base.replace(/[^\w.\- ]/g, '_').trim().slice(0, 100);
  return cleaned || fallback;
}

export function validateXmlBasic(xml: string): { ok: boolean; error?: string } {
  if (typeof xml !== 'string' || xml.trim().length < 20) return { ok: false, error: 'XML content is empty' };
  if (!/^<\?xml|^\s*</.test(xml)) return { ok: false, error: 'Content does not start with an XML declaration or element' };
  if (!/<project|<composition|<alight|<template/i.test(xml)) return { ok: false, error: 'Missing expected project element' };
  return { ok: true };
}

/* -------- Server-side ZIP builder (pure JS, no deps) -------- */

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Build a minimal ZIP archive (stored, no compression) from entries. */
export function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const push = (arr: Uint8Array) => chunks.push(arr);

  for (const e of entries) {
    const data = e.data;
    const nameBytes = enc.encode(e.name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    push(local);
    push(data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + data.length;
  }

  let cdSize = 0;
  for (const c of central) cdSize += c.length;

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of [...chunks, ...central, end]) { out.set(c, pos); pos += c.length; }
  return out;
}

export function bytesFromDataUrl(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] || '';
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin);
}

export function buildProjectExportPresetXml(xml: string, replacements: MediaSlot[]): string {
  let out = xml;
  // Replace every src that corresponds to a slot with a relative "media/<file>" path
  for (const r of replacements) {
    if (!r.src) continue;
    const safe = sanitizeFilename(r.originalName, 'media');
    const rel = `media/${safe}`;
    out = out.split(r.src).join(rel);
  }
  return out;
}

export function buildExportPreviewXml(xml: string, replacements: Record<string, string>): string {
  let out = xml;
  for (const [slotId, newSrcOrDataUrl] of Object.entries(replacements)) {
    const slot = slotId.split('#')[0];
    const kind = slot.split('-')[0];
    const original = slot.split('-').slice(1).join('-');
    // Replace only in relevant attributes for that media kind
    const attrRe = new RegExp(`((?:src|source|ref|asset|file)\\s*=\\s*["'])${original.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(["'])`, 'g');
    out = out.replace(attrRe, `$1${newSrcOrDataUrl}$2`);
    void kind;
  }
  return out;
}

/* -------- Video export orchestration (server adapter) -------- */

export interface VideoExportStatus {
  ok: boolean;
  status: 'none' | 'queued' | 'rendering' | 'done' | 'error';
  stage: string;
  progress: number;
  bytes?: number;
  error?: string;
  fileUrl?: string;
}

const exportStore = new Map<string, VideoExportStatus>();

export function setExportStatus(id: string, s: VideoExportStatus) { exportStore.set(id, s); }
export function getExportStatus(id: string): VideoExportStatus | null { return exportStore.get(id) || null; }

export function estimateVideoExportBytes(
  width: number, height: number, fps: number, durSec: number, quality: 'low' | 'medium' | 'high'
) {
  const { QUALITY_PRESETS } = require('./renderer/core') as any;
  const q = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
  const bitrate = q.bitrate * (width / 1280) * (height / 720);
  return Math.round((bitrate * durSec) / 8);
}
