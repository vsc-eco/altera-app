/**
 * The failed badge explains itself.
 *
 * Pins the behaviour added so a user no longer has to open a block explorer to
 * learn why a transaction failed:
 *   - only a FAILED status with a contract output becomes interactive
 *   - the reason is fetched on first reveal, not on render
 *   - hover (mouse only) and click both reveal it
 *   - the click never reaches the surrounding row, which opens the detail panel
 *
 * `loadFailureReason` is mocked: the network shape it decodes is pinned
 * separately in tr/failureReason.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

const loadFailureReasonMock = vi.fn();
vi.mock('./tr/failureReason', () => ({
	loadFailureReason: (...args: unknown[]) => loadFailureReasonMock(...args)
}));

const { default: StatusBadge } = await import('./StatusBadge.svelte');
const { default: ClickableRow } = await import('./__fixtures__/ClickableRow.svelte');

const FAILED_TX = {
	id: 'ec8b63df21f35d2ab581b4988e2a6793fd5230fb',
	output: [{ id: 'bafyreidyimmimgs465ws2kuo547t3zi3cfcrz2xfdx5lq6kpv7q7mzuoym', index: [0] }]
};

const LEDGER_ERROR = {
	message: 'insufficient balance',
	code: 'ledger_error',
	hasMessage: true,
	fromSiblingOp: false
};

/** jsdom has no PointerEvent — a MouseEvent carrying `pointerType` is what the
 *  handlers actually read. */
function pointer(type: string, pointerType: 'mouse' | 'touch') {
	const event = new MouseEvent(type, { bubbles: false });
	Object.defineProperty(event, 'pointerType', { value: pointerType });
	return event;
}

function failedBadge() {
	return screen.getByRole('button', { name: /failed/i });
}

beforeEach(() => {
	loadFailureReasonMock.mockResolvedValue(LEDGER_ERROR);
});

describe('StatusBadge', () => {
	it('leaves a non-failed status as a plain, inert badge', () => {
		render(StatusBadge, { status: 'CONFIRMED', tx: FAILED_TX });
		expect(screen.getByText('confirmed').tagName).toBe('SPAN');
	});

	it('leaves a failure with no contract output inert — there is nothing to show', () => {
		render(StatusBadge, { status: 'FAILED', tx: { id: FAILED_TX.id, output: null } });
		expect(screen.getByText('failed').tagName).toBe('SPAN');
		expect(loadFailureReasonMock).not.toHaveBeenCalled();
	});

	it('fetches nothing until the badge is actually opened', async () => {
		render(StatusBadge, { status: 'FAILED', tx: FAILED_TX, opIndex: 1 });
		expect(loadFailureReasonMock).not.toHaveBeenCalled();

		await fireEvent.click(failedBadge());

		await waitFor(() => expect(screen.getByText('insufficient balance')).toBeInTheDocument());
		expect(loadFailureReasonMock).toHaveBeenCalledWith(FAILED_TX.id, FAILED_TX.output, 1);
		// The machine code is worth showing alongside a real message.
		expect(screen.getByText('ledger_error')).toBeInTheDocument();
	});

	it('reveals the reason on mouse hover', async () => {
		render(StatusBadge, { status: 'FAILED', tx: FAILED_TX });
		failedBadge().dispatchEvent(pointer('pointerenter', 'mouse'));
		await waitFor(() => expect(screen.getByText('insufficient balance')).toBeInTheDocument());
	});

	it('ignores a touch "hover" so the tap that follows does not toggle it shut', async () => {
		render(StatusBadge, { status: 'FAILED', tx: FAILED_TX });
		failedBadge().dispatchEvent(pointer('pointerenter', 'touch'));
		await Promise.resolve();
		expect(loadFailureReasonMock).not.toHaveBeenCalled();
	});

	it('keeps its click off the surrounding row, which opens the detail panel', async () => {
		const onRowActivate = vi.fn();
		render(ClickableRow, {
			onRowActivate,
			badge: { status: 'FAILED', tx: FAILED_TX }
		});

		// Control: the rest of the row still opens the detail panel.
		await fireEvent.click(screen.getByTestId('elsewhere-in-row'));
		expect(onRowActivate).toHaveBeenCalledTimes(1);

		await fireEvent.click(failedBadge());
		await waitFor(() => expect(screen.getByText('insufficient balance')).toBeInTheDocument());
		expect(onRowActivate).toHaveBeenCalledTimes(1);
	});

	it('keeps its keyboard activation off the surrounding row', async () => {
		const onRowActivate = vi.fn();
		render(ClickableRow, {
			onRowActivate,
			badge: { status: 'FAILED', tx: FAILED_TX }
		});
		await fireEvent.keyDown(failedBadge(), { key: 'Enter' });
		expect(onRowActivate).not.toHaveBeenCalled();
	});

	it('says so when the chain recorded no message', async () => {
		loadFailureReasonMock.mockResolvedValue(null);
		render(StatusBadge, { status: 'FAILED', tx: FAILED_TX });
		await fireEvent.click(failedBadge());
		await waitFor(() => expect(screen.getByText(/no error message/i)).toBeInTheDocument());
	});

	it('explains an inherited failure rather than blaming this operation', async () => {
		loadFailureReasonMock.mockResolvedValue({ ...LEDGER_ERROR, fromSiblingOp: true });
		render(StatusBadge, { status: 'FAILED', tx: FAILED_TX });
		await fireEvent.click(failedBadge());
		await waitFor(() =>
			expect(screen.getByText(/whole transaction was reverted/i)).toBeInTheDocument()
		);
	});

	it('surfaces a lookup failure instead of spinning forever', async () => {
		loadFailureReasonMock.mockRejectedValue(new Error('node unreachable'));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(StatusBadge, { status: 'FAILED', tx: FAILED_TX });
		await fireEvent.click(failedBadge());
		await waitFor(() => expect(screen.getByText(/couldn't be loaded/i)).toBeInTheDocument());
	});
});
