<script lang="ts">
	import Date from '../tds/Date.svelte';
	import ToFrom from '../tds/ToFrom.svelte';
	import Amount from '../tds/Amount.svelte';
	import Token from '../tds/Token.svelte';
	import Type from '../tds/Type.svelte';
	import Status from '../tds/Status.svelte';
	import * as dialog from '@zag-js/dialog';
	import { portal, normalizeProps, useMachine } from '@zag-js/svelte';
	import PillButton from '$lib/PillButton.svelte';
	import { getUniqueId } from '$lib/zag/idgen';
	import Card from '$lib/cards/Card.svelte';
	import { ExternalLink, X } from '@lucide/svelte';
	import StatusView from './StatusView.svelte';
	import { convert } from '$lib/currency/convert';
	import { Coin, Network } from '$lib/send/sendOptions';
	import StatusBadge from '../StatusBadge.svelte';
	import Clipboard from '$lib/zag/Clipboard.svelte';
	import { CoinAmount } from '$lib/currency/CoinAmount';
	type Props = {
		to: string;
		from: string;
		did: string;
		block_height: string;
		memo: string | undefined;
		amount: string;
		first_seen: string;
		tk: string;
		t: string;
		id: string;
		status: string;
		block_id: string;
	};
	let {
		to,
		from,
		did,
		block_height,
		memo,
		amount,
		tk,
		t,
		status,
		first_seen,
		id,
		block_id
	}: Props = $props();
	const [otherAccount, fromOrTo] =
		to == from
			? t.includes('unstake')
				? [from!, 'from']
				: t.includes('stake')
					? [to!, 'to']
					: [to!, 'na']
			: to == did
				? [from!, 'from']
				: [to!, 'to'];
	let service = useMachine(dialog.machine, { id: getUniqueId() });
	const api = $derived(dialog.connect(service, normalizeProps));
	let inUsd = $state('');

	new CoinAmount(Number(amount), Coin[tk as keyof typeof Coin])
		.convertTo(Coin.usd, Network.lightning)
		.then((amount) => {
			inUsd = amount.amountToString();
		});
</script>

<tr
	{...api.getTriggerProps() as any}
	tabindex="0"
	onkeydown={(e) => {
		if (e.key == ' ' || e.key == 'Enter') {
			api.getTriggerProps().onclick!(e as any);
			e.preventDefault();
		}
	}}
>
	<Date {block_height} />
	<ToFrom {otherAccount} {memo} {status} />
	<Amount {fromOrTo} {amount} />
	<Token {fromOrTo} {amount} {tk} />
	<Type {fromOrTo} {t} />
</tr>
{#if api.open}
	<div use:portal {...api.getBackdropProps()}></div>
	<div use:portal {...api.getPositionerProps()}>
		<div {...api.getContentProps()}>
			<Card>
				<PillButton
					{...api.getCloseTriggerProps()}
					onclick={api.getTriggerProps().onclick!}
					styleType="icon-outline"
				>
					<X></X>
				</PillButton>
				<h2 {...api.getTitleProps()}>
					{t
						.replace('_', ' ')
						.replace(
							/\w\S*/g,
							(text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
						)}
				</h2>
				<div class="amount">
					{new Intl.NumberFormat().format(Number.parseFloat(amount))}
					{tk.toUpperCase()}
					<span class="approx-usd">
						Approx. ${inUsd} USD
					</span>
				</div>

				<StatusView {memo} {from} {to} {first_seen} {status} {fromOrTo} {block_height} />
				<div class="sections">
					{#if memo}
						<div class="memo section">
							<h3>Memo</h3>
							<p>{memo}</p>
						</div>
					{/if}
					<div class="tx-id section">
						<h3>Transaction Id</h3>
						<Clipboard value={id} label="" />
					</div>
					<div class="links section">
						<h3>External Links</h3>
						<div class="links">
							<a href={'https://vsc.techcoderx.com/tx/' + id} target="_blank" rel="noreferrer">
								VSC Block Explorer<ExternalLink /></a
							>
							<a
								href={'https://www.hiveblockexplorer.com/tx/' + id}
								target="_blank"
								rel="noreferrer"
							>
								Hive Block Explorer<ExternalLink /></a
							>
						</div>
					</div>
				</div>
			</Card>
		</div>
	</div>
{/if}

<style>
	tr:hover,
	tr[data-state='open'] {
		background-color: var(--neutral-bg-accent);
	}
	[data-part='backdrop'] {
		background-color: rgb(0, 0, 0, 0.2);
		position: fixed;
		top: 0;
		left: 0;
		z-index: 2;
		width: 100%;
		height: 100%;
		/* styles for the backdrop element */
	}
	.status {
		position: absolute;
		top: 2.5rem;
		left: 1rem;
	}
	.amount {
		font-size: var(--text-4xl);
		margin-bottom: 1rem;
	}
	.approx-usd {
		display: block;
		text-wrap: wrap;
		color: var(--neutral-fg-mid);
		font-size: var(--text-sm);
		margin-top: 0.25rem;
	}

	[data-part='content'] {
		border: none;
		z-index: 2;
		outline: none;
	}

	[data-part='positioner'] {
		border-radius: 0.5rem;
		position: fixed;
		padding: 0.5rem;
		width: max(80vw, 25rem);
		box-sizing: border-box;
		max-width: calc(100% - 0.5rem);
		width: max-content;
		left: 50%;
		top: 50%;
		z-index: 10;
		max-height: calc(100svh - var(--top-offset, 0) * 8);
		transform: translate(-50%, -50%);

		/* styles for the positioner element */
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	a :global(svg) {
		width: 16px;
	}

	[data-part='content'] > :global(div) {
		border-radius: 0.5rem;
		padding: 1rem;
		width: max(20rem, max-width);
		max-width: calc(100% - 2rem);

		/* styles for the positioner element */
	}

	[data-part='title'] {
		font-size: var(--text-1xl);
		font-weight: 400;
		margin-bottom: 0.5rem !important;
		margin: 0;
		/* styles for the title element */
	}

	.section h3 {
		font-size: var(--text-sm);
		font-weight: 600;
		margin-top: 0;
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
	}
	.memo p {
		min-height: 3rem;
		display: flex;
		padding-top: 0.5rem;
	}
	.misc.section {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.section {
		border: 1px solid var(--neutral-bg-accent-shifted);
		padding: 0.5rem;
		padding-top: 1.75rem;
		border-radius: 0.5rem;
		position: relative;
		flex-grow: 1;
		flex-basis: 30%;
		width: max-content;
	}
	.sections {
		display: flex;
		gap: 1rem;
		align-items: stretch;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	[data-part='positioner'] :global([data-part='close-trigger']) {
		margin-top: 0;
		margin-left: auto;
		margin-right: 0;
		display: flex;
		overflow: hidden;
		position: absolute;
		top: 1rem;
		right: 1rem;
		/* styles for the close trigger element */
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
