'use client';
import { useEffect, useState, createContext, useContext, useCallback } from 'react';

/* ---------------- Toasts ---------------- */
type Toast = { id: number; msg: string; kind: 'info' | 'ok' | 'err' | 'warn' };
const ToastCtx = createContext<(msg: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Confirm dialog ---------------- */
const ConfirmCtx = createContext<(msg: string) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ msg: string; resolve: (b: boolean) => void } | null>(null);
  const ask = useCallback(
    (msg: string) => new Promise<boolean>((resolve) => setState({ msg, resolve })),
    []
  );
  const close = (val: boolean) => {
    state?.resolve(val);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <div className="modal-backdrop" onClick={() => close(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Are you sure?</h3>
            <p>{state.msg}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => close(false)}>Cancel</button>
              <button className="btn danger" onClick={() => close(true)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ---------------- Error boundary ---------------- */
import { Component } from 'react';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: any) {
    return { err: String(e?.message || e) };
  }
  render() {
    if (this.state.err)
      return (
        <div style={{ padding: 40 }}>
          <div className="error-state">Unexpected error: {this.state.err}</div>
        </div>
      );
    return this.props.children;
  }
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('/');
  useEffect(() => {
    setPath(window.location.pathname);
    const handler = () => { setPath(window.location.pathname); setOpen(false); };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const NavLink = ({ href, ico, label }: any) => (
    <a
      href={href}
      className={`nav-link ${path === href ? 'active' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({}, '', href);
        setPath(href);
        setOpen(false);
      }}
    >
      <span className="nav-ico">{ico}</span>
      {label}
    </a>
  );

  return (
    <ToastProvider>
      <ConfirmProvider>
        <ErrorBoundary>
          <div className="mobile-topbar">
            <button className="hamburger" onClick={() => setOpen(!open)}>☰</button>
            <div className="logo-name" style={{ fontWeight: 700 }}>
              Nex<span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>motion</span>
            </div>
          </div>
          <div className="app-shell">
            <aside className={`sidebar ${open ? 'open' : ''}`}>
              <div className="logo">
                <div className="logo-mark">N</div>
                <div className="logo-name">Nex<span>motion</span></div>
              </div>
              <NavLink href="/" ico="⌂" label="Home" />
              <NavLink href="/finder" ico="⌕" label="Finder" />
              <NavLink href="/player" ico="▶" label="Player" />
              <NavLink href="/media" ico="▣" label="Media" />
              <NavLink href="/export" ico="↧" label="Export Preset" />
              <NavLink href="/effects" ico="✦" label="Preview Effects" />
              <NavLink href="/prem" ico="★" label="AM Prem" />
              <NavLink href="/docs" ico="⌗" label="API Docs" />
              <NavLink href="/settings" ico="⚙" label="Settings" />
              <NavLink href="/donate" ico="♥" label="Donate" />
              <NavLink href="/faq" ico="?" label="FAQ" />
              <NavLink href="/about" ico="i" label="About" />
              <div className="spacer" />
              <div className="sidebar-foot">Nexmotion v1.0<br />Built for creators.</div>
            </aside>
            <main className="main">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </ErrorBoundary>
      </ConfirmProvider>
    </ToastProvider>
  );
}
