import { describe, expect, it, vi } from 'vitest';
import { retryWithBackoff } from './retryWithBackoff';

describe('retryWithBackoff', () => {
	it('stops at the first success', async () => {
		const attempt = vi.fn(async () => true);
		const sleep = vi.fn(async () => {});
		expect(await retryWithBackoff(attempt, 3, sleep)).toBe(true);
		expect(attempt).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it('retries after 1 s and 2 s, then succeeds', async () => {
		const results = [false, false, true];
		const attempt = vi.fn(async () => results.shift()!);
		const sleep = vi.fn(async () => {});
		expect(await retryWithBackoff(attempt, 3, sleep)).toBe(true);
		expect(attempt).toHaveBeenCalledTimes(3);
		expect(sleep.mock.calls).toEqual([[1000], [2000]]);
	});

	it('gives up after maxAttempts and reports it', async () => {
		const attempt = vi.fn(async () => false);
		const sleep = vi.fn(async () => {});
		expect(await retryWithBackoff(attempt, 3, sleep)).toBe(false);
		expect(attempt).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('a single-attempt refresh does not wait', async () => {
		const sleep = vi.fn(async () => {});
		expect(await retryWithBackoff(async () => false, 1, sleep)).toBe(false);
		expect(sleep).not.toHaveBeenCalled();
	});
});
