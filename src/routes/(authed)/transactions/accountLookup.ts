/**
 * Normalise what someone types into the transactions page's account lookup
 * into the form `getDidFromUsername` and `validateAddress` expect.
 *
 * People paste Hive names the way they see them around the ecosystem
 * (`@name`, `hive:name`, `Name`), so those all reduce to the bare lowercase
 * name. Anything longer than a Hive name (EVM and BTC addresses, full DIDs)
 * passes through untouched: legacy BTC addresses are case-sensitive, and
 * `getDidFromUsername` checksums EVM addresses itself.
 */
export function normalizeAccountInput(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.startsWith('did:')) return trimmed;
	const name = trimmed.replace(/^@/, '').replace(/^hive:/i, '').replace(/^@/, '');
	return name.length <= 16 ? name.toLowerCase() : name;
}
