<script lang="ts">
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { accountBalance } from '$lib/stores/currentBalance';

	type Props = {
		coin: Coin;
		network: Network;
		size?: 'small' | 'medium' | 'large';
		styleType?: 'horizontal' | 'vertical' | 'quiet';
	};
	let { coin, network, size = 'small', styleType = 'horizontal' }: Props = $props();

	const balance = $derived.by(() => {
		if (network.value === Network.vsc.value) {
			if (coin.value in $accountBalance.bal) {
				return new CoinAmount(
					$accountBalance.bal[coin.value as keyof typeof $accountBalance.bal],
					coin,
					true
				).toMinFigs();
			}
		} else {
			if ($accountBalance.connectedBal && coin.value in $accountBalance.connectedBal) {
				return new CoinAmount(
					$accountBalance.connectedBal[coin.value as keyof typeof $accountBalance.connectedBal],
					coin,
					true
				).toMinFigs();
			}
		}
	});
</script>

<div class={['asset-balance', { vertical: styleType === 'vertical', large: size === 'large' }]}>
	<span class="coin-icon" style="height: {size === 'large' ? 40 : 24};">
		{#if size !== 'small'}
			<CoinNetworkIcon {coin} {network} size={size === 'medium' ? 24 : 40} />
		{:else}
			<img src={coin.icon} alt={coin.label} width={24} />
		{/if}
	</span>
	{#if styleType !== 'vertical'}
		<span class="coin-label">
			{coin.label}
			<span class="sm-caption">on {network.label}</span>
		</span>
		{#if styleType === 'horizontal'}
			<span class="balance mono">{balance}</span>
		{/if}
	{:else}
		<span class="coin-label">
			{coin.label}
		</span>
		<span class="balance sm-caption">{balance} on {network.label}</span>
	{/if}
</div>

<style lang="scss">
	.asset-balance {
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-areas: 'coin-icon coin-label balance-cell';
		align-items: center;
		gap: 0 0.5rem;
		flex-grow: 1;
		.coin-icon {
			grid-area: coin-icon;
		}
		.coin-label {
			grid-area: coin-label;
			text-align: left;
		}
		.balance {
			grid-area: balance-cell;
		}
		&.vertical {
			justify-content: start;
			grid-template-columns: auto auto;
			grid-template-areas:
				'coin-icon coin-label'
				'coin-icon balance-cell';
		}
		&.large {
			gap: 0 1rem;
		}
	}
</style>
