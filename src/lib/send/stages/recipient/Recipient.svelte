<script lang="ts">
	import { authStore } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import { CircleUser, Dot, Landmark, MapPin } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import moment from 'moment';
	import { vscTxsStore, waitForExtend } from '$lib/stores/txStores';
	import type { SendDetails } from '$lib/send/sendOptions';
	import BasicCopy from '$lib/components/BasicCopy.svelte';
	import SelectContact from './SelectContact.svelte';
	import FullscreenModal from '$lib/components/FullscreenModal.svelte';
	import { untrack } from 'svelte';
	import ContactInfo from '../ContactInfo.svelte';
	import { getDisplayName, getRecipientNetworks } from '../../sendUtils';
	import SelectNetwork from './SelectNetwork.svelte';
	import { Network, TransferMethod } from '../../sendOptions';
	import NetworkInfo from '../NetworkInfo.svelte';
	import ComboBox from '$lib/zag/ComboBox.svelte';

	let {
		details = $bindable()
	}: {
		details: SendDetails;
	} = $props();
	const auth = $authStore;
	$effect(() => {
		if (!auth.value) return;
		untrack(() => {
			details.toUsername = getUsernameFromDid(auth.value!.did);
			details.toDisplayName = getUsernameFromDid(auth.value!.did);
			(async () => {
				const displayName = await getDisplayName(toDid);
				if (displayName) {
					details.toDisplayName = displayName;
				}
			})();
			details.toNetwork = Network.vsc;
		});
	});
	const toDid = $derived(getDidFromUsername(details.toUsername));
	const possibleNetworks = $derived(getRecipientNetworks(toDid));
	$effect(() => {
		// have to do this because .includes doesn't work on array of Networks
		const netVals = possibleNetworks.map((net) => net.value);
		if (details.toNetwork && !netVals.includes(details.toNetwork.value)) {
			details.toNetwork = Network.vsc;
		}
	});
	const transferMethods = [TransferMethod.vscTransfer, TransferMethod.lightningTransfer].map(
		(item) => ({
			...item,
			snippet: methodDetails
		})
	);
	let method: string | undefined = $state('vsc-transfer');
	$effect(() => {
		details.method = transferMethods.find((mthd) => mthd.value === method);
	});

	// increment through store, keep fetching more to find last paid
	async function getLastPaid() {
		if (!auth.value?.did) return 'Never';
		let lastChecked = 0;
		let lastLength = 0;
		do {
			lastLength = $vscTxsStore.length;
			for (const tx of $vscTxsStore.slice(lastChecked)) {
				if (!tx.ops) continue;
				for (const op of tx.ops) {
					if (op?.data.to === toDid) {
						return `on ${moment(tx.anchr_ts + 'Z').format('MMM DD, YYYY')}`;
					}
				}
			}
			lastChecked = Math.max($vscTxsStore.length - 1, 0);
			const success = await waitForExtend(auth.value.did);
			if (!success) {
				break;
			}
		} while ($vscTxsStore.length > lastLength);
		return 'Never';
	}
	async function getLastNetwork() {
		if (!auth.value?.did) return 'Never';
		let lastChecked = 0;
		let lastLength = 0;
		do {
			lastLength = $vscTxsStore.length;
			for (const tx of $vscTxsStore.slice(lastChecked)) {
				if (!tx.ops) continue;
				if (details.toNetwork?.value.startsWith(tx.type)) {
					return `on ${moment(tx.anchr_ts + 'Z').format('MMM DD, YYYY')}`;
				}
			}
			lastChecked = Math.max($vscTxsStore.length - 1, 0);
			const success = await waitForExtend(auth.value.did);
			if (!success) {
				break;
			}
		} while ($vscTxsStore.length > lastLength);
		return 'Never';
	}
	let lastPaid = $state('Never');
	let lastNetwork = $state('Never');
	// let toName = $derived(details.toDisplayName);
	$effect(() => {
		if (!auth.value) return;
		(async () => {
			lastPaid = await getLastPaid();
			lastNetwork = await getLastNetwork();
		})();
	});
	let contactOpen = $state(false);
	let networkOpen = $state(false);
</script>

{#snippet methodDetails(info: TransferMethod)}
	<span class="method-description">
		{info.label}
		<span class="faded-caption">{info.length} <Dot size={16} /> {info.fees}</span>
	</span>
{/snippet}

{#snippet recipient()}
	<h2>Recipient</h2>
	<div class="to">
		<div class="name-card">
			{#if details.toUsername}
				<ContactInfo
					did={toDid}
					name={details.toDisplayName}
					accounts={[details.toUsername]}
					{lastPaid}
				/>
			{:else}
				<span class="user-icon-placeholder"><CircleUser /></span>
			{/if}
			<span class="more">
				<button onclick={() => (contactOpen = true)} class="small-button"> Edit </button>
			</span>
		</div>
		<div class="address">
			<span class="pin"><MapPin /></span>
			<div class="data">
				<span class="faded-caption">Recipient address</span>
				<BasicCopy value={details.toUsername} />
			</div>
		</div>
	</div>

	<h3>Payment Method</h3>
	<div class="method">
		<ComboBox items={transferMethods} bind:value={method} />
		{#if details.method}
			<span class="faded-caption"
				>{details.method.length} <Dot size={16} /> {details.method.fees}</span
			>
		{:else}
			<br />
		{/if}
	</div>

	<h3>Recipient Network</h3>
	<Card>
		<div class="network-card">
			{#if details.toUsername}
				<NetworkInfo network={details.toNetwork ?? Network.vsc} lastPaid={lastNetwork} />
			{:else}
				<span class="user-icon-placeholder"><Landmark /></span>
			{/if}
			<span class="more">
				<button onclick={() => (networkOpen = true)} class="small-button"> Edit </button>
			</span>
		</div>
	</Card>
{/snippet}

{#snippet selectContact()}
	<SelectContact
		close={() => (contactOpen = false)}
		bind:username={details.toUsername}
		bind:displayName={details.toDisplayName}
	/>
{/snippet}

{#snippet selectNetwork()}
	<SelectNetwork
		close={() => (networkOpen = false)}
		bind:network={details.toNetwork}
		username={details.toUsername}
	/>
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
	.name-card {
		background-color: var(--neutral-bg);
		border-radius: 0.5rem;
		padding: 1rem;
		.user-icon-placeholder {
			width: 3.5rem;
			height: 3.5rem;
			display: flex;
			align-items: center;
			justify-content: center;
			:global(svg) {
				width: 100%;
				height: 100%;
			}
		}
	}
	.name-card,
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
	.method-description {
		display: flex;
		align-items: center;
		.faded-caption {
			display: flex;
			align-items: center;
			margin-left: auto;
		}
	}
	.method {
		.faded-caption {
			display: flex;
			align-items: center;
			margin-top: 0.25rem;
		}
	}
</style>
