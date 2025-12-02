import axios from 'axios';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { COINBASE_ID, COINBASE_PRIVATE_KEY, ALTERA_ORIGIN } from '$env/static/private';
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

const COINBASE_SESSION_EXPIRY_TIME = 30; // 30 seconds

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const responseHeader: HeadersInit = {
		'Cache-Control': 'no-cache',
		'Access-Control-Allow-Origin': ALTERA_ORIGIN,
		'Access-Control-Allow-Methods': 'POST, OPTIONS'
	};

	const requestOrigin = request.headers.get('origin');
	if (requestOrigin === null || requestOrigin.toLowerCase() !== ALTERA_ORIGIN) {
		return new Response('CORS failed', { status: 403, headers: responseHeader });
	}

	const requestBody = await request.json();
	if (!requestBody.did || !requestBody.amount) {
		return json({ error: 'invalid request' }, { status: 400, headers: responseHeader });
	}

	const { did, amount } = requestBody;

	const paymentAmount = Number(amount);
	if (isNaN(paymentAmount)) {
		return json({ error: 'invalid fiat amount' }, { status: 400, headers: responseHeader });
	}

	// const walletAddr = currentUserBtcDepositAddress(did);
	// temporary (my wallet address) until Coinbase approval
	const walletAddr = 'bc1qqdg2720lvh3l0ydjaw6smqffm76yag59jlsh8v';
	const clientIp = getClientAddress();

	try {
		const jwtToken = await generateJwt({
			apiKeyId: COINBASE_ID,
			apiKeySecret: COINBASE_PRIVATE_KEY,
			requestMethod: 'POST',
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
				redirectUrl: 'https://altera.magi.eco/' // TODO: create a custom url for purcase receipt
			},
			{
				headers: {
					Authorization: `Bearer ${jwtToken}`,
					'Content-Type': 'application/json'
				}
			}
		);

		return new Response(null, {
			status: 302,
			headers: {
				Location: request.data.session.onrampUrl,
				...responseHeader
			}
		});
	} catch (error) {
		console.error(error);
		return json({ error: 'Something went wrong.' }, { status: 500, headers: responseHeader });
	}
};
