import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { PULSECHAIN_NETWORK } from '../Contract_Files/constants';
import { getWriteContract, getVdoContract } from '../Interaction/staking';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [userAddress, setUserAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask extension not found');
    }

    setConnecting(true);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const walletSigner = await provider.getSigner();
      const network = await provider.getNetwork();

      if (network.chainId !== 369n) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x171' }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [PULSECHAIN_NETWORK],
            });
          } else {
            throw switchErr;
          }
        }
      }

      const address = await walletSigner.getAddress();
      setUserAddress(address);
      setSigner(walletSigner);
      return { address, signer: walletSigner, stakingContract: getWriteContract(walletSigner), vdoContract: getVdoContract(walletSigner) };
    } finally {
      setConnecting(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      userAddress,
      signer,
      connecting,
      connectWallet,
      isConnected: Boolean(userAddress && signer),
      walletLabel: userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Connect Wallet',
    }),
    [userAddress, signer, connecting, connectWallet],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
}