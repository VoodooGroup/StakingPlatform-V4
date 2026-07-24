(function () {
  const cfg = window.VoodooConfig;
  let signer, vdoContract, stakingContract, userAddress, currentPools;

  const readStakingContract = () => window.VoodooContracts.readStaking();

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

  /** Voodoo button label: ONLY "Voodoo Wallet" or "Connected" (never address/status tips). */
  function setVoodooBtnLabel(connected) {
    const voodooBtn = document.getElementById('voodooWalletBtn');
    if (!voodooBtn) return;
    voodooBtn.textContent = connected ? 'Connected' : 'Voodoo Wallet';
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
      setVoodooBtnLabel(false);
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
        setVoodooBtnLabel(true);
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
      setVoodooBtnLabel(false);
      voodooBtn.title = 'Already connected with another wallet';
    }
  }

  async function updateAllAPYs() {
    const contract = stakingContract || readStakingContract();
    try {
      currentPools = await window.VoodooApy.fetchPools(contract);
      window.VoodooApy.renderRoi(currentPools);
      if (!document.getElementById('calculatorModal').classList.contains('hidden')) {
        window.VoodooCalculator.updateSelect(currentPools);
      }
    } catch (e) {
      console.warn('Failed to load APY', e);
      document.querySelectorAll('[id^="roi"]').forEach((el) => { el.textContent = 'Error'; });
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

    // Non-fatal follow-up work — must not surface as "connection failed"
    try {
      await updateAllAPYs();
    } catch (e) {
      console.warn('APY refresh after connect failed', e);
    }

    try {
      await window.VoodooWallet.registerVoodooToken(result.ethereum);
    } catch (e) {
      console.warn('Token logo registration skipped', e);
    }

    try {
      // Use public RPC for view calls (more reliable than routing allowance through the wallet)
      const readVdo = new ethers.Contract(
        cfg.VDO_ADDRESS,
        cfg.TOKEN_ABI,
        window.VoodooContracts.readProvider(),
      );
      const allowance = await readVdo.allowance(userAddress, cfg.STAKING_ADDRESS);
      const approved = allowance.gt(0);
      document.querySelectorAll('[id^="approve"]').forEach((b) => { b.disabled = approved; });
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
      setVoodooBtnLabel(false);

      try {
        const result = await window.VoodooWallet.connectVoodoo();
        await onWalletConnected(result);
        // markConnectedUi sets text to "Connected"
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
        setVoodooBtnLabel(false);

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

    // Auto-reconnect only for a previously selected generic injected wallet with an active account
    try {
      const voodoo = await window.VoodooWallet.getVoodooWalletProvider();
      if (voodoo?.selectedAddress) {
        document.getElementById('voodooWalletBtn')?.click();
      } else if (window.VoodooWallet.getMetaMaskProvider()?.selectedAddress) {
        document.getElementById('connectBtn')?.click();
      }
    } catch {
      /* ignore auto-connect failures */
    }
  }

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
