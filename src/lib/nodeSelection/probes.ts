const PROBE_TIMEOUT_MS = 3000;

/**
 * How far behind the freshest responder a node may fall and still count as
 * "current", in each category's own freshness units.
 *
 * Freshness is a *correctness gate*, not the ranking key: a node that is a
 * block or two behind is serving the same data a user would see a moment
 * later, so letting that decide the pick traded real latency for an
 * invisible lead. Anything outside the tolerance is genuinely lagging and is
 * dropped regardless of how fast it answers.
 */
export const FRESHNESS_TOLERANCE = {
	indexer: 60_000, // ms of wall clock on contract_logs.ts
	vsc: 20, // blocks (~30s of chain)
	hive: 20 // blocks (~60s of chain)
} as const;

export interface ProbeResult {
	url: string;
	/** Category-specific recency: block height, or a timestamp in ms. */
	freshness: number;
	/** Round-trip time of the probe request, the ranking key. */
	latencyMs: number;
	/** Hive only: whether the node serves /health. Undefined elsewhere. */
	healthy?: boolean;
}

type Measurement = Omit<ProbeResult, 'url' | 'latencyMs'>;

/** Run one node's probe under the shared timeout, recording its round trip. */
function probeNode(
	url: string,
	measure: (signal: AbortSignal) => Promise<Measurement>
): Promise<ProbeResult> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
	const started = Date.now();
	return measure(ctrl.signal)
		.then((m) => ({ ...m, url, latencyMs: Date.now() - started }))
		.finally(() => clearTimeout(t));
}

async function postJson(
	url: string,
	body: unknown,
	signal: AbortSignal
): Promise<Record<string, unknown>> {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()) as Record<string, unknown>;
}

/**
 * Fastest node among those that are current, or `nodes[0]` if none answered.
 *
 * Order of precedence: drop stale nodes, then (Hive) prefer nodes that serve
 * /health, then take the lowest latency. Ties keep list order.
 */
export function pickBest(
	nodes: string[],
	results: PromiseSettledResult<ProbeResult>[],
	tolerance: number
): string {
	const answered = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
	if (answered.length === 0) return nodes[0];

	const freshest = Math.max(...answered.map((r) => r.freshness));
	let candidates = answered.filter((r) => r.freshness >= freshest - tolerance);

	// /health is a tie-breaker among equally current nodes, never a reason to
	// accept a stale one — so it is applied after the freshness gate.
	const healthy = candidates.filter((r) => r.healthy !== false);
	if (healthy.length > 0) candidates = healthy;

	return candidates.reduce((a, b) => (b.latencyMs < a.latencyMs ? b : a)).url;
}

export async function probeIndexer(nodes: string[]): Promise<string> {
	const query = 'query{contract_logs(order_by:{ts:desc},limit:1){id log ts}}';
	const results = await Promise.allSettled(
		nodes.map((base) =>
			probeNode(base, async (signal): Promise<Measurement> => {
				const json = (await postJson(
					base.replace(/\/+$/, '') + '/v1/graphql',
					{ query },
					signal
				)) as { data?: { contract_logs?: Array<{ ts?: string }> } };
				const ts = json?.data?.contract_logs?.[0]?.ts;
				if (ts == null) throw new Error('no contract_logs');
				return { freshness: new Date(ts).getTime() };
			})
		)
	);
	return pickBest(nodes, results, FRESHNESS_TOLERANCE.indexer);
}

export async function probeVscApi(nodes: string[]): Promise<string> {
	const query = 'query{localNodeInfo{last_processed_block}}';
	const results = await Promise.allSettled(
		nodes.map((origin) =>
			probeNode(origin, async (signal): Promise<Measurement> => {
				const json = (await postJson(
					origin.replace(/\/+$/, '') + '/api/v1/graphql',
					{ query },
					signal
				)) as { data?: { localNodeInfo?: { last_processed_block?: number } } };
				const blk = json?.data?.localNodeInfo?.last_processed_block;
				if (blk == null) throw new Error('no localNodeInfo');
				return { freshness: Number(blk) };
			})
		)
	);
	return pickBest(nodes, results, FRESHNESS_TOLERANCE.vsc);
}

export async function probeHiveRpc(nodes: string[]): Promise<string> {
	const results = await Promise.allSettled(
		nodes.map((origin) =>
			probeNode(origin, async (signal): Promise<Measurement> => {
				const base = origin.replace(/\/+$/, '');
				let healthy = false;
				try {
					const h = await fetch(base + '/health', { signal });
					healthy = h.ok;
				} catch {
					healthy = false;
				}
				const json = (await postJson(
					base,
					{
						jsonrpc: '2.0',
						method: 'database_api.get_dynamic_global_properties',
						params: {},
						id: 1
					},
					signal
				)) as { result?: { head_block_number?: number } };
				const head = json?.result?.head_block_number;
				if (head == null) throw new Error('no head_block_number');
				return { freshness: Number(head), healthy };
			})
		)
	);
	return pickBest(nodes, results, FRESHNESS_TOLERANCE.hive);
}
