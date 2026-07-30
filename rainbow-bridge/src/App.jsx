import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RainbowKitProvider,
  lightTheme,
  useConnectModal,
  useAccountModal,
  useChainModal,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  WagmiProvider,
  useAccount,
  useConnectorClient,
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

function clientToEip1193(client) {
  if (!client) return null;
  const transport = client.transport;
  if (transport?.value && typeof transport.value.request === 'function') {
    return transport.value;
  }
  if (typeof transport?.request === 'function') {
    return transport;
  }
  return {
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        const addr = client.account?.address;
        return addr ? [addr] : [];
      }
      if (method === 'eth_chainId') {
        return `0x${Number(client.chain?.id || 369).toString(16)}`;
      }
      return client.request({ method, params });
    },
    on() {},
    removeListener() {},
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Holds the remount key so hardReset can rebuild RainbowKit after WalletConnect
 * leaves wagmi in a state where openConnectModal is undefined.
 */
function RainbowBridgeInner({ remountKey, requestRemount }) {
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { openChainModal } = useChainModal();
  const { address, isConnected, status, connector, isConnecting, isReconnecting } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const lastEmitted = useRef('');
  const wasModalOpen = useRef(false);
  const closeTimer = useRef(null);

  // Always-latest function refs (avoid stale undefined openConnectModal after WC connect)
  const openConnectRef = useRef(openConnectModal);
  const openAccountRef = useRef(openAccountModal);
  const disconnectRef = useRef(disconnectAsync);
  const connectedRef = useRef(false);

  useEffect(() => {
    openConnectRef.current = openConnectModal;
    openAccountRef.current = openAccountModal;
    disconnectRef.current = disconnectAsync;
  }, [openConnectModal, openAccountModal, disconnectAsync]);

  useEffect(() => {
    connectedRef.current = Boolean(isConnected && address);
  }, [isConnected, address]);

  const emitConnected = useCallback(async () => {
    if (!isConnected || !address) return;
    try {
      let eip1193 = null;
      if (connector?.getProvider) {
        try {
          eip1193 = await connector.getProvider();
        } catch (e) {
          console.warn('[VoodooRainbow] getProvider failed', e);
        }
      }
      if (!eip1193) eip1193 = clientToEip1193(connectorClient);
      if (!eip1193) {
        console.warn('[VoodooRainbow] connected but no EIP-1193 provider yet');
        return;
      }

      const key = `${address}:${connector?.id || 'unknown'}`;
      if (lastEmitted.current === key) return;
      lastEmitted.current = key;

      const detail = {
        provider: eip1193,
        address,
        connectorId: connector?.id || null,
        connectorName: connector?.name || 'Wallet',
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
          sleep(6000),
        ]).catch((err) => {
          console.warn('[VoodooRainbow] switch to PulseChain deferred:', err?.message || err);
        });
      }
    } catch (err) {
      console.error('[VoodooRainbow] emit connected failed', err);
      window.dispatchEvent(
        new CustomEvent('voodoo:rainbow-error', {
          detail: { message: err?.message || String(err) },
        }),
      );
    }
  }, [isConnected, address, connector, connectorClient, switchChainAsync]);

  useEffect(() => {
    emitConnected();
  }, [emitConnected]);

  useEffect(() => {
    if (!isConnected) {
      lastEmitted.current = '';
      window.dispatchEvent(new CustomEvent('voodoo:rainbow-disconnected'));
    }
  }, [isConnected]);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    // Only treat as user-dismiss when never became connected
    if (wasModalOpen.current && !connectModalOpen && !isConnected) {
      closeTimer.current = setTimeout(() => {
        if (!connectedRef.current) {
          window.dispatchEvent(new CustomEvent('voodoo:rainbow-modal-closed', {
            detail: { reason: 'dismissed' },
          }));
        }
      }, 700);
    }

    wasModalOpen.current = Boolean(connectModalOpen);

    if (window.VoodooRainbow) {
      window.VoodooRainbow.connectModalOpen = Boolean(connectModalOpen);
      window.VoodooRainbow.status = status;
      window.VoodooRainbow.wagmiConnected = Boolean(isConnected && address);
    }

    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [connectModalOpen, isConnected, address, status]);

  useEffect(() => {
    /**
     * Wait until RainbowKit exposes openConnectModal again.
     * After WC connects, openConnectModal is often undefined until disconnect + re-render.
     */
    async function waitForConnectOpener(maxMs = 2500) {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (typeof openConnectRef.current === 'function') {
          return openConnectRef.current;
        }
        await sleep(50);
      }
      return null;
    }

    const hardReset = async () => {
      lastEmitted.current = '';
      connectedRef.current = false;
      try {
        await disconnectRef.current?.();
      } catch {
        /* ignore */
      }
      await sleep(100);
      // Remount RainbowKit tree so connect modal API is always fresh
      requestRemount?.();
      await sleep(150);
    };

    /**
     * Always try to show a RainbowKit UI.
     * forceConnect: disconnect + remount + open wallet list (fixes "Other won't open").
     */
    const openModalSafe = async (opts = {}) => {
      const forceConnect = Boolean(opts.forceConnect || opts.mode === 'connect');
      const wantAccount = opts.mode === 'account' && !forceConnect;

      try {
        if (wantAccount && connectedRef.current && typeof openAccountRef.current === 'function') {
          openAccountRef.current();
          return true;
        }

        if (forceConnect || isConnecting || isReconnecting || status === 'connecting') {
          await hardReset();
        } else if (connectedRef.current && typeof openAccountRef.current === 'function') {
          // Default when session is live: account modal
          openAccountRef.current();
          return true;
        }

        let opener = await waitForConnectOpener(forceConnect ? 3000 : 1500);
        if (!opener && !forceConnect) {
          // One more nuclear attempt
          await hardReset();
          opener = await waitForConnectOpener(3000);
        }
        if (typeof opener === 'function') {
          opener();
          return true;
        }

        console.error('[VoodooRainbow] openConnectModal still unavailable after reset');
        window.dispatchEvent(
          new CustomEvent('voodoo:rainbow-error', {
            detail: { message: 'Could not open wallet modal. Please refresh the page.' },
          }),
        );
        return false;
      } catch (err) {
        console.error('[VoodooRainbow] openConnectModal failed', err);
        window.dispatchEvent(
          new CustomEvent('voodoo:rainbow-error', {
            detail: { message: err?.message || String(err) },
          }),
        );
        return false;
      }
    };

    const api = {
      ready: true,
      projectId,
      remountKey,
      connectModalOpen: Boolean(connectModalOpen),
      status,
      openConnectModal: openModalSafe,
      openAccountModal: () => openAccountRef.current?.(),
      openChainModal: () => openChainModal?.(),
      hardReset,
      disconnect: hardReset,
      isConnected: () => Boolean(connectedRef.current),
      getAddress: () => address || null,
      getStatus: () => status,
      _onConnected: window.VoodooRainbow?._onConnected || null,
    };

    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, api);
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
  }, [
    remountKey,
    requestRemount,
    openChainModal,
    isConnecting,
    isReconnecting,
    status,
    connectModalOpen,
    address,
  ]);

  return null;
}

export default function App() {
  const [remountKey, setRemountKey] = useState(0);
  const requestRemount = useCallback(() => {
    setRemountKey((k) => k + 1);
  }, []);

  return (
    <WagmiProvider config={config} key={`wagmi-${remountKey}`}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          key={`rk-${remountKey}`}
          theme={theme}
          modalSize="wide"
          initialChain={pulseChain}
          showRecentTransactions={false}
          appInfo={{
            appName: 'Voodoo Staking Portal',
            learnMoreUrl: 'https://voodootoken.com',
          }}
        >
          <RainbowBridgeInner
            remountKey={remountKey}
            requestRemount={requestRemount}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
