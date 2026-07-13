<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import Card from '$lib/cards/Card.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { useHbdStakeState } from '$lib/sendswap/utils/txState.svelte';
	import { sHbdAprStore } from '$lib/stores/aprStore';
	import { getUsernameFromAuth } from '$lib/getAccountName';
	import PillButton from '$lib/PillButton.svelte';
	import Dialog from '$lib/zag/Dialog.svelte';
	import TxStatus from '../../components/shared/TxStatus.svelte';
	import type { ComponentProps } from 'svelte';
	import type NavButtons from '$lib/sendswap/components/NavButtons.svelte';

	let {
		editStage = () => {},
		isActive = true,
		status,
		waiting = false,
		abort = () => {},
		next,
		previous,
		goHome,
		popup = false,
		onHomePage = $bindable(),
		customButtons = $bindable()
	}: {
		editStage?: (complete: boolean) => void;
		isActive?: boolean;
		status: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
		next?: () => void;
		previous?: () => void;
		goHome?: () => void;
		popup?: boolean;
		onHomePage?: boolean;
		customButtons?: ComponentProps<typeof NavButtons>['buttons'] | undefined;
	} = $props();

	const stakeState = useHbdStakeState();
	const auth = $derived(getAuth()());
	const username = $derived(getUsernameFromAuth(auth));

	const isUnstake = $derived(stakeState.mode === 'unstake');
	const reviewTitle = $derived(isUnstake ? 'Review Unstake' : 'Review Stake');
	const prettyAmount = $derived(
		new CoinAmount(stakeState.fromAmount || '0', Coin.hbd).toPrettyString()
	);
	const recipient = $derived(stakeState.toUsername);
	// Staking to someone else is legitimate but easy to do by accident — the
	// sHBD lands in THEIR savings, not yours. Surface it loudly at review time.
	const toOtherAccount = $derived(!!recipient && !!username && recipient !== username);

	// Mark review "complete" (proceed enabled) as soon as it becomes active; the
	// forward button click is what triggers the broadcast.
	$effect(() => {
		if (isActive) editStage(true);
	});

	// Drive the popup Dialog from the stage's active state (same pattern as
	// ReviewSwap), with previous-value trackers so a manual dismiss doesn't
	// immediately reopen it.
	let dialogOpen = $state(false);
	let dialogToggle = $state<(o?: boolean) => void>(() => {});
	let lastIsActive = false;
	let lastDialogOpen = false;
	$effect(() => {
		if (!popup) return;
		if (isActive !== lastIsActive) {
			lastIsActive = isActive;
			dialogToggle?.(isActive);
			lastDialogOpen = isActive;
		}
	});
	$effect(() => {
		if (!popup) return;
		if (dialogOpen === lastDialogOpen) return;
		lastDialogOpen = dialogOpen;
		if (!dialogOpen && isActive) goHome?.();
	});
</script>

{#snippet reviewContent()}
	<div class="review">
		<Card>
			<ul>
				<li>
					<span class="label">Action</span>
					<span class="value"
						>{isUnstake ? 'Unstake' : 'Stake'} HBD {isUnstake ? '' : '(sHBD)'}</span
					>
				</li>
				<li>
					<span class="label">Amount</span>
					<!-- toPrettyString() already includes the unit — don't append it. -->
					<span class="value">{prettyAmount}</span>
				</li>
				<li>
					<span class="label">Recipient</span>
					<span class="value">@{recipient || '—'}</span>
				</li>
				{#if !isUnstake && $sHbdAprStore !== null}
					<li>
						<span class="label">Earning</span>
						<span class="value">{$sHbdAprStore}% APR</span>
					</li>
				{/if}
				{#if !isUnstake && stakeState.shouldDeposit}
					<li>
						<span class="label">Deposit first</span>
						<span class="value">Deposits {prettyAmount} from Hive L1 into VSC</span>
					</li>
				{/if}
			</ul>
		</Card>

		{#if toOtherAccount}
			<p class="other-account">
				<b>Heads up:</b> you're {isUnstake ? 'unstaking for' : 'staking to'}
				<b>@{recipient}</b>, not your own account (@{username}). The {isUnstake
					? 'unstaked HBD'
					: 'sHBD'} will belong to that account.
			</p>
		{/if}

		{#if isUnstake}
			<p class="unbond">
				<b>Unbonding:</b> unstaked HBD is made available after about three days.
			</p>
		{/if}

		<TxStatus
			{status}
			{waiting}
			abort={() => abort?.()}
			showHiveWarning={auth.value?.provider === 'aioha'}
		/>

		{#if popup}
			<div class="popup-buttons">
				<PillButton
					onclick={() => previous?.()}
					theme="secondary"
					styleType="outline"
					disabled={waiting}
				>
					Back
				</PillButton>
				<PillButton onclick={() => next?.()} theme="accent" styleType="invert" disabled={waiting}>
					{waiting ? 'Waiting…' : isUnstake ? 'Unstake' : 'Stake'}
				</PillButton>
			</div>
		{/if}
	</div>
{/snippet}

{#if popup}
	<Dialog bind:open={dialogOpen} bind:toggle={dialogToggle}>
		{#snippet title()}
			{reviewTitle}
		{/snippet}
		{#snippet content()}
			{@render reviewContent()}
		{/snippet}
	</Dialog>
{:else}
	{@render reviewContent()}
{/if}

<style>
	.review {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: clamp(20rem, 80vw, 30rem);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 0.5rem;
	}
	li:not(:last-child) {
		border-bottom: 1px solid var(--dash-card-border);
	}
	.label {
		color: var(--dash-text-muted);
		font-size: 0.85rem;
	}
	.value {
		text-align: right;
		font-weight: 500;
	}
	.other-account {
		margin: 0;
		padding: 0.65rem 0.85rem;
		border: 1px solid var(--dash-accent-red, #dc2626);
		border-radius: 12px;
		font-size: 0.85rem;
		line-height: 1.45;
	}
	.other-account b {
		font-weight: 600;
	}
	.unbond {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--dash-text-secondary);
	}
	.unbond b {
		color: var(--dash-accent-red);
		font-weight: 600;
	}
	.popup-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid var(--dash-card-border);
	}
</style>
