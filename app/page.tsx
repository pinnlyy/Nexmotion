import Link from 'next/link';

const FEATURES = [
  { href: '/finder', ico: '⌕', title: 'Finder', desc: 'Search presets by URL, song, keyword, or creator with Fast & Deep modes.' },
  { href: '/player', ico: '▶', title: 'Player', desc: 'Import XML or a share link, preview, inspect layers, and swap media.' },
  { href: '/media', ico: '▣', title: 'Media Manager', desc: 'Upload, preview and organize media, then slot-select them per project.' },
  { href: '/export', ico: '↧', title: 'Export Preset', desc: 'Package edited XML into a downloadable XML or project ZIP.' },
  { href: '/effects', ico: '✦', title: 'Preview Effects', desc: 'Try real WebGL effects on your own image with live parameters.' },
  { href: '/export', ico: '⚙', title: 'Video Export', desc: 'Render your project to MP4/WebM with configurable resolutions.' },
];

const FAQ_PREVIEW = [
  ['What is Nexmotion?', 'A web platform to discover, preview, edit and export Alight Motion presets — entirely in your browser.'],
  ['Does it use my credentials?', 'No. All API credentials live in server-side environment variables and are never exposed to the page.'],
  ['Can I run render jobs?', 'Yes — the Player renders in-browser via Canvas/WebCodecs. A headless Chromium+FFmpeg adapter exists for self-host deployments.'],
];

export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <h1>Nex<span>motion</span> — Preset Playground</h1>
        <p>
          Discover presets, inspect layers, replace media, preview effects and export the results — all from your browser, with real working tools.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <Link href="/finder" className="btn primary">⌕ Open Finder</Link>
          <Link href="/player" className="btn">▶ Quick Player</Link>
          <Link href="/media" className="btn">▣ Media Manager</Link>
          <Link href="/docs" className="btn">⌗ API Docs</Link>
        </div>
      </section>

      <div className="grid grid-3">
        {FEATURES.map((f) => (
          <div className="card" key={f.href + f.title}>
            <h3>{f.ico} {f.title}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>{f.desc}</p>
            <Link href={f.href} className="btn sm primary">Open</Link>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <h3>❓ FAQ</h3>
        <div>
          {FAQ_PREVIEW.map(([q, a]) => (
            <details className="faq-item" key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Link href="/faq" className="btn sm">See all FAQ →</Link>
        </div>
      </div>

      <div className="card">
        <h3>♥ Support this project</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 12 }}>
          Nexmotion is built as an independent platform. If you find it useful, you can support the instance operator via the Donation page.
        </p>
        <Link href="/donate" className="btn sm primary">Open Donation page →</Link>
      </div>

      <div className="card">
        <h3>About Nexmotion</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 12 }}>
          Currently NOT bundled with any external API key. The Finder adapter is wired to environment
          variables (NEX_PRESET_API_URL / NEX_PRESET_API_KEY) — plug a registry in and keyword search becomes live.
          Direct XML and share-link handling works out of the box. Server-side headless rendering (Chromium+FFmpeg)
          requires provisioning on your own deployment.
        </p>
        <Link href="/about" className="btn sm">Learn more →</Link>
      </div>
    </div>
  );
}
