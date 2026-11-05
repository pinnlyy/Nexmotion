'use client';
import { useState } from 'react';
import { useToast } from '@/components/layout/LayoutShell';

export default function ExportPage() {
  const toast = useToast();
  const [xml, setXml] = useState('');
  const [filename, setFilename] = useState('nexmotion-project');
  const [includeMedia, setIncludeMedia] = useState(false);
  const [busy, setBusy] = useState(false);

  // video export
  const [res, setRes] = useState('720p');
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState('medium');
  const [audio, setAudio] = useState(true);
  const [fmt, setFmt] = useState<'mp4' | 'webm'>('webm');
  const [renderMsg, setRenderMsg] = useState<string | null>(null);
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const doExport = async (kind: 'xml' | 'zip') => {
    if (!xml.trim()) { toast('Paste preset XML first', 'warn'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/export/preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml, filename, includeMedia: kind === 'zip' && includeMedia }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast(d.error || 'Export failed', 'err');
        return;
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = kind === 'zip' && includeMedia ? `${filename}.zip` : `${filename}.xml`;
      a.click();
      toast('Export completed', 'ok');
    } finally { setBusy(false); }
  };

  const doVideoRender = async () => {
    setRenderErr(null); setRenderMsg('Preparing render…'); setFileUrl(null); setFileSize(null);
    try {
      const r = await fetch('/api/export/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetTarget: xml, width: undefined, height: undefined, fps, quality, format: fmt, includeAudio: audio }),
      });
      const d = await r.json();
      if (!d.ok) { setRenderErr(d.error || 'Render setup failed'); setRenderMsg(null); return; }
      if (d.nextStep === 'client-render') {
        setRenderMsg(
          'Server-side headless rendering is not provisioned on this deployment. In-browser WebCodecs/MediaRecorder rendering is used instead — open this project in the Player → Export menu to render with real encoding.'
        );
      } else if (d.nextStep === 'download') {
        setRenderMsg('Rendered server-side.');
        setFileSize(d.serverResult?.bytes || null);
        setFileUrl(d.serverResult?.fileUrl || null);
      }
    } catch (err: any) {
      setRenderErr(err?.message || 'Render failed');
      setRenderMsg(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Export</h1>
      <p className="page-sub">Export the edited preset (XML or ZIP) — or run a real video render job.</p>

      <div className="card">
        <h3>↧ Preset export</h3>
        <label className="label">Project XML</label>
        <textarea className="textarea" rows={8} value={xml} onChange={(e) => setXml(e.target.value)} placeholder="Paste the edited preset XML here…" />
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="label">Filename</label>
            <input className="input" value={filename} onChange={(e) => setFilename(e.target.value.replace(/[^\w.\- ]/g, '_'))} />
          </div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, marginTop: 18 }}>
            <input type="checkbox" checked={includeMedia} onChange={(e) => setIncludeMedia(e.target.checked)} />
            Include media files (ZIP)
          </label>
          <button className={`btn primary ${busy ? '' : ''}`} disabled={busy} onClick={() => doExport(includeMedia ? 'zip' : 'xml')}>
            {busy ? 'Exporting…' : includeMedia ? 'Export ZIP' : 'Export XML'}
          </button>
          <button className="btn" disabled={busy} onClick={() => doExport('xml')}>Force plain XML</button>
        </div>
      </div>

      <div className="card">
        <h3>⚙ Video export</h3>
        <div className="grid grid-3">
          <div>
            <label className="label">Resolution</label>
            <select className="select" value={res} onChange={(e) => setRes(e.target.value)}>
              <option>480p</option><option>720p</option><option>1080p</option>
            </select>
          </div>
          <div>
            <label className="label">FPS</label>
            <select className="select" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              <option value={24}>24 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option>
            </select>
          </div>
          <div>
            <label className="label">Quality</label>
            <select className="select" value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="label">Format</label>
            <select className="select" value={fmt} onChange={(e) => setFmt(e.target.value as any)}>
              <option value="mp4">MP4</option><option value="webm">WebM</option>
            </select>
          </div>
          <div>
            <label className="label">Audio</label>
            <button className={`btn ${audio ? 'primary' : ''}`} onClick={() => setAudio((v) => !v)} style={{ width: '100%' }}>
              {audio ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn primary" onClick={doVideoRender}>→ Start video render</button>
        </div>
        {renderMsg && <div className="empty" style={{ marginTop: 12, color: 'var(--ok)' }}>{renderMsg}</div>}
        {renderErr && <ErrorState text={renderErr} />}
        {fileUrl && (
          <div style={{ marginTop: 12 }}>
            <a className="btn primary" href={fileUrl} download>↧ Download ({fileSize ? `${(fileSize / 1e6).toFixed(1)} MB` : 'output'})</a>
          </div>
        )}
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          PNG frame export is available from the Player canvas. Headless Chromium + FFmpeg workers appear here
          automatically once provisioned via your deployment.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return <div className="error-state" style={{ marginTop: 12 }}>✕ {text}</div>;
}
