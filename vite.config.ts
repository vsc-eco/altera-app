import { svelteTesting } from '@testing-library/svelte/vite';
import houdini from 'houdini/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
	plugins: [houdini(), sveltekit()],
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
