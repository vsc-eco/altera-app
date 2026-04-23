<script lang="ts">
	import { page } from '$app/state';
	import PillButton from '$lib/PillButton.svelte';

	const is404 = page.status === 404;
	const title = is404 ? 'Page not found' : 'Something went wrong';
	const message = is404
		? "This page doesn't exist or you don't have access to it."
		: page.error?.message ?? 'An unexpected error occurred.';
</script>

<svelte:head>
	<title>{page.status} · Altera</title>
</svelte:head>

<div class="bg-mesh"></div>

<div class="shell">
	<div class="card">
		<div class="logo-wrap">
			<img src="/magi.svg" alt="Altera" class="logo" />
			<div class="glow"></div>
		</div>

		<div class="code">{page.status}</div>
		<h1>{title}</h1>
		<p>{message}</p>

		<PillButton href="/" styleType="invert">Go to dashboard</PillButton>
	</div>

	<footer>
		<span>Altera &mdash; VSC Multi-Chain Wallet</span>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0a0a12;
		font-family: 'DM Sans Variable', 'DM Sans', sans-serif;
		color: #ffffff;
		min-height: 100dvh;
	}

	/* Same gradient mesh as the authed layout */
	.bg-mesh {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background:
			radial-gradient(ellipse at 15% 10%, hsla(243, 90%, 65%, 0.45) 0px, transparent 40%),
			radial-gradient(ellipse at 80% 8%, hsla(238, 60%, 55%, 0.3) 0px, transparent 38%),
			radial-gradient(ellipse at 88% 50%, hsla(235, 50%, 50%, 0.2) 0px, transparent 40%),
			radial-gradient(ellipse at 5% 70%, hsla(245, 70%, 55%, 0.25) 0px, transparent 35%),
			radial-gradient(ellipse at 50% 35%, hsla(230, 50%, 40%, 0.2) 0px, transparent 45%),
			radial-gradient(ellipse at 75% 80%, hsla(240, 50%, 45%, 0.15) 0px, transparent 35%);
	}

	.shell {
		position: relative;
		z-index: 1;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		gap: 2rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
		background: #1a1a25;
		border: 1px solid #252533;
		border-radius: 24px;
		padding: 3rem 2.5rem;
		max-width: 420px;
		width: 100%;
		box-shadow:
			0 0 0 1px rgba(108, 92, 231, 0.08),
			0 24px 48px rgba(0, 0, 0, 0.4);
	}

	/* Logo + glow halo */
	.logo-wrap {
		position: relative;
		width: 88px;
		height: 88px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.5rem;
	}

	.logo {
		width: 64px;
		height: 64px;
		position: relative;
		z-index: 1;
		opacity: 0.9;
		filter: drop-shadow(0 0 12px rgba(212, 71, 255, 0.5));
		animation: float 4s ease-in-out infinite;
	}

	.glow {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(ellipse at center, rgba(108, 92, 231, 0.25) 0%, transparent 70%);
		animation: pulse-glow 4s ease-in-out infinite;
	}

	.code {
		font-size: 5rem;
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.04em;
		background: linear-gradient(135deg, #6c5ce7 0%, #d447ff 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #ffffff;
	}

	p {
		margin: 0;
		font-size: 0.9rem;
		color: #9ca3af;
		line-height: 1.6;
		max-width: 300px;
	}

footer {
		font-size: 0.75rem;
		color: #6b7280;
		letter-spacing: 0.02em;
	}

	@keyframes float {
		0%, 100% { transform: translateY(0px); }
		50%       { transform: translateY(-6px); }
	}

	@keyframes pulse-glow {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50%       { opacity: 1;   transform: scale(1.15); }
	}
</style>
