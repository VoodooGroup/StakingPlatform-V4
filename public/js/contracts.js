window.VoodooContracts = (function () {
  const cfg = () => window.VoodooConfig;

  const PUBLIC_RPCS = [
    'https://pulsechain.publicnode.com',
    'https://rpc.pulsechain.com',
    'https://pulsechain-rpc.publicnode.com',
  ];

  /**
   * Public PulseChain RPCs for view calls only (ROI / allowance).
   * Prefer public endpoints first — local /rpc proxy is single-threaded and
   * can fail while Approve is pending in the wallet (caused all boxes "Error").
   * Never use the injected wallet for rewardRates.
   */
  function rpcUrls() {
    const local = cfg().RPC_URL;
    const list = [...PUBLIC_RPCS];
    if (local && !list.includes(local)) list.push(local);
    return list.filter(Boolean);
  }

  function makeProvider(url) {
    return new ethers.providers.StaticJsonRpcProvider(url, {
      name: 'PulseChain',
      chainId: 369,
    });
  }

  function readProvider() {
    // Primary = first public node (stable during wallet prompts)
    return makeProvider(rpcUrls()[0]);
  }

  /** Try each RPC until rewardRates / view calls succeed */
  async function withReadFailover(fn) {
    let lastErr;
    for (const url of rpcUrls()) {
      try {
        const provider = makeProvider(url);
        return await fn(provider);
      } catch (err) {
        lastErr = err;
        console.warn('[VoodooContracts] read failed on', url, err?.message || err);
      }
    }
    throw lastErr || new Error('All PulseChain RPCs failed');
  }

  /** Always StakingPlatform V4 (never legacy V2) */
  function stakingAddress() {
    const addr = cfg()?.STAKING_ADDRESS
      || window.VoodooAddresses?.STAKING_V4
      || '0x3359EcA752F8fCa2A1E47EF01160CFCd782BD6E7';
    const legacy = (window.VoodooAddresses?.STAKING_V2_LEGACY || '').toLowerCase();
    if (String(addr).toLowerCase() === legacy) {
      console.error('[VoodooContracts] Refusing legacy V2 staking address');
      return window.VoodooAddresses.STAKING_V4;
    }
    return addr;
  }

  function readStaking(provider) {
    const p = provider || readProvider();
    return new ethers.Contract(stakingAddress(), window.STAKING_ABI, p);
  }

  function readVdo(provider) {
    const c = cfg();
    const p = provider || readProvider();
    return new ethers.Contract(c.VDO_ADDRESS, c.TOKEN_ABI, p);
  }

  /** Write contracts only — approve / stake / unstake go through the wallet signer */
  function createSigned(signer) {
    const c = cfg();
    return {
      vdo: new ethers.Contract(c.VDO_ADDRESS, c.TOKEN_ABI, signer),
      staking: new ethers.Contract(stakingAddress(), window.STAKING_ABI, signer),
    };
  }

  /**
   * Wait for a tx receipt on public RPC (never wallet injector).
   * Wallet eth_getTransactionReceipt often hangs after Approve/Stake confirm,
   * leaving the dApp button stuck on "Pending…".
   * @returns {Promise<object|null>} receipt or null on timeout
   */
  async function waitForReceipt(txHash, maxMs = 120_000) {
    if (!txHash) return null;
    const started = Date.now();
    let lastErr;
    while (Date.now() - started < maxMs) {
      for (const url of rpcUrls()) {
        try {
          const provider = makeProvider(url);
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt) return receipt;
        } catch (err) {
          lastErr = err;
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (lastErr) console.warn('[VoodooContracts] waitForReceipt timeout', txHash, lastErr);
    return null;
  }

  return {
    readProvider,
    readStaking,
    readVdo,
    createSigned,
    withReadFailover,
    waitForReceipt,
    rpcUrls,
    stakingAddress,
  };
})();


