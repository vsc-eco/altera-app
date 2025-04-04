import adapter from '@sveltejs/adapter-static';
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
		adapter: adapter(),
		env: {
			publicPrefix: '',
			privatePrefix: 'PRIVATE'
		}
	},
	compilerOptions: {
		runes: true
	}
};

export default config;
