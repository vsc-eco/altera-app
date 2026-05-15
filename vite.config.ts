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
