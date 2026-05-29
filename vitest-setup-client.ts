import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// SvelteKit's $env/dynamic/public is a virtual module not provided under
// jsdom Vitest; stub it so files that transitively import it (e.g.
// sendswap/v4v/config.ts) can load in client tests.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// add more mocks here if you need them
