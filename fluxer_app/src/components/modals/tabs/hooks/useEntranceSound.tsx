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
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Logger} from '@app/lib/Logger';
import * as CustomSoundDB from '@app/utils/CustomSoundDB';
import {openFilePicker} from '@app/utils/FilePickerUtils';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/utils/limits/LimitUtils';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useMemo, useState} from 'react';

const logger = new Logger('useEntranceSound');

export const useEntranceSound = () => {
	const {t} = useLingui();
	const [entranceSound, setEntranceSound] = useState<CustomSoundDB.EntranceSound | null>(null);
	const [isPreviewing, setIsPreviewing] = useState(false);

	const hasEntranceSounds = useMemo(
		() =>
			isLimitToggleEnabled(
				{feature_voice_entrance_sounds: LimitResolver.resolve({key: 'feature_voice_entrance_sounds', fallback: 0})},
				'feature_voice_entrance_sounds',
			),
		[],
	);

	useEffect(() => {
		const loadEntranceSound = async () => {
			try {
				const sound = await CustomSoundDB.getEntranceSound();
				setEntranceSound(sound);
			} catch (error) {
				logger.error('Failed to load entrance sound', error);
			}
		};
		loadEntranceSound();
	}, []);

	const upload = useCallback(
		async (file: File | null) => {
			if (!hasEntranceSounds || !file) {
				return;
			}

			const validation = CustomSoundDB.isValidAudioFile(file);
			if (!validation.valid) {
				ToastActionCreators.createToast({
					type: 'error',
					children: validation.error || t`Invalid audio file`,
				});
				return;
			}

			const durationValidation = await CustomSoundDB.validateAudioDuration(file);
			if (!durationValidation.valid) {
				ToastActionCreators.createToast({
					type: 'error',
					children: durationValidation.error || t`Audio is too long`,
				});
				return;
			}

			try {
				await CustomSoundDB.saveEntranceSound(file, file.name, durationValidation.duration!);
				const savedSound = await CustomSoundDB.getEntranceSound();
				setEntranceSound(savedSound);

				ToastActionCreators.createToast({
					type: 'success',
					children: t`Entrance sound uploaded successfully`,
				});
			} catch (error) {
				logger.error('Failed to upload entrance sound', error);
				ToastActionCreators.createToast({
					type: 'error',
					children: t`Failed to upload entrance sound`,
				});
			}
		},
		[hasEntranceSounds, t],
	);

	const remove = useCallback(async () => {
		try {
			await CustomSoundDB.deleteEntranceSound();
			setEntranceSound(null);

			ToastActionCreators.createToast({
				type: 'success',
				children: t`Entrance sound removed`,
			});
		} catch (error) {
			logger.error('Failed to delete entrance sound', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: t`Failed to remove entrance sound`,
			});
		}
	}, [t]);

	const preview = useCallback(async () => {
		if (!entranceSound || isPreviewing) return;

		try {
			setIsPreviewing(true);
			const url = URL.createObjectURL(entranceSound.blob);
			const audio = new Audio(url);

			audio.onended = () => {
				URL.revokeObjectURL(url);
				setIsPreviewing(false);
			};

			audio.onerror = () => {
				URL.revokeObjectURL(url);
				setIsPreviewing(false);
			};

			await audio.play();
		} catch (error) {
			logger.error('Failed to preview entrance sound', error);
			setIsPreviewing(false);
		}
	}, [entranceSound, isPreviewing]);

	const openUploadDialog = useCallback(async () => {
		if (!hasEntranceSounds) {
			PremiumModalActionCreators.open();
			return;
		}
		const [file] = await openFilePicker({accept: CustomSoundDB.SUPPORTED_MIME_TYPES.join(',')});
		await upload(file ?? null);
	}, [hasEntranceSounds, upload]);

	return {
		entranceSound,
		isPreviewing,
		upload,
		remove,
		preview,
		openUploadDialog,
	};
};
