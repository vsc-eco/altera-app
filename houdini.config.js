/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
// const GQL_URL = 'http://127.0.0.1:8080'; // for running backend locally
const GQL_URL = 'https://api.vsc.eco';

const config = {
	watchSchema: {
		url: (GQL_URL || 'https://api.vsc.eco') + '/api/v1/graphql'
	},
	runtimeDir: '.houdini',
	plugins: {
		'houdini-svelte': {
			forceRunesMode: true,
			static: true
		}
	},
	features: {
		imperativeCache: false
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
