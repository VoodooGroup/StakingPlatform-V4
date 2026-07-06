export default function Header({ walletLabel, onConnect, isConnected }) {
  return (
    <nav className="flex items-center justify-between p-4 shadow-md bg-white">
      <div className="flex items-center pl-4 space-x-6">
        <a href="https://voodootoken.com/staking-quide/" target="_blank" rel="noopener noreferrer">
          <img src="/button-1.png" alt="Logo" width={40} height={40} className="h-10 w-auto" />
        </a>
        <a href="/index.html#calculator" className="inline-block">
          <img src="/voodoo-token-calculator.png" alt="Calculator" className="h-[47px] w-auto rounded hover:opacity-90 transition-opacity cursor-pointer" />
        </a>
      </div>
      <div className="pr-4">
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnected}
          className="bg-blue-800 hover:bg-blue-700 text-white px-6 py-2 rounded transition duration-300 ease-in-out font-mono disabled:opacity-80"
        >
          {walletLabel}
        </button>
      </div>
    </nav>
  );
}