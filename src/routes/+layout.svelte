<script lang="ts">
	import '../styles/reset.css';
	import '../styles/colors.scss';
	import '../styles/base.scss';
	let { children } = $props();
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
</script>

<header>
	<img src="/vsc.png" alt="VSC Logo" width="48" />
	<h2>DeFi</h2>
</header>
{@render children()}

<style>
	img {
		display: block;
		height: 2.83rem;
	}
	header {
		display: flex;
		justify-content: left;
		gap: 0.5rem;
	}
	h2 {
		margin: auto 0;
		color: var(--secondary-mid);
	}
</style>
