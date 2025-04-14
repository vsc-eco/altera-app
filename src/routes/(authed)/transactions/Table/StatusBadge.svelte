<script lang="ts">
	let { status }: { status: string } = $props();
</script>

<span
	class={{
		secondary: status == 'FAILED',
		primary: status == 'CONFIRMED',
		neutral: !['FAILED', 'CONFIRMED'].includes(status)
	}}>{status.toLowerCase()}</span
>

<style>
	span {
		color: var(--off-fg);
		border: 1px solid var(--bg-mid);
		background-color: var(--bg-accent);
		padding: 0.25rem 0.5rem;
		border-radius: 1rem;
	}
</style>
