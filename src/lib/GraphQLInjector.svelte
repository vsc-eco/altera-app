<script>
	import { client } from './graphQLClient';
	import { setContextClient } from '@urql/svelte';
	let { children } = $props();
	setContextClient(client);
</script>

{@render children()}
