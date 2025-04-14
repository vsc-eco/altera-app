<script lang="ts">
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';
	import { ArrowDown, EllipsisVertical } from '@lucide/svelte';
	import moment from 'moment';
	import Status from '../tds/Status.svelte';
	type Props = {
		from: string;
		to: string;
		memo: string | undefined;
		first_seen: string;
		status: string;
		fromOrTo: string;
		block_height: string;
	};
	let { from, to, first_seen, status, block_height }: Props = $props();
	// TODO: support additional status once we have the graphQL endpoint to query
</script>

<div>
	<div class="transfer">
		<span class="from-icon"> </span>
		<div class="from">
			From
			{getAccountNameFromDid(from)}
		</div>
		<div class="from-ts ts">{moment(first_seen).format('MMM DD [at] h:mmA')}</div>
		<div class="vertical-line"></div>

		<span
			class={[
				'to-icon',
				status.toLowerCase(),
				{
					secondary: status == 'FAILED',
					primary: status == 'CONFIRMED',
					neutral: !['FAILED', 'CONFIRMED'].includes(status)
				}
			]}
		>
		</span>
		<span class="to">
			To
			{getAccountNameFromDid(to)}
		</span>
		{#if status != 'CONFIRMED'}
			<div
				class={[
					'status',
					{
						secondary: status == 'FAILED',
						primary: status == 'CONFIRMED',
						neutral: !['FAILED', 'CONFIRMED'].includes(status)
					}
				]}
			>
				{status.toLowerCase()}
			</div>
		{/if}
		<div class="to-ts ts">{moment(first_seen).format('MMM DD [at] h:mmA')} (#{block_height})</div>
	</div>
</div>

<style>
	.vertical-line {
		grid-area: v-line;
		justify-self: center;
		height: 2rem;
		width: 2px;
		position: relative;
		top: -0.25rem;
		left: -0.5px;
		background-color: var(--neutral-bg-mid);
	}
	.vertical-line::after {
		content: '';
		grid-area: v-line;
		justify-self: center;
		height: 2rem;
		width: 2px;
		position: absolute;
		bottom: -0.5rem;
		background-color: var(--neutral-bg-mid);
	}
	.transfer .from {
		grid-area: from;
		display: flex;
		align-items: center;
	}
	.transfer .to {
		grid-area: to;
		display: flex;
		align-items: center;
	}
	.from-icon {
		grid-area: from-icon;
		height: 100%;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 0.5rem;
		background-color: var(--neutral-bg-mid);
	}
	.to-icon {
		grid-area: to-icon;
		display: block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 0.5rem;
		background-color: var(--bg-mid);
		position: relative;
	}
	.to-icon.secondary::after {
		display: none;
	}
	.to-icon::after {
		border: calc(0.5rem / 2) solid transparent;
		border-top: 7px solid;
		border-top-left-radius: 3px;
		border-top-right-radius: 3px;
		content: '';
		height: 0;
		left: 0;
		color: var(--bg-mid);
		position: absolute;
		top: calc(0.5rem / 2 + 1px);
		width: 0;
	}
	.from-ts {
		grid-area: from-ts;
	}
	.to-ts {
		grid-area: to-ts;
	}
	.status {
		grid-area: status;
		color: var(--fg-accent-shifted);
	}
	.ts {
		font-size: var(--text-sm);
		color: var(--neutral-fg-mid);
	}
	.transfer {
		margin-top: 0.5rem;
		display: grid;
		max-width: max-content;
		grid-template-areas:
			'from-icon	from'
			'v-line		from-ts'
			'v-line		.'
			'to-icon	to'
			'.			status'
			'.			to-ts';
		align-items: center;
		gap: 0.25rem;
	}
</style>
