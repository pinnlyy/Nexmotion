import { getDonationConfig, DONATION_DISCLAIMER } from '@/lib/scraper/donation';

export const dynamic = 'force-dynamic';

export default function DonatePage() {
  const cfg = getDonationConfig();
  return (
    <div>
      <h1 className="page-title">Donation</h1>
      <p className="page-sub">Support the Nexmotion instance operator. Nexmotion does NOT process payments or confirm transactions — verify everything in your own payment app.</p>

      {cfg.qrisImage && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>QRIS</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.qrisImage} alt="QRIS code" style={{ maxWidth: 260, borderRadius: 10, display: 'block' }} />
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>💳 Payment methods</h3>
        {cfg.methods.map((m) => (
          <div key={m.id} className="card" style={{ background: 'var(--bg-elev)', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{m.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{m.detail}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--warn)' }}>Note: {m.note}</div>
          </div>
        ))}
        {!cfg.qrisImage && (
          <div className="empty" style={{ marginTop: 10 }}>
            Instance operator hasn't configured a QRIS image yet (set NEX_QRIS_IMAGE_URL on the server to show one).
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>ℹ Instructions</h3>
        <ul style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Scan or use the payment method details shown above.</li>
          <li>Enter the amount you want to give (whenever your provider allows).</li>
          <li>Verify the recipient name before confirming — Nexmotion cannot do it for you.</li>
        </ul>
      </div>

      <div className="card">
        <h3>📞 Support</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{cfg.supportContact}</p>
        <p style={{ color: 'var(--warn)', fontSize: 12.5, marginTop: 10, whiteSpace: 'pre-line' }}>{DONATION_DISCLAIMER}</p>
      </div>
    </div>
  );
}
