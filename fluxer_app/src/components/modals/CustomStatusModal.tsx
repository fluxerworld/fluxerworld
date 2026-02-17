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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import {Input} from '@app/components/form/Input';
import {Select, type SelectOption} from '@app/components/form/Select';
import styles from '@app/components/modals/CustomStatusModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {ExpressionPickerPopout} from '@app/components/popouts/ExpressionPickerPopout';
import {ProfilePreview} from '@app/components/profile/ProfilePreview';
import {Button} from '@app/components/uikit/button/Button';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Popout} from '@app/components/uikit/popout/Popout';
import {
	DEFAULT_TIME_WINDOW_KEY,
	getTimeWindowPresets,
	TIME_WINDOW_LABEL_MESSAGES,
	type TimeWindowKey,
	type TimeWindowPreset,
} from '@app/constants/TimeWindowPresets';
import {type CustomStatus, normalizeCustomStatus} from '@app/lib/CustomStatus';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import EmojiStore from '@app/stores/EmojiStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {getEmojiURL, shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {getCurrentLocale} from '@app/utils/LocaleUtils';
import {getSkinTonedSurrogate} from '@app/utils/SkinToneUtils';
import {getDaysBetween} from '@fluxer/date_utils/src/DateComparison';
import {getFormattedFullDate, getFormattedTime} from '@fluxer/date_utils/src/DateFormatting';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {SmileyIcon, XIcon} from '@phosphor-icons/react';
import clsx from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';

const MS_PER_MINUTE = 60 * 1000;

interface TimeLabel {
	dayLabel: string;
	timeString: string;
}

interface ExpirationPreset {
	key: TimeWindowKey;
	label: string;
	minutes: number | null;
}

interface ExpirationOption {
	key: TimeWindowKey;
	minutes: number | null;
	expiresAt: string | null;
	relativeLabel: TimeLabel | null;
	label: string;
}

const DEFAULT_EXPIRATION_KEY: TimeWindowKey = DEFAULT_TIME_WINDOW_KEY;

const getPopoutClose = (renderProps: unknown): (() => void) => {
	const props = renderProps as {
		close?: unknown;
		requestClose?: unknown;
		onClose?: unknown;
	};

	if (typeof props.close === 'function') return props.close as () => void;
	if (typeof props.requestClose === 'function') return props.requestClose as () => void;
	if (typeof props.onClose === 'function') return props.onClose as () => void;

	return () => {};
};

const formatLabelWithRelative = (label: string, relative: TimeLabel | null): React.ReactNode => {
	if (!relative) return label;

	return (
		<>
			{label} (
			<Trans>
				{relative.dayLabel} at {relative.timeString}
			</Trans>
			)
		</>
	);
};

const getDayDifference = (reference: Date, target: Date): number => {
	return getDaysBetween(target, reference);
};

const formatTimeString = (date: Date): string => getFormattedTime(date, getCurrentLocale(), false);

const formatRelativeDayTimeLabel = (i18n: I18n, reference: Date, target: Date): TimeLabel => {
	const dayOffset = getDayDifference(reference, target);
	const timeString = formatTimeString(target);

	if (dayOffset === 0) return {dayLabel: i18n._(msg`today`), timeString};
	if (dayOffset === 1) return {dayLabel: i18n._(msg`tomorrow`), timeString};

	const dayLabel = getFormattedFullDate(target, getCurrentLocale());
	return {dayLabel, timeString};
};

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

export const CustomStatusModal = observer(() => {
	const {i18n} = useLingui();
	const initialStatus = normalizeCustomStatus(UserSettingsStore.customStatus);
	const currentUser = UserStore.getCurrentUser();
	const isDeveloper = DeveloperModeStore.isDeveloper;

	const [statusText, setStatusText] = useState(initialStatus?.text ?? '');
	const [emojiId, setEmojiId] = useState<string | null>(initialStatus?.emojiId ?? null);
	const [emojiName, setEmojiName] = useState<string | null>(initialStatus?.emojiName ?? null);
	const mountedAt = useMemo(() => new Date(), []);
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
	const emojiButtonRef = useRef<HTMLButtonElement | null>(null);

	const expirationPresets = useMemo(
		() =>
			getTimeWindowPresets({includeDeveloperOptions: isDeveloper}).map((preset: TimeWindowPreset) => ({
				key: preset.key,
				label: i18n._(TIME_WINDOW_LABEL_MESSAGES[preset.key]),
				minutes: preset.minutes,
			})),
		[i18n, isDeveloper],
	);

	const expirationOptions = useMemo<Array<ExpirationOption>>(
		() =>
			expirationPresets.map((preset: ExpirationPreset) => {
				if (preset.minutes == null) {
					return {...preset, expiresAt: null, relativeLabel: null};
				}

				const target = new Date(mountedAt.getTime() + preset.minutes * MS_PER_MINUTE);

				return {
					...preset,
					expiresAt: target.toISOString(),
					relativeLabel: formatRelativeDayTimeLabel(i18n, mountedAt, target),
				};
			}),
		[mountedAt, i18n, expirationPresets],
	);

	const expirationLabelMap = useMemo<Record<TimeWindowKey, TimeLabel | null>>(() => {
		return expirationOptions.reduce<Record<TimeWindowKey, TimeLabel | null>>(
			(acc, option) => {
				acc[option.key] = option.relativeLabel;
				return acc;
			},
			{} as Record<TimeWindowKey, TimeLabel | null>,
		);
	}, [expirationOptions]);

	const selectOptions = useMemo<Array<SelectOption<TimeWindowKey>>>(() => {
		return expirationOptions.map((option) => ({value: option.key, label: option.label}));
	}, [expirationOptions]);

	const [selectedExpiration, setSelectedExpiration] = useState<TimeWindowKey>(DEFAULT_EXPIRATION_KEY);
	const [isSaving, setIsSaving] = useState(false);

	const draftStatus = useMemo(
		() => buildDraftStatus({text: statusText.trim(), emojiId, emojiName, expiresAt: null}),
		[statusText, emojiId, emojiName],
	);

	const getExpiresAtForSave = useCallback((): string | null => {
		const option = expirationOptions.find((entry) => entry.key === selectedExpiration);
		if (!option?.minutes) return null;
		return new Date(Date.now() + option.minutes * MS_PER_MINUTE).toISOString();
	}, [expirationOptions, selectedExpiration]);

	const handleExpirationChange = (value: TimeWindowKey) => {
		setSelectedExpiration(value);
	};

	const handleEmojiSelect = useCallback((emoji: FlatEmoji) => {
		if (emoji.id) {
			setEmojiId(emoji.id);
			setEmojiName(emoji.name);
		} else {
			setEmojiId(null);
			setEmojiName(getSkinTonedSurrogate(emoji));
		}
	}, []);

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
			ModalActionCreators.pop();
		} finally {
			setIsSaving(false);
		}
	};

	const handleClearDraft = () => {
		setStatusText('');
		setEmojiId(null);
		setEmojiName(null);
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
		<Modal.Root onClose={() => ModalActionCreators.pop()} size="medium" className={styles.modalRoot}>
			<Modal.ScreenReaderLabel text={i18n._(msg`Set your status`)} />
			<Modal.Header title={i18n._(msg`Set your status`)} />
			<Modal.Content>
				<div className={styles.previewSection}>
					{currentUser && (
						<ProfilePreview
							user={currentUser}
							showMembershipInfo={false}
							showMessageButton={false}
							showPreviewLabel={false}
							previewCustomStatus={draftStatus}
						/>
					)}
				</div>

				<div className={styles.statusInputWrapper}>
					<Input
						id="custom-status-text"
						value={statusText}
						onChange={(event) => setStatusText(event.target.value.slice(0, 128))}
						maxLength={128}
						placeholder={i18n._(msg`What's happening?`)}
						leftElement={
							<Popout
								position="bottom-start"
								animationType="none"
								offsetMainAxis={8}
								offsetCrossAxis={0}
								onOpen={() => setEmojiPickerOpen(true)}
								onClose={() => setEmojiPickerOpen(false)}
								returnFocusRef={emojiButtonRef}
								render={(renderProps) => {
									const closePopout = getPopoutClose(renderProps);

									return (
										<ExpressionPickerPopout
											onEmojiSelect={(emoji) => {
												handleEmojiSelect(emoji);
												setEmojiPickerOpen(false);
												closePopout();
											}}
											onClose={() => {
												setEmojiPickerOpen(false);
												closePopout();
											}}
											visibleTabs={['emojis']}
										/>
									);
								}}
							>
								<FocusRing offset={-2} enabled={!isSaving}>
									<button
										ref={emojiButtonRef}
										type="button"
										className={clsx(styles.emojiTriggerButton, emojiPickerOpen && styles.emojiTriggerButtonActive)}
										aria-label={emojiPreview ? i18n._(msg`Change emoji`) : i18n._(msg`Choose an emoji`)}
										disabled={isSaving}
									>
										{emojiPreview ?? <SmileyIcon size={22} weight="fill" aria-hidden="true" />}
									</button>
								</FocusRing>
							</Popout>
						}
						rightElement={
							draftStatus ? (
								<FocusRing offset={-2} enabled={!isSaving}>
									<button
										type="button"
										className={styles.clearButtonIcon}
										onClick={handleClearDraft}
										disabled={isSaving}
										aria-label={i18n._(msg`Clear custom status`)}
									>
										<XIcon size={16} weight="bold" />
									</button>
								</FocusRing>
							) : null
						}
					/>
					<div className={styles.characterCount}>{statusText.length}/128</div>
				</div>
			</Modal.Content>

			<Modal.Footer className={styles.footer}>
				<div className={styles.expirationSelectWrapper}>
					<label className={styles.expirationLabel} htmlFor="custom-status-expiration">
						<Trans>Clear after</Trans>
					</label>

					<Select
						id="custom-status-expiration"
						className={styles.expirationSelect}
						options={selectOptions}
						value={selectedExpiration}
						onChange={handleExpirationChange}
						disabled={isSaving}
						renderOption={(option) => formatLabelWithRelative(option.label, expirationLabelMap[option.value])}
						renderValue={(option) =>
							option ? formatLabelWithRelative(option.label, expirationLabelMap[option.value]) : null
						}
					/>
				</div>

				<Button variant="primary" onClick={handleSave} submitting={isSaving}>
					<Trans>Save</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});

CustomStatusModal.displayName = 'CustomStatusModal';
