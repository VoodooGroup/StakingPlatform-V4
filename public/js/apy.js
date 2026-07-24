window.VoodooApy = (function () {
  const DURATIONS = [2592000, 5184000, 10368000];

  /** Last successful pool rates — never wipe UI to Error while wallet is idle */
  let lastGoodPools = null;

  async function fetchPoolsFromContract(contract) {
    const [magic30, magic60, magic120, poison30, poison60, poison120] = await Promise.all([
      contract.rewardRates(0, DURATIONS[0]),
      contract.rewardRates(0, DURATIONS[1]),
      contract.rewardRates(0, DURATIONS[2]),
      contract.rewardRates(1, DURATIONS[0]),
      contract.rewardRates(1, DURATIONS[1]),
      contract.rewardRates(1, DURATIONS[2]),
    ]);

    const pools = [
      { rewardToken: 'MAGIC', lockupDays: 30, apy: Number(magic30) / 100, duration: DURATIONS[0], display: Number(magic30) },
      { rewardToken: 'MAGIC', lockupDays: 60, apy: Number(magic60) / 100, duration: DURATIONS[1], display: Number(magic60) },
      { rewardToken: 'MAGIC', lockupDays: 120, apy: Number(magic120) / 100, duration: DURATIONS[2], display: Number(magic120) },
      { rewardToken: 'POISON', lockupDays: 30, apy: Number(poison30) / 100, duration: DURATIONS[0], display: Number(poison30) },
      { rewardToken: 'POISON', lockupDays: 60, apy: Number(poison60) / 100, duration: DURATIONS[1], display: Number(poison60) },
      { rewardToken: 'POISON', lockupDays: 120, apy: Number(poison120) / 100, duration: DURATIONS[2], display: Number(poison120) },
    ];

    // Sanity: reject empty/NaN rates so we keep previous good values
    if (pools.some((p) => !Number.isFinite(p.display))) {
      throw new Error('Invalid APY payload');
    }
    lastGoodPools = pools;
    return pools;
  }

  async function fetchPools(/* optional unused contract for back-compat */) {
    // Always use public-RPC failover — never depend on a single local /rpc hop
    // (that path dies when Approve opens the extension and the proxy is busy).
    if (window.VoodooContracts?.withReadFailover) {
      return window.VoodooContracts.withReadFailover(async (provider) => {
        const contract = window.VoodooContracts.readStaking(provider);
        return fetchPoolsFromContract(contract);
      });
    }
    const contract = window.VoodooContracts.readStaking();
    return fetchPoolsFromContract(contract);
  }

  function renderRoi(pools) {
    const list = pools || lastGoodPools;
    if (!list?.length) return;
    list.forEach((pool, i) => {
      const el = document.getElementById(`roi${i + 1}`);
      if (el) el.textContent = `${pool.display}% APY`;
    });
  }

  function getLastGood() {
    return lastGoodPools;
  }

  return { fetchPools, renderRoi, getLastGood };
})();
