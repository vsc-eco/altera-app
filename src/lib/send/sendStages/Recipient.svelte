<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import { getAuth } from '$lib/auth/store';
	import { getAccountNameFromAuth, getDidFromUsername } from '$lib/getAccountName';
	import Username from '$lib/auth/Username.svelte';
	import ToFrom from '../../../routes/(authed)/transactions/Table/tds/ToFrom.svelte';
	import { CircleUser, MoveDown } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import { allTransactionsStore, toTransactionInter, vscTxsStore } from '$lib/stores/txStores';
	import { GetTransactionsStore } from '$houdini';
	import { stringToBytes } from 'viem';
	import moment from 'moment';

	let auth = $derived(getAuth()());
	let error = $state('');
	let recipientUsername: string | undefined = $state();
	let debouncedUsername: string | undefined = $state();

	// Debounce function - waits 300ms after user stops typing
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	function debounceUsername(value: string) {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedUsername = value;
		}, 300); // Adjust delay as needed (300ms is common)
	}

	// Watch for changes to recipientUsername
	$effect(() => {
		if (recipientUsername !== undefined) {
			debounceUsername(recipientUsername);
		}
	});

	$effect(() => {
		if (!auth.value) return;
		new GetTransactionsStore()
			.fetch({
				variables: {
					limit: 20,
					did: auth.value.did
				}
			})
			.then((posts) => {
				if (!posts.data?.findTransaction) return;
				vscTxsStore.set(toTransactionInter(posts.data?.findTransaction));
			})
			.catch((e) => {
				if (e.name !== 'AbortError') {
					console.error(e);
				}
			});
	});

	// TODO: probably use a record instead, to filter by name but keep other data
	type recipientData = {
		type: string,
		toFrom: 'to' | 'from' | 'self';
		date: string
	}

	function getRecentContacts() {
		let result = new Map<string, recipientData[]>();
		let leaveOut = ['hive:v4vapp', auth.value?.did ?? ''];
		for (const tx of $allTransactionsStore) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				if (!op) continue;
				if (auth.value && op.data.from === auth.value.did && op.data.to === auth.value.did) {
					let rec: recipientData[] = result.get(auth.value.did) ?? [];
					rec.push({
						type: op.type?? tx.type,
						toFrom: 'self',
						date: tx.anchr_ts + 'Z'
					})
					result.set(auth.value.did, rec);
				}
				if (!leaveOut.includes(op.data.from)) {
					let fromRec: recipientData[] = result.get(op.data.from) ?? [];
					fromRec.push({
						type: op.type?? tx.type,
						toFrom: 'from',
						date: tx.anchr_ts + 'Z'
					});
					result.set(op.data.from, fromRec);
				}
				if (!leaveOut.includes(op.data.to)) {
					let toRec: recipientData[] = result.get(op.data.from) ?? [];
					toRec.push({
						type: op.type?? tx.type,
						toFrom: 'to',
						date: tx.anchr_ts + 'Z'
					});
					result.set(op.data.to, toRec);
				}
			}
			if (result.size >= 3) return result;
		}
		return result;
	}
</script>

<h2>Select a Recipient</h2>
<div class="to-from">
	<span class="small-caption">From</span>
	<div class="from">
		<Avatar did={auth.value?.did} />
		{getAccountNameFromAuth(auth)}
	</div>
	<span class="arrow"><MoveDown /></span>
	<!-- <span class="from-icon"><Avatar did={auth.value?.did} /></span>
	<span class="from-name">{getAccountNameFromAuth(auth)}</span> -->
	<!-- <div class="vertical-line"></div> -->
	<h5>Send To:</h5>
	<div class="to">
		<div class="to-icon">
			{#if debouncedUsername}
				<Avatar did={getDidFromUsername(debouncedUsername)} large />
			{:else}
				<span class="user-icon-placeholder"><CircleUser /></span>
			{/if}
		</div>
		<div class="username-input">
			<Username id="send-recipient" bind:value={recipientUsername} required />
		</div>
	</div>
</div>
<div class="recent">
	<table>
		<tbody>
			{#each getRecentContacts().entries() as [did, txs]}
				<tr>
					<td><ToFrom otherAccount={did}/></td>
					<td class='tx-description'>
						{#each txs.slice(0, 3) as tx}
							<span>
								{#if tx.toFrom != 'self'}
									{tx.toFrom == 'to' ? 'sent' : 'received'}
								{/if}
								{tx.type} on
								{moment(tx.date).format('MMM DD')}
							</span>
						{/each}
						{#if txs.length > 3}
							...
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<style lang="scss">
	h5 {
		margin-top: 0;
	}
	.to-from {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		justify-content: baseline;
		.from {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
		.arrow {
			margin: 1rem 0;
			padding-left: 0.5rem;
		}
		.to {
			display: flex;
			gap: 0.75rem;
			width: 100%;
			.to-icon {
				display: flex;
				align-self: center;
				width: 3.5rem;
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
		}
	}
	.small-caption {
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
	}
	.recent {
		width: 100%;
		table {
			width: 100%;
			border-spacing: 1rem 0.5rem;
			border-collapse: collapse;
			position: relative;
		}
		tr {
			display: flex;
			justify-content: space-between;
		}
	}
</style>
