<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import { getDidFromUsername } from '$lib/getAccountName';
	import { Landmark } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import { untrack, type Snippet } from 'svelte';
	import {
		dateToLastPaidString,
		getLastPaidContact,
		getLastPaidNetwork,
		getRecipientNetworks,
		SendTxDetails
	} from '../../sendUtils';
	import SelectNetwork from './SelectNetwork.svelte';
	import { TransferMethod } from '../../sendOptions';
	import NetworkInfo from '../components/NetworkInfo.svelte';
	import Select from '$lib/zag/Select.svelte';
	import SearchContact from './SearchContact.svelte';
	import InfoSegment from '../components/InfoSegment.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import SelectContact from '$lib/send/contacts/SelectContact.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import RecipientCard from './RecipientCard.svelte';
	import { type Contact } from '$lib/send/contacts/contacts';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';

	let {
		id,
		editStage
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
	} = $props();

	const auth = $authStore;

	$effect(() => {
		if ($SendTxDetails.method && $SendTxDetails.toUsername && $SendTxDetails.toNetwork) {
			editStage(id, true);
		} else {
			editStage(id, false);
		}
	});
	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));
	const possibleNetworks = $derived(getRecipientNetworks(toDid));
	interface MethodOptionParam extends TransferMethod {
		disabled?: boolean;
		disabledMemo?: string;
		snippet: (info: MethodOptionParam) => ReturnType<Snippet>;
	}
	const transferMethods: MethodOptionParam[] = [
		{
			...TransferMethod.vscTransfer,
			snippet: methodDetails
		},
		{
			...TransferMethod.lightningTransfer,
			snippet: methodDetails,
			disabled: true,
			disabledMemo: 'Not available at this time. Please visit swap page.'
		}
	];
	let method: string | undefined = $state(TransferMethod.vscTransfer.value);
	$effect(() => {
		const newMethod = transferMethods.find((mthd) => mthd.value === method);
		untrack(() => {
			SendTxDetails.update((current) => ({
				...current,
				fromNetwork: undefined,
				fromCoin: undefined,
				fromAmount: '0',
				toCoin: undefined,
				account: undefined,
				method: newMethod
			}));
		});
	});

	let lastPaid = $state('Never');
	let lastNetwork = $state('Never');
	$effect(() => {
		if (!auth.value) return;
		Promise.all([
			getLastPaidContact(toDid),
			getLastPaidNetwork($SendTxDetails.toNetwork?.value)
		]).then(([paid, net]) => {
			lastPaid = dateToLastPaidString(paid);
			lastNetwork = dateToLastPaidString(net);
		});
	});

	function openContact(create = false) {
		openToCreate = create;
		toggleContact(true);
	}

	let contactOpen = $state(false);
	let networkOpen = $state(false);
	let toggleNetwork = $state<(open?: boolean) => void>(() => {});
	let toggleContact = $state<(open?: boolean) => void>(() => {});
	let contact = $state<Contact>();
	let openToCreate = $state(false);
	$inspect(openToCreate);
</script>

{#snippet methodDetails(info: MethodOptionParam)}
	<InfoSegment
		label={info.label}
		disabled={info.disabled}
		display={info.disabledMemo ? [info.disabledMemo] : [info.length, info.fees]}
	/>
{/snippet}

<h2>Recipient</h2>
<div class="contact-search">
	<RecipientCard edit={openContact} {contact} />
	<SearchContact {contact} />
</div>

<h3>Payment Method</h3>
<div class="method">
	<Select
		items={transferMethods}
		onValueChange={(v) => (method = v.value[0])}
		initial={$SendTxDetails.method?.value}
		styleType="dropdown"
	/>
</div>

<h3>Recipient Network</h3>
<ClickableCard onclick={() => toggleNetwork(true)}>
	<div class="network-card">
		{#if $SendTxDetails.toNetwork}
			<NetworkInfo network={$SendTxDetails.toNetwork} lastPaid={lastNetwork} size="large" />
		{:else}
			<span class="user-icon-placeholder"><Landmark /></span>
		{/if}
		{#if getRecipientNetworks(toDid).length > 1}
			<span class="more">
				<span>Edit</span>
			</span>
		{/if}
	</div>
</ClickableCard>

<Dialog bind:open={networkOpen} bind:toggle={toggleNetwork}>
	{#snippet content()}
		<SelectNetwork close={toggleNetwork} />
	{/snippet}
</Dialog>

<Dialog bind:open={contactOpen} bind:toggle={toggleContact}>
	{#snippet content()}
		<SelectContact bind:selectedContact={contact} editing={openToCreate} close={toggleContact} />
	{/snippet}
</Dialog>

<style lang="scss">
	.contact-search {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.5rem;
		background-color: var(--neutral-bg-accent);
		border-radius: 1rem;
		:global(input) {
			background-color: var(--neutral-bg);
		}
	}
	.network-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem;
		.more {
			margin-left: auto;
			span {
				font-size: var(--text-sm);
				color: var(--accent-fg-mid);
			}
		}
	}

	h3 {
		margin-top: 2rem;
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
	.method {
		:global(button) {
			width: 100%;
		}
	}
</style>
