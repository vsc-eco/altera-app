import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Aioha, KeyTypes } from '@aioha/aioha';
import { MagiQuickSwap } from '@magi/widget';

function DemoApp() {
	const [aioha, setAioha] = useState<Aioha | null>(null);
	const [username, setUsername] = useState<string | undefined>(undefined);
	const [lastTx, setLastTx] = useState<string | null>(null);

	useEffect(() => {
		const instance = new Aioha();
		instance.registerKeychain();
		instance.registerHiveSigner({
			app: 'magi-sdk-demo',
			callbackURL: typeof window !== 'undefined' ? window.location.origin : ''
		});
		instance.registerHiveAuth({ name: 'magi-sdk-demo' });
		const existing = instance.loadAuth();
		if (existing) {
			setUsername(instance.getCurrentUser() ?? undefined);
		}
		setAioha(instance);
	}, []);

	async function connect() {
		if (!aioha) return;
		const providers = aioha.getProviders();
		const firstAvail =
			providers.find((p) => p === 'keychain') ??
			providers.find((p) => p === 'hiveauth') ??
			providers[0];
		if (!firstAvail) return;
		const user = window.prompt('Hive username:');
		if (!user) return;
		const res = await aioha.login(firstAvail, user, {
			msg: 'Sign in to Magi QuickSwap demo',
			keyType: KeyTypes.Posting
		});
		if (res.success) {
			setUsername(aioha.getCurrentUser() ?? user);
		} else {
			alert(`Login failed: ${res.error}`);
		}
	}

	async function disconnect() {
		if (!aioha) return;
		await aioha.logout();
		setUsername(undefined);
	}

	return (
		<div>
			<div className="status-bar">
				<span>
					Wallet:{' '}
					{username ? (
						<>
							<code>@{username}</code>{' '}
							<button onClick={disconnect}>Disconnect</button>
						</>
					) : (
						<button onClick={connect}>Connect Keychain</button>
					)}
				</span>
				<span>Network: mainnet</span>
			</div>
			{aioha && (
				<MagiQuickSwap
					aioha={aioha}
					username={username}
					keyType={KeyTypes.Active}
					onSuccess={(tx) => setLastTx(tx)}
				/>
			)}
			{lastTx && (
				<p style={{ marginTop: 16, fontSize: 13 }}>
					Last tx: <a href={`https://vsc.techcoderx.com/tx/${lastTx}`} target="_blank" rel="noopener noreferrer"><code>{lastTx}</code></a>
				</p>
			)}
		</div>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<DemoApp />
	</React.StrictMode>
);
