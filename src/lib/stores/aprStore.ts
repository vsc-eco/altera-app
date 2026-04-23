import { readable } from 'svelte/store';
import { browser } from '$app/environment';
import { DHive } from '$lib/magiTransactions/dhive';

/**
 * Fetch the current HBD savings interest rate from the Hive blockchain.
 *
 * `hbd_interest_rate` in dynamic global properties is stored in basis points
 * (e.g. 1200 = 12%). We convert to a whole-number percentage integer.
 *
 * Falls back to 12 if the node is unreachable.
 */
async function fetchHbdApr(): Promise<number> {
	try {
		const props = await DHive.database.getDynamicGlobalProperties();
		const bps = (props as unknown as { hbd_interest_rate?: number }).hbd_interest_rate;
		if (typeof bps === 'number' && bps > 0) {
			return Math.round(bps / 100);
		}
	} catch {
		// Node unreachable — fall through
	}
	return 12;
}

// Lazy singleton — one fetch per page load, shared across all subscribers.
let _cached: Promise<number> | null = null;

/**
 * Readable store that resolves to the current sHBD staking APR (whole-number
 * percentage, e.g. 12). Starts as `null` while the fetch is in flight.
 *
 * Source: Hive blockchain `hbd_interest_rate` via dhive (same rate that Hive
 * HBD savings pays — sHBD mirrors this yield).
 */
export const sHbdAprStore = readable<number | null>(null, (set) => {
	if (!browser) return;
	if (!_cached) {
		_cached = fetchHbdApr();
	}
	_cached.then(set).catch(() => set(12));
});
