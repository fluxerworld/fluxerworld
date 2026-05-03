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

import {Spinner} from '@app/components/uikit/Spinner';
import {getAttachmentKey} from '@app/lib/e2ee/E2EEMessageIntegration';
import {useDecryptedAttachment} from '@app/lib/e2ee/EncryptedAttachmentLoader';
import type {MessageRecord} from '@app/records/MessageRecord';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {Trans} from '@lingui/react/macro';
import type {FC} from 'react';

interface Props {
	attachment: MessageAttachment;
	message: MessageRecord;
}

const MAX_INLINE_DIMENSION = 400;

// Renders an encrypted attachment in three phases: skeleton while
// fetching+decrypting, an inline <img> once the AES-GCM decrypt
// resolves, or a placeholder if the key is missing or decryption fails.
// Image-only for v1 — non-image mimes get a download link to the
// decrypted blob, video/audio playback is deferred to a later slice.
export const EncryptedAttachmentBubble: FC<Props> = ({attachment, message}) => {
	const entry = getAttachmentKey(message.id, attachment.id);
	const ciphertextUrl = attachment.url ?? '';
	const result = useDecryptedAttachment({
		messageId: message.id,
		attachmentId: attachment.id,
		ciphertextUrl,
		enabled: Boolean(entry) && Boolean(ciphertextUrl),
	});

	if (!entry) {
		return (
			<div style={placeholderStyle}>
				<Trans>Encrypted attachment — key missing</Trans>
			</div>
		);
	}

	const targetWidth = Math.min(entry.width ?? MAX_INLINE_DIMENSION, MAX_INLINE_DIMENSION);
	const targetHeight = entry.width && entry.height
		? Math.round((entry.height / entry.width) * targetWidth)
		: undefined;

	if (result.status === 'loading' || result.status === 'idle') {
		return (
			<div
				style={{
					...skeletonStyle,
					width: targetWidth,
					height: targetHeight ?? 200,
				}}
			>
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

	const mime = result.mime ?? entry.mime;
	if (mime.startsWith('image/')) {
		return (
			<a
				href={result.blobUrl}
				target="_blank"
				rel="noreferrer"
				download={entry.name}
				style={{display: 'inline-block', maxWidth: '100%'}}
			>
				<img
					src={result.blobUrl}
					alt={attachment.description ?? entry.name}
					width={targetWidth}
					height={targetHeight}
					style={{maxWidth: '100%', borderRadius: '0.25rem', display: 'block'}}
				/>
			</a>
		);
	}

	// Non-image v1: render a download-the-decrypted-file link.
	return (
		<a href={result.blobUrl} download={entry.name} style={downloadLinkStyle}>
			<Trans>Download decrypted attachment ({entry.name})</Trans>
		</a>
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

const downloadLinkStyle: React.CSSProperties = {
	display: 'inline-block',
	padding: '0.5rem 0.75rem',
	border: '1px solid var(--background-modifier-accent)',
	borderRadius: '0.5rem',
	color: 'var(--text-link)',
	textDecoration: 'none',
};
