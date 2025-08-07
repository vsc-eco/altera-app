<script lang="ts">
	import swapOptions, {
		Coin,
		Network,
		type CoinOptions,
		type IntermediaryNetwork
	} from '$lib/send/sendOptions';
	import { getRecipientNetworks, type CoinOptionParam } from '$lib/send/sendUtils';
	import { getDidFromUsername, getUsernameFromDid } from '$lib/getAccountName';
	import ComboBox from '$lib/zag/ComboBox.svelte';
	import { authStore } from '$lib/auth/store';
	import { vscTxsStore, waitForExtend } from '$lib/stores/txStores';
	import NetworkInfo from '../components/NetworkInfo.svelte';
	import moment from 'moment';
	import { SendTxDetails } from '$lib/send/sendUtils';
	import { networkCard, type AssetObject } from '../components/CardSnippets.svelte';
	import { untrack } from 'svelte';
	import AssetInfo from '../components/AssetInfo.svelte';

	let {
		availableCoins
	}: {
		availableCoins: AssetObject[];
	} = $props();

	const auth = $derived($authStore);
	let tmpAsset: CoinOptions['coins'][number] | undefined = $state();
	let tmpAssetVal: string | undefined = $state();
	const allCoinOpts: CoinOptionParam[] = swapOptions.from['coins'];
	const availableCoinOpts: CoinOptionParam[] = availableCoins
		.map((coin) => coin.snippetData.fromOpt)
		.filter((item): item is CoinOptionParam => item !== undefined);

	$effect(() => {
		const newVal = tmpAssetVal;
		untrack(() => {
			tmpAsset = availableCoinOpts.find((coinOpts) => coinOpts.coin.value === newVal);
			if (!tmpAsset) return;
			if ($SendTxDetails.toCoin?.coin.value === tmpAsset.coin.value) return;
			SendTxDetails.update((current) => ({
				...current,
				toCoin: tmpAsset
			}));
		});
	});

	type coinData = {
		coinOpt: CoinOptionParam;
		date: string | undefined;
	};

	async function getRecentNetworks(): Promise<coinData[]> {
		if (!auth.value) return [];
		let result = new Map<string, coinData>();
		let leaveOut = ['v4vapp'];
		let lastChecked = 0;
		let lastLength = 0;
		do {
			lastLength = $vscTxsStore.length;
			for (const tx of $vscTxsStore.slice(lastChecked)) {
				if (!tx.ops) continue;
				for (const op of tx.ops) {
					const coin = availableCoinOpts.find((coinOpt) =>
						coinOpt.coin.value.startsWith(op?.data.asset)
					);
					if (!coin || !op || op.data.from !== auth.value.did || !op.data.to) continue;
					const username = getUsernameFromDid(op.data.to);
					if (!leaveOut.includes(username) && !result.has(op?.data.asset)) {
						result.set(op?.data.asset, {
							coinOpt: coin,
							date: tx.anchr_ts + 'Z'
						});
						break;
					}
					if (result.size >= availableCoinOpts.length) {
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
				const coin = availableCoinOpts.find((coinOpt) => coinOpt.coin.value.startsWith(tx.type));
				if (!coin || !op || !op.data.from) continue;
				const username = getUsernameFromDid(op.data.from);
				if (!leaveOut.includes(username) && !result.has(tx.type)) {
					result.set(tx.type, {
						coinOpt: coin,
						date: tx.anchr_ts + 'Z'
					});
					break;
				}
				if (result.size >= availableCoinOpts.length) {
					return [...result.values()];
				}
			}
		}

		return [...result.values()];
	}

	function handleTableTrigger(value: string) {
		tmpAssetVal = value;
	}
	function handleTableKeydown(e: KeyboardEvent, value: string) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTableTrigger(value);
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
		<h2>Select an Asset</h2>
		{#if $SendTxDetails.fromNetwork}
			<div class="from-network">
				<span class="sm-caption">Selecting assets available on network:</span>
				<div class="network-details">
					<img src={$SendTxDetails.fromNetwork.icon} alt={$SendTxDetails.fromNetwork.label} />
					{$SendTxDetails.fromNetwork.label}
				</div>
			</div>
		{/if}
		<span class="sm-label">Search</span>
		<div class="search">
			<ComboBox
				items={availableCoins}
				bind:value={tmpAssetVal}
				icon={tmpAsset ? tmpAsset.coin.icon : ''}
				placeholder="Search for VSC, Hive..."
			/>
		</div>
	</div>
	<div class="recent">
		<span class="sm-label">Recently Transferred</span>
		<table>
			<tbody>
				{#await getRecentNetworks()}
					{#each Array(availableCoinOpts.length) as _}
						<tr class="skeleton-row">
							<td><div class="skeleton-cell"></div></td>
						</tr>
					{/each}
				{:then recents}
					{#each recents as recentCoin}
						{@const disabled = availableCoinOpts.find(
							(coinOpt) => coinOpt.coin.value === recentCoin.coinOpt.coin.value
						)?.disabled}
						<tr
							class={{ disabled }}
							onclick={() => handleTableTrigger(recentCoin.coinOpt.coin.value)}
							onkeydown={(event) => handleTableKeydown(event, recentCoin.coinOpt.coin.value)}
							tabindex="0"
						>
							<td>
								<AssetInfo
									coinOpt={recentCoin.coinOpt}
									lastPaid={recentCoin.date
										? `on ${moment(recentCoin.date).format('MMM DD, YYYY')}`
										: 'Never'}
									disabledMemo={recentCoin.coinOpt.disabledMemo}
									size="medium"
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
	.from-network {
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.network-details {
			img {
				width: 2rem;
			}
			display: flex;
			align-items: center;
			gap: 0.5rem;
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
