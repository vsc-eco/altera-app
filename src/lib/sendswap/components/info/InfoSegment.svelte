<script lang="ts">
	import { Dot } from '@lucide/svelte';

	type Props = {
		label: string;
		display?: string[];
		disabled?: boolean;
		size?: 'small' | 'medium' | 'large';
	};
	let { label, display, disabled = false, size = 'small' }: Props = $props();

	let divEl: HTMLDivElement | null = $state(null);
	let listEl: HTMLUListElement | null = $state(null);
	let isWrapped = $state(false);

	function measureWrap() {
		if (!listEl) return;
		const items = Array.from(listEl.querySelectorAll<HTMLLIElement>('li'));
		if (items.length <= 1) {
			isWrapped = false;
			return;
		}
		const totalWidth = items.reduce((acc, cur) => acc + cur.clientWidth, 0) + 24;
		isWrapped = totalWidth > (divEl?.clientWidth ?? listEl.clientWidth);
	}

	// Run once when mounted and re-run if listEl changes
	$effect(() => {
		if (!listEl) return;

		const ro = new ResizeObserver(() => measureWrap());
		ro.observe(listEl);
		measureWrap(); // initial

		const onResize = () => measureWrap();
		window.addEventListener('resize', onResize);

		return () => {
			window.removeEventListener('resize', onResize);
			ro.disconnect();
		};
	});

	$effect(() => {
		display;
		measureWrap();
	});
</script>

<div class={{ stacked: size !== 'small' }} bind:this={divEl}>
	<span class={{ disabled }}>{label}</span>

	{#if display}
		<!-- Call this stacked and not large so it reuses class from warpper div -->
		<ul
			class={{ error: disabled, medium: size === 'medium', stacked: size === 'large' || isWrapped }}
			bind:this={listEl}
		>
			{#each display as item, index}
				<li>{item}</li>
				{#if index < display.length - 1 && size !== 'large' && !isWrapped}
					<span class="dot-wrapper"><Dot /></span>
				{/if}
			{/each}
		</ul>
	{/if}
</div>

<style lang="scss">
	div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-grow: 1;
		overflow: hidden;
	}
	ul {
		text-align: left;
		display: flex;
		align-items: center;
		line-height: 1.2;
		font-size: var(--text-sm);
		&:not(.error) {
			color: var(--neutral-fg-mid);
		}
		.dot-wrapper {
			height: 1rem;
			display: flex;
			align-items: center;
		}
	}
	ul.medium {
		padding-top: 0.25rem;
		flex-wrap: wrap;
	}
	ul.stacked {
		padding-top: 0.5rem;
	}
	.stacked {
		flex-direction: column;
		align-items: start;
	}
	span.disabled {
		color: var(--neutral-mid);
	}
	ul:has(li:nth-of-type(2):not(:last-child)) .dot-wrapper {
		display: none;
	}
</style>
