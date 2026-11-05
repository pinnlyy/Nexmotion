/**
 * Renderer system.
 *
 * Renders preset frames using the browser's WebCodecs / Canvas pipeline
 * on the client, then encodes with WebM (VP9/Opus) or MP4 where supported.
 * Server side (Playwright/Chromium + FFmpeg) rendering can be plugged in
 * through the adapter interface below when deployed with those binaries.
 */

export interface RenderOptions {
  presetXml: string;
  width: number;
  height: number;
  fps: 24 | 30 | 60 | number;
  quality: 'low' | 'medium' | 'high';
  includeAudio: boolean;
  startSec?: number;
  endSec?: number;
  format: 'mp4' | 'webm' | 'png';
  slotReplacements?: Record<string, string>; // slotId -> object URL
}

export interface RenderProgress {
  stage: 'idle' | 'loading' | 'decoding' | 'rendering' | 'encoding' | 'done' | 'error';
  progress: number; // 0..1 when measurable
  message: string;
}

export interface RenderResult {
  ok: boolean;
  error?: string;
  blob?: Blob;
  format?: string;
  bytes?: number;
  durationSec?: number;
  frames?: number;
}

export const QUALITY_PRESETS: Record<string, { bitrate: number; crf: number }> = {
  low: { bitrate: 1_200_000, crf: 32 },
  medium: { bitrate: 4_000_000, crf: 24 },
  high: { bitrate: 10_000_000, crf: 18 },
};

export const RESOLUTIONS: Record<string, { w: number; h: number }> = {
  '480p': { w: 854, h: 480 },
  '720p': { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
  'custom': { w: 0, h: 0 },
};

export function estimateFrames(durSec: number, fps: number) {
  return Math.max(1, Math.round(durSec * fps));
}

export function estimateSizeCounter(frames: number, bitrate: number, fps: number) {
  const seconds = frames / fps;
  return Math.round((bitrate * seconds) / 8);
}

/* -------- Server adapter (stub for Playwright/Chromium + FFmpeg, Phase 6) -------- */

export interface HeadlessRendererAdapter {
  name: string;
  available(): boolean;
  render(opts: RenderOptions): Promise<RenderResult>;
}

class ChromiumRendererStub implements HeadlessRendererAdapter {
  name = 'chromium-headless';
  available() {
    return false; // set true when Playwright/FFmpeg runtime is provisioned
  }
  async render(): Promise<RenderResult> {
    return {
      ok: false,
      error: 'Headless Chromium + FFmpeg worker is not provisioned on this deployment. Use client-side rendering or connect the adapter.',
    };
  }
}

export function getHeadlessRenderer(): HeadlessRendererAdapter {
  return new ChromiumRendererStub();
}

/* -------- Client-side canvas frame renderer helper -------- */

export function createCanvasRenderer(canvas: HTMLCanvasElement, opts: RenderOptions) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const { width, height, fps, quality } = opts;

  return {
    ctx,
    width,
    height,
    fps,
    target: quality,
    renderFrame(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void, tSec: number) {
      ctx.clearRect(0, 0, width, height);
      draw(ctx, width, height, tSec);
    },
    toBlob(): Promise<Blob | null> {
      return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
    },
  };
}
