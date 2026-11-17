import { describe, expect, it } from 'vitest';
import { recipientHint, validateRecipient } from './recipientValidation';

const HIVE = 'tibfox';
const EVM = '0x1111111111111111111111111111111111111111';
const BTC = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

describe('validateRecipient', () => {
	it('asks for something rather than failing silently when empty', () => {
		const r = validateRecipient('', 'btc');
		expect(r.ok).toBe(false);
		expect(!r.ok && r.reason).toContain('Bitcoin address');
	});

	describe('Bitcoin target', () => {
		it('accepts a mainnet address', () => {
			expect(validateRecipient(BTC, 'btc').ok).toBe(true);
		});
		/** The only case the card used to check — and only this one. */
		it('rejects a Hive name', () => {
			expect(validateRecipient(HIVE, 'btc').ok).toBe(false);
		});
		it('rejects a mainnet address when the app is on testnet', () => {
			expect(validateRecipient(BTC, 'btc', { testnet: true }).ok).toBe(false);
		});
	});

	describe('Hive target', () => {
		it('accepts a username, with or without decoration', () => {
			expect(validateRecipient(HIVE, 'hive').ok).toBe(true);
			expect(validateRecipient('@' + HIVE, 'hive').ok).toBe(true);
			expect(validateRecipient('hive:' + HIVE, 'hive').ok).toBe(true);
		});
		it('accepts a dotted account', () => {
			expect(validateRecipient('tibfox.vsc', 'hive').ok).toBe(true);
		});
		/** Used to accept any non-empty string; a malformed name reverts the
		 *  whole router transaction on chain and burns the RC. */
		it('rejects what Hive cannot be', () => {
			for (const bad of ['x', 'UPPERCASE', 'has space', '-leading', BTC, EVM]) {
				expect(validateRecipient(bad, 'hive').ok).toBe(false);
			}
		});
	});

	describe('Magi target', () => {
		it('accepts the three ways to name a Magi account', () => {
			expect(validateRecipient(HIVE, 'magi').ok).toBe(true);
			expect(validateRecipient(EVM, 'magi').ok).toBe(true);
			expect(validateRecipient(BTC, 'magi').ok).toBe(true);
			expect(validateRecipient('did:pkh:eip155:1:' + EVM.slice(2), 'magi').ok).toBe(true);
		});
		/** Used to accept anything, because the address was ignored entirely. */
		it('rejects nonsense', () => {
			expect(validateRecipient('not an address', 'magi').ok).toBe(false);
			expect(validateRecipient('0xzzzz', 'magi').ok).toBe(false);
		});
	});

	it('gives each target its own hint', () => {
		expect(recipientHint('btc')).toContain('Bitcoin');
		expect(recipientHint('hive')).toContain('Hive');
		expect(recipientHint('magi')).toContain('EVM');
	});
});
