<script lang="ts">
	let { status }: { status: string } = $props();
</script>

<td class={{ failed: status == 'FAILED', confirmed: status == 'CONFIRMED' }}>
	{status.toLowerCase()}
</td>

<style>
	.failed {
		color: var(--secondary-fg-mid);
	}
	.confirmed {
		color: var(--primary-fg-mid);
	}
</style>
