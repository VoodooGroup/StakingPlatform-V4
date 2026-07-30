import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  rabbyWallet,
  trustWallet,
  ledgerWallet,
  braveWallet,
  okxWallet,
  bitgetWallet,
  imTokenWallet,
  coin98Wallet,
  bybitWallet,
  injectedWallet,
  zerionWallet,
  frameWallet,
  tokenPocketWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { mainnet, pulsechain } from 'viem/chains';
import { voodooWallet } from './voodooWallet.js';
import { pulseWallet } from './pulseWallets.js';

/**
 * WalletConnect Cloud / Reown project id (required for WalletConnect QR).
 *
 * Priority:
 * 1. VITE_WC_PROJECT_ID at build time (rainbow-bridge/.env)
 * 2. window.VoodooConfig.WC_PROJECT_ID (set in public/js/config.js)
 * 3. RainbowKit documented example id (works for local/dev testing)
 *
 * Production: create a free id at https://cloud.reown.com and set it.
 */
function resolveProjectId() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WC_PROJECT_ID) {
      const v = String(import.meta.env.VITE_WC_PROJECT_ID).trim();
      if (v && !/your_walletconnect|YOUR_PROJECT/i.test(v)) return v;
    }
  } catch {
    /* ignore */
  }
  try {
    const fromWindow = typeof window !== 'undefined' && window.VoodooConfig?.WC_PROJECT_ID;
    if (fromWindow && String(fromWindow).trim()) return String(fromWindow).trim();
  } catch {
    /* ignore */
  }
  // Official RainbowKit fallback example project id (NOT our old wrong id)
  return '21fef48091f12692cad574a6f7753643';
}

const projectId = resolveProjectId();

const pulseRpc =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PULSE_RPC)
  || 'https://rpc.pulsechain.com';

export const pulseChain = {
  ...pulsechain,
  rpcUrls: {
    ...pulsechain.rpcUrls,
    default: { http: [pulseRpc, 'https://pulsechain.publicnode.com'] },
    public: { http: [pulseRpc, 'https://pulsechain.publicnode.com'] },
  },
};

const appName = 'Voodoo Staking Portal';
const appDescription = 'Stake VDO on PulseChain — VoodooGroup';
/** Prefer production HTTPS URL in WC metadata (mobile wallets reject some localhost icons) */
const appUrl = 'https://voodootoken.com';
const appIcon = 'https://voodootoken.com/Voodoo-Token-Logo.png';

/**
 * PulseChain-capable wallets.
 * pulseWallet() strips hanging QR getUri on extension wallets (Rabby→Trust fix).
 * walletConnectWallet is NOT wrapped — needs getUri for the QR screen.
 */
const walletGroups = [
  {
    groupName: 'PulseChain wallets',
    wallets: [
      pulseWallet(voodooWallet),
      pulseWallet(metaMaskWallet),
      pulseWallet(rabbyWallet),
      pulseWallet(trustWallet),
      walletConnectWallet,
      pulseWallet(braveWallet),
      pulseWallet(okxWallet),
      pulseWallet(ledgerWallet),
    ],
  },
  {
    groupName: 'Other EVM Wallets',
    wallets: [
      pulseWallet(frameWallet),
      pulseWallet(zerionWallet),
      pulseWallet(tokenPocketWallet),
      pulseWallet(imTokenWallet),
      pulseWallet(bitgetWallet),
      pulseWallet(bybitWallet),
      pulseWallet(coin98Wallet),
      pulseWallet(injectedWallet),
    ],
  },
];

/**
 * CRITICAL for WalletConnect:
 * - appName / appUrl / appIcon must be passed here (builds WC metadata)
 * - do NOT set showQrModal: true (RainbowKit forces false + shows its own QR)
 * - projectId must be a valid Reown Cloud id
 */
const connectors = connectorsForWallets(walletGroups, {
  appName,
  appDescription,
  appUrl,
  appIcon,
  projectId,
  walletConnectParameters: {
    // showQrModal intentionally omitted — RK sets false so display_uri reaches the modal QR
    metadata: {
      name: appName,
      description: appDescription,
      url: appUrl,
      icons: [appIcon],
    },
  },
});

/**
 * PulseChain primary + Ethereum mainnet secondary.
 * WalletConnect v2 is more reliable when at least one widely-known chain
 * is registered; staking still targets PulseChain (initialChain in provider).
 */
export const config = createConfig({
  connectors,
  chains: [pulseChain, mainnet],
  transports: {
    [pulseChain.id]: http(pulseRpc, { batch: true }),
    [mainnet.id]: http(),
  },
  multiInjectedProviderDiscovery: false,
  ssr: false,
});

export { projectId, appName };

if (typeof console !== 'undefined') {
  console.info(
    '[VoodooRainbow] WC projectId:',
    projectId.slice(0, 8) + '…',
    '| app:',
    appName,
  );
}
