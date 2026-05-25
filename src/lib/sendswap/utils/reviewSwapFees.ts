import { Coin, Network } from '$lib/sendswap/utils/sendOptions';

export type LightningWithdrawFlowParams = {
	kind?: string;
	fromNetwork?: string;
	toNetwork?: string;
	fromCoin?: string;
	toCoin?: string;
};

export function isLightningWithdrawFlow(params: LightningWithdrawFlowParams): boolean {
	return (
		params.kind === 'withdraw' &&
		params.fromNetwork === Network.magi.value &&
		params.toNetwork === Network.lightning.value &&
		(params.fromCoin === Coin.btc.value || params.fromCoin === Coin.sats.value) &&
		(params.toCoin === Coin.btc.value || params.toCoin === Coin.sats.value)
	);
}

export type NetToAmountParams = {
	rawToAmount: number;
	alteraFeeAmount?: number;
	gatewayFeeAmount?: number;
	isLightningWithdraw: boolean;
	gatewayFeeCoinMatchesToCoin: boolean;
};

export function computeNetToAmountSmallest(params: NetToAmountParams): number {
	const gatewayFee =
		params.isLightningWithdraw && params.gatewayFeeCoinMatchesToCoin
			? (params.gatewayFeeAmount ?? 0)
			: 0;
	const alteraFee = params.alteraFeeAmount ?? 0;
	return Math.max(0, params.rawToAmount - gatewayFee - alteraFee);
}
