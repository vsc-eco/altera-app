<script>
	import { page } from '$app/state';
	import { PanelLeftCloseIcon } from '@lucide/svelte';
	import { beforeNavigate } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { paths } from './paths';

	beforeNavigate(() => {
		if (visible) {
			visible = false;
		}
	});
	let navWidth = $state(100);
	let bodyWidth = $state(0);
	let { visible = $bindable(false) } = $props();
	let actuallyVisible = $derived(visible || bodyWidth >= 620);
	let preload = $state(true);
	$effect(() => {
		setTimeout(() => {
			preload = false;
		}, 1000);
	});
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
		<div class="logo-close">
			<a class="logo-name" href="/" tabindex="-1">
				<img src="altera_med.png" alt="VSC" />
				<span class="vertical-line"></span>
				Altera
			</a>
			<button
				class="transparent-icon"
				onclick={() => {
					visible = !visible;
				}}
			>
				<PanelLeftCloseIcon></PanelLeftCloseIcon>
			</button>
		</div>

		{#each paths as path}
			{@const Icon = path.icon}
			<a href={path.href} class={['nav-button', { current: path.href == page.url.pathname }]}>
				<Icon></Icon>
				{path.name}
			</a>
		{/each}
	</nav>
{/if}

<style lang="scss">
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
		height: 100svh;
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
	@media screen and (min-width: 620px) {
		nav {
			z-index: 0;
			display: flex;
			position: sticky;
			top: 0;
		}
		button.transparent-icon {
			display: none;
		}
	}
	button.transparent-icon {
		margin-left: auto;
	}
	.nav-button {
		text-wrap: nowrap;
		display: flex;
		height: 2.5rem;
		box-sizing: border-box;
		align-items: center;
		margin: 0.25rem;
		padding: 1rem;
		box-sizing: border-box;
		border-radius: 0.25rem;
		color: var(--neutral-fg);
		text-decoration: none;
		transition: transform 0.05s;
	}

	.nav-button.current,
	.nav-button.current:hover {
		background-color: var(--neutral-bg-accent);
		color: var(--primary-fg-accent-shifted);
	}
	.nav-button:hover {
		background-color: var(--neutral-bg-accent);
		color: var(--primary-fg-accent);
	}

	.nav-button:active {
		background-color: var(--neutral-bg-accent);
		color: var(--primary-fg-accent-shifted);
		transform: scale(0.99);
	}

	.nav-button :global(.lucide-icon) {
		margin-right: 0.5rem;
	}
	.logo-close {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		.logo-name {
			display: flex;
			align-items: center;
			gap: 1rem;
		}
		.vertical-line {
			height: 2rem;
			width: 1px;
			position: relative;
			background-color: var(--neutral-bg-mid);
		}
		img {
			height: 2.5rem;
			filter: invert(var(--is-dark-mode));
		}
		a {
			text-decoration: none;
			color: var(--fg);
		}
	}
</style>
