<!--
	The landing page's "why / who" content: the WHY ALTERA feature grid and the
	COMMUNITY testimonials.

	Lives here rather than in LandingPage because the swap screen — the app's
	front door since `c07b7b7` — shows the same thing underneath the card when
	nobody is connected. Two copies would drift, and this is the pitch, which
	is the part that must not.

	The landing page's own footer is NOT part of this: `AltShell` already draws
	one on the swap screen, and two footers stacked is worse than none.

	`fadeUp` entrance animations were left behind with the landing page on
	purpose. Here the sections sit below the fold under a working swap card, so
	they are scrolled to rather than arrived at, and animating them on mount
	means they have already played by the time anyone gets there.
-->
<script lang="ts">
	import { Repeat, Wallet, Shield, Layers, Zap, Globe } from '@lucide/svelte';

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
			desc: "Magi's resource credit model means zero cost to transfer. Hold HBD, transact for free.",
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
		}
	];

	const testimonials = [
		{
			name: 'Matt Rosen',
			title: 'CEO at Splinterlands',
			image: '/testimonials/matt-rosen.jpg',
			text: 'Magi aims to address native smart contracts and interoperability - which we think will be a complete game-changer for blockchain-based applications.'
		},
		{
			name: 'Benjamin Baraga',
			title: 'Founder Crystal Spider Games',
			image: '/testimonials/benjamin-baraga.jpg',
			text: 'Cross chain payments is the future and Magi is building it. If you care about digital money, check them out.'
		},
		{
			name: 'Stoodkev',
			title: 'CEO Hive Keychain',
			image: '/testimonials/stoodkev.png',
			text: 'Magi is one of the most innovative projects on Hive. Smart contracts and bridges will lead the way to a new era of developments.'
		},
		{
			name: 'Lordbutterfly',
			title: 'Marketing at Hive Blockchain',
			image: '/testimonials/lordbutterfly.jpg',
			text: 'L2 for Bitcoin with Hive speeds. A superior Lightning Network with no fees, routing issues, complexity. This is coming and it will fix everything.'
		},
		{
			name: 'Gabe',
			title: 'Crypto Shots founder',
			image: '/testimonials/gabe.jpg',
			text: 'Excited to see Magi enable Crypto Shots to auto-reward players on Hive and Ethereum with Hive and Bitcoin during our daily tournaments.'
		},
		{
			name: 'Asgarth',
			title: 'Co-founder Peakd.com',
			image: '/testimonials/asgarth.png',
			text: 'Looking forward to have Magi fully integrated with Hive. Smart contracts and bitcoin/evm bridges will enable lots of exciting new features.'
		}
	];
</script>

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
						<img
							src={t.image}
							alt={t.name}
							class="author-avatar"
							width="36"
							height="36"
							loading="lazy"
							decoding="async"
						/>
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

<style lang="scss">
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
		color: #7b74ff;
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
		transition:
			border-color 0.2s ease,
			transform 0.2s ease;
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
		color: #fbbf24;
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
	.feature-card.purple .feature-icon {
		background: rgba(111, 106, 248, 0.15);
		color: #7b74ff;
	}
	.feature-card.blue .feature-icon {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}
	.feature-card.green .feature-icon {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
	}
	.feature-card.amber .feature-icon {
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
	}
	.feature-card.teal .feature-icon {
		background: rgba(45, 212, 191, 0.15);
		color: #2dd4bf;
	}
	.feature-card.pink .feature-icon {
		background: rgba(236, 72, 153, 0.15);
		color: #ec4899;
	}

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
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
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

	/* Carried over from the landing page's narrow-screen block, which no
	   longer has this markup to adjust. */
	@media (max-width: 640px) {
		.features-grid {
			gap: 0.75rem;
		}
		.testimonial-card {
			width: 280px;
		}
	}
</style>
