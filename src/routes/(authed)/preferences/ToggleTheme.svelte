<script lang="ts">
    import Select from '$lib/zag/Select.svelte';
    import { getInitialTheme, THEMES, theme } from '$lib/theme';
</script>
<h2>Theme</h2>
<Select
    items={Object.values(THEMES)}
    initial={THEMES[getInitialTheme()].label}
    onValueChange={(v) => {
        theme.set(v.items[0]);
    }}
/>