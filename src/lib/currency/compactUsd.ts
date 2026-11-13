import { numberFormatLanguage } from '$lib/constants';

/**
 * A short USD form for axis ticks, where the label has to fit a fixed gutter.
 *
 * Thousands collapse to "K" and sub-dollar values keep enough decimals to stay
 * distinct — LP fee revenue on a small position is routinely fractions of a
 * cent, and a tick axis reading "$0.00, $0.00, $0.00" is worse than no axis.
 * Use `toLocaleString` with explicit decimals for the values a reader actually
 * reads (legend, tooltip, headline); this is only for ticks.
 */
export function compactUsd(value: number): string {
	const abs = Math.abs(value);
	if (abs >= 1_000_000) return sign(value) + '$' + round(abs / 1_000_000) + 'M';
	if (abs >= 1_000) return sign(value) + '$' + round(abs / 1_000) + 'K';
	if (abs === 0) return '$0';
	if (abs >= 1) return sign(value) + '$' + round(abs);
	// Below a dollar, keep 2 significant digits so adjacent ticks differ.
	return (
		sign(value) +
		'$' +
		abs.toLocaleString(numberFormatLanguage, { maximumSignificantDigits: 2 })
	);
}

function round(n: number): string {
	return n.toLocaleString(numberFormatLanguage, { maximumFractionDigits: n >= 10 ? 0 : 1 });
}

function sign(v: number): string {
	return v < 0 ? '-' : '';
}
