<script lang="ts">
	let { direction, t }: { direction: 'incoming' | 'outgoing' | 'swap' | 'contract'; t: string } = $props();
</script>

<td>
	<span class={['badge', direction === 'incoming'
			? 'deposit'
			: direction === 'swap'
				? 'swap'
				: t.includes('withdraw')
					? 'withdraw'
					: t.includes('stake')
						? 'stake'
						: t.includes('reward')
							? 'reward'
							: 'default']}>
		{t.replaceAll('_', ' ')}
	</span>
</td>

<style>
	.badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 2rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.1);
		color: var(--dash-text-primary);
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
	.badge.reward {
		background: var(--dash-badge-green-bg);
		color: var(--dash-badge-green-text);
	}
</style>
