/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {Input} from '@app/components/form/Input';
import styles from '@app/components/modals/shared/CopyLinkSection.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {useLingui} from '@lingui/react/macro';
import {type ComponentProps, type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState} from 'react';

interface CopyLinkSectionProps {
	label: ReactNode;
	value: string;
	placeholder?: string;
	onCopy?: () => Promise<boolean>;
	copyDisabled?: boolean;
	onInputClick?: (event: MouseEvent<HTMLInputElement>) => void;
	rightElement?: ReactNode;
	inputProps?: Partial<ComponentProps<typeof Input>>;
	children?: ReactNode;
}

export const CopyLinkSection = ({
	label,
	value,
	placeholder,
	onCopy,
	copyDisabled,
	onInputClick,
	rightElement,
	inputProps,
	children,
}: CopyLinkSectionProps) => {
	const {t} = useLingui();
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const buttonLabel = copied ? t`Copied!` : t`Copy`;
	const handleCopy = useCallback(async () => {
		if (!onCopy) return;
		const success = await onCopy();
		if (!success) return;
		setCopied(true);
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			setCopied(false);
		}, 3000);
	}, [onCopy]);

	useEffect(() => {
		if (!value) {
			setCopied(false);
		}
	}, [value]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);
	const defaultRightElement = onCopy && (
		<Button compact fitContent onClick={handleCopy} disabled={!value || copyDisabled}>
			{buttonLabel}
		</Button>
	);

	return (
		<div className={styles.linkFooter}>
			<p className={styles.linkSectionLabel}>{label}</p>
			<Input
				readOnly
				value={value}
				placeholder={placeholder}
				onClick={onInputClick}
				rightElement={rightElement ?? defaultRightElement}
				{...inputProps}
			/>
			{children}
		</div>
	);
};
