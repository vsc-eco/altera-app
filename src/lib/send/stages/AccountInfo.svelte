<script lang="ts">
	import { ArrowRightLeft, BadgeDollarSign } from "@lucide/svelte";
	import { Network, SendAccount, type Coin, type CoinOptions, type IntermediaryNetwork } from "../sendOptions";
	import { sumBalance } from "$lib/stores/balanceHistory";
	import { accountBalance } from "$lib/stores/currentBalance";

    let {
		account,
    } : {
		account: SendAccount;
    } = $props();

	const vsc = Network.vsc;

	let balance = $state(0);
	$effect(() => {
		sumBalance($accountBalance.bal)
		.then((bal) => {
			balance = bal;
		})
	})
</script>

{#snippet accountImg(acc: SendAccount)}
	<div class="icon">
		{#if acc.icon}
			<img src={acc.icon} alt={acc.label} />
		{:else if acc.value === 'deposit'}
			<BadgeDollarSign strokeWidth={1.5} absoluteStrokeWidth={true}/>
		{:else if acc.value === 'swap'}
			<ArrowRightLeft strokeWidth={1.5} absoluteStrokeWidth={true}/>
		{/if}
	</div>
{/snippet}

<div class="wrapper">
    {@render accountImg(account)}
	<div class="name-details">
		<span class="name">
			{account.label}
		</span>
		<div class='details'>
			{#if account.value === 'vsc-account'}
				<span>{balance}</span>
			{:else if account.fee}
				<span>Fee: {account.fee}</span>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.icon {
		img,
		:global(.lucide-icon) {
			width: 2.5rem;
			height: 2.5rem;
		}
	}
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.name-details {
		display: flex;
		flex-direction: column;
	}
	.details {
		text-align: left;
		display: flex;
		flex-direction: row;
		align-items: center;
		margin-top: 0.25rem;
		line-height: 1.2;
		font-size: var(--text-sm);
		margin-top: 0.5rem;
		color: var(--neutral-fg-mid);
	}
</style>