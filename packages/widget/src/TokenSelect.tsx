import { useCallback, useEffect, useRef, useState } from 'react';
import type { SwapAsset } from '@magi/sdk';

import hiveIcon from './assets/hive.svg';
import hbdIcon from './assets/hbd.svg';
import btcIcon from './assets/btc.svg';

const ICONS: Record<SwapAsset, string> = {
	HIVE: hiveIcon,
	HBD: hbdIcon,
	BTC: btcIcon
};
const NAMES: Record<SwapAsset, string> = {
	HIVE: 'HIVE',
	HBD: 'HBD',
	BTC: 'Bitcoin'
};

interface Props {
	value: SwapAsset;
	options: SwapAsset[];
	disabledOptions?: SwapAsset[];
	onChange: (v: SwapAsset) => void;
	disabled?: boolean;
}

export function TokenSelect({ value, options, disabledOptions = [], onChange, disabled }: Props) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const toggle = useCallback(() => {
		if (!disabled) setOpen((o) => !o);
	}, [disabled]);

	useEffect(() => {
		if (!open) return;
		function onClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener('mousedown', onClickOutside);
		return () => document.removeEventListener('mousedown', onClickOutside);
	}, [open]);

	return (
		<div className="magi-qs-token-dropdown" ref={ref}>
			<button type="button" className="magi-qs-token-trigger" onClick={toggle} disabled={disabled}>
				<img src={ICONS[value]} alt="" className="magi-qs-token-img" />
				<span className="magi-qs-token-name">{value}</span>
				<svg
					className="magi-qs-token-chevron"
					width="10"
					height="10"
					viewBox="0 0 10 10"
					fill="none"
				>
					<path
						d="M2.5 3.75L5 6.25L7.5 3.75"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
			{open && (
				<div className="magi-qs-token-menu">
					{options.map((asset) => {
						const isDisabled = disabledOptions.includes(asset);
						const isSelected = asset === value;
						return (
							<button
								key={asset}
								type="button"
								className={`magi-qs-token-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
								disabled={isDisabled}
								onClick={() => {
									onChange(asset);
									setOpen(false);
								}}
							>
								<img src={ICONS[asset]} alt="" className="magi-qs-token-img" />
								<div className="magi-qs-token-option-text">
									<span className="magi-qs-token-name">{asset}</span>
									<span className="magi-qs-token-fullname">{NAMES[asset]}</span>
								</div>
								{isSelected && (
									<svg
										className="magi-qs-token-check"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
