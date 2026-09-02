/**
 * Render contract for the bell.
 *
 * The feed's classification is pinned by notificationFeed(.Sources).test.ts;
 * this pins what a user actually reads in the popover for each kind — the
 * three sources render very differently and share one list, so a template slip
 * (a missing branch, an "@undefined" counterparty) would otherwise ship
 * silently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { upsertNotification, type Notification } from './notifications';

// The poll is exercised by notificationFeed.test.ts; here it must not fire.
vi.mock('./notificationFeed', () => ({
	syncNotificationFeed: vi.fn().mockResolvedValue({ ok: true, added: 0 })
}));
vi.mock('$lib/auth/store', () => ({
	getAuth: () => () => ({
		status: 'authenticated',
		value: { did: 'hive:tibfox', username: 'tibfox' }
	})
}));
vi.mock('$lib/stores/currentBalance', () => ({
	accountBalance: readable({ bal: { hive_consensus: 0 }, connectedBal: undefined })
}));

const { default: Notifications } = await import('./Notifications.svelte');

/** `count` tx rows, newest first, labelled "row NN" via the counterparty. */
function manyRows(count: number): Record<string, Notification> {
	const rows: Record<string, Notification> = {};
	for (let i = 0; i < count; i++) {
		rows[`tx-${String(i).padStart(2, '0')}`] = {
			kind: 'tx',
			type: 'transfer',
			status: 'CONFIRMED',
			to: `hive:row ${String(i).padStart(2, '0')}`,
			opIndex: 0,
			// Descending timestamps, so "row 00" sorts first.
			timestamp: new Date(Date.parse('2026-09-01T12:00:00Z') - i * 3600_000).toISOString(),
			read: true
		};
	}
	return rows;
}

function seed(rows: Record<string, Notification>) {
	localStorage.setItem('notifications', JSON.stringify(Object.entries(rows)));
}

beforeEach(() => {
	localStorage.clear();
});

describe('Notifications bell', () => {
	it('shows the empty state with nothing stored', async () => {
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/no notifications currently/i)).toBeTruthy());
	});

	it('renders a pending contract update with its countdown and audit link', async () => {
		seed({
			'contract-update:vsc1Boania:bafkreinew': {
				kind: 'contract-update',
				contractId: 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp',
				name: 'Pool: HIVE / HBD',
				proposer: 'hive:vsc.dao',
				code: 'bafkreinew',
				activationHeight: 107_786_367,
				activationTs: '2030-01-01T00:00:00Z', // far future — reads as "in N years"
				state: 'pending',
				timestamp: '2026-09-01T12:00:00Z',
				read: false
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/Pool: HIVE \/ HBD/)).toBeTruthy());
		expect(screen.getByText(/activates in/i)).toBeTruthy();
		const link = screen.getByRole('link', { name: /Pool: HIVE \/ HBD/, hidden: true });
		expect(link.getAttribute('href')).toBe(
			'/witness-assistant/contract-update/vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp'
		);
	});

	it('renders an already-activated update as gone live, not as pending', async () => {
		seed({
			'contract-update:vsc1Brvi:bafkreiold': {
				kind: 'contract-update',
				contractId: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45',
				name: 'DEX Router',
				proposer: 'hive:vsc.dao',
				code: 'bafkreiold',
				activationHeight: 107_786_367,
				activationTs: '2026-07-03T15:54:54Z',
				state: 'activated',
				timestamp: '2026-07-03T15:54:54Z',
				read: true
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/DEX Router/)).toBeTruthy());
		expect(screen.getByText(/went live at block/i)).toBeTruthy();
		expect(screen.queryByText(/activates in/i)).toBeNull();
	});

	it('flags an open governance proposal that still needs your vote', async () => {
		seed({
			'governance:reserve_payout:abc': {
				kind: 'governance',
				proposalId: 'reserve_payout:abc',
				proposalType: 'reserve_payout',
				status: 'open',
				subject: 'emrebeyler.vsc',
				amount: 200_000,
				voted: false,
				timestamp: '2026-09-01T11:00:00Z',
				read: false
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/Reserve payout/)).toBeTruthy());
		expect(screen.getByText(/needs your vote/i)).toBeTruthy();
		expect(
			screen.getByRole('link', { name: /Reserve payout/, hidden: true }).getAttribute('href')
		).toBe('/witness-assistant');
	});

	it('says so when you already voted', async () => {
		seed({
			'governance:reserve_payout:abc': {
				kind: 'governance',
				proposalId: 'reserve_payout:abc',
				proposalType: 'reserve_payout',
				status: 'open',
				subject: 'emrebeyler.vsc',
				amount: 200_000,
				voted: true,
				timestamp: '2026-09-01T11:00:00Z',
				read: true
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/you voted/i)).toBeTruthy());
	});

	it('renders a transaction with its counterparty and status', async () => {
		seed({
			'tx-abc': {
				kind: 'tx',
				type: 'transfer',
				status: 'FAILED',
				to: 'hive:milo',
				timestamp: '2026-09-01T11:30:00Z',
				read: false
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/@milo/)).toBeTruthy());
		expect(screen.getByText(/failed/i)).toBeTruthy();
	});

	it('links a transaction to its exact row on the transactions page', async () => {
		seed({
			abc123: {
				kind: 'tx',
				type: 'transfer',
				status: 'CONFIRMED',
				to: 'hive:milo',
				opIndex: 2,
				amount: 1000,
				asset: 'hbd',
				timestamp: '2026-09-01T11:30:00Z',
				read: false
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/@milo/)).toBeTruthy());
		expect(
			screen.getByRole('link', { name: /Transfer to/, hidden: true }).getAttribute('href')
		).toBe('/transactions?tx=abc123&index=2');
		// Settled amount, signed by direction.
		expect(screen.getByText(/−1\.000/)).toBeTruthy();
	});

	it('reads a contract counterparty as a contract, not an @account', async () => {
		seed({
			'lottery-tx': {
				kind: 'tx',
				type: 'call',
				status: 'CONFIRMED',
				from: 'contract:vsc1BiM4NC1yeGPCjmq8FC3utX8dByizjcCBk7',
				opIndex: 0,
				amount: 6080,
				asset: 'hive',
				timestamp: '2026-09-01T11:30:00Z',
				read: false
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/Call from/)).toBeTruthy());
		expect(screen.getByText(/contract vsc1Bi/)).toBeTruthy();
		expect(screen.queryByText(/@vsc1Bi/)).toBeNull();
		expect(screen.getByText(/\+6\.080/)).toBeTruthy();
	});

	it('falls back to index 0 for legacy rows with no opIndex', async () => {
		seed({
			'legacy-tx': {
				type: 'transfer',
				status: 'CONFIRMED',
				from: 'hive:milo',
				timestamp: '2026-09-01T10:00:00Z',
				read: false
			} as Notification
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/@milo/)).toBeTruthy());
		expect(
			screen.getByRole('link', { name: /Transfer from/, hidden: true }).getAttribute('href')
		).toBe('/transactions?tx=legacy-tx&index=0');
	});

	it('omits the counterparty clause for ops that have none', async () => {
		seed({
			'tx-def': {
				kind: 'tx',
				type: 'call',
				status: 'CONFIRMED',
				to: '',
				timestamp: '2026-09-01T11:30:00Z',
				read: false
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/Call/)).toBeTruthy());
		expect(screen.queryByText(/@undefined|@$/)).toBeNull();
	});

	it('keeps rows unread until the bell is actually opened', async () => {
		// A page load must not silently consume the unread state — that is the
		// whole point of surfacing an update you were away for.
		seed({
			'contract-update:vsc1Boania:bafkreinew': {
				kind: 'contract-update',
				contractId: 'vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp',
				name: 'Pool: HIVE / HBD',
				proposer: 'hive:vsc.dao',
				code: 'bafkreinew',
				activationHeight: 107_786_367,
				activationTs: '2030-01-01T00:00:00Z',
				state: 'pending',
				timestamp: '2026-09-01T12:00:00Z',
				read: false
			}
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/Pool: HIVE \/ HBD/)).toBeTruthy());
		// The popover content is portalled to <body>, not the render container.
		expect(document.querySelector('.notif-dot.filled')).not.toBeNull();
		const stored = JSON.parse(localStorage.getItem('notifications')!) as [string, Notification][];
		expect(stored[0][1].read).toBe(false);
	});

	it('clears the unread badge for EVERY row once the panel is closed', async () => {
		// Regression: only the first page of rows used to be marked read, so a
		// feed of a dozen notifications left the bell's dot permanently lit.
		const rows: Record<string, Notification> = {};
		for (let i = 0; i < 12; i++) {
			rows[`tx-${i}`] = {
				kind: 'tx',
				type: 'transfer',
				status: 'CONFIRMED',
				to: 'hive:milo',
				opIndex: 0,
				// Descending timestamps so the ordering is deterministic.
				timestamp: `2026-09-01T${String(12 - i).padStart(2, '0')}:00:00Z`,
				read: false
			};
		}
		seed(rows);
		render(Notifications);
		await waitFor(() =>
			expect(document.querySelectorAll('.notif-dot.filled').length).toBeGreaterThan(0)
		);

		// Open the panel, then close it.
		const bell = screen.getByRole('button', { name: /notification/i });
		await fireEvent.click(bell);
		await waitFor(() => expect(document.querySelector('[data-state="open"]')).not.toBeNull());
		await fireEvent.click(bell);

		await waitFor(() => {
			const stored = JSON.parse(localStorage.getItem('notifications')!) as [string, Notification][];
			expect(stored).toHaveLength(12);
			expect(stored.every(([, n]) => n.read)).toBe(true);
		});
		expect(document.querySelector('.unread.trigger')).toBeNull();
	});

	it('re-lights the badge when something new arrives after it was cleared', async () => {
		// The other half of the contract: clearing on close must not make the
		// badge useless — a row the feed adds later has to light it again.
		seed({
			'tx-old': {
				kind: 'tx',
				type: 'transfer',
				status: 'CONFIRMED',
				to: 'hive:milo',
				opIndex: 0,
				timestamp: '2026-09-01T10:00:00Z',
				read: false
			}
		});
		render(Notifications);
		const bell = screen.getByRole('button', { name: /notification/i });
		await waitFor(() => expect(screen.getByText(/@milo/)).toBeTruthy());
		await fireEvent.click(bell);
		await fireEvent.click(bell);
		await waitFor(() => expect(document.querySelector('.unread.trigger')).toBeNull());

		upsertNotification('tx-new', {
			kind: 'tx',
			type: 'transfer',
			status: 'FAILED',
			to: 'hive:someone',
			opIndex: 0,
			timestamp: '2026-09-01T11:00:00Z',
			read: false
		});
		await waitFor(() => expect(document.querySelector('.unread.trigger')).not.toBeNull());
	});

	it('opens as a 5-row peek, then pages 10 at a time with pagers above and below', async () => {
		seed(manyRows(24));
		render(Notifications);
		const bell = screen.getByRole('button', { name: /notification/i });
		await fireEvent.click(bell);

		// Peek: 5 rows, no pager, a "Show more" affordance.
		await waitFor(() => expect(document.querySelectorAll('.notif').length).toBe(5));
		expect(document.querySelectorAll('nav.pager')).toHaveLength(0);

		await fireEvent.click(screen.getByText(/show more/i));

		// Paged: 10 per page, and the pager is rendered twice — above and below.
		await waitFor(() => expect(document.querySelectorAll('.notif').length).toBe(10));
		expect(document.querySelectorAll('nav.pager')).toHaveLength(2);
		expect(screen.queryByText(/show more/i)).toBeNull();
		// 24 rows / 10 per page = 3 pages.
		expect(document.querySelectorAll('nav.pager')[0].querySelectorAll('.page-num')).toHaveLength(3);

		// Page 1 holds the newest rows; page 3 the oldest remainder.
		expect(screen.getAllByText(/row 00/)).not.toHaveLength(0);
		const lastPage = document.querySelectorAll('nav.pager')[0].querySelectorAll('.page-num')[2];
		await fireEvent.click(lastPage);
		await waitFor(() => expect(document.querySelectorAll('.notif').length).toBe(4));
		expect(screen.getAllByText(/row 23/)).not.toHaveLength(0);
		expect(screen.queryByText(/row 00/)).toBeNull();
	});

	it('disables the step arrows at the ends of the range', async () => {
		seed(manyRows(24));
		render(Notifications);
		await fireEvent.click(screen.getByRole('button', { name: /notification/i }));
		await fireEvent.click(await screen.findByText(/show more/i));

		const step = (name: RegExp) =>
			screen.getAllByRole('button', { name, hidden: true })[0] as HTMLButtonElement;
		const prev = () => step(/previous page/i);
		const next = () => step(/next page/i);

		await waitFor(() => expect(prev().disabled).toBe(true));
		expect(next().disabled).toBe(false);

		await fireEvent.click(next());
		await waitFor(() => expect(prev().disabled).toBe(false));
		await fireEvent.click(next());
		await waitFor(() => expect(next().disabled).toBe(true));
	});

	it('reopening the panel returns to the peek rather than the last page', async () => {
		seed(manyRows(24));
		render(Notifications);
		const bell = screen.getByRole('button', { name: /notification/i });
		await fireEvent.click(bell);
		await fireEvent.click(await screen.findByText(/show more/i));
		await waitFor(() => expect(document.querySelectorAll('.notif').length).toBe(10));

		await fireEvent.click(bell); // close
		await fireEvent.click(bell); // reopen
		await waitFor(() => expect(document.querySelectorAll('.notif').length).toBe(5));
		expect(document.querySelectorAll('nav.pager')).toHaveLength(0);
	});

	it('does not strand you on an empty page after deleting the final row', async () => {
		// 21 rows = 3 pages, the last holding a single row. Deleting it must fall
		// back to a real page rather than rendering an empty one.
		seed(manyRows(21));
		render(Notifications);
		await fireEvent.click(screen.getByRole('button', { name: /notification/i }));
		await fireEvent.click(await screen.findByText(/show more/i));
		const lastPage = () =>
			document.querySelectorAll('nav.pager')[0].querySelectorAll('.page-num')[2] as HTMLElement;
		await waitFor(() => expect(lastPage()).toBeTruthy());
		await fireEvent.click(lastPage());
		await waitFor(() => expect(document.querySelectorAll('.notif').length).toBe(1));

		// Delete that row via its own trash button.
		await fireEvent.click(document.querySelector('.notif-delete button') as HTMLElement);

		await waitFor(() => {
			// Now 20 rows = 2 pages, and we land on a page with content.
			expect(document.querySelectorAll('nav.pager')[0].querySelectorAll('.page-num')).toHaveLength(
				2
			);
			expect(document.querySelectorAll('.notif').length).toBe(10);
		});
	});

	it('still renders legacy rows stored before the feed existed (no kind field)', async () => {
		seed({
			'tx-legacy': {
				type: 'transfer',
				status: 'CONFIRMED',
				from: 'hive:milo',
				timestamp: '2026-09-01T10:00:00Z',
				read: false
			} as Notification
		});
		render(Notifications);
		await waitFor(() => expect(screen.getByText(/from/i)).toBeTruthy());
		expect(screen.getByText(/@milo/)).toBeTruthy();
	});
});
