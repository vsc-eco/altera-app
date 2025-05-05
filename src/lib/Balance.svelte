<script lang="ts">
	import { GetAccountBalanceStore } from '$houdini';
	import { untrack } from 'svelte';
	let api = $derived(new GetAccountBalanceStore());
	$effect(() => {
		let intervalId = setInterval(() => {
			untrack(() => api).fetch({ variables: { account: 'asf' } });
		}, 1000);
		return () => {
			clearInterval(intervalId);
		};
	});
</script>

{#if $api.data && $api.data.getAccountBalance}
	{$api.data.getAccountBalance?.hbd}
{/if}

<style>
</style>
