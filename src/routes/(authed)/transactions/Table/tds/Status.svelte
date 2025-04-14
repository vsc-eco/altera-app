<script lang="ts">
	let { status }: { status: string } = $props();
</script>

<td
	class={{
		secondary: status == 'FAILED',
		primary: status == 'CONFIRMED',
		neutral: !['FAILED', 'CONFIRMED'].includes(status)
	}}
>
	<span>{status.toLowerCase()}</span>
</td>

<style>
	span {
		color: var(--fg-accent-shifted);
		background-color: var(--bg-accent);
		padding: 0.25rem 0.5rem;
		border-radius: 1rem;
	}
</style>
