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
	import { X } from '@lucide/svelte';
	import StatusView from './StatusView.svelte';
	import { convert } from '$lib/currency/convert';
	import { Coin, Network } from '$lib/send/sendOptions';
	import StatusBadge from '../StatusBadge.svelte';
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
		status: string;
	};
	let { to, from, did, block_height, memo, amount, tk, t, status, first_seen }: Props = $props();
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
	$effect(() => {
		convert(Number(amount), Coin[tk as keyof typeof Coin], Coin.usd, Network.lightning).then(
			(amount) => {
				inUsd = new Intl.NumberFormat('en-US', {
					style: 'decimal',
					maximumFractionDigits: 2,
					minimumFractionDigits: 2
				})
					.format(amount)
					.replaceAll(',', '');
			}
		);
	});
</script>

<tr {...api.getTriggerProps() as any}>
	<Date {block_height} />
	<ToFrom {otherAccount} {memo} />
	<Amount {fromOrTo} {amount} />
	<Token {fromOrTo} {amount} {tk} />
	<Type {fromOrTo} {t} />
	<Status {status} />
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
				<div class="status">
					<StatusBadge {status} />
				</div>
				<div class="amount">
					{new Intl.NumberFormat().format(Number.parseFloat(amount))}
					{tk.toUpperCase()}
					<span class="approx-usd">
						Approx. ${inUsd} USD
					</span>
				</div>
				<StatusView {memo} {from} {to} {first_seen} />
				{#if memo}
					<div class="memo">
						<h3>Memo</h3>
						<p>{memo}</p>
					</div>
				{/if}
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

	[data-part='content'] > :global(div) {
		border-radius: 0.5rem;
		padding: 1rem;
		width: 20rem;
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

	h3 {
		font-size: var(--text-sm);
		font-weight: 600;
		margin-top: 0;
		position: absolute;
		top: 0.25rem;
		left: 0.25rem;
	}
	.memo {
		background-color: var(--neutral-bg-accent);
		border: 1px solid var(--neutral-bg-mid);
		padding: 0.5rem;
		padding-top: 1.5rem;
		border-radius: 0.5rem;
		position: relative;
		margin-top: 1rem;
	}

	[data-part='positioner'] :global([data-part='close-trigger']) {
		margin-top: 0;
		margin-left: auto;
		margin-right: 0;
		display: flex;
		overflow: hidden;
		/* styles for the close trigger element */
	}
</style>
