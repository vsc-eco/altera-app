/**
 * Tier-B component test for ContractUpdatesSection.
 *
 * Mocks `loadPendingUpdates` so we feed deterministic LoadResults into
 * the Section and assert what the user actually sees:
 *   - loading spinner before the fetch resolves
 *   - MOCK DATA badge when the loader returned source='mock'
 *   - no badge when source='live'
 *   - empty state on live + empty
 *   - rows render with title, proposer, owner, block heights
 *   - row links to /witness-assistant/contract-update/[contractId]
 *
 * The Section consumes the same shape PR #210 will produce, joined with
 * client-side metadata. Loader tests pin the wire shape; this test pins
 * the rendering contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';

// Mock the loader BEFORE the component imports it, so the $effect picks
// up the stub rather than the real fetch-based implementation.
const loadPendingUpdatesMock = vi.fn();
vi.mock('./loader', () => ({
	loadPendingUpdates: () => loadPendingUpdatesMock(),
	loadUpdateById: vi.fn()
}));

// Import after the mock is in place.
const { default: ContractUpdatesSection } = await import('./ContractUpdatesSection.svelte');

// Build a fixture matching PR #210's wire shape + the client enrichment.
function knownUpdateView(overrides: Partial<{ id: string; activation_ts: string }> = {}) {
	return {
		id: 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp', // HIVE/HBD pool in CONTRACT_REGISTRY
		code: 'bafkreiHiveHbdNewCidLive',
		proposer: 'vaultec',
		owner: 'hive:vsc.dao',
		creation_height: 107_500_000,
		activation_height: 107_672_800,
		activation_ts: '2030-01-01T00:00:00', // far future — countdown stays positive
		metadata: {
			name: 'Pool: HIVE / HBD',
			category: 'pool' as const,
			description: 'Liquidity pool for HIVE ↔ HBD swaps.'
		},
		...overrides
	};
}

beforeEach(() => {
	loadPendingUpdatesMock.mockReset();
});

describe('ContractUpdatesSection — render contract', () => {
	it('shows the loading spinner before the fetch resolves', () => {
		// Loader hangs forever — we should see the loading state.
		loadPendingUpdatesMock.mockReturnValue(new Promise(() => {}));
		render(ContractUpdatesSection);
		expect(screen.getByText(/loading pending updates/i)).toBeInTheDocument();
	});

	it('renders the MOCK DATA badge when loader returns source=mock', async () => {
		loadPendingUpdatesMock.mockResolvedValue({
			source: 'mock',
			reason: 'Cannot query field "findPendingContractUpdates"',
			updates: [knownUpdateView()]
		});
		render(ContractUpdatesSection);
		await waitFor(() => {
			expect(screen.getByText(/mock data/i)).toBeInTheDocument();
		});
	});

	it('hides the MOCK DATA badge when loader returns source=live', async () => {
		loadPendingUpdatesMock.mockResolvedValue({
			source: 'live',
			updates: [knownUpdateView()]
		});
		render(ContractUpdatesSection);
		// Wait for content to settle before asserting absence.
		await waitFor(() => {
			expect(screen.getByText(/Pool: HIVE \/ HBD/i)).toBeInTheDocument();
		});
		expect(screen.queryByText(/mock data/i)).not.toBeInTheDocument();
	});

	it('shows the empty state when live + no pending updates', async () => {
		loadPendingUpdatesMock.mockResolvedValue({
			source: 'live',
			updates: []
		});
		render(ContractUpdatesSection);
		await waitFor(() => {
			expect(screen.getByText(/no pending contract updates/i)).toBeInTheDocument();
		});
		expect(screen.queryByText(/mock data/i)).not.toBeInTheDocument();
	});

	it('renders a row with title, proposer, owner, and block height for a known contract', async () => {
		loadPendingUpdatesMock.mockResolvedValue({
			source: 'live',
			updates: [knownUpdateView()]
		});
		render(ContractUpdatesSection);
		await waitFor(() => {
			// Title uses registry name: "Upgrade · Pool: HIVE / HBD"
			expect(screen.getByText(/Upgrade · Pool: HIVE \/ HBD/i)).toBeInTheDocument();
		});
		// Proposer name visible in row meta.
		expect(screen.getByText(/vaultec/)).toBeInTheDocument();
		// Owner rendered in monospace inline.
		expect(screen.getByText(/hive:vsc.dao/)).toBeInTheDocument();
		// Creation block height with thousands separators.
		expect(screen.getByText(/107,500,000/)).toBeInTheDocument();
	});

	it('falls back to a truncated id when the contract is not in the registry', async () => {
		const unknown = knownUpdateView({
			id: 'vsc1UnknownContractXyz'
		});
		unknown.metadata = undefined as never; // unknown contract: no enrichment
		loadPendingUpdatesMock.mockResolvedValue({
			source: 'live',
			updates: [unknown]
		});
		render(ContractUpdatesSection);
		await waitFor(() => {
			// Section's titleFor() helper synthesizes a short-id label when
			// metadata is absent.
			expect(screen.getByText(/Upgrade · contract vsc1Unk/i)).toBeInTheDocument();
		});
	});

	it('links each row to /witness-assistant/contract-update/[contractId]', async () => {
		loadPendingUpdatesMock.mockResolvedValue({
			source: 'live',
			updates: [knownUpdateView()]
		});
		render(ContractUpdatesSection);
		const link = await waitFor(() => {
			const el = screen.getByRole('link', { name: /Upgrade · Pool: HIVE \/ HBD/i });
			expect(el).toBeInTheDocument();
			return el;
		});
		expect(link).toHaveAttribute(
			'href',
			'/witness-assistant/contract-update/vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp'
		);
	});
});
