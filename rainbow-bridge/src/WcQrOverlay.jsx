/**
 * Always-on-top WalletConnect QR overlay.
 * Does not depend on RainbowKit or @walletconnect/modal packages.
 */
import { createPortal } from 'react-dom';

export default function WcQrOverlay({ open, uri, status, error, onClose, onRetry }) {
  if (!open) return null;

  const qrSrc = uri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(uri)}`
    : '';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="WalletConnect QR"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.6)',
        padding: 16,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          background: '#fff',
          borderRadius: 20,
          padding: '24px 22px 20px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
          color: '#0f172a',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>WalletConnect</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Scan with MetaMask, Trust, Rainbow, …
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              border: 'none',
              borderRadius: 12,
              background: '#f1f5f9',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            minHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          {(status === 'loading' || status === 'idle') && (
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  margin: '0 auto 12px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#3b99fc',
                  borderRadius: '50%',
                  animation: 'voodoo-spin 0.8s linear infinite',
                }}
              />
              Generating QR code…
            </div>
          )}

          {status === 'qr' && qrSrc && (
            <>
              <img
                src={qrSrc}
                width={280}
                height={280}
                alt="WalletConnect QR"
                style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
              />
              <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>
                Open your mobile wallet → WalletConnect / Scan → point at this code.
              </p>
            </>
          )}

          {status === 'connected' && (
            <div style={{ color: '#16a34a', fontWeight: 700 }}>Connected ✓</div>
          )}

          {status === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: 8 }}>Could not start WalletConnect</div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{error || 'Unknown error'}</div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: 12,
                    padding: '10px 16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes voodoo-spin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body,
  );
}
