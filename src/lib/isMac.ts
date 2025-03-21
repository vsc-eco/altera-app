import { browser } from '$app/environment';

export const isMac = browser
	? /mac/i.test(navigator.userAgent ? navigator.userAgent : navigator.platform)
	: 'unk';
