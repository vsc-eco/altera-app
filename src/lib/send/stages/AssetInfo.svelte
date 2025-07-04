<script lang="ts">
	import { isValidBalanceField } from '$lib/stores/balanceHistory';
	import { get } from 'svelte/store';
	import { Network, type Coin, type CoinOptions } from '../sendOptions';
	import InfoSegment from './InfoSegment.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { CoinAmount } from '$lib/currency/CoinAmount';

	let {
		coinOpt,
		network,
		disabledMemo,
		scale = 'small'
	}: {
		coinOpt: CoinOptions['coins'][number];
		network?: Network | undefined;
		disabledMemo?: string;
		scale?: 'small' | 'large';
	} = $props();

	const amount = $derived(
		isValidBalanceField(coinOpt.coin.value) && network?.value === Network.vsc.value
			? get(accountBalance).bal[coinOpt.coin.value]
			: undefined
	);

	let display = $derived.by(() => {
		if (disabledMemo) return [disabledMemo];
		let result = [
			`From ${coinOpt.networks.length} network${coinOpt.networks.length !== 1 ? 's' : ''}`
		];
		if (network)
			result.push(
				amount !== undefined
					? `${new CoinAmount(amount, coinOpt.coin, true).toPrettyAmountString()} on ${network.label}`
					: `On ${network.label}`
			);
		return result;
	});
</script>

<div class="wrapper">
	<img
		src={coinOpt.coin.icon}
		alt={coinOpt.coin.label}
		class={{ large: scale === 'large', gray: disabledMemo !== undefined }}
	/>
	<InfoSegment label={coinOpt.coin.label} {display} disabled={disabledMemo !== undefined} />
</div>

<style>
	img {
		width: 1.5rem;
	}
	img.large {
		width: 2.5rem;
	}
	img.gray {
		filter: grayscale(100%);
	}
	/* img.large {
		width: 3.5rem;
	} */
	.wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-grow: 1;
	}
</style>
