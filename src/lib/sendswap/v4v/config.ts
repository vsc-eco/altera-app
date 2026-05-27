import { env as publicEnv } from '$env/dynamic/public'

const resolvedApiMode = (
	publicEnv.PUBLIC_V4VAPP_API_MODE ??
	import.meta.env.VITE_V4VAPP_API_MODE ??
	(import.meta.env as Record<string, string | undefined>).V4VAPP_API_MODE ??
	''
).toLowerCase()

export const isV4VDevMode = resolvedApiMode === 'dev'
export const V4VAPP_API_BASE = isV4VDevMode ? 'https://devapi.v4v.app' : 'https://api.v4v.app'
export const V4V_KEEPSATS_DESTINATION_ACCOUNT = isV4VDevMode ? 'devser.v4vapp' : 'v4vapp'
