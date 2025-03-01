<script>
	import PillButton from '$lib/PillButton.svelte';
	import { getAuth } from './has';
</script>

<PillButton
	onclick={() => {
		getAuth(async () => 'zphrs');
	}}>Hive Auth</PillButton
>
