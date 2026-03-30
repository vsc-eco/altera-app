<script lang="ts">
	import { page } from '$app/state';
	import { PanelLeftCloseIcon, Moon, Sun, LogOut } from '@lucide/svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { paths } from './paths';
	import { themeStore, THEMES, type ThemeValue } from '$lib/theme';
	import { getAuth } from '$lib/auth/store';

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
	let auth = $derived(getAuth()());

	$effect(() => {
		setTimeout(() => {
			preload = false;
		}, 1000);
	});

	let isDark = $derived($themeStore.value === 'dark' || ($themeStore.value === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches));

	function toggleTheme() {
		const next: ThemeValue = isDark ? 'light' : 'dark';
		themeStore.set(THEMES[next]);
	}

	async function handleLogout() {
		if (auth.value?.logout) {
			await auth.value.logout();
		}
	}
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
		id="sidebar-nav"
	>
		<div class="logo-section">
			<a class="logo-link" href="/" tabindex="-1">
				<img src="altera_med.png" alt="Altera" class="logo-icon" />
				<span class="logo-text">Altera</span>
			</a>
			<button
				class="transparent-icon close-btn"
				onclick={() => {
					visible = !visible;
				}}
			>
				<PanelLeftCloseIcon />
			</button>
		</div>

		<div class="nav-items">
			{#each paths as path}
				{@const Icon = path.icon}
				<a href={path.href} class={['nav-button', { current: path.href === page.url.pathname }]}>
					<span class="nav-icon"><Icon size={20} /></span>
					<span class="nav-label">{path.name}</span>
				</a>
			{/each}
		</div>

		<div class="sidebar-footer">
			<button class="footer-btn" onclick={toggleTheme}>
				{#if isDark}
					<span class="nav-icon"><Moon size={20} /></span>
					<span class="nav-label">Dark Theme</span>
				{:else}
					<span class="nav-icon"><Sun size={20} /></span>
					<span class="nav-label">Light Theme</span>
				{/if}
			</button>
			<button class="footer-btn" onclick={handleLogout}>
				<span class="nav-icon"><LogOut size={20} /></span>
				<span class="nav-label">Log out</span>
			</button>
		</div>
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
		position: fixed;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		background-color: var(--dash-sidebar-bg);
		border-right: none;
		height: 100svh;
		width: 200px;
		box-sizing: border-box;
		padding: calc(1.75rem + 1.5vh) 0.5rem 1.25rem 1.5rem;
		z-index: 10;
		transition: transform 0s;
		font-weight: 500;
	}
	.preload {
		transition-duration: 0.0001s !important;
	}
	@media screen and (min-width: 620px) {
		nav {
			z-index: 1;
			position: sticky;
			top: 0;
			flex-shrink: 0;
		}
		.close-btn {
			display: none !important;
		}
	}

	/* Logo */
	.logo-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.5rem;
		margin-bottom: 1.5rem;
	}
	.logo-link {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		text-decoration: none;
		color: var(--dash-text-primary);
		font-size: 1.125rem;
		font-weight: 700;
	}
	.logo-icon {
		height: 26px;
		width: auto;
		filter: invert(var(--is-dark-mode, 1));
	}
	.logo-text {
		letter-spacing: -0.01em;
	}

	/* Nav items */
	.nav-items {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
	}
	.nav-button {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		color: var(--dash-sidebar-text);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		transition: background-color 0.15s, color 0.15s;
	}
	.nav-button:hover {
		background-color: var(--dash-sidebar-hover);
		color: var(--dash-text-primary);
	}
	.nav-button.current,
	.nav-button.current:hover {
		background-color: #6F6AF8;
		color: #FFFFFF;
		font-weight: 600;
		border-radius: 1.25rem;
	}
	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	/* Footer */
	.sidebar-footer {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		border-top: none;
		padding-top: 0.75rem;
		margin-top: 0.75rem;
	}
	.footer-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		color: var(--dash-sidebar-text);
		font-size: 0.9rem;
		font-weight: 500;
		border: none;
		background: none;
		cursor: pointer;
		width: 100%;
		text-align: left;
		font-family: inherit;
		transition: background-color 0.15s, color 0.15s;
	}
	.footer-btn:hover {
		background-color: var(--dash-sidebar-hover);
		color: var(--dash-text-primary);
	}
</style>
