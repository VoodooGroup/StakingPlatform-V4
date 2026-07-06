window.VoodooApy = (function () {
  const DURATIONS = [2592000, 5184000, 10368000];

  async function fetchPools(contract) {
    const [magic30, magic60, magic120, poison30, poison60, poison120] = await Promise.all([
      contract.rewardRates(0, DURATIONS[0]),
      contract.rewardRates(0, DURATIONS[1]),
      contract.rewardRates(0, DURATIONS[2]),
      contract.rewardRates(1, DURATIONS[0]),
      contract.rewardRates(1, DURATIONS[1]),
      contract.rewardRates(1, DURATIONS[2]),
    ]);

    return [
      { rewardToken: 'MAGIC', lockupDays: 30, apy: Number(magic30) / 100, duration: DURATIONS[0], display: Number(magic30) },
      { rewardToken: 'MAGIC', lockupDays: 60, apy: Number(magic60) / 100, duration: DURATIONS[1], display: Number(magic60) },
      { rewardToken: 'MAGIC', lockupDays: 120, apy: Number(magic120) / 100, duration: DURATIONS[2], display: Number(magic120) },
      { rewardToken: 'POISON', lockupDays: 30, apy: Number(poison30) / 100, duration: DURATIONS[0], display: Number(poison30) },
      { rewardToken: 'POISON', lockupDays: 60, apy: Number(poison60) / 100, duration: DURATIONS[1], display: Number(poison60) },
      { rewardToken: 'POISON', lockupDays: 120, apy: Number(poison120) / 100, duration: DURATIONS[2], display: Number(poison120) },
    ];
  }

  function renderRoi(pools) {
    pools.forEach((pool, i) => {
      const el = document.getElementById(`roi${i + 1}`);
      if (el) el.textContent = `${pool.display}% APY`;
    });
  }

  return { fetchPools, renderRoi };
})();