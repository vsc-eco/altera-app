<script lang="ts">
	import { ArrowRightLeft, BadgeDollarSign } from '@lucide/svelte';
	import { Coin, SendAccount } from '$lib/sendswap/utils/sendOptions';
	import { isValidBalanceField, sumBalance, type BalanceOption } from '$lib/stores/balanceHistory';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import InfoSegment from './InfoSegment.svelte';

	let {
		account,
		currentCoin
	}: {
		account: SendAccount;
		currentCoin?: Coin;
	} = $props();

	let balanceString = $state('');
	$effect(() => {
		if (currentCoin && isValidBalanceField(currentCoin.value)) {
			const field = currentCoin.value as BalanceOption;
			balanceString = new CoinAmount(
				$accountBalance.bal[field],
				currentCoin,
				true
			).toPrettyString();
		} else {
			sumBalance($accountBalance.bal).then((bal) => {
				const usdAmt = new CoinAmount(bal, Coin.usd).toPrettyAmountString();
				balanceString = `Approx. USD value: \$${usdAmt}`;
			});
		}
	});
	let display = $derived(
		account.value === SendAccount.vscAccount.value
			? [balanceString]
			: account.fee
				? [account.fee]
				: []
	);
</script>

{#snippet accountImg(acc: SendAccount)}
	<div class="icon">
		{#if acc.icon}
			<img src={acc.icon} alt={acc.label} />
		{:else if acc.value === 'deposit'}
			<BadgeDollarSign strokeWidth={1.5} absoluteStrokeWidth={true} />
		{:else if acc.value === 'swap'}
			<ArrowRightLeft strokeWidth={1.5} absoluteStrokeWidth={true} />
		{/if}
	</div>
{/snippet}

<div class="wrapper">
	{@render accountImg(account)}
	<InfoSegment label={account.label} {display} />
</div>

<style lang="scss">
	.icon {
		img,
		:global(.lucide-icon) {
			width: 1.5rem;
			height: 1.5rem;
		}
	}
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-grow: 1;
	}
</style>
