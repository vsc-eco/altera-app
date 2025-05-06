import { type CoinOnNetwork, type IntermediaryNetwork, Network } from './sendOptions';

export function getIntermediaryNetwork(
	from: CoinOnNetwork,
	to: CoinOnNetwork
): IntermediaryNetwork {
	if (throughBoltz(from, to)) {
		return Network.boltzLightning;
	}
	if (throughLightning(from, to)) {
		return Network.lightning;
	}
	if (throughHive(from, to)) {
		return Network.hiveMainnet;
	}
	if (throughVsc(from, to)) {
		return Network.vsc;
	}
	return Network.unknown;
}
function throughBoltz(from: CoinOnNetwork, _to: CoinOnNetwork) {
	return from.network == Network.btcMainnet;
}
function throughLightning(from: CoinOnNetwork, to: CoinOnNetwork) {
	return from.network == Network.lightning || to.network == Network.lightning;
}

function throughHive(from: CoinOnNetwork, to: CoinOnNetwork) {
	return from.network == Network.hiveMainnet && to.network == Network.hiveMainnet;
}

function throughVsc(from: CoinOnNetwork, to: CoinOnNetwork) {
	if (throughHive(from, to)) {
		return false;
	}
	const vscSupportedNetworks: Network[] = [Network.vsc, Network.hiveMainnet];
	return vscSupportedNetworks.includes(from.network) && vscSupportedNetworks.includes(to.network);
}
