// A styled "self-XSS" warning printed to the browser console on app load.
//
// The classic scam: someone tells a user to open devtools and paste a snippet
// to "verify", "unlock", or "boost" their wallet. In a non-custodial wallet
// that snippet can read keys / sign transactions and drain funds. Big sites
// (Facebook, Google, Discord…) print a warning like this for exactly this
// reason. Console-only, so it costs nothing for normal users but is right
// there for anyone who's been talked into opening the console.

let shown = false;

export function showConsoleSecurityWarning(): void {
	// Browser-only, and only once per page load (guards against re-mounts/HMR).
	if (typeof window === 'undefined' || shown) return;
	shown = true;

	const title = [
		'color:#ff3b30',
		'font-size:40px',
		'font-weight:800',
		'text-shadow:1px 1px 0 rgba(0,0,0,0.25)',
		'padding:4px 0'
	].join(';');
	const body = 'font-size:15px;line-height:1.5;';
	const brand = 'font-size:14px;color:#6F6AF8;font-weight:600;';

	// eslint-disable-next-line no-console
	console.log('%c⛔ Stop!', title);
	// eslint-disable-next-line no-console
	console.log(
		'%cThis console is for developers. If someone told you to paste something here to ' +
			'"verify", "unlock", or "boost" your wallet, it is a scam, and it can hand them your ' +
			'keys and drain your funds. Never paste code you do not understand.',
		body
	);
	// eslint-disable-next-line no-console
	console.log(
		'%cAltera is non-custodial: your keys, your coins. Let us keep it that way. 🔐',
		brand
	);
}
