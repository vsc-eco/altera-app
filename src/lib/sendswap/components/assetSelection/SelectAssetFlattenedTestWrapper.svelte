<script lang="ts">
	/**
	 * Test wrapper for SelectAssetFlattened — required because @testing-library/svelte
	 * doesn't let tests directly bind: to a Svelte 5 $bindable prop. The wrapper
	 * forwards `selected` and `max` as bindable so the test scope can observe writes.
	 */
	import SelectAssetFlattened from './SelectAssetFlattened.svelte';
	import type { CoinOnNetwork, Network, Coin } from '$lib/sendswap/utils/sendOptions';
	import type { CoinAmount } from '$lib/currency/CoinAmount';

	let {
		availableCoins,
		selected = $bindable(),
		max = $bindable(),
		close,
		externalNetwork,
		isTo = false,
		dialogTitle
	}: {
		availableCoins: Coin[];
		selected: CoinOnNetwork | undefined;
		max?: CoinAmount<Coin> | undefined;
		close: () => void;
		externalNetwork?: Network;
		isTo?: boolean;
		dialogTitle?: string;
	} = $props();
</script>

<SelectAssetFlattened
	{availableCoins}
	bind:selected
	bind:max
	{close}
	{externalNetwork}
	{isTo}
	{dialogTitle}
/>
