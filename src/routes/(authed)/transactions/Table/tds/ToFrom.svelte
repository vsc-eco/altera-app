<script lang="ts">
	import { getAccountNameFromDid } from '$lib/getAccountName';
	import Avatar from '$lib/zag/Avatar.svelte';

	let { otherAccount }: { otherAccount: string } = $props();
</script>

<td>
	<span class="to-from">
		<Avatar did={otherAccount} fallback=""></Avatar>
		<span>
			{getAccountNameFromDid(otherAccount)}
		</span>
	</span>
</td>

<style>
	.to-from {
		width: 100%;

		display: inline-flex;
		justify-content: left;
		gap: 0.25rem;
		align-items: center;
	}
	.to-from > span {
		text-overflow: ellipsis;
		overflow-x: hidden;
		height: 1.2rem;
		white-space: nowrap;
	}
</style>
