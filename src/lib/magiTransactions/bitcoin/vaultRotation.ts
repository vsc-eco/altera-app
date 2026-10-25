/**
 * Detect whether the BTC-mapping contract's vault is mid-rotation, so the UI can
 * warn that a withdrawal may take much longer than usual.
 *
 * The bridge custodies deposited BTC in a TSS-controlled vault. To rotate the
 * signing key it mints a new "generation" vault, cuts over to it (`activateKey`),
 * then sweeps every UTXO from the old vault to the new one on Bitcoin L1
 * (`migrateVault`), tranche by tranche. Each sweep has to confirm on-chain, so a
 * full rotation can take ~an hour. While it runs, withdrawals (`unmap`) may draw
 * from a draining generation and settle slowly — hence the user-facing notice.
 *
 * Rotation never touches the token ledger: user balances are keyed by account
 * (`a/<acc>`), supply is conserved (Σ(UTXO) == ActiveSupply + FeeSupply, the
 * sweep fee comes out of the fee reserve), and pools/HBD live in other
 * contracts. So this is purely a "withdrawals are slower right now" signal.
 *
 * State lives in the contract's merkle tree, read with the same `getStateByKeys`
 * the pool views use. On the pre-v2 (single-vault) contract these keys are absent
 * and the decode reports "not rotating" — safe until the v2 migration lands.
 */

import { GetStateByKeysStore } from '$houdini';
import { queryOnce } from '$lib/queryOnce';

/** Vault state keys (btc-mapping-contract/contract/constants/constants.go):
 *  "v"  = packed vault registry (append-only list of generations)
 *  "va" = active generation (4-byte BE), the one receiving new deposits
 *  "msl" = packed list of in-flight migration-sweep txids */
export const VAULT_STATE_KEYS = ['v', 'va', 'msl'] as const;

/** One vault registry entry is a fixed 91-byte big-endian record. We only decode
 *  the two fields this signal needs; see the layout in the contract's types.go. */
const VAULT_ENTRY_SIZE = 91;
const GEN_OFFSET = 0; // [0:4]  generation number (uint32 BE)
const STATUS_OFFSET = 70; // [70]   lifecycle status byte

/** Lifecycle of a vault generation (types.go VaultStatus). A generation that has
 *  been superseded but still holds funds is RETIRING, then DRAINING as its UTXOs
 *  are swept to the successor — that is the window the sweeps run in. */
export enum VaultStatus {
	Pending = 0,
	Active = 1,
	Retiring = 2,
	Draining = 3,
	Inactive = 4,
	Purged = 5
}

export type VaultGeneration = { gen: number; status: VaultStatus };

export type VaultRotationStatus = {
	/** A superseded generation still holds funds (RETIRING/DRAINING): a rotation
	 *  is underway and withdrawals may be slow. The banner trigger. */
	rotating: boolean;
	/** At least one migration sweep is broadcast and awaiting BTC confirmation
	 *  right now — the part of a rotation that actually costs the ~hour. */
	sweeping: boolean;
	/** A new generation has been minted but not yet activated (keygen in flight).
	 *  The live vault is untouched, so this alone is not "slow withdrawals". */
	preparing: boolean;
	activeGen: number | null;
	generations: VaultGeneration[];
};

const NOT_ROTATING: VaultRotationStatus = {
	rotating: false,
	sweeping: false,
	preparing: false,
	activeGen: null,
	generations: []
};

function hexToBytes(hex: string): Uint8Array {
	const clean = hex.length % 2 === 0 ? hex : hex.slice(0, hex.length - 1);
	const out = new Uint8Array(clean.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

function u32be(bytes: Uint8Array, offset: number): number {
	return (
		((bytes[offset] << 24) |
			(bytes[offset + 1] << 16) |
			(bytes[offset + 2] << 8) |
			bytes[offset + 3]) >>>
		0
	);
}

/** Decode the packed "v" registry (hex) into one entry per generation. Tolerant
 *  of a trailing partial record so a schema that grows the entry can't throw. */
export function decodeVaultRegistry(vHex: string | null | undefined): VaultGeneration[] {
	if (!vHex) return [];
	const bytes = hexToBytes(vHex);
	const entries: VaultGeneration[] = [];
	for (let off = 0; off + VAULT_ENTRY_SIZE <= bytes.length; off += VAULT_ENTRY_SIZE) {
		entries.push({
			gen: u32be(bytes, off + GEN_OFFSET),
			status: bytes[off + STATUS_OFFSET] as VaultStatus
		});
	}
	return entries;
}

/**
 * Turn the raw state values into a rotation verdict. Pure, so the byte decoding
 * is unit-tested against a real on-chain blob without a node.
 *
 * `vHex`/`vaHex` are hex ('hex' encoding); `msl` is the raw value the node
 * returns for the sweep-list key (empty string / null when there are none).
 */
export function interpretVaultState(
	vHex: string | null | undefined,
	vaHex: string | null | undefined,
	msl: string | null | undefined
): VaultRotationStatus {
	const generations = decodeVaultRegistry(vHex);
	if (generations.length === 0) return NOT_ROTATING; // pre-v2 single-vault contract
	const rotating = generations.some(
		(g) => g.status === VaultStatus.Retiring || g.status === VaultStatus.Draining
	);
	const preparing = generations.some((g) => g.status === VaultStatus.Pending);
	// msl comes back as a packed txid list; any non-empty value means a sweep is
	// in flight. (Absent key → null; empty list → "".)
	const sweeping = typeof msl === 'string' && msl.length > 0;
	const activeGen = vaHex && vaHex.length >= 8 ? u32be(hexToBytes(vaHex), 0) : null;
	return { rotating, sweeping, preparing, activeGen, generations };
}

/**
 * Read the BTC-mapping contract's vault state and report whether it is rotating.
 * Fail-safe: any node/query error resolves to "not rotating" so a transient read
 * failure never blocks or alarms a withdrawal. Pass the active-network
 * `BTC_MAPPING_CONTRACT_ID` from `$lib/constants`.
 */
export async function fetchVaultRotationStatus(
	contractId: string
): Promise<VaultRotationStatus> {
	try {
		const res = await queryOnce(new GetStateByKeysStore(), {
			variables: { contractId, keys: [...VAULT_STATE_KEYS], encoding: 'hex' },
			policy: 'NetworkOnly'
		});
		const state = (res.data?.getStateByKeys ?? {}) as Record<string, string | null>;
		return interpretVaultState(state['v'], state['va'], state['msl']);
	} catch {
		return NOT_ROTATING;
	}
}
