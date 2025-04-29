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
	scalars: {
		/* in your case, something like */
		Uint64: {
			// <- The GraphQL Scalar
			type: 'number' // <-  The TypeScript type
		},
		Int64: {
			// <- The GraphQL Scalar
			type: 'number' // <-  The TypeScript type
		},
		Map: {
			// <- The GraphQL Scalar
			type: '{ type: string } & any' // <-  The TypeScript type
		}
	},
	forceRunesMode: true,
	defaultPaginateMode: 'Infinite'
};

export default config;
