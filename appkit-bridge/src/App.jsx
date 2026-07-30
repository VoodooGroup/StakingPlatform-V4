import { useCallback, useEffect, useRef } from 'react';
import { createAppKit, useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount, useDisconnect } from 'wagmi';
import {
  projectId,
  networks,
  metadata,
  wagmiAdapter,
  wagmiConfig,
  pulseChain,
} from './config';

const queryClient = new QueryClient();

// Create AppKit once (includes WalletConnect + injected wallets)
const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  themeMode: 'light',
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  // Prefer PulseChain
  defaultNetwork: pulseChain,
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function BridgeInner() {
  const { open, close } = useAppKit();
  const appKitAccount = useAppKitAccount();
  const { address, isConnected, connector, status } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const lastEmitted = useRef('');
  const openRef = useRef(open);
  const disconnectRef = useRef(disconnectAsync);

  useEffect(() => {
    openRef.current = open;
    disconnectRef.current = disconnectAsync;
  }, [open, disconnectAsync]);

  // Push connected wallet into the static staking dapp (ethers v5)
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

      const key = `${address}:${connector.id || 'appkit'}`;
      if (lastEmitted.current === key) return;

      try {
        let eip1193 = null;
        try {
          eip1193 = await connector.getProvider();
        } catch (e) {
          console.warn('[VoodooAppKit] getProvider failed', e);
        }
        if (!eip1193 || cancelled) return;

        lastEmitted.current = key;
        if (window.VoodooRainbow) {
          window.VoodooRainbow.lastConnectorId = connector.id || 'appkit';
        }

        const detail = {
          provider: eip1193,
          address,
          connectorId: connector.id || 'appkit',
          connectorName: connector.name || 'Wallet',
          walletKind: 'rainbow',
        };

        window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', { detail }));
        console.info('[VoodooAppKit] connected', address, connector.name);
      } catch (err) {
        console.error('[VoodooAppKit] sync failed', err);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, connector]);

  const hardReset = useCallback(async () => {
    lastEmitted.current = '';
    try {
      await disconnectRef.current?.();
    } catch {
      /* ignore */
    }
    try {
      await appKit.disconnect?.();
    } catch {
      /* ignore */
    }
    await sleep(150);
  }, []);

  const openConnect = useCallback(async () => {
    try {
      // If already connected, open account view; else connect view
      if (isConnected && address) {
        openRef.current?.({ view: 'Account' });
        return true;
      }
      openRef.current?.({ view: 'Connect' });
      return true;
    } catch (e) {
      console.error('[VoodooAppKit] open failed', e);
      try {
        appKit.open({ view: 'Connect' });
        return true;
      } catch (e2) {
        console.error('[VoodooAppKit] appKit.open failed', e2);
        return false;
      }
    }
  }, [isConnected, address]);

  // Publish same API the static portal already expects (VoodooRainbow)
  useEffect(() => {
    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      engine: 'appkit',
      projectId,
      status,
      wagmiConnected: Boolean(isConnected && address),
      openConnectModal: openConnect,
      openAccountModal: () => {
        try {
          openRef.current?.({ view: 'Account' });
          return true;
        } catch {
          return false;
        }
      },
      /** @deprecated — AppKit Connect view includes WalletConnect */
      openWalletConnect: openConnect,
      hardReset,
      disconnect: hardReset,
      isConnected: () => Boolean(isConnected && address),
      getAddress: () => address || null,
      getStatus: () => status,
      appKitAccount,
      close: () => {
        try {
          appKit.close();
        } catch {
          /* ignore */
        }
      },
    });
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
  }, [isConnected, address, status, openConnect, hardReset, appKitAccount]);

  return null;
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BridgeInner />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
