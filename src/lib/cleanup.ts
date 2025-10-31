export function cleanOldLocalStorage() {
	const connectedConnector = '@appkit/eip155:connected_connector_id';
	const connectedConnectorVal = localStorage.getItem(connectedConnector);
	if (connectedConnectorVal === 'ID_AUTH') localStorage.removeItem(connectedConnector);

	const wagmiRecent = 'wagmi.recentConnectorId';
	const wagmiRecentVal = localStorage.getItem(wagmiRecent);
	if (wagmiRecentVal === 'ID_AUTH') localStorage.removeItem(wagmiRecent);

	const connectedSocial = '@appkit/connected_social';
	const connectedSocialVal = localStorage.getItem(connectedSocial);
	if (connectedSocialVal === 'x') localStorage.removeItem(connectedSocial);

	const connections = '@appkit/connections';
	const connectionsString = localStorage.getItem(connections);
	const connectionsObj = connectionsString ? JSON.parse(connectionsString) : [];
	const eip155Array = connectionsObj.eip155;
	if (eip155Array) {
		for (const element of eip155Array) {
			if (element.connectorId === 'ID_AUTH') {
				localStorage.removeItem(connections);
				break;
			}
		}
	}

	const notifications = localStorage.getItem('notifications');
	if (notifications) {
		console.log('notifications string', notifications);
		if (notifications.includes('null')) {
			localStorage.removeItem('notifications');
			return;
		}
		const array: [string, Notification][] = JSON.parse(notifications);
		for (const [_, ntf] of array) {
			if (!ntf || 'anchr_height' in ntf) {
				localStorage.removeItem('notifications');
				break;
			}
		}
	}
}
