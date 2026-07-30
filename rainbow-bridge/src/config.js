import { getDefaultConfig } from '@rainbow-me/rainbowkit';
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
import { http } from 'wagmi';
import { mainnet, pulsechain } from 'viem/chains';
import { voodooWallet } from './voodooWallet.js';
import { pulseWallet } from './pulseWallets.js';

/**
 * WalletConnect / Reown Cloud project id.
 * https://cloud.reown.com — set VITE_WC_PROJECT_ID for production.
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
  // RainbowKit docs example project id
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
const appUrl = 'https://voodootoken.com';
const appIcon = 'https://voodootoken.com/Voodoo-Token-Logo.png';

/**
 * PulseChain-capable wallets.
 * pulseWallet() strips hanging QR getUri on extension wallets.
 * walletConnectWallet is NOT wrapped — needs getUri for the in-modal QR.
 */
const wallets = [
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
 * Official RainbowKit config helper — wires WalletConnect correctly
 * (metadata, dual WC clients, showQrModal:false for in-modal QR).
 */
export const config = getDefaultConfig({
  appName,
  appDescription,
  appUrl,
  appIcon,
  projectId,
  wallets,
  chains: [pulseChain, mainnet],
  transports: {
    [pulseChain.id]: http(pulseRpc, { batch: true }),
    [mainnet.id]: http(),
  },
  ssr: false,
  multiInjectedProviderDiscovery: false,
  // Do not pass showQrModal:true — RK must receive display_uri for its QR screen
  walletConnectParameters: {
    metadata: {
      name: appName,
      description: appDescription,
      url: appUrl,
      icons: [appIcon],
    },
  },
});

export { projectId, appName };

if (typeof console !== 'undefined') {
  console.info('[VoodooRainbow] getDefaultConfig | WC projectId:', `${projectId.slice(0, 8)}…`);
}
