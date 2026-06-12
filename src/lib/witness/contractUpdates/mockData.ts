/**
 * ⚠️ MOCK DATA — see `types.ts` for the spec. Live data lands when
 * go-vsc-node PR #210 ships `findPendingContractUpdates`.
 *
 * Replacement path (once PR #210 is on api.vsc.eco):
 *   - Replace `MOCK_PENDING_UPDATES` with the result of
 *     `FindPendingContractUpdatesStore` (already staged at
 *     `FindPendingContractUpdates.gql`).
 *   - Keep `CONTRACT_REGISTRY` — chain has no name/category, so a
 *     curated client-side registry stays. Move it to its own file
 *     (or a tiny JSON the witness team can PR against) when it grows.
 *
 * Contract ids in this fixture mirror real ones returned by
 * `findContract` on production today so they look familiar in review.
 */
import type { ContractMetadata, ContractUpdateView, PendingContractUpdate } from './types';

const NOW_MS = Date.now();
const HOUR_MS = 60 * 60 * 1000;

function isoFromNow(deltaMs: number): string {
	// Match Contract.creation_ts / activation_ts format observed on prod:
	// "2026-06-02T23:23:33" (no Z suffix). toISOString gives Z; we strip
	// it to mirror exactly.
	return new Date(NOW_MS + deltaMs).toISOString().replace(/\.\d{3}Z$/, '');
}

/**
 * Curated metadata for contracts the witness page recognizes. Keys are
 * contract ids. Anything not in the registry falls back to a short id
 * preview and the `other` category.
 */
export const CONTRACT_REGISTRY: Record<string, ContractMetadata> = {
	vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp: {
		name: 'Pool: HIVE / HBD',
		category: 'pool',
		description: 'Liquidity pool for HIVE ↔ HBD swaps.'
	},
	vsc1BVb95YKRHAEy24XgRSaW4L6d9vB88AdwjM: {
		name: 'Pool: BTC / HBD',
		category: 'pool',
		description: 'Liquidity pool for BTC ↔ HBD swaps.'
	},
	vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45: {
		name: 'DEX router',
		category: 'gateway',
		description: 'Routes swap requests across registered pools.'
	},
	vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d: {
		name: 'Bridge: BTC mapping',
		category: 'bridge',
		description: 'Maps BTC deposits into the Magi UTXO contract.'
	}
};

/** Mock pending updates — matches the real `PendingContractUpdate` shape. */
export const MOCK_PENDING_UPDATES: PendingContractUpdate[] = [
	{
		id: 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp',
		code: 'bafkreibrlaku3dmnexnxz4lbplkotf52mwnwie3tro73jn7wxhwkagi_NEWCID',
		proposer: 'vaultec',
		owner: 'hive:vsc.dao',
		creation_height: 107_000_000,
		activation_height: 107_172_800, // ~48h of Hive blocks (3s × 57.6k = 172.8k)
		activation_ts: isoFromNow(46 * HOUR_MS)
	},
	{
		id: 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d',
		code: 'bafkreidr2ylwc7r4jilauhmrjrzgpoahfk76pxdgivqxiwvk5tduwes_NEWCID',
		proposer: 'theycallmedan',
		owner: 'hive:vsc.dao',
		creation_height: 107_010_000,
		activation_height: 107_182_800,
		activation_ts: isoFromNow(12 * HOUR_MS)
	}
];

/** Mock "previous" code CIDs (what's on chain today). For real data this
 *  comes from a `findContract(byId)` lookup. */
const MOCK_PREVIOUS_CODE: Record<string, string> = {
	vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp:
		'bafkreibrlaku3dmnexnxz4lbplkotf52mwnwie3tro73jn7wxhwkagie5m',
	vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d:
		'bafkreidr2ylwc7r4jilauhmrjrzgpoahfk76pxdgivqxiwvk5tduwespce'
};

/** Build a display view from a raw update by joining metadata + previous code. */
export function buildView(update: PendingContractUpdate): ContractUpdateView {
	return {
		...update,
		metadata: CONTRACT_REGISTRY[update.id],
		previousCode: MOCK_PREVIOUS_CODE[update.id]
	};
}

export function getMockPendingViews(): ContractUpdateView[] {
	return MOCK_PENDING_UPDATES.map(buildView);
}

export function getMockUpdateView(id: string): ContractUpdateView | undefined {
	const u = MOCK_PENDING_UPDATES.find((x) => x.id === id);
	return u ? buildView(u) : undefined;
}
