/**
 * Canonical PulseChain contracts for the staking portal.
 * StakingPlatform V4 only — never use the old V2 address (0x31c6…).
 */
window.VoodooAddresses = Object.freeze({
  /** StakingPlatformV4 */
  STAKING_V4: '0x3359EcA752F8fCa2A1E47EF01160CFCd782BD6E7',
  /** Legacy V2 — blocked; must never be used for approve/stake */
  STAKING_V2_LEGACY: '0x31c6DFC47e3452eE570f6430eD3eB7DE8533d8D0',
  VDO: '0x1c5f8e8E84AcC71650F7a627cfA5B24B80f44f00',
});

function voodooRpcUrl() {
  if (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http')) {
    return `${window.location.origin}/rpc`;
  }
  return 'https://rpc.pulsechain.com';
}

function normalizeAddress(addr) {
  return String(addr || '').trim().toLowerCase();
}

/**
 * Always return StakingPlatform V4.
 * Ignores / overrides any stale config, JSON, or cache that still points at V2.
 */
function resolveStakingAddress(candidate) {
  const v4 = window.VoodooAddresses.STAKING_V4;
  const legacy = window.VoodooAddresses.STAKING_V2_LEGACY;
  const n = normalizeAddress(candidate);
  if (!n) return v4;
  if (n === normalizeAddress(legacy)) {
    console.warn(
      '[Voodoo] Blocked legacy Staking V2 address; forcing V4',
      candidate,
      '→',
      v4,
    );
    return v4;
  }
  if (n === normalizeAddress(v4)) return v4;
  // Unknown address — still force V4 so we never stake on a random contract
  console.warn('[Voodoo] Unknown staking address, forcing V4', candidate, '→', v4);
  return v4;
}

window.VoodooConfig = {
  PLATFORM_MAP: 'StakingPlatformV4',
  ASSET_VERSION: '38',
  /**
   * WalletConnect / Reown Cloud project id (https://cloud.reown.com).
   * Leave empty to use the RainbowKit build-time default.
   * For production, set your own id here OR VITE_WC_PROJECT_ID when building rainbow-bridge.
   */
  WC_PROJECT_ID: '',
  VDO_ADDRESS: window.VoodooAddresses.VDO,
  /** Always V4 — getter so nothing can permanently stick a wrong value */
  get STAKING_ADDRESS() {
    return resolveStakingAddress(this._stakingAddressOverride || window.VoodooAddresses.STAKING_V4);
  },
  set STAKING_ADDRESS(value) {
    this._stakingAddressOverride = resolveStakingAddress(value);
  },
  _stakingAddressOverride: window.VoodooAddresses.STAKING_V4,
  get RPC_URL() { return voodooRpcUrl(); },
  PULSECHAIN_NETWORK: {
    chainId: '0x171',
    chainName: 'PulseChain',
    nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
    rpcUrls: ['https://rpc.pulsechain.com'],
    blockExplorerUrls: ['https://scan.pulsechain.com'],
  },
  TOKEN_ABI: [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
  ],
  LCW_API_KEY: 'ddd9175e-6cb0-4fed-babc-8a54cd255c0e',
  ACTIVE_SINCE: '2023-08-27T00:00:00Z',
  /** Apply contract address from platform JSON (still forced through V4 guard) */
  applyPlatformContract(addr) {
    this.STAKING_ADDRESS = addr;
  },
};

// Production: silent. Enable with window.VoodooDebug = true in the console if needed.
if (window.VoodooDebug === true) {
  console.info('[Voodoo] StakingPlatform V4 contract:', window.VoodooConfig.STAKING_ADDRESS);
}
