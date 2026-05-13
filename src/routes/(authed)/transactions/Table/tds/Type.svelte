<script lang="ts">
	let { direction, t }: { direction: 'incoming' | 'outgoing' | 'swap' | 'contract' | 'add-liquidity' | 'remove-liquidity'; t: string } = $props();

	const badgeClass = $derived.by(() => {
		if (direction === 'incoming') return 'deposit';
		if (direction === 'swap') return 'swap';
		if (direction === 'add-liquidity') return 'liquidity';
		if (direction === 'remove-liquidity') return 'liquidity';
		if (t.includes('withdraw')) return 'withdraw';
		if (t.includes('stake')) return 'stake';
		if (t.includes('reward')) return 'reward';
		return 'default';
	});
</script>

<td class="type-cell">
	<span class={['badge', badgeClass]}>
		{t.replaceAll('_', ' ')}
	</span>
</td>

<style>
	.type-cell {
		justify-content: center;
	}
	.badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 2rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.1);
		color: var(--dash-text-primary);
		white-space: nowrap;
	}
	.badge.withdraw {
		background: var(--dash-badge-withdraw-bg);
		color: var(--dash-badge-withdraw-text);
	}
	.badge.swap {
		background: rgba(111, 106, 248, 0.15);
		color: #6f6af8;
	}
	.badge.deposit {
		background: var(--dash-badge-green-bg);
		color: var(--dash-badge-green-text);
	}
	.badge.stake {
		background: rgba(111, 106, 248, 0.15);
		color: #6f6af8;
	}
	.badge.liquidity {
		background: rgba(59, 186, 220, 0.15);
		color: #3bbad4;
	}
	.badge.reward {
		background: var(--dash-badge-green-bg);
		color: var(--dash-badge-green-text);
	}
</style>
