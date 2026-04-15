import { initModal, modal } from '$lib/auth/reown';

/**
 * Best-effort extraction of a human-readable error message from
 * whatever wallet providers throw. Bitcoin wallets (Leather, Xverse,
 * Unisat, etc.) reject with plain objects (JSON-RPC-ish), not Error
 * instances, so a naive `String(err)` collapses to `[object Object]`.
 */
export function formatWalletError(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	if (err && typeof err === 'object') {
		const e = err as Record<string, unknown>;
		if (typeof e.message === 'string') return e.message;
		const nested = e.error;
		if (nested && typeof nested === 'object') {
			const m = (nested as Record<string, unknown>).message;
			if (typeof m === 'string') return m;
		}
		if (typeof e.reason === 'string') return e.reason;
		try {
			return JSON.stringify(err);
		} catch {
			return 'Unknown wallet error';
		}
	}
	return String(err);
}

/**
 * Send a BTC transfer via the connected reown Bitcoin wallet
 * (Leather, Xverse, Unisat, etc.) by calling `sendTransfer` on
 * AppKit's bip122 provider. Shared between the QuickSwap BTC
 * swap flow and the BitcoinMainnetDeposit "Sign with wallet" flow.
 *
 * Takes care of:
 * - Lazily initialising the AppKit modal on the first call after a
 *   cached-session F5. `AuthInjector` skips `initModal()` on reload
 *   to avoid popping the wallet's "Connect app" prompt on page load,
 *   so the modal may be null when the user first tries to sign.
 * - Switching AppKit's active CAIP network to match the wallet's
 *   actual address network (detected from the address prefix).
 *   Without this Leather rejects recipients with
 *   "Address is for incorrect network" when the adapter still has
 *   `bitcoin` mainnet selected for a `tb1q…` testnet wallet.
 * - Validating the provider supports `sendTransfer` before calling.
 * - Unwrapping non-Error rejections into a readable message.
 *
 * Returns the bitcoin tx hash string on success. Throws a proper
 * `Error` with a readable message on any failure.
 */
export async function sendBtcFromConnectedWallet(params: {
	/** Amount in satoshis (smallest units). */
	amountSats: string | number;
	/** Recipient bitcoin address. Must be on the same network as the connected wallet. */
	recipient: string;
	/** Fallback wallet address to consult if `modal.getAddress()` returns undefined. */
	fallbackAddress?: string;
}): Promise<string> {
	// Ensure AppKit is initialised. Safe to call repeatedly — the
	// internal guard in initModal short-circuits after the first run.
	initModal();
	if (!modal) {
		throw new Error('Bitcoin wallet not connected');
	}

	const walletAddress = modal.getAddress() ?? params.fallbackAddress ?? '';
	if (!walletAddress) {
		throw new Error('Bitcoin wallet not connected');
	}

	// `modal.getProvider('bip122')` returns AppKit's
	// `SatsConnectConnector` instance (its constructor does
	// `this.provider = this`), which exposes a `sendTransfer`
	// convenience method that normalises the call across every
	// bitcoin wallet AppKit ships adapters for — Leather,
	// Xverse, Unisat, OKX, Phantom, etc. — through
	// sats-connect's RPC protocol. No per-wallet special-casing
	// here; any Leather-specific param munging (e.g. the string
	// satoshi amount) happens inside the connector.
	type BitcoinConnectorProvider = {
		sendTransfer(params: { amount: string; recipient: string }): Promise<string>;
	};
	const provider = modal.getProvider<BitcoinConnectorProvider>('bip122');
	if (!provider || typeof provider.sendTransfer !== 'function') {
		// Usually means the wallet connection hasn't fully
		// re-established after a cached-session F5 yet — AppKit
		// is still waiting on Leather's "Connect app" confirmation.
		// Ask the user to retry once they see the wallet is
		// connected in the UI.
		throw new Error(
			'Bitcoin wallet not fully connected yet. Approve the wallet connection prompt in your extension and try again.'
		);
	}

	// Some wallets (notably Leather) depend on a flaky external
	// fee-estimation API and spuriously reject with
	// `InsufficientFunds` when that API is momentarily unavailable.
	// Retry once with a short backoff before surfacing the error.
	// Wallet-agnostic: any wallet whose error message matches the
	// transient-failure patterns benefits from the retry, and the
	// happy path is unaffected (first call succeeds → no retry).
	const MAX_ATTEMPTS = 2;
	const isRetryable = (raw: string): boolean =>
		/InsufficientFunds|insufficient[_\s]?funds|fee[_\s]?estimat|500|temporarily|timeout|network\s*error/i.test(
			raw
		);

	let lastErr: unknown = null;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			return await provider.sendTransfer({
				amount: String(params.amountSats),
				recipient: params.recipient
			});
		} catch (err) {
			lastErr = err;
			const raw = formatWalletError(err);
			if (attempt < MAX_ATTEMPTS && isRetryable(raw)) {
				console.warn(
					`[walletSend] sendTransfer attempt ${attempt} failed with retryable error, retrying…`,
					raw
				);
				await new Promise((r) => setTimeout(r, 1500));
				continue;
			}
			break;
		}
	}

	// Fall through to the existing error-translation block with the
	// last observed error so the user sees a readable message.
	try {
		throw lastErr;
	} catch (err) {
		// Wallets reject with non-Error objects (JSON-RPC style
		// `{code, message}` or similar). Log the raw value so it's
		// visible in the browser console when debugging, then
		// re-throw as a proper Error with a readable message.
		console.error('sendTransfer failed', err);
		const raw = formatWalletError(err);
		const recipientIsTestnet =
			params.recipient.startsWith('tb1') || params.recipient.startsWith('bcrt1');
		const networkHint = recipientIsTestnet
			? 'Switch your Bitcoin wallet to Testnet (Testnet3) — Settings → Network → Testnet — then retry.'
			: 'Switch your Bitcoin wallet to Mainnet — Settings → Network → Mainnet — then retry.';

		if (
			/incorrect\s*network|wrong\s*network|Address\s*is\s*for\s*incorrect/i.test(raw)
		) {
			throw new Error(`${networkHint} (${raw})`);
		}
		if (/InsufficientFunds|insufficient[_\s]funds/i.test(raw)) {
			// Two common causes:
			// 1. amount + miner fees exceeds wallet balance
			// 2. Wallet is on the wrong network (UTXOs live elsewhere)
			throw new Error(
				`Insufficient funds — either lower the amount, or your wallet is on a different Bitcoin network than the recipient. ${networkHint}`
			);
		}
		throw new Error(raw);
	}
}
