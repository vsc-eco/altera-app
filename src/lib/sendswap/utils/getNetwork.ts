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
	if (throughMagi(from, to)) {
		return Network.magi;
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

function throughMagi(from: CoinOnNetwork, to: CoinOnNetwork) {
	if (throughHive(from, to)) {
		return false;
	}
	const magiSupportedNetworks: string[] = [Network.magi.value, Network.hiveMainnet.value];
	return (
		magiSupportedNetworks.includes(from.network.value) &&
		magiSupportedNetworks.includes(to.network.value)
	);
}
