import { LCW_API_KEY } from '../Contract_Files/constants';

const COINS = { MAGIC: '__________MAGIC', POISON: '__POISON' };
const URL = 'https://api.livecoinwatch.com/coins/single';

export async function fetchRewardPrices() {
  const prices = { MAGIC: 0, POISON: 0 };

  for (const [key, code] of Object.entries(COINS)) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': LCW_API_KEY },
      body: JSON.stringify({ currency: 'USD', code }),
    });
    if (!res.ok) throw new Error('Price fetch failed');
    const data = await res.json();
    prices[key] = data.rate || 0;
  }

  return prices;
}