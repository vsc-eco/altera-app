import { browser } from '$app/environment';
import { VERCEL_URL } from '$env/static/public';

export const DOMAIN = browser ? window.location.host : VERCEL_URL;
