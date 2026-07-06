window.VoodooWallet = (function () {
  function pulsechainNetwork() {
    return window.VoodooConfig.PULSECHAIN_NETWORK;
  }
  let listenersBound = false;

  function getMetaMaskProvider() {
    if (typeof window === 'undefined') return null;
    if (window.location.protocol === 'file:') return null;

    const { ethereum } = window;
    if (!ethereum) return null;

    if (Array.isArray(ethereum.providers) && ethereum.providers.length) {
      const mm = ethereum.providers.find((p) => p.isMetaMask);
      if (mm) return mm;
      return ethereum.providers[0];
    }

    if (ethereum.isMetaMask || ethereum._metamask || ethereum.isStatus) {
      return ethereum;
    }

    return ethereum;
  }

  async function switchToPulseChain(ethereum) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x171' }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [pulsechainNetwork()],
        });
      } else {
        throw switchErr;
      }
    }
  }

  async function connect() {
    const ethereum = getMetaMaskProvider();
    if (!ethereum) {
      if (window.location.protocol === 'file:') {
        throw new Error('Open via START.bat at http://localhost:8080 (MetaMask cannot use file://)');
      }
      throw new Error('MetaMask not detected. Install the extension and refresh this page.');
    }

    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts?.length) {
      throw new Error('No wallet account selected in MetaMask');
    }

    let provider = new ethers.providers.Web3Provider(ethereum, 'any');
    let network = await provider.getNetwork();

    if (Number(network.chainId) !== 369) {
      await switchToPulseChain(ethereum);
      await new Promise((r) => setTimeout(r, 600));
      provider = new ethers.providers.Web3Provider(ethereum, 'any');
      network = await provider.getNetwork();
      if (Number(network.chainId) !== 369) {
        throw new Error('Switch MetaMask to PulseChain (chain 369) and try again');
      }
    }

    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();

    return { ethereum, provider, signer, userAddress };
  }

  function bindListeners(onAccountsChanged, onChainChanged) {
    const ethereum = getMetaMaskProvider();
    if (!ethereum || listenersBound) return;
    listenersBound = true;

    ethereum.on('accountsChanged', (accounts) => {
      if (!accounts?.length) {
        onAccountsChanged?.(null);
        return;
      }
      onAccountsChanged?.(accounts[0]);
    });

    ethereum.on('chainChanged', () => {
      onChainChanged?.();
    });
  }

  async function registerVoodooToken(ethereum) {
    const { VDO_ADDRESS } = window.VoodooConfig;
    const image = window.StakingPlatformV4?.getVoodooLogoUrl()
      || `${window.location.origin}/Voodoo-Token-Logo.png`;

    try {
      const added = await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: VDO_ADDRESS,
            symbol: 'VDO',
            decimals: 18,
            image,
          },
        },
      });
      if (added) console.log('Voodoo token logo registered in MetaMask:', image);
    } catch (e) {
      console.warn('Token logo registration skipped', e);
    }
  }

  return { getMetaMaskProvider, connect, bindListeners, registerVoodooToken };
})();