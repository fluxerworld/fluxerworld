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

import styles from '@app/components/uikit/card_alignment_controls/CardAlignmentControls.module.css';
import type {TooltipPosition} from '@app/components/uikit/tooltip/Tooltip';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type {GuildSplashCardAlignmentValue} from '@fluxer/constants/src/GuildConstants';
import {GuildSplashCardAlignment} from '@fluxer/constants/src/GuildConstants';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import type {IconProps} from '@phosphor-icons/react';
import {TextAlignCenterIcon, TextAlignLeftIcon, TextAlignRightIcon} from '@phosphor-icons/react';
import clsx from 'clsx';
import {useMemo} from 'react';

interface CardAlignmentControlOption {
	value: GuildSplashCardAlignmentValue;
	label: MessageDescriptor;
	icon?: React.ComponentType<IconProps>;
}

interface CardAlignmentControlsProps {
	value: GuildSplashCardAlignmentValue;
	onChange: (alignment: GuildSplashCardAlignmentValue) => void;
	options?: ReadonlyArray<CardAlignmentControlOption>;
	disabled?: boolean;
	disabledTooltipText?: string;
	tooltipPosition?: TooltipPosition;
	className?: string;
}

const DEFAULT_ALIGNMENT_OPTIONS: ReadonlyArray<CardAlignmentControlOption> = [
	{value: GuildSplashCardAlignment.LEFT, label: msg`Left`, icon: TextAlignLeftIcon},
	{value: GuildSplashCardAlignment.CENTER, label: msg`Center`, icon: TextAlignCenterIcon},
	{value: GuildSplashCardAlignment.RIGHT, label: msg`Right`, icon: TextAlignRightIcon},
];

export const CardAlignmentControls: React.FC<CardAlignmentControlsProps> = ({
	value,
	onChange,
	options = DEFAULT_ALIGNMENT_OPTIONS,
	disabled = false,
	disabledTooltipText,
	tooltipPosition = 'top',
	className,
}) => {
	const {t} = useLingui();

	const translatedOptions = useMemo(() => options.map((option) => ({...option, label: t(option.label)})), [options, t]);
	const controls = (
		<div
			className={clsx(styles.controls, disabled && styles.controlsDisabled, className)}
			role="group"
			aria-label={t`Card alignment controls`}
		>
			{translatedOptions.map((option) => {
				const isActive = value === option.value;
				const Icon = option.icon;
				const handleClick = () => {
					if (disabled) return;
					onChange(option.value);
				};

				const button = (
					<button
						type="button"
						className={clsx(styles.button, isActive && styles.buttonActive, disabled && styles.buttonDisabled)}
						onClick={handleClick}
						disabled={disabled}
						aria-pressed={isActive}
						aria-label={option.label}
						title={option.label}
					>
						{Icon ? <Icon size={18} weight={isActive ? 'bold' : 'regular'} /> : option.label}
					</button>
				);

				return (
					<Tooltip key={option.value} text={option.label} position="top">
						{button}
					</Tooltip>
				);
			})}
		</div>
	);

	if (disabled && disabledTooltipText) {
		return (
			<Tooltip text={disabledTooltipText} position={tooltipPosition}>
				{controls}
			</Tooltip>
		);
	}

	return controls;
};
