import { getMagiIndexerUrl } from '../../client';

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
	const res = await fetch(getMagiIndexerUrl(), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables })
	});
	const json = await res.json();
	return { data: (json.data ?? null) as T | null, errors: json.errors ?? null };
}
