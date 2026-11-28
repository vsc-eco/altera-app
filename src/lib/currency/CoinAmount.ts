import { Coin, type IntermediaryNetwork } from '$lib/sendswap/utils/sendOptions';
import { getExchangeRates } from './convert';
import { getHiveAssetName, getHbdAssetName } from '../../client';
import {
	formatAmountGrouped,
	formatBaseUnits,
	formatMinFigs,
	parseAmountToBaseUnits,
	rescaleBaseUnits,
	toBaseUnits,
	toDisplay
} from '$lib/calc';

export type UnkCoinAmount = CoinAmount<Coin>;

/**
 * `CoinAmount` is the app's handle on an on-chain amount: an integer in the
 * asset's smallest unit, plus the asset. It is deliberately NOT where the
 * arithmetic lives — every method below is a thin call into `$lib/calc`,
 * which holds the one copy of each formula. Keep it that way: a shortcut
 * written here is a formula that has quietly forked.
 */

/** "The user has entered a usable amount" — true iff `s` is finite and > 0. */
export { isValidAmountString, formatUsd, formatUsdCost } from '$lib/calc';

export class CoinAmount<C extends Coin> {
	coin: C;
	amount: number;

	/**
	 * `num` is a display amount unless `preshiftedInt` is set, in which case
	 * it is already in base units. A string is parsed digit by digit and
	 * TRUNCATED at the asset's decimals — see `parseAmountToBaseUnits`.
	 */
	constructor(num: string | number, coin: C, preshiftedInt?: boolean) {
		if (num == '' || Number.isNaN(num)) num = '0';
		let amount: number;
		if (typeof num == 'number') {
			amount = preshiftedInt ? Math.round(num) : toBaseUnits(num, coin.decimalPlaces);
		} else if (preshiftedInt && num.indexOf('.') === -1) {
			amount = Number.parseInt(num);
		} else {
			amount = parseAmountToBaseUnits(num, coin.decimalPlaces);
		}
		this.coin = coin;
		this.amount = amount;
	}

	/**
	 * Same as `toAmountString` but with trailing zeroes
	 */
	toPrettyAmountString() {
		// Fixed places read well up to BTC's 8 (100.000 HBD, 0.00320000 BTC);
		// ETH's 18 printed "0.062270000000000000 ETH", so those drop the zeros.
		return this.toAmountString(this.coin.decimalPlaces <= 8);
	}

	isNegative() {
		return this.amount < 0;
	}

	toAmountString(keepTrailingZeroes?: boolean) {
		return formatBaseUnits(this.amount, this.coin.decimalPlaces, keepTrailingZeroes);
	}
	getDisplayUnit(): string {
		return this.coin.value === Coin.hive.value
			? getHiveAssetName()
			: this.coin.value === Coin.hbd.value
				? getHbdAssetName()
				: this.coin.unit;
	}
	toString() {
		return `${this.toAmountString()} ${this.getDisplayUnit()}`;
	}
	toPrettyString() {
		return `${formatAmountGrouped(this.toNumber(), this.coin.decimalPlaces)} ${this.getDisplayUnit()}`;
	}
	toMinFigs(figures = this.coin.decimalPlaces + 1, decimals = this.coin.decimalPlaces) {
		return formatMinFigs(this.toNumber(), this.coin.decimalPlaces, figures, decimals);
	}
	toPrettyMinFigs(figures = this.coin.decimalPlaces + 1, decimals = this.coin.decimalPlaces) {
		return `${this.toMinFigs(figures, decimals)} ${this.getDisplayUnit()}`;
	}
	toNumber() {
		return toDisplay(this.amount, this.coin.decimalPlaces);
	}
	async convertTo<OtherCoin extends Coin>(
		coin: OtherCoin,
		via: IntermediaryNetwork
	): Promise<CoinAmount<OtherCoin>> {
		// console.log(this.toAmountString(), coin, via);
		// if going either to or from unknown coin then the conversion is 1
		// for all networks
		if (coin.value == Coin.unk.value || this.coin.value == Coin.unk.value)
			return new CoinAmount(this.toAmountString(), coin);
		// don't do any calculations if 0
		if (this.amount === 0) {
			return new CoinAmount(0, coin);
		}
		if (this.coin.value == coin.value) return this as unknown as CoinAmount<OtherCoin>;
		// Custom tokens are priced from their own DEX pool; natives come from the
		// price feed. Either can be unavailable — an empty pool, a failed fetch —
		// in which case yield zero rather than throwing. This runs inside USD
		// readouts and amount-input effects that don't catch, where a rejection
		// surfaced as "Converting from <TOKEN> is unsupported" and left the
		// surrounding component half-initialised. A missing rate used to
		// multiply through as NaN, which is worse still: silently wrong.
		const rates = await getExchangeRates(via, this.coin, coin);
		if (!rates) return new CoinAmount(0, coin);
		const myRate = rates[coin.unit?.toUpperCase() as keyof typeof rates];
		if (typeof myRate !== 'number' || !Number.isFinite(myRate)) {
			return new CoinAmount(0, coin);
		}
		// if (this.coin.value === Coin.sats.value || this.coin.value === Coin.btc.value)
		// 	console.log(
		// 		`converted ${this} to ${coin.unit} with conv rate ${myRate} to`,
		// 		this.toString(),
		// 		this.mulTo(myRate, coin).toString()
		// 	);
		return this.mulTo(myRate, coin);
	}
	add(amount: UnkCoinAmount): CoinAmount<C> {
		return new CoinAmount(this.amount + amount.mulTo(1, this.coin).amount, this.coin, true);
	}
	mul(multip: number): CoinAmount<C> {
		return new CoinAmount(Math.round(this.amount * multip), this.coin, true);
	}
	mulTo<ToCoin extends Coin>(multip: number, into: ToCoin): CoinAmount<ToCoin> {
		return new CoinAmount(
			rescaleBaseUnits(this.amount, multip, this.coin.decimalPlaces, into.decimalPlaces),
			into,
			true
		);
	}
}

declare global {
	// eslint-disable-next-line no-var
	var ca: typeof CoinAmount;
	// eslint-disable-next-line no-var
	var coins: typeof Coin;
}
// APP-17: only expose internals on globalThis in development builds.
if (import.meta.env.DEV) {
	globalThis.ca = CoinAmount;
}
