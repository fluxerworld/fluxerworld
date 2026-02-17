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

import {Switch as UISwitch} from '@app/components/form/Switch';
import styles from '@app/components/modals/shared/PermissionComponents.module.css';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import PermissionLayoutStore from '@app/stores/PermissionLayoutStore';
import type * as PermissionUtils from '@app/utils/PermissionUtils';
import {useLingui} from '@lingui/react/macro';
import {CheckIcon, MinusIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export type PermissionState = 'ALLOW' | 'DENY' | 'NEUTRAL';
export function getPermissionState(permission: bigint, allow: bigint, deny: bigint): PermissionState {
	if ((deny & permission) === permission) return 'DENY';
	if ((allow & permission) === permission) return 'ALLOW';
	return 'NEUTRAL';
}

export const PermissionStateButtons: React.FC<{
	currentState?: PermissionState;
	onStateChange: (state: PermissionState) => void;
	disabled: boolean;
	showActiveState?: boolean;
}> = observer(({currentState, onStateChange, disabled, showActiveState = true}) => {
	const {t} = useLingui();
	const getButtonClasses = (state: PermissionState) => {
		const isActive = showActiveState && currentState === state;
		const classes = [styles.stateButton, disabled ? styles.stateButtonDisabled : styles.stateButtonEnabled];

		if (isActive) {
			if (state === 'DENY') {
				classes.push(styles.stateButtonDeny);
			} else if (state === 'NEUTRAL') {
				classes.push(styles.stateButtonNeutral);
			} else {
				classes.push(styles.stateButtonAllow);
			}
		} else {
			classes.push(styles.stateButtonInactive);
		}

		return classes.join(' ');
	};

	return (
		<div className={styles.stateButtonsContainer}>
			<button
				type="button"
				className={getButtonClasses('DENY')}
				onClick={() => !disabled && onStateChange('DENY')}
				disabled={disabled}
				title={t`Deny`}
			>
				<XIcon weight="bold" size={16} />
			</button>
			<div className={styles.stateDivider} />
			<button
				type="button"
				className={getButtonClasses('NEUTRAL')}
				onClick={() => !disabled && onStateChange('NEUTRAL')}
				disabled={disabled}
				title={t`Neutral (Inherit)`}
			>
				<MinusIcon weight="bold" size={16} />
			</button>
			<div className={styles.stateDivider} />
			<button
				type="button"
				className={getButtonClasses('ALLOW')}
				onClick={() => !disabled && onStateChange('ALLOW')}
				disabled={disabled}
				title={t`Allow`}
			>
				<CheckIcon weight="bold" size={16} />
			</button>
		</div>
	);
});

export const PermissionHelpLink: React.FC<{onClick: () => void; children: React.ReactNode}> = ({onClick, children}) => {
	return (
		<button
			type="button"
			className={styles.permissionHelpLink}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			{children}
		</button>
	);
};

const PermissionOverwriteToggle: React.FC<{
	title: string;
	description?: string;
	permission: bigint;
	allow: bigint;
	deny: bigint;
	onChange: (state: PermissionState) => void;
	disabled: boolean;
	disabledReason?: string;
	warning?: string;
	extra?: React.ReactNode;
}> = observer(({title, description, permission, allow, deny, onChange, disabled, disabledReason, warning, extra}) => {
	const state = getPermissionState(permission, allow, deny);
	const buttons = <PermissionStateButtons currentState={state} onStateChange={onChange} disabled={disabled} />;
	const buttonsTooltipTrigger = <div className={styles.tooltipTriggerInline}>{buttons}</div>;
	const showDescription = PermissionLayoutStore.isComfy;
	const tooltipText = (disabled && disabledReason) || warning;

	return (
		<div className={clsx(styles.overwriteToggle, PermissionLayoutStore.isDense && styles.overwriteToggleDense)}>
			<div className={styles.overwriteToggleContent}>
				<div
					className={clsx(
						styles.overwriteToggleTitle,
						disabled ? styles.overwriteToggleTitleDisabled : styles.overwriteToggleTitleEnabled,
					)}
				>
					{title}
				</div>
				{showDescription && description && <p className={styles.overwriteToggleDescription}>{description}</p>}
				{extra}
			</div>
			<div className={styles.overwriteToggleActions}>
				{tooltipText ? <Tooltip text={tooltipText}>{buttonsTooltipTrigger}</Tooltip> : buttons}
			</div>
		</div>
	);
});

export const PermissionOverwriteCategory: React.FC<{
	spec: PermissionUtils.PermissionSpec;
	allow: bigint;
	deny: bigint;
	onPermissionChange: (permission: bigint, state: PermissionState) => void;
	disabled: boolean;
	getPermissionDisabledReason?: (permission: bigint) => string | undefined;
	getPermissionWarning?: (permission: bigint) => string | undefined;
	getPermissionExtra?: (permission: bigint, state: PermissionState) => React.ReactNode;
	isFirst?: boolean;
}> = observer(
	({
		spec,
		allow,
		deny,
		onPermissionChange,
		disabled,
		getPermissionDisabledReason,
		getPermissionWarning,
		getPermissionExtra,
		isFirst,
	}) => {
		return (
			<div className={styles.categoryContainer}>
				{!isFirst && <div className={styles.categoryDivider} />}
				<h3 className={styles.categoryTitle}>{spec.title}</h3>
				<div
					className={clsx(
						styles.categoryPermissions,
						PermissionLayoutStore.isDense && styles.categoryPermissionsDense,
						PermissionLayoutStore.isGrid && styles.categoryPermissionsGrid,
					)}
				>
					{spec.permissions.map((perm) => {
						const permDisabledReason = getPermissionDisabledReason?.(perm.flag);
						const isPermDisabled = disabled || permDisabledReason !== undefined;
						const permWarning = getPermissionWarning?.(perm.flag);
						const permState = getPermissionState(perm.flag, allow, deny);
						const permExtra = getPermissionExtra?.(perm.flag, permState);
						return (
							<PermissionOverwriteToggle
								key={perm.flag.toString()}
								title={perm.title}
								description={perm.description}
								permission={perm.flag}
								allow={allow}
								deny={deny}
								onChange={(state) => onPermissionChange(perm.flag, state)}
								disabled={isPermDisabled}
								disabledReason={permDisabledReason}
								warning={permWarning}
								extra={permExtra}
							/>
						);
					})}
				</div>
			</div>
		);
	},
);

const PermissionRoleToggle: React.FC<{
	title: string;
	description?: string;
	permission: bigint;
	rolePermissions: bigint;
	onToggle: (permission: bigint) => void;
	disabled: boolean;
	disabledReason?: string;
	warning?: string;
	extra?: React.ReactNode;
}> = observer(
	({title, description, permission, rolePermissions, onToggle, disabled, disabledReason, warning, extra}) => {
		const enabled = (rolePermissions & permission) === permission;
		const showDescription = PermissionLayoutStore.isComfy;

		const switchEl = (
			<UISwitch
				label={title}
				description={showDescription ? description : undefined}
				value={enabled}
				onChange={() => onToggle(permission)}
				disabled={disabled}
				compact={PermissionLayoutStore.isDense}
			/>
		);
		const switchTooltipTrigger = <div className={styles.tooltipTriggerBlock}>{switchEl}</div>;
		const tooltipText = (disabled && disabledReason) || warning;

		return (
			<div className={clsx(styles.roleToggle, PermissionLayoutStore.isDense && styles.roleToggleDense)}>
				{tooltipText ? <Tooltip text={tooltipText}>{switchTooltipTrigger}</Tooltip> : switchEl}
				{extra}
			</div>
		);
	},
);

export const PermissionRoleCategory: React.FC<{
	spec: PermissionUtils.PermissionSpec;
	rolePermissions: bigint;
	onPermissionToggle: (permission: bigint) => void;
	disabled: boolean;
	getPermissionDisabledReason?: (permission: bigint) => string | undefined;
	getPermissionWarning?: (permission: bigint) => string | undefined;
	getPermissionExtra?: (permission: bigint, enabled: boolean) => React.ReactNode;
	isFirst?: boolean;
}> = observer(
	({
		spec,
		rolePermissions,
		onPermissionToggle,
		disabled,
		getPermissionDisabledReason,
		getPermissionWarning,
		getPermissionExtra,
		isFirst,
	}) => {
		return (
			<div className={styles.roleCategoryContainer}>
				{!isFirst && <div className={styles.roleCategoryDivider} />}
				<h3 className={styles.roleCategoryTitle}>{spec.title}</h3>
				<div
					className={clsx(
						styles.roleCategoryPermissions,
						PermissionLayoutStore.isDense && styles.roleCategoryPermissionsDense,
						PermissionLayoutStore.isGrid && styles.roleCategoryPermissionsGrid,
					)}
				>
					{spec.permissions.map((perm) => {
						const permDisabledReason = getPermissionDisabledReason?.(perm.flag);
						const isPermDisabled = disabled || permDisabledReason !== undefined;
						const permWarning = getPermissionWarning?.(perm.flag);
						const permEnabled = (rolePermissions & perm.flag) === perm.flag;
						const permExtra = getPermissionExtra?.(perm.flag, permEnabled);
						return (
							<PermissionRoleToggle
								key={perm.flag.toString()}
								title={perm.title}
								description={perm.description}
								permission={perm.flag}
								rolePermissions={rolePermissions}
								onToggle={onPermissionToggle}
								disabled={isPermDisabled}
								disabledReason={permDisabledReason}
								warning={permWarning}
								extra={permExtra}
							/>
						);
					})}
				</div>
			</div>
		);
	},
);

export const getRoleColor = (color: number): string => {
	return `#${color.toString(16).padStart(6, '0')}`;
};

export const DEFAULT_ROLE_COLOR_HEX = '#99aab5';

export const sortRolesByPosition = <T extends {id: string; position: number}>(roles: Array<T>): Array<T> => {
	return roles.sort((a, b) => {
		if (b.position !== a.position) {
			return b.position - a.position;
		}
		return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
	});
};
