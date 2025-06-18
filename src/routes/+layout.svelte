<script>
	import '@styles/reset.css';
	import '@styles/colors.scss';
	import '@styles/base.scss';
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
	import AuthInjector from '$lib/auth/AuthInjector.svelte';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import { theme, getInitialTheme, THEMES } from '$lib/theme';

	let { children } = $props();
	injectAnalytics();

	// set the theme on load
	onMount(() => {
		const initialTheme = getInitialTheme();
		theme.set(THEMES[initialTheme]);
	})
</script>

<AuthInjector>
	{@render children()}
</AuthInjector>
