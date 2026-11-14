/**
 * send() and a flow's onSubmit report failures by returning an Error, but some
 * paths throw. A throw used to leave `waiting` true for good: the "Waiting for
 * signature" overlay stayed up with no message. It must clear and show why.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { SwapTxState } from '$lib/sendswap/utils/txState.svelte';
import { Coin, Network } from '$lib/sendswap/utils/sendOptions';

vi.mock('$lib/auth/store', () => ({
	getAuth: () => () => ({ status: 'authenticated', value: { provider: 'reown', did: 'x' } })
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
const send = vi.fn();
vi.mock('$lib/sendswap/utils/sendUtils', () => ({
	send: (...a: unknown[]) => send(...a),
	getTxSessionId: () => 'session'
}));

const { default: Harness } = await import('$lib/sendswap/testing/StepsMachineHarness.svelte');

function state() {
	const s = new SwapTxState();
	s.from = { coin: Coin.btc, network: Network.btcMainnet };
	s.to = { coin: Coin.hbd, network: Network.hiveMainnet };
	s.fromAmount = '0.0001';
	s.toAmount = '8.643';
	s.toUsername = 'innopay';
	return s;
}

async function submit() {
	await fireEvent.click(screen.getByRole('button', { name: 'go' })); // options -> review
	await fireEvent.click(screen.getByRole('button', { name: 'go' })); // review -> submit
}

describe('StepsMachine: a send that throws', () => {
	it('clears the waiting overlay and shows the error (send())', async () => {
		send.mockRejectedValueOnce(
			new Error('VSC does not currently support going from BTC Mainnet to Hive Mainnet')
		);
		render(Harness, { txState: state() });
		await submit();
		await waitFor(() => expect(screen.getByTestId('waiting').textContent).toBe('idle'));
		expect(send).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('status').textContent).toBe(
			'VSC does not currently support going from BTC Mainnet to Hive Mainnet'
		);
	});

	it('clears the waiting overlay and shows the error (onSubmit)', async () => {
		const onSubmit = vi.fn().mockRejectedValue(new Error('wallet went away'));
		render(Harness, { txState: state(), onSubmit });
		await submit();
		await waitFor(() => expect(screen.getByTestId('waiting').textContent).toBe('idle'));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId('status').textContent).toBe('wallet went away');
	});

	it('still waits while a send is pending, then records the tx', async () => {
		let resolve!: (v: { id: string }) => void;
		send.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
		render(Harness, { txState: state() });
		await submit();
		expect(screen.getByTestId('waiting').textContent).toBe('waiting');
		resolve({ id: 'tx1' });
		await waitFor(() => expect(screen.getByTestId('waiting').textContent).toBe('idle'));
	});
});
