<script>
	import '@styles/reset.css';
	import '@styles/colors.scss';
	import '@styles/base.scss';
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
	let { children } = $props();
</script>

{@render children()}

<style>
	:global(body) {
		margin: 1rem 0.5rem;
	}
</style>
