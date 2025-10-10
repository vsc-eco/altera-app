import axios from 'axios';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { COINBASE_ID, COINBASE_PRIVATE_KEY, COINBASE_PROJECT_ID } from '$env/static/private';

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

const COINBASE_SESSION_EXPIRY_TIME = 120; // 2 minutes
const projectId = COINBASE_PROJECT_ID;

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	const walletAddr = url.searchParams.get('wallet');
	const amountURL = url.searchParams.get('amount');
	if (walletAddr === null || amountURL === null) {
		return json({ error: "invalid request" }, { status: 400 });
	}

	const paymentAmount = Number(amountURL);
	if (isNaN(paymentAmount)) {
		return json({ error: 'invalid fiat amount' }, { status: 400 });
	}

	const clientIp = getClientAddress();

	try {
		console.log('fetching jwt token');
		const jwtToken = await generateJwt({
			apiKeyId: COINBASE_ID,
			apiKeySecret: COINBASE_PRIVATE_KEY,
			requestMethod: "POST",
			requestHost: 'api.cdp.coinbase.com',
			requestPath: '/platform/v2/onramp/sessions',
			expiresIn: COINBASE_SESSION_EXPIRY_TIME
		});

		const request = await axios.post<CoinbaseOnramp>(
			'https://api.cdp.coinbase.com/platform/v2/onramp/sessions',
			{
				destinationAddress: walletAddr,
				purchaseCurrency: 'BTC',
				destinationNetwork: 'bitcoin',
				paymentAmount: paymentAmount.toString(),
				paymentCurrency: 'USD',
				paymentMethod: 'CARD',
				country: 'US',
				subdivision: 'NY',
				clientIp: clientIp,
			},
			{
				headers: {
					Authorization: `Bearer ${jwtToken}`,
					'Content-Type': 'application/json'
				}
			}
		);

		const onerampUrl = request.data.session.onrampUrl;

		return json({ onerampUrl }, { status: 200 });
	} catch (error) {
		console.error(error);
		return json({ error: 'Something went wrong.' }, { status: 500 });
	}
};