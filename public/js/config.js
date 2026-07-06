function voodooRpcUrl() {
  if (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http')) {
    return `${window.location.origin}/rpc`;
  }
  return 'https://rpc.pulsechain.com';
}

window.VoodooConfig = {
  PLATFORM_MAP: 'StakingPlatformV4',
  ASSET_VERSION: '6',
  VDO_ADDRESS: '0x1c5f8e8E84AcC71650F7a627cfA5B24B80f44f00',
  STAKING_ADDRESS: '0x31c6DFC47e3452eE570f6430eD3eB7DE8533d8D0',
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
};