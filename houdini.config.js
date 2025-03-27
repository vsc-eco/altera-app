/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
	watchSchema: {
		url: 'https://api.vsc.eco/api/v1/graphql'
	},
	runtimeDir: '.houdini',
	plugins: {
		'houdini-svelte': {
			forceRunesMode: true,
			static: true
		}
	},

	forceRunesMode: true,
	defaultPaginateMode: 'Infinite'
};

export default config;
