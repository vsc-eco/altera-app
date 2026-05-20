import type { RequestHandler } from '@sveltejs/kit';

// APP-01: The Coinbase onramp is disabled.
//
// The previous implementation fell back to a hardcoded developer BTC wallet
// (`bc1qqdg2720lvh3l0ydjaw6smqffm76yag59jlsh8v`) because per-user deposit
// address derivation is not yet available (empty PUBLICKEY, see APP-02).
// Any user completing a purchase would have sent funds to that single wallet
// (real fund-loss path). It also performed an unvalidated client-IP geo
// lookup (APP-07). The entire onramp handler — including the hardcoded
// wallet and the geo lookup — has been removed until proper per-user
// derivation is restored. Re-enabling requires reinstating
// `currentUserBtcDepositAddress(did)` with a real contract pubkey.

export const POST: RequestHandler = async () => {
	return new Response('Coinbase onramp disabled', { status: 503 });
};
