<!--
	Test fixture: the clickable table row StatusBadge lives inside.

	Mirrors Tr.svelte — a `<tr>` whose own onclick/onkeydown open the
	transaction detail panel — so a test can prove that operating the failed
	badge does not also trigger the row. Svelte delegates click and keydown, so
	only a real Svelte-handled ancestor reproduces that interaction.
-->
<script lang="ts">
	import StatusBadge from '../StatusBadge.svelte';
	import type { ComponentProps } from 'svelte';

	type Props = {
		onRowActivate: () => void;
		badge: ComponentProps<typeof StatusBadge>;
	};
	let { onRowActivate, badge }: Props = $props();
</script>

<table>
	<tbody>
		<tr tabindex="0" onclick={onRowActivate} onkeydown={onRowActivate}>
			<td>
				<StatusBadge {...badge} />
			</td>
			<td><span data-testid="elsewhere-in-row">elsewhere</span></td>
		</tr>
	</tbody>
</table>
