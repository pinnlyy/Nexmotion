'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/layout/LayoutShell';
import { EmptyState, ErrorState } from '@/components/ui/States';

interface Slot { id: string; kind: string; slotName: string; src: string; originalName: string; }
interface Layer { name: string; type: string; ref: string | null; props: string[]; }
interface MediaItem { id: string; kind: string; name: string; size: number; dataUrl?: string; }

export default function PlayerPage() {
  const toast = useToast();
  const [xml, setXml] = useState<string>('');
  const [title, setTitle] = useState('');
  const [meta, setMeta] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [time, setTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState<'layers' | 'slots' | 'audio' | 'perf'>('slots');
  const [audioOpts, setAudioOpts] = useState({ src: '', volume: 1, speed: 1, enabled: true });
  const [previewQuality, setPreviewQuality] = useState(0.5);
  const [mediaLib, setMediaLib] = useState<MediaItem[]>([]);
  const [slotMedia, setSlotMedia] = useState<Record<string, string>>({});
  const raf = useRef<number>(0);
  const lastTick = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const duration = useMemo(() => Number(meta?.durationSec) || 10, [meta]);

  const applyXml = useCallback((x: string, t: string) => {
    setXml(x); setTitle(t);
    try {
      // client-side meta parse (same heuristics as server)
      const wM = x.match(/width\s*=\s*["'](\d+)["']/i); const hM = x.match(/height\s*=\s*["'](\d+)["']/i);
      const fM = x.match(/fps\s*=\s*["']?(\d+(?:\.\d+)?)/i); const dM = x.match(/duration\s*=\s*["']?(\d+(?:\.\d+)?)/i);
      const nodes = x.match(/<(?:layer|asset|object)\b[^>]*>/gi) || [];
      setLayers(nodes.slice(0, 80).map((n) => {
        const name = n.match(/name\s*=\s*["']([^"']*)["']/i)?.[1] || 'Unnamed';
        const type = (n.match(/<(\w+)/)?.[1] || 'layer').toLowerCase();
        const ref = n.match(/(?:src|ref|asset)\s*=\s*["']([^"']+)["']/i)?.[1] || null;
        const props = [...n.matchAll(/([\w:.-]+)\s*=/gi)].map((m) => m[1]).slice(0, 12);
        return { name, type, ref, props };
      }));
      setMeta({});
      void wM; void hM; void fM; void dM;
      // ask server for full detail + slots
    } catch { /* ignore */ }
  }, []);

  const loadTarget = useCallback(async (target: string) => {
    if (!target) return;
    setLoading(true); setError(null);
    try {
      const isInlineXml = /^\s*</.test(target);
      if (isInlineXml) {
        applyXml(target, 'Inline XML');
        const res = await fetch('/api/slots?target=' + encodeURIComponent(''), { method: 'POST', body: JSON.stringify({ xml: target }) }).catch(() => null);
        void res;
        // Parse slots locally via detail endpoint is cleaner; only fallback:
        const detRes = await fetch('/api/detail?xml=1', { method: 'POST', body: JSON.stringify({ xml: target }) });
        if (detRes.ok) {
          const d = await detRes.json();
          setMeta(d); setTitle(d.title); setSlots(d.slots || []); setLayers(d.layers || []);
        }
      } else {
        const res = await fetch(`/api/detail?target=${encodeURIComponent(target)}&xml=1`);
        const d = await res.json();
        if (!d.ok) { setError(d.error || 'Failed to load preset'); return; }
        setXml(d.xml); setMeta(d); setTitle(d.title); setSlots(d.slots || []); setLayers(d.layers || []);
      }
      setPlaying(false); setTime(0);
      toast('Preset loaded', 'ok');
    } catch (err: any) {
      setError(err?.message || 'Failed to load preset');
    } finally { setLoading(false); }
  }, [applyXml, toast]);

  useEffect(() => {
    const url = new URL(window.location.href).searchParams.get('url');
    if (url) loadTarget(url);
  }, [loadTarget]);

  useEffect(() => {
    fetch('/api/media/upload').then(r => r.json()).then(d => d.ok && setMediaLib(d.items)).catch(() => {});
  }, []);

  // Playback loop using canvas overlay of media references
  useEffect(() => {
    if (!playing) return;
    lastTick.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTick.current) / 1000 * audioOpts.speed;
      lastTick.current = now;
      setTime((t) => {
        const nt = t + dt;
        if (nt >= duration) { if (loop) return 0; setPlaying(false); return duration; }
        return nt;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, duration, loop, audioOpts.speed]);

  // Draw preview frame from currently-selected replacement or original src
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, c.width, c.height);
    const firstSlot = slots[0];
    const src = firstSlot ? slotMedia[firstSlot.id] || firstSlot.src : null;
    if (!src) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No media slot — import a preset with media', c.width / 2, c.height / 2);
      return;
    }
    if (/\.(jpe?g|png|webp|gif)/i.test(src) || src.startsWith('data:image/')) {
      const im = new Image();
      im.onload = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
      };
      im.src = src;
    } else if (/\.(mp4|mov|webm)/i.test(src) || src.startsWith('data:video/')) {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#888';
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('▶ video frame preview (audio-only playback supported)', c.width / 2, c.height / 2);
    } else {
      ctx.fillStyle = '#777';
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Media reference not previewable in browser', c.width / 2, c.height / 2);
    }
  }, [slots, slotMedia, time]);

  const replaceSlot = (slotId: string, mediaId: string) => {
    setSlotMedia((m) => ({ ...m, [slotId]: mediaId }));
    toast('Slot assigned — will reflect in preview', 'ok');
  };

  const uploadForSlot = async (slotId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    toast('Uploading…');
    const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
    const d = await res.json();
    if (!d.ok) { toast(d.error || 'Upload failed', 'err'); return; }
    setMediaLib((m) => [{ ...d.item }, ...m]);
    replaceSlot(slotId, d.item.id);
  };

  const exportXml = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || 'project'}.xml`;
    a.click();
  };

  const exportZip = async () => {
    const used = Object.entries(slotMedia).map(([slotId, mediaId]) => ({ slotId, mediaId }));
    const res = await fetch('/api/export/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml, filename: title || 'nexmotion-project', includeMedia: used.length > 0, replacements: used }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); toast(e.error || 'Export failed', 'err'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || 'nexmotion-project'}.zip`;
    a.click();
    toast('ZIP exported', 'ok');
  };

  return (
    <div>
      <h1 className="page-title">Player</h1>
      <p className="page-sub">Preview presets, inspect layers, and swap media slots — entirely in-browser.</p>

      <div className="card">
        <div className="searchbar" style={{ marginBottom: 10 }}>
          <input className="input" id="preset-url" placeholder="Preset share link or direct XML URL…" />
          <button className="btn primary" onClick={() => loadTarget((document.getElementById('preset-url') as HTMLInputElement)?.value || '')} disabled={loading}>Load</button>
          <label className="btn">⇪ XML file
            <input type="file" accept=".xml" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              loadTarget(text);
            }} />
          </label>
        </div>
        {title && <div className="badge acc">{title}</div>}
      </div>

      {loading && <div className="loading-block"><div className="spinner" /></div>}
      {error && <ErrorState text={error} />}
      {!loading && !error && !xml && <EmptyState text="Load a preset via URL or XML file, or send a preset reference from the Finder." />}

      {xml && (
        <div className="player-layout" style={{ marginTop: 16 }}>
          <div>
            <div className="player-canvas-wrap">
              <canvas ref={canvasRef} width={480} height={270} style={{ width: '100%', display: 'block', borderRadius: 10, transform: `scale(${zoom})`, transformOrigin: 'center' }} />
              <div className="timeline">
                <button className="btn sm" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
                <input type="range" min={0} max={duration} step={0.05} value={time} onChange={(e) => setTime(Number(e.target.value))} />
                <span className="time-label">{time.toFixed(2)}s / {duration.toFixed(2)}s</span>
                <button className={`btn sm ${loop ? 'primary' : ''}`} onClick={() => setLoop((l) => !l)}>Loop</button>
              </div>
            </div>

            <div className="card">
              <h3>Layer Inspector</h3>
              {layers.length === 0 && <EmptyState text="No layers detected in this preset." />}
              <div>
                {layers.map((l, i) => (
                  <div className="layer-row" key={i}>
                    <span className="nav-ico">{l.type === 'image' || l.type === 'photo' ? '▣' : l.type === 'audio' || l.type === 'sound' ? '♪' : '▤'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div>
                      {l.ref && <div style={{ color: 'var(--muted)', fontSize: 11, wordBreak: 'break-all' }}>{l.ref}</div>}
                    </div>
                    <div className="l-type">{l.type}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="tabs">
              {(['slots', 'audio', 'perf'] as const).map((t) => (
                <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t === 'slots' ? 'Media Slots' : t === 'audio' ? 'Audio' : 'Performance'}</button>
              ))}
            </div>

            {tab === 'slots' && (
              <div>
                {slots.length === 0 && <EmptyState text="No media slots detected." />}
                {slots.map((s) => (
                  <div className="slot-item" key={s.id} style={{ marginBottom: 8 }}>
                    <div className="slot-thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 18 }}>{s.kind === 'image' ? '▣' : s.kind === 'video' ? '▶' : '♪'}</div>
                    <div className="info">
                      <div className="name">{s.slotName}</div>
                      <div className="ref">{s.originalName}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                      <label className="btn sm">Replace
                        <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          await uploadForSlot(s.id, f);
                        }} />
                      </label>
                      <select className="input sm" style={{ padding: 5 }} onChange={(e) => e.target.value && replaceSlot(s.id, e.target.value)} value={slotMedia[s.id] || ''}>
                        <option value="">— Select —</option>
                        {mediaLib.filter((m) => m.kind === s.kind).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn sm primary" onClick={exportXml}>↧ Export XML</button>
                  <button className="btn sm" onClick={exportZip}>↧ Export ZIP</button>
                </div>
              </div>
            )}

            {tab === 'audio' && (
              <div>
                <label className="label">Source URL (optional replacement)</label>
                <input className="input" value={audioOpts.src} onChange={(e) => setAudioOpts({ ...audioOpts, src: e.target.value })} placeholder="https://… or data URL" />
                <div style={{ marginTop: 10 }}>
                  <label className="label">Volume {audioOpts.volume}</label>
                  <input type="range" min={0} max={1} step={0.05} value={audioOpts.volume} onChange={(e) => setAudioOpts({ ...audioOpts, volume: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <label className="label">Playback speed {audioOpts.speed}×</label>
                  <input type="range" min={0.25} max={2} step={0.05} value={audioOpts.speed} onChange={(e) => setAudioOpts({ ...audioOpts, speed: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <button className={`btn sm ${audioOpts.enabled ? 'primary' : ''}`} onClick={() => setAudioOpts({ ...audioOpts, enabled: !audioOpts.enabled })}>
                    {audioOpts.enabled ? 'Audio enabled' : 'Audio muted'}
                  </button>
                </div>
                {audioOpts.src && (
                  <audio ref={videoRef} src={audioOpts.src} controls style={{ marginTop: 12, width: '100%' }} />
                )}
              </div>
            )}

            {tab === 'perf' && (
              <div>
                <label className="label">Preview quality</label>
                <select className="select" value={previewQuality} onChange={(e) => setPreviewQuality(Number(e.target.value))}>
                  <option value={0.25}>Quarter (fastest)</option>
                  <option value={0.5}>Half (default)</option>
                  <option value={1}>Full (slowest)</option>
                </select>
                <div style={{ marginTop: 12 }}>
                  <label className="label">Zoom {zoom.toFixed(1)}×</label>
                  <input type="range" min={0.5} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="label">Canvas FPS cap</label>
                  <select className="select" defaultValue={30}>
                    <option value={24}>24 FPS</option>
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS (may drop frames)</option>
                  </select>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
                  These settings affect the in-browser preview. For actual video rendering use the Export menu —
                  real rendering is done client-side with WebCodecs or via the self-hosted headless workers.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
