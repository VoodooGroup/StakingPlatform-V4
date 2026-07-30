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
import { walletConnectOfficial } from './walletConnectOfficial.js';

/** Reown Cloud project ID — required for WalletConnect QR relay */
export const projectId = '16b6c9873265aaba89707f9f131e42c3';

const pulseRpc = 'https://rpc.pulsechain.com';

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
export const appUrl =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://voodootoken.com';
export const appIcon = 'https://voodootoken.com/Voodoo-Token-Logo.png';

/**
 * Other button → RainbowKit list:
 * - Voodoo: browser extension
 * - WalletConnect: OFFICIAL QR modal (showQrModal:true) — not RK in-modal QR
 * - Other extensions: MetaMask, Rabby, …
 * pulseWallet strips QR hangs from injected wallets only.
 */
const wallets = [
  {
    groupName: 'Popular',
    wallets: [
      pulseWallet(voodooWallet),
      pulseWallet(metaMaskWallet),
      // Official WC QR modal — do NOT wrap with pulseWallet
      walletConnectOfficial,
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
  walletConnectParameters: {
    // Default for other WC-backed wallets; our official entry forces showQrModal:true itself
    metadata: {
      name: appName,
      description: appDescription,
      url: appUrl,
      icons: [appIcon],
    },
  },
});

console.info(
  '[RainbowKit] Voodoo extension + WalletConnect official QR modal | projectId=16b6c987…',
);
