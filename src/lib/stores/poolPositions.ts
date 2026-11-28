/**
 * The signed-in account's liquidity positions, shared by the two places on
 * the wallet page that show them: the "Pools" figure beside the wallet total,
 * and the "In pools" card under "In your wallet".
 *
 * It lives in a store rather than in either component because both are on
 * screen at once and the numbers behind them cost a full pool-list read
 * (~5 reads per pool, several seconds on mainnet). One load, two readers.
 *
 * The pool list itself is already cached by `poolsData` — in memory and in
 * localStorage, per network and range — so a reader who has been to /pools
 * gets the card painted at once. `30d` is the range that page defaults to, so
 * these two share its cache entry rather than warming a second one.
 */
import { get, writable } from 'svelte/store';
import {
	cachedPools,
	fetchMyPoolPositions,
	fetchPools,
	type MyPoolRow
} from '$lib/pools/poolsData';
import { lpPortfolioUsd } from '$lib/calc';

export type PoolPositionsState = {
	/** The account `rows` belong to. Undefined until the first load starts. */
	did?: string;
	/** True while the FIRST figures for this account are on their way. A
	 *  refresh behind already-painted rows leaves this false. */
	loading: boolean;
	/** The pool list could not be read. Rows stay empty rather than reading
	 *  as "nothing in pools", which is a different thing entirely. */
	failed: boolean;
	rows: MyPoolRow[];
	totalUsd: number;
};

const EMPTY: PoolPositionsState = { loading: false, failed: false, rows: [], totalUsd: 0 };

export const poolPositions = writable<PoolPositionsState>({ ...EMPTY });

/** The account a load is running for, so two mounted readers asking at the
 *  same moment make one request between them. */
let inFlight: string | undefined;

const RANGE = '30d' as const;

function settle(did: string, rows: MyPoolRow[]) {
	poolPositions.set({
		did,
		loading: false,
		failed: false,
		rows,
		totalUsd: lpPortfolioUsd(rows.map((r) => r.myLiquidityUsdRaw))
	});
}

/**
 * Load this account's positions, unless they are already loaded or loading.
 * Safe to call from every component that needs them, on every mount.
 */
export async function loadPoolPositions(did: string, force = false): Promise<void> {
	if (!did) return;
	const current = get(poolPositions);
	if (!force) {
		if (inFlight === did) return;
		// Already have them, and the last attempt worked.
		if (current.did === did && !current.loading && !current.failed) return;
	}
	inFlight = did;

	// An account switch replaces the rows; a retry for the SAME account keeps
	// them on screen while the new numbers arrive.
	const keep = current.did === did ? current : EMPTY;
	poolPositions.set({
		did,
		loading: keep.rows.length === 0,
		failed: false,
		rows: keep.rows,
		totalUsd: keep.totalUsd
	});

	try {
		// Paint from the pool list the Pools page left behind, if there is one,
		// then correct it with a fresh read. Reserves move, so a cached list
		// can price a position slightly stale; it cannot invent one.
		const cached = cachedPools(RANGE);
		if (cached && cached.length > 0) {
			const rows = await fetchMyPoolPositions(did, cached);
			if (inFlight !== did) return;
			settle(did, rows);
		}

		const pools = await fetchPools(RANGE);
		if (inFlight !== did) return;
		// `fetchPools` answers [] when it could not read the registry. With no
		// pools there is nothing to resolve a position against, so this is a
		// failure, not an empty wallet — unless cached rows are already up.
		if (pools.length === 0) {
			const painted = get(poolPositions);
			if (painted.did === did && painted.rows.length > 0) return;
			poolPositions.set({ did, loading: false, failed: true, rows: [], totalUsd: 0 });
			return;
		}
		const rows = await fetchMyPoolPositions(did, pools);
		if (inFlight !== did) return;
		settle(did, rows);
	} catch {
		if (inFlight !== did) return;
		const painted = get(poolPositions);
		if (painted.did === did && painted.rows.length > 0) {
			poolPositions.set({ ...painted, loading: false });
			return;
		}
		poolPositions.set({ did, loading: false, failed: true, rows: [], totalUsd: 0 });
	} finally {
		if (inFlight === did) inFlight = undefined;
	}
}

/** Drop everything, for a log out or an account switch. */
export function resetPoolPositions(): void {
	inFlight = undefined;
	poolPositions.set({ ...EMPTY });
}
