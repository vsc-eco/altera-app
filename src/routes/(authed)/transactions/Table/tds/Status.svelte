<script lang="ts">
	import StatusBadge from '../StatusBadge.svelte';

	let { status }: { status: string } = $props();
</script>

<td>
	<StatusBadge {status} />
</td>
