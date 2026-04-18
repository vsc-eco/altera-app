import { BTC_MAPPING_CONTRACT_ID } from '$lib/constants';
import { GetStateByKeysStore } from '$houdini';

// Mirror of the VSC BTC-mapping contract's own fee math (constants.go / utils.go).
// The contract stores a 32-byte "supply" blob at state key "s" holding four
// big-endian int64s; BaseFeeRate (sat/vbyte) lives at offset 24-31. At use
// time the contract clamps the rate to [1, MaxBaseFeeRate]. We replicate the
// clamp and vSize math here so the Review screen can show an approximate
// network-fee range before the contract actually picks UTXOs.

const SUPPLY_STATE_KEY = 's';
const MAX_BASE_FEE_RATE = 1000;

function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
	}
	return bytes;
}

function clampedFeeRate(rate: number): number {
	if (rate > MAX_BASE_FEE_RATE) return MAX_BASE_FEE_RATE;
	if (rate < 1) return 1;
	return rate;
}

function estimateVSize(nonWitnessSize: number, witnessDataSize: number): number {
	const totalSize = nonWitnessSize + witnessDataSize;
	return Math.floor((nonWitnessSize * 3 + totalSize + 3) / 4) + 2;
}

// Base-case fee (single destination output, no contract change outputs).
// The contract may add up to `maxChangeOutputs` P2WSH change outputs when
// `totalChange - fee` is large enough to survive dust; we don't know the
// contract's UTXO set here so we skip that branch — the result is a lower
// bound that matches the minimum the contract would ever charge.
function estimateBaseFeeSats(numInputs: number, feeRate: number): number {
	const baseSize = 10;
	const inputSize = numInputs * 41;
	const outputSize = 43;
	const nonWitnessSize = baseSize + inputSize + outputSize;
	// Per input: sig(72) + 112-byte deposit-tag witness script (conservative
	// upper bound used by the contract) + 5 bytes of length prefixes.
	const witnessDataSize = numInputs * (72 + 112 + 5);
	const vSize = estimateVSize(nonWitnessSize, witnessDataSize);
	return vSize * clampedFeeRate(feeRate);
}

export type BtcFeeEstimate = {
	feeRate: number;
	minSats: number;
	maxSats: number;
};

export async function fetchBtcBaseFeeRate(): Promise<number | null> {
	try {
		const result = await new GetStateByKeysStore().fetch({
			variables: {
				contractId: BTC_MAPPING_CONTRACT_ID,
				keys: [SUPPLY_STATE_KEY],
				encoding: 'hex'
			},
			policy: 'NetworkOnly'
		});
		const state = result.data?.getStateByKeys;
		const hex = state?.[SUPPLY_STATE_KEY];
		if (!hex || typeof hex !== 'string') return null;
		const bytes = hexToBytes(hex);
		if (bytes.length !== 32) return null;
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		// Offsets: 0 ActiveSupply, 8 UserSupply, 16 FeeSupply, 24 BaseFeeRate.
		const baseFeeRate = view.getBigInt64(24, false);
		return Number(baseFeeRate);
	} catch (err) {
		console.error('Failed to fetch BTC base fee rate', err);
		return null;
	}
}

export async function estimateBtcUnmapFee(): Promise<BtcFeeEstimate | null> {
	const feeRate = await fetchBtcBaseFeeRate();
	if (feeRate == null) return null;
	const clamped = clampedFeeRate(feeRate);
	return {
		feeRate: clamped,
		minSats: estimateBaseFeeSats(1, clamped),
		maxSats: estimateBaseFeeSats(3, clamped)
	};
}
