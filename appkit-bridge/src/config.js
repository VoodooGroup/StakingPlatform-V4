import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet } from '@reown/appkit/networks';

/**
 * Reown Cloud Project ID — https://dashboard.reown.com
 * (Public client id; safe in frontend. Override at runtime via window.VoodooConfig.WC_PROJECT_ID)
 */
export const projectId = (typeof window !== 'undefined' && window.VoodooConfig?.WC_PROJECT_ID)
  ? String(window.VoodooConfig.WC_PROJECT_ID).trim()
  : '16b6c9873265aaba89707f9f131e42c3';

/** PulseChain as AppKit / CAIP network */
export const pulseChain = {
  id: 369,
  name: 'PulseChain',
  nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        'https://rpc.pulsechain.com',
        'https://pulsechain.publicnode.com',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
  },
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:369',
};

export const networks = [pulseChain, mainnet];

export const metadata = {
  name: 'Voodoo Staking Portal',
  description: 'Stake VDO on PulseChain — VoodooGroup',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://voodootoken.com',
  icons: [
    typeof window !== 'undefined'
      ? `${window.location.origin}/Voodoo-Token-Logo.png`
      : 'https://voodootoken.com/Voodoo-Token-Logo.png',
  ],
};

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
