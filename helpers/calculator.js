/**
 * Simple-interest rewards matching StakingPlatformV4:
 *   amount * apy * (lockupDays / 365)
 * @param {number} amount VDO staked
 * @param {number} apy decimal APY (e.g. 0.15 for 15%)
 * @param {number} lockupDays lock period in days
 */
export function calculateSimpleRewards(amount, apy, lockupDays) {
  const a = Number(amount) || 0;
  const r = Number(apy) || 0;
  const d = Number(lockupDays) || 0;
  return a * r * (d / 365);
}

/** @deprecated Use calculateSimpleRewards — contract does not compound daily */
export function calculateCompoundedRewards(amount, apy, lockupDays) {
  return calculateSimpleRewards(amount, apy, lockupDays);
}