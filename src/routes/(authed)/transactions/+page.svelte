<script lang="ts">
	import { getAccountNameFromDid, getDidFromUsername } from '$lib/getAccountName';
	import { page } from '$app/state';
	import Table from './Table/Table.svelte';
	import FilterBar from './FilterBar.svelte';
	import { EMPTY_FILTERS, type TxFilters } from './filters';
	import { getAuth } from '$lib/auth/store';
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { Search, X } from '@lucide/svelte';
	import { clearAllStores } from '$lib/stores/txStores';
	import { validateAddress } from '$lib/sendswap/utils/sendUtils';
	import { normalizeAccountInput } from './accountLookup';
	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);
	let filters = $state<TxFilters>({ ...EMPTY_FILTERS });
	const autoOpenOp: [string, number] | undefined = $derived.by(() => {
		const autoOpenTxId = page.url.searchParams.get('tx');
		const autoOpenIndex = Number(page.url.searchParams.get('index'));
		if (autoOpenTxId) {
			return [autoOpenTxId, autoOpenIndex];
		}
		return undefined;
	});

	$effect(() => {
		if (autoOpenOp) {
			// Drop only the deep-link params, so a looked-up account survives.
			const url = new URL(page.url);
			url.searchParams.delete('tx');
			url.searchParams.delete('index');
			goto(url.pathname + url.search, { replaceState: true });
		}
	});

	// ── Account lookup ─────────────────────────────────────────────────────
	// `?account=<name|address>` shows another account's history; without it
	// the page shows the signed-in account. Kept in the URL so a lookup can be
	// shared, bookmarked and undone with Back.
	const accountParam = $derived(page.url.searchParams.get('account')?.trim() ?? '');
	const lookedUpDid = $derived(
		accountParam ? getDidFromUsername(normalizeAccountInput(accountParam)) : ''
	);
	const viewDid = $derived(accountParam ? lookedUpDid : did);
	const isOwnAccount = $derived(!accountParam || lookedUpDid === did);

	let query = $state('');
	let lookupError = $state('');
	let checking = $state(false);
	// Mirror the URL into the field, so Back/Forward and shared links show
	// which account is on screen.
	$effect(() => {
		query = accountParam;
		lookupError = '';
	});

	async function lookUp(e: SubmitEvent) {
		e.preventDefault();
		const name = normalizeAccountInput(query);
		if (!name) return showOwn();
		const target = getDidFromUsername(name);
		if (!target) {
			lookupError = 'Enter a Hive username, an EVM address (0x…) or a BTC address.';
			return;
		}
		if (target === did) return showOwn();
		if (target.startsWith('hive:')) {
			checking = true;
			try {
				const res = await validateAddress(name);
				if (!res.success) {
					lookupError = res.error;
					return;
				}
			} catch {
				lookupError = 'Could not reach Hive to check that account. Try again.';
				return;
			} finally {
				checking = false;
			}
		}
		lookupError = '';
		goto(`/transactions?account=${encodeURIComponent(name)}`);
	}

	function showOwn() {
		lookupError = '';
		query = '';
		goto('/transactions');
	}

	// Leaving while another account is on screen: empty the shared stores so
	// the dashboard and the Transfer page's recent contacts don't start from
	// that account's rows.
	onDestroy(() => {
		if (!isOwnAccount) clearAllStores();
	});
</script>

<document:head>
	<title>Transactions</title>
</document:head>
<div class="flex">
	<div class="title-row">
		<h1>
			Transactions involving {viewDid ? getAccountNameFromDid(viewDid) : '0xd072...AdAA'}
		</h1>
		{#if did}
			<form class="account-lookup" role="search" onsubmit={lookUp}>
				<Search size={15} aria-hidden="true" />
				<input
					type="text"
					placeholder="View another account (Hive user, 0x…, bc1…)"
					aria-label="View another account's transactions"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					bind:value={query}
					oninput={() => (lookupError = '')}
				/>
				{#if !isOwnAccount || query}
					<button
						type="button"
						class="icon-btn"
						title="Back to my transactions"
						aria-label="Back to my transactions"
						onclick={showOwn}
					>
						<X size={15} />
					</button>
				{/if}
				<button type="submit" class="view-btn" disabled={checking}>
					{checking ? 'Checking…' : 'View'}
				</button>
			</form>
		{/if}
	</div>
	{#if lookupError}
		<p class="lookup-error" role="alert">{lookupError}</p>
	{/if}
	{#if did}
		{#if accountParam && !lookedUpDid}
			<p class="lookup-error" role="alert">
				"{accountParam}" is not a Hive username, EVM address or BTC address.
			</p>
		{:else if viewDid}
			<!-- Chips row with the Filters trigger at its right end, below the
			     title and directly above the table. -->
			<FilterBar bind:filters />
			<!-- Remount per account: the table's paging, polling and deep-link
			     state all assume one account for its lifetime. -->
			{#key viewDid}
				<Table did={viewDid} initialOpen={autoOpenOp} {filters}></Table>
			{/key}
		{/if}
	{/if}
</div>

<style>
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin: 0 0 0.75rem 0;
	}
	h1 {
		display: flex;
		color: var(--dash-text-primary);
		font-family: 'Nunito Sans', sans-serif;
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.account-lookup {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 0 1 24rem;
		min-width: 0;
		height: 2.25rem;
		box-sizing: border-box;
		padding: 0 0.3rem 0 0.65rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--dash-card-border);
		border-radius: 10px;
		color: var(--dash-text-muted);
		transition: border-color 150ms ease;
	}
	.account-lookup:focus-within {
		border-color: var(--dash-accent-purple, #6f6af8);
	}
	.account-lookup input {
		flex: 1;
		min-width: 0;
		height: 100%;
		font: inherit;
		font-size: 0.85rem;
		background: transparent;
		border: none;
		color: var(--dash-text-primary);
		padding: 0;
	}
	.account-lookup input:focus {
		outline: none;
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--dash-text-muted);
		cursor: pointer;
	}
	.icon-btn:hover {
		color: var(--dash-text-primary);
		background: rgba(255, 255, 255, 0.06);
	}
	.view-btn {
		height: 1.65rem;
		padding: 0 0.8rem;
		border: none;
		border-radius: 8px;
		background: var(--dash-accent-purple, #6f6af8);
		color: #fff;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.view-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.lookup-error {
		margin: -0.35rem 0 0.75rem 0;
		font-size: 0.8rem;
		color: var(--dash-accent-red, #ff6b6b);
	}
	@media (max-width: 640px) {
		.account-lookup {
			flex-basis: 100%;
		}
	}
	.flex {
		display: flex;
		flex-direction: column;
		/* No fixed height — table sizes to its content so there's no blank
		   space when only a few transactions are loaded. The page scrolls
		   naturally for larger transaction sets. */
		/* height: calc(100vh - 6.5rem); */
	}
</style>
