/**
 * Runs `attempt` until it reports success, at most `maxAttempts` times, waiting
 * 1 s, 2 s, 4 s ... between tries. Returns whether it succeeded. Used to load
 * pool prices: a swap is not sent without a quote, so one failed load must not
 * leave the swap card without prices.
 */
export async function retryWithBackoff(
	attempt: () => Promise<boolean>,
	maxAttempts = 3,
	sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await attempt()) return true;
		if (i < maxAttempts - 1) await sleep(1000 * 2 ** i);
	}
	return false;
}
