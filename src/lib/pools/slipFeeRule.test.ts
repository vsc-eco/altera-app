import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * SLIP_FEE_RULE is derived from the viewer's selected network, so one build
 * quotes the final rule on testnet and the safe max() of both rules on mainnet.
 * Those two cases are the whole contract -- swapCalc.test.ts passes `rule`
 * explicitly everywhere else, so nothing there covers the default.
 */
const loadRule = async (testnet: boolean) => {
	vi.resetModules();
	vi.doMock('../../client', () => ({ isVscTestnet: () => testnet }));
	return (await import('./swapCalc')).SLIP_FEE_RULE;
};

afterEach(() => {
	vi.doUnmock('../../client');
	vi.resetModules();
});

describe('SLIP_FEE_RULE', () => {
	it("is 'on' on testnet, the only network with a parity height (go-vsc-node #327)", async () => {
		expect(await loadRule(true)).toBe('on');
	});

	it("is 'both' on mainnet, which still charges the old rule", async () => {
		expect(await loadRule(false)).toBe('both');
	});
});
