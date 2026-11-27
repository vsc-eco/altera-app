/**
 * A browser wallet used for one send (an Ethereum deposit signed by MetaMask,
 * Rabby or Keychain's EVM while logged in with Hive) must never become the login.
 *
 * Why it could: Reown's wagmi connectors listen to every installed wallet from
 * the moment the modal exists (initModal). When a deposit asks a wallet for its
 * accounts, the wallet emits accountsChanged and wagmi's injected connector
 * connects on its own (@wagmi/core connectors/injected.js onAccountsChanged ->
 * onConnect). AppKit then reports that account and the reown/index.ts handler
 * would make it the Reown login. And once the site is authorized, any later
 * Reown start reconnects every authorized wallet (wagmi reconnect ->
 * isAuthorized), so the wallet would come back on a reload too.
 *
 * So the side wallet ends the way a wallet the user disconnected ends:
 *  - while the send runs, and a few seconds after (wagmi and AppKit events arrive
 *    late), the Reown handler ignores account events (sideWalletActive) and any
 *    wagmi connection the send created is disconnected again;
 *  - the wallet gets wagmi's own "user disconnected" flag
 *    (`wagmi.<connector id>.disconnected`), which stops every auto-reconnect.
 *    wagmi clears that flag itself when the user really connects the wallet.
 * With `keepExisting` a connection that existed before the send (the user's
 * own Reown login) is left alone. The deposit page calls it without: it only
 * sends this way for a Hive login, where no Reown connection can be the login,
 * and one left behind (Reown reconnects any wallet the site was ever allowed)
 * would become the login after a Hive logout.
 */
let active = 0;

const SETTLE_MS = 5000;

export function sideWalletActive(): boolean {
	return active > 0;
}

/** wagmi's connector id for a wallet: the EIP-6963 rdns, or 'injected' for window.ethereum. */
export function wagmiConnectorId(walletId: string): string {
	return walletId === 'window.ethereum' ? 'injected' : walletId;
}

export async function withSideWallet<T>(
	walletId: string,
	fn: () => Promise<T>,
	{ keepExisting = false }: { keepExisting?: boolean } = {}
): Promise<T> {
	// Read reown.wagmiConfig live (never destructured): Reown may start while the send runs.
	const reown = await import('$lib/auth/reown');
	const core = await import('@wagmi/core');
	const cfg0 = reown.wagmiConfig;
	const before = new Set(
		keepExisting && cfg0 ? core.getConnections(cfg0).map((c) => c.connector.uid) : []
	);
	const connectorId = wagmiConnectorId(walletId);
	const userAlreadyConnected =
		keepExisting && cfg0
			? core.getConnections(cfg0).some((c) => c.connector.id === connectorId)
			: false;

	let unwatch: (() => void) | undefined;
	const sweep = async () => {
		const cfg = reown.wagmiConfig;
		if (!cfg) return;
		for (const c of core.getConnections(cfg)) {
			if (before.has(c.connector.uid)) continue;
			await core.disconnect(cfg, { connector: c.connector }).catch(() => {});
		}
	};
	const watch = () => {
		const cfg = reown.wagmiConfig;
		if (cfg && !unwatch) unwatch = core.watchConnections(cfg, { onChange: () => void sweep() });
	};
	const markDisconnected = async () => {
		if (userAlreadyConnected) return;
		const cfg = reown.wagmiConfig;
		try {
			if (cfg?.storage) await cfg.storage.setItem(`${connectorId}.disconnected`, true);
			else localStorage.setItem(`wagmi.${connectorId}.disconnected`, 'true');
		} catch {
			/* storage blocked: nothing to remember a reconnect with either */
		}
	};

	active++;
	watch();
	try {
		return await fn();
	} finally {
		try {
			watch();
			await sweep();
			await markDisconnected();
		} catch {
			/* a failed cleanup must not hide the send's own result */
		}
		setTimeout(async () => {
			try {
				await sweep();
				await markDisconnected();
			} catch {
				/* as above */
			}
			unwatch?.();
			active = Math.max(0, active - 1);
		}, SETTLE_MS);
	}
}
