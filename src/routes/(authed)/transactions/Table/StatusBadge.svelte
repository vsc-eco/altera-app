<script lang="ts">
	let { status: rawStatus, compact = false }: { status: string; compact?: boolean } = $props();
	const status = $derived.by(() => {
		if (rawStatus == 'INCLUDED') {
			return 'unconfirmed';
		}
		return rawStatus.toLowerCase();
	});
</script>

<span
	class={{
		secondary: status == 'failed',
		primary: status == 'confirmed',
		neutral: !['failed', 'confirmed'].includes(status),
		compact
	}}>{status}</span
>

<style>
	span {
		color: var(--fg-accent);
		border: 1px solid var(--fg-accent);
		padding: 0.25rem 0.5rem;
		border-radius: 0.5rem;
		width: max-content;
		display: inline-flex;
		height: 1.25rem;
		align-items: center;
	}
	span.compact {
		font-size: 0.7rem;
		padding: 0.1rem 0.35rem;
		height: auto;
		border-radius: 0.35rem;
	}
</style>
