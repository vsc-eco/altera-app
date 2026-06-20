<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { Lock } from '@lucide/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import Amount from '$lib/currency/OldAmountInput.svelte';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { sleep } from 'aninest';
	import { consensusUnstakeTx } from '$lib/magiTransactions/hive';
	import { addLocalTransaction, type PendingTx } from '$lib/stores/localStorageTxs';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import InfoTooltip from '$lib/components/InfoTooltip.svelte';
	let auth = $derived(getAuth()());
	let username = $derived(auth.value?.username);
	// Locked to the signed-in account: the on-chain op's `to` must equal `from`.
	// There is no delegation feature yet, so you can only unstake HIVE staked on
	// the account you're signed in as. Derive (not just UI-lock) so the value can
	// never be anything but the logged-in user.
	let nodeRunnerAccount = $derived(username);
	let amount: string | undefined = $state('');
	let status = $state('');
	let error = $state('');
	const sendTransaction = async (amount: string, nodeRunnerAccount: string) => {
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
		const res = await consensusUnstakeTx(amount, nodeRunnerAccount, username, auth.value.aioha);
		if (res.success) {
			addLocalTransaction({
				ops: [
					{
						data: {
							amount: new CoinAmount(amount, Coin.hive).toAmountString(),
							asset: Coin.hive.unit.toLowerCase(),
							from: username,
							to: nodeRunnerAccount,
							type: 'consensus_unstake'
						},
						type: 'consensus_unstake',
						index: 0
					}
				],
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
			<h2>Consensus Unstaking</h2>
			<InfoTooltip>
				Staking deposits your HIVE into VSC and locks it while staked. Unstaking has a short
				cooldown (about a day) before the HIVE returns to your liquid balance. Only Hive accounts
				can stake. <a href="https://docs.vsc.eco" target="_blank" rel="noopener">Learn more →</a>
			</InfoTooltip>
		</div>
		<p>Be sure to be signed in with the account you'd like to unstake hive from.</p>
		<p>
			<b>Note:</b> Unstaked coins will be made available after an unbonding period of five elections
			(about a day).
		</p>
		{#if error}<p class="error">{error}</p>{/if}
		<div class="account-lock">
			<span class="account-label">Witness Account</span>
			<div class="account-value">
				<Lock size={14} />
				<span>@{username ?? '—'}</span>
			</div>
			<span class="account-hint">
				Locked to the account you're signed in with — you can only unstake your own account.
			</span>
		</div>
		<div class="amount-flex">
			<Amount
				selectItems={[Coin.hive]}
				id="unstake-amount"
				label="Unstake Amount:"
				coin={Coin.hive}
				network={Network.magi}
				bind:amountOfOriginalCoin={amount}
				required
				maxField={'hive_consensus'}
			/>
		</div>
		<PillButton disabled={!!status} styleType="invert" theme="primary" onclick={() => {}}
			>Intialize Unstake</PillButton
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
	b {
		color: var(--dash-accent-red);
		font-weight: 500;
	}
</style>
