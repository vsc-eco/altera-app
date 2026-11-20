<script lang="ts">
	// Deposit ETH or USDC from Ethereum into Magi (the EVM bridge's vault).
	// The BtcMainnetDeposit pattern: logged in with the matching wallet, the page
	// sends for you; otherwise it shows where and how to send.
	import { getAuth } from '$lib/auth/store';
	import { evmMinDeposit, evmProofFee } from '$lib/stores/currentBalance';
	import { EVM_ETH_DEPOSIT_TAX_BPS } from '$lib/constants';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { Network } from '$lib/sendswap/utils/sendOptions';
	import { useDepositState } from '$lib/sendswap/utils/txState.svelte';
	import {
		etherscanTxUrl,
		fetchActiveVaultAddress,
		fetchDepositContractAddress,
		sendBridgeDepositFromWallet
	} from '$lib/magiTransactions/eth/bridgeDeposit';
	import {
		discoverBrowserWallets,
		sendMagiDepositFromBrowserWallet,
		type BrowserWallet
	} from '$lib/magiTransactions/eth/magiDeposit';
	import { onMount } from 'svelte';
	import { withSideWallet } from '$lib/auth/sideWallet';

	const txState = useDepositState();
	const auth = $derived(getAuth()());
	const asset = $derived(txState.to?.coin?.value === Coin.usdc.value ? Coin.usdc : Coin.eth);
	const isEthWallet = $derived(
		auth.value?.provider === 'reown' && !!auth.value.did?.startsWith('did:pkh:eip155:')
	);
	// Logged in with a Bitcoin wallet through Reown: a browser Ethereum wallet asked
	// to sign here would be picked up by Reown's own connectors and could replace
	// that login (sideWallet.ts), so this login deposits through Hive or the
	// Ethereum wallet itself instead.
	const isBtcWallet = $derived(
		auth.value?.provider === 'reown' && !!auth.value.did?.startsWith('did:pkh:bip122:')
	);

	let vaultAddress = $state<string | null>(null);
	let vaultError = $state<string | null>(null);
	// The MagiDeposit contract: its call names the account to credit, so any
	// login (Hive included) can deposit ETH and USDC without hex data (RP-7).
	let depositContract = $state<string | null>(null);
	let depositContractLoaded = $state(false);
	let loadedFor = $state<string | null>(null);
	$effect(() => {
		const did = auth.value?.did;
		if (!did || did === loadedFor) return;
		loadedFor = did;
		vaultAddress = null;
		vaultError = null;
		depositContract = null;
		depositContractLoaded = false;
		fetchActiveVaultAddress(did).then((a) => {
			if (auth.value?.did !== did) return;
			vaultAddress = a;
			if (!a) vaultError = 'The bridge has no active vault right now. Try again later.';
		});
		fetchDepositContractAddress(did).then((a) => {
			if (auth.value?.did !== did) return;
			depositContract = a;
			depositContractLoaded = true;
		});
	});

	// The Ethereum wallets installed in this browser (EIP-6963): the user picks
	// one and it is asked to sign the deposit.
	// $state.raw: the wallet's provider must reach the send untouched, never as a
	// Svelte state proxy of it.
	let wallets = $state.raw<BrowserWallet[] | null>(null);
	onMount(() => {
		discoverBrowserWallets().then((w) => (wallets = w));
	});

	// The bridge keeps its proving fee out of every deposit it credits (prooffee.go).
	const proofFee = $derived(asset.value === Coin.usdc.value ? $evmProofFee.usdc : $evmProofFee.eth);
	const proofFeeText = $derived(
		(proofFee / 10 ** asset.decimalPlaces).toLocaleString(undefined, { maximumFractionDigits: 6 }) +
			` ${asset.label}`
	);
	// Measured on testnet 11-19: sent 17:38, credited 18:06 (finality, then the
	// operator batches header proofs for up to 10 min and proves them).
	// Below the bridge's minimum a deposit is not credited and stays in the
	// vault (DUST-1), so the page names the minimum and never sends less.
	const minDeposit = $derived(
		asset.value === Coin.usdc.value ? $evmMinDeposit.usdc : $evmMinDeposit.eth
	);
	const minDepositText = $derived(
		minDeposit == null
			? ''
			: (minDeposit / 10 ** asset.decimalPlaces).toLocaleString(undefined, {
					maximumFractionDigits: 6
				}) + ` ${asset.label}`
	);
	const depositHint = $derived(
		(minDeposit != null
			? `Send at least ${minDepositText}: less is not credited and stays in the bridge vault. `
			: '') +
			'Credited about 30 minutes after it is sent (Ethereum finality, then the bridge proves the block). ' +
			(asset.value === Coin.eth.value
				? `The bridge keeps ${EVM_ETH_DEPOSIT_TAX_BPS / 100}% of an ETH deposit for its gas reserve` +
					(proofFee > 0 ? `, plus a proving fee of ${proofFeeText}.` : '.')
				: proofFee > 0
					? `The bridge keeps a proving fee of ${proofFeeText} from each deposit.`
					: '')
	);

	let coinAmount = $state(new CoinAmount(0, Coin.eth));
	$effect(() => {
		if (coinAmount.coin.value !== asset.value) coinAmount = new CoinAmount(0, asset);
	});
	let inputId = $state('');
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let sentHash = $state<string | null>(null);
	const belowMin = $derived(minDeposit == null || coinAmount.amount < minDeposit);

	async function sendFromWallet() {
		if (!vaultAddress || belowMin) return;
		sending = true;
		sendError = null;
		sentHash = null;
		try {
			sentHash = await sendBridgeDepositFromWallet(
				coinAmount,
				vaultAddress,
				auth.value?.address ?? ''
			);
			coinAmount = new CoinAmount(0, asset);
		} catch (err) {
			sendError = err instanceof Error ? err.message : String(err);
		} finally {
			sending = false;
		}
	}

	// Any login: the browser's own wallet sends through the MagiDeposit contract,
	// credited to the account logged in here (never through the Reown modal,
	// which would log in as the wallet's address).
	async function sendFromBrowserWallet(wallet: BrowserWallet) {
		const did = auth.value?.did;
		if (!depositContract || !did || belowMin) return;
		sending = true;
		sendError = null;
		sentHash = null;
		try {
			// Ask the bridge again: the vault (and its deposit contract) may have
			// rotated since the page loaded.
			const contract = await fetchDepositContractAddress(did);
			if (!contract) throw new Error("The bridge's deposit contract could not be read. Try again.");
			depositContract = contract;
			// withSideWallet: the signing wallet never becomes the login (sideWallet.ts).
			sentHash = await withSideWallet(wallet.id, () =>
				sendMagiDepositFromBrowserWallet(coinAmount, contract, did, wallet.provider)
			);
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
				this account on Magi.
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
			<PillButton styleType="invert" disabled={sending || belowMin} onclick={sendFromWallet}>
				{sending ? 'Waiting for your wallet…' : `Deposit ${asset.label}`}
			</PillButton>
			{#if minDeposit == null}
				<p class="error">The bridge's minimum for {asset.label} could not be read yet.</p>
			{:else if coinAmount.amount > 0 && belowMin}
				<p class="error">
					Below the minimum deposit ({minDepositText}): it would not be credited.
				</p>
			{/if}
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
	{:else if isBtcWallet}
		<p class="hint">
			You are logged in with a Bitcoin wallet. To deposit ETH or USDC, log in with Hive or with the
			Ethereum wallet that sends it.
		</p>
	{:else if depositContract}
		<div class="section">
			<p class="hint">
				Your Ethereum wallet signs the deposit, and it is credited to <b>{auth.value?.did}</b> on
				Magi. Ethereum charges its own gas in ETH, so the wallet needs a little ETH.
				{#if asset.value === Coin.usdc.value}
					The first time, the wallet asks twice: allow the deposit contract to take this USDC, then
					the deposit.
				{/if}
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
			{#if wallets === null}
				<p class="hint">Looking for the wallets in this browser…</p>
			{:else if wallets.length === 0}
				<p class="error">
					No Ethereum wallet found in this browser. Install or unlock MetaMask or Rabby, then
					reload.
				</p>
			{:else}
				{#each wallets as wallet (wallet.id)}
					<PillButton
						styleType="invert"
						disabled={sending || belowMin}
						onclick={() => sendFromBrowserWallet(wallet)}
					>
						{#if wallet.icon}<img class="wallet-icon" src={wallet.icon} alt="" />{/if}
						{sending ? 'Waiting for your wallet…' : `Deposit ${asset.label} with ${wallet.name}`}
					</PillButton>
				{/each}
			{/if}
			{#if minDeposit == null}
				<p class="error">The bridge's minimum for {asset.label} could not be read yet.</p>
			{:else if coinAmount.amount > 0 && belowMin}
				<p class="error">
					Below the minimum deposit ({minDepositText}): it would not be credited.
				</p>
			{/if}
			{#if sendError}<p class="error">{sendError}</p>{/if}
			{#if sentHash}
				<p class="hint">
					Sent:
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external Etherscan link, not an app route -->
					<a href={etherscanTxUrl(sentHash)} target="_blank" rel="noopener noreferrer"
						>{sentHash.slice(0, 10)}…</a
					>. It shows on Magi after Ethereum finality and the bridge's header proof.
				</p>
			{/if}
		</div>
	{:else if depositContractLoaded}
		<p class="error">
			The bridge's deposit contract is not ready yet (its code is not attested). Try again later.
		</p>
	{:else}
		<p class="hint">Looking up the bridge's deposit contract…</p>
	{/if}
	{#if vaultAddress}
		<p class="hint">{depositHint}</p>
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
	.wallet-icon {
		width: 1.1rem;
		height: 1.1rem;
		margin-right: 0.4rem;
		vertical-align: middle;
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
