import { describe, expect, it } from 'vitest';
import { CoinAmount } from '../src/currency/CoinAmount.js';
import { getHiveDepositOp, getHiveSwapOp, referralQualifies } from '../src/ops/swap.js';
import { MAINNET_CONFIG } from '../src/types/index.js';

/**
 * These tests lock the emitted custom_json JSON against the shape that
 * Altera produces today. If the SDK output drifts from Altera, the DEX
 * router will reject it or ignore fields, so exact byte-compat matters.
 */

describe('getHiveDepositOp', () => {
	it('builds a transfer op with the gateway account and correct memo', () => {
		const op = getHiveDepositOp({
			from: 'vaultec',
			toDid: 'hive:vaultec',
			amount: CoinAmount.fromDecimal('1', 'HIVE'),
			config: MAINNET_CONFIG
		});
		expect(op[0]).toBe('transfer');
		expect(op[1].from).toBe('vaultec');
		expect(op[1].to).toBe('vsc.gateway');
		expect(op[1].amount).toBe('1.000 HIVE');
		expect(op[1].memo).toBe('to=vaultec');
	});

	it('routes HBD through the HBD asset name', () => {
		const op = getHiveDepositOp({
			from: 'lordbutterfly',
			toDid: 'hive:lordbutterfly',
			amount: CoinAmount.fromDecimal('10.5', 'HBD'),
			config: MAINNET_CONFIG
		});
		expect(op[1].amount).toBe('10.500 HBD');
	});

	it('respects testnet asset name overrides', () => {
		const testnetConfig = { ...MAINNET_CONFIG, hiveAssetName: 'TESTS', hbdAssetName: 'TBD' };
		const op = getHiveDepositOp({
			from: 'tester',
			toDid: 'hive:tester',
			amount: CoinAmount.fromDecimal('1', 'HIVE'),
			config: testnetConfig
		});
		expect(op[1].amount).toBe('1.000 TESTS');
	});
});

describe('getHiveSwapOp', () => {
	it('builds an HBD → BTC swap matching the Altera wire format', () => {
		const op = getHiveSwapOp({
			username: 'vaultec',
			amountIn: CoinAmount.fromDecimal('100', 'HBD'),
			assetIn: 'HBD',
			assetOut: 'BTC',
			minAmountOut: 92_000n,
			config: MAINNET_CONFIG
		});
		expect(op[0]).toBe('custom_json');
		expect(op[1].id).toBe('vsc.call');
		expect(op[1].required_auths).toEqual(['vaultec']);
		expect(op[1].required_posting_auths).toEqual([]);

		const outer = JSON.parse(op[1].json);
		expect(outer.net_id).toBe('vsc-mainnet');
		expect(outer.caller).toBe('hive:vaultec');
		expect(outer.contract_id).toBe(MAINNET_CONFIG.dexRouterContractId);
		expect(outer.action).toBe('execute');
		expect(outer.rc_limit).toBe(2_000);

		// transfer.allow intent for native (HBD) input
		expect(outer.intents).toEqual([
			{ type: 'transfer.allow', args: { limit: '100.000', token: 'hbd' } }
		]);

		const inner = JSON.parse(outer.payload);
		expect(inner.type).toBe('swap');
		expect(inner.version).toBe('1.0.0');
		expect(inner.asset_in).toBe('HBD');
		expect(inner.asset_out).toBe('BTC');
		expect(inner.amount_in).toBe('100000');
		expect(inner.min_amount_out).toBe('92000');
		expect(inner.recipient).toBe('hive:vaultec');
		expect(inner.destination_chain).toBeUndefined();
		expect(inner.beneficiary).toBeUndefined();
	});

	it('sets destination_chain + recipient on a mainnet-settled HIVE → BTC', () => {
		const op = getHiveSwapOp({
			username: 'lordbutterfly',
			amountIn: CoinAmount.fromDecimal('30', 'HIVE'),
			assetIn: 'HIVE',
			assetOut: 'BTC',
			minAmountOut: 2355n,
			destinationChain: 'BTC',
			destinationRecipient: 'bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss',
			config: MAINNET_CONFIG
		});
		const outer = JSON.parse(op[1].json);
		expect(outer.rc_limit).toBe(10_000);
		const inner = JSON.parse(outer.payload);
		expect(inner.destination_chain).toBe('BTC');
		expect(inner.recipient).toBe('bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss');
		expect(outer.intents[0].args.token).toBe('hive');
	});

	it('emits empty intents for BTC input (caller must emit approve op separately)', () => {
		const op = getHiveSwapOp({
			username: 'vaultec',
			amountIn: CoinAmount.fromDecimal('0.001', 'BTC'),
			assetIn: 'BTC',
			assetOut: 'HBD',
			minAmountOut: 83_458n,
			config: MAINNET_CONFIG
		});
		const outer = JSON.parse(op[1].json);
		expect(outer.intents).toEqual([]);
	});

	it('injects referral fee and scales minAmountOut when qualifying', () => {
		const referralConfig = {
			...MAINNET_CONFIG,
			referral: { beneficiary: 'hive:altera.app', bps: 25 }
		};
		const op = getHiveSwapOp({
			username: 'lordbutterfly',
			amountIn: CoinAmount.fromDecimal('30', 'HIVE'),
			assetIn: 'HIVE',
			assetOut: 'BTC',
			minAmountOut: 4000n,
			destinationChain: 'BTC',
			destinationRecipient: 'bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss',
			config: referralConfig,
			referralQualifies: true
		});
		const outer = JSON.parse(op[1].json);
		const inner = JSON.parse(outer.payload);
		expect(inner.beneficiary).toBe('hive:altera.app');
		expect(inner.ref_bps).toBe(25);
		// min scales down by 25 bps: 4000 * 9975 / 10000 = 3990
		expect(inner.min_amount_out).toBe('3990');
	});

	it('omits referral fields when not qualifying even if referral is configured', () => {
		const referralConfig = {
			...MAINNET_CONFIG,
			referral: { beneficiary: 'hive:altera.app', bps: 25 }
		};
		const op = getHiveSwapOp({
			username: 'lordbutterfly',
			amountIn: CoinAmount.fromDecimal('100', 'HBD'),
			assetIn: 'HBD',
			assetOut: 'HIVE', // HIVE output → not outbound mainnet → no referral
			minAmountOut: 1000n,
			destinationChain: 'HIVE',
			config: referralConfig,
			referralQualifies: false
		});
		const outer = JSON.parse(op[1].json);
		const inner = JSON.parse(outer.payload);
		expect(inner.beneficiary).toBeUndefined();
		expect(inner.ref_bps).toBeUndefined();
		expect(inner.min_amount_out).toBe('1000');
	});
});

describe('referralQualifies', () => {
	const ref = { beneficiary: 'hive:altera.app', bps: 25 };

	it('requires a destination_chain', () => {
		expect(
			referralQualifies({ assetOut: 'BTC', destinationChain: undefined, inputUsd: 500, referral: ref })
		).toBe(false);
	});

	it('excludes HIVE/HBD outputs', () => {
		expect(
			referralQualifies({ assetOut: 'HIVE', destinationChain: 'HIVE', inputUsd: 500, referral: ref })
		).toBe(false);
		expect(
			referralQualifies({ assetOut: 'HBD', destinationChain: 'HIVE', inputUsd: 500, referral: ref })
		).toBe(false);
	});

	it('qualifies a mainnet BTC-out swap regardless of input amount when threshold=0', () => {
		expect(
			referralQualifies({ assetOut: 'BTC', destinationChain: 'BTC', inputUsd: 1, referral: ref })
		).toBe(true);
	});

	it('respects usdThreshold when set', () => {
		const refWithThreshold = { ...ref, usdThreshold: 100 };
		expect(
			referralQualifies({
				assetOut: 'BTC',
				destinationChain: 'BTC',
				inputUsd: 50,
				referral: refWithThreshold
			})
		).toBe(false);
		expect(
			referralQualifies({
				assetOut: 'BTC',
				destinationChain: 'BTC',
				inputUsd: 100,
				referral: refWithThreshold
			})
		).toBe(true);
	});

	it('returns false when referral is null', () => {
		expect(
			referralQualifies({ assetOut: 'BTC', destinationChain: 'BTC', inputUsd: 500, referral: null })
		).toBe(false);
	});
});
