export type CallContractOp = {
	action: string;
	contract_id: string;
	intents: unknown[];
	payload: string;
	rc_limit: number;
	type: 'call';
};

export type TransferOp = {
	from: string;
	to: string;
	amount: string;
	asset: string;
	net_id: string;
	memo?: string;
};

// Dex router / instruction-schema based payloads

export type DexReturnAddress = {
	chain: string;
	address: string;
};

/**
 * Instruction object as defined in the DEX mapper instruction schema.
 * Mirrors fields from instruction-schema.md (type, version, asset_in/out, recipient, etc.).
 */
export type DexInstruction = {
	type: 'swap' | 'deposit' | 'withdrawal';
	version: string;
	asset_in: string;
	asset_out: string;
	recipient: string;
	slippage_bps?: number;
	min_amount_out?: number;
	beneficiary?: string;
	ref_bps?: number;
	return_address?: DexReturnAddress;
	metadata?: Record<string, unknown>;
};

/**
 * Suggested payload shape for calling the router-v2 contract `execute` method.
 * It wraps a DEX instruction together with the concrete input amount.
 */
export type DexExecutePayload = {
	instruction: DexInstruction;
	amount_in: number;
};

// DEX Router V2 Contract Types
// Based on V2 architecture: https://github.com/vsc-eco/dex-contracts/blob/main/docs/architecture-v2.md

/**
 * Pool registration payload for router-v2 contract.
 * Registers a DEX contract for an asset pair with optional chain information.
 */
export type RegisterPoolPayload = {
	asset0: string;
	asset1: string;
	dex_contract_id: string;
	asset0_chain?: string; // Optional: from mapping contract
	asset1_chain?: string; // Optional: VSC native or other
};

/**
 * DEX Contract add_liquidity action payload.
 * Called on individual DEX contracts to add liquidity.
 */
export type AddLiquidityPayload = {
	amount0_in: number;
	amount1_in: number;
	min_liquidity_out: number;
	recipient: string;
	deadline?: number;
};

/**
 * DEX Contract remove_liquidity action payload.
 * Called on individual DEX contracts to remove liquidity.
 */
export type RemoveLiquidityPayload = {
	lp_token_amount: number;
	min_amount0_out: number;
	min_amount1_out: number;
	recipient: string;
	deadline?: number;
};

/**
 * DEX Contract swap action payload (direct pool swap).
 * Called on individual DEX contracts for direct swaps.
 */
export type SwapPayload = {
	amount_in: number;
	min_amount_out: number;
	recipient: string;
	direction: boolean; // true for token0->token1, false for token1->token0
	deadline?: number;
};

/**
 * Liquidity pool instruction for router-v2 execute method.
 * This wraps liquidity operations within the router execution framework.
 */
export type LiquidityPoolInstruction = {
	type: 'deposit' | 'withdrawal';
	version: string;
	asset0: string;
	asset1: string;
	recipient: string;
	slippage_bps?: number;
	min_liquidity_tokens?: number;
	max_tokens_out?: number;
	return_address?: DexReturnAddress;
	metadata?: Record<string, unknown>;
};

/**
 * Payload for router-v2 execute method when handling liquidity operations.
 * Similar structure to DEX swap operations.
 */
export type LiquidityPoolExecutePayload = {
	instruction: LiquidityPoolInstruction;
	amount_in: number;
};

// Generic Contract Call

/**
 * Generic contract call parameters for flexible VSC contract interactions.
 * Allows calling any contract action with arbitrary payloads.
 */
export type GenericContractCallParams = {
	contractId: string;
	action: string;
	payload: Record<string, unknown>;
	rcLimit?: number;
	intents?: unknown[];
};