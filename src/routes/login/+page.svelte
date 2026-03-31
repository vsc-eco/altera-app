<script lang="ts">
	import AppKitLogin from '$lib/auth/AppKitLogin.svelte';
	import HiveLogin from '$lib/auth/HiveLogin.svelte';
	import { goto } from '$app/navigation';
	import { getAuth } from '$lib/auth/store';
	import { browser } from '$app/environment';
	import Card from '$lib/cards/Card.svelte';
	import { ArrowRight, Repeat, Wallet, Shield, Layers, Zap, Globe, X } from '@lucide/svelte';

	let loginOpen = $state(false);

	let auth = $derived(getAuth()());
	let redirectTo =
		browser && new URL(localStorage.getItem('redirect_url') ?? window.location.origin);
	$effect(() => {
		if (auth?.status == 'authenticated' && browser) {
			localStorage.removeItem('redirect_url');
			if (redirectTo) goto(redirectTo);
		}
	});

	const features = [
		{
			icon: Layers,
			title: 'Up to 15% APR',
			desc: 'Stake HBD - a dollar-pegged stablecoin - and earn yield directly from your Altera dashboard.',
			color: 'amber',
			badge: 'Earn Yield'
		},
		{
			icon: Repeat,
			title: 'Native Cross-Chain Swaps',
			desc: 'Swap BTC, HIVE and HBD directly. Assets settle natively - no wrapped tokens, no custodial bridges.',
			color: 'purple',
			badge: null
		},
		{
			icon: Zap,
			title: 'Zero Transaction Fees',
			desc: 'Magi\'s resource credit model means zero cost to transfer. Hold HBD, transact for free.',
			color: 'green',
			badge: null
		},
		{
			icon: Wallet,
			title: 'MetaMask, Keychain & More',
			desc: 'Connect your existing wallet. No new accounts, no new seed phrases required.',
			color: 'blue',
			badge: null
		},
		{
			icon: Shield,
			title: 'Always Non-Custodial',
			desc: 'Your keys, your coins. Every swap settles trustlessly. No middle men, no custody.',
			color: 'teal',
			badge: null
		},
		{
			icon: Globe,
			title: 'Earn From the Network',
			desc: 'Provide liquidity, become a validator, earn from trading fees. Help power the network and get rewarded.',
			color: 'pink',
			badge: null
		},
	];

	const testimonials = [
		{
			name: 'Matt Rosen',
			title: 'CEO at Splinterlands',
			image: 'https://media.licdn.com/dms/image/v2/C4E03AQHFKsKAgVjaDw/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1556050046446?e=1736380800&v=beta&t=CM6Ns8rMpU2xpJOcJckUtIaMKL4rynh58z-w7GdiJpM',
			text: 'Magi aims to address native smart contracts and interoperability - which we think will be a complete game-changer for blockchain-based applications.'
		},
		{
			name: 'Benjamin Baraga',
			title: 'Founder Crystal Spider Games',
			image: 'https://pbs.twimg.com/profile_images/1695100148920053760/35D9gYQQ_400x400.jpg',
			text: 'Cross chain payments is the future and Magi is building it. If you care about digital money, check them out.'
		},
		{
			name: 'Stoodkev',
			title: 'CEO Hive Keychain',
			image: 'https://images.hive.blog/u/stoodkev/avatar',
			text: 'Magi is one of the most innovative projects on Hive. Smart contracts and bridges will lead the way to a new era of developments.'
		},
		{
			name: 'Lordbutterfly',
			title: 'Marketing at Hive Blockchain',
			image: 'https://pbs.twimg.com/profile_images/1724916831121473536/T_b0nWKo_400x400.jpg',
			text: 'L2 for Bitcoin with Hive speeds. A superior Lightning Network with no fees, routing issues, complexity. This is coming and it will fix everything.'
		},
		{
			name: 'Gabe',
			title: 'Crypto Shots founder',
			image: 'https://pbs.twimg.com/profile_images/1734655410949201921/i09PK57L_400x400.jpg',
			text: 'Excited to see Magi enable Crypto Shots to auto-reward players on Hive and Ethereum with Hive and Bitcoin during our daily tournaments.'
		},
		{
			name: 'Asgarth',
			title: 'Co-founder Peakd.com',
			image: 'https://images.hive.blog/u/asgarth/avatar',
			text: 'Looking forward to have Magi fully integrated with Hive. Smart contracts and bitcoin/evm bridges will enable lots of exciting new features.'
		}
	];
</script>

<document:head>
	<title>Altera - One Wallet. Every Chain.</title>
</document:head>

<div class="landing">
	<!-- Background mesh -->
	<div class="bg-mesh-landing"></div>

	<!-- Nav -->
	<nav class="landing-nav">
		<div class="nav-left">
			<img src="/altera_med.png" alt="Altera" class="nav-logo" />
			<span class="nav-brand">ALTERA</span>
		</div>
		<button class="nav-cta" onclick={() => loginOpen = true}>
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
		<p class="hero-tagline">Swap native assets - no wrapping, no bridges.</p>
		<p class="hero-sub">Swap real BTC, real DASH, real HIVE.</p>
		<p class="hero-hook"><em>Why? Because every time you use a centralized exchange, someone else controls your funds.</em></p>
		<div class="hero-tags">
			<span class="tag">Zero Fees</span>
			<span class="tag">Non-Custodial</span>
			<span class="tag">Any Wallet</span>
		</div>
		<div class="hero-buttons">
			<button class="btn-primary" onclick={() => loginOpen = true}>Launch App <ArrowRight size={16} /></button>
			<a href="https://docs.vsc.eco" target="_blank" rel="noopener" class="btn-secondary">Read Docs</a>
		</div>
	</section>

	<!-- Features -->
	<section class="features-section" id="features">
		<span class="section-label">WHY ALTERA</span>
		<h2>Everything cross-chain. Nothing custodial.</h2>
		<p class="section-sub">One app. Your keys.</p>
		<div class="features-grid">
			{#each features as feature}
				<div class="feature-card {feature.color}">
					{#if feature.badge}
						<span class="feature-badge">{feature.badge}</span>
					{/if}
					<div class="feature-icon">
						<feature.icon size={24} />
					</div>
					<h3>{feature.title}</h3>
					<p>{feature.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Testimonials -->
	<section class="testimonials-section">
		<span class="section-label">COMMUNITY</span>
		<h2>Trusted by the Ecosystem</h2>
		<div class="marquee-wrapper">
			<div class="marquee-track">
				{#each [...testimonials, ...testimonials] as t}
					<div class="testimonial-card">
						<p class="testimonial-text">"{t.text}"</p>
						<div class="testimonial-author">
							<img src={t.image} alt={t.name} class="author-avatar" />
							<div class="author-info">
								<span class="author-name">{t.name}</span>
								<span class="author-title">{t.title}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Login Modal -->
	{#if loginOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="login-overlay" onclick={() => loginOpen = false}>
			<div class="login-modal" onclick={(e) => e.stopPropagation()}>
				<button class="modal-close" onclick={() => loginOpen = false}><X size={20} /></button>
				<img src="/altera_med.png" alt="" class="modal-logo" />
				<h2 class="login-title">Connect to Altera</h2>
				<p class="login-subtitle">Choose how you want to connect</p>
				{#if redirectTo && redirectTo.pathname != '/'}
					<p class="continue">
						Continue to <span class="redirect">{redirectTo.pathname}</span>
					</p>
				{/if}
					<div class="login-option evm">
					<div class="option-left">
						<Wallet size={20} />
						<div class="option-text">
							<span class="option-label">EVM Wallet</span>
							<span class="option-hint">MetaMask · Coinbase · WalletConnect</span>
						</div>
					</div>
					<div class="option-right">
						<ArrowRight size={16} class="option-arrow" />
					</div>
					<div class="option-button" onclick={() => setTimeout(() => loginOpen = false, 100)}>
						<AppKitLogin />
					</div>
				</div>
				<div class="login-divider">
					<span>or</span>
				</div>
				<div class="hive-login-wrap">
					<HiveLogin />
				</div>
				<div class="modal-footer">
					<div class="powered-footer">
						<span>Powered by</span>
						<img src="/magi-with-name.svg" alt="Magi Network" />
					</div>
					<span class="custody-note">Non-custodial · Your keys, your assets</span>
				</div>
			</div>
		</div>
	{/if}

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
		background: #07070E;
		color: var(--dash-text-primary, #E8E6F0);
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
		background: linear-gradient(135deg, #7B74FF 0%, #5B54E0 100%);
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
		background: #4ADE80;
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
		0%, 100% { filter: invert(1) brightness(2) drop-shadow(0 0 15px rgba(111, 106, 248, 0.3)); }
		50% { filter: invert(1) brightness(2) drop-shadow(0 0 30px rgba(111, 106, 248, 0.6)); }
	}
	.hero-logo-text {
		font-size: clamp(3rem, 7vw, 5rem);
		font-weight: 700;
		letter-spacing: 0.25em;
		background: linear-gradient(135deg, #FFFFFF, #B0ADFF, #FFFFFF);
		background-size: 200% 200%;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		animation: gradient-shift 4s ease infinite;
	}
	@keyframes gradient-shift {
		0%, 100% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
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
		background: linear-gradient(135deg, #7B74FF 0%, #6F6AF8 40%, #5B54E0 100%);
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
		transition: border-color 0.15s ease, color 0.15s ease;
		&:hover {
			border-color: rgba(255, 255, 255, 0.3);
			color: white;
		}
	}

	/* ═══ Features ═══ */
	.features-section {
		position: relative;
		z-index: 1;
		max-width: 1100px;
		margin: 0 auto;
		padding: 4rem 5%;
		text-align: center;
	}
	.section-label {
		display: block;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: #7B74FF;
		margin-bottom: 0.75rem;
	}
	h2 {
		font-size: clamp(1.8rem, 4vw, 2.5rem);
		font-weight: 700;
		margin: 0 0 0.75rem;
		letter-spacing: -0.02em;
	}
	.section-sub {
		font-size: 1rem;
		color: rgba(255, 255, 255, 0.5);
		max-width: 500px;
		margin: 0 auto 2.5rem;
	}
	.features-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		@media (max-width: 768px) {
			grid-template-columns: 1fr;
		}
	}
	.feature-card {
		position: relative;
		text-align: left;
		padding: 1.5rem;
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
		transition: border-color 0.2s ease, transform 0.2s ease;
		&:hover {
			border-color: rgba(255, 255, 255, 0.15);
			transform: translateY(-2px);
		}
		h3 {
			font-size: 1rem;
			font-weight: 600;
			margin: 0.75rem 0 0.5rem;
		}
		p {
			font-size: 0.85rem;
			line-height: 1.6;
			color: rgba(255, 255, 255, 0.5);
			margin: 0;
			min-height: 2.7rem;
		}
	}
	.feature-badge {
		position: absolute;
		top: 1rem;
		right: 1rem;
		padding: 0.2rem 0.6rem;
		border-radius: 2rem;
		background: rgba(251, 191, 36, 0.15);
		color: #FBBF24;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.feature-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
	}
	.feature-card.purple .feature-icon { background: rgba(111, 106, 248, 0.15); color: #7B74FF; }
	.feature-card.blue .feature-icon { background: rgba(59, 130, 246, 0.15); color: #60A5FA; }
	.feature-card.green .feature-icon { background: rgba(74, 222, 128, 0.15); color: #4ADE80; }
	.feature-card.amber .feature-icon { background: rgba(251, 191, 36, 0.15); color: #FBBF24; }
	.feature-card.teal .feature-icon { background: rgba(45, 212, 191, 0.15); color: #2DD4BF; }
	.feature-card.pink .feature-icon { background: rgba(236, 72, 153, 0.15); color: #EC4899; }

	/* ═══ Testimonials ═══ */
	.testimonials-section {
		position: relative;
		z-index: 1;
		padding: 4rem 0;
		text-align: center;
		overflow: hidden;
	}
	.marquee-wrapper {
		margin-top: 2rem;
		overflow: hidden;
		width: 100%;
	}
	.marquee-track {
		display: flex;
		gap: 1.25rem;
		animation: marquee 40s linear infinite;
		width: max-content;
		&:hover {
			animation-play-state: paused;
		}
	}
	@keyframes marquee {
		from { transform: translateX(0); }
		to { transform: translateX(-50%); }
	}
	.testimonial-card {
		flex-shrink: 0;
		width: 340px;
		padding: 1.5rem;
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
		text-align: left;
	}
	.testimonial-text {
		font-size: 0.9rem;
		line-height: 1.65;
		color: rgba(255, 255, 255, 0.65);
		margin: 0 0 1.25rem;
		font-style: italic;
	}
	.testimonial-author {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.author-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
	}
	.author-info {
		display: flex;
		flex-direction: column;
	}
	.author-name {
		font-weight: 600;
		font-size: 0.85rem;
	}
	.author-title {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.4);
	}

	/* ═══ Login Modal ═══ */
	.login-overlay {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(10px);
		animation: overlayIn 0.2s ease;
	}
	@keyframes overlayIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.login-modal {
		position: relative;
		max-width: 400px;
		width: calc(100% - 2rem);
		background:
			radial-gradient(ellipse at 50% 30%, rgba(99, 88, 255, 0.08) 0%, transparent 70%),
			#0F1225;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 16px;
		padding: 2rem 1.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow: 0 0 60px rgba(99, 88, 255, 0.15);
		animation: modalIn 0.2s ease;
	}
	@keyframes modalIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}
	.modal-logo {
		width: 32px;
		height: 32px;
		filter: invert(1) brightness(2);
		margin-bottom: 0.75rem;
	}
	.modal-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.3);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 50%;
		display: flex;
		transition: color 0.15s;
		&:hover { color: white; }
	}
	.login-title {
		text-align: center;
		margin: 0 0 0.25rem;
		font-size: 1.25rem;
		font-weight: 700;
	}
	.login-subtitle {
		text-align: center;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.4);
		margin: 0 0 1.5rem;
	}
	.continue {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.5);
		margin: -0.5rem 0 1rem;
	}
	.redirect {
		font-family: 'Noto Sans Mono Variable', monospace;
		color: #7B74FF;
		text-decoration: underline;
	}

	/* ── Login options ── */
	.login-option {
		position: relative;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		background: #1A1F35;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		cursor: pointer;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		box-sizing: border-box;
		&:hover {
			border-color: rgba(99, 88, 255, 0.5);
			box-shadow: 0 0 20px rgba(99, 88, 255, 0.1);
		}
	}
	.option-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: rgba(255, 255, 255, 0.6);
	}
	.hive-icon {
		width: 20px;
		height: 20px;
	}
	.option-text {
		display: flex;
		flex-direction: column;
	}
	.option-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--dash-text-primary, white);
	}
	.option-hint {
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.3);
		margin-top: 0.1rem;
	}
	.option-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: rgba(255, 255, 255, 0.25);
	}
	/* EVM button overlay covers entire card */
	.option-button {
		position: absolute;
		inset: 0;
		z-index: 1;
		cursor: pointer;
		:global(button) {
			background: transparent !important;
			border: none !important;
			box-shadow: none !important;
			padding: 0 !important;
			margin: 0 !important;
			height: 100% !important;
			width: 100% !important;
			color: transparent !important;
			cursor: pointer;
		}
	}
	/* Hive login - styled to match EVM card */
	.hive-login-wrap {
		width: 100%;
		:global(button) {
			width: 100% !important;
			background: #1A1F35 !important;
			border: 1px solid rgba(255, 255, 255, 0.08) !important;
			border-radius: 12px !important;
			padding: 0.875rem 1rem !important;
			color: white !important;
			font-family: 'Nunito Sans', sans-serif !important;
			font-weight: 600 !important;
			font-size: 0.9rem !important;
			box-shadow: none !important;
			transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
			&:hover {
				border-color: rgba(99, 88, 255, 0.5) !important;
				box-shadow: 0 0 20px rgba(99, 88, 255, 0.1) !important;
			}
		}
	}

	/* ── Divider ── */
	.login-divider {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 0.75rem;
		margin: 0.75rem 0;
		span {
			font-size: 0.75rem;
			color: rgba(255, 255, 255, 0.25);
			white-space: nowrap;
		}
		&::before, &::after {
			content: '';
			flex: 1;
			height: 1px;
			background: rgba(255, 255, 255, 0.08);
		}
	}

	/* ── Modal footer ── */
	.modal-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 1.25rem;
		gap: 0.35rem;
	}
	.powered-footer {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		span {
			font-size: 0.75rem;
			color: rgba(255, 255, 255, 0.3);
		}
		img {
			height: 18px;
			opacity: 0.5;
		}
	}
	.custody-note {
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.2);
		letter-spacing: 0.02em;
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
	.features-section {
		animation: fadeUp 0.8s ease 0.6s both;
	}
	.feature-card {
		animation: fadeUp 0.5s ease both;
		&:nth-child(1) { animation-delay: 0.7s; }
		&:nth-child(2) { animation-delay: 0.8s; }
		&:nth-child(3) { animation-delay: 0.9s; }
		&:nth-child(4) { animation-delay: 1.0s; }
		&:nth-child(5) { animation-delay: 1.1s; }
		&:nth-child(6) { animation-delay: 1.2s; }
	}
	@keyframes fadeUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ═══ Other animations ═══ */
	@keyframes dot-pulse {
		0%, 100% { box-shadow: 0 0 4px 1px rgba(74, 222, 128, 0.3); }
		50% { box-shadow: 0 0 10px 3px rgba(74, 222, 128, 0.7); }
	}

	/* ═══ Responsive ═══ */
	@media (max-width: 640px) {
		.hero { padding: 4rem 5% 3rem; }
		h1 { font-size: 2.2rem; }
		.hero-sub { font-size: 0.95rem; }
		.features-grid { gap: 0.75rem; }
		.testimonial-card { width: 280px; }
		.login-section :global(div) { padding: 1rem; }
	}
</style>
