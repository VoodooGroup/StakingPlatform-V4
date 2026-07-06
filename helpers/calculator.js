export function calculateCompoundedRewards(amount, apy, lockupDays) {
  const years = lockupDays / 365;
  const compounded = amount * (1 + apy / 365) ** (365 * years);
  return compounded - amount;
}