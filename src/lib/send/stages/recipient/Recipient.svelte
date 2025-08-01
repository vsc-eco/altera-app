<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import { CircleUser, Dot, Landmark, MapPin } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import SelectContact from './SelectContact.svelte';
	import FullscreenModal from '$lib/components/FullscreenModal.svelte';
	import { untrack, type Snippet } from 'svelte';
	import ContactInfo from '../ContactInfo.svelte';
	import {
		getDisplayName,
		getLastPaidContact,
		getLastPaidNetwork,
		getRecipientNetworks,
		SendTxDetails
	} from '../../sendUtils';
	import SelectNetwork from './SelectNetwork.svelte';
	import { Network, TransferMethod } from '../../sendOptions';
	import NetworkInfo from '../NetworkInfo.svelte';
	import Select from '$lib/zag/Select.svelte';
	import SearchContact from './SearchContact.svelte';
	import InfoSegment from '../InfoSegment.svelte';

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
			getLastPaidContact(auth, toDid),
			getLastPaidNetwork(auth, $SendTxDetails.toNetwork?.value)
		]).then(([paid, net]) => {
			lastPaid = paid;
			lastNetwork = net;
		});
	});
	let contactOpen = $state(false);
	let networkOpen = $state(false);
</script>

{#snippet methodDetails(info: MethodOptionParam)}
	<InfoSegment
		label={info.label}
		disabled={info.disabled}
		display={info.disabledMemo ? [info.disabledMemo] : [info.length, info.fees]}
	/>
{/snippet}

{#snippet recipient()}
	<h2>Recipient</h2>
	<div class="to">
		<!-- <div class="name-card">
			{#if $SendTxDetails.toUsername}
				<ContactInfo
					did={toDid}
					name={$SendTxDetails.toDisplayName}
					accounts={[$SendTxDetails.toUsername]}
					{lastPaid}
				/>
			{:else}
				<span class="user-icon-placeholder"><CircleUser /></span>
			{/if}
			<span class="more">
				<button onclick={() => (contactOpen = true)} class="small-button"> Edit </button>
			</span>
		</div> -->
		<div class="contact-search">
			<SearchContact />
		</div>
		<div class="address">
			<span class="pin"><MapPin /></span>
			<div class="data">
				<span class="faded-caption">Recipient address</span>
				<BasicCopy value={$SendTxDetails.toUsername} />
			</div>
		</div>
	</div>

	<h3>Payment Method</h3>
	<div class="method">
		<!-- <ComboBox items={transferMethods} bind:value={method} /> -->
		<Select
			items={transferMethods}
			onValueChange={(v) => (method = v.value[0])}
			initial={$SendTxDetails.method?.value}
			styleType="dropdown"
		/>
		<!-- For Combobox -->
		<!-- {#if $SendTxDetails.method}
				<span class="faded-caption"
					>{$SendTxDetails.method.length} <Dot size={16} /> {$SendTxDetails.method.fees}</span
				>
			{:else}
				<br />
			{/if} -->
	</div>

	<h3>Recipient Network</h3>
	<Card>
		<div class="network-card">
			{#if $SendTxDetails.toNetwork}
				<NetworkInfo network={$SendTxDetails.toNetwork} lastPaid={lastNetwork} size="large" />
			{:else}
				<span class="user-icon-placeholder"><Landmark /></span>
			{/if}
			{#if getRecipientNetworks(toDid).length > 1}
				<span class="more">
					<button onclick={() => (networkOpen = true)} class="small-button"> Edit </button>
				</span>
			{/if}
		</div>
	</Card>
{/snippet}

{#snippet selectContact()}
	<SelectContact close={() => (contactOpen = false)} />
{/snippet}

{#snippet selectNetwork()}
	<SelectNetwork close={() => (networkOpen = false)} />
{/snippet}

{#if contactOpen}
	<FullscreenModal>
		{@render selectContact()}
	</FullscreenModal>
{:else if networkOpen}
	<FullscreenModal>
		{@render selectNetwork()}
	</FullscreenModal>
{:else}
	{@render recipient()}
{/if}

<style lang="scss">
	.to {
		background-color: var(--neutral-bg-accent);
		border: 1px solid var(--neutral-bg-accent-shifted);
		border-radius: 0.5rem;
		padding: 1rem;
		overflow: auto;
		max-height: 100%;
	}
	// .name-card {
	// 	background-color: var(--neutral-bg);
	// 	border-radius: 0.5rem;
	// 	padding: 1rem;
	// 	.user-icon-placeholder {
	// 		width: 3.5rem;
	// 		height: 3.5rem;
	// 		display: flex;
	// 		align-items: center;
	// 		justify-content: center;
	// 		:global(svg) {
	// 			width: 100%;
	// 			height: 100%;
	// 		}
	// 	}
	// }
	// .name-card,
	.contact-search {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		:global(input) {
			background-color: var(--neutral-bg);
		}
	}
	.network-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		.more {
			margin-left: auto;
		}
	}
	.network-card {
		padding: 0.5rem;
	}
	.address {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.5rem 1rem 0;
		line-height: 1.2;
		.faded-caption {
			margin-bottom: 0.25rem;
		}
		.pin {
			display: flex;
			align-items: center;
			padding: 0.75rem;
			background-color: var(--neutral-bg-accent-shifted);
			border-radius: 2.5rem;
		}
		.data {
			display: flex;
			flex-direction: column;
		}
	}
	.faded-caption {
		color: var(--neutral-mid);
		font-size: var(--text-xs);
	}
	.small-button {
		border: none;
		background-color: transparent;
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--accent-fg-mid);
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
		.faded-caption {
			display: flex;
			align-items: center;
		}
	}
</style>
