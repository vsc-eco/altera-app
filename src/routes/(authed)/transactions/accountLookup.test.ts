import { describe, expect, it } from 'vitest';
import { normalizeAccountInput } from './accountLookup';

describe('normalizeAccountInput', () => {
	it('reduces every common Hive spelling to the bare lowercase name', () => {
		for (const input of ['herman-german', '@herman-german', 'hive:herman-german', ' Herman-German ', 'hive:@herman-german']) {
			expect(normalizeAccountInput(input)).toBe('herman-german');
		}
	});

	it('leaves BTC addresses untouched (legacy ones are case-sensitive)', () => {
		expect(normalizeAccountInput('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(
			'1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
		);
	});

	it('leaves EVM addresses and full DIDs untouched', () => {
		const evm = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
		expect(normalizeAccountInput(evm)).toBe(evm);
		expect(normalizeAccountInput(`did:pkh:eip155:1:${evm}`)).toBe(`did:pkh:eip155:1:${evm}`);
	});

	it('empty input stays empty (means "my own account")', () => {
		expect(normalizeAccountInput('   ')).toBe('');
	});
});
