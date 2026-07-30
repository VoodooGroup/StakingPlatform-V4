import { createConnector } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { VOODOO_WALLET_ICON } from './voodooIconData.js';

const INSTALL_URL = 'https://github.com/Voodoo-Token/voodoo-pulse-extension';
const RDNS = 'app.voodoowallet';

function isVoodooProvider(provider) {
  if (!provider) return false;
  if (provider.isVoodooWallet === true || provider._isVoodooWallet === true) return true;
  if (typeof provider.providerInfo?.rdns === 'string'
    && provider.providerInfo.rdns.toLowerCase() === RDNS) {
    return true;
  }
  return false;
}

function findVoodooProvider() {
  if (typeof window === 'undefined') return undefined;

  if (window.voodooEthereum && isVoodooProvider(window.voodooEthereum)) {
    return window.voodooEthereum;
  }
  if (window.VoodooWalletProvider && isVoodooProvider(window.VoodooWalletProvider)) {
    return window.VoodooWalletProvider;
  }

  const eth = window.ethereum;
  if (!eth) return undefined;

  if (Array.isArray(eth.providers) && eth.providers.length) {
    const found = eth.providers.find(isVoodooProvider);
    if (found) return found;
  }

  if (isVoodooProvider(eth)) return eth;
  return undefined;
}

function isVoodooInstalled() {
  return Boolean(findVoodooProvider());
}

/**
 * Custom RainbowKit wallet — icon is the Desktop voodoo-wallet.png
 * embedded as a data-URL (always loads, no 404/cache issues).
 *
 * NOTE: do NOT set `rdns` to app.voodoowallet when multiInjectedProviderDiscovery
 * is on — RK replaces this entry with EIP-6963 and drops our custom icon.
 * We keep discovery OFF in config so this branded entry always wins.
 */
export function voodooWallet() {
  return {
    id: 'voodoo',
    name: 'Voodoo Wallet',
    shortName: 'Voodoo',
    // RainbowKit accepts string OR async () => string (same as official wallets)
    iconUrl: async () => VOODOO_WALLET_ICON,
    iconBackground: '#ffffff',
    iconAccent: '#073749',
    installed: isVoodooInstalled(),
    hidden: () => false,
    downloadUrls: {
      browserExtension: INSTALL_URL,
      chrome: INSTALL_URL,
    },
    extension: {
      instructions: {
        learnMoreUrl: INSTALL_URL,
        steps: [
          {
            step: 'install',
            title: 'Install Voodoo Wallet',
            description:
              'Install the Voodoo Wallet browser extension from the official GitHub release, then refresh this page.',
          },
          {
            step: 'create',
            title: 'Create or import a wallet',
            description: 'Open Voodoo Wallet and create a new wallet or import an existing one.',
          },
          {
            step: 'refresh',
            title: 'Refresh and connect',
            description: 'After the extension is ready, refresh this page and select Voodoo Wallet again.',
          },
        ],
      },
    },
    createConnector: (walletDetails) => {
      return createConnector((config) => ({
        ...injected({
          target: () => {
            const provider = findVoodooProvider();
            return {
              id: 'voodoo',
              name: 'Voodoo Wallet',
              provider,
            };
          },
        })(config),
        ...walletDetails,
      }));
    },
  };
}

export default voodooWallet;
