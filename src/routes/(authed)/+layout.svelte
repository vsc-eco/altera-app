<script lang="ts">
	let { children } = $props();
	import Sidebar from '$lib/Sidebar.svelte';
	import Topbar from '$lib/Topbar.svelte';
	let showSidebar = $state(false);
</script>

<div class={['flex', { showSidebar }]}>
	<Sidebar bind:visible={showSidebar}></Sidebar>
	<div class="main">
		<Topbar
			onMenuToggle={() => {
				showSidebar = !showSidebar;
			}}
		></Topbar>
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
	@media screen and (max-width: 560px) {
		.main {
			opacity: 1;
			transition: opacity 0.2s;
		}
		.showSidebar .main {
			pointer-events: none;
			opacity: 0.2;
		}
	}
	.main {
		padding: 0rem 0.5rem;
		flex: 1;
		max-width: 800px;
		margin-left: auto;
		margin-right: auto;
		flex-shrink: 1;
		width: 100%;
		box-sizing: border-box;
		flex-basis: 0;
	}
</style>
