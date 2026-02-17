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

import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import {Switch} from '@app/components/form/Switch';
import styles from '@app/components/modals/tabs/notifications_tab/Sounds.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {SwitchGroup, SwitchGroupCustomItem} from '@app/components/uikit/SwitchGroup';
import type {SoundSettings} from '@app/stores/SoundStore';
import type * as CustomSoundDB from '@app/utils/CustomSoundDB';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import type {SoundType} from '@app/utils/SoundUtils';
import {useLingui} from '@lingui/react/macro';
import {CrownIcon, SpeakerHighIcon, TrashIcon, UploadIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface SoundsProps {
	soundSettings: SoundSettings;
	hasCustomNotificationSounds: boolean;
	soundTypeLabels: Record<SoundType, string>;
	customSounds: Record<SoundType, CustomSoundDB.CustomSound | null>;
	onToggleAllSounds: (value: boolean) => void;
	onToggleSound: (soundType: SoundType, enabled: boolean) => void;
	onEnableAllSounds: () => void;
	onDisableAllSounds: () => void;
	onPreviewSound: (soundType: SoundType) => void;
	onUploadClick: (soundType: SoundType) => void;
	onCustomSoundDelete: (soundType: SoundType) => void;
}

export const Sounds: React.FC<SoundsProps> = observer(
	({
		soundSettings,
		hasCustomNotificationSounds,
		soundTypeLabels,
		customSounds,
		onToggleAllSounds,
		onToggleSound,
		onEnableAllSounds,
		onDisableAllSounds,
		onPreviewSound,
		onUploadClick,
		onCustomSoundDelete,
	}) => {
		const {t} = useLingui();
		return (
			<div className={styles.container}>
				<p className={styles.description}>{t`Configure which sounds to play and when.`}</p>
				<div className={styles.content}>
					{!hasCustomNotificationSounds && shouldShowPremiumFeatures() && (
						<div className={styles.premiumCard}>
							<div className={styles.premiumCardHeader}>
								<CrownIcon weight="fill" size={18} className={styles.premiumCardIcon} />
								<span className={styles.premiumCardTitle}>{t`Customize your notification sounds with Plutonium`}</span>
							</div>
							<p className={styles.premiumCardDescription}>
								{t`Upload your own custom notification sounds and ringtones. Supported formats: MP3, WAV, OGG, M4A, AAC, FLAC, Opus, WebM. Maximum file size: 2MB per sound.`}
							</p>
							<Button
								variant="secondary"
								small={true}
								onClick={() => {
									PremiumModalActionCreators.open();
								}}
							>
								{t`Get Plutonium`}
							</Button>
						</div>
					)}

					<Switch
						label={t`Disable all notification sounds`}
						description={t`Your existing notification sound settings will be preserved.`}
						value={soundSettings.allSoundsDisabled}
						onChange={onToggleAllSounds}
					/>

					{hasCustomNotificationSounds && (
						<div className={styles.hint}>
							{t`Click the upload icon next to any sound to customize it with your own audio file. Supported formats: MP3, WAV, OGG, M4A, AAC, FLAC, Opus, WebM (max 2MB).`}
						</div>
					)}

					<SwitchGroup>
						{Object.entries(soundTypeLabels).map(([soundType, label]) => (
							<SwitchGroupCustomItem
								key={soundType}
								label={
									<>
										<span>{label}</span>
										{customSounds[soundType as SoundType] && <span className={styles.customBadge}>Custom</span>}
										<SpeakerHighIcon size={16} weight="fill" className={styles.previewIcon} />
									</>
								}
								value={soundSettings.allSoundsDisabled ? false : !soundSettings.disabledSounds[soundType as SoundType]}
								disabled={soundSettings.allSoundsDisabled}
								onChange={(enabled) => onToggleSound(soundType as SoundType, enabled)}
								onClick={() => onPreviewSound(soundType as SoundType)}
								clickDisabled={soundSettings.allSoundsDisabled}
								extraContent={
									<>
										{hasCustomNotificationSounds ? (
											<button
												type="button"
												onClick={() => onUploadClick(soundType as SoundType)}
												disabled={soundSettings.allSoundsDisabled}
												className={styles.iconButton}
												title={t`Upload Custom Sound`}
											>
												<UploadIcon size={16} className={styles.uploadIcon} />
											</button>
										) : shouldShowPremiumFeatures() ? (
											<button
												type="button"
												onClick={() => onUploadClick(soundType as SoundType)}
												disabled={soundSettings.allSoundsDisabled}
												className={styles.iconButton}
												title={t`Requires Plutonium`}
											>
												<CrownIcon size={16} weight="fill" className={styles.crownIcon} />
											</button>
										) : null}
										{customSounds[soundType as SoundType] && hasCustomNotificationSounds && (
											<button
												type="button"
												onClick={() => onCustomSoundDelete(soundType as SoundType)}
												disabled={soundSettings.allSoundsDisabled}
												className={styles.iconButton}
												title={t`Remove Custom Sound`}
											>
												<TrashIcon size={16} className={styles.deleteIcon} />
											</button>
										)}
									</>
								}
							/>
						))}
					</SwitchGroup>
					<div className={styles.actionsContainer}>
						<button
							type="button"
							className={styles.actionButton}
							onClick={onEnableAllSounds}
							disabled={soundSettings.allSoundsDisabled}
						>
							{t`Enable All`}
						</button>
						<span className={styles.actionSeparator}>•</span>
						<button
							type="button"
							className={styles.actionButton}
							onClick={onDisableAllSounds}
							disabled={soundSettings.allSoundsDisabled}
						>
							{t`Disable All`}
						</button>
					</div>
				</div>
			</div>
		);
	},
);
