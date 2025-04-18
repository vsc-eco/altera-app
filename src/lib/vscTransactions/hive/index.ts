import type { CustomJsonOperation } from '@hiveio/dhive';

const sendTransaction = async (amount: string, nodeRunnerAccount: string, username: string) => {
	if (!username || !auth.value?.aioha) return 'Error: not authenticated.';
	status = 'Awaiting transaction approval…';
	if (Number(amount) == 0) return 'Error: cannot stake 0 HIVE.';
	let stakeOp = [
		'custom_json',
		{
			required_auths: [username],
			required_posting_auths: [],
			id: 'vsc.consensus_stake',
			json: JSON.stringify({
				from: `hive:${username}`,
				to: `hive:${nodeRunnerAccount}`,
				asset: 'hive',
				net_id: 'vsc-mainnet',
				amount: Asset.from(Number(amount), 'HIVE').toString().split(' ')[0]
			})
		}
	] satisfies CustomJsonOperation;
	let depositOp = [
		'transfer',
		{
			from: username,
			to: 'vsc.gateway',
			amount: Asset.from(Number(amount), 'HIVE').toString(),
			memo: `to=${nodeRunnerAccount}`
		}
	] satisfies TransferOperation;
	let tx = [];
	if (shouldDeposit) tx.push(depositOp);
	tx.push(stakeOp);
	let res = await auth.value.aioha.signAndBroadcastTx(tx, KeyTypes.Active);
	status = '';
	if (res.success) {
		return;
	} else {
		return res.error;
	}
};
