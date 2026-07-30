import { useCallback, useEffect, useRef } from 'react';
import {
  ConnectButton,
  RainbowKitProvider,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { disconnect as coreDisconnect, getConnections, getAccount } from '@wagmi/core';
import {
  WagmiProvider,
  useAccount,
  useSwitchChain,
} from 'wagmi';
import {
  config,
  pulseChain,
  projectId,
  appName,
  appDescription,
  appUrl,
  appIcon,
} from './config';

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

async function killWagmiSessions() {
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
  await sleep(80);
}

function RainbowBridgeInner() {
  const { address, isConnected, connector, status } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const lastEmitted = useRef('');
  const openConnectFn = useRef(null);
  const openAccountFn = useRef(null);
  const connectBtnRef = useRef(null);

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
      const key = `${address}:${connector.id || 'x'}`;
      if (lastEmitted.current === key) return;
      try {
        let eip1193 = null;
        try {
          eip1193 = await connector.getProvider();
        } catch {
          /* ignore */
        }
        if (!eip1193 || cancelled) return;
        lastEmitted.current = key;
        if (window.VoodooRainbow) {
          window.VoodooRainbow.lastConnectorId = connector.id || 'rainbowkit';
        }
        const detail = {
          provider: eip1193,
          address,
          connectorId: connector.id,
          connectorName: connector.name || 'Wallet',
          walletKind: 'rainbow',
        };
        window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', { detail }));
        if (switchChainAsync) {
          Promise.race([
            switchChainAsync({ chainId: pulseChain.id }),
            sleep(5000),
          ]).catch(() => {});
        }
      } catch (e) {
        console.error('[VoodooRainbow] sync', e);
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
      const { disconnectWalletConnectStandalone } = await import('./walletConnectStandalone.js');
      await disconnectWalletConnectStandalone();
    } catch {
      /* ignore */
    }
    await killWagmiSessions();
  }, []);

  const openRainbowKit = useCallback(async () => {
    try {
      if (getAccount(config).isConnected) {
        await killWagmiSessions();
        for (let i = 0; i < 40; i++) {
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
      return false;
    } catch (e) {
      console.error('[VoodooRainbow] openRainbowKit', e);
      return false;
    }
  }, []);

  const openAccount = useCallback(() => {
    if (typeof openAccountFn.current === 'function') {
      openAccountFn.current();
      return true;
    }
    return openRainbowKit();
  }, [openRainbowKit]);

  const openWalletConnect = useCallback(async () => {
    await killWagmiSessions();
    const { connectWalletConnectStandalone } = await import('./walletConnectStandalone.js');
    return connectWalletConnectStandalone({
      projectId,
      appName,
      appDescription,
      appUrl,
      appIcon,
      chainId: pulseChain.id,
    });
  }, []);

  useEffect(() => {
    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      projectId,
      status,
      wagmiConnected: Boolean(isConnected && address),
      openConnectModal: async (opts = {}) => {
        if (opts.mode === 'account' && isConnected && address) return openAccount();
        return openRainbowKit();
      },
      openAccountModal: openAccount,
      openWalletConnect,
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
    openRainbowKit,
    openAccount,
    openWalletConnect,
    hardReset,
  ]);

  return (
    <div
      id="voodoo-rk-connect-host"
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
        {({ account, chain, openAccountModal, openConnectModal, openChainModal, mounted }) => {
          openConnectFn.current = typeof openConnectModal === 'function' ? openConnectModal : null;
          openAccountFn.current = typeof openAccountModal === 'function' ? openAccountModal : null;
          const connected = Boolean(mounted && account && chain);
          return (
            <div style={{ pointerEvents: 'auto' }}>
              <button
                ref={connectBtnRef}
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
          <RainbowBridgeInner />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
