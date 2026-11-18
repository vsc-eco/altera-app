<!--
	What the wallet you signed in with holds on its OWN chain.

	The Assets card beside this one shows Magi balances — the ledger Altera
	actually trades on. For a Hive login the two are easy to confuse but both
	are at least visible. For an EVM or Bitcoin login the old redesign showed
	nothing at all: `currentBalance.ts` only tracks Hive L1 (aioha) and the
	mapped BTC figure, so an Ethereum wallet signed in, saw a page of zeroes,
	and had no way to tell an empty account from an unsupported one.

	The old `/dashboard` card had this as a "Wallet" tab and it already knew
	how to read all three chains; the redesign dropped the tab and the reader
	with it. This is that view, in the new shell.
-->
<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import {
		fetchConnectedWalletBalances,
		connectedWalletLabel,
		formatWalletAmount,
		walletAssetName,
		type WalletBalance
	} from '$lib/cards/ConnectedWallet/connectedWalletBalances';

	const auth = $derived(getAuth()());
	const label = $derived(connectedWalletLabel(auth));

	let balances = $state<WalletBalance[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	/** The account the rows below belong to. Also the guard against a slow
	 *  response for a PREVIOUS account landing after a wallet switch. */
	let loadedFor = $state<string | undefined>(undefined);

	async function load(did: string) {
		loading = true;
		failed = false;
		try {
			const result = await fetchConnectedWalletBalances(auth);
			if (loadedFor !== did) return; // switched accounts mid-flight
			balances = result;
		} catch {
			if (loadedFor !== did) return;
			failed = true;
			balances = [];
		} finally {
			if (loadedFor === did) loading = false;
		}
	}

	$effect(() => {
		const did = auth.value?.did;
		if (!did) {
			loadedFor = undefined;
			balances = [];
			failed = false;
			loading = false;
			return;
		}
		if (loadedFor === did) return;
		loadedFor = did;
		balances = [];
		void load(did);
	});

	function retry() {
		const did = auth.value?.did;
		if (did) void load(did);
	}
</script>

<section class="alt-card wallet">
	<div class="card-head">
		<h2>In your wallet</h2>
		{#if label}
			<span class="wallet-id" title={auth.value?.address}>
				{label.chain} · {label.account}
			</span>
		{/if}
	</div>

	<!-- Said once, up front. Without it these rows read as a second,
	     contradictory set of Magi balances. -->
	<p class="note">
		Held on {label?.chain ?? 'its own chain'}, not on Magi. Deposit to trade it here.
	</p>

	{#if loading}
		<p class="msg">Loading…</p>
	{:else if failed}
		<p class="msg">
			Couldn't reach the network.
			<button type="button" class="retry" onclick={retry}>Try again</button>
		</p>
	{:else if !label}
		<p class="msg">This wallet type has no on-chain balance Altera can read.</p>
	{:else if balances.length === 0}
		<p class="msg">Nothing in this wallet.</p>
	{:else}
		<ul class="rows">
			{#each balances as b (b.symbol + '/' + (b.sub ?? ''))}
				<li class="row">
					<span class="icon">
						{#if b.icon}<img src={b.icon} alt="" width="26" height="26" loading="lazy" />{/if}
					</span>
					<span class="info">
						<span class="name">{b.symbol}</span>
						<span class="sub">{walletAssetName(b.symbol, b.sub)}</span>
					</span>
					<span class="amount">{formatWalletAmount(b.amount, b.symbol)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="scss">
	.wallet {
		padding: 18px;
		min-width: 0;
	}
	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.wallet-id {
		font-size: 12px;
		font-weight: 600;
		color: var(--alt-mut);
		font-family: 'Noto Sans Mono Variable', monospace;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.note {
		margin: 6px 0 12px;
		font-size: 12px;
		color: var(--alt-mut);
	}
	.msg {
		margin: 0;
		font-size: 14px;
		color: var(--alt-mut);
	}
	.retry {
		padding: 0;
		border: 0;
		background: none;
		color: var(--alt-tx);
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		min-width: 0;
		border-bottom: 1px solid var(--alt-card-border);
	}
	.row:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.icon {
		display: inline-flex;
		flex-shrink: 0;
		width: 26px;
		height: 26px;
	}
	.icon img {
		border-radius: 50%;
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.name {
		font-size: 14px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.sub {
		font-size: 12px;
		color: var(--alt-mut);
	}
	.amount {
		font-family: 'Noto Sans Mono Variable', monospace;
		font-size: 14px;
		font-weight: 600;
		color: var(--alt-tx);
		text-align: right;
		overflow-wrap: anywhere;
	}
</style>
