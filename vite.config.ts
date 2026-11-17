import { svelteTesting } from '@testing-library/svelte/vite';
import houdini from 'houdini/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import { execSync } from 'child_process';

const isReverseProxyDev = process.env.DEV_BEHIND_PROXY === '1';

// mkcert exists only to hand the local dev server a trusted HTTPS certificate.
// Loading it is not free: vite-plugin-mkcert asks the GitHub API for the latest
// mkcert release every time Vite resolves this config. From a CI runner that
// request is unauthenticated and shares an IP with every other runner, so it is
// rate-limited to 403 — and because it happens during config load, Vite never
// starts and `pnpm test` dies before a single test runs:
//
//   Startup Error
//   AxiosError: Request failed with status code 403
//       at async _GithubSource.getSourceInfo (vite-plugin-mkcert/dist/mkcert.mjs:261)
//
// That is what failed the deploy of 9398991 (run 43655565523) and of fce0ffc
// before it — in both cases the tests themselves were fine. Neither `vitest`
// nor a production build serves anything over HTTPS, so skip it there and keep
// it for `vite dev`, which is the only thing that wants it.
const useMkcert = !isReverseProxyDev && !process.env.VITEST && !process.env.CI;

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
	plugins: [houdini(), sveltekit(), ...(useMkcert ? [mkcert()] : [])],
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
