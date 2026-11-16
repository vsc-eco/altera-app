import { describe, expect, it } from 'vitest';
import { isPublicRoute } from './publicRoutes';

describe('isPublicRoute', () => {
	it('lets a logged-out visitor see swap and pools', () => {
		expect(isPublicRoute('/')).toBe(true);
		expect(isPublicRoute('/pools')).toBe(true);
		expect(isPublicRoute('/login')).toBe(true);
	});

	it('keeps everything that shows an account behind the guard', () => {
		for (const p of ['/portfolio', '/transactions', '/transfer', '/deposit', '/withdraw', '/stake', '/dashboard', '/preferences']) {
			expect(isPublicRoute(p)).toBe(false);
		}
	});
});
