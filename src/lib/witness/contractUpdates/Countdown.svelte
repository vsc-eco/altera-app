<!--
	Live countdown to a future Unix-seconds timestamp.

	Updates once per second while mounted. Cleanly disposes the interval
	via $effect's return value. Renders nothing when the target is in
	the past (parent decides what to show in that case — see
	ContractUpdatesSection's status badge).
-->
<script lang="ts">
	let { targetUnixSec, compact = false }: { targetUnixSec: number; compact?: boolean } = $props();

	let now = $state(Math.floor(Date.now() / 1000));

	$effect(() => {
		const handle = setInterval(() => {
			now = Math.floor(Date.now() / 1000);
		}, 1000);
		return () => clearInterval(handle);
	});

	const secondsRemaining = $derived(Math.max(0, targetUnixSec - now));
	const expired = $derived(secondsRemaining === 0);

	const days = $derived(Math.floor(secondsRemaining / 86400));
	const hours = $derived(Math.floor((secondsRemaining % 86400) / 3600));
	const mins = $derived(Math.floor((secondsRemaining % 3600) / 60));
	const secs = $derived(secondsRemaining % 60);
</script>

{#if expired}
	<span class="countdown expired">unlocked</span>
{:else if compact}
	<span class="countdown">
		{#if days > 0}{days}d
		{/if}{hours}h {mins}m
	</span>
{:else}
	<span class="countdown">
		{#if days > 0}<span class="seg">{days}<small>d</small></span>{/if}
		<span class="seg">{hours.toString().padStart(2, '0')}<small>h</small></span>
		<span class="seg">{mins.toString().padStart(2, '0')}<small>m</small></span>
		<span class="seg">{secs.toString().padStart(2, '0')}<small>s</small></span>
	</span>
{/if}

<style lang="scss">
	.countdown {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--dash-text-primary);
		display: inline-flex;
		gap: 0.25rem;
		align-items: baseline;
	}
	.countdown.expired {
		color: #8be08b;
		text-transform: uppercase;
		font-size: 0.78rem;
		letter-spacing: 0.06em;
	}
	.seg small {
		font-size: 0.7em;
		font-weight: 500;
		color: var(--dash-text-secondary);
		margin-left: 0.05rem;
	}
</style>
