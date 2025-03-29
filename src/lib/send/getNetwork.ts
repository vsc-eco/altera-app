import { type CoinOnNetwork, Network } from './sendOptions';

export function getIntermediaryNetwork(from: CoinOnNetwork, to: CoinOnNetwork): Network {
	if (throughLightning(from, to)) {
		return Network.lightning;
	}
	return Network.unknown;
}

function throughLightning(from: CoinOnNetwork, to: CoinOnNetwork) {
	return from.network == Network.lightning || to.network == Network.lightning;
}
