<script lang="ts">
    import { type Snippet } from "svelte";
    import { type HTMLAttributes } from "svelte/elements";
     let {
        children,
        ...restProps
    } : {
        children: Snippet;
    } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div>
    {@render children()}
</div>

<style>
    div {
		position: absolute;
		top: 0;
		left: 0;
		width: calc(100vw - 1rem);
		height: 100vh;
		background-color: var(--neutral-bg);
		z-index: 500;
		padding: 0 0.5rem;
	}
</style>