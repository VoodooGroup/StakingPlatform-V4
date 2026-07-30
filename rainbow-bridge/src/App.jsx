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

/** White modal surfaces + dim backdrop so QR / lists stay readable */
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
  const { address, isConnected, status, connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const lastEmitted = useRef('');
  const wasModalOpen = useRef(false);

  const emitConnected = useCallback(async () => {
    if (!isConnected || !address) return;
    try {
      let eip1193 = null;
      if (connector?.getProvider) {
        try {
          eip1193 = await connector.getProvider({ chainId: pulseChain.id });
        } catch {
          eip1193 = await connector.getProvider();
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
          new Promise((resolve) => setTimeout(resolve, 8000)),
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
   * Close without connect → free Other button.
   * Also abort half-open wagmi connect so the next wallet can start clean.
   */
  useEffect(() => {
    if (wasModalOpen.current && !connectModalOpen) {
      if (!isConnected) {
        disconnectAsync?.().catch(() => {});
        lastEmitted.current = '';
        window.dispatchEvent(new CustomEvent('voodoo:rainbow-modal-closed', {
          detail: { reason: 'dismissed' },
        }));
      }
    }
    wasModalOpen.current = Boolean(connectModalOpen);

    if (window.VoodooRainbow) {
      window.VoodooRainbow.connectModalOpen = Boolean(connectModalOpen);
    }
  }, [connectModalOpen, isConnected, disconnectAsync]);

  useEffect(() => {
    const openModalSafe = () => {
      try {
        if (isConnected) {
          openAccountModal?.();
          return true;
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
      openConnectModal: openModalSafe,
      openAccountModal: () => openAccountModal?.(),
      openChainModal: () => openChainModal?.(),
      disconnect: async () => {
        try {
          await disconnectAsync?.();
        } catch {
          /* ignore */
        }
        lastEmitted.current = '';
      },
      isConnected: () => Boolean(isConnected && address),
      getAddress: () => address || null,
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
    address,
    status,
    connectModalOpen,
  ]);

  // Empty host — RainbowKit portals modals to document.body on their own
  return null;
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme}
          /* wide = previous side-by-side layout (list + detail).
             Wallet switching works because pulseWallet() strips hanging QR getUri. */
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
