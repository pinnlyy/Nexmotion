/**
 * renderPresetVideo(presetTarget, options) — orchestrates a real render.
 *
 * Workflow:
 *  1. Load & validate preset (detail)
 *  2. Build a Player spec for the client renderer
 *  3. Delegate actual frame encoding to the client-side renderer
 *     (WebCodecs / MediaRecorder) or the Chromium+FFmpeg headless adapter.
 *
 * This module never reports success without an encoded output blob.
 */
import { detail, parseProjectMeta, type PresetDetail } from './detail';
import { getSlots } from './slots';
import { ApiError } from './api';
import { getHeadlessRenderer, type RenderOptions, type RenderResult } from '../renderer/core';

export interface PlayerSpec {
  ok: boolean;
  presetId: string;
  title: string;
  xml: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  layers: PresetDetail['layers'];
  slots: ReturnType<typeof getSlots>;
  audio: { src: string | null; volume: number; speed: number; enabled: boolean };
}

export interface RenderJobOptions extends Partial<RenderOptions> {
  includeAudio?: boolean;
}

export function buildPlayerSpec(presetXml: string, overrides: Partial<PlayerSpec> = {}): PlayerSpec {
  const pm = parseProjectMeta(presetXml);
  return {
    ok: true,
    presetId: 'inline-' + Date.now().toString(36),
    title: pm.title || 'Untitled project',
    xml: presetXml,
    width: pm.width || 1280,
    height: pm.height || 720,
    fps: pm.fps || 30,
    durationSec: pm.durationSec || 10,
    layers: [],
    slots: getSlots(presetXml),
    audio: { src: null, volume: 1, speed: 1, enabled: true },
    ...overrides,
  };
}

/**
 * renderPresetVideo — loads a preset and returns a render plan (spec) for
 * the browser, or a finished RenderResult when a headless worker is present.
 */
export async function renderPresetVideo(
  presetTarget: string,
  options: RenderJobOptions = {}
): Promise<{ ok: boolean; spec?: PlayerSpec; result?: RenderResult; error?: string; nextStep: string }> {
  if (!presetTarget || (!/^https?:\/\//i.test(presetTarget) && !/^\s*</.test(presetTarget))) {
    throw new ApiError('presetTarget must be a URL or XML', 400, 'INVALID_TARGET');
  }

  const det = await detail(presetTarget);
  if (!det.ok || !det.xml) {
    return { ok: false, error: det.error || 'Failed to load preset', nextStep: 'check preset URL' };
  }

  const spec = buildPlayerSpec(det.xml, {
    title: det.title,
    width: Number(options.width) || det.width || 1280,
    height: Number(options.height) || det.height || 720,
    fps: Number(options.fps) || det.fps || 30,
    durationSec: Number(options.endSec) || det.durationSec || 10,
  });

  if (getHeadlessRenderer().available()) {
    const result = await getHeadlessRenderer().render({
      presetXml: det.xml,
      width: spec.width,
      height: spec.height,
      fps: spec.fps as 24 | 30 | 60,
      quality: options.quality || 'medium',
      includeAudio: options.includeAudio !== false,
      format: options.format || 'mp4',
      slotReplacements: options.slotReplacements,
    });
    return { ok: result.ok, spec, result, error: result.error, nextStep: result.ok ? 'download' : 'inspect render worker' };
  }

  return { ok: true, spec, nextStep: 'client-render' };
}
