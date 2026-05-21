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

import * as MediaViewerActionCreators from '@app/actions/MediaViewerActionCreators';
import {Spinner} from '@app/components/uikit/Spinner';
import {getAttachmentKey, loadAttachmentKeysFromStorage} from '@app/lib/e2ee/E2EEMessageIntegration';
import {useDecryptedAttachment} from '@app/lib/e2ee/EncryptedAttachmentLoader';
import type {MessageRecord} from '@app/records/MessageRecord';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {DownloadSimpleIcon, FileIcon, LockKeyIcon} from '@phosphor-icons/react';
import {type FC, useCallback, useEffect, useRef, useState} from 'react';

interface Props {
	attachment: MessageAttachment;
	message: MessageRecord;
}

const MAX_INLINE_DIMENSION = 400;

// Renders an encrypted attachment in two modes:
//   - image/* — fetch + decrypt eagerly so the inline preview is
//     ready by the time the user looks at the bubble (matches the
//     non-encrypted UX);
//   - everything else — a download card that defers fetch + decrypt
//     until the user clicks. Decrypting a 50MB upload off-screen is
//     wasteful and feels unsafe; the user should opt in.
export const EncryptedAttachmentBubble: FC<Props> = ({attachment, message}) => {
	const {t} = useLingui();
	// Re-read on every render after hydration so a successful IDB load
	// surfaces the entry without forcing a separate state slot for it.
	const [, setHydrationTick] = useState(0);
	const entry = getAttachmentKey(message.id, attachment.id);
	const ciphertextUrl = attachment.url ?? '';

	// After a page refresh attachmentKeyCache is empty. Pull keys from
	// IDB before falling through to the "key missing" placeholder.
	const [hydrated, setHydrated] = useState(() => entry !== null);
	useEffect(() => {
		if (entry) {
			setHydrated(true);
			return;
		}
		let cancelled = false;
		void loadAttachmentKeysFromStorage(message.id).then((loaded) => {
			if (cancelled) return;
			setHydrated(true);
			if (loaded) setHydrationTick((n) => n + 1);
		});
		return () => {
			cancelled = true;
		};
	}, [entry, message.id]);

	const isImageMime = entry?.mime.startsWith('image/') ?? false;
	const [requested, setRequested] = useState(false);
	const downloadFiredRef = useRef(false);

	const result = useDecryptedAttachment({
		messageId: message.id,
		attachmentId: attachment.id,
		ciphertextUrl,
		enabled: Boolean(entry) && Boolean(ciphertextUrl) && (isImageMime || requested),
	});

	// Auto-download once a user-requested decrypt resolves.
	useEffect(() => {
		if (isImageMime) return;
		if (!requested) return;
		if (result.status !== 'ready' || !result.blobUrl) return;
		if (downloadFiredRef.current) return;
		downloadFiredRef.current = true;
		const a = document.createElement('a');
		a.href = result.blobUrl;
		a.download = entry?.name ?? attachment.filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}, [isImageMime, requested, result.status, result.blobUrl, entry?.name, attachment.filename]);

	const handleDownload = useCallback(() => {
		downloadFiredRef.current = false;
		setRequested(true);
	}, []);

	if (!entry) {
		if (!hydrated) {
			return (
				<div style={{...skeletonStyle, width: MAX_INLINE_DIMENSION, height: 80}}>
					<Spinner />
				</div>
			);
		}
		return (
			<div style={placeholderStyle}>
				<Trans>Encrypted attachment — key missing</Trans>
			</div>
		);
	}

	if (isImageMime) {
		const hasRealDims = (entry.width ?? 0) > 0 && (entry.height ?? 0) > 0;
		const targetWidth = hasRealDims
			? Math.min(entry.width!, MAX_INLINE_DIMENSION)
			: MAX_INLINE_DIMENSION;
		const targetHeight = hasRealDims
			? Math.round((entry.height! / entry.width!) * targetWidth)
			: undefined;

		if (result.status === 'loading' || result.status === 'idle') {
			return (
				<div style={{...skeletonStyle, width: targetWidth, height: targetHeight ?? 200}}>
					<Spinner />
				</div>
			);
		}
		if (result.status === 'error' || !result.blobUrl) {
			return (
				<div style={placeholderStyle}>
					<Trans>Couldn't decrypt this attachment.</Trans>
				</div>
			);
		}
		const openInViewer = () => {
			if (!result.blobUrl) return;
			MediaViewerActionCreators.openMediaViewer(
				[
					{
						src: result.blobUrl,
						originalSrc: result.blobUrl,
						naturalWidth: entry.width ?? targetWidth,
						naturalHeight: entry.height ?? targetHeight ?? 200,
						type: 'image' as const,
						contentHash: undefined,
						embedIndex: undefined,
						expiresAt: undefined,
						expired: undefined,
						animated: false,
					},
				],
				0,
				{channelId: message.channelId, messageId: message.id, message},
			);
		};
		return (
			<button
				type="button"
				onClick={openInViewer}
				aria-label={t`Open image in full view`}
				style={{
					display: 'inline-block',
					maxWidth: '100%',
					padding: 0,
					border: 0,
					background: 'none',
					cursor: 'pointer',
				}}
			>
				<img
					src={result.blobUrl}
					alt={attachment.description ?? entry.name}
					width={targetWidth}
					height={targetHeight}
					style={{maxWidth: '100%', borderRadius: '0.25rem', display: 'block'}}
				/>
			</button>
		);
	}

	const isWorking = requested && (result.status === 'idle' || result.status === 'loading');
	const isError = requested && (result.status === 'error' || (result.status === 'ready' && !result.blobUrl));
	const downloadable = Boolean(requested && result.status === 'ready' && result.blobUrl);

	return (
		<button
			type="button"
			onClick={handleDownload}
			disabled={isWorking || downloadable}
			aria-label={t`Decrypt and download ${entry.name}`}
			style={fileCardStyle}
		>
			<FileIcon size={28} weight="regular" />
			<div style={fileCardTextColumnStyle}>
				<span style={fileCardNameStyle}>{entry.name}</span>
				<span style={fileCardSubStyle}>
					<LockKeyIcon size={12} weight="fill" style={{verticalAlign: 'text-bottom'}} />{' '}
					{isError ? (
						<Trans>Couldn't decrypt — try again</Trans>
					) : isWorking ? (
						<Trans>Decrypting…</Trans>
					) : downloadable ? (
						<Trans>Downloaded</Trans>
					) : (
						<Trans>Encrypted attachment — click to decrypt and download</Trans>
					)}
				</span>
			</div>
			{isWorking ? (
				<Spinner />
			) : (
				<DownloadSimpleIcon size={20} weight="regular" />
			)}
		</button>
	);
};

const placeholderStyle: React.CSSProperties = {
	padding: '0.75rem 1rem',
	border: '1px dashed var(--background-modifier-accent)',
	borderRadius: '0.5rem',
	color: 'var(--text-secondary)',
	fontSize: '0.875rem',
};

const skeletonStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	background: 'var(--background-secondary)',
	borderRadius: '0.25rem',
};

const fileCardStyle: React.CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: '0.75rem',
	padding: '0.5rem 0.75rem',
	border: '1px solid var(--background-modifier-accent)',
	borderRadius: '0.5rem',
	background: 'var(--background-secondary)',
	color: 'var(--text-primary)',
	cursor: 'pointer',
	maxWidth: '100%',
	font: 'inherit',
};

const fileCardTextColumnStyle: React.CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	textAlign: 'left',
	minWidth: 0,
};

const fileCardNameStyle: React.CSSProperties = {
	fontSize: '0.875rem',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	maxWidth: '24rem',
};

const fileCardSubStyle: React.CSSProperties = {
	fontSize: '0.75rem',
	color: 'var(--text-secondary)',
};
