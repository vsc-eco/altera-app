<!--
	sHBD stake / unstake flow as a dedicated page (route: /stake).

	Replaces the dashboard StakePopup/StakeHBDModal dialog with the same staged
	StepsMachine flow (details → review → complete) the deposit/withdraw pages
	use — per milo (2026-07-13): "it's just inconsistent to have that be a
	pop-up when deposit and withdrawal are not."

	The dispatch logic is ported from StakeHBDModal verbatim: aioha wallets go
	through hbdStakeTx/hbdUnstakeTx (optionally prepending an L1→VSC deposit
	op), reown wallets sign a StakeTransaction via the wagmi/btc signer. It runs
	through StepsMachine's `onSubmit` override rather than send()/decideBroadcast
	— staking isn't a rail-based transfer.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getAuth } from '$lib/auth/store';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from './utils/sendOptions';
	import { HbdStakeTxState, provideHbdStakeState } from './utils/txState.svelte';
	import StepsMachine, { type MixedStepsArray } from './StepsMachine.svelte';
	import HbdStakeDetails from './stages/hbdStake/HbdStakeDetails.svelte';
	import ReviewHbdStake from './stages/hbdStake/ReviewHbdStake.svelte';
	import Complete from './stages/Complete.svelte';
	import { hbdStakeTx, hbdUnstakeTx } from '$lib/magiTransactions/hive';
	import {
		createClient,
		signAndBrodcastTransaction,
		type StakeTransaction
	} from '$lib/magiTransactions/eth/client';
	import { wagmiSigner } from '$lib/magiTransactions/eth/wagmi';
	import { btcSigner } from '$lib/magiTransactions/bitcoin/signer';
	import { wagmiConfig } from '$lib/auth/reown';
	import { getDidFromUsername, getUsernameFromAuth } from '$lib/getAccountName';
	import { addLocalTransaction, type PendingTx } from '$lib/stores/localStorageTxs';

	const auth = $derived(getAuth()());

	const txState = new HbdStakeTxState();
	// Deep-link support: /stake?mode=unstake opens on the unstake tab.
	if (page.url.searchParams.get('mode') === 'unstake') txState.mode = 'unstake';
	provideHbdStakeState(txState);

	function resetState() {
		txState.fromAmount = '0';
	}
	resetState();

	function leave() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- static root navigation; resolve() not exported in this kit version
		goto('/');
	}

	/** Map a thrown reown/wagmi error to user-readable copy (ported from StakeHBDModal). */
	function cleanReownError(error: unknown): string {
		if (!(error instanceof Error)) return 'Unknown error occurred during transaction';
		if (error.message.includes('User rejected') || error.message.includes('rejected'))
			return 'Transaction was cancelled by user';
		if (error.message.includes('wallet')) return 'Please connect your wallet and try again';
		if (error.message.includes('422'))
			return 'Transaction format error. Please check your inputs and try again';
		if (error.message.includes('network') || error.message.includes('Network'))
			return 'Network error. Please check your connection and try again';
		return 'Transaction failed.';
	}

	async function dispatchHbdStake(
		setStatus: (s: string, isError?: boolean) => void
	): Promise<Error | { id: string }> {
		if (!auth.value) return new Error('Not signed in.');
		const amount = txState.fromAmount;
		const recipient = txState.toUsername;
		const isStake = txState.mode === 'stake';
		if (!amount || Number(amount) <= 0) return new Error(`Cannot ${txState.mode} 0 HBD.`);
		if (!recipient) return new Error('Enter a recipient account.');

		setStatus('Awaiting transaction approval…');

		// ── reown (EVM / BTC wallets): sign a StakeTransaction ────────────────
		if (auth.value.provider === 'reown') {
			const client = createClient(auth.value.did);
			const coinAmt = new CoinAmount(amount, Coin.hbd);
			const opType = isStake ? 'stake_hbd' : 'unstake_hbd';
			const stakeOp: StakeTransaction = {
				op: opType,
				payload: {
					from: auth.value.did,
					to: getDidFromUsername(recipient),
					amount: coinAmt.toPrettyAmountString(),
					asset: coinAmt.coin.unit.toLowerCase(),
					type: opType
				}
			};
			const isBtcWallet = auth.value.did.startsWith('did:pkh:bip122:');
			// wagmiConfig is created lazily by initModal(); a reown session always
			// has it by the time this page renders, but guard rather than pass a
			// null through (the old modal passed it unchecked — a latent TS error).
			if (!isBtcWallet && !wagmiConfig) {
				setStatus('Wallet connection not ready — please try again.', true);
				return new Error('Wallet connection not ready — please try again.');
			}
			try {
				const result = isBtcWallet
					? await signAndBrodcastTransaction([stakeOp], btcSigner, client, undefined)
					: await signAndBrodcastTransaction(
							[stakeOp],
							wagmiSigner,
							client,
							undefined,
							wagmiConfig!
						);
				// NB: no addLocalTransaction here — same as the old modal (pending
				// a backend fix for vsc-typed local txs).
				setStatus('');
				return { id: result.id.toString() };
			} catch (error) {
				console.error('Transaction error:', error);
				const clean = cleanReownError(error);
				setStatus(clean, true);
				return new Error(clean);
			}
		}

		// ── aioha (Hive wallets): custom_json multi-op, Active key ────────────
		const username = getUsernameFromAuth(auth);
		if (!username || !auth.value.aioha) return new Error('Not signed in with a Hive account.');
		const res = isStake
			? await hbdStakeTx(amount, recipient, username, txState.shouldDeposit, auth.value.aioha)
			: await hbdUnstakeTx(amount, recipient, username, txState.shouldDeposit, auth.value.aioha);
		if (!res.success) {
			setStatus(res.error || 'Transaction failed.', true);
			return new Error(res.error || 'Transaction failed.');
		}

		const opType = isStake ? 'stake_hbd' : 'unstake_hbd';
		const amountStr = new CoinAmount(amount, Coin.hbd).toAmountString();
		const ops: PendingTx['ops'] = [
			{
				data: {
					amount: amountStr,
					asset: Coin.hbd.unit.toLowerCase(),
					from: username,
					to: recipient,
					type: opType
				},
				type: opType,
				index: 0
			}
		];
		if (txState.shouldDeposit) {
			ops.push({
				data: {
					amount: amountStr,
					asset: Coin.hbd.unit.toLowerCase(),
					from: username,
					to: recipient,
					type: 'deposit',
					memo: ''
				},
				type: 'deposit',
				index: 1
			});
		}
		addLocalTransaction({ ops, timestamp: new Date(), id: res.result, type: 'hive' });
		setStatus('');
		return { id: res.result };
	}

	const stepsData: MixedStepsArray = [
		{ value: 'options', component: HbdStakeDetails },
		{ value: 'review', component: ReviewHbdStake, popup: true },
		{ value: 'complete', component: Complete, popup: true }
	];

	let extraProps = $derived({
		close: leave,
		onClose: leave,
		compact: false
	});
</script>

<div class="stake-page-wrapper">
	<div class="stake-flow-col">
		<StepsMachine
			size="page"
			txType={txState.mode}
			{resetState}
			{stepsData}
			{extraProps}
			onSubmit={dispatchHbdStake}
		/>
	</div>
</div>

<style lang="scss">
	.stake-page-wrapper {
		display: flex;
		flex-direction: column;
	}
	.stake-flow-col {
		min-width: 0;
		width: 100%;
		/* Match the deposit page's flow-column width so the timeline cards
		   read identically across /deposit, /withdraw and /stake. */
		max-width: 44rem;
		margin: 0 auto;
		/* Generous bottom padding so the last step (and the unstake note)
		   clears the fixed NavButtons bar. */
		padding: 2rem 1.5rem 7rem;
		display: flex;
		flex-direction: column;
	}
	/* The StepsMachine's page variant is built for height-constrained layouts
	   (flex-grow + inner overflow-y). This page has ample vertical space, so
	   neutralise the inner scrollbox: let the timeline take its natural height
	   and the document scroll. */
	.stake-flow-col :global([data-part='root'][data-variant='page']) {
		overflow-y: visible;
		flex-grow: 0;
	}
	.stake-flow-col :global([data-part='root'][data-variant='page'] > [data-part='content']) {
		overflow-y: visible;
		margin: 0;
	}
	@media (max-width: 720px) {
		.stake-flow-col {
			padding: 1.25rem 1rem 3rem;
		}
	}
</style>
