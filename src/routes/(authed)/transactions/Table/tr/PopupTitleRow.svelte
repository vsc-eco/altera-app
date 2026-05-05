<script lang="ts">
	import StatusBadge from '../StatusBadge.svelte';

	type Props = { title: string; status: string };
	let { title, status }: Props = $props();
</script>

<div class="popup-title-row">
	<h2>{title}</h2>
	<StatusBadge {status} compact />
</div>

<style>
	.popup-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	h2 {
		margin: 0;
	}
</style>
