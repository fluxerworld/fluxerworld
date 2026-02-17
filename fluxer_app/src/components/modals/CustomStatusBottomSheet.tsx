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

import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import {Input} from '@app/components/form/Input';
import styles from '@app/components/modals/CustomStatusBottomSheet.module.css';
import {ExpressionPickerSheet} from '@app/components/modals/ExpressionPickerSheet';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {Button} from '@app/components/uikit/button/Button';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {
	getTimeWindowPresets,
	minutesToMs,
	TIME_WINDOW_LABEL_MESSAGES,
	type TimeWindowKey,
	type TimeWindowPreset,
} from '@app/constants/TimeWindowPresets';
import {type CustomStatus, normalizeCustomStatus} from '@app/lib/CustomStatus';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import EmojiStore from '@app/stores/EmojiStore';
import PresenceStore from '@app/stores/PresenceStore';
import UserStore from '@app/stores/UserStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {getEmojiURL, shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {getSkinTonedSurrogate} from '@app/utils/SkinToneUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {SmileyIcon, XIcon} from '@phosphor-icons/react';
import clsx from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

const CUSTOM_STATUS_SNAP_POINTS: Array<number> = [0, 1];

interface ExpiryOption {
	id: TimeWindowKey;
	label: string;
	minutes: number | null;
}

interface CustomStatusBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
}

const buildDraftStatus = (params: {
	text: string;
	emojiId: string | null;
	emojiName: string | null;
	expiresAt: string | null;
}): CustomStatus | null => {
	return normalizeCustomStatus({
		text: params.text || null,
		emojiId: params.emojiId,
		emojiName: params.emojiName,
		expiresAt: params.expiresAt,
	});
};

export const CustomStatusBottomSheet = observer(({isOpen, onClose}: CustomStatusBottomSheetProps) => {
	const {t, i18n} = useLingui();
	const currentUser = UserStore.getCurrentUser();
	const currentUserId = currentUser?.id ?? null;
	const existingCustomStatus = currentUserId ? PresenceStore.getCustomStatus(currentUserId) : null;
	const normalizedExisting = normalizeCustomStatus(existingCustomStatus);
	const isDeveloper = DeveloperModeStore.isDeveloper;

	const [statusText, setStatusText] = useState('');
	const [emojiId, setEmojiId] = useState<string | null>(null);
	const [emojiName, setEmojiName] = useState<string | null>(null);
	const [selectedExpiry, setSelectedExpiry] = useState<TimeWindowKey>('never');
	const [isSaving, setIsSaving] = useState(false);
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setStatusText(normalizedExisting?.text ?? '');
			setEmojiId(normalizedExisting?.emojiId ?? null);
			setEmojiName(normalizedExisting?.emojiName ?? null);
			setSelectedExpiry('never');
		}
	}, [isOpen, normalizedExisting?.text, normalizedExisting?.emojiId, normalizedExisting?.emojiName]);

	const expiryOptions = useMemo(
		() =>
			getTimeWindowPresets({includeDeveloperOptions: isDeveloper}).map((preset: TimeWindowPreset) => ({
				id: preset.key,
				label: i18n._(TIME_WINDOW_LABEL_MESSAGES[preset.key]),
				minutes: preset.minutes,
			})),
		[i18n, isDeveloper],
	);

	const draftStatus = useMemo(
		() => buildDraftStatus({text: statusText.trim(), emojiId, emojiName, expiresAt: null}),
		[statusText, emojiId, emojiName],
	);

	const getExpiresAtForSave = useCallback((): string | null => {
		const option = expiryOptions.find((o: ExpiryOption) => o.id === selectedExpiry);
		if (!option?.minutes) return null;
		return new Date(Date.now() + minutesToMs(option.minutes)!).toISOString();
	}, [expiryOptions, selectedExpiry]);

	const handleEmojiSelect = useCallback((emoji: FlatEmoji) => {
		if (emoji.id) {
			setEmojiId(emoji.id);
			setEmojiName(emoji.name);
		} else {
			setEmojiId(null);
			setEmojiName(getSkinTonedSurrogate(emoji));
		}
	}, []);

	const handleClearDraft = () => {
		setStatusText('');
		setEmojiId(null);
		setEmojiName(null);
	};

	const handleSave = async () => {
		if (isSaving) return;

		setIsSaving(true);
		try {
			const statusToSave = buildDraftStatus({
				text: statusText.trim(),
				emojiId,
				emojiName,
				expiresAt: getExpiresAtForSave(),
			});
			await UserSettingsActionCreators.update({customStatus: statusToSave});
			onClose();
		} finally {
			setIsSaving(false);
		}
	};

	const renderEmojiPreview = (): React.ReactNode => {
		if (!draftStatus) return null;
		if (draftStatus.emojiId) {
			const emoji = EmojiStore.getEmojiById(draftStatus.emojiId);
			if (emoji?.url) {
				return <img src={emoji.url} alt={emoji.name} className={styles.emojiPreviewImage} />;
			}
		}
		if (draftStatus.emojiName) {
			if (!shouldUseNativeEmoji) {
				const twemojiUrl = getEmojiURL(draftStatus.emojiName);
				if (twemojiUrl) {
					return <img src={twemojiUrl} alt={draftStatus.emojiName} className={styles.emojiPreviewImage} />;
				}
			}
			return <span className={styles.emojiPreviewNative}>{draftStatus.emojiName}</span>;
		}
		return null;
	};

	const emojiPreview = renderEmojiPreview();

	return (
		<BottomSheet
			isOpen={isOpen}
			onClose={onClose}
			snapPoints={CUSTOM_STATUS_SNAP_POINTS}
			initialSnap={CUSTOM_STATUS_SNAP_POINTS.length - 1}
			title={t`Set Custom Status`}
			zIndex={10001}
		>
			<div className={styles.content}>
				<Input
					id="custom-status-text"
					value={statusText}
					onChange={(event) => setStatusText(event.target.value.slice(0, 128))}
					maxLength={128}
					placeholder={t`What's happening?`}
					leftElement={
						<FocusRing offset={-2} enabled={!isSaving}>
							<button
								type="button"
								className={clsx(styles.emojiTriggerButton, emojiPickerOpen && styles.emojiTriggerButtonActive)}
								aria-label={emojiPreview ? t`Change emoji` : t`Choose an emoji`}
								disabled={isSaving}
								onClick={() => setEmojiPickerOpen(true)}
							>
								{emojiPreview ?? <SmileyIcon size={22} weight="fill" aria-hidden="true" />}
							</button>
						</FocusRing>
					}
					rightElement={
						draftStatus ? (
							<FocusRing offset={-2} enabled={!isSaving}>
								<button
									type="button"
									className={styles.clearButtonIcon}
									onClick={handleClearDraft}
									disabled={isSaving}
									aria-label={t`Clear custom status`}
								>
									<XIcon size={16} weight="bold" />
								</button>
							</FocusRing>
						) : null
					}
				/>
				<ExpressionPickerSheet
					isOpen={emojiPickerOpen}
					onClose={() => setEmojiPickerOpen(false)}
					onEmojiSelect={(emoji) => {
						handleEmojiSelect(emoji);
						setEmojiPickerOpen(false);
					}}
					visibleTabs={['emojis']}
					zIndex={10002}
				/>
				<div className={styles.footer}>
					<div className={styles.expirySelector}>
						<span className={styles.expirySelectorLabel}>
							<Trans>Clear after</Trans>
						</span>
						<select
							className={styles.expirySelect}
							value={selectedExpiry}
							onChange={(e) => setSelectedExpiry(e.target.value as TimeWindowKey)}
							disabled={isSaving}
						>
							{expiryOptions.map((option: ExpiryOption) => (
								<option key={option.id} value={option.id}>
									{option.label}
								</option>
							))}
						</select>
					</div>
					<Button variant="primary" onClick={handleSave} submitting={isSaving} className={styles.saveButton}>
						<Trans>Save</Trans>
					</Button>
				</div>
			</div>
		</BottomSheet>
	);
});

CustomStatusBottomSheet.displayName = 'CustomStatusBottomSheet';
