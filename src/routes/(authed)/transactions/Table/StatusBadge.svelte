<script lang="ts">
	let { status: rawStatus }: { status: string } = $props();
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
		neutral: !['failed', 'confirmed'].includes(status)
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
</style>
