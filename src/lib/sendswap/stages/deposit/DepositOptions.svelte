<script lang="ts">
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import Collapsible from '$lib/zag/Collapsible.svelte';
	import swapOptions, { Coin, Network, TransferMethod } from '../../utils/sendOptions';
	import { SendTxDetails } from '../../utils/sendUtils';
	import HiveMainnetDeposit from './HiveMainnetDeposit.svelte';
	import LightningDeposit from './LightningDeposit.svelte';
	import { untrack, type ComponentProps } from 'svelte';

	let { next }: { next: () => void } = $props();

	let toggleLightning: (open?: boolean) => void = $state(() => {});
	let toggleHiveMainnet: (open?: boolean) => void = $state(() => {});

	let lightningOpen = $state(true);
	let hiveMainnetOpen = $state(false);

	$effect(() => {
		if (!lightningOpen) return;
		untrack(() => {
			toggleHiveMainnet(false);
			$SendTxDetails.method = TransferMethod.lightningTransfer;
			$SendTxDetails.fromNetwork = Network.lightning;
			$SendTxDetails.fromCoin = swapOptions.from.coins.find(
				(coinOpt) => coinOpt.coin.value === Coin.btc.value
			);
		});
	});

	$effect(() => {
		if (!hiveMainnetOpen) return;
		untrack(() => {
			toggleLightning(false);
			$SendTxDetails.method = TransferMethod.vscTransfer;
			$SendTxDetails.fromNetwork = Network.hiveMainnet;
			$SendTxDetails.fromCoin = $SendTxDetails.toCoin;
		});
	});
</script>

<h2>Deposit</h2>
<div class="deposit-internal-wrapper">
	<div class="lightning">
		<Collapsible initialOpen bind:toggle={toggleLightning} bind:open={lightningOpen}>
			<div class="lightning-header">
				<ImageIconRenderer icon={Network.lightning.icon} alt={Network.lightning.label} size={40} />
				<span>Lightning Transfer</span>
			</div>

			{#snippet content()}
				<LightningDeposit {next} open={lightningOpen} />
			{/snippet}
		</Collapsible>
	</div>
	<div class="hive-mainnet">
		<Collapsible bind:toggle={toggleHiveMainnet} bind:open={hiveMainnetOpen}>
			<div class="lightning-header">
				<ImageIconRenderer
					icon={Network.hiveMainnet.icon}
					alt={Network.hiveMainnet.label}
					size={40}
				/>
				<span>Hive Mainnet</span>
			</div>
			{#snippet content()}
				<HiveMainnetDeposit {next} open={hiveMainnetOpen} />
			{/snippet}
		</Collapsible>
	</div>
</div>

<style lang="scss">
	.lightning-header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.deposit-internal-wrapper {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
</style>
