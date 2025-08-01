<script lang="ts">
	import { getTimestamp, type TransactionInter, type TransactionOpType } from "$lib/stores/txStores";
	import moment from "moment";
	import type { Snippet } from "svelte";
	import Type from "../tds/Type.svelte";
	import { ExternalLink } from "@lucide/svelte";
	import Clipboard from "$lib/zag/Clipboard.svelte";

    type Props = {
		tx: TransactionInter;
		op: TransactionOpType;
		onRowClick: (op: [string, number], content: Snippet) => void;
	};
    let { tx, op, onRowClick }: Props = $props();

    function handleTrigger() {
		onRowClick([tx.id, op.index], contractRowContent);
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			handleTrigger();
			e.preventDefault();
		}
	}
</script>


<tr
	data-tx-id={tx.id}
	tabindex="0"
	onclick={handleTrigger}
	onkeydown={handleKeydown}
	class="clickable-row"
>
	<td class="date">{moment(getTimestamp(tx)).format('MMM DD')}</td>
	<td class="filler"></td>
	<td></td>
	<td></td>
	<Type direction="swap" t={op.type!} />
</tr>

{#snippet contractRowContent()}
	<h2>
		{(op.type ?? tx.type)
			.replace('_', ' ')
			.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase())}
	</h2>
	<div class="sections">
		<div class="tx-id section">
			<h3>Transaction Id</h3>
			<Clipboard value={tx.id} label="" disabled={tx.isPending && tx.id == 'UNK'} />
		</div>
		<div class="links section">
			<h3>External Links</h3>
			<div class={`links ${tx.isPending ? 'links-disabled' : ''}`}>
				<a href={'https://vsc.techcoderx.com/tx/' + tx.id} target="_blank" rel="noreferrer">
					VSC Block Explorer<ExternalLink /></a
				>
			</div>
		</div>
	</div>
{/snippet}

<style>
    tr:hover,
	tr {
		cursor: pointer;
		transition: background-color 1s;
		animation: highlight-in 1s both;
	}
    .filler {
        height: 4.5rem;
    }
    .date {
		vertical-align: middle;
		padding: 1rem min(1rem, 2%);
		width: max-content;
		border-bottom: 1px solid var(--neutral-bg-accent);
		min-width: 4rem;
	}
    a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
    a :global(svg) {
		width: 16px;
	}
    h3 {
		font-size: var(--text-sm);
		font-weight: 600;
		margin-top: 0;
	}
    .section {
		padding: 0.5rem;
		border-radius: 0.5rem;
		position: relative;
		flex-shrink: 0;
		flex-basis: auto;
		/* width: max-content; */
	}
	.sections {
		display: flex;
		flex-direction: column;
		/* align-items: stretch; */
		flex: 1;
		gap: 0.5rem;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.links.section {
		display: inline;
	}

	.tx-id.section {
		margin-top: 2rem;
	}
</style>