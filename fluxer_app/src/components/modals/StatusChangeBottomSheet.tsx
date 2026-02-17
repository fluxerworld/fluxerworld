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

import {getStatusTypeLabel} from '@app/AppConstants';
import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import {CustomStatusDisplay} from '@app/components/common/custom_status_display/CustomStatusDisplay';
import {CustomStatusBottomSheet} from '@app/components/modals/CustomStatusBottomSheet';
import styles from '@app/components/modals/StatusChangeBottomSheet.module.css';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {StatusIndicator} from '@app/components/uikit/StatusIndicator';
import {
	getTimeWindowPresets,
	minutesToMs,
	TIME_WINDOW_FOR_LABEL_MESSAGES,
	type TimeWindowKey,
	type TimeWindowPreset,
} from '@app/constants/TimeWindowPresets';
import {normalizeCustomStatus} from '@app/lib/CustomStatus';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import PresenceStore from '@app/stores/PresenceStore';
import StatusExpiryStore from '@app/stores/StatusExpiryStore';
import UserStore from '@app/stores/UserStore';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {StatusTypes} from '@fluxer/constants/src/StatusConstants';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {CaretDownIcon, CheckIcon} from '@phosphor-icons/react';
import clsx from 'clsx';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useMemo, useState} from 'react';

const STATUS_ORDER = [StatusTypes.ONLINE, StatusTypes.IDLE, StatusTypes.DND, StatusTypes.INVISIBLE] as const;

const STATUS_DESCRIPTIONS: Record<(typeof STATUS_ORDER)[number], React.ReactNode | null> = {
	[StatusTypes.ONLINE]: null,
	[StatusTypes.IDLE]: null,
	[StatusTypes.DND]: <Trans>You won&apos;t receive notifications on desktop</Trans>,
	[StatusTypes.INVISIBLE]: <Trans>You&apos;ll appear offline</Trans>,
};

const STATUS_EXPIRY_LABEL_MESSAGES: Record<TimeWindowKey, MessageDescriptor> = {
	...TIME_WINDOW_FOR_LABEL_MESSAGES,
	never: msg`Until I change it`,
};

interface StatusExpiryOption {
	id: TimeWindowKey;
	key: TimeWindowKey;
	label: MessageDescriptor;
	durationMs: number | null;
}

const getStatusExpiryOptions = (includeDeveloperOptions: boolean): ReadonlyArray<StatusExpiryOption> =>
	getTimeWindowPresets({includeDeveloperOptions}).map((preset: TimeWindowPreset) => ({
		id: preset.key,
		key: preset.key,
		label: STATUS_EXPIRY_LABEL_MESSAGES[preset.key],
		durationMs: minutesToMs(preset.minutes),
	}));

const STATUS_SHEET_SNAP_POINTS: Array<number> = [0, 0.75, 1];

interface StatusChangeBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
}

interface StatusItemProps {
	status: StatusType;
	currentStatus: StatusType;
	expiryOptions: ReadonlyArray<StatusExpiryOption>;
	onSelect: (status: StatusType, durationMs: number | null) => void;
}

const StatusItem = observer(({status, currentStatus, expiryOptions, onSelect}: StatusItemProps) => {
	const {i18n} = useLingui();
	const isSelected = currentStatus === status;
	const description = STATUS_DESCRIPTIONS[status as keyof typeof STATUS_DESCRIPTIONS];
	const hasExpiryOptions = status !== StatusTypes.ONLINE;
	const [showExpiry, setShowExpiry] = useState(false);

	const handleSelect = () => {
		if (hasExpiryOptions) {
			setShowExpiry(!showExpiry);
		} else {
			onSelect(status, null);
		}
	};

	const handleExpirySelect = (durationMs: number | null) => {
		onSelect(status, durationMs);
		setShowExpiry(false);
	};

	return (
		<div className={styles.statusItemWrapper}>
			<button type="button" onClick={handleSelect} className={styles.statusItemButton}>
				<div className={styles.statusItemContent}>
					<StatusIndicator status={status} size={14} monochromeColor="var(--brand-primary-fill)" />
					<div className={styles.statusItemInfo}>
						<span className={styles.statusLabel}>{getStatusTypeLabel(i18n, status)}</span>
						{description && <span className={styles.statusDescription}>{description}</span>}
					</div>
				</div>
				<div className={styles.statusItemRight}>
					{isSelected && (
						<div className={styles.selectedIndicator}>
							<CheckIcon weight="bold" className={styles.checkIcon} />
						</div>
					)}
					{hasExpiryOptions && (
						<CaretDownIcon
							weight="bold"
							className={clsx(styles.chevronIcon, showExpiry && styles.chevronIconExpanded)}
						/>
					)}
				</div>
			</button>
			{showExpiry && (
				<div className={styles.expiryList}>
					{expiryOptions.map((option: StatusExpiryOption) => (
						<button
							key={option.id}
							type="button"
							className={styles.expiryItem}
							onClick={() => handleExpirySelect(option.durationMs)}
						>
							{i18n._(option.label)}
						</button>
					))}
				</div>
			)}
		</div>
	);
});

interface CustomStatusSectionProps {
	onOpenEditor: () => void;
}

const CustomStatusSection = observer(({onOpenEditor}: CustomStatusSectionProps) => {
	const currentUser = UserStore.getCurrentUser();
	const currentUserId = currentUser?.id ?? null;
	const existingCustomStatus = currentUserId ? PresenceStore.getCustomStatus(currentUserId) : null;
	const normalizedExisting = normalizeCustomStatus(existingCustomStatus);
	const hasExistingStatus = Boolean(normalizedExisting);

	const [isSaving, setIsSaving] = useState(false);

	if (!hasExistingStatus || !normalizedExisting) {
		return null;
	}

	const handleClear = async () => {
		if (isSaving) return;

		setIsSaving(true);
		try {
			await UserSettingsActionCreators.update({customStatus: null});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className={styles.customStatusSection}>
			<div className={styles.customStatusHeader}>
				<span className={styles.customStatusTitle}>
					<Trans>Custom Status</Trans>
				</span>
			</div>
			<button type="button" className={styles.customStatusButton} onClick={onOpenEditor}>
				<CustomStatusDisplay
					customStatus={normalizedExisting}
					showText={true}
					showTooltip={false}
					animateOnParentHover
				/>
			</button>
			<button type="button" className={styles.clearCustomStatusButton} onClick={handleClear} disabled={isSaving}>
				<Trans>Clear Custom Status</Trans>
			</button>
		</div>
	);
});

export const StatusChangeBottomSheet = observer(({isOpen, onClose}: StatusChangeBottomSheetProps) => {
	const {t} = useLingui();
	const currentUser = UserStore.getCurrentUser();
	const currentUserId = currentUser?.id ?? null;
	const status = currentUserId ? PresenceStore.getStatus(currentUserId) : StatusTypes.ONLINE;
	const [customStatusSheetOpen, setCustomStatusSheetOpen] = useState(false);
	const isDeveloper = DeveloperModeStore.isDeveloper;
	const statusExpiryOptions = useMemo(() => getStatusExpiryOptions(isDeveloper), [isDeveloper]);

	const handleStatusChange = useCallback(
		(statusType: StatusType, durationMs: number | null) => {
			StatusExpiryStore.setActiveStatusExpiry({
				status: statusType,
				durationMs,
			});
			onClose();
		},
		[onClose],
	);

	const handleOpenCustomStatusEditor = useCallback(() => {
		setCustomStatusSheetOpen(true);
	}, []);

	const handleCloseCustomStatusEditor = useCallback(() => {
		setCustomStatusSheetOpen(false);
	}, []);

	return (
		<>
			<BottomSheet
				isOpen={isOpen}
				onClose={onClose}
				snapPoints={STATUS_SHEET_SNAP_POINTS}
				initialSnap={STATUS_SHEET_SNAP_POINTS.length - 1}
				title={t`Set Status`}
			>
				<div className={styles.content}>
					<div className={styles.topSpacer} />

					<CustomStatusSection onOpenEditor={handleOpenCustomStatusEditor} />

					<div className={styles.statusSection}>
						<div className={styles.sectionHeader}>
							<Trans>Online Status</Trans>
						</div>
						<div className={styles.statusContainer}>
							{STATUS_ORDER.map((statusType, index, arr) => (
								<React.Fragment key={statusType}>
									<StatusItem
										status={statusType}
										currentStatus={status}
										expiryOptions={statusExpiryOptions}
										onSelect={handleStatusChange}
									/>
									{index < arr.length - 1 && <div className={styles.divider} />}
								</React.Fragment>
							))}
						</div>
					</div>
				</div>
			</BottomSheet>
			<CustomStatusBottomSheet isOpen={customStatusSheetOpen} onClose={handleCloseCustomStatusEditor} />
		</>
	);
});
