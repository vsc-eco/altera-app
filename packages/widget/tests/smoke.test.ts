import { describe, expect, it } from 'vitest';

/**
 * Smoke test — confirms the widget package's public entry can be imported
 * without side-effects that break in a Node environment. Full DOM rendering
 * tests would need jsdom + @testing-library/react; we lean on the core +
 * sdk tests for business logic coverage and keep this pkg UI-only.
 */
describe('@magi/widget entry', () => {
	it('exposes MagiQuickSwap from the main entry', async () => {
		const mod = await import('../src/index.tsx');
		expect(typeof mod.MagiQuickSwap).toBe('function');
		expect(mod.MagiQuickSwap.name).toBe('MagiQuickSwap');
	});
});
