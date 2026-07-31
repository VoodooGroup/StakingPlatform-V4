import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectButton,
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { disconnect as coreDisconnect, getAccount, getConnections } from '@wagmi/core';
import { WagmiProvider, useAccount } from 'wagmi';
import { config, pulseChain, projectId } from './config';
import WcQrOverlay from './WcQrOverlay.jsx';
import { openWalletConnectSession, disconnectWalletConnect } from './openWalletConnect.js';

const queryClient = new QueryClient();

const theme = lightTheme({
  accentColor: '#2563eb',
  accentColorForeground: '#ffffff',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
});

theme.colors.modalBackground = '#ffffff';
theme.colors.modalBorder = 'rgba(15, 23, 42, 0.10)';
theme.colors.modalBackdrop = 'rgba(15, 23, 42, 0.45)';
theme.colors.profileForeground = '#ffffff';
theme.colors.menuItemBackground = 'rgba(37, 99, 235, 0.08)';
theme.colors.closeButtonBackground = 'rgba(15, 23, 42, 0.06)';
theme.colors.generalBorder = 'rgba(15, 23, 42, 0.10)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clearWcStorage() {
  try {
    const kill = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const low = k.toLowerCase();
      if (
        low.includes('walletconnect')
        || low.includes('wagmi')
        || low.includes('wc@')
        || low.includes('reown')
        || low.includes('@w3m')
        || low.includes('clientone')
        || low.includes('clienttwo')
      ) {
        kill.push(k);
      }
    }
    kill.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

async function killAllSessions() {
  try {
    for (const c of getConnections(config)) {
      try {
        await coreDisconnect(config, { connector: c.connector });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  try {
    await coreDisconnect(config);
  } catch {
    /* ignore */
  }
  clearWcStorage();
  await sleep(80);
}

function isWalletConnectRowClick(target) {
  if (!(target instanceof Element)) return false;
  const opt = target.closest('[data-testid*="wallet-option"]');
  if (!opt) return false;
  const id = (opt.getAttribute('data-testid') || '').toLowerCase();
  const text = (opt.textContent || '').toLowerCase();
  return (
    id.includes('walletconnect')
    || id.includes('voodoo-walletconnect')
    || text.includes('walletconnect')
  );
}

function BridgeInner() {
  const { address, isConnected, connector, status } = useAccount();
  const lastEmitted = useRef('');
  const openConnectFn = useRef(null);
  const openAccountFn = useRef(null);
  const readyOnce = useRef(false);
  const wcBusy = useRef(false);
  const wcAbort = useRef(0);

  const [wcOpen, setWcOpen] = useState(false);
  const [wcUri, setWcUri] = useState('');
  const [wcStatus, setWcStatus] = useState('idle');
  const [wcError, setWcError] = useState('');

  const closeWcOverlay = useCallback(async () => {
    wcAbort.current += 1;
    setWcOpen(false);
    setWcUri('');
    setWcStatus('idle');
    setWcError('');
    wcBusy.current = false;
    try {
      await disconnectWalletConnect();
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * OUR QR overlay — not RainbowKit "What is a wallet?", not missing WC modal package.
   * display_uri → QR image the user can scan.
   */
  const startWalletConnectQr = useCallback(async () => {
    if (wcBusy.current) return;
    wcBusy.current = true;
    const session = ++wcAbort.current;

    setWcOpen(true);
    setWcUri('');
    setWcError('');
    setWcStatus('loading');
    console.info('[WalletConnect] starting QR session…');

    await openWalletConnectSession({
      onUri: (uri) => {
        if (session !== wcAbort.current) return;
        setWcUri(uri);
        setWcStatus('qr');
      },
      onConnected: () => {
        if (session !== wcAbort.current) return;
        setWcStatus('connected');
        setTimeout(() => {
          if (session === wcAbort.current) {
            setWcOpen(false);
            setWcStatus('idle');
            wcBusy.current = false;
          }
        }, 500);
      },
      onError: (err) => {
        if (session !== wcAbort.current) return;
        wcBusy.current = false;
        if (err?.code === 'ACTION_REJECTED' || /cancel/i.test(err?.message || '')) {
          setWcOpen(false);
          setWcStatus('idle');
          return;
        }
        setWcStatus('error');
        setWcError(String(err?.message || err || 'Failed'));
      },
    });
  }, []);

  /**
   * Intercept WalletConnect row in RainbowKit (by testid OR label text).
   * Stop RK from navigating to intro/"What is a wallet?" — open our QR instead.
   */
  useEffect(() => {
    const onClickCapture = (e) => {
      const t = e.target;
      if (!isWalletConnectRowClick(t)) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      console.info('[WalletConnect] row click intercepted → own QR overlay');
      startWalletConnectQr();
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [startWalletConnectQr]);

  // Wire RainbowKit/WC connection → static staking page
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!isConnected || !address || !connector) {
        if (!isConnected) {
          lastEmitted.current = '';
          window.dispatchEvent(new CustomEvent('voodoo:rainbow-disconnected'));
        }
        return;
      }

      const key = `${address}:${connector.id || 'rk'}`;
      if (lastEmitted.current === key) return;

      try {
        let eip1193 = null;
        try {
          eip1193 = await connector.getProvider();
        } catch (e) {
          console.warn('[RainbowKit] getProvider', e);
        }
        if (!eip1193 || cancelled) return;

        lastEmitted.current = key;
        if (window.VoodooRainbow) {
          window.VoodooRainbow.lastConnectorId = connector.id || 'rainbowkit';
        }

        window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', {
          detail: {
            provider: eip1193,
            address,
            connectorId: connector.id || 'rainbowkit',
            connectorName: connector.name || 'Wallet',
            walletKind: 'rainbow',
          },
        }));
        console.info('[RainbowKit] connected', address, connector.name);
      } catch (err) {
        console.error('[RainbowKit] sync failed', err);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, connector]);

  /**
   * Zombie cleanup for WalletConnect ONLY.
   * Never kill injected / Voodoo sessions: when the user connects via the
   * standalone Voodoo button, RainbowKit's injected connector also lights up;
   * killAllSessions() used to wipe that ~2.5s later and the dapp "forgot" the wallet.
   */
  useEffect(() => {
    if (!isConnected || !address) return undefined;
    const t = setTimeout(() => {
      try {
        const acc = getAccount(config);
        if (!acc?.isConnected) return;

        const dappOk = Boolean(window.VoodooWallet?.getActiveProvider?.());
        if (dappOk) return;

        const id = String(acc.connector?.id || '').toLowerCase();
        const name = String(acc.connector?.name || '').toLowerCase();
        const isWalletConnect =
          id.includes('walletconnect')
          || id.includes('wallet_connect')
          || name.includes('walletconnect')
          || id === 'voodoo-walletconnect';

        // Injected / browser extension (Voodoo, MetaMask, …) — leave alone
        if (!isWalletConnect) {
          console.info('[RainbowKit] skip zombie kill for non-WC connector', id || name);
          return;
        }

        console.warn('[RainbowKit] zombie WC session — kill + allow reopen');
        killAllSessions().then(() => {
          lastEmitted.current = '';
        }).catch(() => {});
      } catch (e) {
        console.warn('[RainbowKit] zombie check failed', e);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [isConnected, address]);

  const hardReset = useCallback(async () => {
    lastEmitted.current = '';
    await killAllSessions();
  }, []);

  /**
   * Open RainbowKit modal.
   * forceConnect / after WC stuck: kill sessions + FULL REMOUNT so openConnectModal exists again.
   */
  const openConnect = useCallback(async (opts = {}) => {
    const force = Boolean(opts.forceConnect || opts.mode === 'connect');
    const wantAccount = opts.mode === 'account';

    try {
      // Account view when fully connected
      if (wantAccount && isConnected && address && typeof openAccountFn.current === 'function') {
        openAccountFn.current();
        return true;
      }

      const stuck = isConnected
        || status === 'connecting'
        || status === 'reconnecting'
        || getAccount(config).isConnected;

      // Connected in dapp + not forcing list → account modal
      if (
        !force
        && isConnected
        && address
        && window.VoodooWallet?.getActiveProvider?.()
        && typeof openAccountFn.current === 'function'
      ) {
        openAccountFn.current();
        return true;
      }

      // Clean first open — do NOT remount (that broke first load before)
      if (!stuck && typeof openConnectFn.current === 'function') {
        openConnectFn.current();
        return true;
      }

      // --- After WalletConnect: session stuck → kill + remount RK tree ---
      await killAllSessions();
      lastEmitted.current = '';

      if (typeof window.__voodooRemountRainbowKit === 'function') {
        const ok = await new Promise((resolve) => {
          let done = false;
          const finish = (v) => {
            if (done) return;
            done = true;
            window.removeEventListener('voodoo:rainbow-ready', onReady);
            clearTimeout(timer);
            resolve(v);
          };
          const onReady = () => {
            setTimeout(() => finish(true), 150);
          };
          window.addEventListener('voodoo:rainbow-ready', onReady);
          const timer = setTimeout(() => finish(false), 4000);
          window.__voodooRemountRainbowKit();
        });

        if (ok && typeof window.VoodooRainbow?.__openConnectRaw === 'function') {
          window.VoodooRainbow.__openConnectRaw();
          return true;
        }
      }

      // Fallback poll
      for (let i = 0; i < 50; i++) {
        await sleep(40);
        if (typeof openConnectFn.current === 'function' && !getAccount(config).isConnected) {
          openConnectFn.current();
          return true;
        }
        const el = document.getElementById('voodoo-rk-connect-btn');
        if (el && !getAccount(config).isConnected) {
          el.click();
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('[RainbowKit] openConnect failed', e);
      return false;
    }
  }, [isConnected, address, status]);

  // Publish API (called on every mount/remount)
  useEffect(() => {
    const rawOpen = () => {
      if (typeof openConnectFn.current === 'function') {
        openConnectFn.current();
        return true;
      }
      document.getElementById('voodoo-rk-connect-btn')?.click();
      return true;
    };

    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      engine: 'rainbowkit',
      projectId,
      status,
      wagmiConnected: Boolean(isConnected && address),
      openConnectModal: openConnect,
      /** Used after remount — call open without kill/remount loop */
      __openConnectRaw: rawOpen,
      openAccountModal: () => {
        if (typeof openAccountFn.current === 'function') {
          openAccountFn.current();
          return true;
        }
        return false;
      },
      hardReset,
      disconnect: hardReset,
      openWalletConnectQr: startWalletConnectQr,
      isConnected: () => Boolean(isConnected && address),
      getAddress: () => address || null,
      getStatus: () => status,
    });
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
    if (!readyOnce.current) {
      readyOnce.current = true;
      console.info('[RainbowKit] ready — WalletConnect uses own QR overlay (not RK intro)');
    }
  }, [isConnected, address, status, openConnect, hardReset, startWalletConnectQr]);

  return (
    <>
      <WcQrOverlay
        open={wcOpen}
        uri={wcUri}
        status={wcStatus}
        error={wcError}
        onClose={closeWcOverlay}
        onRetry={() => startWalletConnectQr()}
      />
      <div
        id="voodoo-rk-host"
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openConnectModal,
            openChainModal,
            mounted,
          }) => {
            openConnectFn.current = typeof openConnectModal === 'function' ? openConnectModal : null;
            openAccountFn.current = typeof openAccountModal === 'function' ? openAccountModal : null;
            const connected = Boolean(mounted && account && chain);

            return (
              <div style={{ pointerEvents: 'auto' }}>
                <button
                  type="button"
                  id="voodoo-rk-connect-btn"
                  onClick={() => openConnectModal?.()}
                >
                  Connect
                </button>
                {connected ? (
                  <button type="button" id="voodoo-rk-account-btn" onClick={() => openAccountModal?.()}>
                    Account
                  </button>
                ) : null}
                {connected && chain?.unsupported ? (
                  <button type="button" onClick={() => openChainModal?.()}>
                    Network
                  </button>
                ) : null}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme}
          modalSize="wide"
          initialChain={pulseChain}
          showRecentTransactions={false}
          appInfo={{
            appName: 'Voodoo Staking Portal',
            learnMoreUrl: 'https://voodootoken.com',
          }}
        >
          <BridgeInner />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
