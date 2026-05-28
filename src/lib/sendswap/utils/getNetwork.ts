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
	const magiSupportedNetworks: string[] = [Network.magi.value, Network.hiveMainnet.value, Network.btcMainnet.value];
	return (
		magiSupportedNetworks.includes(from.network.value) &&
		magiSupportedNetworks.includes(to.network.value)
	);
}

/**
 * Human-readable ETA for a TX that touches the given networks. Picks the
 * slowest network's `settlementSeconds` and formats it. `undefined` entries
 * (e.g. an unset `rail`) are skipped. Returns the empty string when no network
 * is provided.
 */
export function settlementLabel(networks: (Network | undefined)[]): string {
	const seconds = networks.reduce(
		(max, n) => (n ? Math.max(max, n.settlementSeconds) : max),
		-1
	);
	if (seconds < 0) return '';
	if (seconds <= 5) return 'Instant';
	if (seconds < 300) return 'About a minute';
	return `About ${Math.round(seconds / 60)} minutes`;
}
