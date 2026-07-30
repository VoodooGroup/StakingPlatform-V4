import EthereumProvider from '@walletconnect/ethereum-provider';
import {
  projectId,
  appName,
  appDescription,
  appUrl,
  appIcon,
  pulseChain,
} from './config.js';

/** @type {import('@walletconnect/ethereum-provider').default | null} */
let activeProvider = null;

/**
 * Standalone WalletConnect (own QR modal — does NOT use RainbowKit connect state).
 * This prevents WC from locking the RainbowKit "Other" modal.
 */
export async function connectWalletConnectStandalone() {
  // Drop previous WC session if any
  try {
    if (activeProvider) {
      await activeProvider.disconnect();
    }
  } catch {
    /* ignore */
  }
  activeProvider = null;

  const provider = await EthereumProvider.init({
    projectId,
    // PulseChain primary; mainnet optional for broader mobile wallet support
    chains: [pulseChain.id],
    optionalChains: [1, pulseChain.id],
    showQrModal: true,
    metadata: {
      name: appName,
      description: appDescription,
      url: appUrl,
      icons: [appIcon],
    },
  });

  await provider.connect();

  const accounts = provider.accounts || [];
  if (!accounts.length) {
    throw new Error('WalletConnect connected but returned no account.');
  }

  activeProvider = provider;

  const detail = {
    provider,
    address: accounts[0],
    connectorId: 'walletConnect-standalone',
    connectorName: 'WalletConnect',
    walletKind: 'rainbow',
  };

  if (window.VoodooRainbow) {
    window.VoodooRainbow.lastConnectorId = 'walletConnect-standalone';
  }
  window.dispatchEvent(new CustomEvent('voodoo:rainbow-connected', { detail }));
  if (typeof window.VoodooRainbow?._onConnected === 'function') {
    try {
      window.VoodooRainbow._onConnected(detail);
    } catch {
      /* ignore */
    }
  }

  // Clean up on session delete
  try {
    provider.on('disconnect', () => {
      activeProvider = null;
      window.dispatchEvent(new CustomEvent('voodoo:rainbow-disconnected'));
    });
  } catch {
    /* ignore */
  }

  return detail;
}

export async function disconnectWalletConnectStandalone() {
  try {
    if (activeProvider) {
      await activeProvider.disconnect();
    }
  } catch {
    /* ignore */
  }
  activeProvider = null;
}

export function getStandaloneWcProvider() {
  return activeProvider;
}
