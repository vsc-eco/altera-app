<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAuth } from '$lib/auth/store';
	import { browser } from '$app/environment';
	import Card from '$lib/cards/Card.svelte';
	import { ArrowRight } from '@lucide/svelte';
	import { SITE_URL, SITE_TITLE, STRUCTURED_DATA } from '$lib/seo';

	// JSON-LD for search engines. `<` is escaped so the payload can never close
	// the script tag early, and the closing tag is split so it doesn't end
	// this <script> block.
	const structuredData =
		'<script type="application/ld+json">' +
		JSON.stringify(STRUCTURED_DATA).replace(/</g, '\\u003c') +
		'</' +
		'script>';

	import { openConnect } from '$lib/auth/connectModal';
	import LandingSections from './LandingSections.svelte';

	let auth = $derived(getAuth()());
	// APP-10: never honour a stored redirect that points off-origin (open
	// redirect via attacker-controlled localStorage / login link). Computed
	// once (no reassignment) so it stays a non-reactive init-time constant.
	const redirectTo = browser
		? (() => {
				// Where a sign-in lands when nothing sent the user here. The
				// wallet's Assets tab, not `/dashboard` — that is the old shell,
				// kept as a backup but no longer a destination the app offers.
				const home = new URL('/portfolio', window.location.origin);
				const url = new URL(localStorage.getItem('redirect_url') ?? home);
				return url.origin === window.location.origin ? url : home;
			})()
		: false;
	$effect(() => {
		if (auth?.status == 'authenticated' && browser) {
			localStorage.removeItem('redirect_url');
			if (redirectTo) goto(redirectTo);
		}
	});
</script>

<svelte:head>
	<title>{SITE_TITLE}</title>
	<link rel="canonical" href="{SITE_URL}/" />
	<meta property="og:url" content="{SITE_URL}/" />
	{@html structuredData}
</svelte:head>

<div class="landing">
	<!-- Background mesh -->
	<div class="bg-mesh-landing"></div>

	<!-- Nav -->
	<nav class="landing-nav">
		<div class="nav-left">
			<img src="/altera_med.png" alt="Altera" class="nav-logo" />
			<span class="nav-brand">ALTERA</span>
		</div>
		<button class="nav-cta" onclick={openConnect}>
			Launch App <ArrowRight size={14} />
		</button>
	</nav>

	<!-- Hero -->
	<section class="hero">
		<div class="hero-badge">
			<span class="hero-dot"></span>
			<span>Powered by Magi Network</span>
		</div>
		<div class="hero-logo">
			<img src="/altera_med.png" alt="Altera" class="hero-logo-mark" />
			<span class="hero-logo-text">ALTERA</span>
		</div>
		<h1 class="hero-tagline">Swap native assets - no wrapping, no bridges.</h1>
		<p class="hero-sub">Swap real BTC, real DASH, real HIVE.</p>
		<p class="hero-hook">
			<em
				>Why? Because every time you use a centralized exchange, someone else controls your funds.</em
			>
		</p>
		<div class="hero-tags">
			<span class="tag">Zero Fees</span>
			<span class="tag">Non-Custodial</span>
			<span class="tag">Any Wallet</span>
		</div>
		<div class="hero-buttons">
			<button class="btn-primary" onclick={openConnect}>Launch App <ArrowRight size={16} /></button>
			<a href="https://docs.magiprotocol.com" target="_blank" rel="noopener" class="btn-secondary"
				>Read Docs</a
			>
		</div>
	</section>

	<LandingSections />

	<!-- Login Modal -->
	<!-- Footer -->
	<footer class="landing-footer">
		<img src="/altera_med.png" alt="Altera" class="footer-logo" />
		<span>© 2026 Altera. Powered by Magi Network.</span>
	</footer>
</div>

<style lang="scss">
	.landing {
		position: relative;
		min-height: 100dvh;
		background: #07070e;
		color: var(--dash-text-primary, #e8e6f0);
		font-family: 'Nunito Sans', sans-serif;
		overflow-x: hidden;
	}

	.bg-mesh-landing {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background:
			radial-gradient(ellipse at 15% 10%, hsla(243, 90%, 65%, 0.35) 0px, transparent 40%),
			radial-gradient(ellipse at 80% 8%, hsla(238, 60%, 55%, 0.2) 0px, transparent 38%),
			radial-gradient(ellipse at 88% 50%, hsla(235, 50%, 50%, 0.15) 0px, transparent 40%),
			radial-gradient(ellipse at 5% 70%, hsla(245, 70%, 55%, 0.2) 0px, transparent 35%),
			radial-gradient(ellipse at 50% 35%, hsla(230, 50%, 40%, 0.15) 0px, transparent 45%),
			radial-gradient(ellipse at 75% 80%, hsla(240, 50%, 45%, 0.1) 0px, transparent 35%);
	}

	/* ═══ Nav ═══ */
	.landing-nav {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 5%;
		backdrop-filter: blur(12px);
		background: rgba(7, 7, 14, 0.6);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.nav-left {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.nav-logo {
		width: 28px;
		height: 28px;
		filter: invert(1) brightness(2);
	}
	.nav-brand {
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: 0.2em;
	}
	.nav-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 1.25rem;
		background: linear-gradient(135deg, #7b74ff 0%, #5b54e0 100%);
		color: white;
		border: none;
		border-radius: 2rem;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		transition: box-shadow 0.15s ease;
		&:hover {
			box-shadow: 0 4px 20px rgba(111, 106, 248, 0.4);
		}
	}

	/* ═══ Hero ═══ */
	.hero {
		position: relative;
		z-index: 1;
		max-width: 680px;
		margin: 0 auto;
		padding: 6rem 5% 4rem;
		text-align: center;
		& > *:not(.hero-canvas) {
			position: relative;
			z-index: 2;
		}
	}
	.hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.85rem;
		border: 1px solid rgba(111, 106, 248, 0.3);
		border-radius: 2rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: rgba(255, 255, 255, 0.8);
		margin-bottom: 1.5rem;
	}
	.hero-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #4ade80;
		box-shadow: 0 0 8px 2px rgba(74, 222, 128, 0.5);
		animation: dot-pulse 2s ease-in-out infinite;
	}
	.hero-logo {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.hero-logo-mark {
		width: clamp(48px, 8vw, 72px);
		height: auto;
		filter: invert(1) brightness(2) drop-shadow(0 0 20px rgba(111, 106, 248, 0.4));
		animation: logo-glow 3s ease-in-out infinite;
	}
	@keyframes logo-glow {
		0%,
		100% {
			filter: invert(1) brightness(2) drop-shadow(0 0 15px rgba(111, 106, 248, 0.3));
		}
		50% {
			filter: invert(1) brightness(2) drop-shadow(0 0 30px rgba(111, 106, 248, 0.6));
		}
	}
	.hero-logo-text {
		font-size: clamp(3rem, 7vw, 5rem);
		font-weight: 700;
		letter-spacing: 0.25em;
		background: linear-gradient(135deg, #ffffff, #b0adff, #ffffff);
		background-size: 200% 200%;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		animation: gradient-shift 4s ease infinite;
	}
	@keyframes gradient-shift {
		0%,
		100% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
	}
	.hero-tagline {
		font-size: clamp(1.4rem, 3vw, 1.9rem);
		font-weight: 700;
		color: white;
		margin: 0 0 0.75rem;
		letter-spacing: -0.01em;
	}
	.hero-sub {
		font-size: clamp(1rem, 2vw, 1.2rem);
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.7);
		max-width: 480px;
		margin: 0 auto 0.75rem;
		font-weight: 500;
	}
	.hero-hook {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.3);
		margin: 0 auto 1.75rem;
		max-width: 420px;
	}
	.hero-tags {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 2rem;
	}
	.tag {
		padding: 0.3rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2rem;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
	}
	.hero-buttons {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.7rem 1.5rem;
		background: linear-gradient(135deg, #7b74ff 0%, #6f6af8 40%, #5b54e0 100%);
		color: white;
		border: none;
		border-radius: 2rem;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
		box-shadow: 0 4px 20px rgba(111, 106, 248, 0.3);
		transition: box-shadow 0.15s ease;
		&:hover {
			box-shadow: 0 6px 28px rgba(111, 106, 248, 0.5);
		}
	}
	.btn-secondary {
		display: inline-flex;
		align-items: center;
		padding: 0.7rem 1.5rem;
		background: transparent;
		color: rgba(255, 255, 255, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 2rem;
		font-weight: 600;
		font-size: 0.9rem;
		text-decoration: none;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
		&:hover {
			border-color: rgba(255, 255, 255, 0.3);
			color: white;
		}
	}

	/* ═══ Footer ═══ */
	.landing-footer {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem 5%;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		span {
			font-size: 0.75rem;
			color: rgba(255, 255, 255, 0.25);
		}
	}
	.footer-logo {
		width: 20px;
		height: 20px;
		opacity: 0.4;
		filter: invert(1) brightness(2);
	}

	/* ═══ Entrance animations ═══ */
	.hero-badge {
		animation: fadeUp 0.6s ease both;
	}
	.hero-logo {
		animation: fadeUp 0.6s ease 0.1s both;
	}
	.hero-tagline {
		animation: fadeUp 0.6s ease 0.2s both;
	}
	.hero-sub {
		animation: fadeUp 0.6s ease 0.3s both;
	}
	.hero-tags {
		animation: fadeUp 0.6s ease 0.4s both;
	}
	.hero-buttons {
		animation: fadeUp 0.6s ease 0.5s both;
	}
	@keyframes fadeUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ═══ Other animations ═══ */
	@keyframes dot-pulse {
		0%,
		100% {
			box-shadow: 0 0 4px 1px rgba(74, 222, 128, 0.3);
		}
		50% {
			box-shadow: 0 0 10px 3px rgba(74, 222, 128, 0.7);
		}
	}

	/* ═══ Responsive ═══ */
	@media (max-width: 640px) {
		.hero {
			padding: 4rem 5% 3rem;
		}
		h1 {
			font-size: 2.2rem;
		}
		.hero-sub {
			font-size: 0.95rem;
		}
	}
</style>
