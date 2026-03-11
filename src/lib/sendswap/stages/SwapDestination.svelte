<script lang="ts">
	import { getAuth } from '$lib/auth/store';
	import { Coin, Network } from '$lib/sendswap/utils/sendOptions';
	import { SendTxDetails } from '$lib/sendswap/utils/sendUtils';
	import { Send, Wallet, X } from '@lucide/svelte';
	import WaveLoading from '$lib/components/WaveLoading.svelte';
	import PillButton from '$lib/PillButton.svelte';
	import CoinNetworkIcon from '$lib/currency/CoinNetworkIcon.svelte';
	import { getHiveAssetName, getHbdAssetName, vscNetworkId } from '../../../client';
	import { browser } from '$app/environment';

	const DEST_NETWORK_KEY = 'swap-dest-network';

	const auth = $derived(getAuth()());
	let {
		editStage,
		isActive = true,
		status,
		waiting = false,
		abort = () => {}
	}: {
		editStage: (complete: boolean) => void;
		isActive?: boolean;
		status: { message: string; isError: boolean };
		waiting?: boolean;
		abort?: () => void;
	} = $props();

	let toCoin = $derived($SendTxDetails.toCoin?.coin ?? Coin.unk);

	function coinDisplayLabel(coin: (typeof Coin)[keyof typeof Coin]): string {
		return coin.value === Coin.hive.value
			? getHiveAssetName()
			: coin.value === Coin.hbd.value
				? getHbdAssetName()
				: coin.label;
	}

	const isMainnet = vscNetworkId === 'vsc-mainnet';
	const chainLabel = isMainnet ? 'Mainnet' : 'Testnet';

	let destChoice: 'wallet' | 'address' = $state('wallet');
	let destAddress = $state('');

	// Read preferred network from localStorage; default to 'mainnet' if not set
	function getStoredNetwork(): string {
		if (!browser) return 'mainnet';
		return localStorage.getItem(DEST_NETWORK_KEY) || 'mainnet';
	}
	let destNetworkChoice: string = $state(getStoredNetwork());

	// Persist network choice to localStorage when changed
	$effect(() => {
		if (browser) {
			localStorage.setItem(DEST_NETWORK_KEY, destNetworkChoice);
		}
	});

	// Enable the "Swap" button when destination is valid
	$effect(() => {
		if (!isActive) return;
		if (destChoice === 'wallet') {
			editStage(true);
		} else {
			editStage(!!destAddress.trim());
		}
	});

	// Update toNetwork based on destination choice
	$effect(() => {
		if (destChoice === 'wallet') {
			if ($SendTxDetails.toNetwork?.value !== Network.magi.value) {
				$SendTxDetails.toNetwork = Network.magi;
			}
		} else {
			const net =
				destNetworkChoice === 'magi'
					? Network.magi
					: $SendTxDetails.toCoin?.networks?.find(
							(n: Network) => n.value !== Network.magi.value
						) ?? Network.hiveMainnet;
			if ($SendTxDetails.toNetwork?.value !== net.value) {
				$SendTxDetails.toNetwork = net;
			}
		}
	});

	// Update toUsername when sending to address
	$effect(() => {
		if (destChoice === 'address' && destAddress.trim()) {
			$SendTxDetails.toUsername = destAddress.trim();
		}
	});
</script>

<div class="swap-dest-wrapper">
	{#if $SendTxDetails.toCoin}
		<div class="dest-header">
			<CoinNetworkIcon coin={toCoin} network={$SendTxDetails.toNetwork ?? Network.magi} size={32} />
			<h3>Where should {coinDisplayLabel(toCoin)} go?</h3>
		</div>
	{/if}

	<div class="dest-options">
		<button
			class="dest-card"
			class:selected={destChoice === 'wallet'}
			onclick={() => { destChoice = 'wallet'; }}
		>
			<div class="dest-card-icon"><Wallet size={20} /></div>
			<div class="dest-card-info">
				<span class="dest-card-name">Keep in my wallet</span>
				<span class="dest-card-desc sm-caption">{coinDisplayLabel(toCoin)} stays in your Magi wallet</span>
			</div>
			<div class="dest-radio" class:checked={destChoice === 'wallet'}></div>
		</button>
		<button
			class="dest-card"
			class:selected={destChoice === 'address'}
			onclick={() => { destChoice = 'address'; }}
		>
			<div class="dest-card-icon"><Send size={20} /></div>
			<div class="dest-card-info">
				<span class="dest-card-name">Send to an address</span>
				<span class="dest-card-desc sm-caption">Hive, BTC, EVM or DASH wallet</span>
			</div>
			<div class="dest-radio" class:checked={destChoice === 'address'}></div>
		</button>
	</div>

	<!-- Always rendered to keep fixed height; hidden when wallet is selected -->
	<div class="dest-address-section" class:hidden={destChoice !== 'address'}>
		<textarea
			bind:value={destAddress}
			placeholder="Paste Hive, BTC, EVM or DASH address..."
			rows="2"
			disabled={destChoice !== 'address'}
		></textarea>
		<div class="dest-network-row">
			<span class="dest-network-label">Network</span>
			<div class="dest-network-toggle">
				<button class:active={destNetworkChoice === 'magi'} onclick={() => { destNetworkChoice = 'magi'; }}>Magi Network</button>
				<button class:active={destNetworkChoice === 'mainnet'} onclick={() => { destNetworkChoice = 'mainnet'; }}>{chainLabel}</button>
			</div>
		</div>
		<p class="dest-hint sm-caption">
			{coinDisplayLabel(toCoin)} arrives on {destNetworkChoice === 'magi' ? 'Magi' : chainLabel} &mdash; accepts Hive, BTC, EVM or DASH addresses
		</p>
	</div>
</div>

{#if status.message}
	<div class="status-wrapper">
		<span class="sm-caption">Status</span>
		<p class={{ status: !status.isError, error: status.isError }}>{status.message}</p>
	</div>
{/if}
{#if waiting}
	<div class="waiting-overlay">
		<div class="waiting-card">
			<WaveLoading size={32} />
			<div class="info">
				<p>Waiting for signature</p>
				<span>
					<PillButton onclick={() => abort()} theme="secondary" styleType="invert">
						<X /> Cancel
					</PillButton>
				</span>
				{#if auth.value?.provider === 'aioha'}
					<p class="warning">
						<b class="error">Warning:</b> Transaction may still occur if it is authorized later via your
						hive wallet.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.swap-dest-wrapper {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		padding: 1.5rem;
		max-width: 42rem;
		box-sizing: border-box;
	}
	.dest-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		h3 {
			margin: 0;
			font-size: var(--text-3xl);
			font-weight: 600;
			color: var(--neutral-fg);
		}
	}

	/* ── Destination Options ── */
	.dest-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.dest-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--swap-card-border);
		border-radius: 0.75rem;
		background-color: var(--swap-section-bg);
		cursor: pointer;
		color: var(--neutral-fg);
		font: inherit;
		text-align: left;
		transition: border-color 0.15s ease;
		&.selected {
			border-color: var(--primary);
		}
		&:hover:not(.selected) {
			border-color: var(--neutral-bg-accent-shifted);
		}
		.dest-card-icon {
			width: 2.25rem;
			height: 2.25rem;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 0.5rem;
			background-color: var(--swap-toggle-bg);
			flex-shrink: 0;
			color: var(--neutral-fg-mid);
		}
		.dest-card-info {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}
		.dest-card-name {
			font-weight: 500;
		}
	}
	.dest-radio {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid var(--neutral-bg-accent-shifted);
		border-radius: 50%;
		flex-shrink: 0;
		position: relative;
		transition: border-color 0.15s ease;
		&.checked {
			border-color: var(--neutral-bg-accent-shifted);
			&::after {
				content: '';
				position: absolute;
				top: 3px;
				left: 3px;
				width: calc(100% - 6px);
				height: calc(100% - 6px);
				border-radius: 50%;
				background-color: var(--primary-bg);
			}
		}
	}

	/* ── Address Section (always rendered, hidden via visibility to keep fixed layout) ── */
	.dest-address-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: opacity 0.15s ease;
		&.hidden {
			opacity: 0;
			pointer-events: none;
			max-height: 0;
			overflow: hidden;
			margin: 0;
			gap: 0;
		}
		textarea {
			width: 100%;
			box-sizing: border-box;
			padding: 0.75rem;
			border: 1px solid var(--swap-input-border);
			border-radius: 0.5rem;
			background-color: var(--swap-section-bg);
			color: var(--neutral-fg);
			font: inherit;
			font-size: var(--text-sm);
			resize: none;
			&::placeholder {
				color: var(--neutral-fg-mid);
			}
		}
	}
	.dest-network-row {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.dest-network-label {
		font-size: var(--text-sm);
		color: var(--neutral-fg-mid);
	}
	.dest-network-toggle {
		display: flex;
		gap: 0;
		border: 1px solid var(--swap-input-border);
		border-radius: 0.5rem;
		overflow: hidden;
		button {
			flex: 1;
			padding: 0.5rem 0.75rem;
			border: none;
			background: transparent;
			color: var(--neutral-fg-mid);
			font: inherit;
			font-size: var(--text-sm);
			cursor: pointer;
			transition: background-color 0.15s ease, color 0.15s ease;
			&.active {
				background-color: var(--primary-bg);
				color: var(--primary-fg);
			}
			&:not(.active):hover {
				background-color: var(--swap-toggle-bg);
			}
		}
	}
	.dest-hint {
		margin: 0;
	}

	/* ── Status & Waiting ── */
	.status-wrapper {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.waiting-overlay {
		position: fixed;
		width: 100vw;
		height: 100vh;
		top: 50%;
		left: 50%;
		transform: translate(-50dvw, -50dvh);
		display: flex;
		justify-content: center;
		background-color: rgba(58, 46, 57, 0.2);
		backdrop-filter: blur(4px);
		pointer-events: none;
		z-index: 1;
		.waiting-card {
			margin-top: 25%;
			font-weight: 500;
			padding: 1rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			pointer-events: all;
			background-color: var(--neutral-bg);
			border: 1px solid var(--neutral-bg-accent);
			border-radius: 0.5rem;
			height: min-content;
			.info {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				.warning {
					max-width: 20rem;
					text-align: center;
				}
			}
		}
	}

	/* ── Responsive ── */
	@media screen and (max-width: 36rem) {
		.dest-header {
			h3 {
				font-size: var(--text-2xl);
			}
		}
		.dest-card {
			padding: 0.75rem;
			gap: 0.5rem;
		}
		.dest-network-toggle button {
			padding: 0.375rem 0.5rem;
			font-size: var(--text-xs);
		}
		.waiting-overlay .waiting-card {
			margin-top: 15%;
			margin-left: 1rem;
			margin-right: 1rem;
		}
	}
</style>
