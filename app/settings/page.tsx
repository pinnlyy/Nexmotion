'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/layout/LayoutShell';

export default function SettingsPage() {
  const toast = useToast();
  const [history, setHistory] = useState<string[]>([]);
  const [playerDefaults, setPlayerDefaults] = useState({ previewQuality: 0.5, capFps: 30, autoplay: false, loop: true });

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem('nexmotion.searchHistory') || '[]'));
      const p = localStorage.getItem('nexmotion.playerDefaults');
      if (p) setPlayerDefaults(JSON.parse(p));
    } catch { /* ignore */ }
  }, []);

  const savePlayer = (v: Partial<typeof playerDefaults>) => {
    const next = { ...playerDefaults, ...v };
    setPlayerDefaults(next);
    localStorage.setItem('nexmotion.playerDefaults', JSON.stringify(next));
    toast('Player defaults saved', 'ok');
  };

  const clearHistory = () => {
    localStorage.removeItem('nexmotion.searchHistory');
    setHistory([]);
    toast('Search history cleared', 'ok');
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Local preferences. These are stored only in your browser (no server tracking).</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>▶ Player defaults</h3>
        <div className="grid grid-3">
          <div>
            <label className="label">Preview quality</label>
            <select className="select" value={playerDefaults.previewQuality} onChange={(e) => savePlayer({ previewQuality: Number(e.target.value) })}>
              <option value={0.25}>Quarter</option><option value={0.5}>Half</option><option value={1}>Full</option>
            </select>
          </div>
          <div>
            <label className="label">Preview FPS cap</label>
            <select className="select" value={playerDefaults.capFps} onChange={(e) => savePlayer({ capFps: Number(e.target.value) })}>
              <option value={24}>24</option><option value={30}>30</option><option value={60}>60</option>
            </select>
          </div>
          <div>
            <label className="label">Playback</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={`btn sm ${playerDefaults.autoplay ? 'primary' : ''}`} onClick={() => savePlayer({ autoplay: !playerDefaults.autoplay })}>
                Autoplay {playerDefaults.autoplay ? 'on' : 'off'}
              </button>
              <button className={`btn sm ${playerDefaults.loop ? 'primary' : ''}`} onClick={() => savePlayer({ loop: !playerDefaults.loop })}>
                Loop {playerDefaults.loop ? 'on' : 'off'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>⌕ Search history</h3>
        {history.length === 0 ? (
          <div className="empty">No stored searches.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {history.map((q, i) => <span className="badge" key={i}>{q}</span>)}
            </div>
            <button className="btn danger sm" onClick={clearHistory}>Clear history</button>
          </>
        )}
      </div>

      <div className="card">
        <h3>About / System information</h3>
        <table className="tbl">
          <tbody>
            <tr><td>Platform</td><td>Nexmotion v1.0 (Next.js App Router)</td></tr>
            <tr><td>Renderer</td><td>Browser Canvas / WebGL / WebCodecs (client)</td></tr>
            <tr><td>Headless worker</td><td>Adapter present (Playwright + FFmpeg) — requires provisioning</td></tr>
            <tr><td>Registry</td><td>{'Uses NEX_PRESET_API_URL when configured'}</td></tr>
            <tr><td>Telemetry</td><td>None</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
