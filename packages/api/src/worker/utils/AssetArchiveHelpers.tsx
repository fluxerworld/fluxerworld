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

import {S3ServiceException} from '@aws-sdk/client-s3';
import {Config} from '@fluxer/api/src/Config';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import type archiver from 'archiver';

let _cdnBucket: string | null = null;
function getCdnBucket(): string {
	if (!_cdnBucket) {
		_cdnBucket = Config.s3.buckets.cdn;
	}
	return _cdnBucket;
}

function stripAnimationPrefix(hash: string): string {
	return hash.startsWith('a_') ? hash.slice(2) : hash;
}

export function buildHashedAssetKey(prefix: string, entityId: string, hash: string): string {
	return `${prefix}/${entityId}/${stripAnimationPrefix(hash)}`;
}

export function buildSimpleAssetKey(prefix: string, key: string): string {
	return `${prefix}/${key}`;
}

export function getAnimatedAssetExtension(hash: string): 'gif' | 'png' {
	return hash.startsWith('a_') ? 'gif' : 'png';
}

export function getEmojiExtension(animated: boolean): 'gif' | 'webp' {
	return animated ? 'gif' : 'webp';
}

async function readCdnAssetIfExists(storageService: IStorageService, key: string): Promise<Buffer | null> {
	try {
		const data = await storageService.readObject(getCdnBucket(), key);
		return Buffer.from(data);
	} catch (error) {
		if (error instanceof S3ServiceException && error.name === 'NoSuchKey') {
			return null;
		}
		throw error;
	}
}

export interface AppendAssetToArchiveParams {
	archive: archiver.Archiver;
	storageService: IStorageService;
	storageKey: string;
	archiveName: string;
	label: string;
	subjectId: string;
}

export async function appendAssetToArchive({
	archive,
	storageService,
	storageKey,
	archiveName,
	label,
	subjectId,
}: AppendAssetToArchiveParams): Promise<void> {
	const buffer = await readCdnAssetIfExists(storageService, storageKey);
	if (!buffer) {
		Logger.warn({subjectId, storageKey}, `Skipping missing ${label}`);
		return;
	}

	archive.append(buffer, {name: archiveName});
}
