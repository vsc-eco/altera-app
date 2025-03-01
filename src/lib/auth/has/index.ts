import HAS from 'hive-auth-wrapper';
const APP_META = {
	name: 'VSC Frontend',
	description: '',
	icon: 'https://avatars.githubusercontent.com/u/133249767'
};
export async function getAuth(getUsername: () => Promise<string>): Promise<{
	host: string;
	connected: boolean;
	timeout: number;
}> {
	const fromLocalStorage = localStorage.getItem('hiveauth-auth');
	const auth = fromLocalStorage
		? JSON.parse(fromLocalStorage)
		: {
				username: await getUsername(), // TODO: make dynamic
				expire: undefined,
				key: undefined
			};
	await HAS.authenticate(auth, APP_META);
	const status = HAS.status();
	console.log(status);
	return status;
}
