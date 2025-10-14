<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { ArrowLeft, ChevronRight } from '@lucide/svelte';
	import swapOptions, { Coin, Network, TransferMethod } from '../../utils/sendOptions';
	import { SendTxDetails } from '../../utils/sendUtils';
	import HiveMainnetDeposit from './HiveMainnetDeposit.svelte';
	import CoinBaseDeposit from './CoinBaseDeposit.svelte';
	import LightningDeposit from './LightningDeposit.svelte';
	import { untrack, type ComponentProps } from 'svelte';
	import PillButton from '$lib/PillButton.svelte';
	import NavButtons, { type NavButton } from '$lib/sendswap/components/NavButtons.svelte';

	let {
		editStage,
		onHomePage = $bindable(),
		customButtons = $bindable()
	}: {
		editStage: (complete: boolean) => void;
		onHomePage: boolean;
		customButtons: ComponentProps<typeof NavButtons>['buttons'] | undefined;
	} = $props();

	let toggleLightning: (open?: boolean) => void = (open = false) => {
		lightningOpen = open;
	};
	let toggleHiveMainnet: (open?: boolean) => void = (open = false) => {
		hiveMainnetOpen = open;
	};
	let toggleCoinbase: (open?: boolean) => void = (open = false) => {
		coinbaseOpen = open;
	};

	let lightningOpen = $state(false);
	let hiveMainnetOpen = $state(false);
	let coinbaseOpen = $state(false);

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

	$effect(() => {
		onHomePage = lightningOpen || hiveMainnetOpen || coinbaseOpen;
	});

	let customButton: NavButton = $state({ label: '', action: () => {} });
	$effect(() => {
		if (coinbaseOpen && customButton) {
			customButtons = {
				fwd: customButton
			};
		} else {
			customButtons = undefined;
		}
	});
</script>

<div class="deposit-internal-wrapper">
	{#if lightningOpen}
		<PillButton onclick={() => toggleLightning()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Lightning Deposit</h2>
		<div class="deposit-content">
			<LightningDeposit {editStage} open={lightningOpen} />
		</div>
	{:else if hiveMainnetOpen}
		<PillButton onclick={() => toggleHiveMainnet()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Hive Mainnet Deposit</h2>
		<div class="deposit-content">
			<HiveMainnetDeposit {editStage} open={hiveMainnetOpen} />
		</div>
	{:else if coinbaseOpen}
		<PillButton onclick={() => toggleCoinbase()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Coinbase Deposit</h2>
		<div class="deposit-content">
			<CoinBaseDeposit bind:customButton />
		</div>
	{:else}
		<h2>Deposit</h2>
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
			<div class="coinbase">
				<ClickableCard onclick={() => toggleCoinbase(true)}>
					<div class="type-header">
						<ImageIconRenderer icon="/hive/CoinBase_logo.svg" alt="Coinbase" size={40} />
						<span>Coinbase</span>
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
	.deposit-internal-wrapper {
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
	.deposit-content {
		padding-top: 1rem;
	}
	.types-wrapper {
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
</style>
