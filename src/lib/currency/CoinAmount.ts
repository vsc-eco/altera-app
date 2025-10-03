import { Coin, type IntermediaryNetwork } from '$lib/sendswap/utils/sendOptions';
import { getExchangeRates } from './convert';
export type UnkCoinAmount = CoinAmount<Coin>;
export class CoinAmount<C extends Coin> {
	coin: C;
	amount: number;

	constructor(num: string | number, coin: C, preshiftedInt?: boolean) {
		let amount: number;
		if (num == '' || Number.isNaN(num)) num = '0';
		if (typeof num == 'number') {
			amount = Math.round(num * (preshiftedInt ? 1 : 10 ** coin.decimalPlaces));
		} else {
			const decIdx = num.indexOf('.');
			if (decIdx == -1) {
				amount = Number.parseInt(num.padEnd(coin.decimalPlaces + num.length, '0'));
			} else {
				const integer = num.slice(0, decIdx);
				let decimal = num.slice(decIdx + 1, coin.decimalPlaces + decIdx + 1);
				decimal = decimal.padEnd(coin.decimalPlaces, '0');
				amount = Number.parseInt(integer.concat(decimal));
			}
		}
		this.coin = coin;
		this.amount = amount;
	}

	/**
	 * Same as `toAmountString` but with trailing zeroes
	 */
	toPrettyAmountString() {
		return this.toAmountString(true);
	}

	isNegative() {
		return this.amount < 0;
	}

	toAmountString(keepTrailingZeroes?: boolean) {
		if (this.amount == 0 && !keepTrailingZeroes) {
			return this.amount.toString();
		}
		const isNegative = this.isNegative();
		const amountStr = this.amount
			.toString()
			.slice(isNegative ? 1 : 0)
			.padStart(this.coin.decimalPlaces, '0');
		const decLoc = amountStr.length - this.coin.decimalPlaces;
		const integer = amountStr.slice(0, decLoc);
		let decimal = amountStr.slice(decLoc);
		if (!keepTrailingZeroes) {
			const zeroes = /0*$/m.exec(decimal)![0];
			if (zeroes.length != 0) decimal = decimal.slice(0, -zeroes.length);
			if (decimal.length == 0) return integer;
		}
		const out = `${isNegative ? '-' : ''}${integer || '0'}.${decimal}`;
		return out;
	}
	toString() {
		return `${this.toAmountString()} ${this.coin.unit}`;
	}
	toPrettyString() {
		const isNegative = this.isNegative();
		const numericValue = Math.abs(this.amount) / 10 ** this.coin.decimalPlaces;
		const formatter = new Intl.NumberFormat(navigator.language, {
			useGrouping: true,
			minimumFractionDigits: this.coin.decimalPlaces
		});
		const formatted = formatter.format(numericValue);
		return `${isNegative ? '-' : ''}${formatted} ${this.coin.unit}`;
	}
	toMinFigs(figures = this.coin.decimalPlaces + 1, decimals = this.coin.decimalPlaces) {
		const isNegative = this.isNegative();
		const numericValue = Math.abs(this.amount) / 10 ** this.coin.decimalPlaces;
		const minFigs = numericValue < 1 ? Math.min(this.coin.decimalPlaces, figures) : figures;
		const formatter = new Intl.NumberFormat(navigator.language, {
			useGrouping: true,
			minimumSignificantDigits: minFigs,
			minimumFractionDigits: decimals,
			maximumSignificantDigits: 21
		});
		const formatted = formatter.format(numericValue);
		return `${isNegative ? '-' : ''}${formatted}`;
	}
	toPrettyMinFigs(figures = this.coin.decimalPlaces + 1, decimals = this.coin.decimalPlaces) {
		return `${this.toMinFigs(figures, decimals)} ${this.coin.unit}`;
	}
	toNumber() {
		return this.amount / 10 ** this.coin.decimalPlaces;
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
		if (this.coin.value == coin.value) return this as unknown as CoinAmount<OtherCoin>;
		const rates = await getExchangeRates(via, this.coin);
		const myRate = rates[coin.unit as keyof typeof rates];
		// console.log(
		// 	`converted ${this} to ${coin.unit} with conv rate ${myRate} to`,
		// 	this.toString(),
		// 	this.mulTo(myRate, coin).toString()
		// );
		return this.mulTo(myRate, coin);
	}
	add(amount: UnkCoinAmount): CoinAmount<C> {
		return new CoinAmount(this.amount + amount.mulTo(1, this.coin).amount, this.coin, true);
	}
	mul(multip: number): CoinAmount<C> {
		return new CoinAmount(Math.round(this.amount * multip), this.coin, true);
	}
	mulTo<ToCoin extends Coin>(multip: number, into: ToCoin): CoinAmount<ToCoin> {
		// console.log(multip * 10 ** (into.decimalPlaces - this.coin.decimalPlaces));
		return new CoinAmount(
			Math.round(this.amount * (multip * 10 ** (into.decimalPlaces - this.coin.decimalPlaces))),
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
globalThis.ca = CoinAmount;
