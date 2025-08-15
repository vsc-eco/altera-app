<script lang="ts">
	import { Network, type IntermediaryNetwork } from '$lib/send/sendOptions';
	import { getRecipientNetworks } from '$lib/send/sendUtils';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import RadioGroup from '$lib/zag/RadioGroup.svelte';
	import ComboBox from '$lib/zag/ComboBox.svelte';
	import { authStore } from '$lib/auth/store';
	import { vscTxsStore, waitForExtend } from '$lib/stores/txStores';
	import NetworkInfo from '../components/NetworkInfo.svelte';
	import moment from 'moment';
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { networkCard } from '../components/CardSnippets.svelte';
	import { untrack } from 'svelte';
	import { Search } from '@lucide/svelte';

	let { close }: { close: () => void } = $props();

	const auth = $derived($authStore);
	let tmpNetwork: Network | undefined = $state();
	let tmpNetworkVal: string | undefined = $state();
	const availableNetworks = $derived(
		getRecipientNetworks(getDidFromUsername($SendTxDetails.toUsername))
	);

	function updateDetails(val: string) {
		tmpNetwork = availableNetworks.find((net) => net.value === val);
		if (!tmpNetwork) return;
		if ($SendTxDetails.toNetwork?.value === tmpNetwork?.value) return;
		$SendTxDetails.toNetwork = tmpNetwork;
	}

	$effect(() => {
		if (tmpNetworkVal) {
			untrack(() => updateDetails(tmpNetworkVal!));
		}
	});
	let radioItems = $derived(
		availableNetworks.map((v) => {
			return {
				...v,
				snippet: radioLabel
			};
		})
	);
	let comboItems = $derived(
		availableNetworks.map((v) => {
			return {
				...v,
				snippet: networkCard
			};
		})
	);

	type networkData = {
		network: IntermediaryNetwork | Network;
		date: string | undefined;
	};

	async function getRecentNetworks(): Promise<networkData[]> {
		if (!auth.value) return [];
		let result = new Map<string, networkData>();
		let leaveOut = ['v4vapp'];
		let lastChecked = 0;
		let lastLength = 0;
		do {
			lastLength = $vscTxsStore.length;
			for (const tx of $vscTxsStore.slice(lastChecked)) {
				if (!tx.ops) continue;
				for (const op of tx.ops) {
					const network = availableNetworks.find((net) => net.value.startsWith(tx.type));
					if (!network || !op || op.data.from !== auth.value.did) continue;
					const username = getUsernameFromDid(op.data.to);
					if (!leaveOut.includes(username) && !result.has(tx.type)) {
						result.set(tx.type, {
							network: network,
							date: tx.anchr_ts + 'Z'
						});
						break;
					}
					if (result.size >= availableNetworks.length) {
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
				const network = availableNetworks.find((net) => net.value.startsWith(tx.type));
				if (!network || !op) continue;
				const username = getUsernameFromDid(op.data.from);
				if (!leaveOut.includes(username) && !result.has(tx.type)) {
					result.set(tx.type, {
						network: network,
						date: tx.anchr_ts + 'Z'
					});
					break;
				}
				if (result.size >= availableNetworks.length) {
					return [...result.values()];
				}
			}
		}

		return [...result.values()];
	}

	function handleTableTrigger(net: IntermediaryNetwork | Network) {
		tmpNetworkVal = net.value;
		updateDetails(tmpNetworkVal);
		close();
	}
	function handleTableKeydown(e: KeyboardEvent, net: IntermediaryNetwork | Network) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTableTrigger(net);
			e.stopPropagation();
			e.preventDefault();
		}
	}
	let disabledMemo = $derived(
		auth.value?.provider === 'reown'
			? 'Not available for EVM accounts'
			: 'Not available for this account.'
	);
</script>

{#snippet radioLabel(info: { icon: string; label: string })}
	<img width="16" src={info.icon} alt="" />
	{info.label}
{/snippet}

<div class="wrapper">
	<div class="select">
		<h2>Select a Network</h2>
		<span class="sm-label">Search</span>
		<div class="search">
			<ComboBox
				items={comboItems}
				bind:value={tmpNetworkVal}
				icon={tmpNetwork ? tmpNetwork.icon : Search}
				placeholder="Search for VSC, Hive..."
			/>
		</div>
		<div class="radio-buttons">
			<RadioGroup required id={'network'} bind:value={tmpNetworkVal} items={radioItems} />
		</div>
	</div>
	<div class="recent">
		<span class="sm-label">Recently Paid</span>
		<table>
			<tbody>
				{#await getRecentNetworks()}
					{#each Array(availableNetworks.length) as _}
						<tr class="skeleton-row">
							<td><div class="skeleton-cell"></div></td>
						</tr>
					{/each}
				{:then recents}
					{#each recents as recentNetwork}
						{@const disabled = availableNetworks.find(
							(net) => net.value === recentNetwork.network.value
						)?.disabled}
						<tr
							class={{ disabled }}
							onclick={() => handleTableTrigger(recentNetwork.network)}
							onkeydown={(event) => handleTableKeydown(event, recentNetwork.network)}
							tabindex="0"
						>
							<td>
								<NetworkInfo
									network={recentNetwork.network}
									lastPaid={recentNetwork.date
										? `on ${moment(recentNetwork.date).format('MMM DD, YYYY')}`
										: 'Never'}
									size="medium"
									disabledMemo={disabled ? disabledMemo : undefined}
								/>
							</td>
						</tr>
					{/each}
				{/await}
			</tbody>
		</table>
	</div>
</div>

<style lang="scss">
	.wrapper {
		margin: auto;
		min-width: min-content;
		width: 32rem;
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
	.select {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.radio-buttons {
			margin-top: 1rem;
			width: fit-content;
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
		tr.disabled {
			cursor: default;
			pointer-events: none;
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
