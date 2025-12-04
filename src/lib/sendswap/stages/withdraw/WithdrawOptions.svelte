<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { ArrowLeft, ChevronRight } from '@lucide/svelte';
	import swapOptions, { Coin, Network, TransferMethod } from '../../utils/sendOptions';
	import { SendTxDetails } from '../../utils/sendUtils';
	import HiveMainnetWithdraw from './HiveMainnetWithdraw.svelte';
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

	let hiveMainnetOpen = $state(false);
	let secondaryMenu = $state(false);

	let toggleHiveMainnet: (open?: boolean) => void = (open = false) => {
		hiveMainnetOpen = open;
	};

	$effect(() => {
		if (!hiveMainnetOpen) return;
		untrack(() => {
			SendTxDetails.update((current) => {
				const hiveCoin = swapOptions.from.coins.find((coinOpt) => 
					coinOpt.coin.value === Coin.hive.value &&
					coinOpt.networks.some(n => n.value === Network.magi.value)
				) || swapOptions.from.coins.find((coinOpt) => 
					coinOpt.coin.value === Coin.hbd.value &&
					coinOpt.networks.some(n => n.value === Network.magi.value)
				);

				let fromCoinToUse = hiveCoin; // default
				if (current.fromCoin && current.fromCoin.networks?.some(n => n.value === Network.magi.value)) {
					fromCoinToUse = current.fromCoin;
				}
				
				return {
					...current,
					method: TransferMethod.magiTransfer,
					fromNetwork: Network.magi,
					fromCoin: fromCoinToUse,
					toNetwork: Network.hiveMainnet,
					toCoin: fromCoinToUse
				};
			});
		});
	});

	$effect(() => {
		onHomePage = hiveMainnetOpen;
	});

</script>

<div class="withdraw-internal-wrapper">
	{#if hiveMainnetOpen}
		{#if !secondaryMenu}
			<PillButton onclick={() => toggleHiveMainnet()} styleType="icon-subtle">
				<ArrowLeft size={32} />
			</PillButton>
			<h2>Hive Mainnet Withdraw</h2>
		{/if}
		<div class={{ 'withdraw-content': !secondaryMenu }}>
			<HiveMainnetWithdraw {editStage} open={hiveMainnetOpen} bind:secondaryMenu />
		</div>
	{:else}
		<h2>Withdraw</h2>
		<div class="types-wrapper">
			<div class="lightning-transfer">
				<ClickableCard disabled={true} onclick={() => {}}>
					<div class="type-header">
						<ImageIconRenderer icon={'/btc/lightning.svg'} alt={'lightning'} size={40} />
						<span>Lightning Transfer</span>
						<span class="error">Coming soon</span>
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
				<ClickableCard disabled={true} onclick={() => {}}>
					<div class="type-header">
						<ImageIconRenderer icon={'/btc/CoinBase_logo.svg'} alt={'Coinbase'} size={40} />
						<span>Coinbase</span>
						<span class="error">Coming soon</span>
						<div class="chevron">
							<ChevronRight />
						</div>
					</div>
				</ClickableCard>
			</div>
			<div class="btc-mainnet">
				<ClickableCard disabled={true} onclick={() => {}}>
					<div class="type-header">
						<ImageIconRenderer icon={'/btc/btc.svg'} alt={'Bitcoin'} size={40} />
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
