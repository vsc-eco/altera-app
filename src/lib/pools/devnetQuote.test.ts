// Entry point for the go-vsc-node fee-rule user-flow devnet test
// (tests/devnet/pendulum_slip_parity_userflow_devnet_test.go). Skipped in the normal suite.
// QUOTE_REQ: JSON request, QUOTE_RES: path for the JSON answer. Runs Altera's
// own calculateSwap / calculateTwoHopSwap / swapFeeExceedsGuard.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import {
	calculateSwap,
	calculateTwoHopSwap,
	swapFeeExceedsGuard,
	type SlipFeeRule,
	type TypedPoolDepths
} from './swapCalc';

type Pool = { asset0: string; asset1: string; reserve0: string; reserve1: string };
type Req = {
	kind: 'single' | 'two';
	x: string;
	X?: string;
	Y?: string;
	pool1?: Pool;
	pool2?: Pool;
	assetIn?: string;
	hop?: string;
	assetOut?: string;
	slippageBps: number;
	rule: SlipFeeRule;
};

const typed = (p: Pool): TypedPoolDepths => ({
	contractId: '',
	asset0: p.asset0,
	asset1: p.asset1,
	reserve0: BigInt(p.reserve0),
	reserve1: BigInt(p.reserve1)
});

it.skipIf(!process.env.QUOTE_REQ)('devnet quote', () => {
	const req = JSON.parse(process.env.QUOTE_REQ as string) as Req;
	const r =
		req.kind === 'single'
			? calculateSwap(BigInt(req.x), BigInt(req.X!), BigInt(req.Y!), req.slippageBps, req.rule)
			: calculateTwoHopSwap(
					BigInt(req.x),
					typed(req.pool1!),
					typed(req.pool2!),
					req.assetIn!,
					req.hop!,
					req.assetOut!,
					req.slippageBps,
					req.rule
				);
	writeFileSync(
		process.env.QUOTE_RES as string,
		JSON.stringify({
			expectedOutput: r.expectedOutput.toString(),
			minAmountOut: r.minAmountOut.toString(),
			totalFee: r.totalFee.toString(),
			feeBps: r.feeBps,
			guardBlocks: swapFeeExceedsGuard(r.feeBps, req.rule)
		})
	);
});
