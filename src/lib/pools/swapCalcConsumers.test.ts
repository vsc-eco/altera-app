/**
 * Drift guard for the swap-math single source of truth.
 *
 * The pendulum stabilizer fix (2026-06-06) bakes a worst-case m=2.0
 * multiplier into `calculateSwap` / `calculateTwoHopSwap` in
 * `src/lib/pools/swapCalc.ts`. Every UI that quotes a swap to users
 * MUST route through that file — otherwise the floor guarantee
 * (user receives ≥ quoted) silently breaks for that UI.
 *
 * This test asserts the known consumers (today: the /swap page and
 * the dashboard QuickSwap card) still:
 *   1. import from `$lib/pools/swapCalc`
 *   2. actually call `calculateSwap` (or `calculateTwoHopSwap`) at least once
 *   3. do NOT redefine `calculateSwap` locally
 *
 * If a new file starts computing swap fees, add it to KNOWN_CONSUMERS
 * — the act of editing this list is itself the review prompt.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const KNOWN_CONSUMERS = [
	'src/lib/cards/QuickSwap.svelte',
	'src/lib/sendswap/stages/SwapOptions.svelte'
];

describe('swap math drift guard — consumers must route through swapCalc.ts', () => {
	for (const rel of KNOWN_CONSUMERS) {
		describe(rel, () => {
			const abs = resolve(process.cwd(), rel);
			const src = readFileSync(abs, 'utf-8');

			it('imports from $lib/pools/swapCalc', () => {
				expect(src).toMatch(/from\s+['"]\$lib\/pools\/swapCalc['"]/);
			});

			it('imports calculateSwap or calculateTwoHopSwap by name', () => {
				// Loose: either symbol satisfies. SwapOptions uses both; QuickSwap uses both.
				expect(src).toMatch(/\bcalculateSwap\b|\bcalculateTwoHopSwap\b/);
			});

			it('actually calls one of the math functions (not just imports it)', () => {
				// A call-site, distinguished from a bare reference / import line.
				expect(src).toMatch(/\b(calculateSwap|calculateTwoHopSwap)\s*\(/);
			});

			it('does NOT redefine calculateSwap locally', () => {
				// Catches the copy-paste regression: someone inlines the math here
				// and forgets the worst-case stabilizer multiplier.
				expect(src).not.toMatch(/function\s+calculateSwap\s*\(/);
				expect(src).not.toMatch(/const\s+calculateSwap\s*=\s*\(/);
			});

			it('does NOT redefine calculateTwoHopSwap locally', () => {
				expect(src).not.toMatch(/function\s+calculateTwoHopSwap\s*\(/);
				expect(src).not.toMatch(/const\s+calculateTwoHopSwap\s*=\s*\(/);
			});
		});
	}
});
