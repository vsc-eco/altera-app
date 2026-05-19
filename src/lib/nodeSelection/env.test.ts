import { describe, it, expect } from 'vitest';
import { parseNodeList } from './env';

describe('parseNodeList', () => {
	it('splits, trims, drops empties, strips trailing slashes', () => {
		expect(parseNodeList(' https://a.com/ , https://b.com ,, ', ['x'])).toEqual([
			'https://a.com',
			'https://b.com'
		]);
	});
	it('prefixes bare hosts with https://', () => {
		expect(parseNodeList('vsc.techcoderx.com', ['x'])).toEqual(['https://vsc.techcoderx.com']);
	});
	it('keeps indexer base paths intact', () => {
		expect(parseNodeList('https://api.okinoko.io/hasura', ['x'])).toEqual([
			'https://api.okinoko.io/hasura'
		]);
	});
	it('falls back when undefined or empty', () => {
		expect(parseNodeList(undefined, ['f1', 'f2'])).toEqual(['f1', 'f2']);
		expect(parseNodeList('   ', ['f1'])).toEqual(['f1']);
	});
});
