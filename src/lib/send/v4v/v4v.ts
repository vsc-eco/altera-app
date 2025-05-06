import type { Auth } from '$lib/auth/store';
import { Network } from '$lib/send/sendOptions';
import { sleep } from 'aninest';
const V4VAPP_API = 'https://api.v4v.app';
type Token = 'hive' | 'hbd';
export const createLightningInvoice = async (
	amount: string,
	of: Token,
	into: Token,
	on: Network,
	auth: Auth,
	username: string
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
	const mainnet_account = on == Network.vsc ? 'vsc.gateway' : username;
	if (mainnet_account.length > 16) {
		return 'Invalid hive username.';
	}
	const url = new URL(`${V4VAPP_API}/v1/new_invoice_hive`);
	const searchParams = {
		hive_accname: mainnet_account,
		amount,
		currency: into.toUpperCase(),
		receive_currency: into.toLowerCase(),
		// usd_hbd: 'false',
		app_name: 'altera.app',
		expiry: '600',
		message: `to=${auth.value.address}`
	};
	for (const [key, value] of Object.entries(searchParams)) {
		url.searchParams.append(key, value);
	}
	const ret = await fetch(url);

	if (ret.ok) {
		const data = await ret.json();
		return {
			invoice_id: data.payment_hash,
			qr_data: `lightning:${data.payment_request}`,
			amount: data.amount
		};
	} else {
		const data = await ret.json();
		const splitError = (data.detail as string).split('\n');
		if (splitError.length < 2) {
			return splitError[0];
		} else {
			return splitError[1].split('[')[0];
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
		await sleep(1);
	}
	return out;
};
const fromLightning = async function* (amount: string, of: Token, into: Token, auth: Auth) {
	if (!auth.value) return 'Auth invalid';
	if (Number.isNaN(Number(amount))) {
		return 'Amount is not a valid number';
	}
	if (Number(amount) < 2) return `Not enough. Must be at least 2 ${of}.`;

	const address = auth.value.address;
	const ret = await (
		await fetch(
			`${V4VAPP_API}/v1/new_invoice_hive?hive_accname=vsc.gateway&amount=${amount}&currency=${of.toUpperCase()}&receive_currency=${into}&usd_hbd=false&app_name=vsc.network&expiry=600&message=to%3D${address}&qr_code=base64_png`
		)
	).json();

	const details = {
		invoice_id: ret.data.payment_hash,
		qr_code: `data:image/png;base64,${ret.data.qr_code_base64}`,
		amount: ret.data.amount
	};

	yield 'waiting';

	const pid = setInterval(async () => {
		const checkBody = await (
			await fetch(`${V4VAPP_API}/v1/check_invoice/${ret.data.payment_hash}`)
		).json();

		if (checkBody.data.paid === true) {
			clearInterval(pid);
			return 'success';
		}
	}, 1000);
};
