<script lang="ts">
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import ImageIconRenderer from '$lib/components/ImageIconRenderer.svelte';
	import { ArrowLeft, ChevronRight } from '@lucide/svelte';
	import swapOptions, { getToOption, Coin, Network } from '../../utils/sendOptions';
	import { scanForBalance } from '../../utils/sendUtils';
	import { useWithdrawState } from '../../utils/txState.svelte';
	import HiveMainnetWithdraw from './HiveMainnetWithdraw.svelte';
	import BitcoinMainnetWithdraw from './BitcoinMainnetWithdraw.svelte';
	import KeepsatsWithdraw from './KeepsatsWithdraw.svelte';
	import { untrack, type ComponentProps } from 'svelte';
	import PillButton from '$lib/PillButton.svelte';
	import NavButtons from '$lib/sendswap/components/NavButtons.svelte';

	let {
		editStage,
		isActive = true,
		onHomePage = $bindable(),
		customButtons = $bindable()
	}: {
		editStage: (complete: boolean) => void;
		isActive?: boolean;
		onHomePage: boolean;
		customButtons: ComponentProps<typeof NavButtons>['buttons'] | undefined;
	} = $props();

	const txState = useWithdrawState();

	let hiveMainnetOpen = $state(false);
	let btcMainnetOpen = $state(false);
	let lightningTransferOpen = $state(false);
	let secondaryMenu = $state(false);

	let toggleHiveMainnet: (open?: boolean) => void = (open = false) => {
		hiveMainnetOpen = open;
	};
	let toggleBtcMainnet: (open?: boolean) => void = (open = false) => {
		btcMainnetOpen = open;
	};
	let toggleLightningTransfer: (open?: boolean) => void = (open = false) => {
		lightningTransferOpen = open;
	};

	$effect(() => {
		if (!hiveMainnetOpen) return;
		untrack(() => {
			const hiveCoin =
				swapOptions.from.find(
					(coinOpt) =>
						coinOpt.coin.value === Coin.hive.value &&
						coinOpt.networks.some((n) => n.value === Network.magi.value)
				) ||
				swapOptions.from.find(
					(coinOpt) =>
						coinOpt.coin.value === Coin.hbd.value &&
						coinOpt.networks.some((n) => n.value === Network.magi.value)
				);
			const hbdCoin = swapOptions.from.find(
				(coinOpt) =>
					coinOpt.coin.value === Coin.hbd.value &&
					coinOpt.networks.some((n) => n.value === Network.magi.value)
			);

			const hiveHasBalance = !!(
				hiveCoin && scanForBalance([{ coin: hiveCoin.coin, network: Network.magi }]) !== undefined
			);
			const hbdHasBalance = !!(
				hbdCoin && scanForBalance([{ coin: hbdCoin.coin, network: Network.magi }]) !== undefined
			);

			// Prefer the user's current selection if it's a valid Magi HIVE/HBD;
			// otherwise default by balance.
			let coinToUse: Coin | undefined = hiveHasBalance
				? hiveCoin?.coin
				: hbdHasBalance
					? hbdCoin?.coin
					: hiveCoin?.coin;
			if (
				txState.from &&
				txState.from.network.value === Network.magi.value &&
				(txState.from.coin.value === Coin.hive.value ||
					txState.from.coin.value === Coin.hbd.value)
			) {
				coinToUse = txState.from.coin;
			}

			txState.rail = Network.magi;
			txState.from = coinToUse ? { coin: coinToUse, network: Network.magi } : undefined;
			txState.to = coinToUse ? { coin: coinToUse, network: Network.hiveMainnet } : undefined;
		});
	});

	$effect(() => {
		if (!btcMainnetOpen) return;
		untrack(() => {
			const btcCoin = swapOptions.from.find(
				(coinOpt) =>
					coinOpt.coin.value === Coin.btc.value &&
					coinOpt.networks.some((n) => n.value === Network.magi.value)
			);
			txState.rail = Network.magi;
			txState.from = btcCoin ? { coin: btcCoin.coin, network: Network.magi } : undefined;
			txState.to = btcCoin ? { coin: btcCoin.coin, network: Network.btcMainnet } : undefined;
		});
	});

	$effect(() => {
		if (!lightningTransferOpen) return;
		untrack(() => {
			const btcCoinFrom = swapOptions.from.find(
				(coinOpt) =>
					coinOpt.coin.value === Coin.btc.value &&
					coinOpt.networks.some((n) => n.value === Network.magi.value)
			);
			// Find BTC in to-coins without requiring lightning in networks,
			// since lightning is the toNetwork and is set separately below.
			const btcCoinTo = getToOption(Coin.btc.value);
			txState.rail = Network.lightning;
			txState.from = btcCoinFrom ? { coin: btcCoinFrom.coin, network: Network.magi } : undefined;
			txState.to = btcCoinTo ? { coin: btcCoinTo.coin, network: Network.lightning } : undefined;
		});
	});

	$effect(() => {
		onHomePage = hiveMainnetOpen || btcMainnetOpen || lightningTransferOpen;
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
			<HiveMainnetWithdraw {editStage} open={hiveMainnetOpen && isActive} bind:secondaryMenu />
		</div>
	{:else if btcMainnetOpen}
		<PillButton onclick={() => toggleBtcMainnet()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Bitcoin Mainnet Withdraw</h2>
		<div class="withdraw-content">
			<BitcoinMainnetWithdraw {editStage} open={btcMainnetOpen && isActive} />
		</div>
	{:else if lightningTransferOpen}
		<PillButton onclick={() => toggleLightningTransfer()} styleType="icon-subtle">
			<ArrowLeft size={32} />
		</PillButton>
		<h2>Keepsats on V4VApp Withdraw</h2>
		<div class="withdraw-content">
			<KeepsatsWithdraw {editStage} open={lightningTransferOpen && isActive} />
		</div>
	{:else}
		<h2>Withdraw</h2>
		<div class="types-wrapper">
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
			<div class="btc-mainnet">
				<ClickableCard onclick={() => toggleBtcMainnet(true)}>
					<div class="type-header">
						<ImageIconRenderer
							icon={Network.btcMainnet.icon}
							alt={Network.btcMainnet.label}
							size={40}
						/>
						<span>Bitcoin Mainnet</span>
						<div class="chevron">
							<ChevronRight />
						</div>
					</div>
				</ClickableCard>
			</div>
			<div class="coinbase">
				<ClickableCard disabled={true} onclick={() => {}}>
					<div class="type-header">
						<ImageIconRenderer icon="/btc/CoinBase_logo.svg" alt="Coinbase" size={40} />
						<span>Coinbase</span>
						<span class="error">Coming soon</span>
						<div class="chevron">
							<ChevronRight />
						</div>
					</div>
				</ClickableCard>
			</div>
			<div class="lightning-transfer">
				<ClickableCard onclick={() => toggleLightningTransfer(true)}>
					<div class="type-header">
						<ImageIconRenderer icon="/btc/lightning.svg" alt="lightning" size={40} />
						<span>Lightning Transfer</span>
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
