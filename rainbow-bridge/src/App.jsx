import { useCallback, useEffect, useRef } from 'react';
import {
  ConnectButton,
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  WagmiProvider,
  useAccount,
  useDisconnect,
  useSwitchChain,
} from 'wagmi';
import { config, pulseChain, projectId } from './config';

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
theme.colors.connectButtonBackground = '#ffffff';
theme.colors.connectButtonInnerBackground = '#f8fafc';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Clear WalletConnect / wagmi session leftovers that block reopening */
function clearWalletSessions() {
  try {
    const kill = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        /walletconnect|wagmi|wc@2|WALLETCONNECT|rk-/i.test(k)
        || k.includes('clientOne')
        || k.includes('clientTwo')
        || k.includes('@w3m')
        || k.includes('reown')
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
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

/**
 * Bridge using ConnectButton.Custom — always has a real openConnectModal when
 * disconnected, and a real button we can .click() after disconnect.
 *
 * This avoids useConnectModal going stale/undefined after WalletConnect.
 */
function RainbowBridgeInner() {
  const { address, isConnected, connector, status } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const lastEmitted = useRef('');
  const connectBtnRef = useRef(null);
  const accountBtnRef = useRef(null);
  const openConnectFn = useRef(null);
  const openAccountFn = useRef(null);
  const disconnectRef = useRef(disconnectAsync);

  useEffect(() => {
    disconnectRef.current = disconnectAsync;
  }, [disconnectAsync]);

  // Push connection into the static dapp when wagmi connects (incl. WalletConnect)
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

      const key = `${address}:${connector.id || 'wc'}`;
      if (lastEmitted.current === key) return;

      try {
        let eip1193 = null;
        try {
          eip1193 = await connector.getProvider();
        } catch (e) {
          console.warn('[VoodooRainbow] getProvider', e);
        }
        if (!eip1193 || cancelled) return;

        lastEmitted.current = key;
        const detail = {
          provider: eip1193,
          address,
          connectorId: connector.id || null,
          connectorName: connector.name || 'Wallet',
          walletKind: 'rainbow',
        };

        window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', { detail }));
        if (typeof window.VoodooRainbow?._onConnected === 'function') {
          try {
            window.VoodooRainbow._onConnected(detail);
          } catch {
            /* ignore */
          }
        }

        // Best-effort PulseChain (never block)
        if (switchChainAsync) {
          Promise.race([
            switchChainAsync({ chainId: pulseChain.id }),
            sleep(5000),
          ]).catch(() => {});
        }
      } catch (err) {
        console.error('[VoodooRainbow] sync failed', err);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, connector, switchChainAsync]);

  const hardReset = useCallback(async () => {
    lastEmitted.current = '';
    try {
      await disconnectRef.current?.();
    } catch {
      /* ignore */
    }
    clearWalletSessions();
    // Second disconnect after storage clear
    try {
      await disconnectRef.current?.();
    } catch {
      /* ignore */
    }
    await sleep(200);
  }, []);

  /**
   * Always open RainbowKit connect list.
   * If a session is live, disconnect + clear WC storage first, then click the
   * real ConnectButton so openConnectModal is valid again.
   */
  const openConnectSafe = useCallback(async () => {
    try {
      // If already connected in wagmi, RK will not open connect modal until we disconnect
      if (isConnected || status === 'connecting' || status === 'reconnecting') {
        await hardReset();
        // Wait for ConnectButton to re-render with openConnectModal
        for (let i = 0; i < 50; i++) {
          await sleep(40);
          if (typeof openConnectFn.current === 'function' && connectBtnRef.current) {
            break;
          }
        }
      }

      if (typeof openConnectFn.current === 'function') {
        openConnectFn.current();
        return true;
      }
      // Fallback: real DOM click on hidden ConnectButton
      if (connectBtnRef.current) {
        connectBtnRef.current.click();
        return true;
      }
      console.error('[VoodooRainbow] no connect opener available');
      return false;
    } catch (err) {
      console.error('[VoodooRainbow] openConnectSafe failed', err);
      return false;
    }
  }, [isConnected, status, hardReset]);

  const openAccountSafe = useCallback(() => {
    if (typeof openAccountFn.current === 'function') {
      openAccountFn.current();
      return true;
    }
    if (accountBtnRef.current) {
      accountBtnRef.current.click();
      return true;
    }
    // Not connected → open connect instead
    return openConnectSafe();
  }, [openConnectSafe]);

  // Publish API for the static portal (updated every relevant change)
  useEffect(() => {
    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      projectId,
      status,
      connectModalOpen: false,
      wagmiConnected: Boolean(isConnected && address),
      openConnectModal: async (opts = {}) => {
        // mode account only when dapp asks and we are connected
        if (opts.mode === 'account' && isConnected && address) {
          return openAccountSafe();
        }
        // Default / forceConnect → always show wallet list (disconnect first if needed)
        return openConnectSafe();
      },
      openAccountModal: openAccountSafe,
      hardReset,
      disconnect: hardReset,
      isConnected: () => Boolean(isConnected && address),
      getAddress: () => address || null,
      getStatus: () => status,
      _onConnected: window.VoodooRainbow?._onConnected || null,
    });
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
  }, [
    isConnected,
    address,
    status,
    openConnectSafe,
    openAccountSafe,
    hardReset,
  ]);

  return (
    <div
      id="voodoo-rk-connect-host"
      aria-hidden="true"
      style={{
        position: 'fixed',
        width: 1,
        height: 1,
        left: -9999,
        top: 0,
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
          openChainModal,
          openConnectModal,
          mounted,
        }) => {
          // Keep latest openers in refs (works even if parent effect is late)
          openConnectFn.current = openConnectModal || null;
          openAccountFn.current = openAccountModal || null;

          const ready = mounted;
          const connected = ready && account && chain;

          return (
            <div style={{ display: 'flex', gap: 4 }}>
              {!connected ? (
                <button
                  ref={connectBtnRef}
                  type="button"
                  id="voodoo-rk-connect-btn"
                  onClick={openConnectModal}
                >
                  Connect
                </button>
              ) : (
                <button
                  ref={accountBtnRef}
                  type="button"
                  id="voodoo-rk-account-btn"
                  onClick={openAccountModal}
                >
                  Account
                </button>
              )}
              {connected && chain?.unsupported ? (
                <button type="button" onClick={openChainModal}>
                  Wrong network
                </button>
              ) : null}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
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
          <RainbowBridgeInner />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
