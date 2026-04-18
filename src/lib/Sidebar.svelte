<script lang="ts">
	import { page } from '$app/state';
	import { PanelLeftCloseIcon, PanelLeftOpenIcon, LogOut } from '@lucide/svelte';
	import { beforeNavigate } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { paths } from './paths';
	import { getAuth } from '$lib/auth/store';
	import { browser } from '$app/environment';

	const COLLAPSE_KEY = 'sidebar-collapsed';

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

	let collapsed = $state(
		browser ? localStorage.getItem(COLLAPSE_KEY) === 'true' : false
	);

	function toggleCollapse() {
		collapsed = !collapsed;
		if (browser) localStorage.setItem(COLLAPSE_KEY, String(collapsed));
	}

	$effect(() => {
		setTimeout(() => {
			preload = false;
		}, 1000);
	});

	async function handleLogout() {
		if (auth.value?.logout) {
			await auth.value.logout();
		}
	}

	function isCurrentPath(href: string): boolean {
		const url = page.url;
		if (href.includes('?')) {
			return url.pathname + url.search === href;
		}
		return url.pathname === href && !url.searchParams.has('tab');
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
		class={{ visible, preload, collapsed }}
		id="sidebar-nav"
	>
		<div class="logo-section">
			<a class="logo-link" href="/" tabindex="-1">
				<img src="altera_med.png" alt="Altera" class="logo-icon" />
				{#if !collapsed}
					<span class="logo-text">Altera</span>
				{/if}
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
				<a
					href={path.href}
					class={['nav-button', { current: isCurrentPath(path.href) }]}
					title={collapsed ? path.name : undefined}
				>
					<span class="nav-icon"><Icon size={20} /></span>
					{#if !collapsed}
						<span class="nav-label">{path.name}</span>
					{/if}
				</a>
			{/each}
		</div>

		<div class="sidebar-footer">
			<button class="footer-btn collapse-btn desktop-only" onclick={toggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
				<span class="nav-icon">
					{#if collapsed}
						<PanelLeftOpenIcon size={20} />
					{:else}
						<PanelLeftCloseIcon size={20} />
					{/if}
				</span>
				{#if !collapsed}
					<span class="nav-label">Collapse</span>
				{/if}
			</button>
			<button class="footer-btn" onclick={handleLogout} title={collapsed ? 'Log out' : undefined}>
				<span class="nav-icon"><LogOut size={20} /></span>
				{#if !collapsed}
					<span class="nav-label">Log out</span>
				{/if}
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
		background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		will-change: transform;
		border-right: none;
		height: 100svh;
		width: 220px;
		box-sizing: border-box;
		padding: calc(1.75rem + 1.5vh) 1rem 1.25rem 1rem;
		z-index: 10;
		transition: width 0.2s ease, padding 0.2s ease;
		font-weight: 500;
	}
	nav.collapsed {
		width: 64px;
		padding-left: 0.5rem;
		padding-right: 0.5rem;
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
	@media screen and (max-width: 619px) {
		.desktop-only {
			display: none !important;
		}
	}

	/* Logo */
	.logo-section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.75rem;
		margin-bottom: 1.5rem;
		min-height: 26px;
	}
	nav.collapsed .logo-section {
		justify-content: center;
		padding: 0;
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
		white-space: nowrap;
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
		white-space: nowrap;
		overflow: hidden;
	}
	nav.collapsed .nav-button {
		justify-content: center;
		padding: 0.625rem;
	}
	.nav-button:hover {
		background-color: var(--dash-sidebar-hover);
		color: var(--dash-text-primary);
	}
	.nav-button.current,
	.nav-button.current:hover {
		background: linear-gradient(135deg, #7B74FF 0%, #6F6AF8 50%, #5B54E0 100%);
		color: #FFFFFF;
		font-weight: 600;
		border-radius: 1.25rem;
		box-shadow: 0 2px 12px rgba(111, 106, 248, 0.3);
	}
	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.nav-label {
		overflow: hidden;
		text-overflow: ellipsis;
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
		white-space: nowrap;
		overflow: hidden;
	}
	nav.collapsed .footer-btn {
		justify-content: center;
		padding: 0.625rem;
	}
	.footer-btn:hover {
		background-color: var(--dash-sidebar-hover);
		color: var(--dash-text-primary);
	}
</style>
