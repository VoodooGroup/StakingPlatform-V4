const LOGOS = {
  MAGIC: '/Magic-Reward-Token-Logo.png',
  POISON: '/Poison-Reward-Token-Logo.png',
};

export default function PoolCard({ pool }) {
  const logo = LOGOS[pool.token] || LOGOS.MAGIC;
  return (
    <div className="pool-wrapper" data-reward-type={pool.rewardType} data-duration={pool.duration}>
      <img className="pool-logo mx-auto" src={logo} alt={pool.token} />
      <h2 className="pool-title">Pool {pool.id}</h2>
      <p className="text-white text-sm">{pool.lockDays} days • {pool.token}</p>
    </div>
  );
}