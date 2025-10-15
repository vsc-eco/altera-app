import axios from 'axios';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { COINBASE_ID, COINBASE_PRIVATE_KEY } from '$env/static/private';
import { currentUserBtcDepositAddress } from '$lib/sendswap/utils/bitcoinAddress';

export interface CoinbaseOnramp {
	session: Session;
	quote: Quote;
}

export interface Quote {
	paymentTotal: string;
	paymentSubtotal: string;
	paymentCurrency: string;
	purchaseAmount: string;
	purchaseCurrency: string;
	destinationNetwork: string;
	fees: Fee[];
	exchangeRate: string;
}

export interface Fee {
	type: string;
	amount: string;
	currency: string;
}

export interface Session {
	onrampUrl: string;
}

export const GET: RequestHandler = async ({ url }) => {
	const did = url.searchParams.get('did');

	if (!did) {
		return json({ error: 'Missing did parameter' }, { status: 400 });
	}

	const btc_address = currentUserBtcDepositAddress(did);

	return json({ btc_address });
};
