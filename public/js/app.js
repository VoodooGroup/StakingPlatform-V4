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

    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.classList.remove('is-connected');
      connectBtn.textContent = 'MetaMask';
      connectBtn.title = 'Connect with MetaMask';
    }

    if (voodooBtn) {
      voodooBtn.disabled = false;
      voodooBtn.classList.remove('is-connected');
      setVoodooBtnLabel(null);
      voodooBtn.title = 'Connect with Voodoo Wallet browser extension';
    }
  }

  function markConnectedUi(kind, address) {
    const connectBtn = document.getElementById('connectBtn');
    const voodooBtn = document.getElementById('voodooWalletBtn');
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
        connectBtn.textContent = 'MetaMask';
        connectBtn.title = 'Already connected with Voodoo Wallet';
      }
      return;
    }

    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.classList.add('is-connected');
      connectBtn.textContent = label || 'MetaMask';
      connectBtn.title = address ? `Connected: ${address}` : 'Connected';
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

  function connectionErrorMessage(err) {
    if (!err) return 'Unknown error';
    const msg = err.message || String(err);
    if (err.code === 'VOODOO_NOT_FOUND' || /Voodoo Wallet not detected/i.test(msg)) {
      const url = err.installUrl || window.VoodooWallet.VOODOO_INSTALL_URL;
      return `${msg}\n\nInstall / docs: ${url}`;
    }
    return msg;
  }

  function bindConnectButton() {
    const btn = document.getElementById('connectBtn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', async () => {
      if (userAddress && window.VoodooWallet.getActiveWalletKind() === 'injected') return;
      setButtonBusy(btn, 'Connecting...');
      try {
        const result = await window.VoodooWallet.connect();
        await onWalletConnected(result);
      } catch (err) {
        console.error(err);
        resetWalletUi();
        alert('Connection failed: ' + connectionErrorMessage(err));
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
        console.error('[Voodoo Wallet connect]', err);
        let extra = '';
        try {
          const d = err.diagnose || (await window.VoodooWallet.diagnose?.());
          if (d) {
            extra = `\n\n[debug] voodooGlobal=${d.hasVoodooGlobal} ethIsVoodoo=${d.ethIsVoodoo} metamask=${d.ethIsMetaMask} bridge=${Boolean(window.__VOODOO_BRIDGE_READY__)}`;
            console.error('[Voodoo diagnose]', d);
          }
        } catch {
          /* ignore */
        }
        const detail = connectionErrorMessage(err) + extra
          + `\n\ncode=${err?.code || '?'} bridgeReady=${Boolean(window.__VOODOO_BRIDGE_READY__)}`
          + `\nvoodooEth=${Boolean(window.voodooEthereum)}`;
        resetWalletUi();
        setVoodooBtnLabel(null);

        let box = document.getElementById('voodooConnectError');
        if (!box) {
          box = document.createElement('div');
          box.id = 'voodooConnectError';
          box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#7f1d1d;color:#fff;padding:14px 16px;border-radius:10px;font:13px/1.45 ui-monospace,monospace;white-space:pre-wrap;max-height:45vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.4)';
          document.body.appendChild(box);
        }
        box.textContent = 'Voodoo Wallet verbinding mislukt\n\n' + detail
          + '\n\n(Klik dit vak om te sluiten)';
        box.onclick = () => box.remove();

        alert('Voodoo Wallet verbinding mislukt:\n\n' + detail);
      }
    });
  }

  async function init() {
    bindConnectButton();
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
    // Auto-clicking MetaMask/Voodoo when selectedAddress is set opened MetaMask
    // unexpectedly whenever the staking page loaded.
    // User must click "Voodoo Wallet" or "MetaMask" themselves.
  }

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
