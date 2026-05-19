const PROBE_TIMEOUT_MS = 3000;

export interface ProbeResult {
	url: string;
	freshness: number;
}

function withTimeout<T>(
	fn: (signal: AbortSignal) => Promise<T>,
	ms = PROBE_TIMEOUT_MS
): Promise<T> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), ms);
	return fn(ctrl.signal).finally(() => clearTimeout(t));
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

/** Highest `freshness` among fulfilled probes; `nodes[0]` if none responded. */
function pickFreshest(
	nodes: string[],
	results: PromiseSettledResult<ProbeResult>[]
): string {
	let best: ProbeResult | null = null;
	for (const r of results) {
		if (r.status === 'fulfilled' && (best === null || r.value.freshness > best.freshness)) {
			best = r.value;
		}
	}
	return best?.url ?? nodes[0];
}

export async function probeIndexer(nodes: string[]): Promise<string> {
	const query = 'query{contract_logs(order_by:{ts:desc},limit:1){id log ts}}';
	const results = await Promise.allSettled(
		nodes.map((base) =>
			withTimeout(async (signal): Promise<ProbeResult> => {
				const json = (await postJson(
					base.replace(/\/+$/, '') + '/v1/graphql',
					{ query },
					signal
				)) as { data?: { contract_logs?: Array<{ ts?: string }> } };
				const ts = json?.data?.contract_logs?.[0]?.ts;
				if (ts == null) throw new Error('no contract_logs');
				return { url: base, freshness: new Date(ts).getTime() };
			})
		)
	);
	return pickFreshest(nodes, results);
}

export async function probeVscApi(nodes: string[]): Promise<string> {
	const query = 'query{localNodeInfo{last_processed_block}}';
	const results = await Promise.allSettled(
		nodes.map((origin) =>
			withTimeout(async (signal): Promise<ProbeResult> => {
				const json = (await postJson(
					origin.replace(/\/+$/, '') + '/api/v1/graphql',
					{ query },
					signal
				)) as { data?: { localNodeInfo?: { last_processed_block?: number } } };
				const blk = json?.data?.localNodeInfo?.last_processed_block;
				if (blk == null) throw new Error('no localNodeInfo');
				return { url: origin, freshness: Number(blk) };
			})
		)
	);
	return pickFreshest(nodes, results);
}

export async function probeHiveRpc(nodes: string[]): Promise<string> {
	const results = await Promise.allSettled(
		nodes.map((origin) =>
			withTimeout(async (signal): Promise<ProbeResult> => {
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
				// Primary rank = head_block_number; /health adds a hair so a
				// healthy node beats an unhealthy one only at equal height.
				return { url: origin, freshness: Number(head) * 10 + (healthy ? 1 : 0) };
			})
		)
	);
	return pickFreshest(nodes, results);
}
