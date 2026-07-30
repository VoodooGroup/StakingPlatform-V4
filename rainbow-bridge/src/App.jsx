import { useCallback, useEffect, useRef } from 'react';
import {
  ConnectButton,
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { disconnect as coreDisconnect, getAccount, getConnections } from '@wagmi/core';
import {
  WagmiProvider,
  useAccount,
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
  await sleep(120);
}

/**
 * RainbowKit bridge for the "Other" button.
 * WalletConnect is listed INSIDE the RainbowKit connect modal.
 */
function BridgeInner() {
  const { address, isConnected, connector, status } = useAccount();
  const lastEmitted = useRef('');
  const openConnectFn = useRef(null);
  const openAccountFn = useRef(null);
  const connectBtnRef = useRef(null);

  // After RainbowKit connect (incl. WalletConnect) → notify static dapp
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
   * Zombie session: connected in wagmi but dapp never got provider → clear
   * so Other can open RainbowKit again after WalletConnect.
   */
  useEffect(() => {
    if (!isConnected || !address) return undefined;
    const t = setTimeout(() => {
      const dappOk = Boolean(window.VoodooWallet?.getActiveProvider?.());
      if (!dappOk && getAccount(config).isConnected) {
        console.warn('[RainbowKit] clearing zombie session after WalletConnect');
        killAllSessions().catch(() => {});
        lastEmitted.current = '';
      }
    }, 3500);
    return () => clearTimeout(t);
  }, [isConnected, address]);

  const hardReset = useCallback(async () => {
    lastEmitted.current = '';
    await killAllSessions();
  }, []);

  /**
   * Open RainbowKit connect modal (wallet list with WalletConnect inside).
   * If a session is stuck after WC, disconnect first so openConnectModal works.
   */
  const openConnect = useCallback(async (opts = {}) => {
    try {
      if (opts.mode === 'account' && isConnected && address && typeof openAccountFn.current === 'function') {
        openAccountFn.current();
        return true;
      }

      // Stuck or already connected → disconnect so connect list can open
      if (
        opts.forceConnect
        || isConnected
        || status === 'connecting'
        || status === 'reconnecting'
        || getAccount(config).isConnected
      ) {
        // If fully wired in dapp and user wants account, already handled above
        if (!opts.forceConnect && isConnected && address && opts.mode !== 'connect') {
          if (typeof openAccountFn.current === 'function') {
            openAccountFn.current();
            return true;
          }
        }
        await killAllSessions();
        for (let i = 0; i < 50; i++) {
          await sleep(40);
          if (!getAccount(config).isConnected && typeof openConnectFn.current === 'function') break;
        }
      }

      if (typeof openConnectFn.current === 'function') {
        openConnectFn.current();
        return true;
      }
      const el = document.getElementById('voodoo-rk-connect-btn');
      if (el) {
        el.click();
        return true;
      }
      console.error('[RainbowKit] openConnectModal unavailable');
      return false;
    } catch (e) {
      console.error('[RainbowKit] open failed', e);
      return false;
    }
  }, [isConnected, address, status]);

  useEffect(() => {
    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      engine: 'rainbowkit',
      projectId,
      status,
      wagmiConnected: Boolean(isConnected && address),
      openConnectModal: openConnect,
      openAccountModal: () => {
        if (typeof openAccountFn.current === 'function') {
          openAccountFn.current();
          return true;
        }
        return openConnect({ mode: 'account' });
      },
      hardReset,
      disconnect: hardReset,
      isConnected: () => Boolean(isConnected && address),
      getAddress: () => address || null,
      getStatus: () => status,
    });
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
  }, [isConnected, address, status, openConnect, hardReset]);

  return (
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
          // Keep openers live for the Other button
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
                <button type="button" onClick={() => openAccountModal?.()}>
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
