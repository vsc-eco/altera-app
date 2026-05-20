import axios from 'axios';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { COINBASE_ID, COINBASE_PRIVATE_KEY } from '$env/static/private';
import {
	currentUserBtcDepositAddress,
	isBtcDepositAddressAvailable
} from '$lib/sendswap/utils/bitcoinAddress';

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

	// APP-02: with no configured signing pubkey the derived P2WSH address is
	// invalid (funds would be unrecoverable). Refuse to hand it out.
	if (!isBtcDepositAddressAvailable()) {
		return json({ error: 'BTC deposit address feature unavailable' }, { status: 503 });
	}

	const btc_address = currentUserBtcDepositAddress(did);

	return json({ btc_address });
};
