/**
 * Tests for isValidAmountString.
 *
 * Tiny helper but used in tx-completion gates (e.g. KeepsatsWithdraw): a wrong
 * result either blocks valid transactions or lets through ones with NaN /
 * negative / zero amounts. Pin the behavior so future "clever" rewrites can't
 * silently regress.
 */

import { describe, it, expect } from 'vitest';
import { isValidAmountString } from './CoinAmount';

describe('isValidAmountString', () => {
	it('rejects empty / nullish input', () => {
		expect(isValidAmountString('')).toBe(false);
		expect(isValidAmountString(undefined)).toBe(false);
		expect(isValidAmountString(null)).toBe(false);
	});

	it("rejects the string '0' (the txState fromAmount default)", () => {
		expect(isValidAmountString('0')).toBe(false);
	});

	it('rejects negative amounts', () => {
		expect(isValidAmountString('-1')).toBe(false);
		expect(isValidAmountString('-0.5')).toBe(false);
	});

	it('rejects non-numeric strings', () => {
		expect(isValidAmountString('abc')).toBe(false);
		expect(isValidAmountString('NaN')).toBe(false);
		expect(isValidAmountString('1.2.3')).toBe(false);
	});

	it('rejects Infinity', () => {
		expect(isValidAmountString('Infinity')).toBe(false);
		expect(isValidAmountString('-Infinity')).toBe(false);
	});

	it('accepts a small positive amount', () => {
		expect(isValidAmountString('0.0001')).toBe(true);
	});

	it('accepts plain positive integers and decimals', () => {
		expect(isValidAmountString('1')).toBe(true);
		expect(isValidAmountString('1.23')).toBe(true);
		expect(isValidAmountString('1000000')).toBe(true);
	});

	it('accepts strings with surrounding whitespace (Number() trims)', () => {
		// Pin the implementation choice: Number(' 1 ') === 1. If we ever want to
		// reject whitespace explicitly, this test will catch the change.
		expect(isValidAmountString(' 1 ')).toBe(true);
	});

	it("accepts scientific notation (Number('1e-3') is finite)", () => {
		expect(isValidAmountString('1e-3')).toBe(true);
	});
});
