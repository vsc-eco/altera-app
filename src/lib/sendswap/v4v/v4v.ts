import type { Auth } from '$lib/auth/store'
import { vscGateway } from '$lib/constants'
import { sleep } from 'aninest'
import { Network } from '../utils/sendOptions'
const V4VAPP_API = 'https://api.v4v.app';
type Token = 'hive' | 'hbd' | 'sats';
// V4V API only accepts: HIVE, HBD, USD, SATS (uppercase) / hive, hbd, sats (lowercase)
function toV4VCurrency(token: string): string {
	const t = token.toLowerCase();
	if (t === 'btc') return 'sats';
	return t;
}
export const createLightningInvoice = async (
	amount: string,
	of: Token,
	into: Token,
	on: Network,
	auth: Auth,
	username: string,
	altera_id?: string
): Promise<
	| string
	| {
			invoice_id: string;
			qr_data: string;
			amount: string;
	  }
> => {
	if (auth.value == undefined) {
		return 'Unauthorized. Please sign in to continue.';
	}
	// if (Number(amount) < 2) return `Not enough. Must be at least 2 ${of}.`;
	console.log('on', on);
	const isMagiSats = on.value === Network.magi.value && into.toLowerCase() === 'sats';
	const mainnetAccount =
		on.value === Network.magi.value ? (isMagiSats ? username : vscGateway) : username;
	console.log('mainnet account', mainnetAccount);
	console.log('creating invoice with params', {
		amount,
		of,
		into,
		on,
		auth: auth.value.address,
		username,
		altera_id
	});
	const url = new URL(`${V4VAPP_API}/v1/new_invoice_hive`);
	const message = new URLSearchParams(`to=${auth.value.address}`);
	// let message = new URLSearchParams(`to=${vscGateway}`);
	if (altera_id) {
		message.append('altera_id', altera_id);
	}
	// Map BTC → SATS for V4V API compatibility
	const v4vCurrency = toV4VCurrency(into);
	const receiveCurrency = isMagiSats ? 'magisats' : v4vCurrency.toLowerCase();
	// Convert amount: if the caller passed BTC but API needs SATS, multiply by 1e8
	let numericAmount = Number(amount);
	if (into.toLowerCase() === 'btc') {
		numericAmount = Math.round(numericAmount * 1e8); // BTC → SATS
	}
	// Round to 3 decimal places for HIVE/HBD precision; SATS are integers
	const roundedAmount =
		v4vCurrency === 'sats'
			? Math.round(numericAmount).toString()
			: parseFloat(numericAmount.toFixed(3)).toString();
	const searchParams = {
		hive_accname: mainnetAccount,
		amount: roundedAmount,
		currency: v4vCurrency.toUpperCase(),
		receive_currency: receiveCurrency,
		// usd_hbd: 'false',
		app_name: 'altera.app',
		expiry: '600',
		message: message.toString()
	};
	for (const [key, value] of Object.entries(searchParams)) {
		url.searchParams.append(key, value);
	}
	// makes a GET request by default
	const ret = await fetch(url);

	if (ret.ok) {
		const data = await ret.json();
		return {
			invoice_id: data.payment_hash,
			qr_data: `lightning:${data.payment_request}`,
			amount: data.amount
		};
	} else {
		try {
			const data = await ret.json();
			if (typeof data.detail === 'string') {
				const splitError = data.detail.split('\n');
				if (splitError.length < 2) {
					return splitError[0];
				} else {
					return splitError[1].split('[')[0];
				}
			}
			return `Bad request: ${ret.status} ${ret.statusText}`;
		} catch {
			return `Bad request: ${ret.status} ${ret.statusText}`;
		}
	}
};

export const checkLightningSuccess = async (
	invoice_id: string,
	options?: { signal?: AbortSignal }
): Promise<string> => {
	let out = 'Error: Lightning dialog closed before invoice was scanned and processed.';
	while (options?.signal?.aborted !== true) {
		const checkBody = await fetch(`${V4VAPP_API}/v1/check_invoice/${invoice_id}`, {
			signal: options?.signal
		});
		const data = await checkBody.json();
		if (!checkBody.ok) {
			return data.detail.slice('[')[0];
		}

		if (data.paid === true) {
			out = 'success';
			break;
		}
		if (data.expired === true) {
			out = 'The invoice expired. Try creating a new one.';
			break;
		}
		await sleep(2);
	}
	return out;
};
