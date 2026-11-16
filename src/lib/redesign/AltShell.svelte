<script lang="ts">
	import { page } from '$app/state';
	import { getAuth } from '$lib/auth/store';
	import { getAccountNameFromAuth } from '$lib/getAccountName';
	import { altTheme, altThemeClass } from './altTheme';
	import { WALLET_TABS } from './walletTabs';
	import { ChevronDown, Settings } from '@lucide/svelte';
	import Notifications from '$lib/Topbar/Notifications.svelte';
	import { accountBalance } from '$lib/stores/currentBalance';
	import { openConnect } from '$lib/auth/connectModal';
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		/** `task` centres a single card (swap, transfer); `wide` is for lists. */
		width?: 'task' | 'wide';
		/** Drawn behind the content on the swap screen only. */
		floatingCoins?: boolean;
	};
	let { children, width = 'task', floatingCoins = false }: Props = $props();

	const auth = $derived(getAuth()());
	const account = $derived(getAccountNameFromAuth(auth));
	const connected = $derived(!!auth.value);

	/** Same figure the old top bar showed. Hive accounts get a 10k free tier
	 *  on top of their HBD-derived allowance; see `vsc_rc_derivation`. */
	const rcDisplay = $derived.by(() => {
		const bal = $accountBalance.bal;
		const isHive = auth.value?.provider === 'aioha';
		const maxRCs = isHive ? bal.hbd + 10000 : bal.hbd;
		if (!bal) return 'MAGI RC: 0 / 0';
		return `MAGI RC: ${(bal.resource_credits || 0).toLocaleString()} / ${maxRCs.toLocaleString()}`;
	});

	type MenuName = 'wallet' | 'market' | null;
	let menu = $state<MenuName>(null);

	/** Marks the nav item for the page being viewed. Query strings matter here:
	 *  Swap and Pools are the same route today, split only by `?tab=`. */
	function isActive(href: string): boolean {
		const [path, query] = href.split('?');
		if (page.url.pathname !== path) return false;
		if (!query) return !page.url.search || page.url.search === '?tab=swap';
		return page.url.search.includes(query);
	}

	// The menu IS the wallet page's tab row — same entries, same order — so
	// picking one lands on the wallet with that tab already open rather than
	// on a page the reader then has to orient in.
	// `/dashboard` is NOT in this list. The old shell is still live at that URL
	// as the working backup of the controls the redesigned pages have not
	// picked up yet, but offering it in the menu invites the reader into a
	// second, different-looking app from a menu that otherwise never leaves
	// this one. It stays reachable by typing the URL.
	const walletItems = WALLET_TABS.map((tab) => ({
		href: tab.href,
		title: tab.label,
		hint: tab.hint
	}));
	const marketItems = [
		{ href: '/custom-tokens', title: 'Magi Tokens / NFTs', hint: 'What you hold' },
		{ href: '/market', title: 'Magi Market', hint: 'Buy and sell' }
	];

	function toggle(name: Exclude<MenuName, null>) {
		menu = menu === name ? null : name;
	}
	function closeMenus() {
		menu = null;
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeMenus();
	}

	/** Coins drifting behind the swap card. Decorative only. */
	const coins = [
		{ src: '/hive/hive.svg', size: 76, left: '11%', top: '29%', blur: 0, op: 1, dur: 9, delay: -2 },
		{ src: '/btc/btc.svg', size: 88, left: '84%', top: '37%', blur: 0, op: 1, dur: 11, delay: -5 },
		{
			src: '/coins/dash-coin.svg',
			size: 52,
			left: '78%',
			top: '12%',
			blur: 2,
			op: 0.8,
			dur: 8,
			delay: -1
		},
		{
			src: '/coins/eth-coin.svg',
			size: 56,
			left: '7%',
			top: '70%',
			blur: 2,
			op: 0.8,
			dur: 10,
			delay: -6
		},
		{
			src: '/coins/hbd-coin.svg',
			size: 46,
			left: '21%',
			top: '58%',
			blur: 2,
			op: 0.8,
			dur: 12,
			delay: -3
		},
		{
			src: '/coins/hive-coin.svg',
			size: 34,
			left: '93%',
			top: '72%',
			blur: 5,
			op: 0.5,
			dur: 9,
			delay: -4
		},
		{
			src: '/btc/btc.svg',
			size: 30,
			left: '5%',
			top: '13%',
			blur: 6,
			op: 0.45,
			dur: 10,
			delay: -7
		},
		{
			src: '/coins/dash-coin.svg',
			size: 26,
			left: '66%',
			top: '82%',
			blur: 6,
			op: 0.45,
			dur: 11,
			delay: -2
		}
	];
</script>

<svelte:window onkeydown={onKeydown} />

<div class={['alt-root', altThemeClass($altTheme)]}>
	<div class="alt-page">
		<div class="alt-mesh" aria-hidden="true"></div>

		{#if floatingCoins}
			<div class="coins" aria-hidden="true">
				{#each coins as c, i (i)}
					<img
						class="alt-float"
						src={c.src}
						alt=""
						style:--size="{c.size}px"
						style:--left={c.left}
						style:--top={c.top}
						style:--blur="{c.blur}px"
						style:--op={c.op}
						style:--dur="{c.dur}s"
						style:--delay="{c.delay}s"
					/>
				{/each}
			</div>
		{/if}

		<header>
			<a class="brand" href="/">
				<img src="/altera_med.png" alt="" />
				<span>ALTERA</span>
			</a>

			<nav>
				<a class={['nav-item', { active: isActive('/') }]} href="/">Swap</a>
				<a class={['nav-item', { active: isActive('/pools') }]} href="/pools">Pools</a>

				{#if connected}
					<div class="menu-wrap">
						<button
							class={['nav-item', { open: menu === 'wallet' }]}
							aria-expanded={menu === 'wallet'}
							onclick={() => toggle('wallet')}
						>
							Wallet <ChevronDown size={14} />
						</button>
						{#if menu === 'wallet'}
							{@render popup(walletItems)}
						{/if}
					</div>

					<div class="menu-wrap">
						<button
							class={['nav-item', { open: menu === 'market' }]}
							aria-expanded={menu === 'market'}
							onclick={() => toggle('market')}
						>
							Magi Market <ChevronDown size={14} />
						</button>
						{#if menu === 'market'}
							{@render popup(marketItems)}
						{/if}
					</div>

					<a
						class={['nav-item', { active: isActive('/witness-assistant') }]}
						href="/witness-assistant"
					>
						Witnesses
					</a>
				{/if}
			</nav>

			<div class="right">
				{#if connected}
					<div class="rc-badge" title="Resource credits">
						<span class="rc-text">{rcDisplay}</span>
					</div>
					<div class="bell"><Notifications /></div>
				{/if}
				<a class="cog" href="/preferences" title="Preferences" aria-label="Preferences">
					<Settings size={18} />
				</a>
				{#if connected}
					<a class="account" href="/portfolio">
						<span class="avatar">{(account ?? '?').charAt(0).toUpperCase()}</span>
						<span class="account-name">{account}</span>
					</a>
				{:else}
					<button class="connect" type="button" onclick={openConnect}>Connect</button>
				{/if}
			</div>
		</header>

		<!-- Clicking anywhere outside a popup closes it. The element only exists
		     while one is open, so it never swallows an ordinary click. -->
		{#if menu}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="menu-scrim" onclick={closeMenus}></div>
		{/if}

		<main class={width}>
			{@render children()}
		</main>

		<footer>
			<a class="powered" href="https://magiprotocol.com" target="_blank" rel="noopener noreferrer">
				Powered by <img src="/magi-with-name.svg" alt="Magi" />
			</a>
			<div class="links">
				<a href="https://docs.magiprotocol.com" target="_blank" rel="noopener noreferrer">Docs</a>
				<span>·</span>
				<a href="https://vsc.techcoderx.com" target="_blank" rel="noopener noreferrer">Explorer</a>
				<span>·</span>
				<span>© 2026 Altera</span>
			</div>
		</footer>
	</div>
</div>

{#snippet popup(items: { href: string; title: string; hint: string }[])}
	<div class="popup">
		{#each items as item (item.href)}
			<a class="popup-item" href={item.href} onclick={closeMenus}>
				<span class="popup-title">{item.title}</span>
				<span class="popup-hint">{item.hint}</span>
			</a>
		{/each}
	</div>
{/snippet}

<style lang="scss">
	.coins {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		overflow: hidden;
	}
	.coins img {
		position: absolute;
		left: var(--left);
		top: var(--top);
		width: var(--size);
		height: var(--size);
		opacity: var(--op);
		filter: blur(var(--blur)) drop-shadow(0 12px 28px rgba(0, 0, 0, 0.35));
		animation: alt-float var(--dur) ease-in-out infinite;
		animation-delay: var(--delay);
	}

	header {
		position: relative;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px clamp(16px, 4vw, 32px);
		flex-wrap: wrap;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-right: 16px;
		color: var(--alt-tx);
		text-decoration: none;
	}
	.brand img {
		height: 26px;
		width: auto;
		filter: var(--alt-logo-filter);
	}
	.brand span {
		font-weight: 700;
		font-size: 17px;
		letter-spacing: 0.2em;
	}

	nav {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 1;
		flex-wrap: wrap;
	}
	.nav-item {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		color: var(--alt-tx-2);
		background: none;
		border: 0;
		padding: 8px 14px;
		border-radius: 999px;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}
	.nav-item:hover {
		background: var(--alt-chip);
		color: var(--alt-tx);
	}
	.nav-item.active {
		color: var(--alt-tx);
		font-weight: 700;
	}
	.nav-item.open {
		background: var(--alt-chip);
		color: var(--alt-tx);
	}

	.menu-wrap {
		position: relative;
	}
	.popup {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 20;
		min-width: 240px;
		padding: 6px;
		border-radius: 18px;
		background: var(--alt-modal);
		border: 1px solid var(--alt-card-border);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
	}
	.popup-item {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 10px 12px;
		border-radius: 12px;
		text-decoration: none;
	}
	.popup-item:hover {
		background: var(--alt-chip);
	}
	.popup-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--alt-tx);
	}
	.popup-hint {
		font-size: 12px;
		font-weight: 500;
		color: var(--alt-mut);
	}
	/* Below the header, not above it. `header` sets `z-index: 5`, which makes it
	   a stacking context, so the popup's own `z-index: 20` only orders it
	   *within* the header — against this scrim the whole header counts as 5. A
	   scrim above that still shows the popup (it is transparent) while eating
	   every click aimed at it. Sitting at 4 it covers the page content
	   (`main` and `footer` are at 1) and nothing else. */
	.menu-scrim {
		position: fixed;
		inset: 0;
		z-index: 4;
	}

	.right {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	/* Resource credits and the notification bell, carried over from the old
	   top bar. Both are account state, so neither exists logged out. */
	.rc-badge {
		display: flex;
		align-items: center;
		height: 34px;
		padding: 0 14px;
		border-radius: 999px;
		background: var(--alt-field);
		border: 1px solid var(--alt-field-border);
		white-space: nowrap;
	}
	.rc-text {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--alt-tx-2);
	}
	.bell {
		display: flex;
		align-items: center;
	}

	.cog {
		width: 40px;
		height: 40px;
		border-radius: 999px;
		border: 1px solid var(--alt-card-border);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--alt-tx-2);
		text-decoration: none;
	}
	.cog:hover {
		background: var(--alt-chip);
		color: var(--alt-tx);
	}
	.connect {
		font: inherit;
		cursor: pointer;
		border-radius: 999px;
		background: var(--alt-acc-soft);
		color: var(--alt-acc-tx);
		font-size: 14px;
		font-weight: 700;
		padding: 10px 18px;
		text-decoration: none;
	}
	.connect:hover {
		background: var(--alt-acc-soft-hover);
	}
	.account {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 14px 5px 5px;
		border-radius: 999px;
		background: var(--alt-chip);
		border: 1px solid var(--alt-card-border);
		color: var(--alt-tx);
		text-decoration: none;
	}
	.account:hover {
		background: var(--alt-chip-hover);
	}
	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: linear-gradient(135deg, #7b74ff, #5b54e0);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 800;
	}
	.account-name {
		font-size: 14px;
		font-weight: 700;
		max-width: 12ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	main {
		position: relative;
		z-index: 1;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		padding: clamp(32px, 8vh, 88px) clamp(16px, 4vw, 32px) 48px;
		box-sizing: border-box;
	}
	/* A task page's CARD is 470px, but its heading is not — the hero has to
	   breathe, so the column is wider and the page narrows the card itself. */
	main.task > :global(*) {
		width: 100%;
		max-width: 760px;
	}
	main.wide > :global(*) {
		width: 100%;
		max-width: 1120px;
	}

	footer {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding: 18px clamp(16px, 4vw, 32px);
		font-size: 12px;
		color: var(--alt-mut);
	}
	.powered {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--alt-mut);
		text-decoration: none;
	}
	.powered img {
		height: 16px;
		opacity: 0.6;
		filter: var(--alt-magi-filter);
	}
	.links {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.links a {
		color: var(--alt-mut);
		text-decoration: none;
	}
	.links a:hover {
		color: var(--alt-tx-2);
	}

	/* The coins are drawn behind a *translucent* card. On a wide screen they
	   are placed in the margins either side of it; once the column narrows to
	   the card's own width they end up behind it instead, and glass being
	   glass, they read as blobs sitting ON the task. The reference prototype
	   is desktop-only and has no answer for this — drop them. */
	@media (max-width: 760px) {
		.coins {
			display: none;
		}
		.account-name {
			display: none;
		}
		/* 8vh of a phone screen is ~67px of nothing between the nav and the
		   page's own heading — and the nav has usually wrapped to two rows by
		   here, so the gap reads as a hole. */
		main {
			padding-top: clamp(16px, 2.5vh, 28px);
		}
	}

	/* Narrower still, brand + nav + account no longer share a line. Left to
	   itself `nav` wraps *inside* its own flex child and stacks Swap over
	   Pools next to the logo; give it a row of its own instead. */
	@media (max-width: 560px) {
		.brand {
			margin-right: auto;
		}
		nav {
			order: 3;
			flex-basis: 100%;
			justify-content: center;
		}
		main {
			padding-top: 12px;
		}
	}
</style>
