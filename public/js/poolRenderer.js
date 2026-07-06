window.VoodooPoolRenderer = (function () {
  function poolCardHtml(pool) {
    const n = pool.id;
    return `
      <div class="pool-wrapper" data-reward-type="${pool.rewardType}" data-duration="${pool.duration}">
        <div class="pool-logo-wrap">
          <img class="pool-logo" src="${pool.logo}" alt="${pool.token}" />
        </div>
        <h2 class="pool-title">Pool ${n}</h2>
        <div class="pool-card mt-4">
          <div class="tab-container">
            <button id="stakeTab${n}" class="tab-btn tab-active">Stake</button>
            <button id="rewardTab${n}" class="tab-btn tab-inactive">Reward</button>
          </div>
          <div id="stakeContent${n}" class="content active">
            <label class="block text-lg font-medium mb-2 text-black">Staked Token Amount</label>
            <input type="number" id="amount${n}" min="0" class="p-3 rounded bg-gray-100 text-black w-full mb-4 border border-gray-300 focus:outline-none focus:border-blue-500" />
            <div class="flex justify-between text-gray-700 mb-2">
              <span>ROI</span><span id="roi${n}" class="font-semibold">Loading...</span>
            </div>
            <div class="flex justify-between text-gray-700 mb-6">
              <span>LOCK</span><span>${pool.lockDays} Days</span>
            </div>
            <div class="btn-row">
              <button id="approve${n}" disabled class="action-btn approve-btn disabled:opacity-50">Approve</button>
              <button id="stakeBtn${n}" disabled class="action-btn stake-btn disabled:opacity-50">Stake</button>
            </div>
          </div>
          <div id="rewardContent${n}" class="content hidden">
            <div class="text-center">
              <span class="block text-lg font-medium text-black">Unlocks in:</span>
              <span id="timer${n}" class="timer-text font-bold">0d 0h 0m 0s</span>
            </div>
            <select id="unstakeSelect${n}" class="w-full mb-4 p-3 rounded bg-gray-100 text-black border border-gray-300 focus:outline-none focus:border-blue-500">
              <option value="">Select a stake to unstake...</option>
            </select>
            <button id="unstake${n}" disabled class="w-full py-3 rounded bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">Unstake</button>
            <p class="text-xs mt-4 text-center text-gray-600">
              Unstaking after the specified time will also transfer generated rewards to the wallet.
            </p>
          </div>
        </div>
      </div>`;
  }

  async function render() {
    const grid = document.getElementById('poolsGrid');
    if (!grid) return [];
    await window.StakingPlatformV4.load();
    const pools = window.StakingPlatformV4.getPools();
    grid.innerHTML = pools.map(poolCardHtml).join('');
    return pools;
  }

  return { render, poolCardHtml };
})();