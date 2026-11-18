/**
 * The fee panel's no-quote states.
 *
 * Loading and failing used to share one amber box and the warning triangle, so
 * a moment's wait looked like an error (section 5). They are now separate, and
 * only the failure is styled as a warning.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SwapFees from './SwapFees.svelte';

const base = { slippageBps: 50, priceImpactPct: 0, hasQuote: false };

describe('SwapFees pool status', () => {
	it('renders loading as a neutral line, not a warning', () => {
		const { container } = render(SwapFees, { ...base, poolLoadingRetry: true });
		expect(screen.getByText('Loading pool data…')).toBeTruthy();
		expect(container.querySelector('.pool-loading')).toBeTruthy();
		expect(container.querySelector('.pool-warning')).toBeNull();
		// No retry button while it is still trying.
		expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
	});

	it('renders a failure as a warning, with a way out', () => {
		const onRetry = vi.fn();
		const { container } = render(SwapFees, { ...base, poolLoadFailed: true, onRetry });
		expect(screen.getByText('Unable to load pool data.')).toBeTruthy();
		expect(container.querySelector('.pool-warning')).toBeTruthy();
		expect(container.querySelector('.pool-loading')).toBeNull();
		expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
	});

	it('shows neither once a quote exists', () => {
		const { container } = render(SwapFees, { ...base, hasQuote: true });
		expect(container.querySelector('.pool-loading')).toBeNull();
		expect(container.querySelector('.pool-warning')).toBeNull();
	});
});
