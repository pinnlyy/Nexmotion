import { PREM_PLANS, PREM_OFFICIAL_NOTE, getPremAdapter } from '@/lib/scraper/prem';

export default function PremPage() {
  const acc = getPremAdapter().getAccountInfo(null);
  return (
    <div>
      <h1 className="page-title">AM Prem</h1>
      <p className="page-sub">Informational section about premium subscriptions. Nexmotion <b>does not</b> sell, generate or activate any official Alight Motion premium account.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>★ Subscription status</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge acc">{acc.status === 'none' ? 'Not subscribed via Nexmotion' : acc.status}</span>
          <span className="badge">{acc.plan || 'Free tier'}</span>
          <span className="badge">Valid until: {acc.validUntil || '—'}</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 10 }}>{acc.note}</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>☰ Available plans on Nexmotion (this instance)</h3>
        <div className="grid grid-2">
          {PREM_PLANS.map((p) => (
            <div key={p.id} className="card" style={{ background: 'var(--bg-elev)' }}>
              <h3 style={{ marginBottom: 6, fontSize: 16 }}>{p.name}</h3>
              <div className="badge acc" style={{ marginBottom: 10 }}>{p.price}</div>
              <ul style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.8, paddingLeft: 18 }}>
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>🛡 Official activation instructions</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, whiteSpace: 'pre-line', lineHeight: 1.7 }}>{PREM_OFFICIAL_NOTE}</p>
        <div className="empty" style={{ marginTop: 12, color: 'var(--warn)' }}>
          ⚠ Nexmotion intentionally does NOT implement bulk account creation, magic login links, password capture, or automated activation.
        </div>
      </div>

      <div className="card">
        <h3>🐍 Support</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
          For Nexmotion issues (not Alight Motion licensing), reach the instance operator via the <a href="/donate" style={{ color: 'var(--accent)' }}>Donation / Support</a> page.
        </p>
      </div>
    </div>
  );
}
