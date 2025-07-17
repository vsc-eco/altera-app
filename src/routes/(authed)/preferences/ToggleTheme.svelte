<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import { getInitialTheme, THEMES, themeStore, type ThemeValue } from '$lib/theme';
	import { Sun, Moon, Laptop } from '@lucide/svelte';

	const themeItems = [
		{
			label: 'System',
			snippet: system,
			snippetData: 'System Preference'
		},
		{
			label: 'Light',
			snippet: light,
			snippetData: 'Light'
		},
		{
			label: 'Dark',
			snippet: dark,
			snippetData: 'Dark'
		}
	];
</script>

{#snippet system(label: string)}
	<div>
		<Laptop />
		{label}
	</div>
{/snippet}

{#snippet light(label: string)}
	<div>
		<Sun />
		{label}
	</div>
{/snippet}

{#snippet dark(label: string)}
	<div>
		<Moon />
		{label}
	</div>
{/snippet}

<h2>Theme</h2>
<Select
	items={themeItems}
	initial={THEMES[getInitialTheme()].label}
	onValueChange={(v) => {
		themeStore.set(THEMES[v.items[0].label.toLocaleLowerCase() as ThemeValue]);
	}}
/>

<style>
	div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
