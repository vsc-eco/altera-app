<script lang="ts">
	// Deposit ETH or USDC from Ethereum into Magi (the EVM bridge's vault).
	// The BtcMainnetDeposit pattern: logged in with the matching wallet, the page
	// sends for you; otherwise it shows where and how to send.
	import { getAuth } from '$lib/auth/store';
	import { evmProofFee } from '$lib/stores/currentBalance';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { Network } from '$lib/sendswap/utils/sendOptions';
	import { useDepositState } from '$lib/sendswap/utils/txState.svelte';
	import {
		depositToCalldata,
		etherscanTxUrl,
		fetchActiveVaultAddress,
		sendBridgeDepositFromWallet
	} from '$lib/magiTransactions/eth/bridgeDeposit';

	const txState = useDepositState();
	const auth = $derived(getAuth()());
	const asset = $derived(txState.to?.coin?.value === Coin.usdc.value ? Coin.usdc : Coin.eth);
	const isEthWallet = $derived(
		auth.value?.provider === 'reown' && !!auth.value.did?.startsWith('did:pkh:eip155:')
	);

	let vaultAddress = $state<string | null>(null);
	let vaultError = $state<string | null>(null);
	let loadedFor = $state<string | null>(null);
	$effect(() => {
		const did = auth.value?.did;
		if (!did || did === loadedFor) return;
		loadedFor = did;
		vaultAddress = null;
		vaultError = null;
		fetchActiveVaultAddress(did).then((a) => {
			if (auth.value?.did !== did) return;
			vaultAddress = a;
			if (!a) vaultError = 'The bridge has no active vault right now. Try again later.';
		});
	});

	const depositData = $derived(auth.value?.did ? depositToCalldata(auth.value.did) : null);

	// The bridge keeps its proving fee out of every deposit it credits (prooffee.go).
	const proofFee = $derived(asset.value === Coin.usdc.value ? $evmProofFee.usdc : $evmProofFee.eth);
	const proofFeeText = $derived(
		(proofFee / 10 ** asset.decimalPlaces).toLocaleString(undefined, { maximumFractionDigits: 6 }) +
			` ${asset.label}`
	);

	let coinAmount = $state(new CoinAmount(0, Coin.eth));
	$effect(() => {
		if (coinAmount.coin.value !== asset.value) coinAmount = new CoinAmount(0, asset);
	});
	let inputId = $state('');
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let sentHash = $state<string | null>(null);

	async function sendFromWallet() {
		if (!vaultAddress || coinAmount.amount <= 0) return;
		sending = true;
		sendError = null;
		sentHash = null;
		try {
			sentHash = await sendBridgeDepositFromWallet(coinAmount, vaultAddress);
			coinAmount = new CoinAmount(0, asset);
		} catch (err) {
			sendError = err instanceof Error ? err.message : String(err);
		} finally {
			sending = false;
		}
	}
</script>

<div class="sections">
	{#if vaultError}
		<p class="error">{vaultError}</p>
	{:else if !vaultAddress}
		<p class="hint">Looking up the bridge's deposit address…</p>
	{:else if isEthWallet}
		<div class="section">
			<p class="hint">
				Sent from your connected wallet ({auth.value?.address}) to the bridge vault, and credited to
				this account on Magi after Ethereum finality (~20 min).
			</p>
			<label for={inputId}>Amount</label>
			<div class="amount-input">
				<AmountInput
					bind:coinAmount
					coinOpts={[{ coin: asset, network: Network.ethMainnet }]}
					expressIn={asset}
					bind:id={inputId}
				/>
			</div>
			<PillButton
				styleType="invert"
				disabled={sending || coinAmount.amount <= 0}
				onclick={sendFromWallet}
			>
				{sending ? 'Waiting for your wallet…' : `Deposit ${asset.label}`}
			</PillButton>
			{#if sendError}<p class="error">{sendError}</p>{/if}
			{#if sentHash}
				<p class="hint">
					Sent: <a href={etherscanTxUrl(sentHash)} target="_blank" rel="noopener noreferrer"
						>{sentHash.slice(0, 10)}…</a
					>. It shows on Magi after Ethereum finality and the bridge's header proof.
				</p>
			{/if}
		</div>
		<Clipboard value={vaultAddress} label="Bridge vault address" disabled={false} />
	{:else if asset.value === Coin.eth.value}
		<div class="section">
			<p class="hint">
				Send ETH from any Ethereum wallet to the vault address below <b>with this data</b> attached.
				The data credits it to {auth.value?.did}; without it the ETH goes to the Magi account of the
				Ethereum address that sent it.
			</p>
			<Clipboard value={vaultAddress} label="Bridge vault address" disabled={false} />
			{#if depositData}
				<Clipboard value={depositData} label="Data (hex)" disabled={false} />
			{/if}
		</div>
	{:else}
		<p class="hint">
			A USDC transfer cannot name a Magi account, so it is credited to the Magi account of the
			Ethereum address that sends it. Log in with that Ethereum wallet to deposit USDC and use it.
		</p>
	{/if}
	{#if vaultAddress && proofFee > 0}
		<p class="hint">The bridge keeps a proving fee of {proofFeeText} from each deposit.</p>
	{/if}
</div>

<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.amount-input {
		height: 65px;
	}
	.hint {
		font-size: 0.85rem;
		opacity: 0.7;
		margin: 0;
	}
	.error {
		color: var(--dash-accent-red);
		font-size: 0.875rem;
		margin: 0;
	}
</style>
