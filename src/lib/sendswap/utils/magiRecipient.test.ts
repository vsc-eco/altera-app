import { describe, expect, it } from 'vitest';
import { magiRecipient } from './magiRecipient';

const GOOD = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const TYPO = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAee'; // one character off, checksum wrong

describe('magiRecipient ("Send to address" on Magi)', () => {
	it('a Hive name, with or without @ or hive:', () => {
		expect(magiRecipient('altera.app')).toEqual({ ok: true, did: 'hive:altera.app' });
		expect(magiRecipient('@bob-1')).toEqual({ ok: true, did: 'hive:bob-1' });
		expect(magiRecipient('hive:lordbutterfly')).toEqual({ ok: true, did: 'hive:lordbutterfly' });
	});

	it('an invalid Hive name is refused, never sent as hive:@x or hive:Bob', () => {
		expect(magiRecipient('Bob')).toMatchObject({ ok: false, error: expect.stringMatching(/lower case/) });
		expect(magiRecipient('ab').ok).toBe(false);
		expect(magiRecipient('a.verylongnameeeeeee').ok).toBe(false);
	});

	it('a 0x address: checksummed did:pkh; a wrong checksum is refused (it would pay an address nobody owns)', () => {
		expect(magiRecipient(GOOD.toLowerCase())).toEqual({ ok: true, did: `did:pkh:eip155:1:${GOOD}` });
		expect(magiRecipient(GOOD)).toEqual({ ok: true, did: `did:pkh:eip155:1:${GOOD}` });
		expect(magiRecipient(TYPO)).toMatchObject({ ok: false, error: expect.stringMatching(/checksum/) });
		expect(magiRecipient(`did:pkh:eip155:1:${TYPO}`).ok).toBe(false);
		expect(magiRecipient(`did:pkh:eip155:1:${GOOD.toLowerCase()}`)).toEqual({
			ok: true,
			did: `did:pkh:eip155:1:${GOOD}`
		});
	});

	it('an all-upper-case 0x address is valid (EIP-55 unchecksummed) and paid checksummed', () => {
		expect(magiRecipient('0x' + GOOD.slice(2).toUpperCase())).toEqual({
			ok: true,
			did: `did:pkh:eip155:1:${GOOD}`
		});
	});

	it('a Bitcoin address becomes its did:pkh:bip122', () => {
		const r = magiRecipient('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
		expect(r).toMatchObject({ ok: true, did: expect.stringMatching(/^did:pkh:bip122:.*:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq$/) });
	});

	it('anything else is refused instead of paying the sender', () => {
		expect(magiRecipient('XmP9oTH6bN2GpBk9WNtk7kQpzrhtjtuWHC').ok).toBe(false); // a DASH address
		expect(magiRecipient('   ').ok).toBe(false);
	});
});
