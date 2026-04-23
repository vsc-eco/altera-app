/**
 * mockUp.ts — DEAD FILE, reference only.
 *
 * Documents every VSC operation type that Altera can CREATE or DISPLAY,
 * with annotated real (or constructed) payload shapes.
 *
 * ── AMOUNT ENCODING ──────────────────────────────────────────────────────────
 *   HIVE / HBD  → 3 decimal places  (1 000  = 1.000)
 *   BTC / sats  → 8 decimal places  (667188 = 0.00667188 BTC)
 *
 *   op.data.amount can be:
 *     decimal string  "5.000"  → isPreshifted = false
 *     integer         500000   → isPreshifted = true  (typeof === 'number')
 *
 * ── CONTRACT IDs (mainnet) ────────────────────────────────────────────────────
 *   DEX Router       vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45
 *   BTC Mapping      vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d
 *
 * ── VERIFICATION ─────────────────────────────────────────────────────────────
 *   ✅ verified — real tx from hive:milo-hpr fetched from api.vsc.eco
 *   🔧 constructed — payload shape derived from Altera source code;
 *                    not yet seen in milo-hpr's last 50 txs
 *
 * ── DISPLAY ROUTING ──────────────────────────────────────────────────────────
 *   getOpTrType() in Table.svelte routes each op to a TR component:
 *     'regular'   → Tr.svelte           (has from/to/asset/amount fields)
 *     'btc-vsc'   → BtcMappingTr.svelte (call action = unmap | transfer | transferFrom)
 *     'contract'  → ContractTr.svelte   (all other call/call_contract ops)
 *     null        → hidden              (increaseAllowance + infrastructure)
 *   btc-deposit events → BtcDepositTr.svelte (separate store, not VSC ops)
 */

// ─── CONTRACT IDs ────────────────────────────────────────────────────────────
export const DEX_ROUTER  = 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45';
export const BTC_MAPPING = 'vsc1BdrQ6EtbQ64rq2PkPd21x4MaLnVRcJj85d';

// ─── 1. TRANSFER ✅ ──────────────────────────────────────────────────────────
// VSC-to-VSC value transfer. from / to can be any DID or hive: account.
// Sent with custom_json id = "vsc.transfer".
//
// TR component : Tr.svelte
// Table display:
//   Date    | To/From (other account)  | Status    | ±amount asset  | Transfer
export const sampleTransfer = {
	id: 'bafyreify4q4mwtjz4gri6jv73ti6yzj3qvcy5ydbemaxifitjldwpxipti',
	type: 'vsc',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-18T00:08:45',
	rc_limit: 500,
	ledger: [
		{
			amount: 1000, // integer, preshifted — 1.000 HBD (3 dp)
			asset: 'hbd',
			from: 'did:pkh:eip155:1:0x9861820c2E8399AEbf96D4e23A30DEA4AF2d532D',
			to: 'hive:milo-hpr',
			type: 'transfer',
			memo: ''
		}
	],
	ops: [
		{
			index: 0,
			type: 'transfer',
			data: {
				amount: '1.000', // decimal string — NOT preshifted
				asset: 'hbd',
				from: 'did:pkh:eip155:1:0x9861820c2E8399AEbf96D4e23A30DEA4AF2d532D',
				to: 'hive:milo-hpr',
				memo: ''
			}
		}
	]
};

// ─── 2. DEPOSIT ✅ ──────────────────────────────────────────────────────────
// Hive L1 → VSC bridge-in. from === to (always self). Ledger is EMPTY.
// op.data.amount is an INTEGER (preshifted). tx.type = 'hive' (standard Hive transfer op).
//
// TR component : Tr.svelte
// Table display:
//   Date    | Self / "Hive"  | Status    | +amount asset (green)  | Deposit
export const sampleDeposit = {
	id: 'd9a969e30fd3d032e7155ba01358bd9583f64f53',
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-02-24T16:09:21',
	rc_limit: 0,
	ledger: [], // always empty for deposit
	ledger_actions: [],
	ops: [
		{
			index: 0,
			type: 'deposit',
			data: {
				amount: 104000, // integer! preshifted: 104000 = 104.000 HBD
				asset: 'hbd',
				from: 'hive:milo-hpr',
				to: 'hive:milo-hpr', // always self
				memo: 'to=milo-hpr'
			}
		}
	]
};

// ─── 3. WITHDRAW ✅ ─────────────────────────────────────────────────────────
// VSC → Hive L1 bridge-out. from === to (always self).
// Has ledger entry (type:"withdraw") AND ledger_actions.
// ledger_actions[].asset may differ, e.g. "hbd_savings" for savings withdraw.
//
// TR component : Tr.svelte
// Table display:
//   Date    | Self / "Hive"  | Status    | -amount asset  | Withdraw
export const sampleWithdraw = {
	id: 'e1703c9b2ba3d069fc01bce709c7d2de4b09e5a9',
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-02-24T16:03:18',
	rc_limit: 0,
	ledger: [
		{
			amount: 100000, // 100.000 HBD (preshifted)
			asset: 'hbd',
			from: 'hive:milo-hpr',
			to: 'hive:milo-hpr',
			type: 'withdraw',
			memo: ''
		}
	],
	ledger_actions: [
		{
			amount: 100000,
			asset: 'hbd', // 'hbd_savings' when withdrawing from savings
			data: null,
			memo: ''
		}
	],
	ops: [
		{
			index: 0,
			type: 'withdraw',
			data: {
				amount: '100.000', // decimal string here
				asset: 'hbd',
				from: 'hive:milo-hpr',
				to: 'hive:milo-hpr',
				memo: ''
			}
		}
	]
};

// ─── 4. STAKE HBD ✅ ────────────────────────────────────────────────────────
// Lock HBD into savings. from === to (always self).
// Verified from hive:lordbutterfly (both real txs were FAILED, so ledger is empty,
// but the op.data shape is confirmed).
// On success: ledger type = "stake", ledger_actions asset = "hbd_savings".
// Sent with custom_json id = "vsc.stake_hbd".
// NOTE: op.data has NO memo field (unlike transfer/deposit).
//
// TR component : Tr.svelte
// Table display:
//   Date    | Self  | Status    | amount HBD  | Stake HBD
export const sampleStakeHbd = {
	id: 'eea7b9502c7dd6009edb2750e89f3e19b07bab1d', // real tx, hive:lordbutterfly, FAILED
	type: 'hive',
	status: 'FAILED',
	anchr_ts: '2026-04-12T15:58:57',
	rc_limit: 0,
	ledger: [], // empty because FAILED; on success would have type:"stake" entry
	ledger_actions: [], // empty because FAILED; on success: [{ asset:"hbd_savings", amount:... }]
	ops: [
		{
			index: 0,
			type: 'stake_hbd',
			data: {
				amount: '1.000', // decimal string — NOT preshifted
				asset: 'hbd',
				from: 'hive:lordbutterfly',
				to: 'hive:lordbutterfly'
				// No memo field on stake_hbd ops
			}
		}
	]
};

// ─── 5. UNSTAKE HBD 🔧 ──────────────────────────────────────────────────────
// Withdraw HBD from savings. Mirror image of stake_hbd.
// Sent with custom_json id = "vsc.unstake_hbd".
//
// TR component : Tr.svelte
// Table display:
//   Date    | Self  | Status    | amount HBD  | Unstake HBD
export const sampleUnstakeHbd = {
	id: 'sample-unstake-hbd',
	type: 'hive',
	status: 'CONFIRMED',
	rc_limit: 0,
	ledger: [
		{
			amount: 657,
			asset: 'hbd',
			from: 'hive:milo-hpr',
			to: 'hive:milo-hpr',
			type: 'unstake',
			memo: ''
		}
	],
	ledger_actions: [
		{
			amount: 657,
			asset: 'hbd_savings',
			data: null,
			memo: ''
		}
	],
	ops: [
		{
			index: 0,
			type: 'unstake_hbd',
			data: {
				amount: '0.657',
				asset: 'hbd',
				from: 'hive:milo-hpr',
				to: 'hive:milo-hpr'
			}
		}
	]
};

// ─── 6. CONSENSUS STAKE 🔧 ──────────────────────────────────────────────────
// Delegate HIVE to a node runner for consensus participation.
// from = delegator (self), to = node runner account.
// Sent with custom_json id = "vsc.consensus_stake".
//
// TR component : Tr.svelte
// Table display:
//   Date    | node-runner-account  | Status    | amount HIVE  | Consensus Stake
export const sampleConsensusStake = {
	id: 'sample-consensus-stake',
	type: 'hive',
	status: 'CONFIRMED',
	rc_limit: 0,
	ledger: [],
	ops: [
		{
			index: 0,
			type: 'consensus_stake',
			data: {
				amount: '100.000',
				asset: 'hive',
				from: 'hive:milo-hpr',
				to: 'hive:some-node-runner'
			}
		}
	]
};

// ─── 7. CONSENSUS UNSTAKE 🔧 ────────────────────────────────────────────────
// Remove HIVE delegation from a node runner.
// Sent with custom_json id = "vsc.consensus_unstake".
//
// TR component : Tr.svelte
// Table display:
//   Date    | node-runner-account  | Status    | amount HIVE  | Consensus Unstake
export const sampleConsensusUnstake = {
	id: 'sample-consensus-unstake',
	type: 'hive',
	status: 'CONFIRMED',
	rc_limit: 0,
	ledger: [],
	ops: [
		{
			index: 0,
			type: 'consensus_unstake',
			data: {
				amount: '100.000',
				asset: 'hive',
				from: 'hive:milo-hpr',
				to: 'hive:some-node-runner'
			}
		}
	]
};

// ─── 8. SWAP — new router format ✅ ─────────────────────────────────────────
// Altera DEX swap via the router contract (vsc.call + action:"execute").
// Verified extensively from hive:lordbutterfly.
//
// KEY FACTS confirmed from real txs:
//   • payload.asset_in / asset_out are UPPERCASE ("HBD", "HIVE", "BTC")
//   • payload.amount_in is an INTEGER STRING (preshifted, same unit as ledger amounts)
//   • intents[].args.limit is a DECIMAL STRING ("1.000") — different from amount_in!
//   • payload.min_amount_out is preshifted integer; can be "0" (no slippage protection)
//   • destination_chain optional: "HIVE" or "BTC" for cross-chain; absent for VSC-internal
//   • recipient: Hive account, BTC address, or contract address
//   • increaseAllowance companion op: ONLY when asset_in is BTC (hidden by getOpTrType)
//   • For HIVE/HBD inputs: single execute op, no increaseAllowance companion
//
// SETTLED AMOUNT vs MIN:
//   min_amount_out is the slippage floor, NOT the settled amount. For confirmed txs,
//   the actual output is in the ledger — last entry where to = recipient (for VSC-
//   internal swaps) or going to the BTC mapping contract (for BTC destination).
//   For VSC-internal HIVE/HBD out: last ledger entry {to: recipient, type:"withdraw"}
//   For BTC destination: ledger shows intermediate HBD going to BTC_MAPPING; the
//     actual BTC output is tracked by the BTC indexer, not in VSC ledger.
//
// TR component : ContractTr.svelte
// Table display:
//   Date    | DEX Router (short)  | Status    | amount_in → min_amount_out  | Swap

// Example A: HIVE→BTC cross-chain swap (no increaseAllowance, Altera fee present)
export const sampleSwapNewHiveToBtc = {
	id: 'f9666960099d227965b6355aeaeeb87c57e4d063', // real tx, hive:lordbutterfly
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-18T01:42:15',
	rc_limit: 0,
	ledger: [
		{ amount: 20000, asset: 'hive', from: 'hive:lordbutterfly', to: `contract:${DEX_ROUTER}`, type: 'transfer', memo: '' },
		{ amount: 20000, asset: 'hive', from: `contract:${DEX_ROUTER}`, to: 'contract:vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp', type: 'transfer', memo: '' },
		// Intermediate HBD goes to BTC mapping contract — actual BTC tracked by indexer:
		{ amount: 1258, asset: 'hbd', from: 'contract:vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp', to: `contract:${DEX_ROUTER}`, type: 'transfer', memo: '' },
		{ amount: 1258, asset: 'hbd', from: `contract:${DEX_ROUTER}`, to: `contract:${BTC_MAPPING}`, type: 'transfer', memo: '' }
	],
	ops: [
		// Single op — no increaseAllowance for HIVE/HBD inputs
		{
			index: 0,
			type: 'call',
			data: {
				action: 'execute',
				contract_id: DEX_ROUTER,
				intents: [
					// limit is DECIMAL string ("20.000"), while payload.amount_in is INTEGER ("20000")
					{ type: 'transfer.allow', args: { limit: '20.000', token: 'hive' } }
				],
				payload: JSON.stringify({
					type: 'swap',
					version: '1.0.0',
					asset_in: 'HIVE',    // UPPERCASE
					asset_out: 'BTC',    // UPPERCASE
					amount_in: '20000',  // preshifted integer string (20.000 HIVE)
					min_amount_out: '1103', // preshifted integer string (min sats out)
					recipient: 'bc1q5hnuykyu0ejkwktheh5mq2v9dp2y3674ep0kss', // BTC destination address
					destination_chain: 'BTC',              // cross-chain flag
					beneficiary: 'hive:altera.app',         // Altera fee
					ref_bps: 25
				}),
				rc_limit: 100000
			}
		}
	]
};

// Example B: HBD→HIVE VSC-internal swap (settled amount visible in ledger)
export const sampleSwapNewHbdToHive = {
	id: '666309ade014f86972240d697ffd702d9feb77ae', // real tx, hive:lordbutterfly
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-18T14:04:51',
	rc_limit: 0,
	ledger: [
		{ amount: 1000, asset: 'hbd', from: 'hive:lordbutterfly', to: `contract:${DEX_ROUTER}`, type: 'transfer', memo: '' },
		{ amount: 1000, asset: 'hbd', from: `contract:${DEX_ROUTER}`, to: 'contract:vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp', type: 'transfer', memo: '' },
		{ amount: 17752, asset: 'hive', from: 'contract:vsc1BoaniA5HW56GuQy6pVdoZfMcVaaDfnC8kp', to: `contract:${DEX_ROUTER}`, type: 'transfer', memo: '' },
		// Settled amount: actual HIVE the user received (better than min_amount_out: 17590)
		{ amount: 17752, asset: 'hive', from: `contract:${DEX_ROUTER}`, to: 'hive:lordbutterfly', type: 'withdraw', memo: '' }
	],
	ops: [
		{
			index: 0,
			type: 'deposit', // bundled deposit op (same tx, index 0) — shown as separate row
			data: {
				amount: 1000,
				asset: 'hbd',
				from: 'hive:lordbutterfly',
				memo: 'to=lordbutterfly',
				to: 'hive:lordbutterfly'
			}
		},
		{
			index: 1,
			type: 'call',
			data: {
				action: 'execute',
				contract_id: DEX_ROUTER,
				intents: [{ type: 'transfer.allow', args: { limit: '1.000', token: 'hbd' } }],
				payload: JSON.stringify({
					type: 'swap',
					version: '1.0.0',
					asset_in: 'HBD',
					asset_out: 'HIVE',
					amount_in: '1000',          // preshifted (1.000 HBD)
					min_amount_out: '17590',    // preshifted floor; actual settled was 17752
					recipient: 'hive:lordbutterfly',
					destination_chain: 'HIVE'  // cross-chain to Hive L1
				}),
				rc_limit: 10000
			}
		}
	]
};

// Example C: BTC→HBD swap (has increaseAllowance companion — HIDDEN)
export const sampleSwapNewBtcToHbd = {
	id: '24e25445ab74f6c165d4b711199f47048b706164', // real tx, hive:lordbutterfly
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-21T14:38:15',
	rc_limit: 0,
	ledger: [
		{ amount: 498000, asset: 'hbd', from: 'hive:lordbutterfly', to: `contract:${DEX_ROUTER}`, type: 'transfer', memo: '' },
		{ amount: 498000, asset: 'hbd', from: `contract:${DEX_ROUTER}`, to: 'contract:vsc1BVb95YKRHAEy24XgRSaW4L6d9vB88AdwjM', type: 'transfer', memo: '' }
	],
	ops: [
		// Op 0: increaseAllowance — HIDDEN by getOpTrType (BTC input requires this)
		{
			index: 0,
			type: 'call',
			data: {
				action: 'increaseAllowance',
				contract_id: BTC_MAPPING,
				intents: [],
				payload: JSON.stringify({ spender: `contract:${DEX_ROUTER}`, amount: '682941' }),
				rc_limit: 1000
			}
		},
		// Note: this particular tx used the OLD pool format (payload.type="deposit").
		// A BTC→HBD swap via the NEW router would have payload.type="swap" instead.
		{
			index: 1,
			type: 'call',
			data: {
				action: 'execute',
				contract_id: DEX_ROUTER,
				intents: [{ args: { limit: '498000', token: 'hbd' }, type: 'transfer.allow' }],
				payload: JSON.stringify({
					type: 'deposit', // old pool format (still detected as swap by ContractTr)
					version: '1.0.0',
					asset0: 'btc',
					asset1: 'hbd',
					amount0: '682941', // sats in
					amount1: '498000', // milliHBD out (settled)
					recipient: 'hive:lordbutterfly'
				}),
				rc_limit: 2000
			}
		}
	]
};

// ─── 9. SWAP — old pool format ✅ ───────────────────────────────────────────
// Historical: direct call to an AMM pool (pre-router era). New swaps use #8.
// payload.type = "deposit" (the pool's internal instruction name — confusing but correct).
// amount0/amount1 are SETTLED values (confirmed tx), so display is accurate.
//
// TR component : ContractTr.svelte
// Table display:
//   Date    | pool addr (short)  | Status    | amount0 → amount1  | Swap
export const sampleSwapOld = {
	id: 'dbd48d6e2c54822021d058770251c995e545d106',
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-17T03:05:24',
	rc_limit: 0,
	ledger: [
		{ amount: 500000, asset: 'hbd', from: 'hive:milo-hpr', to: `contract:${DEX_ROUTER}`, type: 'transfer', memo: '' },
		{ amount: 500000, asset: 'hbd', from: `contract:${DEX_ROUTER}`, to: 'contract:vsc1BVb95YKRHAEy24XgRSaW4L6d9vB88AdwjM', type: 'transfer', memo: '' }
	],
	ops: [
		{
			index: 0,
			type: 'call',
			data: {
				action: 'increaseAllowance', // HIDDEN by getOpTrType
				contract_id: BTC_MAPPING,
				intents: [],
				payload: JSON.stringify({ spender: `contract:${DEX_ROUTER}`, amount: '667188' }),
				rc_limit: 1000
			}
		},
		{
			index: 1,
			type: 'call',
			data: {
				action: 'execute',
				contract_id: 'vsc1Brvi4YZHLkocYNAFd7Gf1JpsPjzNnv4i45', // the AMM pool directly
				intents: [{ args: { limit: '500000', token: 'hbd' }, type: 'transfer.allow' }],
				payload: JSON.stringify({
					type: 'deposit', // AMM pool instruction — not a liquidity deposit
					version: '1.0.0',
					asset0: 'btc',    // what went IN
					asset1: 'hbd',    // what came OUT
					amount0: '667188', // 0.00667188 BTC (sats)
					amount1: '500000', // 500.000 HBD (milliHBD) — settled
					recipient: 'hive:milo-hpr'
				}),
				rc_limit: 5000
			}
		}
	]
};

// ─── 10. ADD LIQUIDITY 🔧 ───────────────────────────────────────────────────
// Deposit both sides of a pool pair via the DEX router.
// payload.type = "deposit" on DEX_ROUTER — same key as old swap (#9) but on the router.
// Both amount0 + amount1 are sent IN (no output amount in the payload).
//
// Distinguish from old swap: contract_id === DEX_ROUTER and payload.type === "deposit".
//
// TR component : ContractTr.svelte (currently shows as generic contract op)
// Current display: first intent amount as "limit" → not ideal
// Ideal display: amount0 asset0 + amount1 asset1 | Add Liquidity
export const sampleAddLiquidity = {
	id: 'sample-add-liquidity',
	type: 'hive',
	status: 'CONFIRMED',
	rc_limit: 0,
	ledger: [],
	ops: [
		{
			index: 0,
			type: 'call',
			data: {
				action: 'execute',
				contract_id: DEX_ROUTER,
				intents: [
					{ type: 'transfer.allow', args: { limit: '50000', token: 'hbd' } },
					{ type: 'transfer.allow', args: { limit: '12345', token: 'hive' } }
				],
				payload: JSON.stringify({
					type: 'deposit', // "add liquidity" instruction to the router
					version: '1.0.0',
					asset0: 'hbd',    // alphabetical order enforced by getAddLiquidityOp()
					asset1: 'hive',
					amount0: '50000', // 50.000 HBD
					amount1: '12345', // 12.345 HIVE
					recipient: 'hive:milo-hpr'
				}),
				rc_limit: 100000
			}
		}
	]
};

// ─── 11. REMOVE LIQUIDITY 🔧 ────────────────────────────────────────────────
// Burn LP tokens to withdraw both underlying assets from a pool via the DEX router.
// payload.type = "withdrawal". No intents (user is not sending assets in).
// lp_amount = LP tokens to burn; actual output amounts come from ledger after confirmation.
//
// TR component : ContractTr.svelte (currently shows as generic contract op with 0 amount)
// Ideal display: lp_amount LP tokens | Remove Liquidity
export const sampleRemoveLiquidity = {
	id: 'sample-remove-liquidity',
	type: 'hive',
	status: 'CONFIRMED',
	rc_limit: 0,
	ledger: [],
	ops: [
		{
			index: 0,
			type: 'call',
			data: {
				action: 'execute',
				contract_id: DEX_ROUTER,
				intents: [], // no assets sent in
				payload: JSON.stringify({
					type: 'withdrawal', // "remove liquidity"
					version: '1.0.0',
					asset0: 'hbd',
					asset1: 'hive',
					lp_amount: '2594', // LP tokens to burn
					recipient: 'hive:milo-hpr'
				}),
				rc_limit: 100000
			}
		}
	]
};

// ─── 12. BTC TRANSFER (VSC-internal) ✅ ─────────────────────────────────────
// Transfer mapped BTC between VSC accounts via the BTC mapping contract.
// Verified from hive:devser.v4vapp (real txs from issue #62).
//
// payload = plain JSON string: { "amount": "<sats>", "to": "<recipient DID or hive:>" }
// ⚠ The payload is a plain JSON STRING, not a base64-encoded object.
//   BtcMappingTr.payloadData must handle this case — the `op.data.payload.Data`
//   base64 path is for a legacy format only.
//
// Internal VSC transfers produce NO indexer event — the BTC indexer only tracks
// on-chain Bitcoin transactions (unmap). fromAccount and toAccount must be
// populated from the payload when the indexer returns null.
//
// TR component : BtcMappingTr.svelte (action = "transfer")
// Table display:
//   Date    | recipient address  | Status    | amount BTC (outgoing)  | Transfer
export const sampleBtcTransferToHive = {
	id: '286d5bdf4f35d68445ce0dfb48718d6271170e5e', // real tx, hive:devser.v4vapp
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-22T07:53:30',
	rc_limit: 0,
	ledger: [], // always empty for internal BTC transfers
	ops: [
		{
			index: 0,
			type: 'call',
			data: {
				action: 'transfer',
				contract_id: BTC_MAPPING,
				intents: null,
				payload: JSON.stringify({
					amount: '432', // sats — plain JSON string, NOT base64
					to: 'hive:v4vapp-test'
				}),
				rc_limit: 1000
			}
		}
	]
};

export const sampleBtcTransferToEvm = {
	id: 'bd3f27ad88e00a78995e67d60f5994cc01f858f4', // real tx, hive:devser.v4vapp
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-22T09:37:33',
	rc_limit: 0,
	ledger: [],
	ops: [
		{
			index: 0,
			type: 'call',
			data: {
				action: 'transfer',
				contract_id: BTC_MAPPING,
				intents: null,
				payload: JSON.stringify({
					amount: '1230', // sats
					to: 'did:pkh:eip155:1:0x3Bb63EDd3Ff0F285997C52D8ee362dd40d3B2AAd' // EVM address DID
				}),
				rc_limit: 1000
			}
		}
	]
};

// ─── 13. BTC UNMAP (withdraw to mainnet) ✅ ──────────────────────────────────
// Withdraw BTC from VSC to a mainnet Bitcoin address.
// Ledger is always EMPTY — amount resolved asynchronously by the BTC indexer.
// Optional fields: deduct_fee (boolean), max_fee (sats).
//
// TR component : BtcMappingTr.svelte (action = "unmap")
// Table display:
//   Date    | bc1q… address  | Status    | amount BTC  | Withdraw
export const sampleBtcUnmap = {
	id: 'c2e07e2616844f4aaf93a1961e0728326f8707aa',
	type: 'hive',
	status: 'CONFIRMED',
	anchr_ts: '2026-04-14T21:24:33',
	rc_limit: 0,
	ledger: [], // always empty — fetched from BTC indexer separately
	ops: [
		{
			index: 0,
			type: 'call',
			data: {
				action: 'unmap',
				contract_id: BTC_MAPPING,
				intents: null,
				payload: JSON.stringify({
					amount: '5000',   // sats
					to: 'bc1q0c3tjrfmg4f8y3c2peylezcanplk0xvmpc32u9',
					deduct_fee: true  // optional — fee deducted from output
					// max_fee: 500  // optional — cap in sats
				}),
				rc_limit: 5000
			}
		}
	]
};

// ─── 14. BTC DEPOSIT (mainnet → VSC) ─────────────────────────────────────────
// Bitcoin sent from mainnet to a mapped VSC address. NOT a VSC op — this
// comes from a separate BTC indexer and lives in btcDepositStore (BtcDepositEvent).
// Displayed by BtcDepositTr.svelte, not from the normal ops pipeline.
//
// Table display:
//   Date    | Self / "Bitcoin"  | Status (always CONFIRMED)  | +amount BTC (green)  | BTC Deposit
export const sampleBtcDepositEvent = {
	// BtcDepositEvent shape from src/lib/indexer/btcMappingQueries.ts
	indexer_tx_hash: 'abc123...',
	indexer_ts: '2026-04-10T12:00:00',
	indexer_block_height: 850000,
	amount: '667188', // sats as string (BtcDepositEvent.amount is string)
	recipient: 'hive:milo-hpr'
};

// ─── 15. FAILED TRANSACTION ✅ ───────────────────────────────────────────────
// Any op type can fail. Ledger is EMPTY on failure.
// Display like normal but with status = "FAILED".
export const sampleFailed = {
	id: 'f800359987e539c41973b6c361d333b9496a719e',
	type: 'hive',
	status: 'FAILED',
	anchr_ts: '2026-04-17T19:23:18',
	rc_limit: 0,
	ledger: [], // always empty on failure
	ops: [
		{
			index: 0,
			type: 'transfer',
			data: {
				amount: '50.000',
				asset: 'hive',
				from: 'hive:milo-hpr',
				to: 'did:pkh:bip122:000000000933ea01ad0ee984209779ba:tb1qw0ssk7ef83esfc3e4k5gtmxhntshyawsrztz8p',
				memo: ''
			}
		}
	]
};

// ─── 16. INFRASTRUCTURE CALLS (hidden from wallet UI) ────────────────────────
// Protocol-level ops with no monetary value. getOpTrType() currently returns null
// for 'increaseAllowance'. The following actions should also be hidden:
//
// RECOMMENDATION: extend the null-return list in getOpTrType() to cover:
//   'map'                 — BTC deposit proof submission
//   'add_blocks'          — BTC light client block relay
//   'seed_blocks'         — BTC light client seed
//   'register_public_key' — node key registration
//   'create_key_pair'     — key pair generation
//   'echo'                — test / debug
//   'dumpEnv'             — test / debug
export const infrastructureActions = [
	'map',
	'add_blocks',
	'seed_blocks',
	'register_public_key',
	'create_key_pair',
	'echo',
	'dumpEnv'
] as const;

// ─── DISPLAY DECISION TABLE ──────────────────────────────────────────────────
//
// op.type          │ action / payload.type    │ TR           │ To/From           │ Amount                   │ Type label
// ─────────────────┼──────────────────────────┼──────────────┼───────────────────┼──────────────────────────┼──────────────────
// transfer         │ —                        │ Tr           │ other account     │ ±amount asset            │ Transfer
// deposit          │ —                        │ Tr           │ Self / "Hive"     │ +amount asset (green)    │ Deposit
// withdraw         │ —                        │ Tr           │ Self / "Hive"     │ -amount asset            │ Withdraw
// stake_hbd        │ —                        │ Tr           │ Self              │ amount HBD               │ Stake HBD
// unstake_hbd      │ —                        │ Tr           │ Self              │ amount HBD               │ Unstake HBD
// consensus_stake  │ —                        │ Tr           │ node runner       │ amount HIVE              │ Consensus Stake
// consensus_unstake│ —                        │ Tr           │ node runner       │ amount HIVE              │ Consensus Unstake
// call             │ execute / type:"swap"    │ ContractTr   │ DEX Router short  │ amount_in→min_amt_out    │ Swap
// call             │ execute / type:"deposit" │ ContractTr   │ pool/router short │ amount0→amount1          │ Swap (old pool)
// call             │ execute / type:"deposit" │ ContractTr   │ DEX Router short  │ amount0+amount1 (ideal)  │ Add Liquidity
// call             │ execute / type:"withdraw"│ ContractTr   │ DEX Router short  │ lp_amount (ideal)        │ Remove Liquidity
// call             │ transfer                 │ BtcMapping   │ recipient addr    │ -amount BTC              │ BTC Transfer
// call             │ unmap                    │ BtcMapping   │ BTC address       │ amount BTC               │ Withdraw
// btc-deposit      │ (indexer event)          │ BtcDeposit   │ Self / "Bitcoin"  │ +amount BTC (green)      │ BTC Deposit
// call             │ increaseAllowance        │ null/hidden  │ —                 │ —                        │ —
// call             │ map/add_blocks/etc.      │ null/hidden  │ —                 │ —                        │ — (see #16)
//
// ─── CONSISTENT FIELDS ACROSS ALL OP TYPES ───────────────────────────────────
// ALWAYS present and meaningful for the table:
//   tx.anchr_ts     — timestamp (fall back to tx.first_seen)
//   tx.status       — CONFIRMED | FAILED | UNCONFIRMED
//   tx.id           — for link/copy in detail drawer
//
// CONDITIONAL (parse from op.data or payload):
//   from / to       — present on Tr ops; absent on call/execute (use caller + contract_id)
//   amount + asset  — present on Tr ops; absent on call/execute (parse payload)
//   payload         — string JSON; only on call ops; source of swap/liquidity amounts
//   intents         — array; fallback amount source on call/execute when payload is opaque
