import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet } from '@reown/appkit/networks';

/**
 * Get a free Project ID: https://dashboard.reown.com
 *
 * Priority:
 * 1. VITE_WALLETCONNECT_PROJECT_ID / VITE_WC_PROJECT_ID (build-time)
 * 2. window.VoodooConfig.WC_PROJECT_ID (runtime)
 * 3. Demo fallback (replace for production)
 */
function resolveProjectId() {
  try {
    const fromEnv =
      (typeof import.meta !== 'undefined' && (
        import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID
        || import.meta.env?.VITE_WC_PROJECT_ID
      )) || '';
    const v = String(fromEnv).trim();
    if (v && !/your_project|YOUR_PROJECT|your_walletconnect/i.test(v)) return v;
  } catch {
    /* ignore */
  }
  try {
    const fromWindow = typeof window !== 'undefined' && window.VoodooConfig?.WC_PROJECT_ID;
    if (fromWindow && String(fromWindow).trim()) return String(fromWindow).trim();
  } catch {
    /* ignore */
  }
  // Temporary demo id — create your own at dashboard.reown.com for production
  return '21fef48091f12692cad574a6f7753643';
}

export const projectId = resolveProjectId();

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
