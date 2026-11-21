/**
 * Best-effort extraction of a human-readable error message from
 * whatever wallet providers throw. Bitcoin wallets (Leather, Xverse,
 * Unisat, etc.) reject with plain objects (JSON-RPC-ish), not Error
 * instances, so a naive `String(err)` collapses to `[object Object]`.
 *
 * Kept free of Reown imports so the browser-wallet send (btcBrowserWallet.ts)
 * can use it without loading AppKit on a Hive login.
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
