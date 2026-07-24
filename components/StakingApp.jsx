import Header from './Header';
import Footer from './Footer';

export default function StakingApp() {
  if (typeof window !== 'undefined') {
    window.location.replace('/index.html');
  }
  return (
    <>
      <Header walletLabel="MetaMask" onConnect={() => {}} isConnected={false} />
      <main className="flex-grow p-8 text-center text-white">
        <p>Loading staking portal...</p>
      </main>
      <Footer />
    </>
  );
}