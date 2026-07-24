import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { PULSECHAIN_NETWORK } from '../Contract_Files/constants';
import { getWriteContract, getVdoContract } from '../Interaction/staking';

const WalletContext = createContext(null);
const VOODOO_RDNS = 'app.voodoowallet';
const VOODOO_INSTALL_URL = 'https://github.com/Voodoo-Token/voodoo-pulse-extension';

function isVoodooProvider(provider) {
  return Boolean(provider && (provider.isVoodooWallet === true || provider._isVoodooWallet === true));
}

function listProviders() {
  if (typeof window === 'undefined' || !window.ethereum) return [];
  if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
    return window.ethereum.providers.slice();
  }
  return [window.ethereum];
}

function discoverVoodooViaEip6963(timeoutMs = 400) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    let found = null;
    function onAnnounce(event) {
      const info = event.detail?.info;
      const provider = event.detail?.provider;
      if (!provider) return;
      const rdns = String(info?.rdns || '').toLowerCase();
      const name = String(info?.name || '');
      if (rdns === VOODOO_RDNS || /voodoo\s*wallet/i.test(name) || isVoodooProvider(provider)) {
        found = provider;
      }
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      resolve(found);
    }, timeoutMs);
  });
}

async function resolveVoodooProvider() {
  const direct = listProviders().find(isVoodooProvider);
  if (direct) return direct;
  if (window.ethereum && isVoodooProvider(window.ethereum)) return window.ethereum;
  return discoverVoodooViaEip6963();
}

function resolveInjectedProvider() {
  const providers = listProviders();
  if (!providers.length) return null;
  const mm = providers.find((p) => p.isMetaMask && !isVoodooProvider(p));
  return mm || providers.find((p) => p.isMetaMask) || providers[0];
}

export function WalletProvider({ children }) {
  const [userAddress, setUserAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [walletKind, setWalletKind] = useState(null);

  const connectWithEthereum = useCallback(async (ethereum, kind) => {
    if (!ethereum) {
      if (kind === 'voodoo') {
        const err = new Error('Voodoo Wallet not detected. Install the extension and refresh this page.');
        err.installUrl = VOODOO_INSTALL_URL;
        throw err;
      }
      throw new Error('MetaMask extension not found');
    }

    setConnecting(true);
    try {
      await ethereum.request({ method: 'eth_requestAccounts' });
      let provider = new ethers.BrowserProvider(ethereum);
      let walletSigner = await provider.getSigner();
      let network = await provider.getNetwork();

      if (network.chainId !== 369n) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x171' }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [PULSECHAIN_NETWORK],
            });
          } else {
            throw switchErr;
          }
        }
        provider = new ethers.BrowserProvider(ethereum);
        walletSigner = await provider.getSigner();
        network = await provider.getNetwork();
        if (network.chainId !== 369n) {
          throw new Error('Switch wallet to PulseChain (chain 369) and try again');
        }
      }

      const address = await walletSigner.getAddress();
      setUserAddress(address);
      setSigner(walletSigner);
      setWalletKind(kind);
      return {
        address,
        signer: walletSigner,
        walletKind: kind,
        stakingContract: getWriteContract(walletSigner),
        vdoContract: getVdoContract(walletSigner),
      };
    } finally {
      setConnecting(false);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    return connectWithEthereum(resolveInjectedProvider(), 'injected');
  }, [connectWithEthereum]);

  const connectVoodooWallet = useCallback(async () => {
    const ethereum = await resolveVoodooProvider();
    return connectWithEthereum(ethereum, 'voodoo');
  }, [connectWithEthereum]);

  const value = useMemo(
    () => ({
      userAddress,
      signer,
      connecting,
      walletKind,
      connectWallet,
      connectVoodooWallet,
      isConnected: Boolean(userAddress && signer),
      walletLabel: userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Connect Wallet',
    }),
    [userAddress, signer, connecting, walletKind, connectWallet, connectVoodooWallet],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}
