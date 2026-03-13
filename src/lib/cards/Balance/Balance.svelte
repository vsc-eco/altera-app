<script lang="ts">
	import Card from '../Card.svelte';
	import { getAuth } from '$lib/auth/store';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { accountBalanceHistory } from '$lib/stores/balanceHistory';
	import AccBalance from '$lib/AccBalance.svelte';
	import PillBtn from '$lib/PillButton.svelte';
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
	<div class="root">
		<div class="caption">
			<h5>Magi Balance</h5>
			<div class="balance-row">
				<div class="price">
					{#if loadingBalances}
						<span class="loading">Loading...</span>
					{:else}
						${Math.floor(balance)}<span
							><span>.</span>{new Intl.NumberFormat('en-US', {
								style: 'decimal',
								maximumFractionDigits: 0,
								minimumIntegerDigits: 2
							}).format((balance * 100) % 100)}</span
						>
					{/if}
				</div>
				<button
					type="button"
					class="quick-send-btn"
					title="Quick send"
					onclick={() => {
						sendSessionId = getTxSessionId();
						toggleQuickSend(true);
					}}
					aria-label="Quick send"
				>
					<Send />
				</button>
			</div>
		</div>

		<div class="actions">
			<PillBtn
				theme="primary"
				styleType="outline"
				onclick={() => {
					depositSessionId = getTxSessionId();
					toggleDeposit(true);
				}}
			>
				Deposit
			</PillBtn>
			<PillBtn
				theme="primary"
				styleType="outline"
				onclick={() => {
					withdrawSessionId = getTxSessionId();
					toggleWithdraw(true);
				}}
			>
				Withdraw
			</PillBtn>
		</div>

		{#if did}
			<div class="balances-wrapper">
				<AccBalance {did} />
			</div>
		{/if}
	</div>
</Card>

<QuickSend
	bind:dialogOpen={quickSendOpen}
	bind:toggle={toggleQuickSend}
	sessionId={sendSessionId}
/>
<Deposit bind:dialogOpen={depositOpen} bind:toggle={toggleDeposit} sessionId={depositSessionId} />
<Withdraw
	bind:dialogOpen={withdrawOpen}
	bind:toggle={toggleWithdraw}
	sessionId={withdrawSessionId}
/>

<style lang="scss">
	.root {
		display: flex;
		flex-direction: column;
		min-width: 0;
		width: 100%;
		min-height: 0;
		height: 100%;
		box-sizing: border-box;
	}
	.root > :global(div) {
		box-sizing: border-box;
	}
	.caption {
		margin: 0.75rem 0.75rem 0;
		margin-top: 0;
	}
	.caption h5 {
		color: var(--dash-text-muted);
		font-size: 0.85rem;
		font-weight: 500;
		margin-bottom: 0.25rem;
	}
	.balance-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0.1rem 0.75rem;
		box-sizing: border-box;
	}
	.price {
		vertical-align: text-top;
		display: flex;
		align-items: first;
		font-size: var(--text-7xl);
		font-family: 'Noto Sans Mono Variable', monospace;
		box-sizing: border-box;
		color: var(--dash-text-primary);
	}
	.quick-send-btn {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: none;
		background-color: var(--dash-accent-purple);
		color: white;
		cursor: pointer;
		transition: background-color 0.2s, transform 0.05s;
		box-sizing: border-box;
	}
	.quick-send-btn:hover {
		background-color: var(--dash-accent-purple-hover);
	}
	.quick-send-btn:active {
		transform: scale(0.96);
	}
	.quick-send-btn :global(svg) {
		width: 1.125rem;
		height: 1.125rem;
	}
	.price span:last-child {
		padding-top: 0.125rem;
		font-size: var(--text-1xl);
		color: var(--dash-text-muted);
		span {
			font-size: var(--text-base);
			display: inline-flex;
			align-items: right;
			justify-content: end;
		}
	}
	.price .loading {
		color: var(--dash-text-muted);
		font-size: var(--text-sm);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.625rem;
		margin: 0.75rem 0.75rem 0.5rem;
	}
	.actions :global(button),
	.actions :global(a) {
		--height: 42px;
		height: 42px;
		min-height: 42px;
		flex: 1;
		min-width: 120px;
		padding: 10px 16px;
		gap: 8px;
		border-radius: 2rem;
		border-width: 1px;
		font-size: 0.9rem;
		box-sizing: border-box;
	}
	.balances-wrapper {
		margin-top: 0.75rem;
		flex: 1 1 0;
		min-height: 0;
		overflow: auto;
	}
</style>
