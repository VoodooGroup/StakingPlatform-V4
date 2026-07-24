window.VoodooCalculator = (function () {
  const { LCW_API_KEY } = window.VoodooConfig;
  let prices = { MAGIC: 0, POISON: 0 };
  let poolsGetter = () => null;

  function updateSelect(pools) {
    const select = document.getElementById('poolSelect');
    if (!select || !pools?.length) return;
    select.innerHTML = '';
    pools.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Pool ${i + 1}: ${p.rewardToken}, ${p.lockupDays} days, ${p.display ?? p.apy * 100}% APY`;
      select.appendChild(opt);
    });
  }

  async function fetchPrices() {
    const coins = { MAGIC: '__________MAGIC', POISON: '__POISON' };
    for (const [key, code] of Object.entries(coins)) {
      const res = await fetch('https://api.livecoinwatch.com/coins/single', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': LCW_API_KEY },
        body: JSON.stringify({ currency: 'USD', code }),
      });
      if (!res.ok) throw new Error('Price fetch failed');
      const data = await res.json();
      prices[key] = data.rate || 0;
    }
  }

  async function calculate(pools) {
    const amt = parseFloat(document.getElementById('voodooAmount').value);
    const idx = parseInt(document.getElementById('poolSelect').value, 10);
    const resDiv = document.getElementById('result');
    const errDiv = document.getElementById('error');

    if (isNaN(amt) || amt <= 0) {
      errDiv.textContent = 'Enter a valid amount.';
      errDiv.classList.remove('hidden');
      resDiv.classList.add('hidden');
      return;
    }
    if (!pools?.length) {
      errDiv.textContent = 'Rates not loaded yet. Wait a moment and try again.';
      errDiv.classList.remove('hidden');
      resDiv.classList.add('hidden');
      return;
    }

    try {
      await fetchPrices();
    } catch (e) {
      document.getElementById('error').textContent = 'Price fetch failed - USD value = $0';
      document.getElementById('error').classList.remove('hidden');
    }

    const pool = pools[idx];
    if (!pool) {
      errDiv.textContent = 'Select a valid pool.';
      errDiv.classList.remove('hidden');
      resDiv.classList.add('hidden');
      return;
    }

    /**
     * Match StakingPlatformV4 on-chain math (simple interest, not compound):
     *   rewards = amount * rewardRate * days / (365 * 100)
     * where rewardRate is the integer APY from rewardRates() (e.g. 15 = 15% APY).
     * pool.apy is already rate/100 (e.g. 0.15); pool.display is the % integer.
     * Full lock period assumed (early unstake uses beforeLockTimePercentage on-chain).
     */
    const days = Number(pool.lockupDays) || (Number(pool.duration) / 86400) || 0;
    const apyDecimal = Number.isFinite(pool.apy)
      ? Number(pool.apy)
      : (Number(pool.display) || 0) / 100;
    const apyPercent = Number.isFinite(pool.display)
      ? Number(pool.display)
      : apyDecimal * 100;
    const rewards = amt * apyDecimal * (days / 365);
    const usd = rewards * (prices[pool.rewardToken] || 0);

    const rewardEl = document.getElementById('rewardAmount');
    const usdEl = document.getElementById('usdValue');
    const apyEl = document.getElementById('usedApy');
    if (rewardEl) {
      rewardEl.textContent = `Rewards (full lock): ${rewards.toFixed(4)} ${pool.rewardToken}`;
    }
    if (usdEl) {
      usdEl.textContent = `Est. value: $${usd.toFixed(2)} USD`;
    }
    if (apyEl) {
      apyEl.textContent = `Pool APY: ${apyPercent}% · ${days} days (same rates as pool cards)`;
    }
    resDiv.classList.remove('hidden');
    errDiv.classList.add('hidden');
  }

  async function resolvePools() {
    const cached = poolsGetter();
    if (cached?.length) return cached;
    try {
      const contract = window.VoodooContracts?.readStaking?.();
      if (!contract) return null;
      return await window.VoodooApy.fetchPools(contract);
    } catch (e) {
      console.warn('Calculator pool fetch failed', e);
      return null;
    }
  }

  async function refreshPools() {
    const pools = await resolvePools();
    if (pools?.length) updateSelect(pools);
    return pools;
  }

  async function runCalculate() {
    const pools = await resolvePools();
    return calculate(pools || []);
  }

  function bind(getter) {
    if (typeof getter === 'function') poolsGetter = getter;
  }

  return { updateSelect, calculate, bind, refreshPools, runCalculate };
})();