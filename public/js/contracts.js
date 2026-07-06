window.VoodooContracts = (function () {
  const cfg = () => window.VoodooConfig;

  function readProvider() {
    return new ethers.providers.JsonRpcProvider(cfg().RPC_URL);
  }

  function readStaking() {
    return new ethers.Contract(cfg().STAKING_ADDRESS, window.STAKING_ABI, readProvider());
  }

  function createSigned(signer) {
    const c = cfg();
    return {
      vdo: new ethers.Contract(c.VDO_ADDRESS, c.TOKEN_ABI, signer),
      staking: new ethers.Contract(c.STAKING_ADDRESS, window.STAKING_ABI, signer),
    };
  }

  return { readProvider, readStaking, createSigned };
})();