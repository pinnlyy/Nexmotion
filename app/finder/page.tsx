'use client';
import { useState, useCallback, useEffect } from 'react';
import { EmptyState, ErrorState, Loading } from '@/components/ui/States';
import { useToast } from '@/components/layout/LayoutShell';

interface Result {
  id: string; title: string; description: string; thumbnail: string | null;
  platform: string; creator: string; url: string; presetLinks: string[];
}

const HISTORY_KEY = 'nexmotion.searchHistory';

export default function FinderPage() {
  const toast = useToast();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [source, setSource] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); } catch { /* ignore */ }
  }, []);

  const saveHistory = (q: string) => {
    const next = [q, ...history.filter((x) => x !== q)].slice(0, 12);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const doSearch = useCallback(async (q: string, m: 'fast' | 'deep', pg = 1) => {
    if (!q.trim()) { toast('Enter something to search', 'warn'); return; }
    setLoading(true); setError(null); setResults([]);
    try {
      saveHistory(q);
      const res = await fetch(`/api/find?input=${encodeURIComponent(q)}&mode=${m}&page=${pg}`);
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Search failed'); return; }
      setSource(data.source);
      setResults(data.results || []);
      const isRegistryConfigured = data.total === 0 && data.source === 'none';
      if (isRegistryConfigured) {
        toast('No registry configured (NEX_PRESET_API_URL). Results are empty by design.', 'warn');
      } else if (!data.results?.length) {
        toast('No results found — the source may be private or unsupported.', 'warn');
      }
      setPage(pg);
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally { setLoading(false); }
  }, [history, toast]);

  return (
    <div>
      <h1 className="page-title">Finder</h1>
      <p className="page-sub">Search presets by URL, keyword, or song title. Fast mode hits direct sources; Deep mode also probes descriptions.</p>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className={`btn sm ${mode === 'fast' ? 'primary' : ''}`} onClick={() => setMode('fast')}>⚡ Fast</button>
          <button className={`btn sm ${mode === 'deep' ? 'primary' : ''}`} onClick={() => setMode('deep')}>🔍 Deep</button>
        </div>
        <div className="searchbar">
          <input
            className="input"
            placeholder="Paste a TikTok/YouTube/Instagram URL, direct .xml link, or a keyword…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(input, mode); }}
          />
          <button className="btn primary" onClick={() => doSearch(input, mode)} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {history.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge">Recent</span>
            {history.slice(0, 6).map((q) => (
              <button key={q} className="btn sm" onClick={() => { setInput(q); doSearch(q, mode); }}>{q}</button>
            ))}
            <button className="btn sm danger" onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }}>Clear</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && <Loading text="Searching sources…" />}
        {!loading && error && <ErrorState text={error} />}
        {!loading && !error && results.length === 0 && !source && (
          <EmptyState text="Nothing searched yet — try a keyword or URL above." />
        )}
        {!loading && !error && results.length === 0 && source && <EmptyState text="No results for this search." />}
        {!loading && !error && results.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="badge">{results.length} result(s) · source: {source}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm" disabled={page <= 1} onClick={() => doSearch(input, mode, page - 1)}>← Prev</button>
                <button className="btn sm" onClick={() => doSearch(input, mode, page + 1)}>Next →</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((r) => (
                <div className="result-card" key={r.id}>
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail} className="thumb" alt="" />
                  ) : (
                    <div className="thumb" style={{ display: 'grid', placeItems: 'center', fontSize: 32 }}>▶</div>
                  )}
                  <div className="meta">
                    <h4>{r.title}</h4>
                    <div className="desc">{r.description || '—'}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <span className="badge">{r.platform}</span>
                      <span className="badge">by {r.creator}</span>
                      {r.presetLinks.length > 0 && <span className="badge ok">{r.presetLinks.length} preset link(s)</span>}
                    </div>
                    <div className="result-actions">
                      {r.presetLinks.length > 0 && (
                        <a className="btn sm primary" href={`/player?url=${encodeURIComponent(r.presetLinks[0])}`}>▶ Open in Player</a>
                      )}
                      <a className="btn sm" href={r.url} target="_blank" rel="noreferrer">↗ Source</a>
                      <button className="btn sm" onClick={() => { navigator.clipboard.writeText(r.presetLinks[0] || r.url); toast('Link copied', 'ok'); }}>⎘ Copy Link</button>
                      {r.presetLinks.length > 0 && (
                        <button className="btn sm" onClick={() => {
                          r.presetLinks.slice(0, 5).forEach((p) => {
                            const a = document.createElement('a');
                            a.href = p; a.download = ''; a.target = '_blank';
                            document.body.appendChild(a); a.click(); a.remove();
                          });
                          toast('Preset download initiated (from source link)', 'ok');
                        }}>↧ Download XML</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
