import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import QR from './QR.svelte';

/**
 * APP-19 put a scheme allowlist on the QR payload so a hostile payload could
 * not become a navigable `javascript:`/`data:` link. HiveAuth's deeplink
 * (`has://auth_req/<base64>`) was not on that list, so the login QR rendered as
 * a non-link <div> — tapping it on a phone did nothing, which is the only place
 * the deeplink matters. These tests pin both halves.
 */
describe('QR payload scheme allowlist', () => {
	const anchorFor = (data: string) => {
		const { container } = render(QR, { props: { data } });
		return container.querySelector('a');
	};

	it('links the HiveAuth deeplink so a phone can hand it to the wallet app', () => {
		const payload = 'has://auth_req/eyJhY2NvdW50IjoidGliZm94In0=';
		expect(anchorFor(payload)?.getAttribute('href')).toBe(payload);
	});

	it('still links lightning invoices and https URLs', () => {
		expect(anchorFor('lightning:lnbc1234')?.getAttribute('href')).toBe('lightning:lnbc1234');
		expect(anchorFor('https://alterawallet.com/')?.getAttribute('href')).toBe(
			'https://alterawallet.com/'
		);
	});

	it('refuses to link a payload on any other scheme', () => {
		for (const hostile of [
			'javascript:alert(1)',
			'data:text/html,<script>alert(1)</script>',
			'file:///etc/passwd',
			'hasx://auth_req/nope',
			'http://insecure.example/'
		]) {
			expect(anchorFor(hostile), hostile).toBeNull();
		}
	});
});
