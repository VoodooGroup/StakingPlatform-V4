import { useCallback, useEffect, useRef } from 'react';
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

/**
 * Simple, reliable bridge — NO remount of Wagmi/RainbowKit (that broke opening).
 *
 * openConnectModal from RainbowKit is only defined when disconnected.
 * After WalletConnect, we disconnect first, wait for React to re-render,
 * then call the fresh openConnectModal.
 */
function RainbowBridgeInner() {
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { openChainModal } = useChainModal();
  const { address, isConnected, status, connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const lastEmitted = useRef('');
  const wasModalOpen = useRef(false);
  const closeTimer = useRef(null);
  const openConnectRef = useRef(openConnectModal);
  const openAccountRef = useRef(openAccountModal);
  const disconnectRef = useRef(disconnectAsync);
  const connectedRef = useRef(false);
  /** After disconnect, open the connect modal once hooks update */
  const pendingOpenConnect = useRef(false);

  useEffect(() => {
    openConnectRef.current = openConnectModal;
    openAccountRef.current = openAccountModal;
    disconnectRef.current = disconnectAsync;
  }, [openConnectModal, openAccountModal, disconnectAsync]);

  useEffect(() => {
    connectedRef.current = Boolean(isConnected && address);
  }, [isConnected, address]);

  // Fulfill "open connect after disconnect" without remounting
  useEffect(() => {
    if (!pendingOpenConnect.current) return;
    if (isConnected) return;
    if (typeof openConnectModal !== 'function') return;
    pendingOpenConnect.current = false;
    // Next tick so RainbowKit internal modal state is ready
    const t = setTimeout(() => {
      try {
        openConnectModal();
      } catch (e) {
        console.error('[VoodooRainbow] deferred open failed', e);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [isConnected, openConnectModal, status]);

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
      if (!eip1193) return;

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
        ]).catch(() => {});
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

    if (wasModalOpen.current && !connectModalOpen && !isConnected) {
      closeTimer.current = setTimeout(() => {
        if (!connectedRef.current) {
          window.dispatchEvent(new CustomEvent('voodoo:rainbow-modal-closed', {
            detail: { reason: 'dismissed' },
          }));
        }
      }, 800);
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
    const hardReset = async () => {
      lastEmitted.current = '';
      connectedRef.current = false;
      pendingOpenConnect.current = false;
      try {
        await disconnectRef.current?.();
      } catch {
        /* ignore */
      }
      await sleep(150);
    };

    /**
     * Open RainbowKit UI.
     * - mode 'account': account modal if connected
     * - forceConnect / mode 'connect': disconnect if needed, then open wallet list
     * - default: account if connected, else wallet list
     */
    const openModalSafe = async (opts = {}) => {
      const forceConnect = Boolean(opts.forceConnect || opts.mode === 'connect');
      const wantAccount = opts.mode === 'account';

      try {
        // Account only
        if (wantAccount && connectedRef.current) {
          if (typeof openAccountRef.current === 'function') {
            openAccountRef.current();
            return true;
          }
        }

        // Already connected and not forcing new connect → account modal
        if (!forceConnect && connectedRef.current) {
          if (typeof openAccountRef.current === 'function') {
            openAccountRef.current();
            return true;
          }
        }

        // Need connect modal. openConnectModal is only available when disconnected.
        if (connectedRef.current || status === 'connecting' || status === 'reconnecting') {
          pendingOpenConnect.current = true;
          await hardReset();
          // Effect above will open when openConnectModal returns
          // Fallback poll in case effect misses
          for (let i = 0; i < 40; i++) {
            await sleep(50);
            if (typeof openConnectRef.current === 'function' && !connectedRef.current) {
              pendingOpenConnect.current = false;
              openConnectRef.current();
              return true;
            }
          }
          pendingOpenConnect.current = false;
          return false;
        }

        // Already disconnected — open immediately
        if (typeof openConnectRef.current === 'function') {
          openConnectRef.current();
          return true;
        }

        // Soft wait for hook
        for (let i = 0; i < 20; i++) {
          await sleep(50);
          if (typeof openConnectRef.current === 'function') {
            openConnectRef.current();
            return true;
          }
        }
        return false;
      } catch (err) {
        console.error('[VoodooRainbow] open failed', err);
        pendingOpenConnect.current = false;
        return false;
      }
    };

    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      projectId,
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
    });
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
  }, [
    openChainModal,
    connectModalOpen,
    status,
    address,
    isConnected,
  ]);

  return null;
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
