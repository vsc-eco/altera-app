import { svelteTesting } from '@testing-library/svelte/vite';
import houdini from 'houdini/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import { execSync } from 'child_process';

const isReverseProxyDev = process.env.DEV_BEHIND_PROXY === '1';

// Build-time version stamp: short git SHA + ISO timestamp.
// Used by the client to detect when a new deployment is live.
const gitSha = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'dev';
	}
})();
const buildTime = new Date().toISOString();

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(gitSha),
		__APP_BUILD_TIME__: JSON.stringify(buildTime)
	},
	plugins: [houdini(), sveltekit(), ...(isReverseProxyDev ? [] : [mkcert()])],
	// TEMPORARY (npm publishing for @vsc.eco/market-* is blocked):
	// `@vsc.eco/market-widget` installs from a self-hosted tarball, which is
	// a normal package — its react/react-dom peers resolve from OUR tree, so
	// no deduping is needed and this stays commented out.
	//
	// Re-enable it if the dep is ever switched back to a `link:` local
	// market-sdk checkout: a linked package resolves bare imports from ITS
	// own node_modules, which carries react/react-dom as devDeps, so the
	// market panel would run on a second React instance and every hook call
	// would throw "Invalid hook call".
	//
	// resolve: {
	// 	dedupe: ['react', 'react-dom']
	// },
	server: isReverseProxyDev
		? {
				host: '127.0.0.1',
				port: 3333,
				strictPort: true,
				allowedHosts: ['altera.okinoko.io'],
				hmr: {
					host: 'altera.okinoko.io',
					clientPort: 443,
					protocol: 'wss'
				}
			}
		: undefined,
	optimizeDeps: {
		exclude: ['@urql/svelte'],
		esbuildOptions: {
			plugins: [
				{
					name: 'svelte-snippet-stub',
					setup(build) {
						build.onResolve({ filter: /SendSnippets\.svelte$/ }, () => {
							return { path: 'SendSnippets.svelte', namespace: 'svelte-stub', external: true };
						});
						build.onResolve({ filter: /QuickSwap\.svelte$/ }, () => {
							return { path: 'QuickSwap.svelte', namespace: 'svelte-stub', external: true };
						});
					}
				}
			]
		}
	},
	test: {
		projects: [
			{
				extends: './vite.config.ts',
				plugins: [svelteTesting()],
				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
	// server: {
	// 	host: '0.0.0.0',
	// 	port: 5173,
	// 	https: true,
	// }
});
