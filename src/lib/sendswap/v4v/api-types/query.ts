import type { seconds } from '@aninest/extensions';

export function getQuerier<ReturnType>(url: string, keepAlive: seconds = 30) {
	let cached: ReturnType | undefined = undefined;
	let cachedAt = 0;
	let isFetching = false;
	let awaitingCache: ((value: ReturnType | PromiseLike<ReturnType>) => void)[] = [];

	return async function getReturnType(options?: { signal?: AbortSignal }): Promise<ReturnType> {
		let now = Date.now();
		if (cached != undefined) {
			return cached;
		}
		if (cachedAt > now - keepAlive * 1000 && cached != undefined) {
			return cached;
		}

		if (isFetching) {
			return new Promise((resolve) => {
				awaitingCache.push(resolve);
			});
		}

		isFetching = true;
		let req = fetch(url, {
			signal: options?.signal
		});
		if (cached != undefined) {
			req.then(async (res) => {
				if (res.ok) {
					let out = await res.json();
					cached = out;
					cachedAt = now;
					for (const res of awaitingCache) {
						res(out);
					}
				}
			});
			// return stale cache for this req,
			// fetch fresh data for the next one
			return cached;
		}
		let res = await req;
		if (res.ok) {
			let out = await res.json();
			cached = out;
			cachedAt = now;
			for (const res of awaitingCache) {
				res(out);
			}
			return out;
		}
		throw new Error('Fetch failed.');
	};
}
