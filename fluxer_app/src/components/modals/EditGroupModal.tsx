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

import * as ChannelActionCreators from '@app/actions/ChannelActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import {AssetCropModal, AssetType} from '@app/components/modals/AssetCropModal';
import styles from '@app/components/modals/EditGroupModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import ChannelStore from '@app/stores/ChannelStore';
import {isAnimatedFile} from '@app/utils/AnimatedImageUtils';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {openFilePicker} from '@app/utils/FilePickerUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {PlusIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';

interface FormInputs {
	icon?: string | null;
	name: string;
}

export const EditGroupModal = observer(({channelId}: {channelId: string}) => {
	const {t} = useLingui();
	const channel = ChannelStore.getChannel(channelId);
	const [hasClearedIcon, setHasClearedIcon] = useState(false);
	const [previewIconUrl, setPreviewIconUrl] = useState<string | null>(null);
	const form = useForm<FormInputs>({
		defaultValues: useMemo(() => ({name: channel?.name || ''}), [channel]),
	});

	const handleIconUpload = useCallback(
		async (file: File | null) => {
			try {
				if (!file) return;

				if (file.size > 10 * 1024 * 1024) {
					ToastActionCreators.createToast({
						type: 'error',
						children: t`Icon file is too large. Please choose a file smaller than 10MB.`,
					});
					return;
				}

				const animated = await isAnimatedFile(file);

				if (animated) {
					ToastActionCreators.createToast({
						type: 'error',
						children: t`Animated icons are not supported. Please use JPEG, PNG, or WebP.`,
					});
					return;
				}

				const base64 = await AvatarUtils.fileToBase64(file);

				ModalActionCreators.push(
					modal(() => (
						<AssetCropModal
							assetType={AssetType.CHANNEL_ICON}
							imageUrl={base64}
							sourceMimeType={file.type}
							onCropComplete={(croppedBlob) => {
								const reader = new FileReader();
								reader.onload = () => {
									const croppedBase64 = reader.result as string;
									form.setValue('icon', croppedBase64);
									setPreviewIconUrl(croppedBase64);
									setHasClearedIcon(false);
									form.clearErrors('icon');
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
								form.setValue('icon', base64);
								setPreviewIconUrl(base64);
								setHasClearedIcon(false);
								form.clearErrors('icon');
							}}
						/>
					)),
				);
			} catch {
				ToastActionCreators.createToast({
					type: 'error',
					children: <Trans>That image is invalid. Please try another one.</Trans>,
				});
			}
		},
		[form],
	);

	const handleIconUploadClick = useCallback(async () => {
		const [file] = await openFilePicker({accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif'});
		await handleIconUpload(file ?? null);
	}, [handleIconUpload]);

	const handleClearIcon = useCallback(() => {
		form.setValue('icon', null);
		setPreviewIconUrl(null);
		setHasClearedIcon(true);
	}, [form]);

	const onSubmit = useCallback(
		async (data: FormInputs) => {
			const newChannel = await ChannelActionCreators.update(channelId, {
				icon: data.icon,
				name: data.name,
			});
			form.reset({name: newChannel.name});
			ToastActionCreators.createToast({type: 'success', children: <Trans>Group updated</Trans>});
			ModalActionCreators.pop();
		},
		[channelId, form],
	);

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'name',
	});

	if (!channel) {
		return null;
	}

	const iconPresentable = hasClearedIcon
		? null
		: (previewIconUrl ?? AvatarUtils.getChannelIconURL({id: channel.id, icon: channel.icon}));
	const placeholderName = channel ? ChannelUtils.getDMDisplayName(channel) : '';

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit}>
				<Modal.Header title={t`Edit Group`} />
				<Modal.Content>
					<Modal.ContentLayout>
						<div className={styles.iconSection}>
							<div className={styles.iconLabel}>
								<Trans>Group Icon</Trans>
							</div>
							<div className={styles.iconContainer}>
								{previewIconUrl ? (
									<div
										className={styles.iconPreview}
										style={{
											backgroundImage: `url(${previewIconUrl})`,
										}}
									/>
								) : iconPresentable ? (
									<div
										className={styles.iconPreview}
										style={{
											backgroundImage: `url(${iconPresentable})`,
										}}
									/>
								) : (
									<div className={styles.iconPlaceholder}>
										<PlusIcon weight="regular" className={styles.iconPlaceholderIcon} />
									</div>
								)}
								<div className={styles.iconActions}>
									<div className={styles.iconButtonGroup}>
										<Button variant="secondary" small={true} onClick={handleIconUploadClick}>
											{previewIconUrl || iconPresentable ? <Trans>Change Icon</Trans> : <Trans>Upload Icon</Trans>}
										</Button>
										{(previewIconUrl || iconPresentable) && (
											<Button variant="secondary" small={true} onClick={handleClearIcon}>
												<Trans>Remove Icon</Trans>
											</Button>
										)}
									</div>
									<div className={styles.iconHint}>
										<Trans>JPEG, PNG, WebP. Max 10MB. Recommended: 512×512px</Trans>
									</div>
								</div>
							</div>
							{form.formState.errors.icon?.message && (
								<p className={styles.iconError}>{form.formState.errors.icon.message}</p>
							)}
						</div>

						<Input
							{...form.register('name', {
								maxLength: {
									value: 100,
									message: t`Group name must not exceed 100 characters`,
								},
							})}
							type="text"
							label={t`Group Name`}
							placeholder={placeholderName || t`My Group`}
							maxLength={100}
							error={form.formState.errors.name?.message}
						/>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer>
					<Button type="submit" submitting={isSubmitting}>
						<Trans>Save</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
