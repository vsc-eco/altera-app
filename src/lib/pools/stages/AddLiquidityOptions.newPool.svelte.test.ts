/**
 * Add Liquidity on a brand-new pool whose custom token has no price yet
 * (STARPRO/HBD, first deposit). The form mirrors the second amount from the
 * two coins' USD prices when a pool is empty, but a custom token only gets a
 * price from its own pool's reserves. With no price the form reset the other
 * side to 0 on every keystroke, so Continue never enabled and the first LP
 * could not seed the pool. Now both amounts stay as typed: that first deposit
 * sets the starting price. Pools with reserves, and empty pools where both
 * sides have a price, still mirror as before.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import type { PoolRow } from '$lib/pools/poolsData';
import { liquidityDraftStore, resetLiquidityDraft } from '$lib/pools/liquidityStore';
import { accountBalance, getDefaultBalance } from '$lib/stores/currentBalance';
import { customTokenBalances } from '$lib/tokens/customTokenBalances';

const { STARPRO } = vi.hoisted(() => ({
	STARPRO: {
		symbol: 'starpro',
		label: 'STARPRO',
		name: 'STARPRO',
		decimals: 5,
		contractId: 'vsc1Bfaa2m3GHWL1baZ9AdDjgXQr2MHXMvoTgA',
		poolContractId: 'vsc1BirUSGK2jm1zDQgVmuUysJ8UFKnTrnGXQf',
		routerRegistered: true
	}
}));

// No signed-in DID, so the form doesn't fetch token balances; they're set below.
vi.mock('$lib/auth/store', () => ({
	getAuth: () => () => ({ status: 'none', value: undefined })
}));
// USD readouts under the inputs are not under test: no price feed here.
vi.mock('$lib/currency/convert', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/currency/convert')>()),
	getExchangeRates: async () => null
}));
vi.mock('$lib/tokens/customTokens', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/tokens/customTokens')>()),
	fetchPoolTokens: async () => [STARPRO]
}));

const { default: AddLiquidityOptions } = await import('./AddLiquidityOptions.svelte');

function poolRow(over: Partial<PoolRow>): PoolRow {
	return {
		id: STARPRO.poolContractId,
		contractId: STARPRO.poolContractId,
		pair: 'HBD:STARPRO',
		pairSymbols: ['HBD', 'STARPRO'],
		priceRatio: '-',
		priceInverse: '-',
		priceUsd: ['$1.00', '$0.00'],
		totalLiquidityUsd: '$0.00',
		totalLiquidityAssets: ['0', '0'],
		feeEarnedUsd: '$0.00',
		feeEarnedAssets: ['0', '0'],
		feeEarnedUsdBreakdown: ['$0.00', '$0.00'],
		volumeUsd: '$0.00',
		volumeAssets: ['0', '0'],
		reserve0Raw: 0,
		reserve1Raw: 0,
		totalLpRaw: 0,
		decimals0: 3,
		decimals1: 5,
		usdPrice0: 1,
		// Empty pool: the custom token has no feed price and no reserves to
		// derive one from (poolsData only derives it when both reserves > 0).
		usdPrice1: 0,
		routerRegistered: true,
		...over
	};
}

async function mount(pool: PoolRow) {
	liquidityDraftStore.update((d) => ({ ...d, selectedPool: pool }));
	const editStage = vi.fn();
	const { container } = render(AddLiquidityOptions, { editStage, pools: [pool] });
	// Two amount inputs: slot 0 then slot 1, in pool pair order.
	await waitFor(() => expect(container.querySelectorAll('input').length).toBeGreaterThanOrEqual(2));
	const inputs = [...container.querySelectorAll('input')].filter(
		(i) => i.getAttribute('placeholder') === '0'
	);
	expect(inputs).toHaveLength(2);
	return { editStage, input0: inputs[0], input1: inputs[1] };
}

// Zag's number input only takes typed text while focused, as in a browser.
async function type(input: HTMLInputElement, value: string) {
	input.focus();
	await fireEvent.input(input, { target: { value } });
	input.blur();
}

const draft = () => get(liquidityDraftStore);

beforeEach(() => {
	resetLiquidityDraft();
	accountBalance.set({
		bal: { ...getDefaultBalance(), hbd: 1_000_000, hive: 1_000_000 },
		connectedBal: undefined,
		loading: false
	});
	customTokenBalances.set({ bal: { starpro: 1_000_000_000 }, loading: false, did: null });
});

describe('Add Liquidity on an empty pool whose token has no price', () => {
	it('keeps both typed amounts (HBD first) and enables Continue', async () => {
		const { editStage, input0, input1 } = await mount(poolRow({}));
		await type(input0, '1');
		await type(input1, '100');
		await waitFor(() => {
			expect(draft().amount0Ca.toAmountString()).toBe('1');
			expect(draft().amount1Ca.toAmountString()).toBe('100');
		});
		expect(editStage).toHaveBeenLastCalledWith(true);
	});

	it('keeps both typed amounts (token first) and enables Continue', async () => {
		const { editStage, input0, input1 } = await mount(poolRow({}));
		await type(input1, '100');
		await type(input0, '1');
		await waitFor(() => {
			expect(draft().amount0Ca.toAmountString()).toBe('1');
			expect(draft().amount1Ca.toAmountString()).toBe('100');
		});
		expect(editStage).toHaveBeenLastCalledWith(true);
	});
});

describe('Add Liquidity mirroring that must not change', () => {
	it('empty pool with a price on both sides still mirrors from USD prices', async () => {
		const { input0 } = await mount(
			poolRow({ usdPrice0: 1, usdPrice1: 0.01 }) // 1 HBD = 100 STARPRO
		);
		await type(input0, '2');
		await waitFor(() => expect(draft().amount1Ca.toAmountString()).toBe('200'));
	});

	it('pool with reserves still mirrors from the reserves', async () => {
		const { input0, input1 } = await mount(
			// 100.000 HBD / 10,000.00000 STARPRO = 100 STARPRO per HBD
			poolRow({ reserve0Raw: 100_000, reserve1Raw: 1_000_000_000, usdPrice1: 0.01 })
		);
		await type(input0, '3');
		await waitFor(() => expect(draft().amount1Ca.toAmountString()).toBe('300'));
		await type(input1, '50');
		await waitFor(() => expect(draft().amount0Ca.toAmountString()).toBe('0.5'));
	});
});
