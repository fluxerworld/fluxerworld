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

import {CloudUpload} from '@app/lib/CloudUpload';

interface FileUploadResult {
	success: boolean;
	error?: 'too_many_attachments' | 'no_files' | 'empty_text';
}

export async function handleFileUpload(
	channelId: string,
	files: FileList | Array<File>,
	currentAttachmentCount: number,
	maxAttachments: number,
): Promise<FileUploadResult> {
	const fileArray = Array.from(files);

	if (fileArray.length === 0) {
		return {success: false, error: 'no_files'};
	}

	if (currentAttachmentCount + fileArray.length > maxAttachments) {
		return {success: false, error: 'too_many_attachments'};
	}

	await CloudUpload.addFiles(channelId, fileArray);
	return {success: true};
}

export async function convertTextToFile(
	channelId: string,
	text: string,
	currentAttachmentCount: number,
	maxAttachments: number,
): Promise<FileUploadResult> {
	const trimmedText = text.trim();

	if (!trimmedText) {
		return {success: false, error: 'empty_text'};
	}

	const blob = new Blob([text], {type: 'text/plain'});
	const file = new File([blob], 'message.txt', {type: 'text/plain'});

	return handleFileUpload(channelId, [file], currentAttachmentCount, maxAttachments);
}
