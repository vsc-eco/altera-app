<script>
	import { client } from './graphQLClient';
	import { setContextClient } from '@urql/svelte';

	setContextClient(client);
</script>
