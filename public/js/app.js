(function () {
  const cfg = window.VoodooConfig;
  let signer, vdoContract, stakingContract, userAddress, currentPools;

  function getContracts() {
    return { signer, vdoContract, stakingContract, userAddress };
  }

  function shortAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function setButtonBusy(btn, label) {
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = label;
  }

  /**
   * Voodoo button label:
   * - not connected → "Voodoo Wallet"
   * - connected → short address e.g. 0x20x0...7b4d (same style as MetaMask)
   * Never use intermediate status text (zoeken / connecting / etc.).
   */
  function setVoodooBtnLabel(address) {
    const voodooBtn = document.getElementById('voodooWalletBtn');
    if (!voodooBtn) return;
    voodooBtn.textContent = address ? shortAddress(address) : 'Voodoo Wallet';
  }

  function resetConnectButtons() {
    const connectBtn = document.getElementById('connectBtn');
    const voodooBtn = document.getElementById('voodooWalletBtn');
    const wcBtn = document.getElementById('walletConnectBtn');

    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.classList.remove('is-connected');
      connectBtn.textContent = 'Other';
      connectBtn.title = 'Browser wallets: MetaMask, Rabby, Trust, OKX, and more';
    }

    if (voodooBtn) {
      voodooBtn.disabled = false;
      voodooBtn.classList.remove('is-connected');
      setVoodooBtnLabel(null);
      voodooBtn.title = 'Connect with Voodoo Wallet browser extension';
    }

    if (wcBtn) {
      wcBtn.disabled = false;
      wcBtn.classList.remove('is-connected');
      wcBtn.textContent = 'WalletConnect';
      wcBtn.title = 'WalletConnect (mobile QR)';
    }
  }

  function isOtherWalletKind(kind) {
    return kind === 'rainbow' || kind === 'injected';
  }

  function markConnectedUi(kind, address) {
    const connectBtn = document.getElementById('connectBtn');
    const voodooBtn = document.getElementById('voodooWalletBtn');
    const wcBtn = document.getElementById('walletConnectBtn');
    const label = shortAddress(address);

    if (kind === 'voodoo') {
      if (voodooBtn) {
        voodooBtn.disabled = false;
        voodooBtn.classList.add('is-connected');
        setVoodooBtnLabel(address);
        voodooBtn.title = address
          ? `Connected with Voodoo Wallet: ${address}`
          : 'Connected with Voodoo Wallet';
      }
      if (connectBtn) {
        connectBtn.disabled = true;
        connectBtn.classList.remove('is-connected');
        connectBtn.textContent = 'Other';
        connectBtn.title = 'Already connected with Voodoo Wallet';
      }
      if (wcBtn) {
        wcBtn.disabled = true;
        wcBtn.classList.remove('is-connected');
        wcBtn.textContent = 'WalletConnect';
      }
      return;
    }

    // RainbowKit (Other) or standalone WalletConnect
    const connectedViaStandaloneWc = window.VoodooRainbow?.lastConnectorId === 'walletConnect-standalone';

    if (connectedViaStandaloneWc) {
      if (wcBtn) {
        wcBtn.disabled = false;
        wcBtn.classList.add('is-connected');
        wcBtn.textContent = label || 'WalletConnect';
        wcBtn.title = address ? `Connected: ${address}` : 'Connected';
      }
      if (connectBtn) {
        connectBtn.disabled = true;
        connectBtn.classList.remove('is-connected');
        connectBtn.textContent = 'Other';
      }
    } else {
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.classList.add('is-connected');
        connectBtn.textContent = label || 'Other';
        connectBtn.title = address ? `Connected: ${address}` : 'Connected';
      }
      if (wcBtn) {
        wcBtn.disabled = true;
        wcBtn.classList.remove('is-connected');
        wcBtn.textContent = 'WalletConnect';
      }
    }
    if (voodooBtn) {
      voodooBtn.disabled = true;
      voodooBtn.classList.remove('is-connected');
      setVoodooBtnLabel(null);
      voodooBtn.title = 'Already connected with another wallet';
    }
  }

  async function updateAllAPYs() {
    // Always public RPC + failover — never wallet eth_call.
    // If refresh fails while Approve is open / idle, KEEP last good rates
    // (never paint "Error" on all 6 boxes).
    try {
      currentPools = await window.VoodooApy.fetchPools();
      window.VoodooApy.renderRoi(currentPools);
      if (!document.getElementById('calculatorModal').classList.contains('hidden')) {
        window.VoodooCalculator.updateSelect(currentPools);
      }
    } catch (e) {
      console.warn('Failed to load APY', e);
      const cached = window.VoodooApy.getLastGood?.() || currentPools;
      if (cached?.length) {
        currentPools = cached;
        window.VoodooApy.renderRoi(cached);
        return;
      }
      // Only first-load hard failure
      document.querySelectorAll('[id^="roi"]').forEach((el) => {
        if (!el.textContent || el.textContent === 'Loading...') {
          el.textContent = '—';
        }
      });
    }
  }

  async function onWalletConnected(result) {
    signer = result.signer;
    userAddress = result.userAddress;

    const signed = window.VoodooContracts.createSigned(signer);
    vdoContract = signed.vdo;
    stakingContract = signed.staking;

    markConnectedUi(result.walletKind || window.VoodooWallet.getActiveWalletKind() || 'injected', userAddress);

    // Bind account/chain listeners on the provider that just connected
    window.VoodooWallet.bindListeners(
      async (account) => {
        if (!account) {
          resetWalletUi();
          return;
        }
        try {
          const kind = window.VoodooWallet.getActiveWalletKind() || 'injected';
          const ethereum = window.VoodooWallet.getActiveProvider();
          const reconnect = await window.VoodooWallet.connectWithProvider(ethereum, kind);
          await onWalletConnected(reconnect);
        } catch (e) {
          console.error(e);
          resetWalletUi();
        }
      },
      () => window.location.reload(),
    );

    // Non-fatal follow-up — never touch connection UI on failure.
    // Skip APY re-fetch if we already have good rates (avoids flash/Error while
    // user immediately clicks Approve after connect).
    if (!currentPools?.length && !window.VoodooApy.getLastGood?.()?.length) {
      try {
        await updateAllAPYs();
      } catch (e) {
        console.warn('APY refresh after connect failed', e);
      }
    }

    try {
      await window.VoodooWallet.registerVoodooToken(result.ethereum);
    } catch (e) {
      console.warn('Token logo registration skipped', e);
    }

    try {
      // Public RPC failover for allowance — spender is always StakingPlatform V4
      const stakingAddr = window.VoodooContracts.stakingAddress?.()
        || cfg.STAKING_ADDRESS;
      const allowance = await window.VoodooContracts.withReadFailover(async (provider) => {
        const readVdo = window.VoodooContracts.readVdo(provider);
        return readVdo.allowance(userAddress, stakingAddr);
      });
      const approved = allowance.gt(0);
      document.querySelectorAll('[id^="approve"]').forEach((b) => {
        b.disabled = approved;
        if (approved) b.textContent = 'Approved';
      });
      document.querySelectorAll('[id^="stakeBtn"]').forEach((b) => { b.disabled = !approved; });
    } catch (e) {
      console.warn('Allowance check failed after connect', e);
      document.querySelectorAll('[id^="approve"]').forEach((b) => { b.disabled = false; });
      document.querySelectorAll('[id^="stakeBtn"]').forEach((b) => { b.disabled = true; });
    }
  }

  function resetWalletUi() {
    signer = null;
    vdoContract = null;
    stakingContract = null;
    userAddress = null;
    window.VoodooWallet.clearActiveWallet?.();
    resetConnectButtons();
    document.querySelectorAll('[id^="approve"]').forEach((b) => { b.disabled = true; });
    document.querySelectorAll('[id^="stakeBtn"]').forEach((b) => { b.disabled = true; });
  }

  /** User-facing error text only — never append diagnose / bridge dumps. */
  function connectionErrorMessage(err) {
    if (!err) return 'Something went wrong. Please try again.';
    const msg = err.message || String(err);
    if (err.code === 4001 || err.code === 'ACTION_REJECTED' || /user rejected|user denied|rejected the request/i.test(msg)) {
      return 'Connection was cancelled in your wallet.';
    }
    if (err.code === 'VOODOO_NOT_FOUND' || /Voodoo Wallet not detected/i.test(msg)) {
      return 'Voodoo Wallet was not detected. Install the extension, then refresh this page and try again.';
    }
    if (/MetaMask|no ethereum|no injected|wallet not found|not detected/i.test(msg)) {
      return 'No browser wallet was found. Install MetaMask (or another wallet), then try again.';
    }
    // Strip raw technical dumps if they slipped into message
    return msg
      .replace(/\[debug\][\s\S]*/i, '')
      .replace(/\ncode=[\s\S]*/i, '')
      .trim() || 'Connection failed. Please try again.';
  }

  function connectionInstallUrl(err) {
    if (!err) return null;
    if (err.code === 'VOODOO_NOT_FOUND' || /Voodoo Wallet not detected/i.test(err.message || '')) {
      return err.installUrl || window.VoodooWallet?.VOODOO_INSTALL_URL || null;
    }
    return null;
  }

  /** Show modern centered modal — never browser alert(). */
  function showConnectError(title, err) {
    // Optional console-only diagnose when explicitly enabled
    if (window.VoodooUI?.isDebug?.()) {
      Promise.resolve(err?.diagnose || window.VoodooWallet?.diagnose?.())
        .then((d) => { if (d) console.error('[Voodoo diagnose]', d); })
        .catch(() => {});
    } else {
      console.error(title, err);
    }

    const message = connectionErrorMessage(err);
    const linkUrl = connectionInstallUrl(err);
    const ui = window.VoodooUI;
    if (ui?.alert) {
      return ui.alert(message, {
        title,
        type: 'error',
        okText: 'OK',
        linkUrl: linkUrl || undefined,
        linkText: 'Install Voodoo Wallet',
      });
    }
    // Fallback only if ui.js failed to load
    return Promise.resolve();
  }

  function bindConnectButton() {
    const btn = document.getElementById('connectBtn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', async () => {
      btn.disabled = false;

      // Already connected via Other (browser wallet) → account modal
      if (userAddress && isOtherWalletKind(window.VoodooWallet.getActiveWalletKind())
        && window.VoodooRainbow?.lastConnectorId !== 'walletConnect-standalone') {
        btn.textContent = shortAddress(userAddress);
        try {
          await window.VoodooRainbow?.openConnectModal?.({ mode: 'account' });
        } catch (e) {
          console.warn(e);
        }
        return;
      }

      btn.textContent = 'Other';
      try {
        const opened = await window.VoodooRainbow?.openConnectModal?.({ mode: 'connect' });
        if (opened === false) {
          await showConnectError(
            'Could not open wallet list',
            new Error('RainbowKit did not open. Refresh the page and try again.'),
          );
          return;
        }
      } catch (e) {
        await showConnectError('Could not open wallet list', e);
        return;
      }

      try {
        const result = await window.VoodooWallet.connectOther();
        if (result?.userAddress) {
          window.VoodooRainbow.lastConnectorId = result.connectorId || 'rainbowkit';
          await onWalletConnected(result);
        }
      } catch (err) {
        const quiet = err?.code === 'TIMEOUT'
          || err?.code === 4001
          || err?.code === 'ACTION_REJECTED'
          || /timed out|cancelled|rejected|denied/i.test(err?.message || '');
        if (!quiet) console.error('Other wallet connect error', err);
        if (!userAddress) btn.textContent = 'Other';
      }
    });
  }

  /** Standalone WalletConnect QR — never opens RainbowKit (avoids modal lock) */
  function bindWalletConnectButton() {
    const btn = document.getElementById('walletConnectBtn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', async () => {
      if (userAddress && window.VoodooRainbow?.lastConnectorId === 'walletConnect-standalone') {
        // Already on WC — show short address only
        return;
      }

      btn.disabled = false;
      btn.textContent = 'WalletConnect';
      try {
        if (!window.VoodooRainbow?.openWalletConnect) {
          throw new Error('WalletConnect is still loading. Wait a second and try again.');
        }
        const detail = await window.VoodooRainbow.openWalletConnect();
        if (!detail?.provider) {
          throw new Error('WalletConnect did not return a provider.');
        }
        window.VoodooRainbow.lastConnectorId = 'walletConnect-standalone';
        const result = await window.VoodooWallet.connectWithProvider(
          detail.provider,
          'rainbow',
        );
        if (detail.address && !result.userAddress) {
          result.userAddress = detail.address;
        }
        await onWalletConnected(result);
      } catch (err) {
        const quiet = err?.code === 4001
          || err?.code === 'ACTION_REJECTED'
          || /user rejected|rejected|cancelled|closed|denied/i.test(err?.message || '');
        btn.disabled = false;
        btn.textContent = 'WalletConnect';
        if (quiet) return;
        console.error('WalletConnect error', err);
        await showConnectError('WalletConnect failed', err);
      }
    });
  }

  function bindVoodooWalletButton() {
    const btn = document.getElementById('voodooWalletBtn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', async () => {
      if (userAddress && window.VoodooWallet.getActiveWalletKind() === 'voodoo') return;
      btn.disabled = true;
      // Label stays "Voodoo Wallet" while connecting (no intermediate texts)
      setVoodooBtnLabel(null);

      try {
        const result = await window.VoodooWallet.connectVoodoo();
        await onWalletConnected(result);
        // markConnectedUi sets short address on the button
      } catch (err) {
        resetWalletUi();
        setVoodooBtnLabel(null);
        // Remove any leftover debug banner from older builds
        document.getElementById('voodooConnectError')?.remove();
        await showConnectError('Voodoo Wallet connection failed', err);
      }
    });
  }

  async function init() {
    bindConnectButton();
    bindWalletConnectButton();
    bindVoodooWalletButton();

    try {
      await window.StakingPlatformV4.load();
      window.StakingPlatformV4.applyPageAssets();
    } catch (e) {
      console.warn('StakingPlatformV4 assets load failed', e);
    }

    try {
      await window.VoodooPoolRenderer.render();
    } catch (e) {
      console.warn('Pool render failed', e);
    }

    window.VoodooCalculator.bind(() => currentPools);
    window.calculateRewards = () => window.VoodooCalculator.runCalculate();
    window.VoodooPools.bindTabs(getContracts);
    window.VoodooPools.bindActions(getContracts);
    window.VoodooActiveSince.start(cfg.ACTIVE_SINCE);

    await updateAllAPYs();

    // Do NOT auto-connect on page load.
    // User must click "Voodoo Wallet" or "Other" (RainbowKit) themselves.
  }

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
