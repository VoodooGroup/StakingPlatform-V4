import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
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
 * WalletConnect / Reown Cloud project id (used by standalone WC button).
 * https://cloud.reown.com
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
  return '21fef48091f12692cad574a6f7753643';
}

export const projectId = resolveProjectId();

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

export const appName = 'Voodoo Staking Portal';
export const appDescription = 'Stake VDO on PulseChain — VoodooGroup';
export const appUrl = 'https://voodootoken.com';
export const appIcon = 'https://voodootoken.com/Voodoo-Token-Logo.png';

/**
 * RainbowKit wallets — NO walletConnectWallet here.
 * WalletConnect is a separate standalone button (showQrModal) so it cannot
 * lock / break the RainbowKit connect modal state.
 */
const wallets = [
  {
    groupName: 'PulseChain wallets',
    wallets: [
      pulseWallet(voodooWallet),
      pulseWallet(metaMaskWallet),
      pulseWallet(rabbyWallet),
      pulseWallet(trustWallet),
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
});

if (typeof console !== 'undefined') {
  console.info('[VoodooRainbow] ready | WC standalone projectId:', `${projectId.slice(0, 8)}…`);
}
