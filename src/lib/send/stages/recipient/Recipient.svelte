<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { getDidFromUsername } from '$lib/getAccountName';
	import { Landmark } from '@lucide/svelte';
	import { untrack, type Snippet } from 'svelte';
	import {
		momentToLastPaidString,
		getLastPaidContact,
		getLastPaidNetwork,
		getRecipientNetworks,
		SendTxDetails
	} from '../../sendUtils';
	import SelectNetwork from './SelectNetwork.svelte';
	import { Network, TransferMethod } from '../../sendOptions';
	import NetworkInfo from '../components/NetworkInfo.svelte';
	import Select from '$lib/zag/Select.svelte';
	import InfoSegment from '../components/InfoSegment.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import SelectContact from '$lib/send/contacts/SelectContact.svelte';
	import RecipientCard from './RecipientCard.svelte';
	import {
		compareContacts,
		getAllLastPaid,
		getContacts,
		processMap,
		setAllContacts,
		type Contact
	} from '$lib/send/contacts/contacts';
	import ClickableCard from '$lib/cards/ClickableCard.svelte';
	import ContactSearchBox from './search/ContactSearchBox.svelte';

	let {
		id,
		editStage
	}: {
		id: string;
		editStage: (id: string, add: boolean) => void;
	} = $props();

	const auth = $derived(getAuth()());

	$effect(() => {
		if (!auth.value) return;
		untrack(() => {
			const contacts = getContacts();
			processMap<string, Contact, Contact>(contacts, async (contact) => {
				const lastPaidMoment = await getAllLastPaid(contact);
				const lastPaidString = momentToLastPaidString(lastPaidMoment);
				return {
					...contact,
					lastPaid: lastPaidString
				};
			}).then((res) => {
				const unwrapped = new Map<string, Contact>();
				for (const [key, settled] of res) {
					if (settled.status === 'fulfilled') {
						const oldContact = contacts.get(key);
						if (compareContacts(oldContact!, settled.value) < 1) {
							unwrapped.set(key, oldContact!);
						} else {
							unwrapped.set(key, settled.value);
						}
					} else {
						const oldContact = contacts.get(key);
						if (oldContact) {
							unwrapped.set(key, oldContact);
						}
					}
				}
				setAllContacts(unwrapped);
			});
		});
	});

	$effect(() => {
		if ($SendTxDetails.method && $SendTxDetails.toUsername && $SendTxDetails.toNetwork) {
			editStage(id, true);
		} else {
			editStage(id, false);
		}
	});
	const toDid = $derived(getDidFromUsername($SendTxDetails.toUsername));
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
			$SendTxDetails.fromNetwork = undefined;
			$SendTxDetails.fromCoin = $SendTxDetails.toCoin = undefined;
			$SendTxDetails.account = undefined;
			$SendTxDetails.fromAmount = '0';
			$SendTxDetails.method = newMethod;
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
			lastPaid = momentToLastPaidString(paid);
			lastNetwork = momentToLastPaidString(net);
		});
	});

	$effect(() => {
		const newNetwork = $SendTxDetails.toNetwork;
		const userNetworks = getRecipientNetworks(getDidFromUsername($SendTxDetails.toUsername));
		if (userNetworks.find((net) => net.value === newNetwork?.value)?.disabled) {
			$SendTxDetails.toNetwork = Network.vsc;
		}
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
	let createNew: string | undefined = $derived(
		!contact && $SendTxDetails.toUsername ? $SendTxDetails.toUsername : undefined
	);
	let openToCreate = $state(false);
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
	<ContactSearchBox bind:value={$SendTxDetails.toUsername} bind:selectedContact={contact} />
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
		<SelectContact
			bind:selectedContact={contact}
			editing={openToCreate}
			close={toggleContact}
			{createNew}
		/>
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
		@media screen and (min-width: 450px) {
			:global(input) {
				background-color: var(--neutral-bg);
			}
		}
		@media screen and (max-width: 450px) {
			background-color: transparent;
			padding: 0;
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
