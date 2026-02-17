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
import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {AssetCropModal, AssetType} from '@app/components/modals/AssetCropModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {isGif} from '@app/components/modals/guild_tabs/guild_overview_tab/utils/ImageAsset';
import styles from '@app/components/modals/tabs/my_profile_tab/AvatarUploader.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {PlutoniumLink} from '@app/components/uikit/plutonium_link/PlutoniumLink';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import {
	getAnimatedFormatLabel,
	isAnimatedFile,
	shouldShowAnimatedAvifConfirmation,
} from '@app/utils/AnimatedImageUtils';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {openFilePicker} from '@app/utils/FilePickerUtils';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/utils/limits/LimitUtils';
import {showAnimatedAvifConfirmModal} from '@app/utils/modals/AnimatedAvifModalUtils';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

export type AvatarMode = 'inherit' | 'custom' | 'unset';

interface AvatarUploaderProps {
	hasAvatar: boolean;
	onAvatarChange: (base64: string) => void;
	onAvatarClear: () => void;
	disabled?: boolean;
	isPerGuildProfile: boolean;
	errorMessage?: string;
	avatarMode?: AvatarMode;
	onAvatarModeChange?: (mode: AvatarMode) => void;
}

export const AvatarUploader = observer(
	({
		hasAvatar,
		onAvatarChange,
		onAvatarClear,
		disabled,
		isPerGuildProfile,
		errorMessage,
		avatarMode = 'inherit',
		onAvatarModeChange,
	}: AvatarUploaderProps) => {
		const {t, i18n} = useLingui();

		const hasAnimatedAvatar = isLimitToggleEnabled(
			{feature_animated_avatar: LimitResolver.resolve({key: 'feature_animated_avatar', fallback: 0})},
			'feature_animated_avatar',
		);

		const getAvatarModeOptions = useCallback(
			() => [
				{
					value: 'inherit' as AvatarMode,
					name: t`Use Global Profile`,
					desc: t`Show your global profile avatar in this community`,
				},
				{
					value: 'custom' as AvatarMode,
					name: t`Use Custom Image`,
					desc: t`Upload a custom avatar for this community`,
					disabled: !hasAnimatedAvatar,
				},
				{
					value: 'unset' as AvatarMode,
					name: t`Don't Show`,
					desc: t`Show default avatar, ignoring your global profile`,
				},
			],
			[t, hasAnimatedAvatar],
		);

		const handleAvatarUpload = useCallback(async () => {
			try {
				const [file] = await openFilePicker({accept: 'image/*'});
				if (!file) return;

				if (file.size > 10 * 1024 * 1024) {
					ToastActionCreators.createToast({
						type: 'error',
						children: t`Avatar file is too large. Please choose a file smaller than 10MB.`,
					});
					return;
				}

				const animated = await isAnimatedFile(file);
				const isGifFile = isGif(file);

				if (animated && !hasAnimatedAvatar) {
					if (shouldShowPremiumFeatures()) {
						ModalActionCreators.push(
							modal(() => (
								<ConfirmModal
									title={t`Animated avatars require Plutonium`}
									description={
										<>
											<p>
												<Trans>
													Animated avatars (GIF, APNG, animated WebP, AVIF) are a premium feature exclusively available
													to Plutonium subscribers.
												</Trans>
											</p>
											<p className={styles.spacedParagraph}>
												<Trans>
													With Plutonium, you can use animated avatars and banners (in GIF, APNG, animated WebP, or
													AVIF), customize your 4-digit tag, and unlock many other premium features.
												</Trans>
											</p>
										</>
									}
									primaryText={t`Get Plutonium`}
									primaryVariant="primary"
									secondaryText={t`Cancel`}
									onPrimary={() => {
										window.setTimeout(() => {
											PremiumModalActionCreators.open();
										}, 0);
									}}
								/>
							)),
						);
					} else {
						ModalActionCreators.push(
							modal(() => (
								<ConfirmModal
									title={t`Animated avatars not available`}
									description={
										<Trans>
											Animated avatars (GIF, APNG, animated WebP, AVIF) are not available on this instance. Please
											upload a static image instead.
										</Trans>
									}
									primaryText={t`Understood`}
									onPrimary={() => {}}
								/>
							)),
						);
					}
					return;
				}

				const base64 = await AvatarUtils.fileToBase64(file);

				const animatedHandled = shouldShowAnimatedAvifConfirmation({
					file,
					isGif: isGifFile,
					animated,
					onAnimatedAvif: () => {
						showAnimatedAvifConfirmModal({
							onConfirm: () => onAvatarChange(base64),
							i18n,
						});
					},
					onOtherAnimated: () => {
						const formatLabel = getAnimatedFormatLabel(file);
						ToastActionCreators.createToast({
							type: 'info',
							children: t`Cropping animated ${formatLabel} files isn't supported yet. The original upload will be used.`,
						});
						onAvatarChange(base64);
					},
				});

				if (animatedHandled) {
					return;
				}

				ModalActionCreators.push(
					modal(() => (
						<AssetCropModal
							assetType={AssetType.AVATAR}
							imageUrl={base64}
							sourceMimeType={file.type}
							onCropComplete={(croppedBlob) => {
								const reader = new FileReader();
								reader.onload = () => {
									const croppedBase64 = reader.result as string;
									onAvatarChange(croppedBase64);
								};
								reader.onerror = () => {
									ToastActionCreators.createToast({
										type: 'error',
										children: t`Failed to process the cropped image. Please try again.`,
									});
								};
								reader.readAsDataURL(croppedBlob);
							}}
							onSkip={() => {
								onAvatarChange(base64);
							}}
						/>
					)),
				);
			} catch {
				ToastActionCreators.createToast({
					type: 'error',
					children: t`That image is invalid. Please try another one.`,
				});
			}
		}, [hasAnimatedAvatar, onAvatarChange, t]);

		const handleModeChange = useCallback(
			(mode: AvatarMode) => {
				onAvatarModeChange?.(mode);
				if (mode === 'custom') {
					handleAvatarUpload();
				}
			},
			[onAvatarModeChange, handleAvatarUpload],
		);

		const avatarModeOptions = getAvatarModeOptions();

		const radioGroupDisabled = Boolean(disabled && !(isPerGuildProfile && !hasAnimatedAvatar));

		if (isPerGuildProfile && onAvatarModeChange) {
			return (
				<div>
					<div className={styles.label}>
						<Trans>Avatar</Trans>
					</div>
					<RadioGroup
						options={avatarModeOptions}
						value={avatarMode}
						disabled={radioGroupDisabled}
						onChange={handleModeChange}
						aria-label={t`Avatar mode selection`}
					/>
					{avatarMode === 'custom' && (
						<div className={styles.buttonGroup}>
							<Button variant="primary" small={true} onClick={handleAvatarUpload} disabled={disabled}>
								<Trans>Change Avatar</Trans>
							</Button>
							{hasAvatar && (
								<Button
									variant="secondary"
									small={true}
									onClick={() => {
										onAvatarModeChange('inherit');
										onAvatarClear();
									}}
									disabled={disabled}
								>
									<Trans>Remove Avatar</Trans>
								</Button>
							)}
						</div>
					)}
					<div className={clsx(styles.description, styles.helperSpacing)}>
						<Trans>JPEG, PNG, GIF, WebP. Max 10MB. Recommended: 512×512px</Trans>
					</div>
					{errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
				</div>
			);
		}

		return (
			<div>
				<div className={styles.label}>
					<Trans>Avatar</Trans>
				</div>
				<div className={styles.buttonGroup}>
					<Button variant="primary" small={true} onClick={handleAvatarUpload} disabled={disabled}>
						<Trans>Change Avatar</Trans>
					</Button>
					{hasAvatar && (
						<Button variant="secondary" small={true} onClick={onAvatarClear} disabled={disabled}>
							<Trans>Remove Avatar</Trans>
						</Button>
					)}
				</div>
				{!isPerGuildProfile && (
					<div className={styles.description}>
						{hasAnimatedAvatar ? (
							<Trans>JPEG, PNG, GIF, WebP. Max 10MB. Recommended: 512×512px</Trans>
						) : shouldShowPremiumFeatures() ? (
							<Trans>
								JPEG, PNG, WebP. Max 10MB. Recommended: 512×512px. Animated avatars (GIF) require <PlutoniumLink />.
							</Trans>
						) : (
							<Trans>JPEG, PNG, WebP. Max 10MB. Recommended: 512×512px.</Trans>
						)}
					</div>
				)}
				{isPerGuildProfile && (
					<div className={styles.description}>
						<Trans>JPEG, PNG, GIF, WebP. Max 10MB. Recommended: 512×512px</Trans>
					</div>
				)}
				{errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
			</div>
		);
	},
);
