<script>
	import { ScrollText, ArrowRightLeft, Home } from '@lucide/svelte';
	import { page } from '$app/state';
	import { PanelLeftCloseIcon } from '@lucide/svelte';
	import { beforeNavigate } from '$app/navigation';
	import { fly } from 'svelte/transition';
	beforeNavigate(() => {
		if (visible) {
			visible = false;
		}
	});
	let navWidth = $state(0);
	let bodyWidth = $state(1000);
	let { visible = $bindable(false) } = $props();
	let actuallyVisible = $derived(visible || bodyWidth >= 560);
	const paths = [
		{
			name: 'Home',
			icon: Home,
			href: '/'
		},
		{
			name: 'Transactions',
			icon: ScrollText,
			href: '/transactions'
		},
		{
			name: 'Swap',
			icon: ArrowRightLeft,
			href: '/swap'
		}
	];
</script>

<svelte:body bind:clientWidth={bodyWidth} />

{#if actuallyVisible}
	<nav
		bind:clientWidth={navWidth}
		transition:fly={{ x: -navWidth, opacity: 1 }}
		class={{ visible }}
	>
		<button
			class="transparent-icon"
			onclick={() => {
				visible = !visible;
			}}
		>
			<PanelLeftCloseIcon></PanelLeftCloseIcon>
		</button>
		{#each paths as path}
			{@const Icon = path.icon}
			<a href={path.href} class={{ current: path.href == page.url.pathname }}>
				<Icon></Icon>
				{path.name}
			</a>
		{/each}
	</nav>
{/if}

<style>
	nav {
		position: fixed;
		top: 0px;
		font-weight: 400;
		display: flex;
		flex-direction: column;
		background-color: var(--neutral-off-bg);
		border-right: 1px solid var(--neutral-bg-accent);
		min-height: 100%;
		padding: 0.5rem;
		z-index: 10;
		transition: transform 0.2s;
	}
	nav.visible {
		display: flex;
		left: 0;
	}
	@media screen and (min-width: 560px) {
		nav {
			display: flex;
			position: unset;
		}
	}
	button.transparent-icon {
		align-self: flex-end;
	}
	a {
		display: flex;
		height: 32px;
		align-items: center;
		margin: 0.25rem;
		padding: 0.25rem;
		box-sizing: border-box;
		border-radius: 0.25rem;
		color: var(--neutral-fg);
		text-decoration: none;
	}
	a:hover,
	a.current {
		background-color: var(--neutral-bg-accent);
	}
	a :global(.lucide-icon) {
		margin-right: 0.5rem;
	}
</style>
