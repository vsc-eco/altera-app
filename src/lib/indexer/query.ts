import { getMagiIndexerBaseUrl, GQL_PROXY_INDEXER, gqlUpstreamHeaders } from '../../client';

export interface AggregateResult {
	aggregate: {
		count?: number;
		sum?: Record<string, number | null>;
	};
}

/** Execute a GraphQL query against the Magi Hasura indexer. */
export async function hasuraQuery<T = Record<string, unknown>>(
	query: string,
	variables: Record<string, unknown>
): Promise<T> {
	const { data, errors } = await hasuraQueryRaw<T>(query, variables);
	if (errors) console.error('Hasura query error:', errors);
	return data as T;
}

/**
 * Raw variant that surfaces `errors` alongside `data` so callers can react to
 * specific schema-level failures (e.g. retry without a column that's missing
 * in some indexer environments).
 */
export async function hasuraQueryRaw<T = Record<string, unknown>>(
	query: string,
	variables: Record<string, unknown>
): Promise<{ data: T | null; errors: Array<{ message: string }> | null }> {
	const res = await fetch(GQL_PROXY_INDEXER, {
		method: 'POST',
		headers: gqlUpstreamHeaders(getMagiIndexerBaseUrl()),
		body: JSON.stringify({ query, variables })
	});
	const json = await res.json();
	return { data: (json.data ?? null) as T | null, errors: json.errors ?? null };
}

/**
 * Fetch every row of an indexer event table, page by page.
 *
 * Hasura row limits are per-role and differ per indexer: the public role on
 * some nodes caps a selection at 100 rows while ours is uncapped. Anything
 * that sums rows client-side is therefore at the mercy of whichever node the
 * user picked (see the `fetchPoolFees` comment for the bug that caused), so
 * pages are walked until a request comes back empty rather than until a page
 * looks short — that terminates correctly whether the node hands back 1000
 * rows or clamps us to 100.
 *
 * `order_by` is always (indexer_ts, indexer_id): offset paging over a
 * non-unique sort key can skip or repeat rows across page boundaries, and
 * `indexer_ts` has second granularity, so same-second events are common.
 */
export async function fetchAllEventRows<T>(
	table: string,
	fields: string,
	where: Record<string, unknown>,
	pageSize = 1000,
	maxPages = 60
): Promise<T[]> {
	const out: T[] = [];
	for (let page = 0; page < maxPages; page++) {
		const query = `
			query AllRows($where: ${table}_bool_exp!, $limit: Int!, $offset: Int!) {
				${table}(
					where: $where
					order_by: [{ indexer_ts: asc }, { indexer_id: asc }]
					limit: $limit
					offset: $offset
				) { ${fields} }
			}
		`;
		const data = await hasuraQuery<Record<string, T[]>>(query, {
			where,
			limit: pageSize,
			offset: out.length
		});
		const rows = data?.[table] ?? [];
		if (rows.length === 0) return out;
		out.push(...rows);
	}
	console.warn(`fetchAllEventRows(${table}) hit the ${maxPages}-page ceiling; data is truncated`);
	return out;
}
