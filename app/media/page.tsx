'use client';
import { useEffect, useState } from 'react';
import { useToast, useConfirm } from '@/components/layout/LayoutShell';
import { EmptyState } from '@/components/ui/States';

interface MediaItem { id: string; kind: string; name: string; size: number; dataUrl?: string; }

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1e6) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/media/upload');
    const d = await r.json();
    if (d.ok) setItems(d.items);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const doUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allowed = ['image/', 'video/', 'audio/'];
    for (const f of Array.from(files)) {
      if (!allowed.some((p) => f.type.startsWith(p))) {
        toast(`${f.name}: unsupported type (must be image/video/audio)`, 'err');
        continue;
      }
      if (f.size > 50 * 1024 * 1024) {
        toast(`${f.name}: exceeds 50 MB limit`, 'err');
        continue;
      }
      setProgress(0);
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) { toast(d.error || `${f.name}: upload failed`, 'err'); continue; }
      toast(`${f.name} uploaded`, 'ok');
      await load();
    }
    setProgress(null);
  };

  const remove = async (id: string) => {
    if (!(await confirm('Remove this media item? This cannot be undone.'))) return;
    const r = await fetch(`/api/media/upload?id=${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (d.ok) { toast('Deleted', 'ok'); setItems((i) => i.filter((x) => x.id !== id)); }
    else toast(d.error || 'Delete failed', 'err');
  };

  const shown = items.filter((i) => filter === 'all' || i.kind === filter);

  return (
    <div>
      <h1 className="page-title">Media Manager</h1>
      <p className="page-sub">Upload and organize images, videos and audio to use as preset media replacements.</p>

      <div
        className={`thumb-up ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); doUpload(e.dataTransfer.files); }}
      >
        <div style={{ fontSize: 34, marginBottom: 6 }}>⇪</div>
        Drop images / videos / audio here, or{' '}
        <label className="btn sm primary" style={{ display: 'inline-flex', margin: '0 4px' }}>
          browse files
          <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.mp3,.wav,.aac,.m4a,.ogg" style={{ display: 'none' }} onChange={(e) => doUpload(e.target.files)} />
        </label>
        <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>
          Max 50 MB per file · JPG / PNG / WEBP / GIF / MP4 / MOV / WEBM / MP3 / WAV / AAC / M4A / OGG
        </div>
        {progress !== null && (
          <div style={{ maxWidth: 280, margin: '12px auto 0' }}>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', 'image', 'video', 'audio'] as const).map((f) => (
          <button key={f} className={`btn sm ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <span className="badge">{shown.length} item(s)</span>
      </div>

      {loading && <div className="loading-block"><div className="spinner" /></div>}
      {!loading && shown.length === 0 && <EmptyState text="No media yet — upload something above." />}
      <div className="grid grid-4">
        {shown.map((m) => (
          <div className="card" key={m.id} style={{ padding: 10 }}>
            <div style={{ height: 110, borderRadius: 8, overflow: 'hidden', background: 'var(--card-2)', display: 'grid', placeItems: 'center', marginBottom: 8 }}>
              {m.kind === 'image' && m.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              ) : m.kind === 'video' && m.dataUrl ? (
                <video src={m.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
              ) : m.kind === 'audio' && m.dataUrl ? (
                <div style={{ fontSize: 36 }}>♪</div>
              ) : <div style={{ fontSize: 26 }}>{m.kind === 'image' ? '▣' : m.kind === 'video' ? '▶' : '♪'}</div>}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 6px' }}>{m.kind} · {fmt(m.size)}</div>
            {m.dataUrl && m.kind !== 'image' && (
              <button className="btn sm" style={{ width: '100%', marginBottom: 5 }} onClick={() => {
                if (m.dataUrl) {
                  const w = window.open(); if (w) { w.document.write(`<body style="margin:0;background:#111;display:grid;place-items:center;height:100vh"><${m.kind === 'audio' ? 'audio' : 'video'} src="${m.dataUrl}" controls autoplay/></body>`); }
                }
              }}>Preview</button>
            )}
            <button className="btn sm danger" style={{ width: '100%' }} onClick={() => remove(m.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
