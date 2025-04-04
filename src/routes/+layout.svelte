<script>
	import '@styles/reset.css';
	import '@styles/colors.scss';
	import '@styles/base.scss';
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
	import AuthInjector from '$lib/auth/AuthInjector.svelte';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';

	let { children } = $props();
	injectAnalytics();
</script>

<AuthInjector>
	{@render children()}
</AuthInjector>
