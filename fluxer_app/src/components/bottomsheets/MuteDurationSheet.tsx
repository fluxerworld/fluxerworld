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

import styles from '@app/components/bottomsheets/ChannelDetailsBottomSheet.module.css';
import {getMuteDurationOptions} from '@app/components/channel/MuteOptions';
import {CheckIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import * as Sheet from '@app/components/uikit/sheet/Sheet';
import type {MuteConfig} from '@app/records/UserGuildSettingsRecord';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import React, {useCallback} from 'react';

interface MuteDurationSheetProps {
	isOpen: boolean;
	onClose: () => void;
	isMuted: boolean;
	mutedText: string | null | undefined;
	muteConfig: MuteConfig | null | undefined;
	muteTitle: string;
	unmuteTitle: string;
	onMute: (duration: number | null) => void;
	onUnmute: () => void;
}

export const MuteDurationSheet: React.FC<MuteDurationSheetProps> = observer(
	({isOpen, onClose, isMuted, mutedText, muteConfig, muteTitle, unmuteTitle, onMute, onUnmute}) => {
		const {i18n} = useLingui();

		const handleMuteDuration = useCallback(
			(duration: number | null) => {
				onMute(duration);
			},
			[onMute],
		);

		const handleUnmute = useCallback(() => {
			onUnmute();
		}, [onUnmute]);

		return (
			<Sheet.Root isOpen={isOpen} onClose={onClose} snapPoints={[0, 1]} initialSnap={1}>
				<Sheet.Handle />
				<Sheet.Header trailing={<Sheet.CloseButton onClick={onClose} />}>
					<Sheet.Title>{isMuted ? unmuteTitle : muteTitle}</Sheet.Title>
				</Sheet.Header>
				<Sheet.Content padding="none">
					<div className={styles.muteSheetContainer}>
						<div className={styles.muteSheetContent}>
							{isMuted && mutedText ? (
								<>
									<div className={styles.muteStatusBanner}>
										<p className={styles.muteStatusText}>
											<Trans>Currently: {mutedText}</Trans>
										</p>
									</div>
									<div className={styles.muteOptionsContainer}>
										<button type="button" onClick={handleUnmute} className={styles.muteOptionButton}>
											<span className={styles.muteOptionLabel}>
												<Trans>Unmute</Trans>
											</span>
										</button>
									</div>
								</>
							) : (
								<div className={styles.muteOptionsContainer}>
									{getMuteDurationOptions(i18n).map((option, index, array) => {
										const isSelected =
											isMuted &&
											((option.value === null && !muteConfig?.end_time) ||
												(option.value !== null && muteConfig?.selected_time_window === option.value));

										return (
											<React.Fragment key={option.label}>
												<button
													type="button"
													onClick={() => handleMuteDuration(option.value)}
													className={styles.muteOptionButton}
												>
													<span className={styles.muteOptionLabel}>{option.label}</span>
													{isSelected && <CheckIcon className={styles.iconMedium} />}
												</button>
												{index < array.length - 1 && <div className={styles.muteOptionDivider} />}
											</React.Fragment>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</Sheet.Content>
			</Sheet.Root>
		);
	},
);
