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

/** Your Reown Cloud project ID (dashboard.reown.com) */
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
export const appUrl = 'https://voodootoken.com';
export const appIcon = 'https://voodootoken.com/Voodoo-Token-Logo.png';

/**
 * RainbowKit wallet list — WalletConnect is INSIDE the modal (Other button).
 * pulseWallet() only strips QR hang from extension wallets; WC is NOT wrapped.
 */
const wallets = [
  {
    groupName: 'Popular',
    wallets: [
      pulseWallet(voodooWallet),
      pulseWallet(metaMaskWallet),
      pulseWallet(rabbyWallet),
      pulseWallet(trustWallet),
      // WalletConnect inside RainbowKit (required by product)
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
    metadata: {
      name: appName,
      description: appDescription,
      url: appUrl,
      icons: [appIcon],
    },
  },
});

console.info('[RainbowKit] projectId:', projectId.slice(0, 8) + '…', '| WalletConnect: ON');
