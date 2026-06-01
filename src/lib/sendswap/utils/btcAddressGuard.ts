// Guard against sending a BTC mainnet output to an address the app itself
// generated for the user — namely their own Magi BTC **deposit address**.
//
// A deposit address is a bridge-controlled P2WSH address: external BTC sent
// there is credited to the user on Magi. Sending an unmap/withdrawal (or a
// swap settled on BTC) *out* to that same address produces a vault→vault
// transfer: the bridge debits the user and the BTC lands back in a
// bridge-controlled address, never crediting them. The funds are stranded
// (recoverable only by an operator). This mirrors a real mainnet incident, so
// the swap control refuses such a destination up front.
//
// Note: this is a client-side UX guard. The authoritative protection lives in
// the btc-mapping contract's HandleUnmap (which rejects an unmap to the bridge
// vault address). Direct contract callers bypass this check.

/**
 * Normalizes a BTC address for equality comparison. bech32 (bc1/tb1/bcrt1) is
 * case-insensitive and canonically lowercase, so trimming + lowercasing is a
 * safe comparison key for the segwit deposit addresses the app derives.
 */
function normalizeBtcAddress(addr: string): string {
	return addr.trim().toLowerCase();
}

/**
 * Fetches the BTC deposit address the app generates for `did`, or null when
 * the feature is unavailable (no signing pubkey configured — the API returns
 * 503) or the request fails. Returning null makes the guard fail open rather
 * than blocking legitimate withdrawals when we simply can't derive the address.
 */
export async function fetchUserBtcDepositAddress(
	did: string,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	if (!did) return null;
	try {
		const res = await fetchFn(`/api/btcaddress?did=${encodeURIComponent(did)}`);
		if (!res.ok) return null;
		const data: unknown = await res.json();
		const addr = (data as { btc_address?: unknown })?.btc_address;
		return typeof addr === 'string' && addr.length > 0 ? addr : null;
	} catch {
		return null;
	}
}

export interface BtcRecipientCheck {
	blocked: boolean;
	reason?: string;
}

const DEPOSIT_ADDRESS_REASON =
	'This is your own Magi BTC deposit address. Sending BTC out to it would return the funds to the bridge vault and strand them. Use an external Bitcoin wallet address instead.';

/**
 * Returns blocked=true when `recipient` matches an address the app generated
 * for this user (their BTC deposit address). When `depositAddress` is null
 * (feature unavailable) the check is a no-op.
 */
export function checkBtcRecipient(
	recipient: string | undefined,
	depositAddress: string | null
): BtcRecipientCheck {
	if (!recipient || !depositAddress) return { blocked: false };
	if (normalizeBtcAddress(recipient) === normalizeBtcAddress(depositAddress)) {
		return { blocked: true, reason: DEPOSIT_ADDRESS_REASON };
	}
	return { blocked: false };
}

/**
 * Enforcement helper: throws if `recipient` is an app-generated address for
 * `did`. Call before building any BTC-mainnet settlement/withdrawal op.
 */
export async function assertBtcRecipientAllowed(
	recipient: string | undefined,
	did: string,
	fetchFn: typeof fetch = fetch
): Promise<void> {
	const deposit = await fetchUserBtcDepositAddress(did, fetchFn);
	const { blocked, reason } = checkBtcRecipient(recipient, deposit);
	if (blocked) throw new Error(reason);
}
