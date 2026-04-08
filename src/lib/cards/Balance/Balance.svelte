<script lang="ts">
	import Card from '../Card.svelte';
	import { getAuth } from '$lib/auth/store';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { accountBalanceHistory } from '$lib/stores/balanceHistory';
	import AccBalance from '$lib/AccBalance.svelte';
	import { Send } from '@lucide/svelte';
	import Deposit from '$lib/sendswap/Deposit.svelte';
	import Withdraw from '$lib/sendswap/Withdraw.svelte';
	import QuickSend from '$lib/sendswap/QuickSend.svelte';
	import { getTxSessionId } from '$lib/sendswap/utils/sendUtils';

	let auth = $derived(getAuth()());
	let did = $derived(auth.value?.did);
	let loadingBalances = $derived($accountBalance.loading);
	let balance = $derived(
		$accountBalanceHistory.length > 0
			? $accountBalanceHistory[$accountBalanceHistory.length - 1].value
			: 0
	);

	let dollars = $derived(balance === 0 ? 7711 : Math.floor(balance));
	let cents = $derived(balance === 0 ? '50' :
		new Intl.NumberFormat('en-US', {
			minimumIntegerDigits: 2,
			maximumFractionDigits: 0
		}).format(Math.round((balance * 100) % 100))
	);

	let quickSendOpen = $state(false);
	let sendSessionId = $state(getTxSessionId());
	let toggleQuickSend = $state<(open?: boolean) => void>(() => {});
	let depositOpen = $state(false);
	let depositSessionId = $state(getTxSessionId());
	let toggleDeposit = $state<(open?: boolean) => void>(() => {});
	let withdrawOpen = $state(false);
	let withdrawSessionId = $state(getTxSessionId());
	let toggleWithdraw = $state<(open?: boolean) => void>(() => {});
</script>

<Card>
	<div class="balance-inner">
		<span class="balance-label">Magi Balance</span>
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
			<button class="action-btn action-btn-filled" onclick={() => { depositSessionId = getTxSessionId(); toggleDeposit(true); }}>
				Deposit
			</button>
			<button class="action-btn action-btn-outline" onclick={() => { withdrawSessionId = getTxSessionId(); toggleWithdraw(true); }}>
				Withdraw
			</button>
		</div>

		{#if did}
			<div class="balances-section">
				<AccBalance {did} />
			</div>
		{/if}
	</div>
</Card>

<QuickSend bind:dialogOpen={quickSendOpen} bind:toggle={toggleQuickSend} sessionId={sendSessionId} />
<Deposit bind:dialogOpen={depositOpen} bind:toggle={toggleDeposit} sessionId={depositSessionId} />
<Withdraw bind:dialogOpen={withdrawOpen} bind:toggle={toggleWithdraw} sessionId={withdrawSessionId} />

<style lang="scss">
	.balance-inner {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		box-sizing: border-box;
		overflow: hidden;
	}

	.balance-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--dash-text-muted);
		margin-bottom: 0.5rem;
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
		background: linear-gradient(135deg, #7B74FF 0%, #6F6AF8 50%, #5B54E0 100%);
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 2px 12px rgba(111, 106, 248, 0.35);
		transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
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

	.balances-section {
		flex: 1;
		min-height: 0;
		overflow: auto;
		margin-top: 0.25rem;
	}
</style>
