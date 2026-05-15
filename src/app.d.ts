// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/** Build-time constants injected by Vite (see vite.config.ts `define`). */
declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: string;

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

