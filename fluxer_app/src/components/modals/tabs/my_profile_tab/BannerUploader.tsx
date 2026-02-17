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
import {AssetCropModal, AssetType} from '@app/components/modals/AssetCropModal';
import styles from '@app/components/modals/tabs/my_profile_tab/BannerUploader.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {PlutoniumUpsell} from '@app/components/uikit/plutonium_upsell/PlutoniumUpsell';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {openFilePicker} from '@app/utils/FilePickerUtils';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/utils/limits/LimitUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

export type BannerMode = 'inherit' | 'custom' | 'unset';

interface BannerUploaderProps {
	hasBanner: boolean;
	onBannerChange: (base64: string) => void;
	onBannerClear: () => void;
	disabled?: boolean;
	isPerGuildProfile: boolean;
	errorMessage?: string;
	bannerMode?: BannerMode;
	onBannerModeChange?: (mode: BannerMode) => void;
	alwaysEnabled?: boolean;
}

export const BannerUploader = observer(
	({
		hasBanner,
		onBannerChange,
		onBannerClear,
		disabled,
		isPerGuildProfile,
		errorMessage,
		bannerMode = 'inherit',
		onBannerModeChange,
		alwaysEnabled,
	}: BannerUploaderProps) => {
		const {t} = useLingui();

		const hasAnimatedBanner = isLimitToggleEnabled(
			{feature_animated_banner: LimitResolver.resolve({key: 'feature_animated_banner', fallback: 0})},
			'feature_animated_banner',
		);

		const getBannerModeOptions = useCallback(
			() => [
				{
					value: 'inherit' as BannerMode,
					name: t`Use Global Profile`,
					desc: t`Show your global profile banner in this community`,
				},
				{
					value: 'custom' as BannerMode,
					name: t`Use Custom Image`,
					desc: t`Upload a custom banner for this community`,
					disabled: !hasAnimatedBanner,
				},
				{
					value: 'unset' as BannerMode,
					name: t`Don't Show`,
					desc: t`Show accent color only, ignoring your global profile`,
				},
			],
			[t, hasAnimatedBanner],
		);

		const handleBannerUpload = useCallback(async () => {
			try {
				const [file] = await openFilePicker({accept: 'image/*'});
				if (!file) return;

				if (file.size > 10 * 1024 * 1024) {
					ToastActionCreators.createToast({
						type: 'error',
						children: t`Banner file is too large. Please choose a file smaller than 10MB.`,
					});
					return;
				}

				const base64 = await AvatarUtils.fileToBase64(file);

				ModalActionCreators.push(
					modal(() => (
						<AssetCropModal
							imageUrl={base64}
							sourceMimeType={file.type}
							assetType={AssetType.PROFILE_BANNER}
							onCropComplete={(croppedBlob) => {
								const reader = new FileReader();
								reader.onload = () => {
									const croppedBase64 = reader.result as string;
									onBannerChange(croppedBase64);
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
								onBannerChange(base64);
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
		}, [onBannerChange, t]);

		const handleModeChange = useCallback(
			(mode: BannerMode) => {
				onBannerModeChange?.(mode);
				if (mode === 'custom') {
					handleBannerUpload();
				}
			},
			[onBannerModeChange, handleBannerUpload],
		);

		const bannerModeOptions = getBannerModeOptions();

		const radioGroupDisabled = Boolean(disabled && !(isPerGuildProfile && !hasAnimatedBanner));

		if (isPerGuildProfile && onBannerModeChange) {
			return (
				<div>
					<div className={styles.label}>
						<Trans>Banner</Trans>
					</div>
					<RadioGroup
						options={bannerModeOptions}
						value={bannerMode}
						disabled={radioGroupDisabled}
						onChange={handleModeChange}
						aria-label={t`Banner mode selection`}
					/>
					{bannerMode === 'custom' && (
						<div className={styles.buttonGroup}>
							<Button variant="primary" small={true} onClick={handleBannerUpload} disabled={disabled}>
								<Trans>Change Banner</Trans>
							</Button>
							{hasBanner && (
								<Button
									variant="secondary"
									small={true}
									onClick={() => {
										onBannerModeChange('inherit');
										onBannerClear();
									}}
									disabled={disabled}
								>
									<Trans>Remove Banner</Trans>
								</Button>
							)}
						</div>
					)}
					<div className={clsx(styles.description, styles.helperSpacing)}>
						<Trans>JPEG, PNG, GIF, WebP. Max 10MB. Minimum: 680×240px (17:6)</Trans>
					</div>
					{errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
				</div>
			);
		}

		return (
			<div>
				<div className={styles.label}>
					<Trans>Banner</Trans>
				</div>
				{hasAnimatedBanner || isPerGuildProfile || alwaysEnabled ? (
					<>
						<div className={styles.buttonGroup}>
							<Button variant="primary" small={true} onClick={handleBannerUpload} disabled={disabled}>
								<Trans>Change Banner</Trans>
							</Button>
							{hasBanner && (
								<Button variant="secondary" small={true} onClick={onBannerClear} disabled={disabled}>
									<Trans>Remove Banner</Trans>
								</Button>
							)}
						</div>
						<div className={styles.description}>
							<Trans>JPEG, PNG, GIF, WebP. Max 10MB. Minimum: 680×240px (17:6)</Trans>
						</div>
					</>
				) : (
					<PlutoniumUpsell>
						<Trans>Customize your profile with a static or animated banner image to make it stand out.</Trans>
					</PlutoniumUpsell>
				)}
				{errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
			</div>
		);
	},
);
