import { Client, cacheExchange, fetchExchange } from '@urql/svelte';

export const client = new Client({
	url: 'http://localhost:3000/graphql',
	exchanges: [cacheExchange, fetchExchange]
});
