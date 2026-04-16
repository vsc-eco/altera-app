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
	const res = await fetch(getMagiIndexerUrl(), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables })
	});
	const json = await res.json();
	if (json.errors) {
		console.error('Hasura query error:', json.errors);
	}
	return json.data as T;
}
