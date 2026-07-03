<script lang="ts">
	import Card from '../Card.svelte';
	import { getAuth } from '$lib/auth/store';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { accountBalanceHistory } from '$lib/stores/balanceHistory';
	import AccBalance from '$lib/AccBalance.svelte';
	import { Send } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import QuickSend from '$lib/sendswap/QuickSend.svelte';
	import { getTxSessionId } from '$lib/sendswap/utils/sendUtils';
	import {
		fetchConnectedWalletBalances,
		type WalletBalance
	} from '$lib/cards/ConnectedWallet/connectedWalletBalances';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';

	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);
	let loadingBalances = $derived($accountBalance.loading);
	let balance = $derived(
		$accountBalanceHistory.length > 0
			? $accountBalanceHistory[$accountBalanceHistory.length - 1].value
			: 0
	);

	let quickSendOpen = $state(false);
	let sendSessionId = $state(getTxSessionId());
	let toggleQuickSend = $state<(open?: boolean) => void>(() => {});

	// Magi vs. connected-wallet balances, toggled in-place (no extra card).
	type BalTab = 'magi' | 'wallet';
	let activeTab = $state<BalTab>('magi');
	let walletBalances = $state<WalletBalance[]>([]);
	let walletTotalUsd = $state(0);
	let walletLoading = $state(false);
	let walletError = $state(false);
	// Lazily fetch the connected wallet's on-chain (Hive L1 / EVM / BTC) balances
	// the first time the Wallet tab is opened; refetch if the account changes.
	let walletFetchedFor = $state<string | undefined>(undefined);

	// The headline $ amount tracks the active tab: Magi total vs. connected-wallet
	// total (falls back to the Magi figure while the wallet total is still loading).
	let displayValue = $derived(activeTab === 'wallet' && !walletLoading ? walletTotalUsd : balance);
	// Derive dollars and cents from the same rounded integer so a cents field
	// that rounds up to 100 (e.g. balance = 999.999) correctly bumps the dollar
	// digit instead of displaying "$999.100".
	let totalCents = $derived(Math.round(displayValue * 100));
	let dollars = $derived(Math.floor(totalCents / 100));
	let cents = $derived(
		new Intl.NumberFormat('en-US', {
			minimumIntegerDigits: 2,
			maximumFractionDigits: 0
		}).format(totalCents % 100)
	);

	async function selectTab(tab: BalTab) {
		activeTab = tab;
		if (tab !== 'wallet') return;
		const key = auth.value?.did;
		if (!key || walletFetchedFor === key) return; // already loaded for this account
		walletFetchedFor = key;
		walletLoading = true;
		walletError = false;
		try {
			const bals = await fetchConnectedWalletBalances(auth);
			walletBalances = bals;
			walletTotalUsd = await sumWalletUsd(bals);
		} catch {
			walletError = true;
		} finally {
			walletLoading = false;
		}
	}

	// Sum the wallet's balances in USD. HIVE/HBD/BTC price via CoinAmount; native
	// ETH isn't a Coin, so it's priced separately via CoinGecko (as MarketPrices does).
	const coinForSymbol = (s: string) =>
		s === 'HIVE' ? Coin.hive : s === 'HBD' ? Coin.hbd : s === 'BTC' ? Coin.btc : null;
	async function fetchEthUsd(): Promise<number> {
		try {
			const r = await fetch(
				'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
			);
			const d = await r.json();
			return d?.ethereum?.usd ?? 0;
		} catch {
			return 0;
		}
	}
	async function sumWalletUsd(bals: WalletBalance[]): Promise<number> {
		let total = 0;
		let ethUsd: number | null = null;
		for (const b of bals) {
			const coin = coinForSymbol(b.symbol);
			if (coin) {
				try {
					const usd = await new CoinAmount(b.amount, coin).convertTo(Coin.usd, Network.lightning);
					total += usd.toNumber();
				} catch {
					// ignore a single failed conversion
				}
			} else if (b.symbol === 'ETH') {
				if (ethUsd === null) ethUsd = await fetchEthUsd();
				total += b.amount * ethUsd;
			}
		}
		return total;
	}

	// Fixed decimals per asset so amounts line up (Hive/HBD 3dp, BTC 8dp, EVM 6dp).
	const decimalsFor = (symbol: string) => (symbol === 'BTC' ? 8 : symbol === 'ETH' ? 6 : 3);
	const fmtAmount = (n: number, symbol: string) =>
		n.toLocaleString(undefined, {
			minimumFractionDigits: decimalsFor(symbol),
			maximumFractionDigits: decimalsFor(symbol)
		});
	// Match AccBalance's subtitle line under each coin name.
	const subtitleFor = (symbol: string, sub?: string) => {
		const base =
			symbol === 'HIVE'
				? 'Native Hive Token'
				: symbol === 'HBD'
					? 'Hive Backed Dollar'
					: symbol === 'BTC'
						? 'Bitcoin'
						: symbol === 'ETH'
							? 'Ethereum'
							: symbol;
		return sub ? `${base} · ${sub}` : base;
	};

	function openDeposit() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static route; resolve() not exported in this kit version
		goto('/deposit');
	}
	function openWithdraw() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static route; resolve() not exported in this kit version
		goto('/withdraw');
	}
</script>

<Card>
	<div class="balance-inner">
		<div class="bal-toggle" role="tablist">
			<button
				type="button"
				class="bal-toggle-item"
				class:active={activeTab === 'magi'}
				role="tab"
				aria-selected={activeTab === 'magi'}
				onclick={() => selectTab('magi')}
			>
				Magi Balance
			</button>
			<span class="bal-toggle-divider" aria-hidden="true"></span>
			<button
				type="button"
				class="bal-toggle-item"
				class:active={activeTab === 'wallet'}
				role="tab"
				aria-selected={activeTab === 'wallet'}
				onclick={() => selectTab('wallet')}
			>
				Wallet
			</button>
		</div>

		<div class="balance-row">
			<div class="balance-amount">
				<span class="dollars">${dollars.toLocaleString()}</span><span class="cents">.{cents}</span>
			</div>
			<button
				type="button"
				class="send-circle"
				title="Quick send"
				onclick={() => {
					sendSessionId = getTxSessionId();
					toggleQuickSend(true);
				}}
			>
				<Send size={18} />
			</button>
		</div>

		<div class="action-buttons">
			<button class="action-btn action-btn-filled" onclick={openDeposit}> Deposit </button>
			<button class="action-btn action-btn-outline" onclick={openWithdraw}> Withdraw </button>
		</div>

		<div class="balances-section">
			{#if activeTab === 'magi'}
				{#if did}
					<AccBalance {did} />
				{/if}
			{:else if walletLoading}
				<p class="wallet-msg">Loading…</p>
			{:else if walletError}
				<p class="wallet-msg">Couldn't load wallet balances.</p>
			{:else if walletBalances.length === 0}
				<p class="wallet-msg">No balances in your connected wallet.</p>
			{:else}
				<div class="balances-list">
					{#each walletBalances as b (b.symbol + '/' + (b.sub ?? ''))}
						<div class="wallet-row">
							<div class="wrow-icon">
								{#if b.icon}<img src={b.icon} alt="" loading="lazy" />{/if}
							</div>
							<div class="wrow-info">
								<div class="wname-row">
									<span class="wcoin-name">{b.symbol}</span>
									<span class="wrow-amount">{fmtAmount(b.amount, b.symbol)} {b.symbol}</span>
								</div>
								<span class="wcoin-sub">{subtitleFor(b.symbol, b.sub)}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</Card>

<QuickSend
	bind:dialogOpen={quickSendOpen}
	bind:toggle={toggleQuickSend}
	sessionId={sendSessionId}
/>

<style lang="scss">
	.balance-inner {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
		overflow: hidden;
	}

	.balance-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.balance-amount {
		display: flex;
		align-items: flex-start;
	}
	.dollars {
		font-size: 2.5rem;
		font-weight: 500;
		color: var(--dash-text-primary);
		letter-spacing: -0.01em;
		line-height: 1;
	}
	.cents {
		font-size: 1rem;
		font-weight: 500;
		color: var(--dash-text-muted);
		margin-top: 0.05rem;
		margin-left: 2px;
	}
	.loading {
		color: var(--dash-text-muted);
		font-size: 0.9rem;
	}

	.send-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: none;
		background: linear-gradient(135deg, #7b74ff 0%, #6f6af8 50%, #5b54e0 100%);
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 2px 12px rgba(111, 106, 248, 0.35);
		transition:
			transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.2s ease;
	}
	.send-circle:hover {
		transform: scale(1.08);
		box-shadow: 0 4px 20px rgba(111, 106, 248, 0.5);
	}
	.send-circle:active {
		transform: scale(0.94);
		box-shadow: 0 1px 6px rgba(111, 106, 248, 0.3);
	}

	.action-buttons {
		display: flex;
		gap: 0.625rem;
		margin-bottom: 1.75rem;
	}

	.action-btn {
		flex: 1;
		height: 44px;
		border-radius: 1.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
	}
	.action-btn-filled,
	.action-btn-outline {
		background-color: transparent;
		color: var(--dash-text-primary);
		border: 1px solid var(--dash-btn-outline-border);
	}
	.action-btn-filled:hover,
	.action-btn-outline:hover {
		background-color: rgba(111, 106, 248, 0.08);
		border-color: rgba(111, 106, 248, 0.4);
		box-shadow: 0 0 16px -4px rgba(111, 106, 248, 0.2);
	}

	.bal-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		flex-shrink: 0;
	}
	.bal-toggle-item {
		padding: 0;
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--dash-text-muted);
		cursor: pointer;
		transition: color 0.15s;
	}
	.bal-toggle-item:hover {
		color: var(--dash-text-secondary);
	}
	.bal-toggle-item.active {
		color: var(--dash-text-primary);
	}
	.bal-toggle-divider {
		width: 1px;
		height: 14px;
		background: var(--dash-card-border);
		flex-shrink: 0;
	}

	.wallet-msg {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--dash-text-muted);
		font-style: italic;
	}
	/* Wallet rows mirror AccBalance's format for a consistent look. */
	.balances-list {
		display: flex;
		flex-direction: column;
	}
	.wallet-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--dash-divider);
	}
	.wallet-row:last-child {
		border-bottom: none;
	}
	.wrow-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.wrow-icon img {
		width: 36px;
		height: 36px;
		border-radius: 50%;
	}
	.wrow-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
		min-width: 0;
	}
	.wname-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.125rem 0.5rem;
		min-width: 0;
	}
	.wcoin-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--dash-text-primary);
	}
	.wcoin-sub {
		font-size: 0.75rem;
		color: var(--dash-text-muted);
		font-weight: 400;
	}
	.wrow-amount {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--dash-text-primary);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.balances-section {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding-bottom: 0.5rem;
	}

	@media (max-width: 480px) {
		.dollars {
			font-size: 1.75rem;
		}
		.balance-row {
			margin-bottom: 1rem;
		}
		.action-buttons {
			margin-bottom: 1.25rem;
		}
	}
</style>
