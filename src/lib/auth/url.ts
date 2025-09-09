import { browser } from '$app/environment';

export const DOMAIN = browser ? window.location.host : '';
