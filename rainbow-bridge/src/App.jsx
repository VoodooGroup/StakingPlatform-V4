import { useCallback, useEffect, useRef } from 'react';
import {
  ConnectButton,
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { disconnect as wagmiDisconnect, getConnections, getAccount } from '@wagmi/core';
import {
  WagmiProvider,
  useAccount,
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

/** Remove WalletConnect / wagmi cached sessions that keep isConnected stuck true */
function clearWalletSessions() {
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
        || low.startsWith('rk-')
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

/**
 * Disconnect every active connection + clear WC storage.
 * This is what makes "Other" work again after WalletConnect.
 */
async function killAllWalletSessions() {
  try {
    const connections = getConnections(config);
    for (const c of connections) {
      try {
        await wagmiDisconnect(config, { connector: c.connector });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  try {
    await wagmiDisconnect(config);
  } catch {
    /* ignore */
  }
  clearWalletSessions();
  await sleep(100);
  // Second pass after storage clear
  try {
    const connections = getConnections(config);
    for (const c of connections) {
      try {
        await wagmiDisconnect(config, { connector: c.connector });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  await sleep(150);
}

function RainbowBridgeInner() {
  const { address, isConnected, connector, status } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const lastEmitted = useRef('');
  const openConnectFn = useRef(null);
  const openAccountFn = useRef(null);
  const connectBtnRef = useRef(null);
  const accountBtnRef = useRef(null);

  // Sync wagmi connection → static staking dapp
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

  /**
   * Zombie session killer:
   * If WalletConnect sets isConnected but the staking dapp never got a provider
   * within 3s, kill the session so Other can open RainbowKit again.
   */
  useEffect(() => {
    if (!isConnected || !address) return undefined;
    const t = setTimeout(() => {
      const dappLive = Boolean(window.VoodooWallet?.getActiveProvider?.());
      if (!dappLive && getAccount(config).isConnected) {
        console.warn('[VoodooRainbow] zombie WalletConnect session — clearing');
        killAllWalletSessions().catch(() => {});
        lastEmitted.current = '';
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [isConnected, address]);

  const hardReset = useCallback(async () => {
    lastEmitted.current = '';
    await killAllWalletSessions();
  }, []);

  /**
   * Open wallet list. ALWAYS kills zombie WC first so openConnectModal exists.
   */
  const openConnectSafe = useCallback(async () => {
    try {
      // Always clear sessions before opening list — WC leaves isConnected=true
      // which hides openConnectModal and locks the UI.
      await killAllWalletSessions();

      // Wait until ConnectButton re-renders in "disconnected" mode
      for (let i = 0; i < 60; i++) {
        await sleep(50);
        const acc = getAccount(config);
        if (!acc.isConnected && typeof openConnectFn.current === 'function') {
          openConnectFn.current();
          return true;
        }
        // DOM fallback
        const el = document.getElementById('voodoo-rk-connect-btn');
        if (el && !acc.isConnected) {
          el.click();
          return true;
        }
      }

      // Last resort: click whatever connect handler we have
      if (typeof openConnectFn.current === 'function') {
        openConnectFn.current();
        return true;
      }
      const el = document.getElementById('voodoo-rk-connect-btn');
      if (el) {
        el.click();
        return true;
      }

      console.error('[VoodooRainbow] failed to open connect modal after killAllWalletSessions');
      return false;
    } catch (err) {
      console.error('[VoodooRainbow] openConnectSafe', err);
      return false;
    }
  }, []);

  const openAccountSafe = useCallback(async () => {
    if (typeof openAccountFn.current === 'function' && isConnected) {
      openAccountFn.current();
      return true;
    }
    const el = document.getElementById('voodoo-rk-account-btn');
    if (el && isConnected) {
      el.click();
      return true;
    }
    // Not connected → open connect list
    return openConnectSafe();
  }, [isConnected, openConnectSafe]);

  // Publish API for static portal
  useEffect(() => {
    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      projectId,
      status,
      wagmiConnected: Boolean(isConnected && address),
      openConnectModal: async (opts = {}) => {
        if (opts.mode === 'account' && isConnected && address) {
          return openAccountSafe();
        }
        // forceConnect / default → always kill sessions + open list
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
  }, [isConnected, address, status, openConnectSafe, openAccountSafe, hardReset]);

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
        // pointer-events none would block .click() in some browsers — keep auto on host child
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
          // Always keep latest openers (even when connected)
          openConnectFn.current = typeof openConnectModal === 'function' ? openConnectModal : null;
          openAccountFn.current = typeof openAccountModal === 'function' ? openAccountModal : null;

          const ready = mounted;
          const connected = Boolean(ready && account && chain);

          return (
            <div style={{ display: 'flex', gap: 4, pointerEvents: 'auto' }}>
              {/* ALWAYS mount connect button so we can click it after disconnect */}
              <button
                ref={connectBtnRef}
                type="button"
                id="voodoo-rk-connect-btn"
                onClick={() => {
                  if (typeof openConnectModal === 'function') openConnectModal();
                }}
              >
                Connect
              </button>
              <button
                ref={accountBtnRef}
                type="button"
                id="voodoo-rk-account-btn"
                onClick={() => {
                  if (typeof openAccountModal === 'function') openAccountModal();
                }}
                style={{ display: connected ? 'inline-block' : 'none' }}
              >
                Account
              </button>
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
