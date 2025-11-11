<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { ArrowLeft, ChevronRight } from '@lucide/svelte';
	import swapOptions, { Coin, Network, TransferMethod } from '../../utils/sendOptions';
	import { SendTxDetails } from '../../utils/sendUtils';
	import HiveMainnetWithdraw from './HiveMainnetWithdraw.svelte';
	import LightningWithdraw from './LightningWithdraw.svelte';
	import { untrack, type ComponentProps } from 'svelte';
	import PillButton from '$lib/PillButton.svelte';
	import NavButtons, { type NavButton } from '$lib/sendswap/components/NavButtons.svelte';
	import { getAuth } from '$lib/auth/store';

	let {
		editStage,
		onHomePage = $bindable(),
		customButtons = $bindable()
	}: {
		editStage: (complete: boolean) => void;
		onHomePage: boolean;
		customButtons: ComponentProps<typeof NavButtons>['buttons'] | undefined;
	} = $props();

	const auth = $derived(getAuth()());

	let lightningOpen = $state(false);
	let hiveMainnetOpen = $state(false);

	let toggleLightning: (open?: boolean) => void = (open = false) => {
		lightningOpen = open;
	};
	let toggleHiveMainnet: (open?: boolean) => void = (open = false) => {
		hiveMainnetOpen = open;
	};

	$effect(() => {
		if (!lightningOpen) return;
		untrack(() => {
			toggleHiveMainnet(false);
			$SendTxDetails.method = TransferMethod.lightningTransfer;
			$SendTxDetails.toNetwork = Network.lightning;
			$SendTxDetails.toCoin = swapOptions.to.coins.find(
				(coinOpt) => coinOpt.coin.value === Coin.btc.value
			);
		});
	});

	$effect(() => {
		if (!hiveMainnetOpen) return;
		untrack(() => {
			toggleLightning(false);
			$SendTxDetails.method = TransferMethod.magiTransfer;
			$SendTxDetails.toNetwork = Network.hiveMainnet;
			$SendTxDetails.toCoin = $SendTxDetails.fromCoin;
		});
	});

	$effect(() => {
		onHomePage = lightningOpen || hiveMainnetOpen;
	});
</script>

<div class="withdraw-internal-wrapper">
	{#if lightningOpen}
		<PillButton onclick={() => toggleLightning()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Lightning Withdraw</h2>
		<div class="withdraw-content">
			<LightningWithdraw {editStage} open={lightningOpen} />
		</div>
	{:else if hiveMainnetOpen}
		<PillButton onclick={() => toggleHiveMainnet()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Hive Mainnet Withdraw</h2>
		<div class="withdraw-content">
			<HiveMainnetWithdraw {editStage} open={hiveMainnetOpen} />
		</div>
	{:else}
		<h2>Withdraw</h2>
		<div class="types-wrapper">
			<div class="lightning">
				<ClickableCard onclick={() => toggleLightning(true)}>
					<div class="type-header">
						<ImageIconRenderer
							icon={Network.lightning.icon}
							alt={Network.lightning.label}
							size={40}
						/>
						<span>Lightning Transfer</span>
						<div class="chevron">
							<ChevronRight />
						</div>
					</div>
				</ClickableCard>
			</div>
			<div class="hive-mainnet">
				<ClickableCard onclick={() => toggleHiveMainnet(true)}>
					<div class="type-header">
						<ImageIconRenderer
							icon={Network.hiveMainnet.icon}
							alt={Network.hiveMainnet.label}
							size={40}
						/>
						<span>Hive Mainnet</span>
						<div class="chevron">
							<ChevronRight />
						</div>
					</div>
				</ClickableCard>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.withdraw-internal-wrapper {
		display: flex;
		flex-direction: column;
	}
	.type-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		.chevron {
			margin-left: auto;
		}
	}
	.withdraw-content {
		padding-top: 1rem;
	}
	.types-wrapper {
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
</style>
