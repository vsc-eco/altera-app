<script lang="ts">
	import { SendTxDetails } from '../utils/sendUtils';
	import { getAuth } from '$lib/auth/store';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import swapOptions, { Coin, Network, type CoinOptions } from '../utils/sendOptions';
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
	let amount = $state('');
	$effect(() => {
		if ($SendTxDetails.fromAmount !== amount) {
			$SendTxDetails.fromAmount = amount;
		}
		if ($SendTxDetails.toAmount !== amount) {
			$SendTxDetails.toAmount = amount;
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
{:else}
	<h2>Send</h2>
	<div class="sections">
		<div class="section to">
			<ContactSearchBox
				bind:value={$SendTxDetails.toUsername}
				bind:selectedContact={contact}
				enableContacts={false}
				placeholder="Enter address"
			/>
			<RecipientCard basic edit={openContact} {contact} />
		</div>
		<Divider text="Amount" />
		<ClickableCard onclick={() => toggleAsset(true)}>
			<div class="asset-card">
				{#if $SendTxDetails.fromCoin && $SendTxDetails.fromNetwork}
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
				<span class="more">
					<EditButton onclick={() => toggleAsset(true)} />
				</span>
			</div>
		</ClickableCard>
		<div class="section">
			<div class="amount-row">
				<div class="amount-input">
					<AmountInput
						bind:amount
						coinOpt={$SendTxDetails.fromCoin ?? { coin: Coin.unk, networks: [] }}
						network={$SendTxDetails.fromNetwork ?? Network.unknown}
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
{/if}

<style lang="scss">
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
