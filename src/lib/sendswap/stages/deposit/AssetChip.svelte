<!--
	Asset chip for the deposit timeline's "I want to receive" RadioGroup.

	Replaces the per-asset snippets (hiveChip / hbdChip / …) that were forced by
	RadioGroup's self-referential Item generic — now a single component passed via
	the items' `component` field, parameterised by `props`.
-->
<script lang="ts">
	let { icon, label }: { icon: string; label: string } = $props();
</script>

<span class="asset-chip">
	<img src={icon} alt="" width="18" height="18" />
	<span>{label}</span>
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
</style>
