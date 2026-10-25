import { describe, expect, it, vi } from 'vitest';

// vaultRotation imports the houdini store for the async fetch; the pure decode
// helpers under test never touch it.
vi.mock('$houdini', () => ({ GetStateByKeysStore: class {} }));

import {
	decodeVaultRegistry,
	interpretVaultState,
	VaultStatus
} from './vaultRotation';

/** Build one 91-byte vault registry entry (hex): gen in [0:4] BE, status at
 *  byte 70, everything else zero. Mirrors the contract's packed layout. */
function mkEntry(gen: number, status: VaultStatus): string {
	const b = new Uint8Array(91);
	b[0] = (gen >>> 24) & 0xff;
	b[1] = (gen >>> 16) & 0xff;
	b[2] = (gen >>> 8) & 0xff;
	b[3] = gen & 0xff;
	b[70] = status;
	return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function genBE(n: number): string {
	return n.toString(16).padStart(8, '0');
}

// Real "v" blob read from the testnet BTC-mapping contract
// (vsc1BkWohDf5fPcwn7V9B9ar6TyiWc3A2ZGJ4t) on 2026-10-25: nine generations,
// gen 9 ACTIVE, gen 8 INACTIVE, the rest PURGED — a rotation that has finished.
const TESTNET_V =
	'0000000002a1df7d65f767bc261aabd76903945309857c5483ab77c6d01d4f05fcc57da3ac0242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f005000000000000000000000000004e408b004eb5750000000102b1d5174eb3e669c293f67df5c82eac349086f4bf79ccd77c7860cafad7f756550242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00500000000004e4087004e408b004eb575004eb59400000002035542fd97d1a5f4fac5a6dcd9cc3be1ed28dbe63ab47c642f2f37a425dcb9cc210242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00500000001004eb575004eb575004f4671004f492c0000000302e1ac51d7222f771e885a26645aa32694fe98c93349c71ce01d1ab909f12355970242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00500000002004edb56004f4671004f492d004f4c0b00000004033851ef23d9bf7c8e58be9b5b1a2fcf8b84fd0a05a292de5228a3be467ad4edd90242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00500000003004f492d004f492d004f4b6c004f4ca2000000060246ccbdcce383c5536e7f06a19909b377c198d3a49ae3b9f5292f66e5f5b907d10242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00500000004004f4b13004f4b6c004f4df2004f4e0c000000070263a0307258af0934ed47dc6c23a301ae9bb048d9738a8e25d1032a584274e6280242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00500000006004f4d8b004f4df2004f4f4c004f4fb700000008037d86a55e646c546dc3192561026c88dc7521a1978ae572828801069af327996f0242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00400000007004f4f49004f4f4c004f511d004f5125000000090364f12d8c5722b1d0b9303207f740079766f7d5390721e9c52654612967746f200242f9da15eae56fe6aca65136738905c0afdb2c4edf379e107b3b00b98c7fc9f00100000008004f5061004f511d0000000000000000';

describe('decodeVaultRegistry', () => {
	it('decodes the real testnet registry into one entry per generation', () => {
		const gens = decodeVaultRegistry(TESTNET_V);
		expect(gens.map((g) => g.gen)).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9]);
		// status byte offset is validated by these matching the live decode
		expect(gens[8]).toEqual({ gen: 9, status: VaultStatus.Active });
		expect(gens[7]).toEqual({ gen: 8, status: VaultStatus.Inactive });
		expect(gens[0].status).toBe(VaultStatus.Purged);
	});

	it('returns [] for absent/empty state (pre-v2 single-vault contract)', () => {
		expect(decodeVaultRegistry(null)).toEqual([]);
		expect(decodeVaultRegistry(undefined)).toEqual([]);
		expect(decodeVaultRegistry('')).toEqual([]);
	});

	it('ignores a trailing partial record rather than throwing', () => {
		expect(decodeVaultRegistry(mkEntry(0, VaultStatus.Active) + 'deadbeef')).toHaveLength(1);
	});
});

describe('interpretVaultState', () => {
	it('reports NOT rotating for the finished testnet rotation', () => {
		const s = interpretVaultState(TESTNET_V, genBE(9), '');
		expect(s.rotating).toBe(false);
		expect(s.sweeping).toBe(false);
		expect(s.preparing).toBe(false);
		expect(s.activeGen).toBe(9);
	});

	it('reports rotating when a superseded generation is RETIRING', () => {
		const v = mkEntry(0, VaultStatus.Retiring) + mkEntry(1, VaultStatus.Active);
		expect(interpretVaultState(v, genBE(1), '').rotating).toBe(true);
	});

	it('reports rotating when a generation is DRAINING', () => {
		const v = mkEntry(1, VaultStatus.Draining) + mkEntry(2, VaultStatus.Active);
		expect(interpretVaultState(v, genBE(2), '').rotating).toBe(true);
	});

	it('flags preparing (not rotating) for a PENDING keygen before cutover', () => {
		const v = mkEntry(0, VaultStatus.Active) + mkEntry(1, VaultStatus.Pending);
		const s = interpretVaultState(v, genBE(0), '');
		expect(s.preparing).toBe(true);
		expect(s.rotating).toBe(false);
	});

	it('flags sweeping only when the migration-sweep list is non-empty', () => {
		const v = mkEntry(0, VaultStatus.Draining) + mkEntry(1, VaultStatus.Active);
		expect(interpretVaultState(v, genBE(1), 'aa01').sweeping).toBe(true);
		expect(interpretVaultState(v, genBE(1), '').sweeping).toBe(false);
		expect(interpretVaultState(v, genBE(1), null).sweeping).toBe(false);
	});

	it('treats absent vault state (pre-v2) as not rotating', () => {
		expect(interpretVaultState(null, null, null)).toMatchObject({
			rotating: false,
			sweeping: false,
			preparing: false,
			activeGen: null,
			generations: []
		});
	});
});
