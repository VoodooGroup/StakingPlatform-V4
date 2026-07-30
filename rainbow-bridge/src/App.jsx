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

function RainbowBridgeInner() {
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
  // Live refs so openModalSafe never uses a stale isConnected after disconnect
  const connectedRef = useRef(false);
  const addressRef = useRef(null);

  useEffect(() => {
    connectedRef.current = Boolean(isConnected && address);
    addressRef.current = address || null;
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

      // Notify dapp FIRST — before chain switch (switch can hang on WC)
      window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', { detail }));
      if (typeof window.VoodooRainbow?._onConnected === 'function') {
        try {
          window.VoodooRainbow._onConnected(detail);
        } catch {
          /* ignore */
        }
      }

      // Best-effort PulseChain after dapp is live
      if (switchChainAsync) {
        Promise.race([
          switchChainAsync({ chainId: pulseChain.id }),
          new Promise((resolve) => setTimeout(resolve, 6000)),
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

  /**
   * Only fire "dismissed" when user closed WITHOUT connecting.
   * On successful WC connect, modal closes with isConnected=true — do not treat as cancel.
   */
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
      }, 600);
    }

    // Successful connect closes the modal — tell dapp waiters we are done opening UI
    if (wasModalOpen.current && !connectModalOpen && isConnected && address) {
      // no modal-closed cancel event
    }

    wasModalOpen.current = Boolean(connectModalOpen);

    if (window.VoodooRainbow) {
      window.VoodooRainbow.connectModalOpen = Boolean(connectModalOpen);
      window.VoodooRainbow.status = status;
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
      addressRef.current = null;
      try {
        await disconnectAsync?.();
      } catch {
        /* ignore */
      }
      // Allow React/wagmi to settle
      await new Promise((r) => setTimeout(r, 200));
    };

    /**
     * @param {{ mode?: 'auto'|'connect'|'account' }} [opts]
     * - auto: account modal if fully connected, else connect modal
     * - connect: always open connect list (disconnect first if needed)
     * - account: open account modal if connected
     */
    const openModalSafe = async (opts = {}) => {
      const mode = opts.mode || 'auto';
      try {
        const liveConnected = connectedRef.current || (isConnected && address);

        if (mode === 'account' || (mode === 'auto' && liveConnected && !opts.forceConnect)) {
          if (liveConnected && openAccountModal) {
            openAccountModal();
            return true;
          }
        }

        // Only reset when forced, stuck connecting, or opening connect while a dead session lingers
        const stuckConnecting = isConnecting || isReconnecting
          || status === 'connecting' || status === 'reconnecting';
        if (opts.forceConnect || stuckConnecting) {
          await hardReset();
        }

        if (typeof openConnectModal === 'function') {
          openConnectModal();
          return true;
        }
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
      connectModalOpen: Boolean(connectModalOpen),
      status,
      openConnectModal: openModalSafe,
      openAccountModal: () => openAccountModal?.(),
      openChainModal: () => openChainModal?.(),
      hardReset,
      disconnect: hardReset,
      isConnected: () => Boolean(connectedRef.current || (isConnected && address)),
      getAddress: () => addressRef.current || address || null,
      getStatus: () => status,
      _onConnected: window.VoodooRainbow?._onConnected || null,
    };

    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, api);
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
  }, [
    openConnectModal,
    openAccountModal,
    openChainModal,
    disconnectAsync,
    isConnected,
    isConnecting,
    isReconnecting,
    address,
    status,
    connectModalOpen,
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
