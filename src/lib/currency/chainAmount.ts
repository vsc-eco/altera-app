/**
 * Exact chain integers around CoinAmount, whose smallest units live in a JS
 * number (exact only to 2^53). Every asset but ETH stays far below that; ETH in
 * wei passes it at ~0.009 ETH, so for ETH:
 *  - a payload amount must not go through String(number), which prints
 *    "1e+21" from 1,000 ETH up: toChainUnits gives the integer digits;
 *  - a balance read from the chain must not round UP to the nearest double,
 *    or "max" asks for a few wei more than the account holds and the contract
 *    refuses: fromChainUnits rounds down, to whole gwei for 18-place assets.
 */
import type { CoinAmount } from './CoinAmount';
import type { Coin } from '$lib/sendswap/utils/sendOptions';

/**
 * The integer a contract takes, as decimal digits (never exponent form). For
 * 18-place assets the number is rounded to the nearest 10^(decimals - 9)
 * (whole gwei for ETH): a typed "1234.5" is the double 1234.49999999999986..e18
 * and comes back as exactly 1234500000000000000000. Amounts with sub-gwei
 * digits round to the nearest gwei; "max" amounts are whole gwei already.
 */
export function toChainUnits(amount: CoinAmount<Coin>): string {
	const n = amount.amount;
	if (!Number.isFinite(n) || n < 0) throw new Error(`invalid amount ${n} ${amount.coin.unit}`);
	const v = BigInt(Math.trunc(n));
	const step = 10n ** BigInt(Math.max(0, amount.coin.decimalPlaces - 9));
	if (step === 1n) return v.toString();
	return (((v + step / 2n) / step) * step).toString();
}

/**
 * Smallest units as a number that never exceeds the chain value: rounded
 * down to 10^(decimals - 9) (whole gwei for ETH; exact for 9 places or fewer).
 */
export function fromChainUnits(raw: string | bigint | null | undefined, coin: Coin): number {
	if (raw == null || raw === '') return 0;
	let v: bigint;
	try {
		v = typeof raw === 'bigint' ? raw : BigInt(raw);
	} catch {
		return 0;
	}
	if (v <= 0n) return 0;
	const step = 10n ** BigInt(Math.max(0, coin.decimalPlaces - 9));
	let floored = (v / step) * step;
	let n = Number(floored);
	// Number() rounds to the nearest double; step down until it is <= v.
	while (n > 0 && BigInt(n) > v) {
		floored -= step;
		n = Number(floored);
	}
	return n;
}
