export type SwapAsset = 'HIVE' | 'HBD' | 'BTC';

export type DestinationChain = 'HIVE' | 'BTC';

export interface MagiConfig {
	network: 'vsc-mainnet' | 'vsc-testnet';
	dexRouterContractId: string;
	btcMappingContractId: string;
	gatewayAccount: string;
	gqlUrl?: string;
	indexerUrl?: string;
	hiveAssetName?: string;
	hbdAssetName?: string;
	referral?: ReferralConfig | null;
	/** BTC mapping bot URL for deposit-address generation. */
	mappingBotUrl?: string;
}

export interface ReferralConfig {
	beneficiary: string;
	bps: number;
	usdThreshold?: number;
}

/**
 * Default mainnet config — contract IDs confirmed against
 * altera-app/src/client.ts and altera-app/src/lib/constants.ts as of
 * commit 3730e52.
 */
export const MAINNET_CONFIG: MagiConfig = {
	network: 'vsc-mainnet',
	dexRouterContractId: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45',
	btcMappingContractId: 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d',
	gatewayAccount: 'vsc.gateway',
	gqlUrl: 'https://api.vsc.eco',
	indexerUrl: 'https://indexer.magi.milohpr.com',
	hiveAssetName: 'HIVE',
	hbdAssetName: 'HBD',
	referral: null,
	mappingBotUrl: 'https://btc.magi.milohpr.com'
};

export const TESTNET_CONFIG: MagiConfig = {
	network: 'vsc-testnet',
	dexRouterContractId: 'vsc1BmjY9JwFQyvRwYhLpiXFCYeUqxmU8ykrAM',
	btcMappingContractId: 'vsc1BkWohDf5fPcwn7V9B9ar6TyiWc3A2ZGJ4t',
	gatewayAccount: 'vsc.gateway',
	gqlUrl: 'https://api.vsc.eco',
	hiveAssetName: 'TESTS',
	hbdAssetName: 'TBD',
	referral: null,
	mappingBotUrl: 'https://btc.testnet.magi.milohpr.com'
};

/** Decimal places per asset. BTC = 8 (sats), HIVE/HBD = 3 (milli). */
export const ASSET_DECIMALS: Record<SwapAsset, number> = {
	HIVE: 3,
	HBD: 3,
	BTC: 8
};

export interface PoolDepths {
	contractId: string;
	asset0: string;
	asset1: string;
	reserve0: bigint;
	reserve1: bigint;
}

export interface SwapCalcResult {
	baseFee: bigint;
	clpFee: bigint;
	totalFee: bigint;
	expectedOutput: bigint;
	minAmountOut: bigint;
	slippageBps: number;
}
