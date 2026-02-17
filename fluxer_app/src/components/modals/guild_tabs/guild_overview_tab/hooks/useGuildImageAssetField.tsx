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
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {AssetCropModal, type AssetType} from '@app/components/modals/AssetCropModal';
import {
	blobToDataUrl,
	getSafeImageMimeType,
	isGif,
	MAX_IMAGE_BYTES,
	revokeObjectUrl,
} from '@app/components/modals/guild_tabs/guild_overview_tab/utils/ImageAsset';
import {
	getAnimatedFormatLabel,
	isAnimatedFile,
	shouldShowAnimatedAvifConfirmation,
} from '@app/utils/AnimatedImageUtils';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {openFilePicker} from '@app/utils/FilePickerUtils';
import {showAnimatedAvifConfirmModal} from '@app/utils/modals/AnimatedAvifModalUtils';
import type {FormInputs} from '@app/utils/modals/guild_tabs/GuildOverviewTabUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {UseFormReturn} from 'react-hook-form';

export type ImageAssetFieldName = 'icon' | 'banner' | 'splash' | 'embed_splash';

type GifMode = 'allow' | 'disallow' | 'require-feature';

export interface GifPolicy {
	mode: GifMode;

	isAllowed?: () => boolean;
	featureMissingMessage?: string;

	disallowedMessage?: string;
}

export interface AspectRatioConfig {
	compute: (dataUrl: string) => Promise<number>;
	set: (ratio: number | undefined) => void;
}

export interface UseGuildImageAssetFieldArgs {
	form: UseFormReturn<FormInputs>;
	fieldName: ImageAssetFieldName;
	assetType: AssetType;

	canManage: boolean;
	filePickerAccept: string;

	previewUrl: string | null;
	setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;

	setHasCleared: React.Dispatch<React.SetStateAction<boolean>>;

	maxBytes?: number;

	labelForMessages: string;

	gif?: GifPolicy;
	aspectRatio?: AspectRatioConfig;
}

export interface ImageAssetFieldController {
	pickFile: () => Promise<void>;
	handleFile: (file: File | null) => Promise<void>;
	clear: () => void;
	isProcessing: boolean;
}

export function useGuildImageAssetField({
	form,
	fieldName,
	assetType,
	canManage,
	filePickerAccept,
	previewUrl,
	setPreviewUrl,
	setHasCleared,
	maxBytes = MAX_IMAGE_BYTES,
	labelForMessages,
	gif,
	aspectRatio,
}: UseGuildImageAssetFieldArgs): ImageAssetFieldController {
	const {t, i18n} = useLingui();
	const label = labelForMessages;

	const requestIdRef = useRef(0);
	const [isProcessing, setIsProcessing] = useState(false);

	useEffect(() => {
		return () => {
			revokeObjectUrl(previewUrl);
		};
	}, [previewUrl]);

	const showErrorToast = useCallback((children: React.ReactNode) => {
		ToastActionCreators.createToast({type: 'error', children});
	}, []);

	const setFieldValue = useCallback(
		(value: string | null) => {
			form.setValue(fieldName as keyof FormInputs, value, {shouldDirty: true, shouldValidate: true});
			form.clearErrors(fieldName as keyof FormInputs);
		},
		[form, fieldName],
	);

	const applyAspectRatio = useCallback(
		(dataUrl: string, requestId: number) => {
			if (!aspectRatio) return;

			aspectRatio
				.compute(dataUrl)
				.then((ratio) => {
					if (requestId !== requestIdRef.current) return;
					aspectRatio.set(ratio);
				})
				.catch(() => {
					if (requestId !== requestIdRef.current) return;
					aspectRatio.set(undefined);
				});
		},
		[aspectRatio],
	);

	const applyDataUrl = useCallback(
		async (dataUrl: string, blob: Blob, requestId: number) => {
			if (requestId !== requestIdRef.current) return;

			const nextPreviewUrl = URL.createObjectURL(blob);

			setFieldValue(dataUrl);
			setPreviewUrl(nextPreviewUrl);
			setHasCleared(false);

			applyAspectRatio(dataUrl, requestId);
		},
		[applyAspectRatio, setFieldValue, setHasCleared, setPreviewUrl],
	);

	const handleFile = useCallback(
		async (file: File | null) => {
			if (!file) return;
			if (!canManage) return;

			const requestId = ++requestIdRef.current;

			if (file.size > maxBytes) {
				const maxMB = Math.round(maxBytes / (1024 * 1024));
				showErrorToast(t`${label} file is too large. Please choose a file smaller than ${maxMB}MB.`);
				return;
			}

			const animated = await isAnimatedFile(file);

			if (animated) {
				const policy = gif?.mode ?? 'disallow';

				if (policy === 'disallow') {
					showErrorToast(
						gif?.disallowedMessage ?? t`${label} images cannot be animated. Please use JPEG, PNG, or WebP.`,
					);
					return;
				}

				if (policy === 'require-feature') {
					const allowed = gif?.isAllowed?.() ?? false;
					if (!allowed) {
						showErrorToast(gif?.featureMissingMessage ?? t`Animated images are not supported for this asset.`);
						return;
					}
				}
			}

			setIsProcessing(true);

			let sourceBase64: string;
			try {
				sourceBase64 = await AvatarUtils.fileToBase64(file);
			} catch {
				setIsProcessing(false);
				showErrorToast(<Trans>That image is invalid. Please try another one.</Trans>);
				return;
			}

			if (requestId !== requestIdRef.current) {
				setIsProcessing(false);
				return;
			}

			const animatedHandled = shouldShowAnimatedAvifConfirmation({
				file,
				isGif: isGif(file),
				animated,
				onAnimatedAvif: () => {
					setIsProcessing(false);
					showAnimatedAvifConfirmModal({
						onConfirm: async () => {
							await applyDataUrl(sourceBase64, file, requestId);
						},
						i18n,
					});
				},
				onOtherAnimated: async () => {
					const formatLabel = getAnimatedFormatLabel(file);
					ToastActionCreators.createToast({
						type: 'info',
						children: t`Cropping animated ${formatLabel} files isn't supported yet. The original image will be used.`,
					});
					await applyDataUrl(sourceBase64, file, requestId);
					setIsProcessing(false);
				},
			});

			if (animatedHandled) {
				return;
			}

			setIsProcessing(false);

			const sourceMimeType = getSafeImageMimeType(file);

			ModalActionCreators.push(
				modal(() => (
					<AssetCropModal
						assetType={assetType}
						imageUrl={sourceBase64}
						sourceMimeType={sourceMimeType}
						onCropComplete={async (croppedBlob) => {
							if (requestId !== requestIdRef.current) return;

							setIsProcessing(true);

							try {
								if (croppedBlob.size > maxBytes) {
									const maxMB = Math.round(maxBytes / (1024 * 1024));
									showErrorToast(
										t`Cropped image is too large. Please choose a smaller area or a smaller file (max ${maxMB}MB).`,
									);
									return;
								}

								const croppedBase64 = await blobToDataUrl(croppedBlob);
								await applyDataUrl(croppedBase64, croppedBlob, requestId);
							} catch {
								showErrorToast(t`Failed to process the cropped image. Please try again.`);
							} finally {
								if (requestId === requestIdRef.current) {
									setIsProcessing(false);
								}
							}
						}}
						onSkip={async () => {
							if (requestId !== requestIdRef.current) return;

							await applyDataUrl(sourceBase64, file, requestId);
						}}
					/>
				)),
			);
		},
		[
			applyAspectRatio,
			applyDataUrl,
			assetType,
			canManage,
			gif,
			label,
			maxBytes,
			setFieldValue,
			setHasCleared,
			setPreviewUrl,
			showErrorToast,
			t,
		],
	);

	const pickFile = useCallback(async () => {
		if (!canManage) return;
		const [file] = await openFilePicker({accept: filePickerAccept});
		await handleFile(file ?? null);
	}, [canManage, filePickerAccept, handleFile]);

	const clear = useCallback(() => {
		requestIdRef.current += 1;

		setFieldValue(null);
		setPreviewUrl(null);
		setHasCleared(true);

		if (aspectRatio) {
			aspectRatio.set(undefined);
		}
	}, [aspectRatio, setFieldValue, setHasCleared, setPreviewUrl]);

	return {pickFile, handleFile, clear, isProcessing};
}
