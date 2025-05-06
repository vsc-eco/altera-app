import type { Auth } from '$lib/auth/store';
import { createLightningInvoice } from '../v4v/v4v';
import type { Network } from '../sendOptions';
type Token = 'hive' | 'hbd';
export type BoltzToLightning = {
	bip21: string;
	acceptZeroConf: boolean;
	expectedAmount: number;
	id: string;
	address: string;
	swapTree: {
		claimLeaf: {
			version: number;
			output: string;
		};
		refundLeaf: {
			version: number;
			output: string;
		};
	};
	referralId: string;
	claimPublicKey: string;
	timeoutBlockHeight: number;
};

async function toLightning(
	amount: string,
	of: Token,
	into: Token,
	on: Network,
	auth: Auth,
	username: string
): Promise<
	| string
	| {
			boltz: BoltzToLightning;
			v4v: {
				invoice_id: string;
				qr_data: string;
				amount: string;
			};
	  }
> {
	const lightningInvoice = await createLightningInvoice(amount, of, into, on, auth, username);
	if (typeof lightningInvoice == 'string') return lightningInvoice;
	const invoice = lightningInvoice.qr_data.slice(10 /* 'lightning:'.length */);
	const req = {
		to: 'BTC',
		from: 'BTC',
		invoice,
		pairHash: '7cc881191e868c3f8c80428298fb9309263fb482d76a8c6d34f03021fd991d5d'
		// refundPublicKey: '03afe0b5cbb7719d725c1a802e13cb1c65e2bc7f568615e3e2dd03467932fad7ed',
	};
	const res = await fetch('https://api.boltz.exchange/v2/swap/submarine', {
		method: 'POST',
		body: JSON.stringify(req)
	});
	if (res.ok) {
		return { boltz: await res.json(), v4v: lightningInvoice };
	} else {
		return (await res.json()).error;
	}
}
