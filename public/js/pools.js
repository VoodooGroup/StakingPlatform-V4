window.VoodooPools = (function () {
  function formatTime(seconds) {
    if (seconds <= 0) return '0d 0h 0m 0s';
    const d = Math.floor(seconds / 86400);
    seconds %= 86400;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${d}d ${h}h ${m}m ${s}s`;
  }

  function updateTimer(el, unlockTs) {
    const tick = () => {
      const left = unlockTs - Math.floor(Date.now() / 1000);
      el.textContent = left > 0 ? formatTime(left) : 'Ready';
    };
    tick();
    setInterval(tick, 1000);
  }

  async function loadStakes(poolNum, stakingContract, userAddress) {
    const select = document.getElementById(`unstakeSelect${poolNum}`);
    const timer = document.getElementById(`timer${poolNum}`);
    const btn = document.getElementById(`unstake${poolNum}`);
    const wrapper = document.querySelector(`#rewardTab${poolNum}`).closest('.pool-wrapper');
    const expectedRewardType = parseInt(wrapper.dataset.rewardType || '0', 10);
    const expectedDuration = parseInt(wrapper.dataset.duration || '2592000', 10);

    if (!stakingContract || !userAddress) {
      select.innerHTML = '<option value="">Connect wallet first</option>';
      timer.textContent = '-';
      btn.disabled = true;
      return;
    }

    select.innerHTML = '<option value="">Loading...</option>';
    timer.textContent = 'Loading...';
    btn.disabled = true;

    try {
      // View call via public RPC (wallet injectors can break eth_call after Voodoo connect)
      const reader = window.VoodooContracts.readStaking();
      const stakes = await reader.getAllUserStakings(userAddress);
      select.innerHTML = '<option value="">Select a stake to unstake...</option>';
      let hasStake = false;
      let earliestUnlock = Infinity;

      stakes.forEach((stake, idx) => {
        if (!stake.isStaked) return;
        if (Number(stake.rewardType) !== expectedRewardType) return;
        if (Number(stake.lockDuration) !== expectedDuration) return;

        hasStake = true;
        const amount = ethers.utils.formatUnits(stake.amount, 18);
        const unlock = Number(stake.stakeTime) + Number(stake.lockDuration);
        earliestUnlock = Math.min(earliestUnlock, unlock);
        const timeLeft = unlock > Date.now() / 1000 ? formatTime(unlock - Date.now() / 1000) : 'Ready';

        const opt = document.createElement('option');
        opt.value = stake.id.toString();
        opt.textContent = `#${idx} - ${amount} VDO (${timeLeft})`;
        select.appendChild(opt);
      });

      if (hasStake) {
        btn.disabled = false;
        updateTimer(timer, earliestUnlock);
      } else {
        select.innerHTML = '<option value="">No active stakes in this pool</option>';
        timer.textContent = '-';
      }
    } catch (e) {
      select.innerHTML = '<option value="">Error loading</option>';
      timer.textContent = 'Error';
      console.error(e);
    }
  }

  function bindTabs(getContracts) {
    document.querySelectorAll('[id^="stakeTab"], [id^="rewardTab"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const num = btn.id.replace(/stakeTab|rewardTab/, '');
        const stakeContent = document.getElementById(`stakeContent${num}`);
        const rewardContent = document.getElementById(`rewardContent${num}`);
        const stakeTab = document.getElementById(`stakeTab${num}`);
        const rewardTab = document.getElementById(`rewardTab${num}`);

        if (btn.id.startsWith('rewardTab')) {
          stakeContent.classList.add('hidden');
          stakeContent.setAttribute('aria-hidden', 'true');
          rewardContent.classList.remove('hidden');
          rewardContent.setAttribute('aria-hidden', 'false');
          rewardTab.classList.add('tab-active');
          rewardTab.classList.remove('tab-inactive');
          stakeTab.classList.add('tab-inactive');
          stakeTab.classList.remove('tab-active');
          const { stakingContract, userAddress } = getContracts();
          await loadStakes(num, stakingContract, userAddress);
        } else {
          stakeContent.classList.remove('hidden');
          stakeContent.setAttribute('aria-hidden', 'false');
          rewardContent.classList.add('hidden');
          rewardContent.setAttribute('aria-hidden', 'true');
          stakeTab.classList.add('tab-active');
          stakeTab.classList.remove('tab-inactive');
          rewardTab.classList.add('tab-inactive');
          rewardTab.classList.remove('tab-active');
        }
      });
    });
  }

  /**
   * User ignored wallet / cancelled / any wait failure — NEVER show an alert.
   * Especially: Approve/Stake clicked but no reaction in the extension.
   */
  function isQuietWalletCancel(err) {
    const msg = String(err?.reason || err?.data?.message || err?.message || err || '').toLowerCase();
    const code = err?.code;
    return (
      code === 4001
      || code === 'VOODOO_TIMEOUT'
      || code === 'ACTION_REJECTED'
      || code === 'TIMEOUT'
      || code === -32000
      || /user rejected|user denied|rejected the request|rejected|timeout|timed out|geen antwoord|cancel|aborted|extensie reageert niet|wallet gaf geen|confirm in wallet/i.test(msg)
    );
  }

  function bindActions(getContracts) {
    function flashAmountInput(input) {
      if (!input) return;
      input.focus();
      input.classList.add('amount-needs-value');
      input.setAttribute('placeholder', 'Enter VDO amount');
      window.setTimeout(() => {
        input.classList.remove('amount-needs-value');
      }, 1600);
    }

    document.querySelectorAll('[id^="stakeBtn"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { stakingContract, userAddress } = getContracts();
        if (!stakingContract || !userAddress) {
          // Soft — no chrome alert; connect button is in the header
          console.warn('Connect Voodoo Wallet first');
          document.getElementById('voodooWalletBtn')?.focus();
          return;
        }
        const num = btn.id.replace('stakeBtn', '');
        const input = document.getElementById(`amount${num}`);
        const val = (input?.value || '').trim();
        // No chrome alert — highlight amount field so user fills it, then Stake opens wallet
        if (!val || Number(val) <= 0) {
          flashAmountInput(input);
          return;
        }
        const prev = btn.textContent;
        try {
          btn.disabled = true;
          // Short label only — long text resized pool cards (CSS conflict)
          btn.textContent = 'Confirm…';
          const amount = ethers.utils.parseUnits(val, 18);
          const wrapper = btn.closest('.pool-wrapper');
          const rewardType = parseInt(wrapper.dataset.rewardType || '0', 10);
          const duration = parseInt(wrapper.dataset.duration || '2592000', 10);
          // Opens Voodoo Wallet with stake summary (amount / pool / gas)
          const tx = await stakingContract.stake(amount, rewardType, duration, {
            gasLimit: 550000,
          });

          // Hash received → public-RPC receipt wait (wallet tx.wait hangs forever)
          btn.textContent = 'Pending…';
          const hash = tx?.hash || tx;
          const receipt = window.VoodooContracts.waitForReceipt
            ? await window.VoodooContracts.waitForReceipt(hash, 120_000)
            : await Promise.race([
              tx.wait().catch(() => null),
              new Promise((r) => setTimeout(() => r(null), 120_000)),
            ]);

          if (!receipt) {
            // Unstick UI — tx may still be mining on a slow RPC
            console.warn('Stake tx submitted, confirmation timed out:', hash);
            btn.textContent = prev || 'Stake';
            btn.disabled = false;
            return;
          }

          const status = receipt.status;
          const ok = status === 1 || status === '0x1' || Number(status) === 1;
          if (!ok) {
            throw new Error('Stake transaction reverted on-chain');
          }

          input.value = '';
          btn.textContent = prev || 'Stake';
          btn.disabled = false;
          // Refresh reward tab data quietly if open
          try {
            const rewardTab = document.getElementById(`rewardTab${num}`);
            if (rewardTab && rewardTab.classList.contains('tab-active')) {
              rewardTab.click();
            }
          } catch {
            /* ignore */
          }
        } catch (e) {
          console.error('Stake failed', e);
          btn.disabled = false;
          btn.textContent = prev || 'Stake';
          if (isQuietWalletCancel(e)) return;
          const msg = e?.reason || e?.data?.message || e?.message || String(e);
          if (/timeout|timed out|geen antwoord|no response|reageert niet|insufficient funds/i.test(String(msg))) {
            return;
          }
          // Keep failures quiet on site — extension shows the real error
          console.warn('Stake failed:', msg);
        }
      });
    });

    function markAllApproved() {
      document.querySelectorAll('[id^="approve"]').forEach((b) => {
        b.disabled = true;
        b.textContent = 'Approved';
      });
      document.querySelectorAll('[id^="stakeBtn"]').forEach((b) => { b.disabled = false; });
    }

    function isPositiveAllowance(allowance) {
      if (allowance == null) return false;
      try {
        if (typeof allowance.gt === 'function') return allowance.gt(0);
        if (typeof allowance === 'bigint') return allowance > 0n;
        return Number(allowance) > 0;
      } catch {
        return false;
      }
    }

    /** Poll public RPC for allowance — reliable after wallet returns a tx hash */
    async function waitUntilApproved(userAddress, maxMs = 90_000) {
      // Always V4 spender (never legacy V2)
      const stakingAddr = window.VoodooContracts.stakingAddress?.()
        || window.VoodooConfig.STAKING_ADDRESS;
      const started = Date.now();
      while (Date.now() - started < maxMs) {
        try {
          const allowance = await window.VoodooContracts.withReadFailover(async (provider) => {
            const vdo = window.VoodooContracts.readVdo(provider);
            return vdo.allowance(userAddress, stakingAddr);
          });
          if (isPositiveAllowance(allowance)) return true;
        } catch (e) {
          console.warn('Allowance poll failed', e?.message || e);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      return false;
    }

    document.querySelectorAll('[id^="approve"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { vdoContract, userAddress } = getContracts();
        if (!vdoContract || !userAddress) {
          console.warn('Connect Voodoo Wallet first');
          document.getElementById('voodooWalletBtn')?.focus();
          return;
        }
        const stakingAddr = window.VoodooContracts.stakingAddress?.()
          || window.VoodooConfig.STAKING_ADDRESS;
        const prev = btn.textContent;
        try {
          btn.disabled = true;
          // Short fixed label — long text resized pool cards
          btn.textContent = 'Confirm…';
          // gasLimit: skip eth_estimateGas through wallet
          // Spender must be StakingPlatform V4 only
          const tx = await vdoContract.approve(
            stakingAddr,
            ethers.constants.MaxUint256,
            { gasLimit: 120000 },
          );

          // Hash received from extension → confirmation phase
          btn.textContent = 'Pending…';
          document.querySelectorAll('[id^="approve"]').forEach((b) => {
            if (b !== btn) {
              b.disabled = true;
              b.textContent = 'Pending…';
            }
          });

          // Public-RPC allowance poll (do not rely on wallet receipt alone)
          if (tx?.wait) {
            tx.wait(1).catch(() => null);
          }
          const success = await waitUntilApproved(userAddress, 90_000);
          if (!success) {
            // Still enable stake if we got a hash — allowance may lag one poll cycle
            const late = await waitUntilApproved(userAddress, 15_000);
            if (!late) {
              console.warn('Approval submitted; allowance not visible yet');
              btn.disabled = false;
              btn.textContent = prev || 'Approve';
              return;
            }
          }

          markAllApproved();
          // No chrome "Approval successful" alert
        } catch (e) {
          console.error('Approve failed', e);
          // If allowance already on-chain, still unlock Stake
          try {
            const ok = await waitUntilApproved(userAddress, 6_000);
            if (ok) {
              markAllApproved();
              return;
            }
          } catch {
            /* ignore */
          }
          btn.disabled = false;
          btn.textContent = prev || 'Approve';
          if (isQuietWalletCancel(e)) return;
          const msg = e?.reason || e?.data?.message || e?.message || String(e);
          if (/timeout|timed out|geen antwoord|no response|reageert niet|insufficient funds/i.test(String(msg))) {
            return;
          }
          console.warn('Approval failed:', msg);
        }
      });
    });

    document.querySelectorAll('[id^="unstake"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { stakingContract } = getContracts();
        const num = btn.id.replace('unstake', '');
        const select = document.getElementById(`unstakeSelect${num}`);
        const index = select.value;
        if (!index) {
          select?.focus();
          return;
        }
        const prev = btn.textContent;
        try {
          btn.disabled = true;
          btn.textContent = 'Confirm…';
          const tx = await stakingContract.unstake(index, { gasLimit: 350000 });
          btn.textContent = 'Pending…';
          const hash = tx?.hash || tx;
          if (window.VoodooContracts.waitForReceipt) {
            await window.VoodooContracts.waitForReceipt(hash, 120_000);
          } else {
            await Promise.race([
              tx.wait().catch(() => null),
              new Promise((r) => setTimeout(() => r(null), 120_000)),
            ]);
          }
          btn.disabled = false;
          btn.textContent = prev || 'Unstake';
          document.getElementById(`rewardTab${num}`).click();
        } catch (e) {
          console.error('Unstake failed', e);
          btn.disabled = false;
          btn.textContent = prev || 'Unstake';
          if (isQuietWalletCancel(e)) return;
          console.warn('Unstake failed:', e?.message || e);
        }
      });
    });
  }

  return { bindTabs, bindActions, loadStakes, formatTime };
})();