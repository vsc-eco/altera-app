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
	import BtcMainnetDeposit from './BitcoinMainnetDeposit.svelte';
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
	let coinbaseOpen = $state(false);
	let bitcoinMainnetOpen = $state(false);

	let toggleLightning: (open?: boolean) => void = (open = false) => {
		lightningOpen = open;
	};
	let toggleHiveMainnet: (open?: boolean) => void = (open = false) => {
		hiveMainnetOpen = open;
	};
	let toggleCoinbase: (open?: boolean) => void = (open = false) => {
		coinbaseOpen = open;
	};
	let toggleBitcoinMainnet: (open?: boolean) => void = (open = false) => {
		bitcoinMainnetOpen = open;
	};

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
			$SendTxDetails.method = TransferMethod.magiTransfer;
			$SendTxDetails.fromNetwork = Network.hiveMainnet;
			$SendTxDetails.fromCoin = $SendTxDetails.toCoin;
		});
	});

	$effect(() => {
		onHomePage =
			lightningOpen || (hiveMainnetOpen && auth.value?.provider === 'aioha') || coinbaseOpen;
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

	let secondaryMenu = $state(false);
</script>

<div class="deposit-internal-wrapper">
	{#if lightningOpen}
		{#if !secondaryMenu}
			<PillButton onclick={() => toggleLightning()} styleType="icon-subtle">
				<ArrowLeft size={32} />
			</PillButton>
			<h2>Lightning Deposit</h2>
		{/if}
		<div class={{ 'deposit-content': !secondaryMenu }}>
			<LightningDeposit {editStage} open={lightningOpen} bind:secondaryMenu />
		</div>
	{:else if hiveMainnetOpen}
		{#if !secondaryMenu}
			<PillButton onclick={() => toggleHiveMainnet()} styleType="icon-subtle">
				<ArrowLeft size={32} />
			</PillButton>
			<h2>Hive Mainnet Deposit</h2>
		{/if}
		<div class={{ 'deposit-content': !secondaryMenu }}>
			<HiveMainnetDeposit {editStage} open={hiveMainnetOpen} bind:secondaryMenu />
		</div>
	{:else if coinbaseOpen}
		<PillButton onclick={() => toggleCoinbase()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Coinbase Deposit</h2>
		<div class="deposit-content">
			<CoinBaseDeposit bind:customButton />
		</div>
	{:else if bitcoinMainnetOpen}
		<PillButton onclick={() => toggleBitcoinMainnet()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Bitcoin Mainnet Deposit</h2>
		<div class="deposit-content">
			<BtcMainnetDeposit />
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
						<ImageIconRenderer icon="/btc/CoinBase_logo.svg" alt="Coinbase" size={40} />
						<span>Coinbase</span>
						<div class="chevron">
							<ChevronRight />
						</div>
					</div>
				</ClickableCard>
			</div>
			<div class="bitcoin-mainnet">
				<ClickableCard onclick={() => toggleBitcoinMainnet(true)} disabled={true}>
					<div class="type-header">
						<ImageIconRenderer
							icon={Network.btcMainnet.icon}
							alt={Network.btcMainnet.label}
							size={40}
						/>
						<span>Bitcoin Mainnet</span>
						<span class="error">Coming soon</span>
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
