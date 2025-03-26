import houdini from "houdini/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
	plugins: [houdini(), sveltekit(), mkcert()],
	optimizeDeps: {
		exclude: ['@urql/svelte']
	}
});
