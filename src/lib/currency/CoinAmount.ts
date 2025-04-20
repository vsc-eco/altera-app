import { browser } from '$app/environment';
import { Coin, type IntermediaryNetwork } from '$lib/send/sendOptions';
import { convert, getExchangeRates } from './convert';
export type UnkCoinAmount = CoinAmount<Coin>;
export class CoinAmount<C extends Coin> {
	coin: C;
	amount: number;

	constructor(num: string | number, coin: C, integerNum?: boolean) {
		let amount: number;
		if (num == '' || Number.isNaN(num)) num = '0';
		if (typeof num == 'number') {
			amount = Math.round(num * (integerNum ? 1 : 10 ** coin.decimalPlaces));
		} else {
			let decIdx = num.indexOf('.');
			console.log(num, decIdx);
			if (decIdx == -1) {
				amount = Number(num.padEnd(coin.decimalPlaces + num.length, '0'));
			} else {
				let integer = num.slice(0, decIdx);
				let decimal = num.slice(decIdx + 1, coin.decimalPlaces + decIdx + 1);
				decimal = decimal.padEnd(coin.decimalPlaces, '0');
				amount = Number(integer.concat(decimal));
			}
		}
		this.coin = coin;
		this.amount = amount;
	}

	amountToString() {
		if (this.amount == 0) return this.amount.toString();
		const amountStr = this.amount.toString().padStart(this.coin.decimalPlaces, '0');
		const decLoc = amountStr.length - this.coin.decimalPlaces;
		const integer = amountStr.slice(0, decLoc);
		let decimal = amountStr.slice(decLoc);
		const zeroes = /0*$/m.exec(decimal)![0];
		if (zeroes.length != 0) decimal = decimal.slice(0, -zeroes.length);
		if (decimal.length == 0) return integer;
		const out = `${integer || '0'}.${decimal}`;
		return out;
	}
	toString() {
		return `${this.amountToString()} ${this.coin.unit}`;
	}
	async convertTo<OtherCoin extends Coin>(
		coin: OtherCoin,
		via: IntermediaryNetwork
	): Promise<CoinAmount<OtherCoin>> {
		console.log(this.amountToString(), coin, via);
		// if going either to or from unknown coin then the conversion is 1
		// for all networks
		if (coin.value == Coin.unk.value || this.coin.value == Coin.unk.value)
			return new CoinAmount(this.amountToString(), coin);
		if (this.coin.value == coin.value) return this as unknown as CoinAmount<OtherCoin>;
		const rates = await getExchangeRates(via, this.coin);
		const myRate = rates[coin.unit as keyof typeof rates];
		console.log(
			`converted ${this} to ${coin.unit} with conv rate ${myRate} to`,
			this.toString(),
			this.mulTo(myRate, coin).toString()
		);
		return this.mulTo(myRate, coin);
	}
	add(amount: number): CoinAmount<C> {
		return new CoinAmount(
			this.amount + Math.round(amount * 10 ** this.coin.decimalPlaces),
			this.coin
		);
	}
	mul(multip: number): CoinAmount<C> {
		return new CoinAmount(Math.round(this.amount * multip), this.coin, true);
	}
	mulTo<ToCoin extends Coin>(multip: number, into: ToCoin): CoinAmount<ToCoin> {
		console.log(multip * 10 ** (into.decimalPlaces - this.coin.decimalPlaces));
		return new CoinAmount(
			Math.round(this.amount * (multip * 10 ** (into.decimalPlaces - this.coin.decimalPlaces))),
			into,
			true
		);
	}
}

declare global {
	var ca: typeof CoinAmount;
	var coins: typeof Coin;
}
globalThis.ca = CoinAmount;
