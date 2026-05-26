<script>
	import '@styles/reset.css';
	import '@styles/colors.scss';
	import '@styles/base.scss';
	import '@fontsource-variable/noto-sans-mono';
	import '@fontsource-variable/dm-sans';
	import AuthInjector from '$lib/auth/AuthInjector.svelte';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';
	import { themeStore, getInitialTheme, THEMES } from '$lib/theme';
	import { cleanOldLocalStorage } from '$lib/cleanup';
	import { refreshAllNodes } from '$lib/nodeSelection/select';
	import { showConsoleSecurityWarning } from '$lib/consoleWarning';

	let { children } = $props();
	injectAnalytics();
	let allowFocusVisible = false;
	// set the theme on load
	onMount(() => {
		showConsoleSecurityWarning();
		const initialTheme = getInitialTheme();
		themeStore.set(THEMES[initialTheme]);
		cleanOldLocalStorage();
		refreshAllNodes();
		// window.addEventListener(
		// 	'keydown',
		// 	(e) => {
		// 		if (e.key === 'Tab') {
		// 			allowFocusVisible = true;
		// 			document.body.classList.add('allow-focus-visible');
		// 		}
		// 		if (e.key === 'Escape') {
		// 			allowFocusVisible = false;
		// 			document.body.classList.remove('allow-focus-visible');
		// 			// @ts-ignore
		// 			document.activeElement?.blur?.();
		// 		}
		// 	},
		// 	true
		// );
		// window.addEventListener(
		// 	'pointerdown',
		// 	() => {
		// 		allowFocusVisible = false;
		// 		document.body.classList.remove('allow-focus-visible');
		// 	},
		// 	true
		// );
	});
</script>

<AuthInjector>
	{@render children()}
</AuthInjector>
