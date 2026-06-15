/**
 * Pending contract updates loader.
 *
 * Hits the VSC GraphQL endpoint directly (plain fetch — not Houdini)
 * for the `findPendingContractUpdates` field landing in go-vsc-node
 * PR #210. Houdini codegen would fail today because the schema on
 * api.vsc.eco doesn't have this field yet; using fetch bypasses
 * codegen entirely.
 *
 * Behavior:
 *   - happy path: returns { source: 'live', updates }
 *   - field missing / network error / empty result: falls back to mock
 *     and returns { source: 'mock', reason }
 *
 * The day PR #210 ships, the same code starts returning `source: 'live'`
 * automatically — no swap, no deploy needed beyond it being on prod.
 *
 * If we want to migrate to a real Houdini store later (for caching,
 * pagination, subscriptions), the fetch can be replaced one-for-one.
 */
import { CONTRACT_REGISTRY, MOCK_PENDING_UPDATES } from './mockData';
import type { ContractUpdateView, PendingContractUpdate } from './types';
import { GQL_PROXY_VSC, currentGqlUrl, gqlUpstreamHeaders } from '../../../client';

// Follow the app's configured VSC node (localStorage `vsc-gql-url` /
// network toggle) — but through the same-origin /api/gql proxy the rest
// of the app uses, with the chosen node passed via x-gql-upstream.
// Direct browser fetches to the nodes can be blocked by their CORS
// policy; the proxy sidesteps that for prod, testnet and dev alike.

/**
 * No-filter query. PR #210's `filterOptions` accepts `byId`, but the
 * witness page wants every pending update; we let the registry decide
 * which ones get the friendly label.
 */
const QUERY = `
  query FindPendingContractUpdates {
    findPendingContractUpdates(filterOptions: {}) {
      id
      code
      proposer
      owner
      creation_height
      activation_height
      activation_ts
    }
  }
`;

/**
 * Diagnostic logging for the live-verification phase (testnet window
 * catching). Logs the upstream node, raw wire payloads and the
 * mock-fallback reason so a failed live test is debuggable from the
 * browser console alone. Downgrade to console.debug (or strip) once
 * the live path is verified on prod.
 */
const LOG_TAG = '[contract-updates]';

export type LoadResult =
	| { source: 'live'; updates: ContractUpdateView[] }
	/** Dev-only: mock fixtures (error fallback, or forced via ?mock=1). */
	| { source: 'mock'; updates: ContractUpdateView[]; reason: string }
	/** Prod: backend doesn't serve the field (or transport failed) — the UI
	 *  shows the plain empty state, never fake data. */
	| { source: 'unavailable'; updates: ContractUpdateView[]; reason: string };

/** Dev-only escape hatch to SEE entries without a live pending update:
 *  open /witness-assistant?mock=1 (or set localStorage
 *  'contract-updates-mock' = '1'). Ignored in production builds. */
function mockForced(): boolean {
	if (!import.meta.env.DEV) return false;
	try {
		if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock'))
			return true;
		return globalThis.localStorage?.getItem?.('contract-updates-mock') === '1';
	} catch {
		return false;
	}
}

/** Join a raw on-chain update with our curated client-side metadata. */
function enrich(u: PendingContractUpdate): ContractUpdateView {
	return { ...u, metadata: CONTRACT_REGISTRY[u.id] };
}

/**
 * Resolve on-chain names for contracts that aren't in the curated
 * registry, via findContract(byId). Best-effort: a failed lookup just
 * leaves chainName undefined and the UI falls back to the short id.
 * Pending updates are one-per-contract and rare, so per-id queries are
 * fine (no batch filter exists on FindContractFilter).
 */
async function resolveChainNames(updates: ContractUpdateView[]): Promise<void> {
	const unnamed = updates.filter((u) => !u.metadata);
	await Promise.all(
		unnamed.map(async (u) => {
			try {
				const res = await fetch(GQL_PROXY_VSC, {
					method: 'POST',
					headers: gqlUpstreamHeaders(currentGqlUrl),
					body: JSON.stringify({
						query: `query { findContract(filterOptions: {byId: ${JSON.stringify(u.id)}}) { id name } }`
					})
				});
				const json = (await res.json().catch(() => null)) as null | {
					data?: { findContract?: { id: string; name?: string | null }[] | null };
				};
				const name = json?.data?.findContract?.[0]?.name;
				if (name) {
					u.chainName = name;
					console.debug(`${LOG_TAG} resolved on-chain name for ${u.id}: ${name}`);
				}
			} catch {
				/* best-effort */
			}
		})
	);
}

function mockFallback(reason: string): LoadResult {
	// Mock fixtures are a development aid — production users must never see
	// fake contract updates. On prod a failed/unsupported fetch renders the
	// plain empty state instead.
	if (import.meta.env.DEV) {
		return { source: 'mock', updates: MOCK_PENDING_UPDATES.map(enrich), reason };
	}
	return { source: 'unavailable', updates: [], reason };
}

/**
 * Fetch pending updates. Never throws — failure surfaces as
 * `source: 'mock'` with a diagnostic `reason` string the UI can show
 * in a tooltip.
 */
export async function loadPendingUpdates(): Promise<LoadResult> {
	if (mockForced()) {
		return {
			source: 'mock',
			updates: MOCK_PENDING_UPDATES.map(enrich),
			reason: 'forced via ?mock=1'
		};
	}
	try {
		console.debug(`${LOG_TAG} fetching via ${GQL_PROXY_VSC} → upstream ${currentGqlUrl}`);
		const res = await fetch(GQL_PROXY_VSC, {
			method: 'POST',
			headers: gqlUpstreamHeaders(currentGqlUrl),
			body: JSON.stringify({ query: QUERY })
		});
		// Don't bail on a non-2xx status alone: this upstream returns GraphQL
		// validation failures as HTTP 422 with the errors in the JSON body —
		// read the body first so the mock-fallback reason carries the actual
		// GraphQL message ("Cannot query field …") instead of a bare status.
		const json = (await res.json().catch(() => null)) as null | {
			data?: { findPendingContractUpdates?: PendingContractUpdate[] | null };
			errors?: { message: string }[];
		};
		if (json === null) {
			console.warn(`${LOG_TAG} HTTP ${res.status} with non-JSON body — falling back to mock`);
			return mockFallback(`HTTP ${res.status} from VSC GraphQL`);
		}
		if (!res.ok && !json.errors?.length) {
			// Non-2xx without a GraphQL error payload (gateway 5xx, proxy 4xx):
			// genuine transport failure, not a schema rejection.
			console.warn(`${LOG_TAG} HTTP ${res.status} from proxy/upstream — falling back to mock`);
			return mockFallback(`HTTP ${res.status} from VSC GraphQL`);
		}
		if (json.errors?.length) {
			console.warn(`${LOG_TAG} GraphQL error — falling back to mock:`, json.errors[0].message);
			return mockFallback(json.errors[0].message);
		}
		const raw = json.data?.findPendingContractUpdates;
		if (!raw || raw.length === 0) {
			// No errors but empty payload: could be "field exists, nothing pending"
			// once PR #210 ships, OR could be a permissive schema returning [] for
			// an unknown query. Either way we return live + empty so the UI shows
			// the proper empty state (instead of confusing mock data).
			console.debug(`${LOG_TAG} live response, no pending updates`);
			return { source: 'live', updates: [] };
		}
		console.debug(`${LOG_TAG} live response, ${raw.length} pending update(s):`, raw);
		const updates = raw.map(enrich);
		await resolveChainNames(updates);
		return { source: 'live', updates };
	} catch (e) {
		console.warn(`${LOG_TAG} fetch threw — falling back to mock:`, e);
		return mockFallback(e instanceof Error ? e.message : String(e));
	}
}

/** Look up a single update by contract id. Same fallback behavior. */
export async function loadUpdateById(id: string): Promise<ContractUpdateView | undefined> {
	const result = await loadPendingUpdates();
	return result.updates.find((u) => u.id === id);
}
