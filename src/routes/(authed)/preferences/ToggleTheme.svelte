<script lang="ts">
	import Select from '$lib/zag/Select.svelte';
	import { getInitialTheme, THEMES, themeStore, type ThemeValue } from '$lib/theme';
	import { Sun, Moon, Laptop } from '@lucide/svelte';

	const themeItems = [
		{
			label: 'System',
			value: 'system',
			snippet: system,
			snippetData: 'System Preference'
		},
		{
			label: 'Light',
			value: 'light',
			snippet: light,
			snippetData: 'Light'
		},
		{
			label: 'Dark',
			value: 'dark',
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

<Select
	items={themeItems}
	initial={THEMES[getInitialTheme()].value}
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
