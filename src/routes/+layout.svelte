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

    let { children } = $props();
    injectAnalytics();

    function blurAll() {
        const active = document.activeElement;
        // @ts-ignore
        if (active && typeof active.blur === "function") active.blur();

        // Removes focus & text selection
        window.getSelection()?.removeAllRanges();
    }

    onMount(() => {
        // 1️⃣ Remove old focus BEFORE click (previous component)
        document.addEventListener("pointerdown", blurAll, true);

        // 2️⃣ Remove focus added by the current click (button auto-focus)
        document.addEventListener("pointerup", blurAll, true);

        // 3️⃣ ESC removes focus globally
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") blurAll();
        });

        // theme setup
        const initialTheme = getInitialTheme();
        themeStore.set(THEMES[initialTheme]);
        cleanOldLocalStorage();
    });
</script>

<AuthInjector>
    {@render children()}
</AuthInjector>