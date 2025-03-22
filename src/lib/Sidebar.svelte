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
	let navWidth = $state(100);
	let bodyWidth = $state(0);
	let { visible = $bindable(false) } = $props();
	let actuallyVisible = $derived(visible || bodyWidth >= 560);
	let preload = $state(true);
	$effect(() => {
		setTimeout(() => {
			preload = false;
		}, 1000);
	});
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
	<div
		onclick={(e) => {
			if (!visible) return;
			if (e.currentTarget == e.target) {
				visible = false;
			}
		}}
		aria-hidden="true"
		class={['popover', { hidden: !visible }]}
	></div>
	<nav
		bind:clientWidth={navWidth}
		transition:fly={{ x: -navWidth, opacity: 1, duration: preload ? 0 : undefined }}
		class={{ visible, preload }}
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
	.popover {
		position: fixed;
		z-index: 9;
		width: 100%;
		height: 100%;
	}
	.popover.hidden {
		display: none;
	}
	nav {
		display: none;
		position: fixed;
		top: 0px;
		font-weight: 400;
		display: flex;
		flex-direction: column;
		background-color: var(--neutral-off-bg);
		border-right: 1px solid var(--neutral-bg-accent);
		min-height: 100vh;
		box-sizing: border-box;
		padding: 0.5rem;
		z-index: 10;
		transition: transform 0s;
		display: flex;
		left: 0;
		/* animation: 1s 0.5s fade-in both; */
	}
	.preload {
		transition-duration: 0.0001s !important;
	}
	@media screen and (min-width: 560px) {
		nav {
			display: flex;
			position: sticky;
			top: 0;
		}
		button.transparent-icon {
			display: none;
		}
	}
	button.transparent-icon {
		align-self: flex-end;
	}
	a {
		display: flex;
		height: 2.5rem;
		box-sizing: border-box;
		align-items: center;
		margin: 0.25rem;
		padding: 0.25rem;
		box-sizing: border-box;
		border-radius: 0.25rem;
		color: var(--neutral-fg);
		text-decoration: none;
		transition: transform 0.05s;
	}

	a.current,
	a.current:hover {
		background-color: var(--neutral-bg-accent);
		color: var(--primary-fg-accent-shifted);
	}
	a:hover {
		background-color: var(--neutral-bg-accent);
		color: var(--primary-fg-accent);
	}

	a:active {
		background-color: var(--neutral-bg-accent);
		color: var(--primary-fg-accent-shifted);
		transform: scale(0.99);
	}

	a :global(.lucide-icon) {
		margin-right: 0.5rem;
	}
</style>
