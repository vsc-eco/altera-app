<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { browser } from '$app/environment';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { accountBalance, getBalanceAmount } from '$lib/stores/currentBalance';
	import { Info } from '@lucide/svelte';
	import Card from '$lib/cards/Card.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import AmountInput from '$lib/currency/AmountInput.svelte';
	import { isVscTestnet } from '$lib/../client';
	import QRCode from 'qrcode';

	// `onClose` closes the parent Deposit dialog (wired via
	// StepsMachine.extraProps to the parent Dialog's `toggle`).
	// `onBroadcast` is called after a successful wallet broadcast so
	// the parent can show its own receipt popup — we can't render the
	// receipt in this component because `onClose` unmounts it.
	let {
		onClose,
		onBroadcast
	}: {
		onClose?: () => void;
		onBroadcast?: (tx: {
			txHash: string;
			amount: CoinAmount<typeof Coin.btc>;
			address: string;
		}) => void;
	} = $props();

	const auth = $derived(getAuth()());

	// LocalStorage toggle: when set, the user has opted in to the
	// "sign with connected wallet" flow and will see the amount input
	// + Sign button on subsequent visits. Otherwise they just get the
	// copyable address and send manually from their wallet.
	const SIGN_PREF_KEY = 'btc-deposit-sign-pref';

	function loadSignPref(): boolean {
		if (!browser) return false;
		try {
			return localStorage.getItem(SIGN_PREF_KEY) === 'true';
		} catch {
			return false;
		}
	}
	function saveSignPref(value: boolean) {
		if (!browser) return;
		try {
			localStorage.setItem(SIGN_PREF_KEY, String(value));
		} catch {}
	}

	let useSignFlow = $state(loadSignPref());

	// Fetched mapping-bot address.
	let btcAddress = $state<string | null>(null);
	let addressLoading = $state(false);
	let addressError = $state<string | null>(null);

	// QR code data-URL for the current deposit address. Regenerated
	// whenever `btcAddress` changes; cleared when the address resets.
	let btcQrDataUrl = $state<string | null>(null);
	$effect(() => {
		const addr = btcAddress;
		if (!addr) {
			btcQrDataUrl = null;
			return;
		}
		// BIP21 URI ("bitcoin:<addr>") makes the QR scannable directly
		// by most Bitcoin wallets as a "pay this address" intent.
		QRCode.toDataURL(`bitcoin:${addr}`, {
			width: 220,
			margin: 1,
			color: { dark: '#FFFFFF', light: '#00000000' }
		})
			.then((url) => {
				btcQrDataUrl = url;
			})
			.catch((err) => {
				console.warn('QR generation failed', err);
				btcQrDataUrl = null;
			});
	});

	$effect(() => {
		if (!auth.value || btcAddress || addressLoading) return;
		fetchAddress();
	});

	async function fetchAddress() {
		if (!auth.value) return;
		addressLoading = true;
		addressError = null;
		try {
			// Route through our own /api/mapping-bot proxy — the bot
			// has no CORS headers so a direct browser fetch can read
			// the status but not the response body. The proxy also
			// selects the testnet or mainnet upstream based on the
			// `network` field so a testnet Leather wallet gets a
			// `tb1q…` deposit address (matching the wallet network)
			// instead of a mainnet `bc1q…` one that Leather would
			// reject with "Address is for incorrect network".
			const response = await fetch('/api/mapping-bot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					instruction: `deposit_to=${auth.value.did}`,
					network: isVscTestnet() ? 'testnet' : 'mainnet'
				})
			});
			if (!response.ok) {
				const text = await response.text();
				throw new Error(`Mapping bot error (${response.status}): ${text}`);
			}
			const { address } = (await response.json()) as { address: string };
			if (!address) throw new Error('Mapping bot returned no address');
			btcAddress = address;
		} catch (err) {
			addressError = err instanceof Error ? err.message : String(err);
		} finally {
			addressLoading = false;
		}
	}

	// Amount input state — only meaningful when the user opts into the
	// sign flow. Max is the connected BTC wallet balance from the
	// accountBalance store (populated via mempool.space for reown
	// bip122 users, see fetchOnChainBtcBalance).
	let coinAmount = $state(new CoinAmount(0, Coin.btc));
	let inputId = $state('');
	const maxAmount = $derived(
		getBalanceAmount($accountBalance, Coin.btc, Network.btcMainnet)
	);
	// Reserve ~5000 sats from the Max button for miner fees.
	// Leather computes coin selection against (amount + estimated
	// fees) and rejects with `BitcoinError: InsufficientFunds` if
	// the sum exceeds the wallet balance. The reserve needs to be
	// generous enough to cover the case where a prior deposit is
	// still unconfirmed, because Leather then has to spend from
	// the unconfirmed change output and applies a higher effective
	// fee-rate policy for RBF. 5000 sats handles typical testnet3
	// and mainnet conditions; if the fee is still higher than
	// that, the user can lower the amount manually.
	const FEE_RESERVE_SATS = 5000;
	const maxSendableAmount = $derived.by(() => {
		const raw = maxAmount.amount;
		if (raw <= FEE_RESERVE_SATS) return new CoinAmount(0, Coin.btc);
		return new CoinAmount(raw - FEE_RESERVE_SATS, Coin.btc, true);
	});
	const hasAmount = $derived(coinAmount.amount > 0);
	const exceedsBalance = $derived(
		maxAmount.amount > 0 && coinAmount.amount > maxAmount.amount
	);
	const canSign = $derived(
		hasAmount &&
			!exceedsBalance &&
			!!btcAddress &&
			auth.value?.provider === 'reown' &&
			auth.value.did?.startsWith('did:pkh:bip122:')
	);

	let signing = $state(false);
	let signStatus = $state('');
	let signError = $state<string | null>(null);

	async function signWithWallet() {
		if (!btcAddress) return;
		signing = true;
		signStatus = 'Waiting for Bitcoin wallet approval…';
		signError = null;
		try {
			const { sendBtcFromConnectedWallet } = await import(
				'$lib/magiTransactions/bitcoin/walletSend'
			);
			const sentAmount = new CoinAmount(coinAmount.amount, Coin.btc, true);
			const txHash = await sendBtcFromConnectedWallet({
				amountSats: coinAmount.amount,
				recipient: btcAddress,
				fallbackAddress: auth.value?.address
			});
			signStatus = '';
			signError = null;
			// Reset input on success so the user can't double-spend.
			coinAmount = new CoinAmount(0, Coin.btc);
			// Notify the parent before closing ourselves — the parent
			// will render the receipt dialog at its own level so it
			// survives this component being unmounted.
			onBroadcast?.({ txHash, amount: sentAmount, address: btcAddress });
			onClose?.();
		} catch (err) {
			signError = err instanceof Error ? err.message : String(err);
			signStatus = '';
		} finally {
			signing = false;
		}
	}

	function enableSignFlow() {
		useSignFlow = true;
		saveSignPref(true);
	}
	function disableSignFlow() {
		useSignFlow = false;
		saveSignPref(false);
		signError = null;
		signStatus = '';
	}

	const isReownBtc = $derived(
		auth.value?.provider === 'reown' && auth.value.did?.startsWith('did:pkh:bip122:')
	);
</script>

{#if auth.value}
	<div class="sections">
		<div class="section">
			<Card>
				<div class="blurb">
					<span><Info /></span>
					<p>
						Transfer {Coin.btc.value} to this bitcoin address with your favorite wallet or exchange. This
						address is unique to you, and will not change. Please keep in mind that transaction settlement
						time, averages about 30 minutes.
					</p>
				</div>
			</Card>
		</div>

		<div class="section">
			{#if addressLoading}
				<p class="muted">Requesting deposit address…</p>
			{:else if addressError}
				<p class="error">{addressError}</p>
			{:else if btcAddress}
				{#if btcQrDataUrl}
					<div class="qr-wrap">
						<img
							class="qr-img"
							src={btcQrDataUrl}
							alt="QR code for Bitcoin deposit address"
							width="220"
							height="220"
						/>
						<span class="qr-hint">Scan with a Bitcoin wallet to send</span>
					</div>
				{/if}
				<Clipboard value={btcAddress} label="Bitcoin Address" disabled={false} />
			{/if}
		</div>

		{#if isReownBtc && btcAddress}
			{#if !useSignFlow}
				<div class="section">
					<PillButton styleType="outline" onclick={enableSignFlow}>
						Sign with wallet
					</PillButton>
					<span class="hint">
						Let your connected Bitcoin wallet sign the deposit directly instead of copying the
						address manually.
					</span>
				</div>
			{:else}
				<div class="section sign-flow">
					<label class="field-label" for={inputId}>Amount</label>
					<div class="amount-input">
						<AmountInput
							bind:coinAmount
							coinOpts={[{ coin: Coin.btc, network: Network.btcMainnet }]}
							{maxAmount}
							bind:id={inputId}
						/>
					</div>
					<div class="balance-row">
						<span class="balance-label"
							>Balance: {maxAmount.toPrettyAmountString()} BTC</span
						>
						<button
							type="button"
							class="max-btn"
							onclick={() => (coinAmount = maxSendableAmount)}
							disabled={maxSendableAmount.amount <= 0}
							title="Leaves ~{FEE_RESERVE_SATS} sats headroom for miner fees"
						>
							Max
						</button>
					</div>

					{#if exceedsBalance}
						<p class="error">Amount exceeds your wallet balance.</p>
					{/if}
					{#if signError}
						<p class="error">{signError}</p>
					{/if}
					{#if signStatus}
						<p class="muted">{signStatus}</p>
					{/if}

					<div class="sign-actions">
						<PillButton
							styleType="invert submit"
							onclick={signWithWallet}
							disabled={!canSign || signing}
						>
							{signing ? 'Signing…' : 'Sign'}
						</PillButton>
					</div>
				</div>
			{/if}
		{/if}
	</div>
{/if}


<style lang="scss">
	.sections {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.blurb {
		display: flex;
		align-items: center;
		gap: 1rem;
		p {
			line-height: 1.2;
		}
	}
	.hint {
		font-size: 0.75rem;
		color: var(--dash-text-muted);
	}
	.qr-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0 0.25rem;
	}
	.qr-img {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		padding: 0.75rem;
	}
	.qr-hint {
		font-size: 0.7rem;
		color: var(--dash-text-muted);
		text-align: center;
	}
	.field-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--dash-text-muted);
	}
	.amount-input {
		min-height: 3.75rem;
	}
	.balance-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.balance-label {
		font-size: 0.75rem;
		color: var(--dash-text-muted);
	}
	.max-btn {
		padding: 0.2rem 0.6rem;
		border: 1px solid rgba(111, 106, 248, 0.35);
		border-radius: 12px;
		background: transparent;
		color: var(--dash-text-secondary);
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		cursor: pointer;
	}
	.max-btn:hover:not(:disabled) {
		background: rgba(111, 106, 248, 0.15);
		color: var(--dash-text-primary);
		border-color: var(--dash-accent-purple);
	}
	.max-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.sign-flow {
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		padding: 1rem;
	}
	.sign-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.muted {
		color: var(--dash-text-muted);
		font-size: 0.8rem;
		margin: 0;
	}
	.error {
		color: var(--dash-accent-red, #e2595b);
		font-size: 0.8rem;
		margin: 0;
	}
</style>
