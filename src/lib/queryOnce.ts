/**
 * One-shot Houdini query that does NOT leak a cache subscription.
 *
 * ## Why this exists
 *
 * `new SomeQueryStore().fetch(...)` does two things: it runs the query AND it
 * registers the document as a subscriber of the Houdini cache (see the query
 * plugin's `end` hook in houdini/runtime/client/plugins/query.js). That
 * subscription is only released when the store's last *Svelte* subscriber goes
 * away — the store is a Svelte store, and `DocumentStore` runs its `cleanup()`
 * from the writable's stop-notifier.
 *
 * Fire-and-forget call sites never subscribe: they construct a store, await
 * `.fetch()`, read `.data` and drop the instance. Nothing ever unsubscribes,
 * so every call permanently adds one subscriber per selected field to the
 * cache. Worse, the cache reacts to a write by walking *every* registered
 * subscriber and re-reading the full selection for each one
 * (`#notifySubscribers` in houdini/runtime/cache/cache.js).
 *
 * With a poller that builds a fresh store each tick that grows without bound:
 * the 5s balance poll adds 11 subscribers per tick (≈8000/h) and the 2s
 * transaction poll adds ~50 (tens of thousands per hour), each one costing a
 * full selection re-read on every subsequent write. A tab left open long
 * enough spends all its time in the cache and locks up.
 *
 * `queryOnce` fetches and then calls `observer.cleanup()`, which runs the
 * query plugin's cleanup and unsubscribes the document from the cache, so the
 * store instance becomes garbage as intended.
 *
 * ## When to use it
 *
 * Use it for every fetch whose store instance is thrown away afterwards —
 * pollers, one-shot loads, anything of the form `new XStore().fetch(...)`.
 *
 * Do NOT use it for a store a component subscribes to (`$store` in markup, or
 * `store.subscribe(...)`): those rely on the cache subscription to stay live
 * and Houdini already releases it when the component unmounts.
 */

type OneShotStore = {
	fetch: (args?: never) => Promise<unknown>;
	observer: { cleanup: () => Promise<void> };
};

export async function queryOnce<S extends OneShotStore>(
	store: S,
	args: Parameters<S['fetch']>[0]
): Promise<Awaited<ReturnType<S['fetch']>>> {
	try {
		return (await store.fetch(args)) as Awaited<ReturnType<S['fetch']>>;
	} finally {
		// Never let a cleanup failure mask the query result.
		try {
			await store.observer.cleanup();
		} catch (err) {
			console.warn('queryOnce: cache cleanup failed', err);
		}
	}
}
