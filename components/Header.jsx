function shortAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Header({
  onConnect,
  onConnectVoodoo,
  isConnected,
  walletKind,
  address = '',
}) {
  const voodooLabel = walletKind === 'voodoo' && isConnected && address
    ? shortAddress(address)
    : 'Voodoo Wallet';
  const injectedLabel = walletKind === 'injected' && isConnected && address
    ? shortAddress(address)
    : 'MetaMask';

  return (
    <nav className="flex items-center justify-between p-4 shadow-md bg-white">
      <div className="flex items-center pl-4 space-x-6">
        <a href="https://voodootoken.com/staking-quide/" target="_blank" rel="noopener noreferrer">
          <img src="/button-1.png" alt="Logo" width={40} height={40} className="h-10 w-auto" />
        </a>
        <a href="/index.html#calculator" className="inline-block">
          <img
            src="/voodoo-token-calculator.png"
            alt="Calculator"
            className="h-[47px] w-auto rounded hover:opacity-90 transition-opacity cursor-pointer"
          />
        </a>
      </div>
      <div className="pr-4 flex flex-nowrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onConnectVoodoo}
          disabled={isConnected && walletKind !== 'voodoo'}
          className="inline-flex items-center justify-center w-[10.5rem] h-10 shrink-0 text-white text-sm font-semibold font-mono rounded transition duration-300 ease-in-out disabled:opacity-90"
          style={{ backgroundColor: '#073749' }}
          title="Connect with Voodoo Wallet browser extension"
        >
          {voodooLabel}
        </button>
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnected && walletKind !== 'injected'}
          className="inline-flex items-center justify-center w-[10.5rem] h-10 shrink-0 bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold font-mono rounded transition duration-300 ease-in-out disabled:opacity-90"
          title="Connect with MetaMask or another browser wallet"
        >
          {injectedLabel}
        </button>
      </div>
    </nav>
  );
}
