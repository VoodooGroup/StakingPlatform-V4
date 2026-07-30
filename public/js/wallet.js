window.VoodooWallet = (function () {
  const VOODOO_RDNS = 'app.voodoowallet';
  const VOODOO_INSTALL_URL = 'https://github.com/Voodoo-Token/voodoo-pulse-extension';
  const PULSE_CHAIN_ID = 369;
  const PULSE_CHAIN_HEX = '0x171';

  let listenersBound = false;
  /** @type {any} */
  let activeProvider = null;
  /** @type {'voodoo'|'injected'|'rainbow'|null} */
  let activeWalletKind = null;

  function pulsechainNetwork() {
    return window.VoodooConfig.PULSECHAIN_NETWORK;
  }

  function isVoodooProvider(provider) {
    if (!provider) return false;
    if (provider.isVoodooWallet === true || provider._isVoodooWallet === true) return true;
    if (provider === window.voodooEthereum || provider === window.VoodooWalletProvider) return true;
    if (typeof provider.providerInfo?.rdns === 'string'
      && provider.providerInfo.rdns.toLowerCase() === VOODOO_RDNS) {
      return true;
    }
    return false;
  }

  function listInjectedProviders() {
    if (typeof window === 'undefined') return [];
    if (window.location.protocol === 'file:') return [];

    const found = [];
    const push = (p) => {
      if (p && !found.includes(p)) found.push(p);
    };

    // Dedicated globals from Voodoo Wallet extension (survive MetaMask overwrite)
    push(window.voodooEthereum);
    push(window.VoodooWalletProvider);

    const { ethereum } = window;
    if (ethereum) {
      if (Array.isArray(ethereum.providers) && ethereum.providers.length) {
        ethereum.providers.forEach(push);
      }
      push(ethereum);
    }
    return found;
  }

  function discoverVoodooViaEip6963(timeoutMs = 900) {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }

      let found = null;
      let settled = false;

      function finish(provider) {
        if (settled) return;
        settled = true;
        window.removeEventListener('eip6963:announceProvider', onAnnounce);
        resolve(provider || null);
      }

      function onAnnounce(event) {
        const detail = event.detail;
        const info = detail?.info;
        const provider = detail?.provider;
        if (!provider) return;

        const rdns = String(info?.rdns || '').toLowerCase();
        const name = String(info?.name || '');
        if (
          rdns === VOODOO_RDNS
          || /voodoo\s*wallet/i.test(name)
          || isVoodooProvider(provider)
        ) {
          found = provider;
          finish(found);
        }
      }

      window.addEventListener('eip6963:announceProvider', onAnnounce);
      try {
        window.dispatchEvent(new Event('eip6963:requestProvider'));
      } catch {
        /* ignore */
      }

      setTimeout(() => finish(found), timeoutMs);
    });
  }

  function getMetaMaskProvider() {
    const providers = listInjectedProviders();
    if (!providers.length) return null;

    const mm = providers.find((p) => p.isMetaMask && !isVoodooProvider(p));
    if (mm) return mm;

    const anyMm = providers.find((p) => (p.isMetaMask || p._metamask || p.isStatus) && !isVoodooProvider(p));
    if (anyMm) return anyMm;

    const other = providers.find((p) => !isVoodooProvider(p));
    return other || providers[0];
  }

  function findVoodooSync() {
    if (window.voodooEthereum && isVoodooProvider(window.voodooEthereum)) {
      return window.voodooEthereum;
    }
    if (window.VoodooWalletProvider && isVoodooProvider(window.VoodooWalletProvider)) {
      return window.VoodooWalletProvider;
    }
    return listInjectedProviders().find(isVoodooProvider) || null;
  }

  async function getVoodooWalletProvider(options = {}) {
    const attempts = options.attempts ?? 10;
    const delayMs = options.delayMs ?? 300;

    for (let i = 0; i < attempts; i += 1) {
      const sync = findVoodooSync();
      if (sync) return sync;

      const fromEip6963 = await discoverVoodooViaEip6963(i === 0 ? 700 : 400);
      if (fromEip6963) return fromEip6963;

      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return null;
  }

  /** Snapshot for debugging connection problems */
  async function diagnose() {
    const eth = window.ethereum;
    return {
      origin: window.location.origin,
      protocol: window.location.protocol,
      hasEthereum: Boolean(eth),
      ethIsVoodoo: Boolean(eth?.isVoodooWallet),
      ethIsMetaMask: Boolean(eth?.isMetaMask),
      hasVoodooGlobal: Boolean(window.voodooEthereum?.isVoodooWallet),
      providers: listInjectedProviders().map((p, i) => ({
        i,
        isVoodoo: Boolean(p?.isVoodooWallet),
        isMetaMask: Boolean(p?.isMetaMask),
      })),
      eip6963: Boolean(await discoverVoodooViaEip6963(400)),
    };
  }

  async function readChainId(ethereum) {
    try {
      if (ethereum.chainId != null) {
        const raw = ethereum.chainId;
        if (typeof raw === 'string' && raw.startsWith('0x')) return parseInt(raw, 16);
        if (typeof raw === 'number') return raw;
      }
      const hex = await ethereum.request({ method: 'eth_chainId' });
      return parseInt(hex, 16);
    } catch {
      return null;
    }
  }

  async function switchToPulseChain(ethereum) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: PULSE_CHAIN_HEX }],
      });
    } catch (switchErr) {
      if (switchErr?.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [pulsechainNetwork()],
          });
        } catch (addErr) {
          if (isVoodooProvider(ethereum)) return;
          throw addErr;
        }
      } else if (isVoodooProvider(ethereum)) {
        return;
      } else {
        throw switchErr;
      }
    }
  }

  function mapRequestError(err, kind) {
    const msg = err?.message || String(err || 'Unknown error');
    const code = err?.code;

    if (code === 4001 || /user rejected|rejected the request/i.test(msg)) {
      return new Error('Connection was cancelled in your wallet.');
    }
    if (code === 'VOODOO_TIMEOUT' || /geen antwoord|no response|timed out|timeout/i.test(msg)) {
      return new Error(
        'Voodoo Wallet did not respond. Open the extension, make sure you are signed in, then try again.',
      );
    }
    if (
      code === 4100
      || /unlock voodoo wallet first/i.test(msg)
      || /wallet locked/i.test(msg)
    ) {
      return new Error(
        'Voodoo Wallet is locked. Open the extension, unlock it, then try connecting again.',
      );
    }
    if (code === 'VOODOO_NOT_FOUND' || /not detected|niet gevonden/i.test(msg)) {
      const e = new Error(
        'Voodoo Wallet was not detected. Install the extension, open it and sign in, then refresh this page and try again.',
      );
      e.code = 'VOODOO_NOT_FOUND';
      e.installUrl = VOODOO_INSTALL_URL;
      return e;
    }
    return err instanceof Error ? err : new Error(msg);
  }

  async function connectWithProvider(ethereum, kind, onStatus) {
    if (!ethereum) {
      if (window.location.protocol === 'file:') {
        throw new Error('Open this site over https (or http://localhost). Browser extensions do not work on file:// pages.');
      }
      throw mapRequestError(
        Object.assign(
          new Error(
            kind === 'voodoo'
              ? 'Voodoo Wallet was not detected. Install or reload the extension, then refresh this page.'
              : 'No browser wallet was found. Install MetaMask or another wallet and try again.',
          ),
          { code: kind === 'voodoo' ? 'VOODOO_NOT_FOUND' : undefined },
        ),
        kind,
      );
    }

    let accounts;
    try {
      onStatus?.('requesting');
      accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      onStatus?.('connected');
    } catch (err) {
      throw mapRequestError(err, kind);
    }

    if (!accounts?.length) {
      throw new Error(
        'No account was returned by the wallet. Open the extension, unlock it, and try again.',
      );
    }

    let chainId = await readChainId(ethereum);
    if (chainId !== PULSE_CHAIN_ID) {
      try {
        await switchToPulseChain(ethereum);
        await new Promise((r) => setTimeout(r, 400));
        chainId = await readChainId(ethereum);
      } catch (e) {
        console.warn('Chain switch attempt:', e?.message || e);
      }
      if (chainId !== PULSE_CHAIN_ID && kind !== 'voodoo') {
        throw new Error('Please switch your wallet to PulseChain (chain ID 369) and try again.');
      }
    }

    let provider;
    let signer;
    let userAddress = accounts[0];
    try {
      provider = new ethers.providers.Web3Provider(ethereum, 'any');
      if (kind === 'voodoo' || isVoodooProvider(ethereum)) {
        try {
          await provider.getNetwork();
        } catch {
          provider = new ethers.providers.Web3Provider(ethereum, {
            name: 'PulseChain',
            chainId: PULSE_CHAIN_ID,
          });
        }
      }
      signer = provider.getSigner();
      try {
        const fromSigner = await signer.getAddress();
        if (fromSigner) userAddress = fromSigner;
      } catch {
        /* use accounts[0] */
      }
    } catch (err) {
      // Still usable with accounts[0] if ethers network detect fails
      console.warn('ethers provider setup warning', err);
      provider = new ethers.providers.Web3Provider(ethereum, {
        name: 'PulseChain',
        chainId: PULSE_CHAIN_ID,
      });
      signer = provider.getSigner();
      userAddress = accounts[0];
    }

    activeProvider = ethereum;
    activeWalletKind = kind;

    return { ethereum, provider, signer, userAddress, walletKind: kind };
  }

  async function connect() {
    // Legacy alias — "Other" now opens RainbowKit (all wallets)
    return connectOther();
  }

  function waitForRainbowReady(maxMs = 15000) {
    if (window.VoodooRainbow?.ready && window.VoodooRainbow.openConnectModal) {
      return Promise.resolve(window.VoodooRainbow);
    }
    return new Promise((resolve, reject) => {
      const started = Date.now();
      function check() {
        if (window.VoodooRainbow?.ready && window.VoodooRainbow.openConnectModal) {
          cleanup();
          resolve(window.VoodooRainbow);
          return;
        }
        if (Date.now() - started >= maxMs) {
          cleanup();
          reject(new Error('RainbowKit is still loading. Refresh the page and try again.'));
        }
      }
      function onReady() {
        check();
      }
      function cleanup() {
        window.removeEventListener('voodoo:rainbow-ready', onReady);
        clearInterval(timer);
      }
      window.addEventListener('voodoo:rainbow-ready', onReady);
      const timer = setInterval(check, 100);
      check();
    });
  }

  /** In-flight RainbowKit connect — shared so reopening the modal doesn't hang */
  let pendingRainbowConnect = null;
  let pendingReject = null;

  function cancelPendingRainbow(reason = 'cancelled') {
    if (typeof pendingReject === 'function') {
      const err = new Error(reason);
      err.code = 'ACTION_REJECTED';
      try {
        pendingReject(err);
      } catch {
        /* ignore */
      }
    }
    pendingReject = null;
    pendingRainbowConnect = null;
  }

  /**
   * Open RainbowKit modal and resolve once a wallet connects.
   * Always recoverable: failed WalletConnect / dismissed modal can reopen.
   */
  async function connectOther(onStatus) {
    onStatus?.('opening');
    const rk = await waitForRainbowReady();

    // Already connected via RainbowKit — open account modal and reuse session
    if (rk.isConnected?.() && activeProvider && activeWalletKind === 'rainbow') {
      rk.openAccountModal?.();
      return {
        ethereum: activeProvider,
        provider: new ethers.providers.Web3Provider(activeProvider, 'any'),
        signer: new ethers.providers.Web3Provider(activeProvider, 'any').getSigner(),
        userAddress: await new ethers.providers.Web3Provider(activeProvider, 'any').getSigner().getAddress().catch(() => rk.getAddress?.()),
        walletKind: 'rainbow',
      };
    }

    // Re-open path: clear stuck "connecting" then show modal again
    if (pendingRainbowConnect) {
      try {
        await rk.openConnectModal?.();
      } catch {
        /* ignore */
      }
      return pendingRainbowConnect;
    }

    // Hard-reset any half-open WC session so open works after a failed click
    try {
      await rk.hardReset?.();
    } catch {
      /* ignore */
    }

    pendingRainbowConnect = new Promise((resolve, reject) => {
      let settled = false;
      pendingReject = reject;

      const cleanup = () => {
        settled = true;
        clearTimeout(timer);
        pendingReject = null;
        window.removeEventListener('voodoo:rainbow-connected', onConnected);
        window.removeEventListener('voodoo:rainbow-error', onError);
        window.removeEventListener('voodoo:rainbow-modal-closed', onModalClosed);
      };

      const timer = setTimeout(() => {
        if (settled) return;
        cleanup();
        const err = new Error('Wallet connection timed out. Click Other to try again.');
        err.code = 'TIMEOUT';
        reject(err);
      }, 180_000);

      async function onConnected(event) {
        if (settled) return;
        const detail = event?.detail || {};
        const provider = detail.provider;
        if (!provider) {
          cleanup();
          reject(new Error('Wallet connected but no provider was returned.'));
          return;
        }
        cleanup();
        try {
          onStatus?.('connected');
          const result = await connectWithProvider(provider, 'rainbow', onStatus);
          resolve(result);
        } catch (err) {
          reject(mapRequestError(err, 'rainbow'));
        }
      }

      function onError(event) {
        if (settled) return;
        cleanup();
        reject(new Error(event?.detail?.message || 'Wallet connection failed.'));
      }

      /** User dismissed modal — free UI so Other can open RainbowKit again */
      function onModalClosed() {
        if (settled) return;
        cleanup();
        const err = new Error('Connection cancelled');
        err.code = 'ACTION_REJECTED';
        reject(err);
      }

      window.addEventListener('voodoo:rainbow-connected', onConnected);
      window.addEventListener('voodoo:rainbow-error', onError);
      window.addEventListener('voodoo:rainbow-modal-closed', onModalClosed);

      Promise.resolve()
        .then(() => rk.openConnectModal?.())
        .then((opened) => {
          if (settled) return;
          if (opened === false) {
            cleanup();
            reject(new Error('RainbowKit connect modal is not ready yet. Refresh and try again.'));
          }
        })
        .catch((err) => {
          if (settled) return;
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    }).finally(() => {
      pendingRainbowConnect = null;
      pendingReject = null;
    });

    return pendingRainbowConnect;
  }

  async function connectVoodoo(onStatus) {
    onStatus?.('detecting');
    const ethereum = await getVoodooWalletProvider();
    if (!ethereum) {
      // Production-safe message only. Diagnose stays console-only when debug is on.
      const info = await diagnose();
      if (window.VoodooDebug === true || window.VoodooUI?.isDebug?.()) {
        console.error('[Voodoo diagnose]', info);
      }
      const err = new Error(
        'Voodoo Wallet was not detected. Install the extension, open it and sign in, then refresh this page and try again.',
      );
      err.code = 'VOODOO_NOT_FOUND';
      err.installUrl = VOODOO_INSTALL_URL;
      err.diagnose = info;
      throw err;
    }
    onStatus?.('opening');
    return connectWithProvider(ethereum, 'voodoo', onStatus);
  }

  function getActiveProvider() {
    return activeProvider || findVoodooSync() || getMetaMaskProvider();
  }

  function getActiveWalletKind() {
    return activeWalletKind;
  }

  function clearActiveWallet() {
    activeProvider = null;
    activeWalletKind = null;
  }

  function bindListeners(onAccountsChanged, onChainChanged) {
    const ethereum = getActiveProvider();
    if (!ethereum) return;

    if (listenersBound && ethereum === activeProvider) return;
    listenersBound = true;

    try {
      ethereum.on('accountsChanged', (accounts) => {
        if (!accounts?.length) {
          clearActiveWallet();
          onAccountsChanged?.(null);
          return;
        }
        onAccountsChanged?.(accounts[0]);
      });

      ethereum.on('chainChanged', () => {
        onChainChanged?.();
      });
    } catch (e) {
      console.warn('Wallet event listeners not supported', e);
    }
  }

  async function registerVoodooToken(ethereum) {
    const target = ethereum || getActiveProvider();
    if (!target || isVoodooProvider(target)) return;

    const { VDO_ADDRESS } = window.VoodooConfig;
    const image = window.StakingPlatformV4?.getVoodooLogoUrl()
      || `${window.location.origin}/Voodoo-Token-Logo.png`;

    try {
      await target.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: VDO_ADDRESS,
            symbol: 'VDO',
            decimals: 18,
            image,
          },
        },
      });
    } catch (e) {
      console.warn('Token logo registration skipped', e);
    }
  }

  return {
    getMetaMaskProvider,
    getVoodooWalletProvider,
    isVoodooProvider,
    connect,
    connectOther,
    connectVoodoo,
    connectWithProvider,
    waitForRainbowReady,
    bindListeners,
    registerVoodooToken,
    getActiveProvider,
    getActiveWalletKind,
    clearActiveWallet,
    diagnose,
    VOODOO_INSTALL_URL,
  };
})();
