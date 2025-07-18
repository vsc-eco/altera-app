<script lang="ts">
	import { ArrowRightLeft, BadgeDollarSign } from "@lucide/svelte";
	import { Coin, Network, SendAccount, type CoinOptions, type IntermediaryNetwork } from "../sendOptions";
	import { isValidBalanceField, sumBalance, type BalanceOption } from "$lib/stores/balanceHistory";
	import { accountBalance } from "$lib/stores/currentBalance";
	import { CoinAmount } from "$lib/currency/CoinAmount";

    let {
		account,
		currentCoin
    } : {
		account: SendAccount;
		currentCoin?: Coin;
    } = $props();

	const vsc = Network.vsc;

	let balanceString = $state('');
	$effect(() => {
		if (currentCoin && isValidBalanceField(currentCoin.value)) {
			const field = currentCoin.value as BalanceOption;
			balanceString = new CoinAmount($accountBalance.bal[field], currentCoin, true).toPrettyString();
		} else {
			sumBalance($accountBalance.bal)
			.then((bal) => {
				const usdAmt = new CoinAmount(bal, Coin.usd).toPrettyAmountString();
				balanceString = `Approx. USD value: \$${usdAmt}`;
			})
		}
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
				<span>{balanceString}</span>
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
		text-align: left;
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