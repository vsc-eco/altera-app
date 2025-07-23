<script lang="ts">
	import Avatar from '$lib/zag/Avatar.svelte';
	import { authStore } from '$lib/auth/store';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import { CircleUser, Plus } from '@lucide/svelte';
	import { vscTxsStore, waitForExtend } from '$lib/stores/txStores';
	import moment from 'moment';
	import SendTitle from '$lib/send/navigation/SendTitle.svelte';
	import SendNavButtons from '$lib/send/navigation/SendNavButtons.svelte';
	import ContactInfo from '../ContactInfo.svelte';
	import { getDisplayName } from '../../sendUtils';
	import PillButton from '$lib/PillButton.svelte';
	import { SendTxDetails } from '../../sendUtils';

	let {
		close,
	}: {
		close: () => void;
	} = $props();

	const auth = $derived($authStore);
	let recipientUsername: string | undefined = $state();
	let debouncedUsername: string | undefined = $state();
	let tmpDisplayName: string | undefined;

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

	// TODO: probably use a record instead, to filter by name but keep other data
	type recipientData = {
		name: string;
		did: string;
		date: string | undefined;
	};

	async function getRecentContacts(): Promise<recipientData[]> {
		if (!auth.value) return [];
		let result = new Map<string, recipientData>();
		let leaveOut = ['v4vapp'];
		let lastChecked = 0;
		let lastLength = 0;
		do {
			lastLength = $vscTxsStore.length;
			for (const tx of $vscTxsStore.slice(lastChecked)) {
				if (!tx.ops) continue;
				for (const op of tx.ops) {
					if (!op || op.data.from !== auth.value.did) continue;
					const username = getUsernameFromDid(op.data.to);
					if (!leaveOut.includes(username) && !result.has(username)) {
						result.set(username, {
							name: (await getDisplayName(op.data.to)) ?? username,
							did: op.data.to,
							date: tx.anchr_ts + 'Z'
						});
					}
					if (result.size >= 3) {
						return [...result.values()];
					}
				}
			}
			lastChecked = Math.max($vscTxsStore.length - 1, 0);
			const success = await waitForExtend(auth.value.did, 30);
			if (!success) {
				break;
			}
		} while ($vscTxsStore.length > lastLength);

		for (const tx of $vscTxsStore) {
			if (!tx.ops) continue;
			for (const op of tx.ops) {
				if (!op) continue;
				const username = getUsernameFromDid(op.data.from);
				if (!leaveOut.includes(username) && !result.has(username)) {
					result.set(username, {
						name: (await getDisplayName(op.data.from)) ?? username,
						did: op.data.from,
						date: undefined
					});
				}
				if (result.size >= 3) {
					return [...result.values()];
				}
			}
		}

		return [...result.values()];
	}

	$effect(() => {
		(async () => {
			if (recipientUsername) {
				tmpDisplayName = await getDisplayName(getDidFromUsername(recipientUsername));
			}
		})();
	});

	function handleTableTrigger(did: string) {
		recipientUsername = getUsernameFromDid(did);
		debouncedUsername = recipientUsername;
	}
	function handleTableKeydown(e: KeyboardEvent, did: string) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTableTrigger(did);
			e.stopPropagation();
			e.preventDefault();
		}
	}
	function save() {
		if (recipientUsername) {
			SendTxDetails.update(current => ({
				...current,
				toUsername: recipientUsername!,
				toDisplayName: tmpDisplayName ?? recipientUsername!
			}))
		}
		close();
	}
	document.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			save();
			event.preventDefault();
		} else if (event.key === 'Escape') {
			close();
			event.preventDefault();
		}
	});
	const buttons = $state({
		fwd: {
			label: 'Save',
			action: save
		},
		back: {
			label: 'Back',
			action: close
		}
	});
</script>

<SendTitle {close} />
<div class="wrapper">
	<div class="select">
		<h2>Select a Recipient</h2>
		<span class="sm-label">Search</span>
		<div class="selected">
			<div class="to-icon">
				{#if debouncedUsername}
					<Avatar did={getDidFromUsername(debouncedUsername)} />
				{:else}
					<span class="user-icon-placeholder"><CircleUser /></span>
				{/if}
			</div>
			<input
				id="send-recipient"
				bind:value={recipientUsername}
				placeholder="Find a contact or paste wallet address"
			/>
		</div>
	</div>
	<div class="add-button">
		<PillButton onclick={() => {}} disabled={true}>
			<Plus /> Create Recipient (Coming Soon)
		</PillButton>
	</div>
	<div class="recent">
		<span class="sm-label">Recently Paid</span>
		<table>
			<tbody>
				{#await getRecentContacts()}
					{#each Array(3) as _}
						<tr class="skeleton-row">
							<td><div class="skeleton-cell"></div></td>
						</tr>
					{/each}
				{:then recents}
					{#each recents as contact}
						<tr
							onclick={() => handleTableTrigger(contact.did)}
							onkeydown={(event) => handleTableKeydown(event, contact.did)}
							tabindex="0"
						>
							<td>
								<ContactInfo
									did={contact.did}
									name={contact.name}
									accounts={[getUsernameFromDid(contact.did)]}
									lastPaid={contact.date
										? `on ${moment(contact.date).format('MMM DD, YYYY')}`
										: 'Never'}
									adjacent={true}
								/>
							</td>
						</tr>
					{/each}
				{/await}
			</tbody>
		</table>
	</div>
</div>
<SendNavButtons {buttons} />

<style lang="scss">
	.wrapper {
		margin: auto;
		max-width: 42rem;
	}
	.select {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.selected {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			width: 100%;
			.to-icon {
				display: flex;
				align-self: center;
				.user-icon-placeholder {
					width: 2.5rem;
					height: 2.5rem;
					display: flex;
					align-items: center;
					justify-content: center;
					:global(svg) {
						width: 100%;
						height: 100%;
					}
				}
			}
			input {
				height: auto;
				flex-grow: 1;
				padding: 0.5rem;
			}
		}
	}

	.recent {
		margin-top: 2rem;
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
			align-items: center;
			border-bottom: 1px solid var(--neutral-bg-accent);
			height: 4.5rem;
		}
		tr:hover,
		tr {
			cursor: pointer;
			transition: background-color 1s;
			animation: highlight-in 1s both;
		}
		td {
			flex-grow: 1;
		}
		.skeleton-cell {
			background-color: var(--neutral-bg-accent);
			border-radius: 0.5rem;
			height: 3rem;
			margin: 0.75rem 1rem;
			animation: pulse 2s ease-in-out infinite;
		}
	}
	.add-button {
		margin-top: 1rem;
	}
	h2 {
		color: var(--neutral-fg);
		font-size: var(--text-1xl);
		margin-bottom: 0.5rem;
		font-weight: 450;
	}
	.sm-label {
		font-size: var(--text-sm);
		color: var(--neutral-mid);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
