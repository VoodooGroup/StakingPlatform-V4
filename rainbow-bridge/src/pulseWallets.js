/**
 * Adapt RainbowKit wallet factories for reliable desktop PulseChain UX.
 *
 * Bug (Rabby → Trust stays on Rabby):
 * In wide modal there is NO back button on the CONNECT step. Switching wallets
 * depends on selectWallet() updating `selectedWallet` inside onQrCode().
 * onQrCode does:  await wallet.getQrCodeUri()
 * which waits for WalletConnect `display_uri`. Injected wallets (Rabby, Trust,
 * MetaMask, …) never emit that event when connecting via extension → promise
 * hangs → UI never leaves the previous wallet screen.
 *
 * Fix: strip async QR / deep-link URI getters from extension/EVM wallets.
 * Keep pure WalletConnect entry for mobile QR.
 */

function stripBlockingUris(wallet) {
  // Never strip pure WalletConnect QR wallets (we removed WC from the list, keep guard)
  if (!wallet || wallet.id === 'walletConnect' || wallet.id === 'voodoo-wc-qr') {
    return wallet;
  }

  const next = { ...wallet };

  if (next.qrCode) {
    const { getUri, ...qrRest } = next.qrCode;
    // Drop getUri so RK does not await display_uri (hangs extension wallets)
    next.qrCode = Object.keys(qrRest).length ? qrRest : undefined;
  }

  if (next.desktop?.getUri) {
    const { getUri, ...deskRest } = next.desktop;
    next.desktop = Object.keys(deskRest).length ? deskRest : undefined;
  }

  if (next.mobile?.getUri) {
    const { getUri, ...mobRest } = next.mobile;
    next.mobile = Object.keys(mobRest).length ? mobRest : undefined;
  }

  // Injected / Voodoo: force pure extension connect path (no QR step)
  if (next.id === 'voodoo' || next.id === 'metaMask' || next.id === 'rabby' || next.id === 'brave') {
    delete next.qrCode;
    delete next.mobile;
    delete next.desktop;
  }

  return next;
}

/** Wrap a RainbowKit CreateWalletFn */
export function pulseWallet(createWallet) {
  return (options) => stripBlockingUris(createWallet(options));
}

/** Map a list of wallet factories through pulseWallet */
export function pulseWallets(factories) {
  return factories.map((fn) => pulseWallet(fn));
}
