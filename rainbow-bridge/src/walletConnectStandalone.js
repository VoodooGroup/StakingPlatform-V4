/**
 * Standalone WalletConnect — loaded only when the user clicks the button.
 * Dynamic import so a WC package error cannot crash RainbowKit on page load.
 */

/** @type {any} */
let activeProvider = null;

export async function connectWalletConnectStandalone({
  projectId,
  appName,
  appDescription,
  appUrl,
  appIcon,
  chainId = 369,
}) {
  try {
    if (activeProvider) {
      await activeProvider.disconnect();
    }
  } catch {
    /* ignore */
  }
  activeProvider = null;

  // Dynamic import — keeps initial page load stable
  const mod = await import('@walletconnect/ethereum-provider');
  const EthereumProvider = mod.default || mod.EthereumProvider;
  if (!EthereumProvider?.init) {
    throw new Error('WalletConnect library failed to load.');
  }

  const provider = await EthereumProvider.init({
    projectId,
    chains: [chainId],
    optionalChains: [1, chainId],
    showQrModal: true,
    metadata: {
      name: appName || 'Voodoo Staking Portal',
      description: appDescription || 'Stake VDO on PulseChain',
      url: appUrl || 'https://voodootoken.com',
      icons: [appIcon || 'https://voodootoken.com/Voodoo-Token-Logo.png'],
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
    if (activeProvider) await activeProvider.disconnect();
  } catch {
    /* ignore */
  }
  activeProvider = null;
}
