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
import {Form} from '@app/components/form/Form';
import {Input, Textarea} from '@app/components/form/Input';
import {UploadDropZone} from '@app/components/guild/UploadDropZone';
import {UploadSlotInfo} from '@app/components/guild/UploadSlotInfo';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import styles from '@app/components/modals/EditPackModal.module.css';
import {EmojiUploadModal} from '@app/components/modals/EmojiUploadModal';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {Logger} from '@app/lib/Logger';
import PackStore from '@app/stores/PackStore';
import {getApiErrorErrors} from '@app/utils/ApiErrorUtils';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {openFilePicker} from '@app/utils/FilePickerUtils';
import * as ImageCropUtils from '@app/utils/ImageCropUtils';
import {GlobalLimits} from '@app/utils/limits/GlobalLimits';
import {MAX_PACK_EXPRESSIONS} from '@fluxer/constants/src/LimitConstants';
import type {GuildEmojiWithUser, GuildStickerWithUser} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {PackType} from '@fluxer/schema/src/domains/pack/PackSchemas';
import {sortBySnowflakeDesc} from '@fluxer/snowflake/src/SnowflakeUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {useForm} from 'react-hook-form';

const logger = new Logger('EditPackModal');

interface FormInputs {
	name: string;
	description: string;
}

interface EditPackModalProps {
	packId: string;
	type: PackType;
	name: string;
	description: string | null;
	onSuccess?: () => void;
}

export const EditPackModal = observer(({packId, type, name, description, onSuccess}: EditPackModalProps) => {
	const {t} = useLingui();
	const form = useForm<FormInputs>({
		defaultValues: {
			name,
			description: description ?? '',
		},
	});

	const title = type === 'emoji' ? t`Edit Emoji Pack` : t`Edit Sticker Pack`;

	const submitHandler = useCallback(
		async (data: FormInputs) => {
			await PackStore.updatePack(packId, {name: data.name.trim(), description: data.description.trim() || null});
			onSuccess?.();
			ToastActionCreators.createToast({type: 'success', children: <Trans>Pack details saved</Trans>});
		},
		[packId, onSuccess],
	);

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit: submitHandler,
		defaultErrorField: 'name',
	});

	return (
		<Modal.Root size="large" onClose={() => ModalActionCreators.pop()}>
			<Modal.Header title={title} />
			<Modal.Content>
				<Modal.ContentLayout>
					<section className={styles.section}>
						<h3 className={styles.sectionTitle}>
							<Trans>Pack Details</Trans>
						</h3>
						<Form className={styles.form} form={form} onSubmit={handleSubmit}>
							<div className={styles.formFields}>
								<Input
									id="pack-name"
									label={t`Pack Name`}
									error={form.formState.errors.name?.message}
									{...form.register('name', {
										required: t`Pack name is required`,
										minLength: {value: 2, message: t`Pack name must be at least 2 characters`},
										maxLength: {value: 64, message: t`Pack name must be at most 64 characters`},
									})}
								/>
								<Textarea
									id="pack-description"
									label={t`Description`}
									error={form.formState.errors.description?.message}
									{...form.register('description', {
										maxLength: {value: 256, message: t`Maximum 256 characters`},
									})}
									minRows={2}
								/>
							</div>
							<div className={styles.formActions}>
								<Button onClick={handleSubmit} submitting={isSubmitting} variant="secondary">
									<Trans>Save Details</Trans>
								</Button>
							</div>
						</Form>
					</section>

					<div className={styles.divider} />

					{type === 'emoji' ? <PackEmojiManager packId={packId} /> : <PackStickerManager packId={packId} />}
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => ModalActionCreators.pop()}>
					<Trans>Close</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});

// ── Emoji manager ─────────────────────────────────────────────────────────

const PackEmojiManager: React.FC<{packId: string}> = observer(({packId}) => {
	const {t} = useLingui();
	const [emojis, setEmojis] = useState<ReadonlyArray<GuildEmojiWithUser>>([]);
	const [fetchStatus, setFetchStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

	const refresh = useCallback(async () => {
		try {
			setFetchStatus('pending');
			const list = await PackStore.listPackEmojis(packId);
			setEmojis(Object.freeze(sortBySnowflakeDesc([...list])));
			setFetchStatus('success');
		} catch (err) {
			logger.error('Failed to fetch pack emojis', err);
			setFetchStatus('error');
		}
	}, [packId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const limit = GlobalLimits.get('max_pack_expressions', MAX_PACK_EXPRESSIONS);

	const handleFiles = useCallback(
		async (files: FileList | ReadonlyArray<File>) => {
			const remaining = limit - emojis.length;
			const filesToUpload = Array.from(files).slice(0, Math.max(0, remaining));

			if (filesToUpload.length === 0) {
				ModalActionCreators.push(
					modal(() => (
						<ConfirmModal
							title={t`No emoji slots available`}
							description={
								<Trans>
									This pack is at its emoji limit ({limit}). Remove some existing emojis to make room.
								</Trans>
							}
							primaryText={t`Understood`}
							onPrimary={() => {}}
						/>
					)),
				);
				return;
			}

			ModalActionCreators.push(modal(() => <EmojiUploadModal count={filesToUpload.length} />));

			const prepared: Array<{name: string; image: string}> = [];
			const failures: Array<{name: string; error: string}> = [];

			for (const file of filesToUpload) {
				try {
					const maxSize = GlobalLimits.getEmojiMaxSize();
					const base64 = await ImageCropUtils.optimizeEmojiImage(file, maxSize, 128);
					prepared.push({name: sanitizeEmojiName(file.name), image: base64});
				} catch (err) {
					failures.push({name: file.name, error: err instanceof Error ? err.message : String(err)});
				}
			}

			if (prepared.length === 0) {
				ModalActionCreators.pop();
				ToastActionCreators.error(
					failures.length > 0
						? t`Could not prepare emojis: ${failures.map((f) => `${f.name}: ${f.error}`).join('; ')}`
						: t`Could not prepare emojis`,
				);
				return;
			}

			try {
				const result = await PackStore.bulkUploadPackEmojis(packId, prepared);
				if (result.failed.length > 0) {
					ToastActionCreators.error(
						t`${result.failed.length} emoji(s) failed to upload: ${result.failed.map((f) => f.error).join('; ')}`,
					);
				}
				if (result.success.length > 0) {
					ToastActionCreators.createToast({
						type: 'success',
						children: <Trans>Uploaded {result.success.length} emoji(s)</Trans>,
					});
				}
			} catch (err) {
				const apiErrors = getApiErrorErrors(err);
				const msg =
					apiErrors?.map((e) => e.message).join(', ') ??
					(err instanceof Error ? err.message : t`Failed to upload emojis`);
				ToastActionCreators.error(msg);
			} finally {
				ModalActionCreators.pop();
				await refresh();
			}
		},
		[packId, emojis.length, limit, refresh, t],
	);

	const handleDelete = useCallback(
		(emoji: GuildEmojiWithUser) => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Delete Emoji`}
						description={t`Are you sure you want to delete :${emoji.name}:? This cannot be undone.`}
						primaryText={t`Delete`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							try {
								await PackStore.removePackEmoji(packId, emoji.id);
								setEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
							} catch (err) {
								logger.error('Failed to delete pack emoji', err);
								ToastActionCreators.error(t`Failed to delete emoji`);
							}
						}}
					/>
				)),
			);
		},
		[packId, t],
	);

	const onUploadClick = useCallback(async () => {
		const files = await openFilePicker({
			multiple: true,
			accept: '.jpg,.jpeg,.png,.apng,.gif,.webp,.avif,image/*',
		});
		if (files.length > 0) void handleFiles(files);
	}, [handleFiles]);

	return (
		<section className={styles.section}>
			<h3 className={styles.sectionTitle}>
				<Trans>Emojis</Trans>
			</h3>

			<UploadSlotInfo
				title={<Trans>Emoji Slots</Trans>}
				currentCount={emojis.length}
				maxCount={limit}
				uploadButtonText={<Trans>Upload Emoji</Trans>}
				onUploadClick={onUploadClick}
				description={
					<Trans>
						Emoji names must be at least 2 characters long and can only contain alphanumeric characters and underscores.
						Allowed file types: JPEG, PNG, WebP, GIF. Images are compressed to 128x128. Max size:{' '}
						{Math.round(GlobalLimits.getEmojiMaxSize() / 1024)} KB per emoji.
					</Trans>
				}
			/>

			<UploadDropZone
				onDrop={(files: Array<File>) => {
					if (files.length > 0) void handleFiles(files);
				}}
				description={<Trans>Drag and drop emoji files here</Trans>}
			/>

			{fetchStatus === 'pending' && (
				<div className={styles.spinnerWrapper}>
					<Spinner />
				</div>
			)}

			{fetchStatus === 'error' && (
				<p className={styles.emptyText}>
					<Trans>Failed to load emojis. Try again later.</Trans>
				</p>
			)}

			{fetchStatus === 'success' && emojis.length === 0 && (
				<p className={styles.emptyText}>
					<Trans>No emojis in this pack yet. Upload some above to get started.</Trans>
				</p>
			)}

			{fetchStatus === 'success' && emojis.length > 0 && (
				<div className={styles.emojiGrid}>
					{emojis.map((emoji) => (
						<PackEmojiCard key={emoji.id} emoji={emoji} onDelete={() => handleDelete(emoji)} />
					))}
				</div>
			)}
		</section>
	);
});

const PackEmojiCard: React.FC<{emoji: GuildEmojiWithUser; onDelete: () => void}> = ({emoji, onDelete}) => {
	const {t} = useLingui();
	const url = AvatarUtils.getEmojiURL({id: emoji.id, animated: true});
	return (
		<div className={styles.emojiCard}>
			<img src={url} alt={emoji.name} className={styles.emojiImage} loading="lazy" />
			<span className={styles.emojiName}>:{emoji.name}:</span>
			<Tooltip text={t`Delete`}>
				<button type="button" className={styles.deleteButton} onClick={onDelete} aria-label={t`Delete ${emoji.name}`}>
					<XIcon weight="bold" size={14} />
				</button>
			</Tooltip>
		</div>
	);
};

// ── Sticker manager ────────────────────────────────────────────────────────

const PackStickerManager: React.FC<{packId: string}> = observer(({packId}) => {
	const {t} = useLingui();
	const [stickers, setStickers] = useState<ReadonlyArray<GuildStickerWithUser>>([]);
	const [fetchStatus, setFetchStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

	const refresh = useCallback(async () => {
		try {
			setFetchStatus('pending');
			const list = await PackStore.listPackStickers(packId);
			setStickers(Object.freeze(sortBySnowflakeDesc([...list])));
			setFetchStatus('success');
		} catch (err) {
			logger.error('Failed to fetch pack stickers', err);
			setFetchStatus('error');
		}
	}, [packId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const limit = GlobalLimits.get('max_pack_expressions', MAX_PACK_EXPRESSIONS);

	const handleFiles = useCallback(
		async (files: FileList | ReadonlyArray<File>) => {
			const remaining = limit - stickers.length;
			const filesToUpload = Array.from(files).slice(0, Math.max(0, remaining));

			if (filesToUpload.length === 0) {
				ToastActionCreators.error(t`This pack is at its sticker limit (${limit})`);
				return;
			}

			ModalActionCreators.push(modal(() => <EmojiUploadModal count={filesToUpload.length} />));

			const prepared: Array<{name: string; image: string}> = [];
			const failures: Array<{name: string; error: string}> = [];

			for (const file of filesToUpload) {
				try {
					const maxSize = GlobalLimits.getStickerMaxSize();
					const base64 = await ImageCropUtils.optimizeStickerImage(file, maxSize, 320);
					prepared.push({name: sanitizeEmojiName(file.name), image: base64});
				} catch (err) {
					failures.push({name: file.name, error: err instanceof Error ? err.message : String(err)});
				}
			}

			if (prepared.length === 0) {
				ModalActionCreators.pop();
				ToastActionCreators.error(
					failures.length > 0
						? t`Could not prepare stickers: ${failures.map((f) => `${f.name}: ${f.error}`).join('; ')}`
						: t`Could not prepare stickers`,
				);
				return;
			}

			try {
				const result = await PackStore.bulkUploadPackStickers(packId, prepared);
				if (result.failed.length > 0) {
					ToastActionCreators.error(
						t`${result.failed.length} sticker(s) failed: ${result.failed.map((f) => f.error).join('; ')}`,
					);
				}
				if (result.success.length > 0) {
					ToastActionCreators.createToast({
						type: 'success',
						children: <Trans>Uploaded {result.success.length} sticker(s)</Trans>,
					});
				}
			} catch (err) {
				const apiErrors = getApiErrorErrors(err);
				const msg =
					apiErrors?.map((e) => e.message).join(', ') ??
					(err instanceof Error ? err.message : t`Failed to upload stickers`);
				ToastActionCreators.error(msg);
			} finally {
				ModalActionCreators.pop();
				await refresh();
			}
		},
		[packId, stickers.length, limit, refresh, t],
	);

	const handleDelete = useCallback(
		(sticker: GuildStickerWithUser) => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Delete Sticker`}
						description={t`Are you sure you want to delete ${sticker.name}? This cannot be undone.`}
						primaryText={t`Delete`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							try {
								await PackStore.removePackSticker(packId, sticker.id);
								setStickers((prev) => prev.filter((s) => s.id !== sticker.id));
							} catch (err) {
								logger.error('Failed to delete pack sticker', err);
								ToastActionCreators.error(t`Failed to delete sticker`);
							}
						}}
					/>
				)),
			);
		},
		[packId, t],
	);

	const onUploadClick = useCallback(async () => {
		const files = await openFilePicker({
			multiple: true,
			accept: '.jpg,.jpeg,.png,.apng,.gif,.webp,.avif,image/*',
		});
		if (files.length > 0) void handleFiles(files);
	}, [handleFiles]);

	return (
		<section className={styles.section}>
			<h3 className={styles.sectionTitle}>
				<Trans>Stickers</Trans>
			</h3>

			<UploadSlotInfo
				title={<Trans>Sticker Slots</Trans>}
				currentCount={stickers.length}
				maxCount={limit}
				uploadButtonText={<Trans>Upload Sticker</Trans>}
				onUploadClick={onUploadClick}
				description={
					<Trans>
						Stickers are scaled to 320x320. Max size: {Math.round(GlobalLimits.getStickerMaxSize() / 1024)} KB per
						sticker.
					</Trans>
				}
			/>

			<UploadDropZone
				onDrop={(files: Array<File>) => {
					if (files.length > 0) void handleFiles(files);
				}}
				description={<Trans>Drag and drop sticker files here</Trans>}
			/>

			{fetchStatus === 'pending' && (
				<div className={styles.spinnerWrapper}>
					<Spinner />
				</div>
			)}

			{fetchStatus === 'success' && stickers.length === 0 && (
				<p className={styles.emptyText}>
					<Trans>No stickers in this pack yet.</Trans>
				</p>
			)}

			{fetchStatus === 'success' && stickers.length > 0 && (
				<div className={styles.emojiGrid}>
					{stickers.map((sticker) => (
						<PackStickerCard key={sticker.id} sticker={sticker} onDelete={() => handleDelete(sticker)} />
					))}
				</div>
			)}
		</section>
	);
});

const PackStickerCard: React.FC<{sticker: GuildStickerWithUser; onDelete: () => void}> = ({sticker, onDelete}) => {
	const {t} = useLingui();
	const url = AvatarUtils.getStickerURL({id: sticker.id, animated: true});
	return (
		<div className={styles.emojiCard}>
			<img src={url} alt={sticker.name} className={styles.emojiImage} loading="lazy" />
			<span className={styles.emojiName}>{sticker.name}</span>
			<Tooltip text={t`Delete`}>
				<button type="button" className={styles.deleteButton} onClick={onDelete} aria-label={t`Delete ${sticker.name}`}>
					<XIcon weight="bold" size={14} />
				</button>
			</Tooltip>
		</div>
	);
};

// Local fallback name sanitizer (mirrors GuildEmojiActionCreators.sanitizeEmojiName).
function sanitizeEmojiName(fileName: string): string {
	const name =
		fileName
			.split('.')
			.shift()
			?.replace(/[^a-zA-Z0-9_]/g, '') ?? '';
	return name.padEnd(2, '_').slice(0, 32);
}
