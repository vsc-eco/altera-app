<!--
	Asset chip for the deposit timeline's "Asset to deposit" RadioGroup.

	Replaces the per-asset snippets (hiveChip / hbdChip / …) that were forced by
	RadioGroup's self-referential Item generic — now a single component passed via
	the items' `component` field, parameterised by `props`.
-->
<script lang="ts">
	/** `note` labels a chip that cannot be chosen. ETH sat greyed out with
	 *  nothing saying why, which reads as broken rather than unfinished. */
	let { icon, label, note }: { icon: string; label: string; note?: string } = $props();
</script>

<span class="asset-chip" title={note ? `${label}: ${note}` : undefined}>
	<img src={icon} alt="" width="18" height="18" />
	<span>{label}</span>
	{#if note}<span class="asset-chip-note">{note}</span>{/if}
</span>

<style>
	.asset-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.95rem;
		line-height: 1;
	}
	.asset-chip img {
		display: block;
	}
	.asset-chip-note {
		font-weight: 500;
		font-size: 0.75rem;
		opacity: 0.75;
		white-space: nowrap;
	}
</style>
