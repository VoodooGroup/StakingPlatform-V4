import constants from '../Contract_Files/constants.js';

export const StakingPlatformV4 = {
  name: 'StakingPlatformV4',
  displayName: 'Voodoo Staking Portal',
  footerText: '© 2026 VoodooGroup • All rights reserved',
  contract: constants.STAKING_ADDRESS,
  assets: {
    magicLogo: '/Magic-Reward-Token-Logo.png',
    poisonLogo: '/Poison-Reward-Token-Logo.jpg',
    voodooLogo: '/Voodoo-Token-Logo.png',
    favicon: '/Voodoo-Token-Logo.png',
    favicon32: '/favicon-32.png',
    favicon16: '/favicon-16.png',
    buttonGuide: '/button-1.png',
    flowIcons: '/icons.png',
    calculator: '/voodoo-token-calculator.png',
    background: '/voodoo-token-background.jpg',
  },
  pools: constants.POOLS.map((p) => ({
    ...p,
    logoKey: p.token === 'MAGIC' ? 'magicLogo' : 'poisonLogo',
  })),
};

export default StakingPlatformV4;