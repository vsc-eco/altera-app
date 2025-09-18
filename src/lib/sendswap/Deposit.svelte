<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import Dialog from '$lib/zag/Dialog.svelte';
	import DepositOptions from './stages/deposit/DepositOptions.svelte';
	import { Coin, Network, type SendDetails } from './utils/sendOptions';
	import { blankDetails, SendTxDetails } from './utils/sendUtils';

	let {
		dialogOpen = $bindable(),
		toggle = $bindable(),
		sessionId
	} = $props<{
		dialogOpen: boolean;
		toggle: (open?: boolean) => void;
		sessionId: number;
	}>();

	const auth = $derived(getAuth()());

	function startDetails(): SendDetails {
		return {
			...blankDetails(),
			toNetwork: Network.vsc
		};
	}
	SendTxDetails.set(startDetails());
	$effect(() => {
		// sets username for swap
		if (auth.value) {
			const username = getUsernameFromAuth(auth);
			if (username) $SendTxDetails.toUsername = username;
		}
	});
</script>

{#snippet options()}
	<DepositOptions />
{/snippet}

<Dialog bind:toggle bind:open={dialogOpen}>
	{#snippet content()}
		{#key sessionId}
			<div class="content">
				{@render options()}
			</div>
		{/key}
	{/snippet}
</Dialog>

<div class="deposit-internal-wrapper"></div>

<style lang="scss">
	.content {
		width: 32rem;
		min-width: min-content;
	}
</style>
