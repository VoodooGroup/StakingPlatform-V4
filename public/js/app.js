(function () {
  const cfg = window.VoodooConfig;
  let signer, vdoContract, stakingContract, userAddress, currentPools;

  const readStakingContract = () => window.VoodooContracts.readStaking();

  function getContracts() {
    return { signer, vdoContract, stakingContract, userAddress };
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

    const btn = document.getElementById('connectBtn');
    btn.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    btn.disabled = false;

    await updateAllAPYs();

    try {
      await window.VoodooWallet.registerVoodooToken(result.ethereum);
    } catch (e) {
      console.warn('MetaMask token logo skipped', e);
    }

    const allowance = await vdoContract.allowance(userAddress, cfg.STAKING_ADDRESS);
    const approved = allowance.gt(0);
    document.querySelectorAll('[id^="approve"]').forEach((b) => { b.disabled = approved; });
    document.querySelectorAll('[id^="stakeBtn"]').forEach((b) => { b.disabled = !approved; });
  }

  function resetWalletUi() {
    signer = null;
    vdoContract = null;
    stakingContract = null;
    userAddress = null;
    const btn = document.getElementById('connectBtn');
    if (btn) {
      btn.textContent = 'Connect Wallet';
      btn.disabled = false;
    }
    document.querySelectorAll('[id^="approve"]').forEach((b) => { b.disabled = true; });
    document.querySelectorAll('[id^="stakeBtn"]').forEach((b) => { b.disabled = true; });
  }

  function bindConnectButton() {
    const btn = document.getElementById('connectBtn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Connecting...';
      try {
        const result = await window.VoodooWallet.connect();
        await onWalletConnected(result);
      } catch (err) {
        console.error(err);
        resetWalletUi();
        alert('Connection failed: ' + (err.message || err));
      }
    });
  }

  async function init() {
    bindConnectButton();

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

    window.VoodooWallet.bindListeners(
      async (account) => {
        if (!account) {
          resetWalletUi();
          return;
        }
        try {
          const result = await window.VoodooWallet.connect();
          await onWalletConnected(result);
        } catch (e) {
          console.error(e);
          resetWalletUi();
        }
      },
      () => window.location.reload()
    );

    await updateAllAPYs();

    if (window.VoodooWallet.getMetaMaskProvider()?.selectedAddress) {
      document.getElementById('connectBtn')?.click();
    }
  }

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();