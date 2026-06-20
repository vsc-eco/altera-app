<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { Lock } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/OldAmountInput.svelte';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { sleep } from 'aninest';
	import { consensusTx } from '$lib/magiTransactions/hive';
	import { addLocalTransaction, type PendingTx } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { type OperationError, type OperationResult } from '@aioha/aioha/build/types';
	import InfoTooltip from '$lib/components/InfoTooltip.svelte';
	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	// Consensus staking is locked to the signed-in account: the on-chain op's
	// `to` must equal `from`. There is no delegation feature yet — staking to a
	// different account actually TRANSFERS the HIVE to that account and stakes it
	// there, so funds sent to an account you don't control can't be recovered.
	// Derive (not just UI-lock) so the value can never be anything but the
	// logged-in user. (Delegation is a planned feature, held until after the
	// 0.2.0 fixes.)
	let nodeRunnerAccount = $derived(username);
	let amount: string | undefined = $state('');
	let status = $state('');
	let error = $state('');
	let shouldDeposit = $state(true);
	const sendTransaction = async (
		amount: string,
		nodeRunnerAccount: string
	): Promise<OperationResult> => {
		if (!username || !auth.value?.aioha)
			return {
				success: false,
				error: 'Error: not authenticated.',
				errorCode: 1
			};
		status = 'Awaiting transaction approval…';
		if (Number(amount) == 0)
			return {
				success: false,
				error: 'Error: cannot stake 0 HIVE.',
				errorCode: 1
			};
		const res = await consensusTx(
			amount,
			nodeRunnerAccount,
			username,
			shouldDeposit,
			auth.value.aioha
		);
		if (res.success) {
			const ops: PendingTx['ops'] = [
				{
					data: {
						amount: new CoinAmount(amount, Coin.hive).toAmountString(),
						asset: Coin.hive.unit.toLowerCase(),
						from: username,
						to: nodeRunnerAccount,
						type: 'consensus_stake'
					},
					type: 'consensus_stake',
					index: 0
				}
			];
			if (shouldDeposit) {
				ops.push({
					data: {
						amount: new CoinAmount(amount, Coin.hive).toAmountString(),
						asset: Coin.hive.unit.toLowerCase(),
						from: username,
						to: nodeRunnerAccount,
						type: 'deposit',
						memo: ''
					},
					type: 'deposit',
					index: 1
				});
			}
			addLocalTransaction({
				ops: ops,
				timestamp: new Date(),
				id: res.result,
				type: 'hive'
			});
		}
		return res;
	};
</script>

{#if auth.value == undefined || auth.value!.username != undefined}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			sendTransaction(amount!, nodeRunnerAccount!).then(async (res) => {
				if (!res.success) {
					status = '';
					error = res.error;
					return;
				}
				status = 'Transaction broadcasted successfully!';
				await sleep(1);
				status = '';
				amount = '';
			});
		}}
	>
		<div class="modal-title">
			<h2>Consensus Staking</h2>
			<InfoTooltip>
				Staking deposits your HIVE into VSC and locks it while staked. Unstaking has a short
				cooldown (about a day) before the HIVE returns to your liquid balance. Only Hive accounts
				can stake. <a href="https://docs.vsc.eco" target="_blank" rel="noopener">Learn more →</a>
			</InfoTooltip>
		</div>
		<p>Be sure to be signed in with the account you'd like to deposit and stake hive from.</p>
		{#if error}<p class="error">{error}</p>{/if}
		<div class="account-lock">
			<span class="account-label">Witness Account</span>
			<div class="account-value">
				<Lock size={14} />
				<span>@{username ?? '—'}</span>
			</div>
			<span class="account-hint">
				Locked to the account you're signed in with — consensus staking can only target your own
				account.
			</span>
		</div>
		<div class="amount-flex">
			<Amount
				selectItems={[Coin.hive]}
				id="consensus-stake-amount"
				label="Deposit and Stake Amount:"
				coin={Coin.hive}
				network={shouldDeposit ? Network.hiveMainnet : Network.magi}
				bind:amountOfOriginalCoin={amount}
				required
				maxField={shouldDeposit ? undefined : 'hive'}
			/>
		</div>
		<label for="deposit-checkbox">
			<input type="checkbox" id="deposit-checkbox" bind:checked={shouldDeposit} />
			First Deposit HIVE into VSC
		</label>
		<PillButton disabled={!!status} styleType="invert" theme="primary" onclick={() => {}}
			>{#if shouldDeposit}Deposit and{/if} Stake</PillButton
		>
		<span class="status">{status}</span>
	</form>
{:else}
	<p class="error">
		Consensus staking with an EVM wallet is currently unsupported. Please <a href="/logout"
			>logout</a
		> and login with a hive account instead.
	</p>
{/if}

<style>
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: #6f6af8;
		cursor: pointer;
	}
	form {
		box-sizing: border-box;
		padding-top: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.modal-title {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.amount-flex {
		display: flex;
	}
	.account-lock {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.account-label {
		font-size: 0.9rem;
	}
	.account-value {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 16rem;
		box-sizing: border-box;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-color, #444);
		border-radius: 8px;
		font-family: 'Noto Sans Mono Variable', monospace;
		opacity: 0.85;
	}
	.account-hint {
		font-size: 0.8rem;
		opacity: 0.6;
	}
	.status {
		color: var(--dash-accent-purple);
	}
	p {
		margin: 0;
	}
</style>
