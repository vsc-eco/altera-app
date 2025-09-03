import { browser } from '$app/environment';
import { PUBLIC_VERCEL_URL } from '$env/static/public';

export const DOMAIN = browser ? window.location.host : PUBLIC_VERCEL_URL;
