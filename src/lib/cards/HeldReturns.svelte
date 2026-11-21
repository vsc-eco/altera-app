<script lang="ts">
	import Card from '$lib/cards/Card.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { getAuth } from '$lib/auth/store';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	import { Coin } from '$lib/sendswap/utils/sendOptions';
	import { vscNetworkId } from '../../client';
	import {
		fetchHeldReturns,
		formatUnitsExact,
		heldReturnMinOut,
		releaseHeldReturnCall,
		type HeldReturn
	} from '$lib/magiTransactions/eth/heldReturns';
	import { estimateCallRc } from '$lib/magiTransactions/hive/vscOperations/rcSizing';

	// A payout that failed on Ethereum is held for its sender (never put in a
	// Magi balance) until the bridge's bot swaps it back, usually within minutes.
	// This card shows it and lets the sender take it back now at today's price,
	// or have the held ETH/USDC itself sent to an Ethereum address.

	let auth = $derived(getAuth()());
	let held = $state<HeldReturn[]>([]);
	let busy = $state<number | null>(null);
	let status = $state('');
	let ethTo = $state<Record<number, string>>({});

	const coinOf = (v: string) =>
		v === Coin.eth.value
			? Coin.eth
			: v === Coin.usdc.value
				? Coin.usdc
				: v === Coin.hbd.value
					? Coin.hbd
					: v === Coin.btc.value
						? Coin.btc
						: Coin.hive;
	const where = (r: HeldReturn) => (r.returnAsset === 'btc' ? 'Bitcoin' : 'Hive');
	// Exact (ETH's wei do not fit a JS number) and without trailing zeros.
	const shown = (r: HeldReturn) => {
		const c = coinOf(r.asset);
		return `${formatUnitsExact(r.amount, c.decimalPlaces)} ${new CoinAmount(0, c).getDisplayUnit()}`;
	};

	let did = $derived(auth.value?.did ?? '');

	async function load() {
		const d = did;
		const got = d ? await fetchHeldReturns(d) : [];
		if (d === did) held = got; // a reply for an account switched away from is dropped
	}

	// Read as soon as the login is known (it resolves after the page mounts),
	// again on an account switch, and every minute.
	$effect(() => {
		if (!did) {
			held = [];
			return;
		}
		void load();
		const t = setInterval(load, 60_000);
		return () => clearInterval(t);
	});

	async function release(r: HeldReturn, mode: 'now' | 'eth') {
		const a = auth.value;
		if (!a?.did || busy !== null) return;
		busy = r.id;
		status = '';
		try {
			let call;
			if (mode === 'now') {
				const minOut = await heldReturnMinOut(r);
				if (!minOut) throw new Error('No pool prices this return right now. Try again later.');
				call = releaseHeldReturnCall(r.id, { minOut });
			} else {
				const to = (ethTo[r.id] ?? '').trim();
				if (!/^0x[0-9a-fA-F]{40}$/.test(to) || /^0x0{40}$/.test(to)) {
					throw new Error('Enter an Ethereum address.');
				}
				call = releaseHeldReturnCall(r.id, { toEthAddress: to });
			}
			const est = await estimateCallRc({
				callerDid: a.did,
				contractId: call.contract_id,
				action: call.action,
				payload: call.payload
			});
			if (!est.ok) {
				throw new Error(
					est.reason === 'call-fails'
						? `This would fail on chain: ${est.error}`
						: 'Not enough resource credits for this.'
				);
			}
			if (a.provider === 'aioha' && a.username && a.aioha) {
				const { executeTx } = await import('$lib/magiTransactions/hive');
				const res = await executeTx(a.aioha, [
					[
						'custom_json',
						{
							required_auths: [a.username],
							required_posting_auths: [],
							id: 'vsc.call',
							json: JSON.stringify({
								net_id: vscNetworkId,
								caller: a.did,
								contract_id: call.contract_id,
								action: call.action,
								payload: JSON.parse(call.payload),
								rc_limit: est.rcLimit
							})
						}
					]
				]);
				if (!res.success) throw new Error(res.error ?? 'The transaction was not sent.');
			} else {
				const { createClient, signAndBrodcastTransaction } =
					await import('$lib/magiTransactions/eth/client');
				const op = {
					op: 'call' as const,
					payload: { ...call, rc_limit: est.rcLimit, intents: [], caller: a.did }
				};
				const client = createClient(a.did);
				if (a.did.startsWith('did:pkh:bip122:')) {
					const { btcSigner } = await import('$lib/magiTransactions/bitcoin/signer');
					await signAndBrodcastTransaction([op], btcSigner, client, new AbortController().signal);
				} else {
					const { wagmiSigner } = await import('$lib/magiTransactions/eth/wagmi');
					const { wagmiConfig } = await import('$lib/auth/reown');
					if (!wagmiConfig) throw new Error('Connect your wallet first.');
					await signAndBrodcastTransaction(
						[op],
						wagmiSigner,
						client,
						new AbortController().signal,
						wagmiConfig
					);
				}
			}
			status = 'Sent. It arrives once the network processes it.';
			await load();
		} catch (err) {
			status = err instanceof Error ? err.message : String(err);
		} finally {
			busy = null;
		}
	}
</script>

{#if held.length > 0}
	<Card>
		<div class="held">
			<h3>Payouts on their way back to you</h3>
			{#each held as r (r.id)}
				<div class="held-row">
					<p>
						<strong>{shown(r)}</strong>
						from a payout that could not be delivered is on its way back to you as
						{coinOf(r.returnAsset).label} on {where(r)}: the bridge swaps it back, usually within
						minutes. If the price has moved more than 5% since your swap, it waits up to a day for
						the price to come back, then goes at that day's price.
					</p>
					<div class="held-actions">
						<PillButton
							styleType="invert submit"
							disabled={busy !== null}
							onclick={() => release(r, 'now')}>Return it now at today's price</PillButton
						>
						<input
							type="text"
							autocomplete="off"
							spellcheck="false"
							placeholder="0x… Ethereum address"
							bind:value={ethTo[r.id]}
						/>
						<PillButton
							styleType="outline"
							disabled={busy !== null}
							onclick={() => release(r, 'eth')}>Send to this Ethereum address</PillButton
						>
					</div>
				</div>
			{/each}
			{#if status}
				<p class="held-status">{status}</p>
			{/if}
		</div>
	</Card>
{/if}

<style lang="scss">
	.held {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.held-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.held-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.held-actions input {
		flex: 1 1 14rem;
		padding: 0.45rem 0.7rem;
		border-radius: 0.5rem;
		border: 1px solid var(--neutral-off-bg, #444);
		background: transparent;
		color: inherit;
		font-family: monospace;
	}
	.held-status {
		font-size: 0.85rem;
		opacity: 0.85;
	}
</style>
