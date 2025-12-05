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

	// using .update() here because it doesn't cause multiple state updates to change multiple values
	$effect(() => {
		if (!lightningOpen) return;
		untrack(() => {
			toggleHiveMainnet(false);
			SendTxDetails.update((current) => {
				const btcCoin = swapOptions.from.coins.find((coinOpt) => coinOpt.coin.value === Coin.btc.value);
				const shouldPreserveFromCoin = current.fromCoin && current.fromCoin.networks?.some(n => n.value === Network.lightning.value);
				
				const hiveCoin = swapOptions.to.coins.find((c) => c.coin.value === Coin.hive.value);
				const hbdCoin = swapOptions.to.coins.find((c) => c.coin.value === Coin.hbd.value);
				
				let toCoinToUse = hiveCoin; // default
				if (current.toCoin && 
					(current.toCoin.coin.value === Coin.hive.value || current.toCoin.coin.value === Coin.hbd.value)) {
					toCoinToUse = current.toCoin;
				} else if (current.fromCoin && 
					(current.fromCoin.coin.value === Coin.hive.value || current.fromCoin.coin.value === Coin.hbd.value)) {
					toCoinToUse = current.fromCoin.coin.value === Coin.hive.value ? hiveCoin : hbdCoin;
				}
				
				return {
					...current,
					method: TransferMethod.lightningTransfer,
					fromNetwork: Network.lightning,
					fromCoin: shouldPreserveFromCoin ? current.fromCoin : btcCoin,
					toNetwork: Network.magi,
					toCoin: toCoinToUse
				};
			});
		});
	});

	$effect(() => {
		if (!hiveMainnetOpen) return;
		untrack(() => {
			toggleLightning(false);
			SendTxDetails.update((current) => {
				const hiveCoin = swapOptions.from.coins.find((coinOpt) => 
					coinOpt.coin.value === Coin.hive.value &&
					coinOpt.networks.some(n => n.value === Network.hiveMainnet.value)
				) || swapOptions.from.coins.find((coinOpt) => 
					coinOpt.coin.value === Coin.hbd.value &&
					coinOpt.networks.some(n => n.value === Network.hiveMainnet.value)
				);
				const hbdCoin = swapOptions.from.coins.find((coinOpt) => 
					coinOpt.coin.value === Coin.hbd.value &&
					coinOpt.networks.some(n => n.value === Network.hiveMainnet.value)
				);
				
				let fromCoinToUse = hiveCoin; // default
				if (current.fromCoin && current.fromCoin.networks?.some(n => n.value === Network.hiveMainnet.value)) {
					fromCoinToUse = current.fromCoin;
				} else if (current.toCoin && 
					(current.toCoin.coin.value === Coin.hive.value || current.toCoin.coin.value === Coin.hbd.value)) {
					fromCoinToUse = current.toCoin.coin.value === Coin.hive.value ? hiveCoin : hbdCoin;
				}
				
				return {
					...current,
					method: TransferMethod.magiTransfer,
					fromNetwork: Network.hiveMainnet,
					fromCoin: fromCoinToUse
				};
			});
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
