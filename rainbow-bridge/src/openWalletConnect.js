/**
 * Standalone WalletConnect session — generates a QR URI without RainbowKit.
 * Uses @walletconnect/ethereum-provider with showQrModal:false; we render QR ourselves.
 */
import { projectId, pulseChain, appName, appDescription, appIcon } from './config.js';

/** @type {import('@walletconnect/ethereum-provider').default | null} */
let activeProvider = null;

export async function disconnectWalletConnect() {
  try {
    if (activeProvider) await activeProvider.disconnect();
  } catch {
    /* ignore */
  }
  activeProvider = null;
}

/**
 * @param {{
 *   onUri: (uri: string) => void,
 *   onConnected: (detail: object) => void,
 *   onError: (err: Error) => void,
 *   signal?: AbortSignal,
 * }} handlers
 */
export async function openWalletConnectSession({ onUri, onConnected, onError, signal } = {}) {
  try {
    await disconnectWalletConnect();

    const mod = await import('@walletconnect/ethereum-provider');
    const EthereumProvider = mod.default || mod.EthereumProvider;
    if (!EthereumProvider?.init) {
      throw new Error('WalletConnect library failed to load');
    }

    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://voodootoken.com';

    const chainId = pulseChain?.id || 369;

    const provider = await EthereumProvider.init({
      projectId,
      chains: [chainId],
      optionalChains: [1, chainId],
      showQrModal: false, // WE draw the QR
      metadata: {
        name: appName || 'Voodoo Staking Portal',
        description: appDescription || 'Stake VDO on PulseChain',
        url: origin,
        icons: [appIcon || 'https://voodootoken.com/Voodoo-Token-Logo.png'],
      },
    });

    if (signal?.aborted) {
      try {
        await provider.disconnect();
      } catch {
        /* ignore */
      }
      return null;
    }

    activeProvider = provider;

    provider.on('display_uri', (uri) => {
      console.info('[WalletConnect] display_uri — QR ready');
      onUri?.(String(uri));
    });

    // connect() emits display_uri then waits until phone approves
    provider
      .connect()
      .then(() => {
        const accounts = provider.accounts || [];
        if (!accounts.length) {
          onError?.(new Error('Connected but no account returned'));
          return;
        }
        const detail = {
          provider,
          address: accounts[0],
          connectorId: 'walletConnect-official',
          connectorName: 'WalletConnect',
          walletKind: 'rainbow',
        };
        if (window.VoodooRainbow) {
          window.VoodooRainbow.lastConnectorId = 'walletConnect-official';
        }
        window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', { detail }));
        onConnected?.(detail);
        console.info('[WalletConnect] connected', accounts[0]);
      })
      .catch((err) => {
        const msg = String(err?.message || err || 'Connection failed');
        if (/reset|reject|denied|closed|abort|cancel/i.test(msg)) {
          onError?.(Object.assign(new Error('cancelled'), { code: 'ACTION_REJECTED' }));
          return;
        }
        console.error('[WalletConnect] connect error', err);
        onError?.(err instanceof Error ? err : new Error(msg));
      });

    return provider;
  } catch (err) {
    console.error('[WalletConnect] init failed', err);
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
