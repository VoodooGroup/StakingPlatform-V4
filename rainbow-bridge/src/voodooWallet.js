/**
 * Voodoo Wallet for RainbowKit — must open the browser extension on click.
 *
 * Fixes:
 * - Detect via flags, globals, ethereum.providers, AND EIP-6963 (rdns app.voodoowallet)
 * - installed not frozen false at load (would show install UI, never eth_requestAccounts)
 * - connect() waits for EIP-6963 then calls eth_requestAccounts on THAT provider
 */
import { createConnector } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { VOODOO_WALLET_ICON } from './voodooIconData.js';

const INSTALL_URL = 'https://github.com/Voodoo-Token/voodoo-pulse-extension';
const RDNS = 'app.voodoowallet';

/** @type {any} */
let cachedProvider = null;
let eip6963Listening = false;

function isVoodooProvider(provider) {
  if (!provider) return false;
  if (provider.isVoodooWallet === true || provider._isVoodooWallet === true) return true;
  if (typeof window !== 'undefined') {
    if (provider === window.voodooEthereum || provider === window.VoodooWalletProvider) return true;
  }
  if (
    typeof provider.providerInfo?.rdns === 'string'
    && provider.providerInfo.rdns.toLowerCase() === RDNS
  ) {
    return true;
  }
  return false;
}

function listInjected() {
  if (typeof window === 'undefined') return [];
  if (window.location?.protocol === 'file:') return [];
  const out = [];
  const push = (p) => {
    if (p && !out.includes(p)) out.push(p);
  };
  push(window.voodooEthereum);
  push(window.VoodooWalletProvider);
  const eth = window.ethereum;
  if (eth) {
    if (Array.isArray(eth.providers)) eth.providers.forEach(push);
    push(eth);
  }
  return out;
}

function matchAnnounce(detail) {
  const info = detail?.info;
  const provider = detail?.provider;
  if (!provider) return null;
  const rdns = String(info?.rdns || '').toLowerCase();
  const name = String(info?.name || '');
  if (rdns === RDNS || /voodoo\s*wallet/i.test(name) || isVoodooProvider(provider)) {
    return provider;
  }
  return null;
}

function ensureEip6963Listener() {
  if (typeof window === 'undefined' || eip6963Listening) return;
  eip6963Listening = true;
  window.addEventListener('eip6963:announceProvider', (event) => {
    const p = matchAnnounce(event?.detail);
    if (p) {
      cachedProvider = p;
      console.info('[VoodooWallet/RK] EIP-6963 provider cached');
    }
  });
  try {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  } catch {
    /* ignore */
  }
}

function findVoodooSync() {
  if (cachedProvider) return cachedProvider;
  if (typeof window === 'undefined') return undefined;

  if (window.voodooEthereum && isVoodooProvider(window.voodooEthereum)) {
    cachedProvider = window.voodooEthereum;
    return cachedProvider;
  }
  if (window.VoodooWalletProvider && isVoodooProvider(window.VoodooWalletProvider)) {
    cachedProvider = window.VoodooWalletProvider;
    return cachedProvider;
  }
  const fromList = listInjected().find(isVoodooProvider);
  if (fromList) {
    cachedProvider = fromList;
    return cachedProvider;
  }
  return undefined;
}

function discoverVoodooViaEip6963(timeoutMs = 1500) {
  ensureEip6963Listener();
  const sync = findVoodooSync();
  if (sync) return Promise.resolve(sync);

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(undefined);
      return;
    }
    let settled = false;
    const finish = (provider) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      if (provider) cachedProvider = provider;
      resolve(provider || undefined);
    };
    function onAnnounce(event) {
      const p = matchAnnounce(event?.detail);
      if (p) finish(p);
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } catch {
      /* ignore */
    }
    setTimeout(() => finish(findVoodooSync()), timeoutMs);
  });
}

async function resolveVoodooProvider() {
  ensureEip6963Listener();
  return (await discoverVoodooViaEip6963(1500)) || findVoodooSync();
}

if (typeof window !== 'undefined') {
  ensureEip6963Listener();
  setTimeout(() => {
    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } catch {
      /* ignore */
    }
  }, 400);
}

/**
 * RainbowKit CreateWalletFn
 */
export function voodooWallet(_options = {}) {
  // Prefer ready=true so click runs connect() (opens extension).
  // If truly missing, connect() throws a clear install error.
  const detected = Boolean(findVoodooSync());

  return {
    id: 'voodoo',
    name: 'Voodoo Wallet',
    shortName: 'Voodoo',
    // Desktop/voodoo-wallet.png embedded as data-URL (regenerated from Desktop copy)
    iconUrl: async () => VOODOO_WALLET_ICON,
    iconBackground: '#ffffff',
    iconAccent: '#073749',
    // undefined => ready true in RK when not detected yet (EIP-6963 may arrive late)
    installed: detected ? true : undefined,
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
              'Install the Voodoo Wallet browser extension, then refresh this page.',
          },
          {
            step: 'create',
            title: 'Unlock the extension',
            description: 'Open Voodoo Wallet and unlock / sign in.',
          },
          {
            step: 'refresh',
            title: 'Connect again',
            description: 'Click Voodoo Wallet again to open the extension connect prompt.',
          },
        ],
      },
    },
    createConnector: (walletDetails) =>
      createConnector((config) => {
        const base = injected({
          target: () => {
            const provider = findVoodooSync();
            return {
              id: 'voodoo',
              name: 'Voodoo Wallet',
              provider,
            };
          },
          unstable_shimAsyncInject: 2500,
        })(config);

        return {
          ...base,
          ...walletDetails,
          id: 'voodoo',
          name: 'Voodoo Wallet',
          type: base.type || 'injected',

          async getProvider() {
            const p = await resolveVoodooProvider();
            if (p) return p;
            try {
              return await base.getProvider?.();
            } catch {
              return undefined;
            }
          },

          async connect(parameters) {
            const provider = await resolveVoodooProvider();
            if (!provider) {
              const err = new Error(
                'Voodoo Wallet not detected. Install and unlock the extension, then refresh this page.',
              );
              err.name = 'ProviderNotFoundError';
              throw err;
            }
            cachedProvider = provider;
            console.info('[VoodooWallet/RK] opening extension (eth_requestAccounts)…');

            // Explicitly open the extension popup before wagmi connect
            try {
              await provider.request({ method: 'eth_requestAccounts' });
            } catch (e) {
              // User reject → rethrow; other errors still try base.connect
              if (e?.code === 4001 || /reject|denied/i.test(String(e?.message || ''))) {
                throw e;
              }
              console.warn('[VoodooWallet/RK] eth_requestAccounts', e);
            }

            return base.connect(parameters);
          },

          async isAuthorized() {
            try {
              const provider = await resolveVoodooProvider();
              if (!provider) return false;
              const accounts = await provider.request({ method: 'eth_accounts' });
              return Array.isArray(accounts) && accounts.length > 0;
            } catch {
              return false;
            }
          },
        };
      }),
  };
}

export default voodooWallet;
