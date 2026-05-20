// place files you want to import through the `$lib` alias in this folder.

/**
 * APP-14: Strip Unicode bidirectional/control characters from user-supplied
 * text (e.g. transaction memos) before rendering, to prevent visual spoofing
 * (bidi override / isolate) and control-character injection.
 *
 * Removed ranges:
 *  - U+200E / U+200F  LRM / RLM
 *  - U+202A - U+202E  bidi embeddings & overrides
 *  - U+2066 - U+2069  bidi isolates
 *  - U+0000 - U+0008  C0 controls (NUL..BS)
 *  - U+000B / U+000C  VT, FF
 *  - U+000E - U+001F  remaining C0 controls
 *  - U+007F - U+009F  DEL + C1 controls
 *
 * Ordinary whitespace (U+0009 tab, U+000A LF, U+000D CR) is intentionally
 * preserved.
 */
const BIDI_CONTROL_RE = new RegExp(
	'[' +
		'\\u200E\\u200F' +
		'\\u202A-\\u202E' +
		'\\u2066-\\u2069' +
		'\\u0000-\\u0008' +
		'\\u000B\\u000C' +
		'\\u000E-\\u001F' +
		'\\u007F-\\u009F' +
		']',
	'g'
);

export function sanitizeBidiText(input: string | undefined | null): string {
	if (!input) return '';
	return input.replace(BIDI_CONTROL_RE, '');
}
