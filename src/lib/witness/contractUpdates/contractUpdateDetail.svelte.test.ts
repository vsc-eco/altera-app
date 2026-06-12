/**
 * Tier-B component test for the contract-update detail page.
 *
 * Lives next to the witness lib (not under src/routes) because vitest
 * doesn't traverse SvelteKit route directories the same way the runtime
 * does. We import the page component directly via its file path.
 *
 * Mocks:
 *   - `$lib/witness/contractUpdates/loader.loadUpdateById` — feeds
 *     deterministic LoadResult.update into the page's $effect
 *   - `$app/state.page` — supplies `page.params.id` to drive routing
 *     without spinning a real router
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';

// ─── Mocks ────────────────────────────────────────────────────────────────

// `loadUpdateById` is what the page calls inside its $effect.
const loadUpdateByIdMock = vi.fn();
vi.mock('$lib/witness/contractUpdates/loader', () => ({
	loadPendingUpdates: vi.fn(),
	loadUpdateById: (id: string) => loadUpdateByIdMock(id)
}));

// `page.params.id` drives which update gets requested. Make it a getter
// so tests can change `currentId` between renders.
let currentId = '';
vi.mock('$app/state', () => ({
	page: {
		get params() {
			return { id: currentId };
		},
		url: { pathname: '' },
		route: { id: null },
		status: 200,
		error: null,
		data: {},
		state: {},
		form: undefined
	}
}));

// Import the page component AFTER mocks are registered.
const { default: ContractUpdateDetailPage } =
	await import('../../../routes/(authed)/witness-assistant/contract-update/[id]/+page.svelte');

// ─── Fixtures ─────────────────────────────────────────────────────────────

function knownUpdateView(
	overrides: Partial<{
		id: string;
		code: string;
		proposer: string;
		owner: string;
		activation_ts: string;
		previousCode: string;
		metadata: {
			name: string;
			category: 'pool' | 'bridge' | 'gateway' | 'oracle' | 'governance' | 'other';
			description?: string;
		};
	}> = {}
) {
	return {
		id: 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp',
		code: 'bafkreiNEWcodecid12345HiveHbdPoolUpgrade',
		proposer: 'vaultec',
		owner: 'hive:vsc.dao',
		creation_height: 107_500_000,
		activation_height: 107_672_800,
		activation_ts: '2030-01-01T00:00:00',
		metadata: {
			name: 'Pool: HIVE / HBD',
			category: 'pool' as const,
			description: 'Liquidity pool for HIVE ↔ HBD swaps.'
		},
		previousCode: 'bafkreiOLDcodecidPreviousHiveHbdPool99',
		...overrides
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
	loadUpdateByIdMock.mockReset();
	currentId = '';
});

describe('Contract update detail page — render contract', () => {
	it('shows the loading spinner before the fetch resolves', () => {
		currentId = 'vsc1Anything';
		loadUpdateByIdMock.mockReturnValue(new Promise(() => {})); // hang forever
		render(ContractUpdateDetailPage);
		expect(screen.getByText(/loading update details/i)).toBeInTheDocument();
	});

	it('shows the not-found state when the loader returns undefined', async () => {
		currentId = 'vsc1NonExistentId';
		loadUpdateByIdMock.mockResolvedValue(undefined);
		render(ContractUpdateDetailPage);
		await waitFor(() => {
			expect(screen.getByText(/no pending update/i)).toBeInTheDocument();
		});
		// The unknown id surfaces in the body so the user can confirm what they navigated to.
		expect(screen.getByText('vsc1NonExistentId')).toBeInTheDocument();
	});

	it('renders the full update card when a known update is found', async () => {
		const update = knownUpdateView();
		currentId = update.id;
		loadUpdateByIdMock.mockResolvedValue(update);
		render(ContractUpdateDetailPage);

		await waitFor(() => {
			// Title uses metadata.name; "Upgrade · Pool: HIVE / HBD"
			expect(screen.getByText(/Upgrade · Pool: HIVE \/ HBD/i)).toBeInTheDocument();
		});

		// Description from registry shows up as the lead line.
		expect(screen.getByText(/Liquidity pool for HIVE/i)).toBeInTheDocument();

		// Meta fields rendered in the dl: proposer, owner, contract id.
		expect(screen.getByText('vaultec')).toBeInTheDocument();
		expect(screen.getByText('hive:vsc.dao')).toBeInTheDocument();
		expect(screen.getByText(update.id)).toBeInTheDocument();

		// Block heights formatted with thousands separators.
		// Creation height appears exactly once (in the meta dl).
		expect(screen.getByText(/block #107,500,000/i)).toBeInTheDocument();
		// Activation height shows up twice: once in the meta dl ("Activates at")
		// and once in the countdown-box as the under-label. Both are intended;
		// assert the count rather than uniqueness.
		expect(screen.getAllByText(/block #107,672,800/i)).toHaveLength(2);
	});

	it('links proposer to hivehub', async () => {
		const update = knownUpdateView();
		currentId = update.id;
		loadUpdateByIdMock.mockResolvedValue(update);
		render(ContractUpdateDetailPage);

		const link = await waitFor(() => screen.getByRole('link', { name: /view on hivehub/i }));
		expect(link).toHaveAttribute('href', 'https://hivehub.dev/@vaultec');
	});

	it('renders IPFS links for new code (and previous code when present)', async () => {
		const update = knownUpdateView();
		currentId = update.id;
		loadUpdateByIdMock.mockResolvedValue(update);
		render(ContractUpdateDetailPage);

		await waitFor(() => {
			// New-code section: short label + full CID rendered for verification.
			expect(screen.getByText(update.code)).toBeInTheDocument();
		});
		expect(screen.getByText(update.previousCode!)).toBeInTheDocument();

		// Both IPFS links present.
		const ipfsLinks = screen
			.getAllByRole('link')
			.filter((el) => el.getAttribute('href')?.startsWith('https://ipfs.io/ipfs/'));
		expect(ipfsLinks).toHaveLength(2);
		expect(ipfsLinks[0]).toHaveAttribute('href', `https://ipfs.io/ipfs/${update.code}`);
		expect(ipfsLinks[1]).toHaveAttribute('href', `https://ipfs.io/ipfs/${update.previousCode}`);
	});

	it('renders the diff link when both previous and new code CIDs are known', async () => {
		const update = knownUpdateView();
		currentId = update.id;
		loadUpdateByIdMock.mockResolvedValue(update);
		render(ContractUpdateDetailPage);

		const diffLink = await waitFor(() => screen.getByRole('link', { name: /compare cids/i }));
		// codeDiffSearchUrl encodes the two CIDs into a google search query
		// (placeholder until a real WASM diff tool exists).
		expect(diffLink.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/search/);
		expect(diffLink.getAttribute('href')).toContain(encodeURIComponent(update.code));
		expect(diffLink.getAttribute('href')).toContain(encodeURIComponent(update.previousCode!));
	});

	it('shows the "previous code not yet joined" hint when previousCode is absent', async () => {
		const update = knownUpdateView({ previousCode: undefined as never });
		// Drop the previousCode in a way the type cooperates with:
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (update as any).previousCode;
		currentId = update.id;
		loadUpdateByIdMock.mockResolvedValue(update);
		render(ContractUpdateDetailPage);

		await waitFor(() => {
			expect(screen.getByText(/Upgrade · Pool: HIVE \/ HBD/i)).toBeInTheDocument();
		});

		// New-code link still rendered.
		expect(screen.getByText(update.code)).toBeInTheDocument();
		// Hint about findContract(byId) join — explains why diff is unavailable.
		expect(screen.getByText(/findContract\(byId\)/i)).toBeInTheDocument();
		// And no diff link.
		expect(screen.queryByRole('link', { name: /compare cids/i })).not.toBeInTheDocument();
	});

	it('falls back to a truncated id heading when the contract is not in the registry', async () => {
		const update = knownUpdateView({ id: 'vsc1Unknown1234567890Whatever' });
		update.metadata = undefined as never;
		currentId = update.id;
		loadUpdateByIdMock.mockResolvedValue(update);
		render(ContractUpdateDetailPage);

		await waitFor(() => {
			// Heading synthesizes from a short id prefix when metadata is missing.
			// The h2 splits "Upgrade · " (static) from `contract <id-prefix>…`
			// (interpolated) across text nodes, so we match the whole heading
			// via textContent instead of getByText.
			const h2 = document.querySelector('h2');
			// id.slice(0, 12) of "vsc1Unknown1234567890Whatever" = "vsc1Unknown1"
			expect(h2?.textContent).toMatch(/Upgrade · contract vsc1Unknown1…/);
		});
		// Fallback "no registry entry" lead line.
		expect(screen.getByText(/No registry entry/i)).toBeInTheDocument();
	});
});
