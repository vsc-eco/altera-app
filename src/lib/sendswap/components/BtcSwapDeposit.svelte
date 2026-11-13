<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin, type Network } from '$lib/sendswap/utils/sendOptions';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import DepositAddressNotice from '$lib/sendswap/components/DepositAddressNotice.svelte';
	import { isVscTestnet } from '$lib/../client';
	import {
		buildBtcSwapInstruction,
		requestBtcSwapDepositAddress
	} from '$lib/magiTransactions/bitcoin/swapDeposit';

	// A swap paid with Bitcoin from the connected wallet. Same flow as the
	// QuickSwap card's "Send Bitcoin" dialog: get a deposit address bound to the
	// swap from the mapping bot, then the user sends BTC to it from the wallet
	// (or by hand). See magiTransactions/bitcoin/swapDeposit.ts.
	let {
		fromAmount,
		recipient,
		toCoin,
		toNetwork,
		fallbackAddress,
		onback,
		ondone
	}: {
		/** BTC amount as entered (e.g. "0.0001"). */
		fromAmount: string;
		recipient: string | undefined;
		toCoin: Coin;
		toNetwork: Network;
		fallbackAddress?: string;
		/** Back to the review. */
		onback: () => void;
		/** Close the flow. */
		ondone: () => void;
	} = $props();

	const amount = $derived(new CoinAmount(fromAmount || '0', Coin.btc));

	let loading = $state(true);
	let address = $state<string | null>(null);
	let error = $state<string | null>(null);
	let sending = $state(false);
	let status = $state('');
	let sentTxId = $state<string | null>(null);
	let qr = $state<string | null>(null);

	onMount(async () => {
		const built = buildBtcSwapInstruction({
			recipient,
			toCoin: toCoin.value,
			toNetwork: toNetwork.value
		});
		if (!built.ok) {
			error = built.error;
			loading = false;
			return;
		}
		try {
			address = await requestBtcSwapDepositAddress(
				built.instruction,
				isVscTestnet() ? 'testnet' : 'mainnet'
			);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	});

	// BIP21 URI with the amount, so a scanning wallet fills in both fields.
	$effect(() => {
		const addr = address;
		const btcAmount = amount.toAmountString();
		if (!addr) {
			qr = null;
			return;
		}
		const uri =
			btcAmount && btcAmount !== '0' ? `bitcoin:${addr}?amount=${btcAmount}` : `bitcoin:${addr}`;
		QRCode.toDataURL(uri, {
			width: 220,
			margin: 1,
			color: { dark: '#FFFFFF', light: '#00000000' }
		})
			.then((url) => {
				qr = url;
			})
			.catch(() => {
				qr = null;
			});
	});

	async function sendWithWallet() {
		if (!address || sending || sentTxId) return;
		error = null;
		sending = true;
		status = 'Waiting for Bitcoin wallet approval…';
		try {
			const { sendBtcFromConnectedWallet } =
				await import('$lib/magiTransactions/bitcoin/walletSend');
			sentTxId = await sendBtcFromConnectedWallet({
				amountSats: amount.amount,
				recipient: address,
				fallbackAddress
			});
			status = '';
		} catch (err) {
			status = '';
			error = err instanceof Error ? err.message : String(err);
		} finally {
			sending = false;
		}
	}
</script>

<div class="btc-deposit">
	<p class="btc-deposit-intro">
		Send exactly the amount below to the address shown. The mapping bot observes the transaction and
		forwards the swap to <strong>{recipient ?? ''}</strong> as {toCoin.label} on {toNetwork.label}.
	</p>

	{#if loading}
		<p class="btc-deposit-loading">Requesting deposit address…</p>
	{:else if !address}
		<p class="btc-deposit-error">{error}</p>
		<div class="btc-deposit-actions">
			<PillButton styleType="outline" onclick={onback}>Back</PillButton>
		</div>
	{:else if sentTxId}
		<p class="btc-deposit-status">
			Bitcoin sent. The swap runs once the deposit is confirmed on Bitcoin.
		</p>
		<div class="btc-deposit-field">
			<span class="btc-deposit-label">Bitcoin transaction</span>
			<Clipboard value={sentTxId} label="Bitcoin transaction" disabled={false} />
		</div>
		<div class="btc-deposit-actions">
			<PillButton styleType="invert submit" onclick={ondone}>Done</PillButton>
		</div>
	{:else}
		<DepositAddressNotice />
		{#if qr}
			<div class="btc-deposit-qr">
				<img src={qr} alt="Deposit address QR code" width="220" height="220" />
				<span class="btc-deposit-qr-hint"
					>Scan with a Bitcoin wallet to prefill address &amp; amount</span
				>
			</div>
		{/if}
		<div class="btc-deposit-field">
			<span class="btc-deposit-label">Amount</span>
			<Clipboard value={amount.toAmountString()} label="Amount (BTC)" disabled={false} />
		</div>
		<div class="btc-deposit-field">
			<span class="btc-deposit-label">Deposit address</span>
			<Clipboard value={address} label="Bitcoin address" disabled={false} />
		</div>

		<div class="btc-deposit-actions">
			<PillButton styleType="invert submit" onclick={sendWithWallet} disabled={sending}>
				Send with connected wallet
			</PillButton>
			<PillButton styleType="outline" onclick={ondone} disabled={sending}>
				I'll send manually
			</PillButton>
		</div>
		{#if status}
			<p class="btc-deposit-status">{status}</p>
		{/if}
		{#if error}
			<p class="btc-deposit-error">{error}</p>
		{/if}
	{/if}
</div>

<style lang="scss">
	.btc-deposit {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: min(22rem, 100%);
		max-width: 28rem;
	}
	.btc-deposit-intro {
		color: var(--dash-text-secondary);
		font-size: 0.85rem;
		line-height: 1.4;
		margin: 0;
	}
	.btc-deposit-loading,
	.btc-deposit-status {
		color: var(--dash-text-muted);
		font-size: 0.8rem;
		margin: 0;
	}
	.btc-deposit-error {
		color: var(--dash-accent-red, #e2595b);
		font-size: 0.8rem;
		margin: 0;
	}
	.btc-deposit-qr {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0 0.5rem;
		img {
			background: rgba(255, 255, 255, 0.04);
			border: 1px solid var(--dash-card-border);
			border-radius: 16px;
			padding: 0.75rem;
		}
	}
	.btc-deposit-qr-hint {
		font-size: 0.7rem;
		color: var(--dash-text-muted);
		text-align: center;
	}
	.btc-deposit-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.btc-deposit-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--dash-text-muted);
	}
	.btc-deposit-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
</style>
