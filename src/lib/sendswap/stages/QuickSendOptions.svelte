<script lang="ts">
	import { SendTxDetails } from '../utils/sendUtils';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import swapOptions, {
		Coin,
		Network,
		type CoinOnNetwork,
		type CoinOptions
	} from '../utils/sendOptions';
	import { assetCard, type AssetObject } from '../components/info/SendSnippets.svelte';
	import { untrack } from 'svelte';
	import RecipientCard from '../components/RecipientCard.svelte';
	import ContactSearchBox from '../contacts/ContactSearchBox.svelte';
	import SelectContact from '../contacts/SelectContact.svelte';
	import type { Contact } from '../contacts/contacts';
	import PillButton from '$lib/PillButton.svelte';
	import { ArrowLeft, ArrowRightLeft, Coins, Info } from '@lucide/svelte';
	import SelectAssetFlattened from '../components/assetSelection/SelectAssetFlattened.svelte';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import BalanceInfo from '../components/info/BalanceInfo.svelte';
	import EditButton from '$lib/components/EditButton.svelte';
	import Divider from '$lib/components/Divider.svelte';
	import { accountBalance, type AccountBalance } from '$lib/stores/currentBalance';

	let {
		id,
		onHomePage = $bindable(),
		editStage
	}: {
		id: string;
		onHomePage: boolean;
		editStage: (complete: boolean) => void;
	} = $props();
	const auth = $derived(getAuth()());

	// EDIT STAGE
	let toSelf = $derived(
		$SendTxDetails.toUsername === getUsernameFromAuth(auth) &&
			$SendTxDetails.fromNetwork?.value === $SendTxDetails.toNetwork?.value
	);
	$effect(() => {
		if (
			$SendTxDetails.fromCoin &&
			$SendTxDetails.fromNetwork &&
			$SendTxDetails.toAmount &&
			$SendTxDetails.toAmount !== '0' &&
			!toSelf &&
			$SendTxDetails.toUsername &&
			$SendTxDetails.toNetwork
		) {
			editStage(true);
		} else {
			editStage(false);
		}
	});

	// AMOUNT SECTION
	let coinAmount = $state(new CoinAmount(0, Coin.unk));
	$effect(() => {
		if ($SendTxDetails.fromAmount !== coinAmount.toAmountString()) {
			$SendTxDetails.fromAmount = coinAmount.toAmountString();
		}
		if ($SendTxDetails.toAmount !== coinAmount.toAmountString()) {
			$SendTxDetails.toAmount = coinAmount.toAmountString();
		}
	});

	const fromAssetObjs: AssetObject[] = $derived(
		swapOptions.from.coins.map((opt) => ({
			...opt.coin,
			snippet: assetCard,
			snippetData: { fromOpt: opt, net: $SendTxDetails.toNetwork, size: 'medium' }
		}))
	);

	let max: CoinAmount<Coin> | undefined = $state();

	// Update max when fromCoin changes
	$effect(() => {
		if (!$SendTxDetails.fromCoin || !$SendTxDetails.fromNetwork) return;
		if ($SendTxDetails.fromNetwork.value !== Network.magi.value) return;
		
		const coinValue = $SendTxDetails.fromCoin.coin.value;
		if (coinValue in $accountBalance.bal) {
			const balance = $accountBalance.bal[coinValue as keyof AccountBalance];
			max = new CoinAmount(balance, $SendTxDetails.fromCoin.coin, true);
		}
	});

	let assetOpen = $state(false);
	const toggleAsset = (open = false) => {
		assetOpen = open;
	};

	$effect(() => {
		if ($SendTxDetails.toCoin?.coin.value !== $SendTxDetails.fromCoin?.coin.value) {
			$SendTxDetails.toCoin = $SendTxDetails.fromCoin;
		}
	});

	// RECIPIENT SECTION
	let contactOpen = $state(false);
	$effect(() => {
		onHomePage = !contactOpen && !assetOpen;
	});

	// MEMO SECTION
	let memo = $state('');

	let contact = $state<Contact>();
	const toggleContact = (open = false) => {
		contactOpen = open;
	};
	let createNew: string | undefined = $derived(
		!contact && $SendTxDetails.toUsername ? $SendTxDetails.toUsername : undefined
	);
	let openToCreate = $state(false);
	function openContact(create = false) {
		openToCreate = create;
		toggleContact(true);
	}
	let inputId = $state('');

	const inputCoinOpt: CoinOnNetwork[] = $derived(
		$SendTxDetails.fromCoin && $SendTxDetails.fromNetwork
			? [{ coin: $SendTxDetails.fromCoin.coin, network: $SendTxDetails.fromNetwork }]
			: [{ coin: Coin.unk, network: Network.unknown }]
	);

	const coinsWithBalance = $derived.by(() => {
		const result: Array<{ coin: Coin; coinOpt: CoinOptions['coins'][number] }> = [];
		for (const coinOpt of swapOptions.from.coins) {
			const coinValue = coinOpt.coin.value;
			if (coinValue in $accountBalance.bal) {
				const balance = $accountBalance.bal[coinValue as keyof AccountBalance];
				const coinAmt = new CoinAmount(balance, coinOpt.coin, true);
				if (coinAmt.amount > 0.001) {
					result.push({ coin: coinOpt.coin, coinOpt });
				}
			}
		}
		return result;
	});

	const hasAnyBalance = $derived(coinsWithBalance.length > 0);

	$effect(() => {
		const balanceCount = coinsWithBalance.length;
		if (balanceCount === 0) return;
		
		const currentCoinHasBalance = $SendTxDetails.fromCoin && 
			coinsWithBalance.some((item) => item.coin.value === $SendTxDetails.fromCoin?.coin.value);
		
		if (currentCoinHasBalance) return;
		
		const hiveCoin = coinsWithBalance.find((item) => item.coin.value === Coin.hive.value);
		const coinToSelect = hiveCoin || coinsWithBalance[0];
		
		if (coinToSelect) {
			$SendTxDetails.fromCoin = coinToSelect.coinOpt;
			$SendTxDetails.fromNetwork = Network.magi;
			$SendTxDetails.toCoin = coinToSelect.coinOpt;
			$SendTxDetails.toNetwork = Network.magi;
		}
	});
</script>

{#if contactOpen}
	<div class="contact-external-wrapper">
		<div class="back-button">
			<PillButton onclick={() => toggleContact()} styleType="icon-subtle">
				<ArrowLeft size="32" />
			</PillButton>
		</div>
		<SelectContact
			bind:selectedContact={contact}
			editing={openToCreate}
			close={() => (contactOpen = false)}
			{createNew}
		/>
	</div>
{:else if assetOpen}
	<div class="back-button">
		<PillButton onclick={() => toggleAsset()} styleType="icon-subtle">
			<ArrowLeft size="32" />
		</PillButton>
	</div>
	<SelectAssetFlattened
		availableCoins={fromAssetObjs}
		close={toggleAsset}
		bind:coin={$SendTxDetails.fromCoin}
		bind:network={$SendTxDetails.fromNetwork}
		bind:max
	/>
{/if}
<!-- keep this always rendered so that it doesn't break amount input reactivity -->
<div class={['mainopts', { hide: contactOpen || assetOpen }]}>
	<h2>Send</h2>
	<div class="sections">
		<div class="section to">
			<ContactSearchBox
				bind:value={$SendTxDetails.toUsername}
				bind:selectedContact={contact}
				placeholder="Enter address"
			/>
			<RecipientCard basic edit={openContact} {contact} />
			{#if toSelf}
				<span class="error">
					Cannot make an internal transfer to yourself, please select a different recipient.
				</span>
			{/if}
		</div>
		<Divider text="Amount" />
		<ClickableCard onclick={() => hasAnyBalance && toggleAsset(true)}>
			<div class="asset-card">
				{#if !hasAnyBalance}
					<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
					<div class="warning-text">
						No balance found on your account. Please make a deposit to get started.
					</div>
				{:else if $SendTxDetails.fromCoin && $SendTxDetails.fromNetwork}
					<BalanceInfo
						coin={$SendTxDetails.fromCoin.coin}
						network={$SendTxDetails.fromNetwork}
						size="large"
						styleType="vertical"
					/>
					<!-- <AssetInfo coinOpt={$SendTxDetails.fromCoin} size="medium" /> -->
				{:else}
					<span class="user-icon-placeholder"><Coins size="40" absoluteStrokeWidth={true} /></span>
					Select Asset
				{/if}
				{#if hasAnyBalance}
					<span class="more">
						<EditButton onclick={() => toggleAsset(true)} />
					</span>
				{/if}
			</div>
		</ClickableCard>
		<div class="section">
			<div class="amount-row">
				<div class="amount-input">
					<AmountInput
						bind:coinAmount
						coinOpts={inputCoinOpt}
						expressIn={$SendTxDetails.fromCoin?.coin}
						maxAmount={max}
						bind:id={inputId}
					/>
				</div>
			</div>
		</div>
		<Divider text="Details" />
		<div class="section memo">
			<span class="sm-caption">Memo (optional)</span>
			<input
				bind:value={memo}
				maxlength="300"
				onchange={() => {
					$SendTxDetails.memo = memo;
				}}
				id="memo-input"
			/>
		</div>
		<div class="section note sm-caption">
			<div class="info-icon">
				<Info size={16} />
			</div>
			<div class="info-text">
				Quick send is designed for easy internal transfers. To make an external transfer, please use
				the <a href="/transfer">transfer page</a>.
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	.mainopts.hide {
		display: none;
	}
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.to {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.asset-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem;
		.more {
			margin-left: auto;
		}
		.warning-text {
			color: var(--secondary-fg-mid, #888);
			font-size: 0.875rem;
			line-height: 1.4;
		}
	}
	.memo {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.note {
		display: flex;
		align-items: flex-start;
		gap: 0.25rem;
		.info-text {
			line-height: 1.2;
		}
	}
	.contact-external-wrapper:not(:has(:global(.dialog-list-header))) {
		.back-button {
			display: none;
		}
	}
</style>
