import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		prerender: {
			handleHttpError: 'warn'
		},
		alias: {
			'@styles': 'src/styles',
			$houdini: '.houdini/'
		},
		// ALTERA_BUILD_OUT lets a preview build go somewhere other than the
		// `build/` the running dev server is serving from.
		adapter: adapter({ out: process.env.ALTERA_BUILD_OUT || 'build' })
	},
	compilerOptions: {
		runes: true
	}
};

export default config;
