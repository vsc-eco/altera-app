<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import PillButton from '$lib/PillButton.svelte';
	import SelectAssetFlattened from '$lib/sendswap/components/assetSelection/SelectAssetFlattened.svelte';
	import BalanceInfo from '$lib/sendswap/components/info/BalanceInfo.svelte';
	import { assetCard, type AssetObject } from '$lib/sendswap/components/info/SendSnippets.svelte';
	import Instructions from '$lib/sendswap/components/Instructions.svelte';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork,
		type CoinOptions
	} from '$lib/sendswap/utils/sendOptions';
	import { useTxState } from '$lib/sendswap/utils/txState.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import Select from '$lib/zag/Select.svelte';
	import { ArrowLeft, ArrowRightLeft, Coins } from '@lucide/svelte';
	import { untrack, type ComponentProps } from 'svelte';

	let {
		editStage,
		open,
		secondaryMenu = $bindable()
	}: { editStage: (complete: boolean) => void; open: boolean; secondaryMenu: boolean } = $props();

	const txState = useTxState();
	const auth = $derived(getAuth()());

	let coinAmount = $state(new CoinAmount(0, Coin.unk));
	let inputId = $state('');

	// Sync coinAmount → store. Only tracks `coinAmount` and `open`.
	let lastSyncedAmt = '';
	$effect(() => {
		if (!open) return;
		const amt = coinAmount.toAmountString();
		if (amt === lastSyncedAmt) return;
		lastSyncedAmt = amt;
		txState.fromAmount = amt;
		txState.toAmount = amt;
		txState.enteredAmount = amt;
	});

	let max = $state(new CoinAmount(0, Coin.hive));

	// Update max when fromCoin or connectedBal changes (skip while asset picker is open)
	$effect(() => {
		if (assetOpen) return;
		const fromCoin = txState.fromCoin;
		const fromNetwork = txState.fromNetwork;
		if (!open || !fromCoin || !fromNetwork) return;
		if (fromNetwork.value !== Network.hiveMainnet.value) return;

		const coinValue = fromCoin.coin.value;
		if (coinValue === Coin.hive.value || coinValue === Coin.hbd.value) {
			const balance = $accountBalance.connectedBal?.[coinValue as 'hive' | 'hbd'];
			if (balance !== undefined) {
				max = new CoinAmount(balance, fromCoin.coin, true);
			}
		}
	});

	// Validation — fromCoin/toCoin/fromNetwork are set by the parent (DepositOptions),
	// so only check the user-controlled inputs: amount > 0 and within balance.
	$effect(() => {
		if (!open) return;
		const amt = coinAmount.amount;
		const maxAmt = max?.amount ?? Number.MAX_SAFE_INTEGER;
		editStage(amt > 0 && amt <= maxAmt);
	});

	const unkOpt = { coin: Coin.unk, network: Network.unknown };
	const coinOptions: CoinOnNetwork[] = $derived(
		txState.fromCoin && txState.fromNetwork
			? [{ coin: txState.fromCoin.coin, network: txState.fromNetwork }]
			: [unkOpt]
	);

	let assetOpen = $state(false);
	function toggleAsset(open = false) {
		assetOpen = open;
		// When closing asset picker, sync toCoin to match the newly selected fromCoin
		if (!open) {
			if (txState.fromCoin && txState.toCoin?.coin?.value !== txState.fromCoin?.coin?.value) {
				txState.toCoin = txState.fromCoin;
			}
		}
	}
	$effect(() => {
		secondaryMenu = assetOpen;
	});
</script>

{#if assetOpen}
	<div class="back-button">
		<PillButton onclick={() => toggleAsset()} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
	</div>
	<SelectAssetFlattened
		availableCoins={[]}
		close={toggleAsset}
		bind:coin={txState.fromCoin}
		bind:network={txState.fromNetwork}
		bind:max
		externalNetwork={Network.hiveMainnet}
	/>
{:else if auth.value?.provider === 'aioha'}
	<div class="sections">
		<div class="section">
			<label for="asset-card">Deposit From</label>
			<ClickableCard onclick={() => toggleAsset(true)}>
				<div class="asset-card">
					{#if txState.fromCoin && txState.fromNetwork}
						<BalanceInfo
							coin={txState.fromCoin.coin}
							network={txState.fromNetwork}
							size="large"
							styleType="vertical"
						/>
						<!-- <AssetInfo coinOpt={txState.fromCoin} size="medium" /> -->
					{:else}
						<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span
						>
						Select Asset
					{/if}
					<span class="edit"> Edit </span>
				</div>
			</ClickableCard>
		</div>
		<div class="section">
			<label for={inputId}>Amount</label>
			<div class="amount-row">
				<div class="amount-input">
					<AmountInput
						bind:coinAmount
						coinOpts={coinOptions}
						expressIn={txState.fromCoin?.coin}
						maxAmount={max}
						bind:id={inputId}
					/>
				</div>
			</div>
		</div>
	</div>
{:else}
	<Instructions />
{/if}

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.amount-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		.amount-input {
			flex-grow: 1;
			height: 65px;
		}
	}
	.asset-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem;
		.edit {
			margin-left: auto;
		}
	}
</style>
