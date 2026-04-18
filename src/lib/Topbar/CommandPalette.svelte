<script lang="ts">
	import { goto } from '$app/navigation';
	import { paths } from '$lib/paths';
	import { Search, Settings, User, ArrowRight, Droplets } from '@lucide/svelte';
	import { getAuth } from '$lib/auth/store';

	let { open = $bindable(false) }: { open: boolean } = $props();
	let query = $state('');
	let selectedIndex = $state(0);
	let inputEl = $state<HTMLInputElement>();

	const auth = $derived(getAuth()());

	type CommandItem = {
		id: string;
		label: string;
		hint?: string;
		icon: typeof Search;
		action: () => void;
	};

	const allItems: CommandItem[] = $derived.by(() => {
		const items: CommandItem[] = [];

		// Pages from sidebar
		for (const p of paths) {
			items.push({
				id: `page-${p.href}`,
				label: p.name,
				hint: p.href,
				icon: p.icon,
				action: () => goto(p.href)
			});
		}

		// Swap sub-pages
		items.push({
			id: 'page-pools',
			label: 'Pools',
			hint: '/swap → Pools',
			icon: Droplets,
			action: () => goto('/swap?tab=pools')
		});

		// Preferences
		items.push({
			id: 'app-prefs',
			label: 'App Preferences',
			hint: '/preferences',
			icon: Settings,
			action: () => goto('/preferences')
		});
		items.push({
			id: 'acc-prefs',
			label: 'Account Preferences',
			hint: 'Wallet settings',
			icon: User,
			action: () => auth.value?.openSettings?.()
		});

		return items;
	});

	const filtered = $derived.by(() => {
		if (!query.trim()) return allItems;
		const q = query.trim().toLowerCase();
		return allItems.filter(
			(item) =>
				item.label.toLowerCase().includes(q) ||
				(item.hint?.toLowerCase().includes(q) ?? false)
		);
	});

	$effect(() => {
		if (open) {
			query = '';
			selectedIndex = 0;
			// Focus input after mount
			requestAnimationFrame(() => inputEl?.focus());
		}
	});

	// Clamp selectedIndex when filtered results change
	$effect(() => {
		if (selectedIndex >= filtered.length) {
			selectedIndex = Math.max(0, filtered.length - 1);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % filtered.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
		} else if (e.key === 'Enter' && filtered[selectedIndex]) {
			e.preventDefault();
			execute(filtered[selectedIndex]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	function execute(item: CommandItem) {
		open = false;
		item.action();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="palette-backdrop" onclick={() => (open = false)}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="palette" onclick={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
			<div class="palette-input-row">
				<Search size={16} />
				<input
					bind:this={inputEl}
					type="text"
					bind:value={query}
					placeholder="Search or jump to…"
				/>
				<kbd>Esc</kbd>
			</div>
			<div class="palette-results">
				{#each filtered as item, i (item.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class={['palette-item', { selected: i === selectedIndex }]}
						onmouseenter={() => (selectedIndex = i)}
						onclick={() => execute(item)}
					>
						<span class="palette-icon">
							<item.icon size={16} />
						</span>
						<span class="palette-label">{item.label}</span>
						{#if item.hint}
							<span class="palette-hint">{item.hint}</span>
						{/if}
						<span class="palette-go"><ArrowRight size={14} /></span>
					</div>
				{/each}
				{#if filtered.length === 0}
					<div class="palette-empty">No results</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.palette-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		justify-content: center;
		padding-top: 15vh;
	}
	.palette {
		width: 90%;
		max-width: 480px;
		max-height: 400px;
		background: linear-gradient(135deg, #0000001a, #ffffff0d);
		backdrop-filter: blur(25px);
		border: 1px solid var(--dash-card-border);
		border-radius: 16px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		height: fit-content;
	}
	.palette-input-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--dash-card-border);
		color: var(--dash-text-muted);
	}
	.palette-input-row input {
		flex: 1;
		border: none;
		background: transparent;
		color: var(--dash-text-primary);
		font-size: 0.9rem;
		font-family: inherit;
		outline: none;
	}
	.palette-input-row input::placeholder {
		color: var(--dash-text-muted);
	}
	kbd {
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--dash-card-border);
		border-radius: 4px;
		font-size: 0.65rem;
		color: var(--dash-text-muted);
		background: rgba(255, 255, 255, 0.05);
	}
	.palette-results {
		overflow-y: auto;
		padding: 0.35rem;
	}
	.palette-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		cursor: pointer;
		color: var(--dash-text-primary);
		font-size: 0.85rem;
	}
	.palette-item.selected {
		background: rgba(111, 106, 248, 0.15);
	}
	.palette-icon {
		display: flex;
		align-items: center;
		color: var(--dash-text-muted);
	}
	.palette-label {
		flex: 1;
	}
	.palette-hint {
		font-size: 0.7rem;
		color: var(--dash-text-muted);
	}
	.palette-go {
		display: flex;
		align-items: center;
		color: var(--dash-text-muted);
		opacity: 0;
	}
	.palette-item.selected .palette-go {
		opacity: 1;
	}
	.palette-empty {
		padding: 1.5rem;
		text-align: center;
		color: var(--dash-text-muted);
		font-size: 0.85rem;
	}
</style>
