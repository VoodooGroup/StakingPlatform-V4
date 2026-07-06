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
      const stakes = await stakingContract.getAllUserStakings(userAddress);
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
          rewardContent.classList.remove('hidden');
          rewardTab.classList.add('tab-active');
          rewardTab.classList.remove('tab-inactive');
          stakeTab.classList.add('tab-inactive');
          stakeTab.classList.remove('tab-active');
          const { stakingContract, userAddress } = getContracts();
          await loadStakes(num, stakingContract, userAddress);
        } else {
          stakeContent.classList.remove('hidden');
          rewardContent.classList.add('hidden');
          stakeTab.classList.add('tab-active');
          stakeTab.classList.remove('tab-inactive');
          rewardTab.classList.add('tab-inactive');
          rewardTab.classList.remove('tab-active');
        }
      });
    });
  }

  function bindActions(getContracts) {
    document.querySelectorAll('[id^="stakeBtn"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { stakingContract } = getContracts();
        const num = btn.id.replace('stakeBtn', '');
        const input = document.getElementById(`amount${num}`);
        const val = input.value.trim();
        if (!val || Number(val) <= 0) return;
        try {
          const amount = ethers.utils.parseUnits(val, 18);
          const wrapper = btn.closest('.pool-wrapper');
          const rewardType = parseInt(wrapper.dataset.rewardType || '0', 10);
          const duration = parseInt(wrapper.dataset.duration || '2592000', 10);
          const tx = await stakingContract.stake(amount, rewardType, duration);
          await tx.wait();
          input.value = '';
          alert('Stake successful!');
        } catch (e) {
          console.error('Stake failed', e);
          alert('Stake transaction failed: ' + e.message);
        }
      });
    });

    document.querySelectorAll('[id^="approve"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { vdoContract } = getContracts();
        const { STAKING_ADDRESS } = window.VoodooConfig;
        try {
          const tx = await vdoContract.approve(STAKING_ADDRESS, ethers.constants.MaxUint256);
          await tx.wait();
          document.querySelectorAll('[id^="approve"]').forEach((b) => { b.disabled = true; });
          document.querySelectorAll('[id^="stakeBtn"]').forEach((b) => { b.disabled = false; });
          alert('Approval successful!');
        } catch (e) {
          console.error('Approve failed', e);
          alert('Approval failed: ' + e.message);
        }
      });
    });

    document.querySelectorAll('[id^="unstake"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { stakingContract } = getContracts();
        const num = btn.id.replace('unstake', '');
        const select = document.getElementById(`unstakeSelect${num}`);
        const index = select.value;
        if (!index) return alert('Please select a stake first');
        try {
          const tx = await stakingContract.unstake(index);
          await tx.wait();
          document.getElementById(`rewardTab${num}`).click();
          alert('Unstake successful!');
        } catch (e) {
          console.error('Unstake failed', e);
          alert('Unstake failed: ' + e.message);
        }
      });
    });
  }

  return { bindTabs, bindActions, loadStakes, formatTime };
})();