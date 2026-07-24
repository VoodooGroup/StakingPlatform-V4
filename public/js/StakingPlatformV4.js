window.StakingPlatformV4 = (function () {
  let map = null;

  async function load() {
    if (map) return map;
    const v = window.VoodooConfig?.ASSET_VERSION || Date.now();
    const res = await fetch(`/data/StakingPlatformV4.json?v=${v}`);
    map = await res.json();
    // Single source of truth for the staking contract — always through V4 guard
    if (map?.contract && window.VoodooConfig?.applyPlatformContract) {
      window.VoodooConfig.applyPlatformContract(map.contract);
    } else if (map?.contract && window.VoodooConfig) {
      window.VoodooConfig.STAKING_ADDRESS = map.contract;
    }
    // Ensure JSON never reintroduces legacy V2 if someone reverts the file
    if (window.VoodooAddresses?.STAKING_V4) {
      map.contract = window.VoodooConfig.STAKING_ADDRESS;
    }
    return map;
  }

  function getContractAddress() {
    return window.VoodooConfig?.STAKING_ADDRESS
      || window.VoodooAddresses?.STAKING_V4
      || map?.contract
      || '0x3359EcA752F8fCa2A1E47EF01160CFCd782BD6E7';
  }

  function getAsset(key) {
    return map?.assets?.[key] || '';
  }

  function getVoodooLogoUrl() {
    const path = getAsset('voodooLogo') || '/Voodoo-Token-Logo.png';
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${path}`;
    }
    return path;
  }

  function getPools() {
    if (!map) return [];
    return map.pools.map((pool) => ({
      ...pool,
      logo: map.assets[pool.logoKey],
    }));
  }

  function applyFavicons() {
    if (!map) return;
    const links = [
      { rel: 'icon', sizes: '16x16', href: map.assets.favicon16 || '/favicon-16.png' },
      { rel: 'icon', sizes: '32x32', href: map.assets.favicon32 || '/favicon-32.png' },
      { rel: 'icon', sizes: '512x512', href: map.assets.voodooLogo },
      { rel: 'shortcut icon', href: map.assets.favicon32 || '/favicon-32.png' },
      { rel: 'apple-touch-icon', href: map.assets.voodooLogo },
    ];
    links.forEach(({ rel, sizes, href }) => {
      const sel = sizes
        ? `link[rel="${rel}"][sizes="${sizes}"]`
        : `link[rel="${rel}"]:not([sizes])`;
      let el = document.querySelector(sel);
      if (!el && rel === 'shortcut icon') {
        el = document.querySelector('link[rel="shortcut icon"]');
      }
      if (el) el.href = href;
    });
  }

  function applyFooterText() {
    if (!map?.footerText) return;
    document.querySelectorAll('[data-sp4="footerText"], #footerCopyright').forEach((el) => {
      el.textContent = map.footerText;
    });
  }

  function applyDisplayName() {
    if (!map?.displayName) return;
    document.title = map.displayName;
  }

  function applyPageAssets() {
    if (!map) return;
    applyDisplayName();
    applyFooterText();
    const bg = document.getElementById('voodoo-bg');
    if (bg) {
      const primary = map.assets.background || '/voodoo-token-background.png';
      const fallback = map.assets.backgroundFallback || '/voodoo-token-background.jpg';
      bg.style.backgroundImage = `url('${primary}'), url('${fallback}')`;
    }

    applyFavicons();

    document.querySelectorAll('[data-sp4="buttonGuide"]').forEach((el) => {
      el.src = map.assets.buttonGuide;
    });
    document.querySelectorAll('[data-sp4="calculator"]').forEach((el) => {
      el.src = map.assets.calculator;
    });
    document.querySelectorAll('[data-sp4="flowIcons"]').forEach((el) => {
      el.src = map.assets.flowIcons;
    });
    document.querySelectorAll('[data-sp4="voodooLogo"]').forEach((el) => {
      el.src = map.assets.voodooLogo;
    });
  }

  return {
    load,
    getAsset,
    getVoodooLogoUrl,
    getPools,
    getContractAddress,
    applyPageAssets,
    applyFavicons,
    applyFooterText,
    applyDisplayName,
  };
})();
