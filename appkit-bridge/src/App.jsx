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

// Create AppKit once — includes WalletConnect + injected wallets
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
  defaultNetwork: pulseChain,
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Same pattern as Reown / ChatGPT docs:
 *   const { open } = useAppKit()
 *   const { address, isConnected } = useAppKitAccount()
 * plus wagmi useAccount for EIP-1193 provider → static staking page.
 */
function BridgeInner() {
  const { open, close } = useAppKit();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const { address, isConnected, connector, status } = useAccount();
  const { disconnectAsync } = useDisconnect();

  const lastEmitted = useRef('');
  const openRef = useRef(open);
  const disconnectRef = useRef(disconnectAsync);

  useEffect(() => {
    openRef.current = open;
    disconnectRef.current = disconnectAsync;
  }, [open, disconnectAsync]);

  // Prefer AppKit account; fall back to wagmi
  const liveAddress = appKitAddress || address || null;
  const liveConnected = Boolean(appKitConnected || (isConnected && address));

  // Push connection into the static staking dapp (ethers v5)
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (!isConnected || !address || !connector) {
        if (!isConnected && !appKitConnected) {
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

        window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', {
          detail: {
            provider: eip1193,
            address,
            connectorId: connector.id || 'appkit',
            connectorName: connector.name || 'Wallet',
            walletKind: 'rainbow',
          },
        }));
        console.info('[VoodooAppKit] connected', address, connector.name);
      } catch (err) {
        console.error('[VoodooAppKit] sync failed', err);
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, connector, appKitConnected]);

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

  // ChatGPT-style: open() from useAppKit()
  const openConnect = useCallback(async () => {
    try {
      if (liveConnected) {
        openRef.current?.({ view: 'Account' });
        return true;
      }
      openRef.current?.({ view: 'Connect' });
      return true;
    } catch (e) {
      console.error('[VoodooAppKit] open() failed', e);
      try {
        appKit.open({ view: 'Connect' });
        return true;
      } catch (e2) {
        console.error('[VoodooAppKit] appKit.open failed', e2);
        return false;
      }
    }
  }, [liveConnected]);

  // API for static portal (Other button → window.VoodooRainbow)
  useEffect(() => {
    window.VoodooRainbow = Object.assign(window.VoodooRainbow || {}, {
      ready: true,
      engine: 'appkit',
      projectId,
      status,
      wagmiConnected: liveConnected,
      openConnectModal: openConnect,
      openAccountModal: () => {
        try {
          openRef.current?.({ view: 'Account' });
          return true;
        } catch {
          return false;
        }
      },
      openWalletConnect: openConnect,
      hardReset,
      disconnect: hardReset,
      isConnected: () => liveConnected,
      getAddress: () => liveAddress,
      getStatus: () => status,
      close: () => {
        try {
          close?.();
          appKit.close?.();
        } catch {
          /* ignore */
        }
      },
    });
    window.dispatchEvent(new CustomEvent('voodoo:rainbow-ready'));
  }, [liveConnected, liveAddress, status, openConnect, hardReset, close]);

  // Invisible host — modal is opened via open(); optional built-in button for debug
  return (
    <div
      id="voodoo-appkit-host"
      style={{
        position: 'fixed',
        left: -9999,
        top: 0,
        width: 1,
        height: 1,
        overflow: 'hidden',
        opacity: 0,
      }}
    >
      {/* Built-in Reown button (hidden). Other uses open() from useAppKit. */}
      <appkit-button />
    </div>
  );
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
