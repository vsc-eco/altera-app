import { describe, expect, it } from 'vitest';
import { poolNetworkLabel } from './network';

describe('poolNetworkLabel', () => {
	const mainnet = 'Ethereum Mainnet';

	it('names Ethereum Mainnet for an ETH or USDC pool on mainnet', () => {
		expect(poolNetworkLabel(['ETH', 'HBD'], 1)).toBe(mainnet);
		expect(poolNetworkLabel(['USDC', 'HBD'], 1)).toBe(mainnet);
		expect(poolNetworkLabel(['ETH', 'USDC'], 1)).toBe(mainnet);
	});

	it('names Sepolia on testnet', () => {
		expect(poolNetworkLabel(['USDC', 'HBD'], 11155111)).toBe('Ethereum (Sepolia)');
	});

	it('matches the symbol in any case', () => {
		expect(poolNetworkLabel(['usdc', 'hbd'], 1)).toBe(mainnet);
	});

	it('shows nothing for pools with no bridged EVM asset', () => {
		expect(poolNetworkLabel(['HIVE', 'HBD'], 1)).toBeNull();
		expect(poolNetworkLabel(['BTC', 'HBD'], 1)).toBeNull();
		expect(poolNetworkLabel(['STARPRO', 'HBD'], 1)).toBeNull();
		// a symbol that only contains ETH is not ETH
		expect(poolNetworkLabel(['WETHX', 'HBD'], 1)).toBeNull();
	});

	it('shows nothing for a chain it cannot name', () => {
		expect(poolNetworkLabel(['ETH', 'HBD'], 56)).toBeNull();
	});
});
