import type { seconds } from '@aninest/extensions';

export function getQuerier<ReturnType>(url: string, keepAlive: seconds = 30) {
	let cached: ReturnType | undefined = undefined;
	let cachedAt = 0;
	let isFetching = false;
	let awaitingResolve: ((value: ReturnType) => void)[] = [];
	let awaitingReject: ((reason?: unknown) => void)[] = [];

	return async function getReturnType(options?: { signal?: AbortSignal }): Promise<ReturnType> {
		const now = Date.now();

		// Return cached value if it's still within the TTL window.
		if (cached !== undefined && cachedAt > now - keepAlive * 1000) {
			return cached;
		}

		// A fetch is already in flight — queue up and wait for it.
		if (isFetching) {
			return new Promise<ReturnType>((resolve, reject) => {
				awaitingResolve.push(resolve);
				awaitingReject.push(reject);
			});
		}

		isFetching = true;

		// Stale cache available — return it immediately and refresh in background.
		if (cached !== undefined) {
			fetch(url, { signal: options?.signal })
				.then(async (res) => {
					if (!res.ok) throw new Error('Fetch failed.');
					const out = (await res.json()) as ReturnType;
					cached = out;
					cachedAt = Date.now();
					for (const resolve of awaitingResolve) resolve(out);
				})
				.catch((err) => {
					for (const reject of awaitingReject) reject(err);
				})
				.finally(() => {
					isFetching = false;
					awaitingResolve = [];
					awaitingReject = [];
				});
			return cached;
		}

		// First fetch — must await the result.
		try {
			const res = await fetch(url, { signal: options?.signal });
			if (!res.ok) throw new Error('Fetch failed.');
			const out = (await res.json()) as ReturnType;
			cached = out;
			cachedAt = Date.now();
			for (const resolve of awaitingResolve) resolve(out);
			return out;
		} catch (err) {
			for (const reject of awaitingReject) reject(err);
			throw err;
		} finally {
			isFetching = false;
			awaitingResolve = [];
			awaitingReject = [];
		}
	};
}
