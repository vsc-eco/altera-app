import { type CoinOnNetwork, type IntermediaryNetwork, Network } from './sendOptions';

export function getIntermediaryNetwork(
	from: CoinOnNetwork,
	to: CoinOnNetwork
): IntermediaryNetwork {
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

function throughLightning(from: CoinOnNetwork, to: CoinOnNetwork) {
	return (
		from.network.value == Network.lightning.value || to.network.value == Network.lightning.value
	);
}

function throughHive(from: CoinOnNetwork, to: CoinOnNetwork) {
	return (
		from.network.value == Network.hiveMainnet.value && to.network.value == Network.hiveMainnet.value
	);
}

function throughVsc(from: CoinOnNetwork, to: CoinOnNetwork) {
	if (throughHive(from, to)) {
		return false;
	}
	const vscSupportedNetworks: string[] = [Network.vsc.value, Network.hiveMainnet.value];
	return (
		vscSupportedNetworks.includes(from.network.value) &&
		vscSupportedNetworks.includes(to.network.value)
	);
}
