<script lang="ts">
	import '../styles/reset.css';
	import '../styles/colors.scss';
	import '../styles/base.scss';
	let { children } = $props();
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
	import Sidebar from '$lib/Sidebar.svelte';
	import Topbar from '$lib/Topbar.svelte';
</script>

<div class="flex">
	<Sidebar></Sidebar>
	<div class="main">
		<Topbar></Topbar>
		<main>
			{@render children()}
		</main>
	</div>
</div>

<style>
	.flex {
		display: flex;
		min-height: 100%;
	}
	.main {
		padding: 0.5rem;
		flex: 1;
		flex-basis: 0;
	}
</style>
